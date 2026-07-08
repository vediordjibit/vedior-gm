/**
 * AdminPricingTab.tsx
 * Composant autonome à brancher dans AdminPanel.tsx sur l'onglet 'pricing'
 *
 * Usage dans AdminPanel.tsx :
 *   import AdminPricingTab from './AdminPricingTab';
 *   // Dans le render, remplacer le bloc `activeTab === 'pricing' ? (...)` par :
 *   activeTab === 'pricing' ? <AdminPricingTab recruiters={recruiters} db={db} /> : null
 *
 * Firestore :
 *   - Lit/écrit  settings_pricing/config     → tarifs & moyens de paiement
 *   - Lit/écrit  recruiters/{id}             → plan, planStatus, planExpiry
 *   - Lit        payments (collection)        → historique paiements (optionnel, crée si inexistant)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown, Settings, CreditCard, Users, CheckCircle, XCircle,
  Clock, Edit2, Save, X, ChevronDown, ChevronUp, AlertCircle,
  RefreshCw, Wallet, Building2, Smartphone, Plus, Trash2,
  ToggleLeft, ToggleRight, Calendar, DollarSign, TrendingUp,
  Eye, EyeOff, Copy, Check, Info, Mail, Zap, CalendarCheck
} from 'lucide-react';
import {
  doc, getDoc, setDoc, updateDoc, collection, onSnapshot,
  query, orderBy, serverTimestamp, addDoc, Timestamp
} from 'firebase/firestore';
import { sendActivationEmail, sendRejectionEmail, computeExpiryDate, fmtDate } from '../lib/sendSubscriptionEmail';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface PricingConfig {
  // Tarifs
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  // Limites plan gratuit
  freeJobsLimit: number;
  freeApplicationsLimit: number;
  freeRequestsLimit: number;
  // CAC Pay
  cacNumber: string;
  cacEnabled: boolean;
  // Virement bancaire
  bankName: string;
  bankHolder: string;
  bankAccount: string;
  bankIban: string;
  bankBic: string;
  bankEnabled: boolean;
  // Carte bancaire
  cardEnabled: boolean;
  cardProvider: string;
  cardPublicKey: string;
  cardSecretKeyEnv: string;
  cardCheckoutUrl: string;
  cardWebhookUrl: string;
  // Email support
  supportEmail: string;
  // Misc
  updatedAt?: any;
}

interface Recruiter {
  id: string;
  contactName?: string;
  companyName?: string;
  email?: string;
  plan?: string;
  planBilling?: string;
  planStatus?: string;
  planActivatedAt?: string;
  planExpiry?: string;
  planNote?: string;
}

interface Payment {
  id: string;
  recruiterId: string;
  recruiterEmail?: string;
  recruiterName?: string;
  amount: number;
  billing: string;
  method: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: any;
  confirmedAt?: any;
  note?: string;
}

const DEFAULT_CONFIG: PricingConfig = {
  monthlyPrice: 15000,
  quarterlyPrice: 39000,
  yearlyPrice: 144000,
  freeJobsLimit: 1,
  freeApplicationsLimit: 5,
  freeRequestsLimit: 1,
  cacNumber: '+253 77 XX XX XX',
  cacEnabled: true,
  bankName: 'Banque Centrale de Djibouti (BCD)',
  bankHolder: 'Vedior GM SARL',
  bankAccount: 'DJ 01 0001 0000 XXXX XXXX XXXX',
  bankIban: 'DJ 01 0001 0000 XXXX XXXX XXXX',
  bankBic: 'BCDIJDJA',
  bankEnabled: true,
  cardEnabled: false,
  cardProvider: 'Stripe',
  cardPublicKey: '',
  cardSecretKeyEnv: 'PAYMENT_SECRET_KEY',
  cardCheckoutUrl: '',
  cardWebhookUrl: '',
  supportEmail: 'support@vedior-gm.dj',
};

// ─────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────
const Pill = ({ label, color }: { label: string; color: string }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${color}`}>
    {label}
  </span>
);

const planBillingLabel: Record<string, string> = {
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};

const planStatusColor: Record<string, string> = {
  active:              'bg-green-50 text-green-700 border-green-200',
  pending_confirmation:'bg-amber-50 text-amber-700 border-amber-200',
  expired:             'bg-red-50 text-red-500 border-red-200',
  cancelled:           'bg-gray-100 text-gray-500 border-gray-200',
};

const methodLabel: Record<string, string> = {
  card: '💳 Carte',
  cac:  '📱 CAC Pay',
  transfer: '🏦 Virement',
};

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy}
      className="ml-2 p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all text-gray-400 hover:text-gray-700">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  );
}

// ─────────────────────────────────────────────
// Section 1 — KPI bar
// ─────────────────────────────────────────────
function KpiBar({ recruiters, config }: { recruiters: Recruiter[]; config: PricingConfig }) {
  const proList   = recruiters.filter(r => r.plan === 'pro');
  const pending   = recruiters.filter(r => r.planStatus === 'pending_confirmation');
  const revenue   = proList.length * config.monthlyPrice;

  const cards = [
    { label: 'Recruteurs Free', value: recruiters.filter(r => !r.plan || r.plan === 'free').length, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
    { label: 'Recruteurs Pro',  value: proList.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    { label: 'En attente',      value: pending.length,  color: pending.length > 0 ? 'text-amber-600' : 'text-gray-400', bg: pending.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200' },
    { label: 'Revenus / mois',  value: `${revenue.toLocaleString('fr-FR')} FDJ`, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className={`rounded-2xl border p-5 ${c.bg}`}>
          <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section 2 — Tarifs & Config (Firestore)
// ─────────────────────────────────────────────
function TarifsEditor({ config, onSave }: { config: PricingConfig; onSave: (c: PricingConfig) => Promise<void> }) {
  const [draft, setDraft] = useState<PricingConfig>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [open, setOpen]     = useState(true);

  useEffect(() => { setDraft(config); }, [config]);

  const upd = (k: keyof PricingConfig, v: any) => setDraft(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const mSave = ((1 - draft.quarterlyPrice / (draft.monthlyPrice * 3)) * 100).toFixed(0);
  const ySave = ((1 - draft.yearlyPrice    / (draft.monthlyPrice * 12)) * 100).toFixed(0);

  const field = (label: string, key: keyof PricingConfig, type: 'number' | 'text' = 'number', suffix?: string) => (
    <div>
      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1.5">{label}</label>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-gray-400 transition-all">
        <input
          type={type}
          value={draft[key] as any}
          onChange={e => upd(key, type === 'number' ? Number(e.target.value) : e.target.value)}
          className="flex-1 bg-transparent outline-none font-black text-gray-900 text-sm"
        />
        {suffix && <span className="text-xs text-gray-400 font-black shrink-0">{suffix}</span>}
      </div>
    </div>
  );

  const toggle = (key: keyof PricingConfig, label: string) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm font-black text-gray-700">{label}</span>
      <button onClick={() => upd(key, !draft[key])}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${draft[key] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
        {draft[key] ? <><ToggleRight size={16} /> Activé</> : <><ToggleLeft size={16} /> Désactivé</>}
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-gray-50 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <Settings size={18} className="text-gray-600" />
          </div>
          <div className="text-left">
            <p className="font-black text-gray-900 text-sm">Tarifs & Configuration des plans</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Prix, limites gratuites, moyens de paiement</p>
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-6 space-y-8">

          {/* ── Tarifs ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">💰 Tarifs Plan Pro</p>
            <div className="grid grid-cols-3 gap-4">
              {field('Prix mensuel', 'monthlyPrice', 'number', 'FDJ')}
              {field('Prix trimestriel', 'quarterlyPrice', 'number', 'FDJ')}
              {field('Prix annuel', 'yearlyPrice', 'number', 'FDJ')}
            </div>
            <div className="mt-3 flex gap-4 text-[11px] text-gray-500 font-medium">
              <span>Économie trim. : <strong className="text-green-600">{mSave}%</strong></span>
              <span>Économie annuelle : <strong className="text-green-600">{ySave}%</strong></span>
            </div>
          </div>

          {/* ── Limites Free ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">🆓 Limites Plan Gratuit</p>
            <div className="grid grid-cols-3 gap-4">
              {field('Offres actives max', 'freeJobsLimit')}
              {field('Candidatures / offre', 'freeApplicationsLimit')}
              {field('Demandes / mois', 'freeRequestsLimit')}
            </div>
          </div>

          {/* ── Moyens de paiement ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">💳 Moyens de Paiement</p>

            {/* CAC Pay */}
            <div className="border border-gray-100 rounded-2xl p-5 mb-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone size={16} className="text-blue-500" />
                <p className="font-black text-sm text-gray-800">CAC Pay</p>
              </div>
              {toggle('cacEnabled', 'Activer CAC Pay')}
              {field('Numéro CAC Pay', 'cacNumber', 'text')}
            </div>

            {/* Virement */}
            <div className="border border-gray-100 rounded-2xl p-5 mb-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-gray-600" />
                <p className="font-black text-sm text-gray-800">Virement Bancaire</p>
              </div>
              {toggle('bankEnabled', 'Activer Virement')}
              <div className="grid grid-cols-2 gap-3">
                {field('Banque', 'bankName', 'text')}
                {field('Titulaire', 'bankHolder', 'text')}
                {field('N° Compte', 'bankAccount', 'text')}
                {field('IBAN', 'bankIban', 'text')}
                {field('BIC / SWIFT', 'bankBic', 'text')}
              </div>
            </div>

            {/* Carte */}
            <div className="border border-gray-100 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-gray-500" />
                <p className="font-black text-sm text-gray-800">Carte bancaire</p>
              </div>
              {toggle('cardEnabled', 'Activer paiement carte (API future)')}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {field('Fournisseur', 'cardProvider', 'text')}
                {field('Cle publique API', 'cardPublicKey', 'text')}
                {field('Variable secret serveur', 'cardSecretKeyEnv', 'text')}
                {field('URL checkout', 'cardCheckoutUrl', 'text')}
                {field('URL webhook', 'cardWebhookUrl', 'text')}
              </div>
              <p className="text-[11px] text-gray-400 font-medium mt-3 flex items-center gap-1.5">
                <Info size={12} /> Ne stockez pas la cle secrete ici. Gardez-la dans les variables serveur et indiquez seulement son nom.
              </p>
              {!draft.cardEnabled && (
                <p className="text-[11px] text-amber-600 font-medium mt-2 flex items-center gap-1.5">
                  <Info size={12} /> Désactivé — intégrez une API (Stripe, etc.) pour activer
                </p>
              )}
            </div>

            {/* Email support */}
            <div className="border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">✉️</span>
                <p className="font-black text-sm text-gray-800">Email de support (affiché aux recruteurs)</p>
              </div>
              {field('Email support', 'supportEmail', 'text')}
            </div>
          </div>

          {/* ── Save ── */}
          <div className="flex justify-end">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-700 transition-all disabled:opacity-50 shadow-lg">
              {saving ? <RefreshCw size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} className="text-green-400" /> : <Save size={16} />}
              {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé ✓' : 'Enregistrer la configuration'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section 3 — Paiements en attente
// ─────────────────────────────────────────────
function PendingPayments({ recruiters, onConfirm, onReject, config }: {
  recruiters: Recruiter[];
  onConfirm: (rec: Recruiter, note?: string) => Promise<void>;
  onReject:  (rec: Recruiter, note?: string) => Promise<void>;
  config: PricingConfig;
}) {
  const pending = recruiters.filter(r => r.planStatus === 'pending_confirmation');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  if (pending.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-amber-200 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
          <Clock size={16} className="text-amber-600" />
        </div>
        <div>
          <p className="font-black text-amber-800 text-sm">Paiements en attente de confirmation</p>
          <p className="text-[10px] text-amber-600 font-medium">{pending.length} demande(s) à traiter</p>
        </div>
        <span className="ml-auto w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-white text-[10px] font-black">
          {pending.length}
        </span>
      </div>
      <div className="divide-y divide-amber-100">
        {pending.map(rec => {
          const price = config[`${rec.planBilling || 'monthly'}Price` as keyof PricingConfig] as number;
          return (
            <div key={rec.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center font-black text-amber-800">
                    {(rec.companyName || rec.contactName || 'R')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm">{rec.companyName || rec.contactName || 'Recruteur'}</p>
                    <p className="text-[11px] text-gray-500">{rec.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-amber-700 text-sm">{price?.toLocaleString('fr-FR')} FDJ</p>
                  <p className="text-[10px] text-gray-400">{planBillingLabel[rec.planBilling || 'monthly']}</p>
                  <p className="text-[10px] text-gray-400">{rec.planActivatedAt ? new Date(rec.planActivatedAt).toLocaleDateString('fr-FR') : ''}</p>
                </div>
              </div>
              <input
                placeholder="Note optionnelle (ex: reçu CAC Pay #12345)"
                value={notes[rec.id] || ''}
                onChange={e => setNotes(n => ({ ...n, [rec.id]: e.target.value }))}
                className="w-full bg-white border border-amber-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-amber-400 transition-all"
              />
              {/* Résumé abonnement */}
              <div className="grid grid-cols-3 gap-3 bg-white rounded-xl p-4 border border-amber-100">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Plan</p>
                  <p className="text-sm font-black text-gray-900">⚡ Pro</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Durée</p>
                  <p className="text-sm font-black text-gray-900">
                    {rec.planBilling === 'quarterly' ? '3 mois' : rec.planBilling === 'yearly' ? '12 mois' : '1 mois'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Montant</p>
                  <p className="text-sm font-black text-green-700">{price?.toLocaleString('fr-FR')} FDJ</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={loading[rec.id]}
                  onClick={async () => {
                    setLoading(l => ({ ...l, [rec.id]: true }));
                    await onConfirm(rec, notes[rec.id]);
                    setLoading(l => ({ ...l, [rec.id]: false }));
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-black text-xs hover:bg-green-700 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20">
                  {loading[rec.id]
                    ? <><RefreshCw size={14} className="animate-spin" /> Traitement...</>
                    : <><Zap size={14} /> Confirmer & Activer — Email auto</>
                  }
                </button>
                <button
                  disabled={loading[rec.id]}
                  onClick={async () => {
                    setLoading(l => ({ ...l, [rec.id]: true }));
                    await onReject(rec, notes[rec.id]);
                    setLoading(l => ({ ...l, [rec.id]: false }));
                  }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-red-500 font-black text-xs hover:bg-red-50 transition-all disabled:opacity-50">
                  <XCircle size={14} /> Refuser
                </button>
              </div>
              <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1.5">
                <Mail size={11} /> Un email d'activation sera envoyé automatiquement à <strong>{rec.email}</strong>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Section 4 — Liste recruteurs + gestion sécurisée
// ─────────────────────────────────────────────

// Modal de confirmation d'action plan
function PlanActionModal({ rec, action, config, onConfirm, onClose }: {
  rec: Recruiter;
  action: 'activate' | 'revoke' | 'extend';
  config: PricingConfig;
  onConfirm: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [billing, setBilling] = useState(rec.planBilling || 'monthly');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const REASONS_ACTIVATE = ['Paiement reçu (CAC Pay)', 'Paiement reçu (virement)', 'Offre commerciale', "Période d'essai offerte", 'Autre'];
  const REASONS_REVOKE   = ['Abonnement expiré', 'Non-paiement', 'Fraude / abus', 'Demande du recruteur', 'Autre'];
  const REASONS_EXTEND   = ['Renouvellement payé', 'Extension commerciale', 'Compensation retard', 'Autre'];

  const reasons = action === 'activate' ? REASONS_ACTIVATE : action === 'revoke' ? REASONS_REVOKE : REASONS_EXTEND;

  const priceMap: Record<string, number> = {
    monthly:   config.monthlyPrice,
    quarterly: config.quarterlyPrice,
    yearly:    config.yearlyPrice,
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setLoading(true);
    await onConfirm({ billing, reason, note });
    setLoading(false);
    onClose();
  };

  const actionConfig = {
    activate: { title: 'Activer le plan Pro',  color: 'bg-green-600 hover:bg-green-700', icon: '⚡', label: "Confirmer l'activation" },
    revoke:   { title: 'Révoquer le plan Pro', color: 'bg-red-600 hover:bg-red-700',    icon: '🚫', label: "Confirmer la révocation" },
    extend:   { title: 'Prolonger le plan Pro',color: 'bg-blue-600 hover:bg-blue-700',  icon: '📅', label: "Confirmer la prolongation" },
  }[action];

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)'}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{actionConfig.icon}</span>
            <div>
              <p className="font-black text-gray-900">{actionConfig.title}</p>
              <p className="text-xs text-gray-400 font-medium">{rec.companyName || rec.contactName} · {rec.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Facturation (seulement pour activate/extend) */}
          {action !== 'revoke' && (
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Durée de l'abonnement</label>
              <div className="grid grid-cols-3 gap-2">
                {(['monthly','quarterly','yearly'] as const).map(b => (
                  <button key={b} onClick={() => setBilling(b)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${billing === b ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="text-xs font-black text-gray-900">{planBillingLabel[b]}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{priceMap[b]?.toLocaleString('fr-FR')} FDJ</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Motif obligatoire */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">
              Motif <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {reasons.map(r => (
                <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${reason === r ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-blue-600" />
                  <span className="text-sm font-bold text-gray-800">{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Note optionnelle */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Note interne (optionnel)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex: Reçu CAC Pay #12345, confirmé le 07/06/2026..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-gray-400 transition-all"
            />
          </div>

          {/* Récapitulatif */}
          {action !== 'revoke' && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Plan après confirmation</p>
                <p className="text-sm font-black text-gray-900">⚡ Pro · {planBillingLabel[billing]}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Montant</p>
                <p className="text-sm font-black text-green-700">{priceMap[billing]?.toLocaleString('fr-FR')} FDJ</p>
              </div>
            </div>
          )}
          {action === 'revoke' && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-xs font-black text-red-600 flex items-center gap-2">
                <AlertCircle size={14} /> Le recruteur perdra l'accès Pro immédiatement. Un email de notification sera envoyé.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={handleSubmit} disabled={!reason || loading}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-black text-sm transition-all disabled:opacity-40 shadow-lg ${actionConfig.color}`}>
            {loading ? <><RefreshCw size={15} className="animate-spin" /> Traitement...</> : <>{actionConfig.label}</>}
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl border border-gray-200 text-gray-500 font-black text-sm hover:bg-gray-50 transition-all">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function RecruiterList({ recruiters, onUpdate, config, onActivate, onRevoke }: {
  recruiters: Recruiter[];
  onUpdate: (id: string, data: Partial<Recruiter>) => Promise<void>;
  config: PricingConfig;
  onActivate: (rec: Recruiter, data: any) => Promise<void>;
  onRevoke: (rec: Recruiter, data: any) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'pro'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ rec: Recruiter; action: 'activate' | 'revoke' | 'extend' } | null>(null);
  const [noteExpanded, setNoteExpanded] = useState<Record<string, string>>({});

  const filtered = recruiters
    .filter(r => filterPlan === 'all' || (filterPlan === 'pro' ? r.plan === 'pro' : (!r.plan || r.plan === 'free')))
    .filter(r => {
      const q = search.toLowerCase();
      return (r.contactName || '').toLowerCase().includes(q)
        || (r.companyName || '').toLowerCase().includes(q)
        || (r.email || '').toLowerCase().includes(q);
    });

  return (
    <>
      {/* Modal */}
      {modal && (
        <PlanActionModal
          rec={modal.rec}
          action={modal.action}
          config={config}
          onClose={() => setModal(null)}
          onConfirm={async (data) => {
            if (modal.action === 'revoke') {
              await onRevoke(modal.rec, data);
            } else {
              await onActivate(modal.rec, data);
            }
          }}
        />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">Recruteurs & Abonnements</p>
              <p className="text-[10px] text-gray-400 font-medium">{recruiters.length} recruteur(s) au total</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-gray-400 transition-all w-48" />
            {(['all', 'free', 'pro'] as const).map(f => (
              <button key={f} onClick={() => setFilterPlan(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterPlan === f ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                {f === 'all' ? 'Tous' : f === 'pro' ? '⚡ Pro' : 'Free'}
              </button>
            ))}
          </div>
        </div>

        {/* Légende */}
        <div className="px-6 py-2.5 bg-blue-50/50 border-b border-blue-100 flex items-center gap-2">
          <Info size={12} className="text-blue-500 shrink-0" />
          <p className="text-[10px] text-blue-600 font-medium">Les changements de plan nécessitent une confirmation avec motif. Aucune modification directe n'est possible.</p>
        </div>

        {/* Table */}
        <div className="divide-y divide-gray-50">
          {filtered.length === 0 && <div className="py-12 text-center text-gray-400 font-medium text-sm">Aucun recruteur trouvé</div>}

          {filtered.map(rec => {
            const isPro = rec.plan === 'pro';
            const status = rec.planStatus || (isPro ? 'active' : 'free');
            const isExpanded = expandedId === rec.id;
            const isExpired = rec.planExpiry ? new Date(rec.planExpiry) < new Date() : false;

            return (
              <div key={rec.id} className={`transition-all ${rec.planStatus === 'pending_confirmation' ? 'bg-amber-50/30' : ''}`}>
                {/* Main row */}
                <div className="flex items-center px-6 py-4 gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${isPro ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {(rec.companyName || rec.contactName || 'R')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-gray-900 text-sm truncate">{rec.companyName || rec.contactName || 'Recruteur'}</p>
                      {isPro && <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md uppercase">⚡ Pro</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">
                      {rec.contactName && rec.contactName !== rec.companyName ? `${rec.contactName} · ` : ''}{rec.email || '—'}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    {isPro && rec.planExpiry && (
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border ${isExpired ? 'bg-red-50 text-red-500 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {isExpired ? '⚠ Expiré' : `Exp. ${new Date(rec.planExpiry).toLocaleDateString('fr-FR')}`}
                      </span>
                    )}
                    {status && (
                      <Pill
                        label={status === 'active' ? '● Actif' : status === 'pending_confirmation' ? '⏳ Attente' : status === 'expired' ? '✕ Expiré' : status === 'cancelled' ? '✕ Annulé' : status}
                        color={planStatusColor[status] || 'bg-gray-100 text-gray-500 border-gray-200'}
                      />
                    )}
                    {isPro && rec.planBilling && (
                      <Pill label={planBillingLabel[rec.planBilling] || rec.planBilling} color="bg-blue-50 text-blue-600 border-blue-200" />
                    )}
                  </div>

                  {/* Actions contextuelles */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isPro && (
                      <button onClick={() => setModal({ rec, action: 'activate' })}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white font-black text-[10px] hover:bg-green-700 transition-all shadow-sm shadow-green-600/20">
                        <Zap size={12} /> Activer Pro
                      </button>
                    )}
                    {isPro && (
                      <>
                        <button onClick={() => setModal({ rec, action: 'extend' })}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white font-black text-[10px] hover:bg-blue-700 transition-all shadow-sm">
                          <Calendar size={12} /> Prolonger
                        </button>
                        <button onClick={() => setModal({ rec, action: 'revoke' })}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-red-200 text-red-500 font-black text-[10px] hover:bg-red-50 transition-all">
                          <XCircle size={12} /> Révoquer
                        </button>
                      </>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                      className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-all">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Détail (lecture seule) */}
                {isExpanded && (
                  <div className="px-6 pb-5 pt-3 border-t border-gray-100 bg-gray-50/50 space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Détails de l'abonnement (lecture seule)</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Plan',         value: isPro ? '⚡ Pro' : 'Free' },
                        { label: 'Facturation',  value: rec.planBilling ? planBillingLabel[rec.planBilling] : '—' },
                        { label: 'Statut',       value: status },
                        { label: 'Activé le',    value: rec.planActivatedAt ? new Date(rec.planActivatedAt).toLocaleDateString('fr-FR') : '—' },
                        { label: 'Expire le',    value: rec.planExpiry ? new Date(rec.planExpiry).toLocaleDateString('fr-FR') : '—' },
                        { label: 'Modifié',      value: (rec as any).planUpdatedAt ? new Date((rec as any).planUpdatedAt).toLocaleDateString('fr-FR') : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-[9px] font-black uppercase text-gray-300 tracking-widest mb-1">{label}</p>
                          <p className="text-xs font-black text-gray-800">{value}</p>
                        </div>
                      ))}
                    </div>
                    {rec.planNote && (
                      <div className="bg-white rounded-xl p-3 border border-gray-100">
                        <p className="text-[9px] font-black uppercase text-gray-300 tracking-widest mb-1">Note interne</p>
                        <p className="text-xs text-gray-600 font-medium italic">"{rec.planNote}"</p>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                      <Info size={11} /> Pour modifier le plan, utilisez les boutons d'action ci-dessus. Chaque modification est tracée et confirmée.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────
export default function AdminPricingTab({ recruiters, db }: { recruiters: any[]; db: any }) {
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Charger la config depuis Firestore
  useEffect(() => {
    getDoc(doc(db, 'settings_pricing', 'config')).then(snap => {
      if (snap.exists()) setConfig(prev => ({ ...prev, ...snap.data() as PricingConfig }));
      setLoadingConfig(false);
    }).catch(() => setLoadingConfig(false));
  }, [db]);

  // Sauvegarder la config
  const saveConfig = useCallback(async (newConfig: PricingConfig) => {
    await setDoc(doc(db, 'settings_pricing', 'config'), {
      ...newConfig,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setConfig(newConfig);
  }, [db]);

  // ── Confirmation automatique complète ──
  const confirmPayment = useCallback(async (rec: Recruiter, note?: string) => {
    const now = new Date();
    const billing = rec.planBilling || 'monthly';
    const expiry  = computeExpiryDate(billing, now);

    // Prix selon le plan
    const priceMap: Record<string, number> = {
      monthly:   config.monthlyPrice,
      quarterly: config.quarterlyPrice,
      yearly:    config.yearlyPrice,
    };
    const price = priceMap[billing] || config.monthlyPrice;

    // 1️⃣ Mettre à jour Firestore — recruteur
    const firestoreData = {
      plan:             'pro',
      planStatus:       'active',
      planConfirmedAt:  now.toISOString(),
      planActivatedAt:  now.toISOString(),
      planExpiry:       expiry.toISOString().split('T')[0],
      planBilling:      billing,
      planNote:         note || '',
      planUpdatedAt:    now.toISOString(),
    };
    await updateDoc(doc(db, 'recruiters', rec.id), firestoreData);

    // 2️⃣ Créer entrée dans payments (historique)
    try {
      await addDoc(collection(db, 'payments'), {
        recruiterId:    rec.id,
        recruiterEmail: rec.email,
        recruiterName:  rec.companyName || rec.contactName,
        amount:         price,
        billing,
        status:        'confirmed',
        confirmedAt:   serverTimestamp(),
        expiryDate:    expiry.toISOString().split('T')[0],
        note:          note || '',
      });
    } catch { /* ignoré */ }

    // 3️⃣ Envoyer email automatique au recruteur
    if (rec.email) {
      // Lire les infos de la société pour l'email
      let supportEmail = config.supportEmail || 'support@vedior-gm.dj';
      let platformUrl  = 'https://vediorgm.web.app';
      try {
        const compSnap = await getDoc(doc(db, 'settings_company', 'info'));
        if (compSnap.exists()) {
          const c = compSnap.data();
          if (c.supportEmail) supportEmail = c.supportEmail;
          if (c.website)      platformUrl  = c.website;
        }
      } catch {}

      await sendActivationEmail({
        toEmail:       rec.email,
        toName:        rec.companyName || rec.contactName || 'Recruteur',
        companyName:   rec.companyName || '',
        planBilling:   billing as any,
        planPrice:     price,
        activatedDate: fmtDate(now),
        expiryDate:    fmtDate(expiry),
        supportEmail,
        platformUrl,
        note,
      });
    }
  }, [db, config]);

  // ── Rejet avec email ──
  const rejectPayment = useCallback(async (rec: Recruiter, note?: string) => {
    await updateDoc(doc(db, 'recruiters', rec.id), {
      plan:       'free',
      planStatus: 'cancelled',
      planNote:   note || 'Paiement refusé',
    });

    // Email de rejet
    if (rec.email) {
      let supportEmail = config.supportEmail || 'support@vedior-gm.dj';
      try {
        const compSnap = await getDoc(doc(db, 'settings_company', 'info'));
        if (compSnap.exists() && compSnap.data().supportEmail)
          supportEmail = compSnap.data().supportEmail;
      } catch {}

      await sendRejectionEmail({
        toEmail:      rec.email,
        toName:       rec.companyName || rec.contactName || 'Recruteur',
        companyName:  rec.companyName || '',
        reason:       note,
        supportEmail,
      });
    }
  }, [db, config]);

  // Mettre à jour un recruteur (accès)
  const updateRecruiter = useCallback(async (id: string, data: Partial<Recruiter>) => {
    await updateDoc(doc(db, 'recruiters', id), {
      ...data,
      planUpdatedAt: new Date().toISOString(),
    });
  }, [db]);

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <RefreshCw size={24} className="animate-spin mr-3" /> Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div>
        <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Abonnements Recruteurs</h1>
        <p className="text-gray-400 text-sm font-medium">
          Gérez les tarifs, les moyens de paiement et les accès recruteurs
        </p>
      </div>

      {/* KPI */}
      <KpiBar recruiters={recruiters} config={config} />

      {/* Paiements en attente — s'affiche seulement si besoin */}
      <PendingPayments
        recruiters={recruiters}
        onConfirm={confirmPayment}
        onReject={rejectPayment}
        config={config}
      />

      {/* Config tarifs + moyens de paiement */}
      <TarifsEditor config={config} onSave={saveConfig} />

      {/* Liste recruteurs + gestion accès sécurisée */}
      <RecruiterList
        recruiters={recruiters}
        onUpdate={updateRecruiter}
        config={config}
        onActivate={async (rec, { billing, reason, note }) => {
          // Activation manuelle par admin (avec motif tracé)
          const now = new Date();
          const expiry = computeExpiryDate(billing, now);
          const priceMap: Record<string, number> = {
            monthly: config.monthlyPrice,
            quarterly: config.quarterlyPrice,
            yearly: config.yearlyPrice,
          };
          await updateDoc(doc(db, 'recruiters', rec.id), {
            plan: 'pro',
            planStatus: 'active',
            planBilling: billing,
            planActivatedAt: now.toISOString(),
            planExpiry: expiry.toISOString().split('T')[0],
            planNote: `[Admin] ${reason}${note ? ' — ' + note : ''}`,
            planUpdatedAt: now.toISOString(),
          });
          try {
            await addDoc(collection(db, 'payments'), {
              recruiterId: rec.id,
              recruiterEmail: rec.email,
              recruiterName: rec.companyName || rec.contactName,
              amount: priceMap[billing] || config.monthlyPrice,
              billing,
              status: 'confirmed',
              source: 'admin_manual',
              reason,
              note: note || '',
              confirmedAt: serverTimestamp(),
              expiryDate: expiry.toISOString().split('T')[0],
            });
          } catch {}
        }}
        onRevoke={async (rec, { reason, note }) => {
          await updateDoc(doc(db, 'recruiters', rec.id), {
            plan: 'free',
            planStatus: 'cancelled',
            planNote: `[Révocation] ${reason}${note ? ' — ' + note : ''}`,
            planUpdatedAt: new Date().toISOString(),
          });
          // Email de révocation
          if (rec.email) {
            let supportEmail = config.supportEmail || 'support@vedior-gm.dj';
            try {
              const compSnap = await getDoc(doc(db, 'settings_company', 'info'));
              if (compSnap.exists() && compSnap.data().supportEmail) supportEmail = compSnap.data().supportEmail;
            } catch {}
            await sendRejectionEmail({
              toEmail: rec.email,
              toName: rec.companyName || rec.contactName || 'Recruteur',
              companyName: rec.companyName || '',
              reason: `${reason}${note ? ' — ' + note : ''}`,
              supportEmail,
            });
          }
        }}
      />
    </div>
  );
}