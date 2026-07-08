/**
 * CandidateDatabase.tsx
 * ATS professionnel style LinkedIn Recruiter / Greenhouse
 * Master/Detail layout — optimisé 1000+ candidats
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search, Filter, ChevronLeft, ChevronRight, X, Download,
  Mail, Phone, MapPin, Clock, Briefcase, FileText, MessageSquare,
  Star, Calendar, CheckCircle, XCircle, User, MoreVertical,
  Eye, Loader2, RefreshCw, GraduationCap, Globe, Banknote,
  AlertCircle, ChevronDown, Zap, Activity, Users, Plus,
  ExternalLink, BookOpen, Award, Info, Sparkles, Edit2,
  ClipboardList, History, StickyNote
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';

// ── Types ──────────────────────────────────────────────────────────────────
interface Application {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  nationality?: string;
  address?: string;
  birthDate?: string;
  gender?: string;
  availability?: string;
  education?: string;
  experience?: string | number;
  languages?: string;
  skills?: string;
  salaryExpected?: string;
  jobTitle?: string;
  message?: string;
  notes?: string;
  cvUrl?: string;
  diplomaUrl?: string;
  idCardUrl?: string;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
  matchScore?: number;
  jobId?: string;
  candidateId?: string;       // VGM-XXXX-XXXX custom ID
  assignedTo?: string;        // nom du recruteur assigné
  assignedToEmail?: string;
  createdBy?: string;         // email de l'admin créateur
  photoUrl?: string;
  sector?: string;
  aiScore?: number;
  interviewDate?: string;
  interviewNote?: string;
  notesUpdatedAt?: any;
  [key: string]: any;
}

interface Props {
  applications: Application[];
  db: any;
  onStatusChange?: (id: string, status: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  new:       { label:'Reçu',      bg:'bg-slate-100',   text:'text-slate-600',   dot:'bg-slate-400',   border:'border-slate-200' },
  reviewing: { label:'En cours',  bg:'bg-blue-50',     text:'text-blue-700',    dot:'bg-blue-500',    border:'border-blue-200'  },
  interview: { label:'Entretien', bg:'bg-violet-50',   text:'text-violet-700',  dot:'bg-violet-500',  border:'border-violet-200'},
  hired:     { label:'Accepté',   bg:'bg-emerald-50',  text:'text-emerald-700', dot:'bg-emerald-500', border:'border-emerald-200'},
  rejected:  { label:'Refusé',    bg:'bg-red-50',      text:'text-red-600',     dot:'bg-red-400',     border:'border-red-200'   },
};

const DETAIL_TABS = [
  { id: 'profil',      label: 'Profil',         icon: User },
  { id: 'experience',  label: 'Expérience',      icon: Briefcase },
  { id: 'competences', label: 'Compétences',     icon: Award },
  { id: 'documents',   label: 'CV & Documents',  icon: FileText },
  { id: 'notes',       label: 'Notes internes',  icon: StickyNote },
  { id: 'historique',  label: 'Historique',      icon: History },
];

const AVATAR_PALETTE = [
  '#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444',
  '#EC4899','#14B8A6','#6366F1','#F97316','#06B6D4',
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getAvatarColor(name = '') { return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length]; }
function getInitials(name = '') { return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'; }
function fmtDate(ts: any, short = false) {
  if (!ts) return '—';
  const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', short ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' });
}
// Parse une valeur d'expérience texte ou numérique → nombre d'années
function parseExp(exp: string | number | undefined): number {
  if (!exp) return 0;
  if (typeof exp === 'number') return exp;
  // formats : "6", "6 - 10 ans", "6-10", "6 ans", "Moins de 1 an", "Plus de 10 ans"
  const s = String(exp).toLowerCase().replace(/ans?/g, '').trim();
  if (s.includes('moins')) return 0;
  if (s.includes('plus') || s.includes('+')) return 11;
  const nums = s.match(/\d+/g);
  if (!nums) return 0;
  if (nums.length >= 2) return Math.round((parseInt(nums[0]) + parseInt(nums[1])) / 2);
  return parseInt(nums[0]) || 0;
}

// Score algorithmique basé sur la même logique que MatchingPanel.computeManualScore
// Quand aucune offre liée n'est connue, on utilise un score de complétude de profil
function computeMatchScore(app: Application, need?: any): number {
  // Priorité 1 : score IA stocké (depuis MatchingPanel)
  if (app.aiScore !== undefined && app.aiScore > 0) return app.aiScore;
  if (app.matchScore !== undefined) return app.matchScore;

  const cExp = parseExp(app.experience);

  // Priorité 2 : si on a un besoin (offre), calcul contextuel
  if (need) {
    let score = 0;
    // Secteur (40 pts)
    if (need.sector && app.sector && app.sector.toLowerCase() === need.sector.toLowerCase()) {
      score += 40;
    } else if (need.sector && app.sector) {
      score += 5;
    }
    // Expérience (25 pts)
    const nExp = need.expRequired || 0;
    if (cExp >= nExp) score += 25;
    else if (cExp >= nExp - 2 && cExp > 0) score += 12;
    // Disponibilité (15 pts)
    const avail = (app.availability || '').toLowerCase();
    if (avail.includes('immédiat') || avail === 'immediate') score += 15;
    else if (app.availability) score += 5;
    // Diplôme (10 pts)
    if (need.diplomaRequired && app.education) {
      score += app.education === need.diplomaRequired ? 10 : 3;
    } else if (!need.diplomaRequired) score += 10;
    // Compétences (10 pts)
    if (need.skills && app.skills) {
      const needSkills = need.skills.toLowerCase().split(',').map((s: string) => s.trim());
      const candSkills = (app.skills || '').toLowerCase();
      const matched = needSkills.filter((s: string) => s && candSkills.includes(s));
      score += Math.min(10, matched.length * 4);
    }
    return Math.min(100, score);
  }

  // Priorité 3 : score de complétude de profil (sans offre)
  let score = 30; // base
  // Expérience (30 pts)
  if (cExp >= 10) score += 30;
  else if (cExp >= 6) score += 24;
  else if (cExp >= 3) score += 18;
  else if (cExp >= 1) score += 10;
  // Formation (20 pts)
  const edu = (app.education || '').toLowerCase();
  if (edu.includes('master') || edu.includes('ingénieur') || edu.includes('licence bac+')) score += 20;
  else if (edu.includes('licence') || edu.includes('bac+3') || edu.includes('bts')) score += 15;
  else if (edu.includes('baccalauréat') || edu.includes('bac')) score += 10;
  else if (app.education) score += 5;
  // Documents (20 pts)
  if (app.cvUrl) score += 12;
  if (app.idCardUrl) score += 5;
  if (app.diplomaUrl) score += 3;
  // Compétences (15 pts)
  const skillCount = (app.skills || '').split(',').filter(Boolean).length;
  score += Math.min(15, skillCount * 3);
  // Disponibilité (5 pts)
  const av = (app.availability || '').toLowerCase();
  if (av.includes('immédiat') || av === 'immediate') score += 5;
  else if (app.availability) score += 2;
  // Langues bonus (5 pts)
  const langCount = (app.languages || '').split(',').filter(Boolean).length;
  if (langCount >= 2) score += 5;
  else if (langCount === 1) score += 2;

  return Math.min(99, score);
}

// ── Score Bar ──────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#3B82F6' : score >= 40 ? '#F59E0B' : '#EF4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : 'Faible';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Matching IA</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color }}>{label}</span>
          <span className="text-sm font-black" style={{ color }}>{score}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ name = '', photo = '', size = 36, status }: { name?: string; photo?: string; size?: number; status?: string }) {
  const bg = getAvatarColor(name);
  const sc = status ? STATUS_CFG[status] : null;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        <img src={photo} alt={name} className="w-full h-full rounded-xl object-cover" />
      ) : (
        <div className="w-full h-full rounded-xl flex items-center justify-center text-white font-black"
          style={{ background: bg, fontSize: size * 0.35 }}>
          {getInitials(name)}
        </div>
      )}
      {sc && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${sc.dot}`} />
      )}
    </div>
  );
}

// ── AI Summary ────────────────────────────────────────────────────────────
function AISummary({ app }: { app: Application }) {
  const score = computeMatchScore(app);
  const expText = app.experience ? `${app.experience} ans d'expérience` : 'expérience non précisée';
  const eduText = app.education ? `formation en ${app.education}` : '';
  const availText = app.availability ? `disponible ${app.availability.toLowerCase()}` : 'disponibilité non précisée';
  const skillsCount = (app.skills || '').split(',').filter(Boolean).length;
  const summary = `${app.fullName || 'Candidat'} — ${expText}${eduText ? `, ${eduText}` : ''}. ${availText.charAt(0).toUpperCase() + availText.slice(1)}.${skillsCount > 0 ? ` Maîtrise ${skillsCount} compétence${skillsCount > 1 ? 's' : ''} clé${skillsCount > 1 ? 's' : ''}.` : ''}`;

  return (
    <div className="rounded-xl p-4 border" style={{ background: 'linear-gradient(135deg, #0A192F08, #f97316 08)', borderColor: '#f9731620' }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={13} className="text-orange-500" />
        <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">Résumé IA</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed font-medium">{summary}</p>
      <div className="mt-3">
        <ScoreBar score={score} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CandidateDatabase({ applications, db, onStatusChange }: Props) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [sort, setSort]                 = useState<'newest' | 'oldest' | 'score'>('newest');
  const [page, setPage]                 = useState(1);
  const [selected, setSelected]         = useState<Application | null>(null);
  const [detailTab, setDetailTab]       = useState('profil');
  const [savingNote, setSavingNote]     = useState(false);
  const [noteVal, setNoteVal]           = useState('');
  const [statusChanging, setStatusChanging] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');
  const [editOpen, setEditOpen]         = useState(false);
  const [editForm, setEditForm]         = useState<Partial<Application>>({});
  const [savingEdit, setSavingEdit]     = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync note when selection changes
  useEffect(() => { setNoteVal(selected?.notes || ''); }, [selected?.id]);

  // ── Filter + Sort + Paginate ──
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return applications
      .filter(a => statusFilter === 'all' || a.status === statusFilter)
      .filter(a => !s || [a.fullName, a.jobTitle, a.email, a.nationality, a.address]
        .some(f => (f || '').toLowerCase().includes(s)))
      .sort((a, b) => {
        if (sort === 'score') return computeMatchScore(b) - computeMatchScore(a);
        const da = a.createdAt?.seconds || 0, db2 = b.createdAt?.seconds || 0;
        return sort === 'newest' ? db2 - da : da - db2;
      });
  }, [applications, statusFilter, search, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  // ── Status counts ──
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: applications.length };
    applications.forEach(a => { c[a.status || 'new'] = (c[a.status || 'new'] || 0) + 1; });
    return c;
  }, [applications]);

  // ── Actions ──
  const handleSelect = useCallback((app: Application) => {
    setSelected(prev => prev?.id === app.id ? null : app);
    setDetailTab('profil');
  }, []);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!selected || !db) return;
    setStatusChanging(true);
    try {
      await updateDoc(doc(db, 'applications', selected.id), { status: newStatus, updatedAt: serverTimestamp() });
      setSelected(prev => prev ? { ...prev, status: newStatus } : null);
      onStatusChange?.(selected.id, newStatus);
    } finally { setStatusChanging(false); }
  }, [selected, db, onStatusChange]);

  const handleSaveNote = useCallback(async () => {
    if (!selected || !db) return;
    setSavingNote(true);
    try {
      await updateDoc(doc(db, 'applications', selected.id), { notes: noteVal, notesUpdatedAt: serverTimestamp() });
      setSelected(prev => prev ? { ...prev, notes: noteVal } : null);
    } finally { setSavingNote(false); }
  }, [selected, db, noteVal]);

  const handleScheduleInterview = useCallback(async () => {
    if (!selected || !scheduleDate) return;
    await updateDoc(doc(db, 'applications', selected.id), {
      status: 'interview',
      interviewDate: scheduleDate,
      interviewNote: scheduleNote,
      updatedAt: serverTimestamp(),
    });
    setSelected(prev => prev ? { ...prev, status: 'interview', interviewDate: scheduleDate } : null);
    setScheduleOpen(false);
    setScheduleDate('');
    setScheduleNote('');
  }, [selected, scheduleDate, scheduleNote, db]);

  const handleOpenEdit = useCallback(() => {
    if (!selected) return;
    setEditForm({
      fullName:      selected.fullName || '',
      email:         selected.email || '',
      phone:         selected.phone || '',
      whatsapp:      selected.whatsapp || '',
      address:       selected.address || '',
      nationality:   selected.nationality || '',
      birthDate:     selected.birthDate || '',
      gender:        selected.gender || '',
      availability:  selected.availability || '',
      education:     selected.education || '',
      experience:    String(selected.experience || ''),
      languages:     selected.languages || '',
      skills:        selected.skills || '',
      salaryExpected:selected.salaryExpected || '',
      jobTitle:      selected.jobTitle || '',
      message:       selected.message || '',
    });
    setEditOpen(true);
    setMoreMenuOpen(false);
  }, [selected]);

  const handleSaveEdit = useCallback(async () => {
    if (!selected || !db) return;
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'applications', selected.id), {
        ...editForm,
        updatedAt: serverTimestamp(),
      });
      setSelected(prev => prev ? { ...prev, ...editForm } : null);
      setEditOpen(false);
    } finally { setSavingEdit(false); }
  }, [selected, db, editForm]);

  const goPage = (p: number) => {
    setPage(p);
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Detail panel derived vars (used when selected !== null) ──
  const _app = selected;
  const _sc  = _app ? STATUS_CFG[_app.status || 'new'] : STATUS_CFG['new'];
  const _score = _app ? computeMatchScore(_app) : 0;
  const _skills = _app ? (_app.skills || '').split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  const _langs  = _app ? (_app.languages || '').split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  const _expLabel = _app?.experience ? (String(_app.experience).includes('an') ? String(_app.experience) : `${_app.experience} ans`) : null;
  const _scoreColor = _score >= 80 ? '#10B981' : _score >= 60 ? '#3B82F6' : _score >= 40 ? '#F59E0B' : '#EF4444';
  const _scoreLabel = _score >= 80 ? 'Bon match' : _score >= 60 ? 'Acceptable' : _score >= 40 ? 'Partiel' : 'Faible';
  const _scoreBg    = _score >= 80 ? 'bg-emerald-50 border-emerald-100' : _score >= 60 ? 'bg-blue-50 border-blue-100' : _score >= 40 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
  const _R = 36, _C = 2 * Math.PI * _R;
  const _dash = (_score / 100) * _C;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Base de Données <span className="text-blue-600">Candidats</span>
          </h1>
          <p className="text-gray-400 text-xs font-medium mt-0.5">{applications.length} candidats · {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-700">Temps réel</span>
          </div>
        </div>
      </div>

      {/* ── Status tabs ── */}
      <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm overflow-x-auto">
        {[
          { key: 'all',       label: 'Tous' },
          { key: 'new',       label: 'Reçus' },
          { key: 'reviewing', label: 'En cours' },
          { key: 'interview', label: 'Entretien' },
          { key: 'hired',     label: 'Acceptés' },
          { key: 'rejected',  label: 'Refusés' },
        ].map(t => {
          const active = statusFilter === t.key;
          const count = counts[t.key] || 0;
          return (
            <button key={t.key} onClick={() => { setStatusFilter(t.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all ${active ? 'bg-navy text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              style={active ? { backgroundColor: '#0A192F' } : {}}>
              {t.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Master/Detail layout ── */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ height: 'calc(100vh - 280px)' }}>

        {/* ════ LEFT — Candidate list (35%) ════ */}
        <div className={`flex flex-col gap-3 transition-all duration-300 ${selected ? 'w-[35%]' : 'w-full'}`}>

          {/* Search + Sort */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
              <Search size={13} className="text-gray-300 shrink-0" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Nom, poste, ville…"
                className="flex-1 bg-transparent outline-none text-xs text-gray-700 font-medium placeholder:text-gray-300" />
              {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-300" /></button>}
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as any)}
              className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-[11px] font-black text-gray-600 outline-none shadow-sm">
              <option value="newest">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="score">Score IA ↓</option>
            </select>
          </div>

          {/* List */}
          <div ref={listRef} className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-y-auto">
            {/* Table header */}
            {!selected && (
              <div className="sticky top-0 z-10 grid gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100"
                style={{ gridTemplateColumns: '2fr 1.5fr 0.8fr 0.9fr 0.7fr' }}>
                {['Candidat', 'Poste / Ville', 'Exp.', 'Statut', 'Date'].map(h => (
                  <span key={h} className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{h}</span>
                ))}
              </div>
            )}

            <div className="divide-y divide-gray-50">
              {paginated.map(app => {
                const sc    = STATUS_CFG[app.status || 'new'];
                const score = computeMatchScore(app);
                const isSelected = selected?.id === app.id;

                return (
                  <div key={app.id}
                    onClick={() => handleSelect(app)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-gray-50/80 border-l-2 ${isSelected ? 'bg-blue-50/60 border-blue-500' : 'border-transparent'}`}>

                    <Avatar name={app.fullName} status={app.status || 'new'} size={selected ? 34 : 36} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="font-black text-gray-900 text-xs truncate">{app.fullName || '—'}</p>
                        {score >= 80 && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 shrink-0">{score}%</span>}
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium truncate">{app.jobTitle || 'Candidature libre'}</p>
                      {!selected && (
                        <p className="text-[9px] text-gray-300 flex items-center gap-1 mt-0.5">
                          <MapPin size={8} />{app.address || 'Djibouti'}
                        </p>
                      )}
                    </div>

                    {!selected && (
                      <>
                        <div className="w-16 shrink-0">
                          <p className="text-xs font-bold text-gray-600 text-center">{app.experience ? (String(app.experience).includes('an') ? String(app.experience) : `${app.experience} ans`) : '—'}</p>
                        </div>
                        <div className="w-20 shrink-0">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${sc.bg} ${sc.text}`}>{sc.label}</span>
                        </div>
                        <div className="w-14 shrink-0">
                          <p className="text-[9px] text-gray-400 font-medium">{fmtDate(app.createdAt, true)}</p>
                        </div>
                      </>
                    )}

                    {selected && (
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${_sc.bg} ${_sc.text} shrink-0`}>{_sc.label}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {paginated.length === 0 && (
              <div className="py-20 text-center">
                <Users size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-300 font-black text-xs uppercase tracking-widest">Aucun candidat</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="sticky bottom-0 flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-white">
                <p className="text-[10px] text-gray-400 font-medium">
                  {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} / {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => goPage(Math.max(1, page-1))} disabled={page===1}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeft size={12}/>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = totalPages <= 5 ? i+1 : page <= 3 ? i+1 : page >= totalPages-2 ? totalPages-4+i : page-2+i;
                    return (
                      <button key={p} onClick={() => goPage(p)}
                        className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${page===p ? 'text-white shadow-sm' : 'border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                        style={page===p ? { backgroundColor: '#0A192F' } : {}}>
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => goPage(Math.min(totalPages, page+1))} disabled={page===totalPages}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRight size={12}/>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT — Detail panel (65%) ════ */}
        {_app && (
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">

              {/* ════ DARK HEADER ════ */}
              <div className="shrink-0" style={{ background: 'linear-gradient(135deg, #0A192F 0%, #0d2a4a 100%)' }}>
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 pt-4 pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40">Candidat</span>
                    <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${_sc.bg} ${_sc.text} ${_sc.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${_sc.dot}`} />{_sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleOpenEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 text-[11px] font-black text-white/80 hover:bg-white/10 transition-all">
                      <Edit2 size={11} /> Modifier
                    </button>
                    <div className="relative">
                      <button onClick={() => setMoreMenuOpen(v => !v)}
                        className="w-7 h-7 rounded-xl border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/10 transition-all">
                        <MoreVertical size={13} />
                      </button>
                      {moreMenuOpen && (
                        <div className="absolute right-0 top-9 z-20 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[180px]">
                          {[
                            { label: "Copier l'email",    icon: Mail,  action: () => { navigator.clipboard.writeText(_app?.email || ''); setMoreMenuOpen(false); } },
                            { label: 'Copier le tél.',    icon: Phone, action: () => { navigator.clipboard.writeText(_app?.phone || ''); setMoreMenuOpen(false); } },
                            { label: 'Voir CV',           icon: Eye,   action: () => { window.open(_app?.cvUrl || '', '_blank'); setMoreMenuOpen(false); }, disabled: !_app?.cvUrl },
                          ].map(({ label, icon: Icon, action, disabled }) => (
                            <button key={label} onClick={action} disabled={disabled}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                              <Icon size={12} /> {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => { setSelected(null); setMoreMenuOpen(false); }}
                      className="w-7 h-7 rounded-xl border border-white/20 hover:bg-white/10 flex items-center justify-center transition-all">
                      <X size={13} className="text-white/60" />
                    </button>
                  </div>
                </div>

                {/* Avatar + Name + meta */}
                <div className="flex items-center gap-5 px-6 py-5">
                  <div className="relative shrink-0">
                    {_app.photoUrl ? (
                      <img src={_app.photoUrl} alt={_app.fullName} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black border-2 border-white/20"
                        style={{ background: getAvatarColor(_app.fullName || '') }}>
                        {getInitials(_app.fullName || '')}
                      </div>
                    )}
                    <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0A192F] ${_sc.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-white tracking-tight mb-0.5">{_app.fullName || '—'}</h2>
                    <p className="text-blue-300 text-sm font-bold mb-3">{_app.jobTitle || 'Candidature libre'}</p>
                    <div className="flex items-center gap-4 flex-wrap">
                      {_app.address && (
                        <span className="flex items-center gap-1.5 text-[11px] text-white/50 font-medium">
                          <MapPin size={10} className="text-orange-400" />{_app.address}
                        </span>
                      )}
                      {_expLabel && (
                        <span className="flex items-center gap-1.5 text-[11px] text-white/50 font-medium">
                          <Briefcase size={10} className="text-blue-400" />{_expLabel}
                        </span>
                      )}
                      {_app.availability && (
                        <span className="flex items-center gap-1.5 text-[11px] font-black text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {_app.availability}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 px-6 pb-5 flex-wrap">
                  <button onClick={() => window.open(`mailto:${_app.email}`, '_blank')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                    <MessageSquare size={13} /> Contacter
                  </button>
                  {_app.cvUrl && (
                    <button onClick={() => window.open(_app.cvUrl, '_blank')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-white/80 font-black text-xs hover:bg-white/10 transition-all">
                      <Eye size={13} /> Voir CV
                    </button>
                  )}
                  {_app.cvUrl && (
                    <a href={_app.cvUrl} download
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-white/80 font-black text-xs hover:bg-white/10 transition-all">
                      <Download size={13} /> Télécharger CV
                    </a>
                  )}
                  <button onClick={() => setScheduleOpen(v => !v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all ${scheduleOpen ? 'bg-blue-500 text-white' : 'border border-white/20 text-white/80 hover:bg-white/10'}`}>
                    <Calendar size={13} /> Programmer entretien
                  </button>
                  {(_app.whatsapp || _app.phone) && (
                    <button onClick={() => window.open(`https://wa.me/${(_app.whatsapp||_app.phone||'').replace(/\D/g,'')}`, '_blank')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-white/80 font-black text-xs hover:bg-white/10 transition-all">
                      <Phone size={13} /> WhatsApp
                    </button>
                  )}
                </div>

                {/* Schedule interview form */}
                {scheduleOpen && (
                  <div className="mx-6 mb-5 p-4 bg-blue-900/40 border border-blue-500/30 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300 mb-3 flex items-center gap-2">
                      <Calendar size={11} /> Programmer un entretien
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1 block">Date & Heure *</label>
                        <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-400 focus:bg-white/15" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1 block">Lieu / Lien</label>
                        <input type="text" value={scheduleNote} onChange={e => setScheduleNote(e.target.value)}
                          placeholder="Bureau Vedior GM / Google Meet…"
                          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleScheduleInterview} disabled={!scheduleDate}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 text-white font-black text-xs hover:bg-blue-600 transition-all disabled:opacity-40 shadow-lg">
                        <CheckCircle size={12} /> Confirmer l'entretien
                      </button>
                      <button onClick={() => setScheduleOpen(false)}
                        className="px-4 py-2 rounded-xl border border-white/20 text-white/60 font-black text-xs hover:bg-white/10 transition-all">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Tab nav ── */}
              <div className="shrink-0 flex border-b border-gray-100 px-4 overflow-x-auto bg-gray-50/50">
                {DETAIL_TABS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setDetailTab(t.id)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-black whitespace-nowrap border-b-2 transition-all ${detailTab === t.id ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-white/60'}`}>
                      <Icon size={12} />{t.label}
                    </button>
                  );
                })}
              </div>

              {/* ── Tab content ── */}
              <div className="flex-1 overflow-y-auto">

                {/* ── PROFIL ── */}
                {detailTab === 'profil' && (
                  <div className="p-5 grid grid-cols-3 gap-4">

                    {/* LEFT — Infos perso */}
                    <div className="col-span-2 space-y-4">

                      {/* Infos personnelles card */}
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                            <User size={14} className="text-blue-500" />
                          </div>
                          <p className="font-black text-gray-900 text-sm">Informations personnelles</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { icon: User,          label: 'Nom complet',       value: _app.fullName },
                            { icon: FileText,      label: 'ID Candidat',       value: _app.id?.slice(0,8).toUpperCase() },
                            { icon: Mail,          label: 'Email',             value: _app.email },
                            { icon: Phone,         label: 'Téléphone',         value: _app.phone },
                            { icon: Calendar,      label: 'Date de naissance', value: _app.birthDate ? (() => { const d = new Date(_app.birthDate); const age = Math.floor((Date.now()-d.getTime())/31557600000); return `${d.toLocaleDateString('fr-FR')} (${age} ans)`; })() : null },
                            { icon: MapPin,        label: 'Adresse',           value: _app.address },
                            { icon: Globe,         label: 'Nationalité',       value: _app.nationality },
                            { icon: User,          label: 'Genre',             value: _app.gender === 'F' ? 'Féminin' : _app.gender === 'M' ? 'Masculin' : _app.gender },
                          ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                            <div key={label} className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                <Icon size={11} className="text-gray-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Résumé IA card */}
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                            <Sparkles size={14} className="text-orange-500" />
                          </div>
                          <p className="font-black text-gray-900 text-sm">Résumé du profil</p>
                          <span className="text-[9px] font-black px-2 py-0.5 bg-orange-50 text-orange-500 border border-orange-100 rounded-full uppercase tracking-widest">Généré par IA</span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed font-medium">
                          {_app.fullName || 'Ce candidat'} possède {_expLabel ? _expLabel + " d'expérience" : "une expérience"}{_app.education ? ` en ${_app.education}` : ''}. {_app.availability ? `Disponible ${_app.availability.toLowerCase()}.` : ''}{_app._skills ? ` Compétences clés : ${(_app._skills || '').split(',').slice(0,3).join(', ')}.` : ''}
                        </p>
                      </div>

                      {/* Infos complémentaires */}
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                            <Info size={14} className="text-violet-500" />
                          </div>
                          <p className="font-black text-gray-900 text-sm">Informations complémentaires</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {_langs.length > 0 && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Langues</p>
                              <div className="flex flex-wrap gap-1.5">
                                {_langs.map(l => <span key={l} className="text-[10px] font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">{l}</span>)}
                              </div>
                            </div>
                          )}
                          {_app.availability && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Disponibilité</p>
                              <span className="text-[10px] font-black px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">{_app.availability}</span>
                            </div>
                          )}
                          {_app.nationality && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Nationalité</p>
                              <p className="text-sm font-bold text-gray-700">{_app.nationality}</p>
                            </div>
                          )}
                          {_app.gender && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Genre</p>
                              <p className="text-sm font-bold text-gray-700">{_app.gender === 'F' ? 'Féminin' : _app.gender === 'M' ? 'Masculin' : _app.gender}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT sidebar */}
                    <div className="space-y-4">

                      {/* Score circular card */}
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <Zap size={14} className="text-blue-500" />
                          <p className="font-black text-gray-900 text-sm">Score Matching IA</p>
                        </div>
                        <div className="flex flex-col items-center mb-4">
                          <svg width="100" height="100" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r={_R} fill="none" stroke="#f3f4f6" strokeWidth="8" />
                            <circle cx="50" cy="50" r={_R} fill="none" stroke={_scoreColor} strokeWidth="8"
                              strokeDasharray={`${_dash} ${_C}`} strokeLinecap="round"
                              transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1s ease' }} />
                            <text x="50" y="50" textAnchor="middle" dy="0.35em" fontSize="18" fontWeight="900" fill={_scoreColor}>{_score}%</text>
                          </svg>
                          <div className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black ${_scoreBg}`} style={{ color: _scoreColor }}>
                            {_score >= 80 ? '👍' : _score >= 60 ? '👌' : _score >= 40 ? '⚠️' : '👎'} {_scoreLabel}
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center leading-relaxed font-medium">
                          {_score >= 80 ? 'Profil correspondant aux exigences du poste.' : _score >= 60 ? 'Profil acceptable, quelques points à vérifier.' : _score >= 40 ? 'Profil partiellement compatible.' : 'Profil peu compatible avec le poste.'}
                        </p>
                      </div>

                      {/* Statut candidature card */}
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <Activity size={14} className="text-orange-500" />
                          <p className="font-black text-gray-900 text-sm">Statut de candidature</p>
                        </div>
                        <select
                          value={_app.status || 'new'}
                          onChange={e => handleStatusChange(e.target.value)}
                          disabled={statusChanging}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-black text-gray-800 outline-none focus:border-blue-400 mb-4 appearance-none">
                          {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                          ))}
                        </select>
                        <div className="space-y-3 text-xs">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Date de candidature</p>
                            <p className="font-bold text-gray-800">{fmtDate(_app.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Source</p>
                            <p className="font-bold text-gray-800">Offre d'emploi - Site web</p>
                          </div>
                          {_app.interviewDate && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Entretien prévu</p>
                              <p className="font-bold text-blue-600">{new Date(_app.interviewDate).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                              {_app.interviewNote && <p className="text-gray-400 mt-0.5 font-medium">{_app.interviewNote}</p>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions rapides card */}
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <p className="font-black text-gray-900 text-sm mb-3">Actions rapides</p>
                        <div className="space-y-2">
                          <button onClick={() => window.open(`mailto:${_app.email}`, '_blank')}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-700 transition-all shadow-sm">
                            <MessageSquare size={13} /> Contacter le candidat
                          </button>
                          {_app.cvUrl && (
                            <button onClick={() => window.open(_app.cvUrl, '_blank')}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50 transition-all">
                              <Eye size={13} /> Voir CV
                            </button>
                          )}
                          {_app.cvUrl && (
                            <a href={_app.cvUrl} download
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50 transition-all">
                              <Download size={13} /> Télécharger CV
                            </a>
                          )}
                          <button onClick={() => { setScheduleOpen(v => !v); setDetailTab('profil'); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-black text-xs hover:bg-blue-100 transition-all">
                            <Calendar size={13} /> Programmer entretien
                          </button>
                          <button onClick={() => handleStatusChange('rejected')}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-red-100 bg-red-50 text-red-600 font-black text-xs hover:bg-red-100 transition-all">
                            <RefreshCw size={13} /> Changer le statut
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer metadata */}
                    <div className="col-span-3 flex items-center justify-between px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] text-gray-400 font-medium">
                      <span className="flex items-center gap-1.5"><Calendar size={11} /> Créé le <strong className="text-gray-600">{fmtDate(_app.createdAt)}</strong></span>
                      <span className="flex items-center gap-1.5"><RefreshCw size={11} /> Mis à jour le <strong className="text-gray-600">{fmtDate(_app.updatedAt)}</strong></span>
                      <span className="flex items-center gap-1.5"><User size={11} /> Créé par <strong className="text-gray-600">{_app.createdBy || 'Auto'}</strong></span>
                      <span className="flex items-center gap-1.5"><User size={11} /> Assigné à <strong className="text-gray-600">{_app.assignedTo || _app.fullName || '—'}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Tab nav ── */}
              <div className="shrink-0 flex border-b border-gray-100 px-6 overflow-x-auto">
                {DETAIL_TABS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setDetailTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-3 text-[11px] font-black whitespace-nowrap border-b-2 transition-all ${detailTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      <Icon size={12} />{t.label}
                    </button>
                  );
                })}
              </div>

              {/* ── Tab content ── */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* ── PROFIL ── */}
                {detailTab === 'profil' && (
                  <div className="grid grid-cols-2 gap-5">
                    {/* Colonne gauche */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Identité & Contact</p>
                      {[
                        { icon: User,          label: 'ID',              value: _app.id?.slice(0,8).toUpperCase() },
                        { icon: Mail,          label: 'Email',           value: _app.email },
                        { icon: Phone,         label: 'Téléphone',       value: _app.phone },
                        { icon: MessageSquare, label: 'WhatsApp',        value: _app.whatsapp },
                        { icon: MapPin,        label: 'Adresse',         value: _app.address },
                        { icon: Globe,         label: 'Nationalité',     value: _app.nationality },
                        { icon: User,          label: 'Genre',           value: _app.gender === 'F' ? 'Féminin' : _app.gender === 'M' ? 'Masculin' : _app.gender },
                        { icon: Calendar,      label: 'Date de naissance', value: _app.birthDate ? new Date(_app.birthDate).toLocaleDateString('fr-FR') : null },
                      ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon size={12} className="text-gray-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-300">{label}</p>
                            <p className="text-sm font-bold text-gray-800 truncate">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Colonne droite */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Profil Professionnel</p>
                      {[
                        { icon: GraduationCap, label: 'Formation',        value: _app.education },
                        { icon: Briefcase,     label: 'Expérience totale',value: _app.experience ? (String(_app.experience).includes('an') ? String(_app.experience) : `${_app.experience} ans`) : null },
                        { icon: Clock,         label: 'Disponibilité',    value: _app.availability },
                        { icon: Banknote,      label: 'Salaire attendu',  value: _app.salaryExpected },
                      ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon size={12} className="text-blue-400" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-300">{label}</p>
                            <p className="text-sm font-bold text-gray-800">{value}</p>
                          </div>
                        </div>
                      ))}

                      {/* Langues */}
                      {_langs.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-2">Langues</p>
                          <div className="flex flex-wrap gap-1.5">
                            {_langs.map(l => (
                              <span key={l} className="text-[10px] font-black px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">{l}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message / À propos */}
                      {_app.message && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-2">À propos</p>
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <p className="text-xs text-gray-600 leading-relaxed font-medium">{_app.message}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Changer le statut */}
                    <div className="col-span-2 pt-3 border-t border-gray-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-2">Changer le statut</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                          const active = (_app.status || 'new') === key;
                          return (
                            <button key={key} disabled={statusChanging}
                              onClick={() => handleStatusChange(key)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${active ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm` : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : 'bg-gray-300'}`} />
                              {cfg.label}
                              {statusChanging && active && <RefreshCw size={10} className="animate-spin ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── EXPÉRIENCE ── */}
                {detailTab === 'experience' && (
                  <div className="p-5 space-y-4">

                    {/* Cards résumé */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon: Briefcase,     label: "Années d'exp.",  value: _expLabel || '—',               color: 'bg-blue-50 border-blue-100 text-blue-700' },
                        { icon: GraduationCap, label: 'Formation',       value: _app.education || '—',           color: 'bg-violet-50 border-violet-100 text-violet-700' },
                        { icon: Clock,         label: 'Disponibilité',   value: _app.availability || '—',        color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                      ].map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className={`rounded-2xl p-4 border ${color}`}>
                          <div className="flex items-center gap-1.5 mb-2 opacity-60">
                            <Icon size={11} /><p className="text-[9px] font-black uppercase tracking-widest">{label}</p>
                          </div>
                          <p className="text-sm font-black">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Niveau professionnel estimé */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Niveau professionnel estimé</p>
                      <div className="space-y-2">
                        {[
                          { label: 'Débutant',  threshold: 0,  max: 1  },
                          { label: 'Junior',    threshold: 1,  max: 3  },
                          { label: 'Confirmé',  threshold: 3,  max: 6  },
                          { label: 'Senior',    threshold: 6,  max: 10 },
                          { label: 'Expert',    threshold: 10, max: 99 },
                        ].map(({ label, threshold, max }) => {
                          const cExp = parseExp(_app.experience);
                          const active = cExp >= threshold;
                          const current = cExp >= threshold && cExp < max;
                          return (
                            <div key={label} className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-blue-500' : 'bg-gray-200'}`} />
                              <span className={`text-sm font-bold w-20 ${current ? 'text-blue-600' : active ? 'text-gray-700' : 'text-gray-300'}`}>
                                {label} {current && '←'}
                              </span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${active ? 'bg-blue-500' : ''}`}
                                  style={{ width: active ? '100%' : '0%' }} />
                              </div>
                              <span className="text-[9px] text-gray-300 font-bold w-16 text-right">{threshold === 0 ? '< 1 an' : threshold === 10 ? '10+ ans' : `${threshold}–${max} ans`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Message du candidat */}
                    {_app.message && (
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <BookOpen size={14} className="text-gray-400" />
                          <p className="font-black text-gray-900 text-sm">Parcours décrit par le candidat</p>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed font-medium">{_app.message}</p>
                      </div>
                    )}

                    {!_app.message && !_app.experience && (
                      <div className="py-16 text-center">
                        <Briefcase size={28} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-300 font-black text-xs uppercase tracking-widest">Aucune information renseignée</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── COMPÉTENCES ── */}
                {detailTab === 'competences' && (
                  <div className="p-5 space-y-4">
                    {/* Score global */}
                    <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                      <ScoreBar score={_score} />
                      <p className="text-[10px] text-gray-400 font-medium mt-2">
                        Score calculé automatiquement selon l'expérience, la formation, les documents et les compétences renseignées.
                      </p>
                    </div>

                    {/* Compétences */}
                    {_skills.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-3">Compétences déclarées</p>
                        <div className="flex flex-wrap gap-2">
                          {_skills.map((sk, i) => (
                            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-default">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-gray-200 font-black text-xs uppercase tracking-widest">Aucune compétence renseignée</div>
                    )}

                    {/* Langues */}
                    {_langs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-3">Langues</p>
                        <div className="grid grid-cols-3 gap-2">
                          {_langs.map(l => (
                            <div key={l} className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                              <Globe size={14} className="text-blue-500" />
                              <span className="text-sm font-bold text-blue-700">{l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Indicateurs */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-3">Indicateurs de profil</p>
                      <div className="space-y-2.5">
                        {[
                          { label: 'CV fourni',          ok: !!_app.cvUrl,                  detail: _app.cvUrl ? 'Document disponible' : 'Absent' },
                          { label: "Pièce d'identité",  ok: !!(_app.idCardUrl),             detail: _app.idCardUrl ? 'Disponible' : 'Non fournie' },
                          { label: 'Diplôme',            ok: !!(_app.diplomaUrl),            detail: _app.diplomaUrl ? 'Disponible' : 'Non fourni' },
                          { label: 'Email vérifié',      ok: !!(_app.email),                 detail: _app.email || '—' },
                          { label: 'Téléphone renseigné',ok: !!(_app.phone || _app.whatsapp), detail: _app.phone || _app.whatsapp || '—' },
                        ].map(({ label, ok, detail }) => (
                          <div key={label} className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                              {ok ? <CheckCircle size={12} className="text-emerald-600" /> : <XCircle size={12} className="text-gray-300" />}
                            </div>
                            <div className="flex-1 flex items-center justify-between">
                              <span className={`text-xs font-bold ${ok ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                              <span className="text-[10px] text-gray-400 font-medium truncate max-w-[180px]">{detail}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CV & DOCUMENTS ── */}
                {detailTab === 'documents' && (
                  <div className="p-5 space-y-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Documents fournis</p>

                    {/* CV Viewer */}
                    {_app.cvUrl && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-blue-500" />
                            <span className="text-xs font-black text-gray-700">Curriculum Vitae</span>
                            <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-black border border-emerald-100">Disponible</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => window.open(_app.cvUrl, '_blank')}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] font-black text-gray-600 hover:bg-gray-50">
                              <ExternalLink size={10} /> Ouvrir
                            </button>
                            <a href={_app.cvUrl} download
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] font-black text-gray-600 hover:bg-gray-50">
                              <Download size={10} /> Télécharger
                            </a>
                          </div>
                        </div>
                        {/* PDF Embed */}
                        <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50" style={{ height: 420 }}>
                          <iframe
                            src={`${_app.cvUrl}#toolbar=0&navpanes=0`}
                            className="w-full h-full"
                            title="Aperçu CV"
                          />
                        </div>
                      </div>
                    )}

                    {/* Pièce d'identité */}
                    {_app.idCardUrl && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-violet-500" />
                            <span className="text-xs font-black text-gray-700">Pièce d'identité</span>
                            <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-black border border-emerald-100">Disponible</span>
                          </div>
                          <button onClick={() => window.open(_app.idCardUrl, '_blank')}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] font-black text-gray-600 hover:bg-gray-50">
                            <Eye size={10} /> Voir
                          </button>
                        </div>
                        <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50" style={{ height: 200 }}>
                          <img src={_app.idCardUrl} alt="Pièce d'identité" className="w-full h-full object-contain" />
                        </div>
                      </div>
                    )}

                    {/* Diplôme */}
                    {_app.diplomaUrl && (
                      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                            <GraduationCap size={18} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-800">Diplôme / Certificat</p>
                            <p className="text-[10px] text-gray-400">Document fourni</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => window.open(_app.diplomaUrl, '_blank')}
                            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[10px] font-black text-gray-600 hover:bg-gray-50">
                            <Eye size={10} /> Voir
                          </button>
                          <a href={_app.diplomaUrl} download
                            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[10px] font-black text-gray-600 hover:bg-gray-50">
                            <Download size={10} /> Télécharger
                          </a>
                        </div>
                      </div>
                    )}

                    {!_app.cvUrl && !_app.idCardUrl && !_app.diplomaUrl && (
                      <div className="py-16 text-center">
                        <FileText size={32} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-300 font-black text-xs uppercase tracking-widest">Aucun document fourni</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── NOTES ── */}
                {detailTab === 'notes' && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notes internes</p>
                      <span className="text-[9px] text-gray-300 font-medium">Visibles uniquement par l'équipe</span>
                    </div>
                    <textarea
                      value={noteVal}
                      onChange={e => setNoteVal(e.target.value)}
                      placeholder="Ajoutez vos observations, retours d'entretien, points d'attention…"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-700 outline-none focus:border-gray-300 focus:bg-white resize-none font-medium leading-relaxed transition-all"
                      rows={10}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-300 font-medium">{noteVal.length} caractères</p>
                      <button onClick={handleSaveNote} disabled={savingNote}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-black text-xs shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: '#0A192F' }}>
                        {savingNote ? <><RefreshCw size={12} className="animate-spin" /> Sauvegarde…</> : <><CheckCircle size={12} /> Enregistrer</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── HISTORIQUE ── */}
                {detailTab === 'historique' && (
                  <div className="p-5 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Historique de la candidature</p>
                    <div className="relative pl-5">
                      <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-100" />
                      {[
                        { date: fmtDate(_app.createdAt), label: 'Candidature reçue', detail: `Poste : ${_app.jobTitle || 'Non précisé'}`, color: 'bg-blue-500' },
                        _app.interviewDate && { date: new Date(_app.interviewDate).toLocaleDateString('fr-FR'), label: 'Entretien programmé', detail: _app.interviewNote || '', color: 'bg-violet-500' },
                        _app.status === 'hired' && { date: '—', label: 'Candidature acceptée', detail: 'Profil retenu', color: 'bg-emerald-500' },
                        _app.status === 'rejected' && { date: '—', label: 'Candidature refusée', detail: 'Profil non retenu', color: 'bg-red-400' },
                        _app.notesUpdatedAt && { date: fmtDate(_app.notesUpdatedAt), label: 'Notes mises à jour', detail: "Par l'équipe admin", color: 'bg-amber-400' },
                      ].filter(Boolean).map((event: any, i) => (
                        <div key={i} className="relative flex gap-4 pb-5">
                          <div className={`absolute -left-3.5 w-3 h-3 rounded-full border-2 border-white ${event.color}`} style={{ marginTop: 2 }} />
                          <div className="flex-1 pl-3">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-xs font-black text-gray-800">{event.label}</p>
                              <span className="text-[9px] text-gray-400 font-medium">{event.date}</span>
                            </div>
                            {event.detail && <p className="text-[11px] text-gray-400 font-medium">{event.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Infos techniques */}
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-3">Informations techniques</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'ID Candidature', value: _app.id?.slice(0, 12).toUpperCase() || '—' },
                          { label: 'ID Offre liée', value: _app.jobId?.slice(0, 12).toUpperCase() || '—' },
                          { label: 'Statut actuel', value: STATUS_CFG[_app.status || 'new']?.label },
                          { label: 'Score IA', value: `${_score}%` },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-300">{label}</p>
                            <p className="text-xs font-black text-gray-700 mt-0.5 font-mono">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="shrink-0 px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-4 flex-wrap">
                <span className="text-[10px] text-gray-400 font-medium">
                  Créé le <span className="font-black text-gray-600">{fmtDate(_app.createdAt)}</span>
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                  Mis à jour le <span className="font-black text-gray-600">{_app.updatedAt ? fmtDate(_app.updatedAt) : '—'}</span>
                </span>
                {_app.createdBy && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    Créé par <span className="font-black text-gray-600">{_app.createdBy}</span>
                  </span>
                )}
                {(_app.assignedTo || _app.assignedToEmail) && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    Assigné à <span className="font-black text-gray-600">{_app.assignedTo || _app.assignedToEmail}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

      {/* ══ Edit Modal ══ */}
      {editOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Modal header */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Edit2 size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="font-black text-gray-900 text-sm">Modifier le profil</p>
                  <p className="text-[10px] text-gray-400 font-medium">{selected.fullName}</p>
                </div>
              </div>
              <button onClick={() => setEditOpen(false)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-all">
                <X size={14} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Identité */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-4">Identité & Contact</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'fullName',    label: 'Nom complet',      type: 'text' },
                    { key: 'email',       label: 'Email',             type: 'email' },
                    { key: 'phone',       label: 'Téléphone',         type: 'tel' },
                    { key: 'whatsapp',    label: 'WhatsApp',          type: 'tel' },
                    { key: 'address',     label: 'Adresse / Ville',   type: 'text' },
                    { key: 'nationality', label: 'Nationalité',       type: 'text' },
                    { key: 'birthDate',   label: 'Date de naissance', type: 'date' },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">{label}</label>
                      <input type={type} value={(editForm as any)[key] || ''}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-300 focus:bg-white transition-all" />
                    </div>
                  ))}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Genre</label>
                    <select value={editForm.gender || ''}
                      onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-300 focus:bg-white transition-all">
                      <option value="">—</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Profil professionnel */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-4">Profil professionnel</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'jobTitle',       label: 'Poste / Titre',       type: 'text' },
                    { key: 'experience',     label: "Années d'expérience", type: 'text', placeholder: 'ex: 5' },
                    { key: 'education',      label: 'Formation',            type: 'text' },
                    { key: 'availability',   label: 'Disponibilité',        type: 'text', placeholder: 'immediate / 1 mois…' },
                    { key: 'salaryExpected', label: 'Salaire souhaité',     type: 'text' },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">{label}</label>
                      <input type={type} value={(editForm as any)[key] || ''} placeholder={placeholder}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-300 focus:bg-white transition-all" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Langues & Compétences */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-4">Langues & Compétences</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Langues <span className="normal-case font-medium">(séparées par des virgules)</span></label>
                    <input type="text" value={editForm.languages || ''} placeholder="Français, Anglais, Arabe…"
                      onChange={e => setEditForm(f => ({ ...f, languages: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-300 focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Compétences <span className="normal-case font-medium">(séparées par des virgules)</span></label>
                    <input type="text" value={editForm.skills || ''} placeholder="Excel, Gestion de projet…"
                      onChange={e => setEditForm(f => ({ ...f, skills: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-300 focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">À propos / Message</label>
                    <textarea value={editForm.message || ''} rows={4}
                      onChange={e => setEditForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-300 focus:bg-white resize-none transition-all" />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={() => setEditOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-black text-gray-600 hover:bg-gray-100 transition-all">
                Annuler
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-black text-sm shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#0A192F' }}>
                {savingEdit ? <><RefreshCw size={13} className="animate-spin" /> Sauvegarde…</> : <><CheckCircle size={13} /> Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}