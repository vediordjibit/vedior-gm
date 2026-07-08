import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2, Phone, Mail, MapPin, Globe, Save, RefreshCw,
  CheckCircle, ChevronDown, ChevronUp, MessageCircle, Shield,
  AtSign, Hash, Link, ExternalLink
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_COMPANY, type CompanyInfo } from '../lib/useCompanyInfo';

// ── Field EN DEHORS + React.memo → jamais re-monté ──
const Field = React.memo(({
  label, fieldKey, type = 'text', placeholder, icon: Icon, value, onUpdate
}: {
  label: string;
  fieldKey: keyof CompanyInfo;
  type?: string;
  placeholder?: string;
  icon?: any;
  value: string;
  onUpdate: (k: keyof CompanyInfo, v: string) => void;
}) => (
  <div>
    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1.5">
      {label}
    </label>
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-gray-400 transition-all">
      {Icon && <Icon size={15} className="text-gray-400 shrink-0" />}
      <input
        type={type}
        value={value}
        onChange={e => onUpdate(fieldKey, e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none font-bold text-gray-900 text-sm"
      />
    </div>
  </div>
));

export default function CompanyInfoEditor({ db }: { db: any }) {
  const [data, setData]       = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [open, setOpen]       = useState(true);
  const dbRef = useRef(db);

  useEffect(() => {
    getDoc(doc(dbRef.current, 'settings_company', 'info'))
      .then(snap => {
        if (snap.exists()) setData(prev => ({ ...prev, ...snap.data() as CompanyInfo }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const upd = useCallback((k: keyof CompanyInfo, v: string) => {
    setData(prev => ({ ...prev, [k]: v }));
  }, []);

  const save = async () => {
    setSaving(true);
    await setDoc(doc(dbRef.current, 'settings_company', 'info'), {
      ...data, updatedAt: serverTimestamp(),
    }, { merge: true });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-8 py-6 hover:bg-gray-50 transition-all text-left">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-navy/5 flex items-center justify-center">
            <Building2 size={20} className="text-navy" />
          </div>
          <div>
            <p className="font-black text-gray-900">Informations de la Société</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              Nom, contacts, adresse, réseaux sociaux — utilisés partout sur le site
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-green-600 text-xs font-black">
              <CheckCircle size={14} /> Sauvegardé
            </span>
          )}
          {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-8 space-y-8">

          {/* Identité */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4 flex items-center gap-2">
              <Hash size={12} /> Identité
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom commercial" fieldKey="name" icon={Building2} placeholder="Vedior GM" value={data.name} onUpdate={upd} />
              <Field label="Nom légal (SARL, SA...)" fieldKey="legalName" icon={Shield} placeholder="Vedior GM SARL" value={data.legalName} onUpdate={upd} />
              <div className="col-span-2">
                <Field label="Slogan / Tagline" fieldKey="tagline" placeholder="Plateforme de recrutement à Djibouti" value={data.tagline} onUpdate={upd} />
              </div>
              <Field label="Année de fondation" fieldKey="foundedYear" placeholder="2024" value={data.foundedYear} onUpdate={upd} />
              <Field label="Site web" fieldKey="website" icon={Globe} placeholder="https://vediorgm.web.app" value={data.website} onUpdate={upd} />
            </div>
          </section>

          {/* Contacts */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4 flex items-center gap-2">
              <Phone size={12} /> Contacts
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Téléphone fixe" fieldKey="phone" icon={Phone} placeholder="+253 21 35 XX XX" value={data.phone} onUpdate={upd} />
              <Field label="WhatsApp (bouton flottant)" fieldKey="whatsapp" icon={MessageCircle} placeholder="+253 77 XX XX XX" value={data.whatsapp} onUpdate={upd} />
              <Field label="Email de contact (affiché publiquement)" fieldKey="email" icon={Mail} type="email" placeholder="contact@vedior-gm.dj" value={data.email} onUpdate={upd} />
              <Field label="Email support (recruteurs)" fieldKey="supportEmail" icon={AtSign} type="email" placeholder="support@vedior-gm.dj" value={data.supportEmail} onUpdate={upd} />
              <div className="col-span-2">
                <Field label="Adresse" fieldKey="address" icon={MapPin} placeholder="Djibouti Ville, République de Djibouti" value={data.address} onUpdate={upd} />
              </div>
            </div>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[11px] text-amber-700 font-medium flex items-start gap-2">
                <MessageCircle size={13} className="mt-0.5 shrink-0" />
                Le numéro WhatsApp doit être au format international sans espaces ni +, ex : <strong>25377XXXXXX</strong> pour le lien wa.me
              </p>
            </div>
          </section>

          {/* Réseaux sociaux */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4 flex items-center gap-2">
              <Globe size={12} /> Réseaux Sociaux (optionnels)
            </p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="LinkedIn" fieldKey="linkedinUrl" icon={Link} placeholder="https://linkedin.com/company/..." value={data.linkedinUrl} onUpdate={upd} />
              <Field label="Facebook" fieldKey="facebookUrl" icon={ExternalLink} placeholder="https://facebook.com/..." value={data.facebookUrl} onUpdate={upd} />
              <Field label="Instagram" fieldKey="instagramUrl" icon={ExternalLink} placeholder="https://instagram.com/..." value={data.instagramUrl} onUpdate={upd} />
            </div>
          </section>

          {/* Footer */}
          <section>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4 flex items-center gap-2">
              <Hash size={12} /> Footer
            </p>
            <Field label="Texte copyright (footer)" fieldKey="copyright" placeholder="© 2026 VEDIOR GM" value={data.copyright} onUpdate={upd} />
          </section>

          {/* Save */}
          <div className="flex justify-end pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-700 transition-all disabled:opacity-50 shadow-lg shadow-gray-900/10">
              {saving
                ? <><RefreshCw size={16} className="animate-spin" /> Sauvegarde...</>
                : saved
                ? <><CheckCircle size={16} className="text-green-400" /> Enregistré ✓</>
                : <><Save size={16} /> Enregistrer les informations</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}