/**
 * MatchingPanel.tsx
 * 
 * Pipeline complet : Matching IA/Manuel → CV Envoyé → Entretien → Placé/Refusé
 * Chaque étape est sauvegardée dans Firestore sous needs/{needId}.candidatePipeline
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Users, Search, CheckCircle, X, Loader2,
  AlertCircle, Link2, Phone, Mail, Sparkles, RefreshCw,
  FileText, Calendar, UserCheck, XCircle, ChevronRight,
  Clock, ArrowRight, Trophy, Edit3, Check, Trash2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, onSnapshot, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type PipelineStep = 'linked' | 'cv_sent' | 'interview_planned' | 'interview_done' | 'placed' | 'rejected';

interface CandidatePipelineEntry {
  candidateId: string;
  step: PipelineStep;
  linkedAt?: string;
  linkedMode?: 'ai' | 'manual';
  propositionId?: string; // links back to the propositions doc shown to the recruiter
  cvSentAt?: string;
  interviewDate?: string;
  interviewDoneAt?: string;
  placedAt?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  notes?: string;
  aiScore?: number;
  aiVerdict?: string;
}

interface Candidate {
  id: string;
  fullName?: string;
  displayName?: string;
  jobTitle?: string;
  sector?: string;
  experience?: number | string;
  availability?: string;
  education?: string;
  nationality?: string;
  languages?: string;
  phone?: string;
  email?: string;
  status?: string;
  skills?: string;
  cvUrl?: string;
}

interface AIMatchResult {
  candidateId: string;
  score: number;
  verdict: string;
  reasons: string[];
  concerns: string[];
}

// ─────────────────────────────────────────────
// Pondérations de matching (configurables depuis l'Admin > Réglages)
// Stockées dans Firestore : settings_matching/config
// ─────────────────────────────────────────────
interface MatchingWeights {
  algo: {
    sector: number;
    sectorPartial: number;
    experience: number;
    experiencePartial: number;
    experiencePartialRatio: number; // ex: 0.7 = 70% de l'exp. requise
    availabilityImmediate: number;
    availability1Month: number;
    availability2Months: number;
    education: number;
    educationLower: number;
  };
  manual: {
    sector: number;
    sectorOther: number;
    experience: number;
    experiencePartial: number;
    experiencePartialGap: number; // ex: 2 = on accepte jusqu'à -2 ans
    availabilityImmediate: number;
    availabilityOther: number;
    diploma: number;
    diplomaOther: number;
    diplomaNoneRequired: number;
    skillsMax: number;
    skillsPerMatch: number;
  };
}

const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  algo: {
    sector: 40,
    sectorPartial: 20,
    experience: 30,
    experiencePartial: 15,
    experiencePartialRatio: 0.7,
    availabilityImmediate: 15,
    availability1Month: 10,
    availability2Months: 5,
    education: 15,
    educationLower: 8,
  },
  manual: {
    sector: 40,
    sectorOther: 5,
    experience: 25,
    experiencePartial: 12,
    experiencePartialGap: 2,
    availabilityImmediate: 15,
    availabilityOther: 5,
    diploma: 10,
    diplomaOther: 3,
    diplomaNoneRequired: 10,
    skillsMax: 10,
    skillsPerMatch: 4,
  },
};

interface MatchingPanelProps {
  need: any;
  candidates: Candidate[];
  onLink: (needId: string, candidateId: string, mode: 'ai' | 'manual') => Promise<void>;
  linkedIds?: Set<string>;
}

// ─────────────────────────────────────────────
// Pipeline config
// ─────────────────────────────────────────────
const STEPS: { key: PipelineStep; label: string; icon: React.ReactNode; color: string; bg: string; border: string }[] = [
  { key: 'linked',           label: 'Lié',             icon: <Link2 size={12} />,        color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-200' },
  { key: 'cv_sent',          label: 'CV Envoyé',       icon: <FileText size={12} />,     color: 'text-blue-600',   bg: 'bg-blue-50',     border: 'border-blue-200' },
  { key: 'interview_planned',label: 'Entretien Planifié', icon: <Calendar size={12} />, color: 'text-amber-600',  bg: 'bg-amber-50',    border: 'border-amber-200' },
  { key: 'interview_done',   label: 'Entretien Passé', icon: <UserCheck size={12} />,    color: 'text-purple-600', bg: 'bg-purple-50',   border: 'border-purple-200' },
  { key: 'placed',           label: 'Placé ✓',         icon: <Trophy size={12} />,       color: 'text-emerald-600',bg: 'bg-emerald-50',  border: 'border-emerald-200' },
];

const stepIndex = (step: PipelineStep) => {
  const order: PipelineStep[] = ['linked','cv_sent','interview_planned','interview_done','placed'];
  return order.indexOf(step);
};

const scoreColor = (score: number) => {
  if (score >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-400', border: 'border-emerald-100' };
  if (score >= 60) return { bg: 'bg-blue-50',    text: 'text-blue-600',   bar: 'bg-blue-400',    border: 'border-blue-100' };
  if (score >= 40) return { bg: 'bg-amber-50',   text: 'text-amber-600',  bar: 'bg-amber-400',   border: 'border-amber-100' };
  return              { bg: 'bg-red-50',      text: 'text-red-400',    bar: 'bg-red-300',     border: 'border-red-100' };
};

// ─────────────────────────────────────────────
// Sub-component: PipelineCard
// ─────────────────────────────────────────────
function PipelineCard({
  entry, candidate, needId, onUpdate, onRemove
}: {
  entry: CandidatePipelineEntry;
  candidate: Candidate | undefined;
  needId: string;
  onUpdate: (candidateId: string, updates: Partial<CandidatePipelineEntry>) => Promise<void>;
  onRemove: (candidateId: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [noteValue, setNoteValue] = useState(entry.notes || '');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!candidate) return null;

  const currentStepIdx = entry.step === 'rejected' ? -1 : stepIndex(entry.step);
  const isRejected = entry.step === 'rejected';
  const isPlaced = entry.step === 'placed';

  const advance = async (toStep: PipelineStep, extra?: Partial<CandidatePipelineEntry>) => {
    setSaving(true);
    const now = new Date().toISOString();
    const updates: Partial<CandidatePipelineEntry> = { step: toStep, ...extra };
    if (toStep === 'cv_sent') updates.cvSentAt = now;
    if (toStep === 'interview_planned') updates.interviewDate = dateValue || now;
    if (toStep === 'interview_done') updates.interviewDoneAt = now;
    if (toStep === 'placed') updates.placedAt = now;
    if (toStep === 'rejected') { updates.rejectedAt = now; updates.rejectedReason = rejectReason; }
    await onUpdate(entry.candidateId, updates);
    setSaving(false);
    setShowDateInput(false);
    setShowRejectInput(false);
  };

  const saveNote = async () => {
    setSaving(true);
    await onUpdate(entry.candidateId, { notes: noteValue });
    setSaving(false);
    setShowNotes(false);
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isRejected ? 'opacity-60 border-red-100' : isPlaced ? 'border-emerald-200' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${isPlaced ? 'bg-emerald-50 text-emerald-600' : isRejected ? 'bg-red-50 text-red-400' : 'bg-gray-100 text-gray-700'}`}>
          {(candidate.fullName || candidate.displayName || 'C')[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-gray-900 text-sm truncate">
              {candidate.fullName || candidate.displayName || 'Candidat'}
            </p>
            {entry.aiScore !== undefined && (
              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${scoreColor(entry.aiScore).bg} ${scoreColor(entry.aiScore).text} ${scoreColor(entry.aiScore).border}`}>
                IA {entry.aiScore}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
            {candidate.jobTitle || candidate.sector || '—'}
            {candidate.experience ? ` · ${candidate.experience} ans` : ''}
          </p>
          {(candidate.phone || candidate.email) && (
            <div className="flex items-center gap-3 mt-1">
              {candidate.phone && <span className="text-[10px] text-gray-400 flex items-center gap-1"><Phone size={9}/>{candidate.phone}</span>}
              {candidate.email && <span className="text-[10px] text-gray-400 flex items-center gap-1 truncate max-w-[160px]"><Mail size={9}/>{candidate.email}</span>}
            </div>
          )}
        </div>

        {/* Remove button */}
        <button
          onClick={() => onRemove(entry.candidateId)}
          className="shrink-0 text-gray-200 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Pipeline progress bar */}
      {!isRejected && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-0.5">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className={`h-1.5 rounded-full w-full transition-all ${i <= currentStepIdx ? (isPlaced ? 'bg-emerald-400' : 'bg-blue-400') : 'bg-gray-100'}`} />
                {i < STEPS.length - 1 && <div className="w-0.5" />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {STEPS.map((s, i) => (
              <span key={s.key} className={`text-[8px] font-bold ${i === currentStepIdx ? (isPlaced ? 'text-emerald-500' : 'text-blue-500') : i < currentStepIdx ? 'text-gray-400' : 'text-gray-200'}`}>
                {i === 0 ? '🔗' : i === 1 ? '📄' : i === 2 ? '📅' : i === 3 ? '🤝' : '🏆'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current step badge + date */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        {isRejected ? (
          <span className="flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl">
            <XCircle size={11} /> Refusé{entry.rejectedReason ? ` — ${entry.rejectedReason}` : ''}
          </span>
        ) : (
          <span className={`flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl border ${STEPS[currentStepIdx]?.bg} ${STEPS[currentStepIdx]?.color} ${STEPS[currentStepIdx]?.border}`}>
            {STEPS[currentStepIdx]?.icon} {STEPS[currentStepIdx]?.label}
          </span>
        )}
        {entry.interviewDate && entry.step === 'interview_planned' && (
          <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
            <Clock size={10} /> {new Date(entry.interviewDate).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
          </span>
        )}
        {entry.notes && (
          <span className="text-[10px] text-gray-400 italic truncate max-w-[180px]">💬 {entry.notes}</span>
        )}
      </div>

      {/* Action buttons */}
      {!isRejected && !isPlaced && (
        <div className="border-t border-gray-50 px-4 py-3 flex flex-wrap gap-2">
          {/* Next step button */}
          {entry.step === 'linked' && (
            <button
              onClick={() => advance('cv_sent')}
              disabled={saving}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
              CV Envoyé au recruteur
            </button>
          )}

          {entry.step === 'cv_sent' && !showDateInput && (
            <button
              onClick={() => setShowDateInput(true)}
              className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-amber-600 transition-all"
            >
              <Calendar size={11} /> Planifier entretien
            </button>
          )}

          {entry.step === 'cv_sent' && showDateInput && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="datetime-local"
                value={dateValue}
                onChange={e => setDateValue(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] font-medium outline-none"
              />
              <button
                onClick={() => advance('interview_planned')}
                disabled={saving || !dateValue}
                className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase disabled:opacity-40"
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Confirmer
              </button>
              <button onClick={() => setShowDateInput(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
          )}

          {entry.step === 'interview_planned' && (
            <button
              onClick={() => advance('interview_done')}
              disabled={saving}
              className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-purple-700 transition-all"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
              Entretien passé
            </button>
          )}

          {entry.step === 'interview_done' && (
            <button
              onClick={() => advance('placed')}
              disabled={saving}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Trophy size={11} />}
              Candidat Placé ✓
            </button>
          )}

          {/* Notes */}
          {!showNotes && (
            <button onClick={() => setShowNotes(true)} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-[10px] font-black uppercase px-3 py-2 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
              <Edit3 size={10} /> Note
            </button>
          )}

          {showNotes && (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={noteValue}
                onChange={e => setNoteValue(e.target.value)}
                placeholder="Ajouter une note..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] outline-none"
              />
              <button onClick={saveNote} disabled={saving} className="bg-gray-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-black">
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              </button>
              <button onClick={() => setShowNotes(false)} className="text-gray-400"><X size={14} /></button>
            </div>
          )}

          {/* Reject */}
          {!showRejectInput && (
            <button
              onClick={() => setShowRejectInput(true)}
              className="flex items-center gap-1 text-red-400 hover:text-red-600 text-[10px] font-black uppercase px-3 py-2 rounded-xl border border-red-100 hover:border-red-200 transition-all ml-auto"
            >
              <XCircle size={10} /> Refuser
            </button>
          )}

          {showRejectInput && (
            <div className="flex items-center gap-2 w-full flex-wrap">
              <input
                type="text"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Motif de refus (optionnel)"
                className="flex-1 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 text-[11px] outline-none"
              />
              <button onClick={() => advance('rejected')} disabled={saving} className="bg-red-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1">
                {saving ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />} Confirmer
              </button>
              <button onClick={() => setShowRejectInput(false)} className="text-gray-400"><X size={14} /></button>
            </div>
          )}
        </div>
      )}

      {/* Placed footer */}
      {isPlaced && (
        <div className="border-t border-emerald-100 px-4 py-3 bg-emerald-50">
          <p className="text-[10px] font-black text-emerald-600 flex items-center gap-1.5">
            <Trophy size={12} /> Candidat placé avec succès
            {entry.placedAt && ` · ${new Date(entry.placedAt).toLocaleDateString('fr-FR')}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main: MatchingPanel
// ─────────────────────────────────────────────
export default function MatchingPanel({ need, candidates, onLink, linkedIds = new Set() }: MatchingPanelProps) {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');

  // ── Pondérations de matching (dynamiques, depuis settings_matching/config) ──
  const [weights, setWeights] = useState<MatchingWeights>(DEFAULT_MATCHING_WEIGHTS);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings_matching', 'config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setWeights({
          algo: { ...DEFAULT_MATCHING_WEIGHTS.algo, ...(data.algo || {}) },
          manual: { ...DEFAULT_MATCHING_WEIGHTS.manual, ...(data.manual || {}) },
        });
      }
    }, () => {
      // En cas d'erreur (ex: doc inexistant sans permissions), garder les valeurs par défaut
      setWeights(DEFAULT_MATCHING_WEIGHTS);
    });
    return () => unsub();
  }, []);

  // Pipeline state — loaded from need.candidatePipeline
  const [pipeline, setPipeline] = useState<CandidatePipelineEntry[]>(() => {
    if (need?.candidatePipeline && Array.isArray(need.candidatePipeline)) {
      return need.candidatePipeline;
    }
    // Migrate from old linkedCandidates array
    const old: string[] = need?.linkedCandidates || [];
    return old.map(id => ({ candidateId: id, step: 'linked' as PipelineStep, linkedMode: 'manual', linkedAt: new Date().toISOString() }));
  });

  // Sync pipeline when need changes (e.g. Firestore update)
  useEffect(() => {
    if (need?.candidatePipeline && Array.isArray(need.candidatePipeline)) {
      setPipeline(need.candidatePipeline);
    }
  }, [need?.candidatePipeline]);

  // AI state — initialise depuis le cache Firestore (need.aiMatchingCache) pour éviter
  // de relancer Groq inutilement à chaque réouverture de l'onglet.
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<AIMatchResult[]>(() => {
    if (need?.aiMatchingCache?.results && Array.isArray(need.aiMatchingCache.results)) {
      return need.aiMatchingCache.results;
    }
    return [];
  });
  const [aiCachedAt, setAiCachedAt] = useState<string | null>(need?.aiMatchingCache?.cachedAt || null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Manual state — filtres avancés
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState(() => need?.sector || '');
  const [expFilter, setExpFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [eduFilter, setEduFilter] = useState('');

  // Already in pipeline
  const pipelineIds = new Set(pipeline.map(e => e.candidateId));

  // ── Save pipeline to Firestore ──
  const savePipeline = async (updated: CandidatePipelineEntry[]) => {
    try {
      await updateDoc(doc(db, 'needs', need.id), {
        candidatePipeline: updated,
        linkedCandidates: updated.map(e => e.candidateId),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Pipeline save error:', e);
    }
  };

  // ── Notify candidate when their pipeline step changes ──
  const notifyCandidate = async (candidateId: string, step: PipelineStep, extra?: Partial<CandidatePipelineEntry>) => {
    const labels: Record<PipelineStep, { title: string; message: string } | null> = {
      linked: { title: 'Votre profil a été sélectionné', message: `Votre profil correspond à une offre "${need?.jobTitle || need?.title || ''}" et a été transmis pour étude.` },
      cv_sent: { title: 'Votre CV a été transmis', message: `Votre candidature a été envoyée au recruteur pour le poste "${need?.jobTitle || need?.title || ''}".` },
      interview_planned: { title: 'Entretien planifié', message: extra?.interviewDate ? `Un entretien a été planifié le ${new Date(extra.interviewDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}.` : 'Un entretien a été planifié pour votre candidature.' },
      interview_done: { title: 'Entretien réalisé', message: `Votre entretien pour "${need?.jobTitle || need?.title || ''}" a été enregistré. Le recruteur va statuer prochainement.` },
      placed: { title: 'Félicitations, vous êtes recruté(e) !', message: `Vous avez été retenu(e) pour le poste "${need?.jobTitle || need?.title || ''}". 🎉` },
      rejected: { title: 'Mise à jour de votre candidature', message: `Votre candidature pour "${need?.jobTitle || need?.title || ''}" n'a pas été retenue${extra?.rejectedReason ? ` — ${extra.rejectedReason}` : ''}.` },
    };
    const payload = labels[step];
    if (!payload) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: candidateId,
        type: 'pipeline_update',
        title: payload.title,
        message: payload.message,
        needId: need?.id,
        step,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Candidate pipeline notification failed:', e);
    }
  };

  // ── Update one entry ──
  const handleUpdateEntry = async (candidateId: string, updates: Partial<CandidatePipelineEntry>) => {
    const updated = pipeline.map(e =>
      e.candidateId === candidateId ? { ...e, ...updates } : e
    );
    setPipeline(updated);
    await savePipeline(updated);

    // Notify the candidate whenever their step changes
    if (updates.step) {
      notifyCandidate(candidateId, updates.step, updates);
    }

    // Reverse-sync: keep the linked proposition's status aligned with the pipeline step
    // (candidatePipeline stays the single source of truth; propositions is just the recruiter-facing view)
    if (updates.step) {
      const entry = updated.find(e => e.candidateId === candidateId);
      const propId = entry?.propositionId;
      if (propId) {
        const propStatus = updates.step === 'rejected' ? 'rejected'
          : updates.step === 'placed' ? 'accepted'
          : updates.step !== 'linked' ? 'accepted'
          : undefined;
        if (propStatus) {
          const propUpdate: any = { status: propStatus };
          if (updates.step === 'rejected' && updates.rejectedReason) propUpdate.rejectReason = updates.rejectedReason;
          updateDoc(doc(db, 'propositions', propId), propUpdate).catch(() => {});
        }
      }
    }
  };

  // ── Remove entry ──
  const handleRemoveEntry = async (candidateId: string) => {
    const updated = pipeline.filter(e => e.candidateId !== candidateId);
    setPipeline(updated);
    await savePipeline(updated);
  };

  // ── Link new candidate ──
  const handleLink = async (candidateId: string, linkMode: 'ai' | 'manual', aiScore?: number, aiVerdict?: string) => {
    if (pipelineIds.has(candidateId)) return;
    const entry: CandidatePipelineEntry = {
      candidateId,
      step: 'linked',
      linkedMode: linkMode,
      linkedAt: new Date().toISOString(),
      ...(aiScore !== undefined ? { aiScore, aiVerdict } : {}),
    };
    const updated = [...pipeline, entry];
    setPipeline(updated);
    await savePipeline(updated);
    await onLink(need.id, candidateId, linkMode);
    notifyCandidate(candidateId, 'linked');
  };

  // ── Score algorithmique (gratuit, instantané) ─────────────────
  const computeAlgoScore = (c: Candidate): Omit<AIMatchResult, 'candidateId'> => {
    const w = weights.algo;
    let score = 0;
    const reasons: string[] = [];
    const concerns: string[] = [];

    // Secteur
    const cs = (c.sector || '').toLowerCase();
    const ns = (need.sector || '').toLowerCase();
    if (cs && ns && cs === ns) { score += w.sector; reasons.push("Secteur identique"); }
    else if (cs && ns && (cs.includes(ns.slice(0,4)) || ns.includes(cs.slice(0,4)))) { score += w.sectorPartial; reasons.push("Secteur proche"); }
    else if (ns) concerns.push("Secteur différent");

    // Expérience
    const expC = parseFloat(String(c.experience || 0)) || 0;
    const expR = parseFloat(String(need.expRequired || 0)) || 0;
    if (expR === 0) { score += w.experience; }
    else if (expC >= expR) { score += w.experience; reasons.push(`${expC} ans exp. (min ${expR})`); }
    else if (expC >= expR * w.experiencePartialRatio) { score += w.experiencePartial; concerns.push(`Exp. ${expC}/${expR} ans`); }
    else concerns.push(`Exp. insuffisante (${expC}/${expR} ans)`);

    // Disponibilité
    const av = (c.availability || '').toLowerCase();
    if (av.includes('imméd') || av.includes('immedi')) { score += w.availabilityImmediate; reasons.push("Disponible immédiatement"); }
    else if (av.includes('1 mois')) score += w.availability1Month;
    else if (av.includes('2 mois')) score += w.availability2Months;

    // Formation
    const edu = (c.education || '').toLowerCase();
    if (edu.includes('master') || edu.includes('ingénieur') || edu.includes('licence') || edu.includes('bts')) { score += w.education; }
    else if (edu.includes('bac') || edu.includes('cap') || edu.includes('bep')) { score += w.educationLower; }

    // FIX #7 — Compétences (utilisées dans algo comme dans manuel)
    const skillsMax = w.education; // on réutilise le même plafond de points que formation
    if (need.skills && c.skills) {
      const needSkills = need.skills.toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);
      const candSkills = (c.skills || '').toLowerCase();
      const matched = needSkills.filter((s: string) => candSkills.includes(s));
      if (matched.length > 0) {
        const pts = Math.min(skillsMax, Math.round((matched.length / needSkills.length) * skillsMax));
        score += pts;
        reasons.push(`${matched.length}/${needSkills.length} compétence(s)`);
      }
    }

    // FIX #6 — Normalisation : score ramené sur 100 en fonction du total max réel des poids
    const maxPossible = w.sector + w.experience + w.availabilityImmediate + w.education + skillsMax;
    const normalized = maxPossible > 0 ? Math.round((score / maxPossible) * 100) : 0;

    const verdict = normalized >= 80 ? 'Excellent' : normalized >= 60 ? 'Bon' : normalized >= 40 ? 'Moyen' : 'Faible';
    if (reasons.length === 0) reasons.push("Profil à évaluer");
    return { score: normalized, verdict, reasons, concerns };
  };

  // ── AI matching avec Groq via /api/match (server-side, pas de CORS) ──
  const runAIMatching = async () => {
    if (!candidates.length) return;
    setAiLoading(true);
    setAiError(null);
    setAiResults([]);

    // ÉTAPE 1 — Score algo sur TOUS les candidats (FIX #8 : plus de slice(0,20))
    const algoResults: AIMatchResult[] = candidates.map(c => ({
      candidateId: c.id,
      ...computeAlgoScore(c),
    }));
    algoResults.sort((a, b) => b.score - a.score);
    setAiResults(algoResults); // Affichage immédiat

    // ÉTAPE 2 — Enrichissement Groq (top 15 pour Groq, sélection plus large qu'avant)
    // FIX #8 : on pré-calcule un bonus compétences brut pour remonter les candidats
    // avec compétences parfaites mais secteur différent, avant de couper pour Groq
    const withSkillsBonus = [...algoResults].map(r => {
      const c = candidates.find(x => x.id === r.candidateId)!;
      let skillBonus = 0;
      if (need.skills && c.skills) {
        const needSkills = need.skills.toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);
        const candSkills = (c.skills || '').toLowerCase();
        skillBonus = needSkills.filter((s: string) => candSkills.includes(s)).length;
      }
      return { ...r, _skillBonus: skillBonus };
    });
    // Tri composite : score algo + bonus compétences (pour ne pas exclure un candidat compétent)
    withSkillsBonus.sort((a, b) => (b.score + b._skillBonus * 3) - (a.score + a._skillBonus * 3));
    const top15 = withSkillsBonus.slice(0, 15).map(r => {
      const c = candidates.find(x => x.id === r.candidateId)!;
      return {
        id: c.id,
        nom: c.fullName || 'Inconnu',
        secteur: c.sector || 'N/A',
        experience: c.experience ? `${c.experience} ans` : 'N/A',
        disponibilite: c.availability || 'N/A',
        competences: c.skills || 'N/A',
        score_algo: r.score,
      };
    });

    const prompt = `Tu es expert RH. Offre : poste="${need.jobTitle}", secteur="${need.sector}", expMin=${need.expRequired || 0} ans, compétences="${need.skills || 'N/A'}".
Candidats pré-scorés : ${JSON.stringify(top15)}
Retourne UNIQUEMENT un tableau JSON : [{"candidateId":"...","score":0-100,"verdict":"Excellent|Bon|Moyen|Faible","reasons":["..."],"concerns":["..."]}]`;

    try {
      // ✅ Appel via proxy serveur — clé GROQ jamais exposée au navigateur
      const resp = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.2,
        }),
      });

      if (!resp.ok) throw new Error(`Groq proxy erreur ${resp.status}`);
      const groqData = await resp.json();
      const text = groqData.choices?.[0]?.message?.content || '';
      const error = null;
      if (error) throw new Error(error);

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Réponse IA invalide');
      const groqResults: AIMatchResult[] = JSON.parse(jsonMatch[0]);
      const groqMap = new Map(groqResults.map(r => [r.candidateId, r]));
      const merged = algoResults.map(r => groqMap.get(r.candidateId) || r);
      merged.sort((a, b) => b.score - a.score);
      setAiResults(merged);

      // Persist cache so re-opening this need doesn't re-spend a Groq call
      const cachedAt = new Date().toISOString();
      setAiCachedAt(cachedAt);
      updateDoc(doc(db, 'needs', need.id), {
        aiMatchingCache: { results: merged, cachedAt },
      }).catch(() => {});
    } catch (err: any) {
      // Groq failed → keep algo results, show soft warning
      setAiError(`IA indisponible — résultats algorithmiques affichés (${err.message})`);
      // Still cache the algo-only results so the UI isn't empty next time
      const cachedAt = new Date().toISOString();
      setAiCachedAt(cachedAt);
      updateDoc(doc(db, 'needs', need.id), {
        aiMatchingCache: { results: algoResults, cachedAt },
      }).catch(() => {});
    } finally {
      setAiLoading(false);
    }
  };

  // ── Score de compatibilité manuel (algorithmique) ──
  const computeManualScore = (c: Candidate): { score: number; tags: string[] } => {
    const w = weights.manual;
    let score = 0;
    const tags: string[] = [];

    // Secteur
    if (need?.sector && c.sector && c.sector.toLowerCase() === need.sector.toLowerCase()) {
      score += w.sector; tags.push('✓ Secteur');
    } else if (need?.sector && c.sector) {
      score += w.sectorOther;
    }

    // Expérience
    const cExp = typeof c.experience === 'string' ? parseInt(c.experience) : (c.experience || 0);
    const nExp = need?.expRequired || 0;
    if (cExp >= nExp) {
      score += w.experience; tags.push(`✓ ${cExp} ans exp.`);
    } else if (cExp >= nExp - w.experiencePartialGap && cExp > 0) {
      score += w.experiencePartial; tags.push(`~ ${cExp} ans exp.`);
    }

    // Disponibilité
    if (c.availability === 'Immédiate' || c.availability === 'immediate') {
      score += w.availabilityImmediate; tags.push('✓ Dispo immédiate');
    } else if (c.availability) {
      score += w.availabilityOther; tags.push(`~ ${c.availability}`);
    }

    // Diplôme
    if (need?.diplomaRequired && c.education) {
      if (c.education === need.diplomaRequired) {
        score += w.diploma; tags.push('✓ Diplôme');
      } else score += w.diplomaOther;
    } else if (!need?.diplomaRequired) {
      score += w.diplomaNoneRequired;
    }

    // Compétences
    if (need?.skills && c.skills) {
      const needSkills = need.skills.toLowerCase().split(',').map((s: string) => s.trim());
      const candSkills = c.skills.toLowerCase();
      const matched = needSkills.filter((s: string) => candSkills.includes(s));
      if (matched.length > 0) {
        score += Math.min(w.skillsMax, matched.length * w.skillsPerMatch);
        tags.push(`✓ ${matched.length} compétence(s)`);
      }
    }

    return { score: Math.min(100, score), tags };
  };

  // ── Filtrage avancé avec score ──
  const candidatesWithScore = candidates.map(c => ({
    ...c,
    _score: computeManualScore(c),
  }));

  const filteredCandidates = candidatesWithScore
    .filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (c.fullName || c.displayName || '').toLowerCase().includes(q) ||
        (c.jobTitle || '').toLowerCase().includes(q) ||
        (c.sector || '').toLowerCase().includes(q) ||
        (c.skills || '').toLowerCase().includes(q);
      const matchSector = !sectorFilter || (c.sector || '').toLowerCase() === sectorFilter.toLowerCase();
      const cExp = typeof c.experience === 'string' ? parseInt(c.experience) : (c.experience || 0);
      const matchExp = !expFilter || (() => {
        if (expFilter === '0') return cExp === 0;
        if (expFilter === '1-3') return cExp >= 1 && cExp <= 3;
        if (expFilter === '3-5') return cExp >= 3 && cExp <= 5;
        if (expFilter === '5-10') return cExp >= 5 && cExp <= 10;
        if (expFilter === '10+') return cExp >= 10;
        return true;
      })();
      const matchAvail = !availFilter || (c.availability || '').toLowerCase().includes(availFilter.toLowerCase());
      const matchEdu = !eduFilter || (c.education || '').toLowerCase().includes(eduFilter.toLowerCase());
      return matchSearch && matchSector && matchExp && matchAvail && matchEdu;
    })
    .sort((a, b) => b._score.score - a._score.score);

  const sectors = Array.from(new Set(candidates.map(c => c.sector).filter(Boolean)));
  const availabilities = Array.from(new Set(candidates.map(c => c.availability).filter(Boolean)));
  const educations = Array.from(new Set(candidates.map(c => c.education).filter(Boolean)));

  // Stats
  const stats = {
    total: pipeline.length,
    cvSent: pipeline.filter(e => stepIndex(e.step) >= 1 && e.step !== 'rejected').length,
    interviews: pipeline.filter(e => stepIndex(e.step) >= 2 && e.step !== 'rejected').length,
    placed: pipeline.filter(e => e.step === 'placed').length,
    rejected: pipeline.filter(e => e.step === 'rejected').length,
  };

  return (
    <div className="mt-6 border-t-2 border-dashed border-gray-100 pt-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <UserCheck size={15} className="text-indigo-500" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Pipeline Candidats</p>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">Matching, suivi et placement</p>
        </div>

        {/* Stats pills */}
        {stats.total > 0 && (
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-xl">{stats.total} lié(s)</span>
            {stats.cvSent > 0 && <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-xl border border-blue-100">📄 {stats.cvSent} CV</span>}
            {stats.interviews > 0 && <span className="text-[9px] font-black uppercase bg-amber-50 text-amber-600 px-2.5 py-1.5 rounded-xl border border-amber-100">📅 {stats.interviews} entretien(s)</span>}
            {stats.placed > 0 && <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 px-2.5 py-1.5 rounded-xl border border-emerald-100">🏆 {stats.placed} placé(s)</span>}
            {stats.rejected > 0 && <span className="text-[9px] font-black uppercase bg-red-50 text-red-400 px-2.5 py-1.5 rounded-xl border border-red-100">✗ {stats.rejected} refusé(s)</span>}
          </div>
        )}
      </div>

      {/* ── Active pipeline ── */}
      {pipeline.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-3">Candidats en cours</p>
          {pipeline.map(entry => (
            <PipelineCard
              key={entry.candidateId}
              entry={entry}
              candidate={candidates.find(c => c.id === entry.candidateId)}
              needId={need.id}
              onUpdate={handleUpdateEntry}
              onRemove={handleRemoveEntry}
            />
          ))}
        </div>
      )}

      {/* ── Mode toggle ── */}
      <div className="flex gap-2 mb-5 bg-gray-50 p-1 rounded-2xl border border-gray-100">
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${mode === 'ai' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Sparkles size={13} /> Matching IA
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${mode === 'manual' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Users size={13} /> Manuel
        </button>
      </div>

      <AnimatePresence mode="wait">

        {/* ── AI MODE ── */}
        {mode === 'ai' && (
          <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>

            {!aiLoading && aiResults.length === 0 && !aiError && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                  <Sparkles size={28} />
                </div>
                <h4 className="font-black text-gray-900 text-base mb-1">Matching Automatique par IA</h4>
                <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto mb-5">
                  L'IA analyse les {candidates.length} candidat(s) disponibles et les score selon les critères du poste.
                </p>
                <button
                  onClick={runAIMatching}
                  disabled={candidates.length === 0}
                  className="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-600 transition-all disabled:opacity-40"
                >
                  <Zap size={14} /> Lancer l'analyse IA
                </button>
              </div>
            )}

            {aiLoading && (
              <div className="py-12 flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Sparkles size={22} className="text-indigo-500" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <Loader2 size={18} className="text-indigo-500 animate-spin" />
                  </div>
                </div>
                <p className="font-black text-gray-900 text-sm">Analyse en cours…</p>
                <div className="flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )}

            {aiError && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-start gap-3">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-red-700 text-sm">Erreur de matching</p>
                  <p className="text-xs text-red-500 font-medium mt-1">{aiError}</p>
                  <button onClick={runAIMatching} className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase text-red-500 hover:text-red-700">
                    <RefreshCw size={11} /> Réessayer
                  </button>
                </div>
              </div>
            )}

            {aiResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                    {aiResults.length} profil(s) · classés par compatibilité
                    {aiCachedAt && <span className="normal-case font-semibold text-gray-300"> · analysé le {new Date(aiCachedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                  </p>
                  <button onClick={() => { setAiResults([]); setAiError(null); setAiCachedAt(null); }} className="flex items-center gap-1 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase">
                    <RefreshCw size={10} /> Relancer
                  </button>
                </div>

                {aiResults.map((result, i) => {
                  const candidate = candidates.find(c => c.id === result.candidateId);
                  if (!candidate) return null;
                  const colors = scoreColor(result.score);
                  const alreadyLinked = pipelineIds.has(result.candidateId);

                  return (
                    <motion.div key={result.candidateId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className={`bg-white rounded-2xl border ${colors.border} shadow-sm overflow-hidden`}
                    >
                      <div className="flex items-start gap-4 p-4">
                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-base ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-900 text-sm">{candidate.fullName || candidate.displayName}</p>
                          <p className="text-[11px] text-gray-500 font-medium mb-2">{candidate.sector || candidate.jobTitle}{candidate.experience ? ` · ${candidate.experience} ans` : ''}{candidate.availability ? ` · ${candidate.availability}` : ''}</p>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${result.score}%` }} transition={{ delay: i * 0.05 + 0.2, duration: 0.6 }}
                                className={`h-full rounded-full ${colors.bar}`} />
                            </div>
                            <span className={`text-[11px] font-black ${colors.text} w-10 text-right`}>{result.score}%</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {result.reasons.map((r, ri) => <span key={ri} className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">✓ {r}</span>)}
                            {result.concerns.map((c, ci) => <span key={ci} className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg">⚠ {c}</span>)}
                          </div>
                        </div>
                        <button
                          onClick={() => !alreadyLinked && handleLink(result.candidateId, 'ai', result.score, result.verdict)}
                          disabled={alreadyLinked}
                          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${alreadyLinked ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default' : 'bg-gray-900 text-white hover:bg-indigo-600 shadow-sm'}`}
                        >
                          {alreadyLinked ? <><CheckCircle size={12} /> Ajouté</> : <><Link2 size={12} /> Ajouter</>}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === 'manual' && (
          <motion.div key="manual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-4">

            {/* Info bar — tous les candidats de la base */}
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
              <Users size={13} className="text-blue-500 shrink-0" />
              <p className="text-[10px] font-bold text-blue-700">
                Tous les candidats de la base ({candidates.length}) — triés par score de compatibilité
              </p>
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, poste, compétences…"
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-9 pr-10 py-2.5 text-sm font-medium text-gray-900 outline-none focus:border-blue-200 transition-colors"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={13} /></button>}
            </div>

            {/* Filtres avancés */}
            <div className="grid grid-cols-2 gap-2">
              {/* Secteur — pré-sélectionné avec le secteur de la demande */}
              <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
                className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-xs font-black text-gray-600 outline-none focus:border-blue-200 appearance-none">
                <option value="">🏗️ Tous secteurs</option>
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Expérience */}
              <select value={expFilter} onChange={e => setExpFilter(e.target.value)}
                className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-xs font-black text-gray-600 outline-none focus:border-blue-200 appearance-none">
                <option value="">💼 Toute expérience</option>
                <option value="0">Débutant (0 an)</option>
                <option value="1-3">1 à 3 ans</option>
                <option value="3-5">3 à 5 ans</option>
                <option value="5-10">5 à 10 ans</option>
                <option value="10+">10+ ans</option>
              </select>

              {/* Disponibilité */}
              <select value={availFilter} onChange={e => setAvailFilter(e.target.value)}
                className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-xs font-black text-gray-600 outline-none focus:border-blue-200 appearance-none">
                <option value="">📅 Toute disponibilité</option>
                {availabilities.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              {/* Diplôme */}
              <select value={eduFilter} onChange={e => setEduFilter(e.target.value)}
                className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-xs font-black text-gray-600 outline-none focus:border-blue-200 appearance-none">
                <option value="">🎓 Tout niveau</option>
                {educations.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* Reset filtres */}
            {(sectorFilter || expFilter || availFilter || eduFilter || search) && (
              <button onClick={() => { setSearch(''); setSectorFilter(need?.sector || ''); setExpFilter(''); setAvailFilter(''); setEduFilter(''); }}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400 hover:text-red-500 transition-colors">
                <X size={11} /> Réinitialiser les filtres
              </button>
            )}

            {/* Compteur */}
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.15em]">
              {filteredCandidates.length} candidat(s) · classés par compatibilité
            </p>

            {/* Liste */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredCandidates.length === 0 && (
                <div className="py-12 text-center">
                  <Users size={32} strokeWidth={1} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-xs font-black uppercase text-gray-300 tracking-widest">Aucun candidat trouvé</p>
                  <button onClick={() => { setSearch(''); setSectorFilter(''); setExpFilter(''); setAvailFilter(''); setEduFilter(''); }}
                    className="mt-3 text-[10px] font-black uppercase text-blue-400 hover:underline">
                    Voir tous les candidats
                  </button>
                </div>
              )}
              {filteredCandidates.map((c, i) => {
                const alreadyLinked = pipelineIds.has(c.id);
                const { score, tags } = c._score;
                const colors = scoreColor(score);
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                    className={`rounded-xl border transition-all overflow-hidden ${alreadyLinked ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}
                  >
                    <div className="flex items-start gap-3 p-3.5">
                      {/* Avatar + rang */}
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm border ${colors.bg} ${colors.text} ${colors.border}`}>
                          {(c.fullName || c.displayName || 'C')[0].toUpperCase()}
                        </div>
                        <span className="text-[9px] font-black text-gray-300">#{i + 1}</span>
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-black text-gray-900 text-xs truncate">{c.fullName || c.displayName || 'Candidat sans nom'}</p>
                          {c.cvUrl && <span className="text-[8px] font-black bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-md">CV</span>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {c.sector && <span className="text-[10px] text-gray-500 font-medium bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md">{c.sector}</span>}
                          {c.experience && <span className="text-[9px] text-gray-400 font-bold">· {c.experience} ans</span>}
                          {c.availability && <span className="text-[9px] text-gray-400">· {c.availability}</span>}
                          {c.education && <span className="text-[9px] text-gray-400">· {c.education}</span>}
                          {c.nationality && <span className="text-[9px] text-gray-300">· {c.nationality}</span>}
                        </div>

                        {/* Score bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ delay: i * 0.025 + 0.1, duration: 0.5 }}
                              className={`h-full rounded-full ${colors.bar}`} />
                          </div>
                          <span className={`text-[10px] font-black ${colors.text} w-8 text-right`}>{score}%</span>
                        </div>

                        {/* Tags compatibilité */}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.map((tag, ti) => (
                              <span key={ti} className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {c.phone && <span className="text-[9px] text-gray-400 flex items-center gap-1"><Phone size={8}/>{c.phone}</span>}
                        <button
                          onClick={() => !alreadyLinked && handleLink(c.id, 'manual')}
                          disabled={alreadyLinked}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all ${alreadyLinked ? 'bg-emerald-100 text-emerald-600 cursor-default border border-emerald-200' : 'bg-gray-900 text-white hover:bg-blue-600 shadow-sm'}`}
                        >
                          {alreadyLinked ? <><CheckCircle size={10} /> Ajouté</> : <><Link2 size={10} /> Ajouter</>}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}