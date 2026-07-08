import React, { useState, useEffect, memo } from 'react';
import { 
  LayoutDashboard, Briefcase, Users, Bell, Plus, Trash2, 
  CheckCircle, XCircle, LogOut, ChevronLeft, Loader2, Edit,
  Save, Search, BarChart3, MessageSquare, Building2, Settings,
  Clock, User, MoreVertical, ChevronRight, AlertCircle, Shield,
  FileText, MapPin, X, Languages, RefreshCw, UserPlus, Mail,
  ToggleLeft, ToggleRight, Crown, UserCheck, UserX, KeyRound, Download,
  Lock, Eye, EyeOff, Fingerprint, ShieldCheck, Activity, Zap, Calendar,
  ChevronDown, Phone, Target, Sparkles, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { db, auth, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { useTranslation } from '../lib/i18n';
import MatchingPanel from './MatchingPanel';
import AdminPricingTab from './AdminPricingTab';
import CompanyInfoEditorBase from './CompanyInfoEditor';
const CompanyInfoEditor = memo(CompanyInfoEditorBase);
import { 
  collection, onSnapshot, query, orderBy, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp, getDocs, getDoc, setDoc, where
} from 'firebase/firestore';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
  signInWithEmailAndPassword,
  getAuth
} from 'firebase/auth';


const Logo = ({ inverted = false, size = "sm" }: { inverted?: boolean; size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: "h-10",
    md: "h-16",
    lg: "h-24"
  };
  const currentSize = sizes[size];

  return (
    <div className="flex items-center transition-all duration-500">
      <img 
        src="/logo.png" 
        alt="Vedior GM" 
        className={`${currentSize} w-auto object-contain transition-all duration-500 ${inverted ? 'brightness-100' : 'brightness-100'}`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};


type AdminPanelProps = {
  onBack: () => void;
};

const getChartData = (lang: string) => {
  const days = {
    FR: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    EN: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    AR: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
  };
  const data = [40, 30, 45, 60, 55, 70, 50];
  const currentDays = (days as any)[lang] || days.EN;
  return currentDays.map((name: string, i: number) => ({ name, value: data[i] }));
};

const SPARKLINE_DATA = [
  { v: 10 }, { v: 15 }, { v: 12 }, { v: 18 }, { v: 25 }, { v: 22 }, { v: 30 }
];

const SKILLS_BY_SECTOR_ADMIN: Record<string, string[]> = {
  btp:         ['CACES', 'AutoCAD', 'Gestion de chantier', 'Lecture de plans', 'Soudure', 'Électricité BT', 'Sécurité chantier', 'Béton armé'],
  logistics:   ['Gestion de stock', 'WMS', 'CACES R489', 'Douane', 'Transport maritime', 'SAP', 'Manutention', 'Permis PL'],
  hospitality: ['Service en salle', 'Sommellerie', 'HACCP', 'Réservation', 'Accueil client', 'Caisse', 'Ménage hôtelier', 'Cuisine'],
  security:    ['Ronde de sécurité', 'Surveillance caméra', 'CQP APS', 'Gestion des accès', 'Secourisme', 'Radio communication'],
  healthcare:  ['Soins infirmiers', 'Pharmacologie', 'Urgences', 'Bloc opératoire', 'Pédiatrie', 'Maternité', 'Radiologie'],
  admin:       ['Excel avancé', 'Comptabilité', 'Sage', 'Paie', 'Ressources humaines', 'Rédaction', 'Archivage', 'PowerPoint'],
  catering:    ['HACCP', 'Cuisine gastronomique', 'Pâtisserie', 'Gestion des coûts', 'Commandes fournisseurs', 'Service traiteur'],
  commerce:    ['Négociation', 'CRM', 'Prospection', 'Merchandising', 'Caisse', 'Gestion de rayon', 'Export', 'E-commerce'],
};

const JOBS_BY_SECTOR_ADMIN: Record<string, string[]> = {
  btp:         ['Chef de chantier', 'Conducteur de travaux', 'Maçon', 'Électricien', 'Plombier', 'Ingénieur BTP', 'Topographe'],
  logistics:   ['Agent logistique', 'Responsable entrepôt', 'Chauffeur PL', 'Agent portuaire', 'Coordinateur transport'],
  hospitality: ['Réceptionniste', 'Barman', 'Chef de rang', 'Gouvernante', 'Directeur hôtel', 'Cuisinier', "Maître d'hôtel"],
  security:    ['Agent de sécurité', 'Chef de poste', 'Superviseur sécurité', 'Technicien CCTV', 'Garde du corps'],
  healthcare:  ['Infirmier(e)', 'Médecin généraliste', 'Sage-femme', 'Aide-soignant(e)', 'Pharmacien(ne)', 'Laborantin'],
  admin:       ['Assistant(e) RH', 'Comptable', 'Secrétaire', 'Responsable administratif', 'Contrôleur de gestion'],
  catering:    ['Chef cuisinier', 'Commis de cuisine', 'Pâtissier', 'Responsable restauration', 'Plongeur'],
  commerce:    ['Commercial(e)', 'Chef de rayon', 'Responsable boutique', 'Merchandiser', 'Chargé(e) export'],
};

// ── Composant extrait pour éviter React error #310 (hooks dans JSX) ──────────
function MsgReplyBlock({ msg, db }: { msg: any; db: any }) {
  const [replyText,  setReplyText]  = React.useState('');
  const [processing, setProcessing] = React.useState(false);

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'messages', msg.id), {
        status:      decision,
        adminReply:  replyText.trim() || null,
        processedAt: serverTimestamp(),
        read:        true,
      });
      if (decision === 'approved' && msg.needId) {
        await updateDoc(doc(db, 'needs', msg.needId), {
          status:         'new',
          unlocked:       true,
          unlockedAt:     serverTimestamp(),
          unlockedReason: replyText.trim() || 'Approved by admin',
          updatedAt:      serverTimestamp(),
        });
      }
    } finally { setProcessing(false); }
  };

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 block">
          Your reply to the recruiter (optional)
        </label>
        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          rows={2}
          placeholder="Ex: Modification approved, you can update the offer..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium resize-none focus:outline-none focus:border-gray-900"
        />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => handleDecision('approved')} disabled={processing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-wider hover:bg-green-700 transition-all disabled:opacity-40">
          {processing ? '...' : '✅ Approve & unlock'}
        </button>
        <button onClick={() => handleDecision('rejected')} disabled={processing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 text-red-500 border border-red-200 text-xs font-black uppercase tracking-wider hover:bg-red-100 transition-all disabled:opacity-40">
          ❌ Reject
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 🧪 MODE TEST — mettre false pour désactiver avant le lancement
const TEST_MODE = true;
const TEST_EMAIL    = 'nassert93@gmail.com';  // ← ton email admin
const TEST_PASSWORD = 'TonMotDePasse123!';    // ← ton mot de passe admin
// ─────────────────────────────────────────────────────────────

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const { lang, setLang, t, dir } = useTranslation();

  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // ── Login email/password ──
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'reset'>('login');
  const [resetSent, setResetSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'applications' | 'recruiters' | 'needs' | 'diagnostics' | 'settings' | 'users' | 'pricing' | 'messages'>('dashboard');

  // ── Messages & demandes de modification ──
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [adminMsgText, setAdminMsgText]   = useState('');
  const [sendingAdminMsg, setSendingAdminMsg] = useState(false);
  const [selectedConvUserId, setSelectedConvUserId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [appStatusFilter, setAppStatusFilter] = useState<string>('all');
  const [appSearch, setAppSearch] = useState('');
  const [appSort, setAppSort] = useState<'newest'|'oldest'|'score'>('newest');
  const [appPage, setAppPage] = useState(1);
  const APP_PAGE_SIZE = 10;
  const [detailTab, setDetailTab] = useState('Profil');
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [needs, setNeeds] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [publishingAsOffer, setPublishingAsOffer] = useState(false);
  const [publishedOfferId, setPublishedOfferId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // ── Matching candidats ──
  const [linkedCandidates, setLinkedCandidates] = useState<Record<string, Set<string>>>({});

  const handleLinkCandidate = async (needId: string, candidateId: string, mode: 'ai' | 'manual') => {
    const needDoc = needs.find(n => n.id === needId);
    const existing: string[] = needDoc?.linkedCandidates || [];

    if (!existing.includes(candidateId)) {
      // 1. Update the need with linkedCandidates
      await updateDoc(doc(db, 'needs', needId), {
        linkedCandidates: [...existing, candidateId],
        lastLinkedAt: serverTimestamp(),
        lastLinkMode: mode,
      }).catch(() => {});

      // 2. Get candidate data to include in proposition
      const candidateData = users.find(u => u.id === candidateId) || {};
      const recruiterEmail = needDoc?.email || needDoc?.recruiterEmail || '';

      // 3. Create a proposition document so recruiter can see it
      const propRef = await addDoc(collection(db, 'propositions'), {
        needId,
        candidateId,
        recruiterId: needDoc?.userId || needDoc?.recruiterId || '',
        recruiterEmail,
        companyName: needDoc?.companyName || '',
        jobTitle: needDoc?.jobTitle || needDoc?.title || '',
        candidateName: candidateData?.fullName || candidateData?.displayName || candidateData?.contactName || 'Candidat',
        candidateEmail: candidateData?.email || '',
        candidatePhone: candidateData?.phone || '',
        candidateSector: candidateData?.sector || candidateData?.candidateSector || '',
        candidateExperience: candidateData?.experience || '',
        candidateEducation: candidateData?.education || '',
        candidateLanguages: candidateData?.languages || '',
        candidateAvailability: candidateData?.availability || '',
        cvUrl: candidateData?.cvUrl || null,
        mode,
        status: 'pending', // pending | viewed | accepted | rejected
        createdAt: serverTimestamp(),
        viewedAt: null,
      });

      // 3b. Link the proposition back to the pipeline entry (single source of truth = candidatePipeline)
      try {
        const freshNeedSnap = await getDoc(doc(db, 'needs', needId));
        const freshNeed = freshNeedSnap.data();
        const pipeline = Array.isArray(freshNeed?.candidatePipeline) ? freshNeed!.candidatePipeline : [];
        const updatedPipeline = pipeline.map((e: any) =>
          e.candidateId === candidateId ? { ...e, propositionId: propRef.id } : e
        );
        if (updatedPipeline.some((e: any) => e.candidateId === candidateId)) {
          await updateDoc(doc(db, 'needs', needId), { candidatePipeline: updatedPipeline });
        }
      } catch (e) {
        console.warn('Could not link propositionId to pipeline entry:', e);
      }

      // 4. Create a notification for the recruiter
      if (needDoc?.userId) {
        await addDoc(collection(db, 'notifications'), {
          userId: needDoc.userId,
          type: 'new_proposition',
          title: 'New profile proposed',
          message: `A profile has been selected pour votre demande "${needDoc?.jobTitle || needDoc?.title || 'N/A'}"`,
          needId,
          candidateId,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    }

    setLinkedCandidates(prev => ({
      ...prev,
      [needId]: new Set([...(prev[needId] || []), candidateId]),
    }));
  };

  // États gestion utilisateurs
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    role: 'candidate', email: '', password: '', phone: '',
    displayName: '', adminLevel: 'admin',
    companyName: '', contactName: '', rcNumber: '', website: '', sector: 'btp',
    fullName: '', whatsapp: '', nationality: '', education: '', experience: '',
    availability: 'Immédiate', gender: 'M', candidateSector: '', address: '', languages: '',
  });
  const [userSaving, setUserSaving] = useState(false);
  const [showScanCV, setShowScanCV] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scannedPhotoDataUrl, setScannedPhotoDataUrl] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [manualPhotoFile, setManualPhotoFile]         = useState<File | null>(null);
  const [manualPhotoPreview, setManualPhotoPreview]   = useState<string | null>(null);
  const [scannedCvFile, setScannedCvFile]             = useState<File | null>(null);
  const [scanError, setScanError] = useState('');
  const [scanProgress, setScanProgress] = useState('');
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    tempId: string; tempPassword: string; email: string; role: string; displayName: string; emailSent?: boolean;
  } | null>(null);
  const [credentialsCopied, setCredentialsCopied] = useState(false);
  
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddApplication, setShowAddApplication] = useState(false);
  const [newApplication, setNewApplication] = useState({ fullName: '', email: '', phone: '', jobId: '', jobTitle: '', sector: 'btp', experience: '', education: '', skills: '', availability: 'Immédiate', nationality: 'Djiboutienne', status: 'new', notes: '' });
  const [submittingApp, setSubmittingApp] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [newJob, setNewJob] = useState({
    title: '', companyName: '', sector: 'btp', location: 'Djibouti',
    type: 'CDI', company: '🏢', tags: 'Urgent',
    profileCount: 1, expRequired: 3, urgency: 'medium' as 'low'|'medium'|'high',
    deadline: '', diplomaRequired: '', salaryRange: '', description: '',
    skills: '', selectedRecruiterId: '',
  });

  // ── Options dynamiques depuis Firestore ──
  const [dynSectors, setDynSectors] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynContracts, setDynContracts] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynEducations, setDynEducations] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynAvailabilities, setDynAvailabilities] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynUrgencies, setDynUrgencies] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynSalaries, setDynSalaries] = useState<{id:string; value:string; label:string}[]>([]);
  // dynDiplomas remplacé par dynEducations (même données, source Firestore: settings_educations)
  const [selectedSkillsJob, setSelectedSkillsJob] = useState<string[]>([]);
  const [skillInputJob, setSkillInputJob] = useState('');
  const [showJobSuggestionsModal, setShowJobSuggestionsModal] = useState(false);
  const [dynNationalities, setDynNationalities] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynLanguages, setDynLanguages] = useState<{id:string; value:string; label:string}[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  // Formulaire ajout d'option dans Settings
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, {value:string; label:string; _minRaw?:string; _maxRaw?:string}>>({});
  const [editingOption, setEditingOption] = useState<{colKey: string; id: string; label: string; value: string} | null>(null);

  // ── Documents requis à l'inscription candidat ──
  const DEFAULT_REQUIRED_DOCS = [
    { key: 'cv',         label: 'CV',                            emoji: '📄', required: true,  enabled: true  },
    { key: 'diplome',    label: 'Diploma',                       emoji: '🎓', required: false, enabled: false },
    { key: 'cni',        label: "Carte d'identité / Passeport", emoji: '🪪', required: false, enabled: false },
    { key: 'certificat', label: 'Certificat de travail',         emoji: '📋', required: false, enabled: false },
    { key: 'photo',      label: 'Photo professionnelle',         emoji: '🖼️', required: false, enabled: false },
  ];
  const [requiredDocs, setRequiredDocs] = useState(DEFAULT_REQUIRED_DOCS);
  const [savingDocs, setSavingDocs]     = useState(false);
  const [savedDocs, setSavedDocs]       = useState(false);

  // ── Pondérations de matching (IA + Manuel) ──
  const DEFAULT_MATCHING_WEIGHTS = {
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
  const [matchingWeights, setMatchingWeights] = useState<typeof DEFAULT_MATCHING_WEIGHTS>(DEFAULT_MATCHING_WEIGHTS);
  const [savingMatching, setSavingMatching] = useState(false);
  const [savedMatching, setSavedMatching]   = useState(false);

  // ── Prompt de scan CV (configurable) ──
  const DEFAULT_CV_SCAN_PROMPT = `Tu es un expert RH spécialisé dans le marché de l'emploi de Djibouti.
Contexte local important :
- Universités : Université de Djibouti (UoD), IUT Djibouti, ISERH, Institut Supérieur de Gestion
- Entreprises locales clés : Port de Djibouti, PAID, DMP, Doraleh Container Terminal (DCT), Djibouti Telecom, ONEAD, EDD, CDE, Banque de Djibouti, BCIMR, SGTD, SIDEM, Gulf of Aden Security, COMESA
- Secteurs dominants : BTP (ports, infrastructure), Logistique & Portuaire, Hôtellerie (Kempinski, Sheraton, Djibouti Palace), Sécurité, Santé (CHN, hôpitaux), Administration
- Nationalités courantes : Djiboutienne, Éthiopienne, Somalienne, Française, Yéménite
- Langues : Français, Arabe, Somali, Afar, Anglais

Analyse ce CV et extrais les informations :

Contenu CV :
{{CV_TEXT}}

Réponds UNIQUEMENT avec un objet JSON valide (pas de texte avant ou après) avec ces champs exacts :
{
  "fullName": "prénom et nom complet ou null",
  "email": "adresse@email.com ou null",
  "phone": "numéro de téléphone ou null",
  "whatsapp": "numéro whatsapp si différent ou null",
  "nationality": "ex: Djiboutienne, Éthiopienne, Française ou null",
  "gender": "M ou F ou null",
  "address": "ville ou quartier (ex: Balbala, Arhiba, Plateau, Ali Sabieh) ou null",
  "education": "dernier diplôme obtenu ou null",
  "experience": "nombre d'années d'expérience (chiffre entier seul) ou 0",
  "jobTitle": "poste actuel ou recherché ou null",
  "sector": "un seul parmi: btp, logistics, hospitality, healthcare, admin, commerce, security",
  "languages": "langues séparées par virgule (Français, Arabe, Somali, Afar, Anglais…) ou null",
  "skills": "compétences clés séparées par virgule ou null",
  "availability": "immediate ou 1_week ou 1_month ou 3_months",
  "summary": "résumé professionnel 2-3 phrases ou null"
}`;
  const [cvScanPrompt, setCvScanPrompt] = useState(DEFAULT_CV_SCAN_PROMPT);
  const [savingCvPrompt, setSavingCvPrompt] = useState(false);
  const [savedCvPrompt, setSavedCvPrompt]   = useState(false);

  // ── Sous-onglet actif dans les Réglages ──
  const [settingsTab, setSettingsTab] = useState<'company' | 'candidates' | 'matching' | 'lists' | 'system'>('company');

  // Suppression de la ligne : const t = (translations as any)[lang];
  // t est maintenant reçu directement des props

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setLoading(true);
        try {
          const adminDocRef = doc(db, 'admins', u.uid);
          const adminSnap = await getDoc(adminDocRef);
          
          let isAuthorized = adminSnap.exists();

          // BUG 6 FIX: Check if any owner exists in Firestore
          // If no owner exists at all, first admin to connect becomes owner
          if (!isAuthorized) {
            const ownerQuery = await getDocs(
              query(collection(db, 'admins'), where('role', '==', 'owner'))
            );
            if (ownerQuery.empty) {
              // No owner exists yet — make this user the owner
              await setDoc(adminDocRef, { 
                uid: u.uid,
                email: u.email, 
                role: 'owner',
                displayName: u.displayName || u.email,
                createdAt: serverTimestamp() 
              });
              isAuthorized = true;
            }
          }

          if (isAuthorized) {
            setIsAdmin(true);
            try {
              const seedIfEmpty = async (coll: string, data: any[]) => {
                const ref = collection(db, coll);
                const snap = await getDocs(ref);
                if (snap.empty) {
                  for (const item of data) {
                    await addDoc(ref, { ...item, createdAt: serverTimestamp() });
                  }
                }
              };

              await seedIfEmpty('jobs', [
                { title: 'Chef de Chantier Senior', companyName: 'Colas Djibouti', key: 'job1', sector: 'btp', location: 'Djibouti Ville', type: 'CDI', tags: ['Urgent'], company: '🏢', status: 'active' },
                { title: "Agent d'Exploitation Portuaire", companyName: 'SGTD', key: 'job2', sector: 'logistics', location: 'Doraleh', type: 'Intérim', tags: ['Pénible'], company: '🚢', status: 'active' },
                { title: 'Réceptionniste Bilingue', companyName: 'Kempinski', key: 'job3', sector: 'hospitality', location: 'Djibouti Ville', type: 'CDI', tags: ['Nouveau'], company: '🏨', status: 'active' },
                { title: 'Infirmier de Santé au Travail', companyName: 'GHI', key: 'job4', sector: 'healthcare', location: 'Balbala', type: 'CDD', tags: [], company: '🏥', status: 'active' },
                { title: 'Comptable Confirmé', companyName: 'AEC', key: 'job5', sector: 'admin', location: 'Djibouti Ville', type: 'CDI', tags: ['Urgent'], company: '📊', status: 'active' },
              ]);
            } catch (seedError) {
              console.warn("Seeding skip:", seedError);
            }
          } else {
            setIsAdmin(false);
          }
        } catch (err) {
          console.error("Erreur d'authentification admin:", err);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const qJobs = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubJobs = onSnapshot(qJobs, (snap) => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qApps = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
    const unsubApps = onSnapshot(qApps, (snap) => setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qNeeds = query(collection(db, 'needs'), orderBy('createdAt', 'desc'));
    const unsubNeeds = onSnapshot(qNeeds, (snap) => setNeeds(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qDiag = query(collection(db, 'diagnostics'), orderBy('createdAt', 'desc'));
    const unsubDiag = onSnapshot(qDiag, (snap) => setDiagnostics(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qRecruiters = query(collection(db, 'recruiters'), orderBy('createdAt', 'desc'));
    const unsubRecruiters = onSnapshot(qRecruiters, (snap) => setRecruiters(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snap) => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qNotifs = query(collection(db, 'notifications'), where('userId', '==', 'admin'), orderBy('createdAt', 'desc'));
    const unsubNotifs = onSnapshot(qNotifs, (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubJobs(); unsubApps(); unsubRecruiters(); unsubNeeds(); unsubDiag(); unsubUsers(); unsubNotifs(); };
  }, [isAdmin]);

  // ── Charger les options dynamiques (ouvert à tous, pas besoin d'être admin) ──
  useEffect(() => {
    const collections = [
      { name: 'settings_sectors', setter: setDynSectors },
      { name: 'settings_contracts', setter: setDynContracts },
      { name: 'settings_educations', setter: setDynEducations },
      { name: 'settings_availabilities', setter: setDynAvailabilities },
      { name: 'settings_urgencies', setter: setDynUrgencies },
      { name: 'settings_salaries', setter: setDynSalaries },
      { name: 'settings_nationalities', setter: setDynNationalities },
      { name: 'settings_languages', setter: setDynLanguages },
    ];
    let resolved = 0;
    const unsubs = collections.map(({ name, setter }) =>
      onSnapshot(query(collection(db, name), orderBy('order', 'asc')), (snap) => {
        setter(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        resolved++;
        if (resolved >= collections.length) setOptionsLoading(false);
      })
    );
    // Seed des données par défaut si vide
    const seedDefaults = async () => {
      const defaults: Record<string, {value:string; label:string; order:number}[]> = {
        settings_sectors: [
          { value: 'btp', label: 'BTP & Génie Civil', order: 1 },
          { value: 'logistics', label: 'Logistique & Port', order: 2 },
          { value: 'hospitality', label: 'Hôtellerie & Restauration', order: 3 },
          { value: 'security', label: 'Sécurité & Gardiennage', order: 4 },
          { value: 'healthcare', label: 'Santé & Social', order: 5 },
          { value: 'admin', label: 'Administration & Finance', order: 6 },
          { value: 'catering', label: 'Restauration & Traiteur', order: 7 },
          { value: 'commerce', label: 'Commerce & Distribution', order: 8 },
          { value: 'non-precise', label: 'Non précisé', order: 99 },
        ],
        settings_contracts: [
          { value: 'CDI', label: 'CDI', order: 1 },
          { value: 'CDD', label: 'CDD', order: 2 },
          { value: 'Intérim', label: 'Intérim', order: 3 },
          { value: 'Audit', label: 'Audit / Conseil', order: 4 },
        ],
        settings_educations: [
          { value: 'Sans diplôme', label: t.admin.sansD || 'No diploma', order: 1 },
          { value: 'BEP / CAP', label: 'BEP / CAP', order: 2 },
          { value: 'Baccalauréat', label: 'Baccalauréat', order: 3 },
          { value: 'BTS / DUT', label: 'BTS / DUT', order: 4 },
          { value: 'Licence / Bachelor', label: 'Licence / Bachelor', order: 5 },
          { value: 'Master / Ingénieur', label: 'Master / Ingénieur', order: 6 },
          { value: 'Doctorat', label: 'Doctorat', order: 7 },
        ],
        settings_availabilities: [
          { value: 'Immédiate', label: 'Immédiate', order: 1 },
          { value: 'Dans 1 mois', label: 'Dans 1 mois', order: 2 },
          { value: 'Dans 2 mois', label: 'Dans 2 mois', order: 3 },
          { value: 'Dans 3 mois', label: 'Dans 3 mois', order: 4 },
          { value: 'En poste (à définir)', label: 'En poste (à définir)', order: 5 },
        ],
        settings_urgencies: [
          { value: 'low', label: 'Basse', order: 1 },
          { value: 'medium', label: 'Moyenne', order: 2 },
          { value: 'high', label: 'Haute', order: 3 },
        ],
        settings_salaries: [
          { value: '71000-80000', label: '71 000 - 80 000 DJF', order: 1 },
          { value: '80000-110000', label: '80 000 - 110 000 DJF', order: 2 },
          { value: '110000-140000', label: '110 000 - 140 000 DJF', order: 3 },
          { value: '140000-170000', label: '140 000 - 170 000 DJF', order: 4 },
          { value: '170000-205000', label: '170 000 - 205 000 DJF', order: 5 },
        ],
        settings_nationalities: [
          { value: 'Djiboutienne', label: 'Djiboutienne', order: 1 },
          { value: 'Éthiopienne', label: 'Éthiopienne', order: 2 },
          { value: 'Somalienne', label: 'Somalienne', order: 3 },
          { value: 'Érythréenne', label: 'Érythréenne', order: 4 },
          { value: 'Française', label: 'Française', order: 5 },
          { value: 'Américaine', label: 'Américaine', order: 6 },
          { value: 'Kenyane', label: 'Kenyane', order: 7 },
          { value: 'Réfugié(e)', label: 'Réfugié(e)', order: 8 },
          { value: 'Autre', label: 'Autre', order: 9 },
        ],
        settings_languages: [
          { value: 'Français', label: 'Français', order: 1 },
          { value: 'Arabe', label: 'Arabe', order: 2 },
          { value: 'Somali', label: 'Somali', order: 3 },
          { value: 'Afar', label: 'Afar', order: 4 },
          { value: 'Anglais', label: 'Anglais', order: 5 },
          { value: 'Amharique', label: 'Amharique', order: 6 },
          { value: 'Oromo', label: 'Oromo', order: 7 },
        ],
      };
      for (const [colName, items] of Object.entries(defaults)) {
        const snap = await getDocs(collection(db, colName));
        if (snap.empty) {
          for (const item of items) {
            await addDoc(collection(db, colName), { ...item, createdAt: serverTimestamp() });
          }
        }
      }
    };
    seedDefaults();

    // ── Charger les documents requis depuis Firestore ──
    getDoc(doc(db, 'settings_company', 'required_docs')).then(snap => {
      if (snap.exists()) {
        const saved = snap.data().docs;
        if (Array.isArray(saved)) setRequiredDocs(saved);
      }
    }).catch(() => {});

    // ── Charger les pondérations de matching depuis Firestore ──
    getDoc(doc(db, 'settings_matching', 'config')).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setMatchingWeights(prev => ({
          algo: { ...prev.algo, ...(data.algo || {}) },
          manual: { ...prev.manual, ...(data.manual || {}) },
        }));
        if (data.cvScanPrompt) setCvScanPrompt(data.cvScanPrompt);
      }
    }).catch(() => {});

    // ── Messages (général + demandes de modification) ──
    // Note : ce listener démarre sans guard isAdmin (useEffect au montage).
    // Le handler d'erreur absorbe le permission-denied transitoire qui survient
    // pendant la connexion Phone Auth avant que le token soit propagé côté Firestore.
    const unsubMsgs = onSnapshot(
      query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
      snap => setAdminMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => { if (err.code !== 'permission-denied') console.warn('messages listener:', err); }
    );
    unsubs.push(unsubMsgs);

    return () => unsubs.forEach(u => u());
  }, []);

  // ── Sauvegarder les documents requis ──
  const saveRequiredDocs = async () => {
    setSavingDocs(true);
    await setDoc(doc(db, 'settings_company', 'required_docs'), {
      docs: requiredDocs,
      updatedAt: serverTimestamp(),
    });
    setSavingDocs(false);
    setSavedDocs(true);
    setTimeout(() => setSavedDocs(false), 2500);
  };

  // ── Sauvegarder les pondérations de matching ──
  const saveMatchingWeights = async () => {
    setSavingMatching(true);
    await setDoc(doc(db, 'settings_matching', 'config'), {
      ...matchingWeights,
      cvScanPrompt,
      updatedAt: serverTimestamp(),
    });
    setSavingMatching(false);
    setSavedMatching(true);
    setTimeout(() => setSavedMatching(false), 2500);
  };

  // ── Sauvegarder le prompt scan CV indépendamment ──
  const saveCvScanPrompt = async () => {
    setSavingCvPrompt(true);
    await setDoc(doc(db, 'settings_matching', 'config'), {
      ...matchingWeights,
      cvScanPrompt,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setSavingCvPrompt(false);
    setSavedCvPrompt(true);
    setTimeout(() => setSavedCvPrompt(false), 2500);
  };

  // ── Mettre à jour un poids (algo ou manuel) ──
  const updateMatchingWeight = (group: 'algo' | 'manual', key: string, value: number) => {
    setMatchingWeights(prev => ({
      ...prev,
      [group]: { ...prev[group], [key]: value },
    }));
  };

  // ── Connexion email + mot de passe ──
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err: any) {
      const codes: Record<string, string> = {
        'auth/user-not-found':    'Aucun compte trouvé avec cet email.',
        'auth/wrong-password':    'Mot de passe incorrect.',
        'auth/invalid-credential':'Email ou mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
        'auth/invalid-email':     'Adresse email invalide.',
      };
      setLoginError(codes[err.code] || 'Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Réinitialisation mot de passe admin ──
  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      setResetSent(true);
    } catch (err: any) {
      setLoginError(err.code === 'auth/user-not-found' ? 'Aucun compte avec cet email.' : "Erreur. Vérifiez l'email.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Google (conservé en fallback) ──
  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const lgOut = () => signOut(auth);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const jobData = {
      ...newJob,
      tags: selectedSkillsJob.length > 0
        ? selectedSkillsJob
        : typeof newJob.tags === 'string' ? newJob.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : newJob.tags,
      skills: selectedSkillsJob.join(', '),
      updatedAt: serverTimestamp(),
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    if (editingJob) {
      await updateDoc(doc(db, 'jobs', editingJob.id), jobData);
    } else {
      await addDoc(collection(db, 'jobs'), {
        ...jobData,
        createdAt: serverTimestamp()
      });
    }
    
    setShowAddJob(false);
    setEditingJob(null);
    setNewJob({ title: '', companyName: '', sector: 'btp', location: 'Djibouti', type: 'CDI', company: '🏢', tags: 'Urgent', profileCount: 1, expRequired: 3, urgency: 'medium', deadline: '', diplomaRequired: '', salaryRange: '', description: '', skills: '', selectedRecruiterId: '' });
    setSelectedSkillsJob([]); setSkillInputJob('');
  }

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingApp(true);
    try {
      // Récupérer le titre du poste depuis l'offre sélectionnée si jobId fourni
      const selectedJob = jobs.find((j: any) => j.id === newApplication.jobId);
      const jobTitle = selectedJob?.title || newApplication.jobTitle;
      const sector   = selectedJob?.sector || newApplication.sector;

      await addDoc(collection(db, 'applications'), {
        ...newApplication,
        jobTitle,
        sector,
        jobId:     newApplication.jobId || null,
        companyName: selectedJob?.companyName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.email || 'admin',
        source:    'manual',
      });
      setShowAddApplication(false);
      setNewApplication({ fullName: '', email: '', phone: '', jobId: '', jobTitle: '', sector: 'btp', experience: '', education: '', skills: '', availability: 'Immédiate', nationality: 'Djiboutienne', status: 'new', notes: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleEditJob = (job: any) => {
    setEditingJob(job);
    setNewJob({
      title: job.title,
      companyName: job.companyName || '',
      sector: job.sector,
      location: job.location || 'Djibouti',
      type: job.type || 'CDI',
      company: job.company || '🏢',
      tags: Array.isArray(job.tags) ? job.tags.join(', ') : (job.tags || ''),
      profileCount: job.profileCount || 1,
      expRequired: job.expRequired ?? 3,
      urgency: job.urgency || 'medium',
      deadline: job.deadline || '',
      diplomaRequired: job.diplomaRequired || '',
      salaryRange: job.salaryRange || '',
      description: job.description || '',
      skills: job.skills || '',
      selectedRecruiterId: job.selectedRecruiterId || '',
    });
    if (job.skills) setSelectedSkillsJob(job.skills.split(',').map((s: string) => s.trim()).filter(Boolean));
    setShowAddJob(true);
  };

  const handleDeleteJob = async (id: string) => {
    if (confirm(t.admin.confirmDelete || t.admin.confirmDelete || 'Delete this job?')) {
      await deleteDoc(doc(db, 'jobs', id));
    }
  };

  const updateStatus = async (coll: string, id: string, status: string, extraData?: any) => {
    await updateDoc(doc(db, coll, id), { status, updatedAt: serverTimestamp(), ...extraData });
  };

  // Update an application's status AND notify the candidate in real-time
  const updateApplicationStatusWithNotif = async (app: any, newStatus: string) => {
    await updateStatus('applications', app.id, newStatus);
    if (app.userId || app.candidateUid || app.firebaseUid) {
      const candidateUid = app.userId || app.candidateUid || app.firebaseUid;
      const statusLabels: Record<string, string> = {
        new: 'Votre candidature a été reçue',
        reviewing: 'Votre candidature est en cours d\'étude',
        interview: 'Vous êtes invité(e) à un entretien',
        hired: 'Bonne nouvelle, votre candidature a été acceptée',
        rejected: 'Votre candidature n\'a pas été retenue',
      };
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: candidateUid,
          type: 'application_status',
          title: 'Mise à jour de candidature',
          message: `${statusLabels[newStatus] || 'Statut mis à jour'} — ${app.jobTitle || 'votre candidature'}`,
          applicationId: app.id,
          status: newStatus,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Candidate notification failed:', e);
      }

      // ── Bridge: when a direct job application becomes serious (interview/hired),
      // auto-link the candidate into the originating need's candidatePipeline so
      // recruiters who created that need can track the same candidate via MatchingPanel.
      if (newStatus === 'interview' || newStatus === 'hired') {
        try {
          const sourceJob = jobs.find(j => j.id === app.jobId);
          const needId = sourceJob?.fromNeedId;
          if (needId) {
            const needSnap = await getDoc(doc(db, 'needs', needId));
            if (needSnap.exists()) {
              const needData = needSnap.data();
              const pipeline: any[] = Array.isArray(needData?.candidatePipeline) ? needData.candidatePipeline : [];
              const already = pipeline.find(e => e.candidateId === candidateUid);
              const pipelineStep = newStatus === 'hired' ? 'placed' : 'interview_planned';
              if (already) {
                const updatedPipeline = pipeline.map(e =>
                  e.candidateId === candidateUid ? { ...e, step: pipelineStep, ...(newStatus === 'hired' ? { placedAt: new Date().toISOString() } : {}) } : e
                );
                await updateDoc(doc(db, 'needs', needId), { candidatePipeline: updatedPipeline, linkedCandidates: updatedPipeline.map(e => e.candidateId) });
              } else {
                const newEntry = {
                  candidateId: candidateUid,
                  step: pipelineStep,
                  linkedMode: 'manual' as const,
                  linkedAt: new Date().toISOString(),
                  cvSentAt: new Date().toISOString(),
                  notes: 'Auto-lié depuis une candidature directe (offre publique)',
                  ...(newStatus === 'hired' ? { placedAt: new Date().toISOString() } : {}),
                };
                const updatedPipeline = [...pipeline, newEntry];
                await updateDoc(doc(db, 'needs', needId), { candidatePipeline: updatedPipeline, linkedCandidates: updatedPipeline.map(e => e.candidateId) });
              }
            }
          }
        } catch (e) {
          console.warn('Pipeline auto-link from application failed:', e);
        }
      }
    }
  };

  const handleValidateNeed = async (need: any) => {
    await updateDoc(doc(db, 'needs', need.id), {
      status: 'validated',
      validatedAt: serverTimestamp(),
      validatedBy: user?.email || 'admin',
    });
    setSelectedNeed((prev: any) => prev ? { ...prev, status: 'validated' } : null);
  };

  const handleRejectNeed = async (need: any) => {
    if (!confirm('{t.admin.confirmRejectDemand}')) return;
    await updateDoc(doc(db, 'needs', need.id), {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
      rejectedBy: user?.email || 'admin',
    });
    setSelectedNeed(null);
  };

  // Publier une demande comme offre publique
  const handlePublishNeedAsOffer = async (need: any) => {
    setPublishingAsOffer(true);
    setPublishedOfferId(null);
    try {
      // Créer l'offre dans la collection jobs à partir des données de la demande
      const offerRef = await addDoc(collection(db, 'jobs'), {
        title: need.jobTitle || 'Poste à pourvoir',
        companyName: need.companyName || 'Vedior GM',
        sector: need.sector || 'btp',
        location: need.location || 'Djibouti',
        type: need.needType || 'CDI',
        company: '🏢',
        tags: [
          need.urgency === 'high' ? 'Urgent' : null,
          need.salaryRange ? `💰 ${need.salaryRange}` : null,
          need.diplomaRequired ? `🎓 ${need.diplomaRequired}` : null,
        ].filter(Boolean).join(', ') || 'Offre active',
        description: need.description || '',
        skills: need.skills || '',
        expRequired: need.expRequired || 0,
        profileCount: need.profileCount || 1,
        diplomaRequired: need.diplomaRequired || '',
        salaryRange: need.salaryRange || '',
        status: 'active',
        fromNeedId: need.id, // lien vers la demande d'origine
        fromCompany: need.companyName || '',
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        expiresAt: null,
      });

      // Marquer la demande comme ayant généré une offre
      await updateDoc(doc(db, 'needs', need.id), {
        status: 'matching',
        validatedAt: serverTimestamp(),
        validatedBy: user?.email || 'admin',
        publishedAsOffer: true,
        offerId: offerRef.id,
      });

      setPublishedOfferId(offerRef.id);
      setSelectedNeed((prev: any) => prev ? { ...prev, status: 'matching', publishedAsOffer: true, offerId: offerRef.id } : null);
    } catch (err) {
      console.error('Erreur publication offre:', err);
      alert('{t.admin.publishError}');
    } finally {
      setPublishingAsOffer(false);
    }
  };

  // Validate recruiter: update recruiters + users collections
  const handleValidateRecruiter = async (rec: any) => {
    try {
      // 1. Update recruiters collection
      await updateDoc(doc(db, 'recruiters', rec.id), {
        status: 'active',
        validatedAt: serverTimestamp(),
        validatedBy: user?.email || 'admin',
      });

      // 2. Update users collection by email match
      const qUser = query(collection(db, 'users'), where('email', '==', rec.email));
      const snap = await getDocs(qUser);
      if (!snap.empty) {
        await updateDoc(doc(db, 'users', snap.docs[0].id), {
          status: 'active',
          validatedAt: serverTimestamp(),
        });
      }

      // 3. Also update by firebaseUid if available
      if (rec.userId || rec.firebaseUid) {
        const uid = rec.userId || rec.firebaseUid;
        try {
          await updateDoc(doc(db, 'users', uid), {
            status: 'active',
            validatedAt: serverTimestamp(),
          });
        } catch (e) { /* doc may not exist by uid */ }
      }

      console.log('Recruiter validated successfully!');
    } catch (err) {
      console.error('Validation error:', err);
    }
  };

  // Reject recruiter
  const handleRejectRecruiter = async (rec: any) => {
    if (!confirm('{t.admin.confirmRejectRecruiter}')) return;
    await updateDoc(doc(db, 'recruiters', rec.id), {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
    });
    const qUser = query(collection(db, 'users'), where('email', '==', rec.email));
    const snap = await getDocs(qUser);
    if (!snap.empty) {
      await updateDoc(doc(db, 'users', snap.docs[0].id), { status: 'rejected' });
    }
  };

  // Renouveler une offre pour 30 jours supplémentaires (Q35)
  const addSkillJob = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !selectedSkillsJob.includes(trimmed)) {
      const updated = [...selectedSkillsJob, trimmed];
      setSelectedSkillsJob(updated);
    }
    setSkillInputJob('');
  };
  const removeSkillJob = (skill: string) => {
    setSelectedSkillsJob(selectedSkillsJob.filter(s => s !== skill));
  };

  const handleRenewJob = async (jobId: string) => {
    const newExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await updateDoc(doc(db, 'jobs', jobId), { expiresAt: newExp });
  };

  // ── Scan CV avec Gemini Vision ──────────────────────────────
  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        fullName: editingUser.fullName || editingUser.displayName || '',
        displayName: editingUser.displayName || editingUser.fullName || '',
        phone: editingUser.phone || '',
        whatsapp: editingUser.whatsapp || '',
        nationality: editingUser.nationality || '',
        education: editingUser.education || '',
        experience: editingUser.experience || '',
        languages: editingUser.languages || '',
        address: editingUser.address || '',
        sector: editingUser.sector || editingUser.candidateSector || '',
        jobTitle: editingUser.jobTitle || '',
        skills: editingUser.skills || '',
        availability: editingUser.availability || '',
        companyName: editingUser.companyName || '',
        contactName: editingUser.contactName || '',
        website: editingUser.website || '',
        updatedAt: serverTimestamp(),
      });
      setSelectedUser(editingUser);
      setEditingUser(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingUser(false);
    }
  };

  // ── Extract candidate photo from CV image (top-left zone) ──
  const extractCvPhoto = async (cvDataUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const W = img.width, H = img.height;

          // ── Score de contenu d'une zone : richesse chromatique + texture ──
          const scoreZone = (x: number, y: number, size: number): number => {
            const SAMPLE = Math.min(size, 80);
            const c = document.createElement('canvas');
            c.width = SAMPLE; c.height = SAMPLE;
            const cx = c.getContext('2d')!;
            cx.drawImage(img, x, y, size, size, 0, 0, SAMPLE, SAMPLE);
            const d = cx.getImageData(0, 0, SAMPLE, SAMPLE).data;
            let colored = 0, skinTone = 0, edgeVariance = 0;
            let prevLum = -1;
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i], g = d[i+1], b = d[i+2];
              const lum = (r + g + b) / 3;
              // Pixel non-blanc
              if (r < 235 || g < 235 || b < 235) colored++;
              // Teint de peau élargi (couvre peaux sombres & claires)
              if (r > 60 && r < 250 && g > 40 && g < 220 && b > 20 && b < 200
                  && r > g && r > b && (r - b) > 8) skinTone++;
              // Variance locale (texture = vrai visage, pas fond uni)
              if (prevLum >= 0) edgeVariance += Math.abs(lum - prevLum);
              prevLum = lum;
            }
            const total = d.length / 4;
            const textureFactor = Math.min(edgeVariance / (total * 30), 1);
            return (colored / total) * 0.5 + (skinTone / total) * 0.35 + textureFactor * 0.15;
          };

          // ── Grille fine 4×4 : top 40% du document ──
          const photoH = Math.round(H * 0.40);
          const photoSize = Math.round(W * 0.24);

          let bestScore = 0;
          let bestX = 0, bestY = 0;

          for (let gy = 0; gy < 4; gy++) {
            for (let gx = 0; gx < 4; gx++) {
              const x = Math.round(gx * (W - photoSize) / 3);
              const y = Math.round(gy * (photoH - photoSize) / 3);
              if (x < 0 || y < 0 || x + photoSize > W || y + photoSize > H) continue;
              const s = scoreZone(x, y, photoSize);
              if (s > bestScore) { bestScore = s; bestX = x; bestY = y; }
            }
          }

          // Seuil : si score trop bas = pas de vraie photo détectée
          if (bestScore < 0.07) { resolve(null); return; }

          // ── Padding pour ne pas couper le visage ──
          const PADDING = Math.round(photoSize * 0.08);
          const srcX = Math.max(0, bestX - PADDING);
          const srcY = Math.max(0, bestY - PADDING);
          const srcSize = Math.min(photoSize + PADDING * 2, Math.min(W - srcX, H - srcY));

          // ── Recadrage haute résolution 400px avec interpolation ──
          const OUTPUT = 400;
          const out = document.createElement('canvas');
          out.width = OUTPUT; out.height = OUTPUT;
          const ctx = out.getContext('2d')!;
          (ctx as any).imageSmoothingEnabled = true;
          (ctx as any).imageSmoothingQuality = 'high';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, OUTPUT, OUTPUT);
          ctx.beginPath();
          ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);

          resolve(out.toDataURL('image/jpeg', 0.97));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = cvDataUrl;
    });
  };

  const buildCvPrompt = () => {
    return `Tu es un expert RH spécialisé dans l'extraction de données de CV pour le marché de l'emploi de Djibouti.

CONTEXTE LOCAL :
- Entreprises connues : Port de Djibouti, DCT, Djibouti Telecom, ONEAD, EDD, Kempinski, Sheraton, CHN, SGTD, PAID, Groupe Abdourahman Boreh
- Établissements scolaires : Université de Djibouti, IUT, ISERST, Lycée français Saint-Exupéry
- Langues parlées : Français, Arabe, Somali, Afar, Anglais, Oromo
- Quartiers : Balbala, Arhiba, Plateau du Serpent, Ambouli, Ali Sabieh, Tadjoura, Obock, Dikhil

SECTEURS VALIDES — utilise EXACTEMENT l'un de ces mots clés :
"btp" → BTP, Construction, Génie Civil, Architecture, Travaux Publics, Maçonnerie, Électricité bâtiment
"logistics" → Logistique, Transport, Port, Maritime, Douane, Supply Chain, Fret, Manutention
"hospitality" → Hôtellerie (hôtel/réception), Tourisme, Événementiel, Room service
"security" → Sécurité, Gardiennage, Militaire, Police, Surveillance, Agent de sécurité
"healthcare" → Santé, Médecine, Pharmacie, Infirmerie, Soins infirmiers, Médical
"admin" → Administration, Finance, Comptabilité, RH, Juridique, Marketing (PAS Microsoft Office seul)
"commerce" → Commerce, Vente terrain, Import/Export, Représentant commercial
"catering" → Cuisine professionnelle, Restauration collective, Catering industriel

⚠️ RÈGLE CRITIQUE pour le secteur :
- Microsoft Office / Excel / Word / bureautique = COMPÉTENCES, PAS un secteur → mettre dans skills
- Si le candidat n'a NI expérience professionnelle NI diplôme spécifique → sector = null
- Ne jamais deviner le secteur sans indice fort dans le CV (titre de poste, formation métier, employeurs)
- Un candidat sans expérience et sans formation métier = sector null

RÈGLES D'EXTRACTION :
1. fullName : nom complet exact, corrige les mots collés (AhmedAli → Ahmed Ali)
2. email : adresse email valide uniquement, sinon null
3. phone : numéro avec indicatif (+253 pour Djibouti, +33 France, etc.)
4. whatsapp : si différent du téléphone, sinon null
5. nationality : nationalité déclarée (ex: "Djiboutienne", "Française", "Éthiopienne")
6. gender : "M" pour masculin, "F" pour féminin, null si inconnu
7. address : ville ou quartier (ex: "Balbala, Djibouti")
8. education : retourne EXACTEMENT l'une de ces valeurs (copie exacte obligatoire) :
   "Sans diplôme" → si aucun diplôme mentionné, No Diploma, autodidacte
   "BEP / CAP" → si Vocational Diploma, BEP, CAP, Certificat professionnel
   "Baccalauréat" → si High School Diploma, Bac, Terminale, A-Level, Secondary
   "BTS / DUT" → si Technical Degree, BTS, DUT, HND, Bac+2
   "Licence / Bachelor" → si Bachelor's Degree, Licence, Bac+3, Undergraduate
   "Master / Ingénieur" → si Master's, Engineering Degree, MBA, Bac+5, Grande École
   "Doctorat" → si PhD, Doctorate, Doctorat, Dr.
   NE JAMAIS retourner null — si aucun diplôme visible → "Sans diplôme"
9. experience : nombre TOTAL d'années d'expérience professionnelle (nombre entier)
10. jobTitle : intitulé du poste actuel ou recherché
11. sector : retourne EXACTEMENT l'une de ces valeurs :
    "btp" → BTP, Construction, Génie Civil, Building, Civil Engineering, Architecture
    "logistics" → Logistique, Transport, Port, Maritime, Supply Chain, Douane, Customs
    "hospitality" → Hôtellerie, Restauration, Tourisme, Hotel, Tourism, Reception
    "security" → Sécurité, Gardiennage, Military, Police, Guard, Surveillance
    "healthcare" → Santé, Médecine, Pharmacie, Nursing, Medical, Soins
    "admin" → Administration, Finance, Comptabilité, RH, Marketing, HR, Accounting
    "commerce" → Commerce, Vente, Import/Export, Sales, Trade, Distribution
    "catering" → Catering, Cuisine, Food Service, Restauration collective
    "non-precise" → si profil généraliste, débutant, ou aucun secteur identifiable
12. languages : liste séparée par virgules (ex: "Français, Arabe, Somali")
13. skills : compétences clés séparées par virgules
14. availability : "immediate" si disponible maintenant, "1 month", "3 months" sinon
15. summary : résumé professionnel en 1-2 phrases maximum

IMPORTANT : Réponds UNIQUEMENT avec le JSON ci-dessous, aucun texte avant ou après, aucun markdown :
{"fullName":null,"email":null,"phone":null,"whatsapp":null,"nationality":null,"gender":null,"address":null,"education":null,"experience":0,"jobTitle":null,"sector":"admin","languages":null,"skills":null,"availability":"immediate","summary":null}`;
  };

    const parseGroqJson = (raw: string): any => {
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { return JSON.parse(match[0]); } catch { return null; } }
      return null;
    }
  };

  // ── Nettoyage post-OCR des données extraites ──
  const cleanExtracted = (data: any): any => {
    if (!data) return data;
    const out = { ...data };

    // 1. Nom : corriger les mots collés après tiret (ABDOUL-AZIZABDALLAH → ABDOUL-AZIZ ABDALLAH)
    if (out.fullName) {
      // Prénoms djiboutiens / arabes courants pour détecter le bon point de coupure
      const KNOWN_FIRST_NAMES = [
        'ABDOUL','ABDEL','ABDI','ABDO','ABDOU','ABDIRAHMAN','ABDIRASHID',
        'AHMED','AHMEDOU','ALI','AMIR','ADEN',
        'AZIZ','AZIZA','AZIZOU',
        'HASSAN','HASSEN','HOUSSEIN','HODAN',
        'IBRAHIM','ISMAIL','ISMAEL',
        'LIBAN','LOULA',
        'MOHAMED','MOHAMOUD','MOUSSA',
        'NASSER','NOUR',
        'OMAR','OSMAN',
        'RACHID','RASHID',
        'SAEED','SAID','SALEH','SAMIRA','SIRAD','SOULEIMAN',
        'WARFA','WARSAME',
        'YOUSSOUF','YUSUF',
      ];

      const splitCollapsed = (word: string): string => {
        for (const prefix of KNOWN_FIRST_NAMES) {
          if (word.startsWith(prefix) && word.length > prefix.length + 1) {
            return prefix + ' ' + word.slice(prefix.length);
          }
        }
        // Fallback heuristique : couper à 4-5 chars si le reste fait >= 4 chars
        for (const cut of [4, 5, 3, 6]) {
          if (word.length >= cut + 4) {
            return word.slice(0, cut) + ' ' + word.slice(cut);
          }
        }
        return word;
      };

      out.fullName = out.fullName
        // Cas 1 : séquence-maj TIRET séquence-maj-collée (ABDOUL-AZIZABDALLAH)
        .replace(/([A-Z]{2,})-([A-Z]{7,})/g, (m: string, before: string, after: string) => {
          return `${before}-${splitCollapsed(after)}`;
        })
        // Cas 2 : tiret + espace + séquence collée (ABDOUL- AZIZABDALLAH)
        .replace(/-\s+([A-Z]{7,})/g, (m: string, after: string) => {
          return `-${splitCollapsed(after)}`;
        })
        // Nettoyer espaces multiples
        .replace(/\s+/g, ' ')
        .trim();
    }

    // 2. Téléphone : nettoyer artefacts OCR + normaliser format djiboutien
    if (out.phone) {
      // Remplacer caractères OCR courants + supprimer TOUS les espaces avant d'extraire les chiffres
      let phone = out.phone
        .replace(/[lLiI|](?=\d)/g, '1')
        .replace(/[lLiI|]$/g, '1')      // chiffre OCR en fin de chaîne
        .replace(/[oO](?=\d)/g, '0')
        .replace(/\s/g, '')              // supprimer TOUS les espaces (ex: "7731920 1" → "77319201")
        .replace(/[^\d\+\-\.]/g, '');

      // Extraire uniquement les chiffres pour retravailler
      const digits = phone.replace(/[^\d]/g, '');

      // Numéro djiboutien 00253XXXXXXXX (12 chiffres) → +253 XX XX XX XX
      if (digits.startsWith('00253') && digits.length >= 12) {
        const local = digits.slice(5); // ex: 77319201
        out.phone = `+253 ${local.slice(0,2)} ${local.slice(2,4)} ${local.slice(4,6)} ${local.slice(6)}`.trim();
      }
      // Numéro djiboutien +253XXXXXXXX
      else if (digits.startsWith('253') && digits.length >= 11) {
        const local = digits.slice(3);
        out.phone = `+253 ${local.slice(0,2)} ${local.slice(2,4)} ${local.slice(4,6)} ${local.slice(6)}`.trim();
      }
      // Numéro local djiboutien 77XXXXXX (8 chiffres)
      else if (/^7[7-9]/.test(digits) && digits.length === 8) {
        out.phone = `+253 ${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4,6)} ${digits.slice(6)}`;
      }
      // Sinon conserver proprement avec tirets supprimés doublons
      else {
        out.phone = phone.replace(/-+/g, '-').trim();
      }
    }

    // Même normalisation pour whatsapp si présent
    if (out.whatsapp) {
      const digits = out.whatsapp.replace(/[^\d]/g, '');
      if (digits.startsWith('00253') && digits.length >= 12) {
        const local = digits.slice(5);
        out.whatsapp = `+253 ${local.slice(0,2)} ${local.slice(2,4)} ${local.slice(4,6)} ${local.slice(6)}`.trim();
      } else if (digits.startsWith('253') && digits.length >= 11) {
        const local = digits.slice(3);
        out.whatsapp = `+253 ${local.slice(0,2)} ${local.slice(2,4)} ${local.slice(4,6)} ${local.slice(6)}`.trim();
      }
    }

    // 3. Secteur : ne jamais laisser une valeur hors liste + inférence si pas d'expérience
    const validSectors = ['btp','logistics','hospitality','security','healthcare','admin','commerce','catering','non-precise'];
    if (out.sector && !validSectors.includes(out.sector.toLowerCase())) {
      out.sector = null;
    }

    // Inférence secteur : uniquement depuis mots-clés FORTS (métiers, pas outils génériques)
    // Microsoft Office, Excel, Word = skills bureautiques universelles → ne déterminent PAS le secteur
    if (!out.sector) {
      // Texte à analyser : jobTitle et education sont les plus fiables, skills en dernier
      const titleText = `${out.jobTitle || ''} ${out.education || ''} ${out.summary || ''}`.toLowerCase();
      const skillText = `${out.skills || ''}`.toLowerCase();

      const STRONG_KEYWORDS: Record<string, string[]> = {
        btp:         ['chantier','bâtiment','construction','génie civil','maçon','électricien','plombier','soudeur','topographe','travaux publics','caces','béton','ferrailleur','carreleur'],
        logistics:   ['port','logistique','transport','douane','supply chain','fret','chauffeur','livreur','manutention','maritime','shipping','agent portuaire','transitaire'],
        hospitality: ['hôtel','réception','tourisme','housekeeping','barman','serveur','restauration hôtelière','room service','kempinski','sheraton'],
        security:    ['sécurité','gardien','surveillance','vigil','militaire','police','agent de sécurité','protection rapprochée','cctv'],
        healthcare:  ['médecin','infirmier','pharmacien','médical','soins','urgences','chirurgie','sage-femme','laborantin','aide-soignant'],
        commerce:    ['commercial','vendeur','boutique','merchandis','représentant','export','import','achat'],
        catering:    ['cuisinier','pâtissier','restauration collective','catering','plongeur','commis de cuisine'],
        admin:       ['comptab','ressources humaines','rh','juridique','droit','secrétaire','assistante de direction','contrôleur de gestion','auditeur','trésorier','paie','sage','odoo','erp'],
      };

      let bestSector: string | null = null;
      let bestScore = 0;

      for (const [sector, keywords] of Object.entries(STRONG_KEYWORDS)) {
        // Chercher d'abord dans titre/formation (score x2), puis skills (score x1)
        const titleScore = keywords.filter(k => titleText.includes(k)).length * 2;
        const skillScore = keywords.filter(k => skillText.includes(k)).length;
        const total = titleScore + skillScore;
        if (total > bestScore) { bestScore = total; bestSector = sector; }
      }

      // N'affecter un secteur que si on a au moins 1 mot-clé fort trouvé
      // Si aucun indice → laisser null pour que l'admin choisisse manuellement
      if (bestScore >= 2) out.sector = bestSector;
      else out.sector = null; // Pas assez d'indice — l'admin devra choisir

      // Si le secteur vient de l'IA mais expérience=0 ET aucun diplôme métier → vérifier
      // que l'IA n'a pas hallociné (ex: 'btp' sans aucun mot-clé BTP dans le CV)
      if (out.sector && Number(out.experience) === 0 && !out.education) {
        // Re-vérifier avec nos propres mots-clés
        const checkText = `${out.skills || ''} ${out.jobTitle || ''} ${out.summary || ''}`.toLowerCase();
        const QUICK_CHECK: Record<string, string[]> = {
          btp: ['chantier','bâtiment','construction','maçon','électricien','plombier','soudeur','génie civil'],
          logistics: ['port','logistique','transport','douane','chauffeur','maritime'],
          hospitality: ['hôtel','réception','tourisme','barman','serveur'],
          security: ['sécurité','gardien','surveillance','militaire','police'],
          healthcare: ['médecin','infirmier','pharmacien','soins'],
          commerce: ['commercial','vendeur','boutique','vente terrain'],
          catering: ['cuisinier','pâtissier','plongeur'],
          admin: ['comptab','rh','juridique','secrétaire','auditeur','paie'],
        };
        const confirmed = (QUICK_CHECK[out.sector] || []).some(k => checkText.includes(k));
        if (!confirmed) out.sector = null; // L'IA a inventé un secteur sans preuve
      }
    }

    // 3b. Expérience : toujours un entier >= 0
    if (out.experience === null || out.experience === undefined || out.experience === '' || isNaN(Number(out.experience))) {
      out.experience = 0;
    } else {
      out.experience = Math.max(0, Math.round(Number(out.experience)));
    }

    // 4. Email : vider si placeholder, incomplet ou invalide
    if (out.email) {
      const e = out.email.trim();
      if (
        e === 'candidat@email.com' ||
        e === 'example@email.com' ||
        e.startsWith('@') ||           // ex: @gmail.com (début masqué dans le CV)
        !e.includes('@') ||
        !e.includes('.') ||
        e.endsWith('@') ||
        /^@/.test(e)
      ) {
        out.email = '';
      }
    }

    // 5b. Education : normaliser vers les valeurs exactes de Firestore settings_educations
    // values: 'Sans diplôme','BEP / CAP','Baccalauréat','BTS / DUT','Licence / Bachelor','Master / Ingénieur','Doctorat'
    if (out.education) {
      const edu = out.education.toLowerCase().trim();
      if (edu.includes('doctorat') || edu.includes('phd') || edu.includes('ph.d') || edu.includes('docteur') || edu.includes('doctorate')) {
        out.education = 'Doctorat';
      } else if (edu.includes('master') || edu.includes("master's") || edu.includes('ingénieur') || edu.includes('ingenieur') || edu.includes('bac+5') || edu.includes('bac +5') || edu.includes('grande école') || edu.includes("master's / engineering") || edu.includes('engineering degree') || edu.includes('mba')) {
        out.education = 'Master / Ingénieur';
      } else if (edu.includes('licence') || edu.includes('bachelor') || edu.includes("bachelor's") || edu.includes("bachelor's degree") || edu.includes('bac+3') || edu.includes('bac +3') || edu.includes('bac+4') || edu.includes('bac +4') || edu.includes('undergraduate') || edu.includes('b.sc') || edu.includes('b.a')) {
        out.education = 'Licence / Bachelor';
      } else if (edu.includes('bts') || edu.includes('dut') || edu.includes('bac+2') || edu.includes('bac +2') || edu.includes('deug') || edu.includes('technical degree') || edu.includes('hnd') || edu.includes('associate degree') || edu.includes('brevet de technicien')) {
        out.education = 'BTS / DUT';
      } else if (edu.includes('baccalauréat') || edu.includes('baccalaureat') || edu.includes('high school diploma') || edu.includes('high school') || edu.includes('terminale') || edu.includes('lycée') || edu.includes('lycee') || edu.includes('secondaire') || edu.includes('secondary') || edu.includes('a-level') || edu.includes('a level') || edu === 'bac') {
        out.education = 'Baccalauréat';
      } else if (edu.includes('bep') || edu.includes('cap') || edu.includes('brevet') || edu.includes('bepc') || edu.includes('collège') || edu.includes('college') || edu.includes('3ème') || edu.includes('troisième') || edu.includes('vocational diploma') || edu.includes('vocational') || edu.includes('certificat')) {
        out.education = 'BEP / CAP';
      } else if (edu.includes('sans') || edu.includes('aucun') || edu.includes('primaire') || edu.includes('non scolarisé') || edu.includes('école primaire') || edu.includes('cm2') || edu.includes('pas de diplôme') || edu.includes('no diploma') || edu === 'none' || edu === 'n/a' || edu.includes('no formal') || edu.includes('self-taught') || edu.includes('autodidacte')) {
        out.education = 'Sans diplôme';
      }
      // Si toujours non reconnu → laisser telle quelle (text input prend le relais)
    } else {
      // education null → IA n'a rien trouvé → si exp=0 c'est sans diplôme
      if (!out.experience || Number(out.experience) === 0) {
        out.education = 'Sans diplôme';
      }
    }

        // 5c. Availability : normaliser vers les valeurs exactes de dynAvailabilities
    // (valeurs : 'Immédiate', 'Dans 1 mois', 'Dans 2 mois', 'Dans 3 mois', 'En poste (à définir)')
    if (out.availability !== undefined && out.availability !== null) {
      const av = String(out.availability).toLowerCase().trim();
      if (av === 'immediate' || av === 'immediately' || av === 'immédiat' || av === 'immédiate' || av.includes('immediat') || av.includes('immédiat') || av.includes('dès maintenant') || av.includes('de suite') || av === 'now') {
        out.availability = 'Immédiate';
      } else if (av.includes('1 mois') || av.includes('1 month') || av.includes('un mois') || av === '1m') {
        out.availability = 'Dans 1 mois';
      } else if (av.includes('2 mois') || av.includes('2 month') || av.includes('deux mois')) {
        out.availability = 'Dans 2 mois';
      } else if (av.includes('3 mois') || av.includes('3 month') || av.includes('trois mois')) {
        out.availability = 'Dans 3 mois';
      } else if (av.includes('poste') || av.includes('employed') || av.includes('en activité') || av.includes('actuellement')) {
        out.availability = 'En poste (à définir)';
      } else {
        // Valeur inconnue → défaut Immédiate
        out.availability = 'Immédiate';
      }
    } else {
      out.availability = 'Immédiate';
    }

    // 5d. Sector : si null après toute l'inférence, mettre 'admin' comme fallback
    // pour que le select ne reste pas vide (l'admin peut corriger)
    if (!out.sector) {
      out.sector = 'non-precise';
    }

    // 5. Adresse : nettoyer les artefacts OCR courants
    if (out.address) {
      out.address = out.address
        .replace(/^\.\.?\s*/g, '')  // supprimer les points en début (. Q3 → Q3)
        .replace(/^,\s*/g, '')        // supprimer virgule en début
        .trim();
    }

    return out;
  };

  const handleScanCV = async (file: File) => {
    setScanLoading(true);
    setScanError('');
    setScanResult(null);
    setScanProgress('Lecture du fichier...');
    // Garder la référence au fichier pour l'uploader lors de la création du compte
    setScannedCvFile(file);

    try {
      const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isImage = file.type.startsWith('image/');

      setScanProgress('Extraction du contenu...');

      // ── Route 1 : Image (JPG, PNG, WEBP…) → base64 → route /api/scan-cv (vision) ──
      if (isImage) {
        let fullDataUrl = '';
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            fullDataUrl = result;
            resolve(result.split(',')[1]); // strip data:...;base64,
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        setScanProgress('Analyse par IA Vision...');

        const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
        if (!groqKey) throw new Error('Clé GROQ non configurée (NEXT_PUBLIC_GROQ_API_KEY)');

        const cvPrompt = buildCvPrompt();
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{ role: 'user', content: [
              { type: 'text', text: cvPrompt },
              { type: 'image_url', image_url: { url: `data:${file.type};base64,${fileBase64}` } },
            ]}],
            max_tokens: 2048, temperature: 0.1,
          }),
        });
        if (!groqResponse.ok) {
          const err = await groqResponse.json();
          const errMsg = err.error?.message || err.error?.code || JSON.stringify(err.error) || 'Groq Vision Error';
          throw new Error(`Groq Vision API: ${errMsg}`);
        }
        const groqData = await groqResponse.json();
        const rawText = groqData.choices?.[0]?.message?.content || '';
        const extracted = cleanExtracted(parseGroqJson(rawText));
        if (!extracted) throw new Error('Réponse IA invalide');

        setScanProgress('Extraction de la photo...');
        const extractedPhoto = await extractCvPhoto(fullDataUrl);
        setScannedPhotoDataUrl(extractedPhoto || fullDataUrl);
        setScanProgress('');
        setNewUser({
          role: 'candidate', email: extracted.email || '', password: '',
          phone: extracted.phone || '', displayName: extracted.fullName || '',
          adminLevel: 'admin', companyName: '', contactName: '', rcNumber: '',
          website: '', sector: extracted.sector || '',
          fullName: extracted.fullName || '', whatsapp: extracted.whatsapp || extracted.phone || '',
          nationality: extracted.nationality || '', education: extracted.education || '',
          experience: extracted.experience || '', availability: extracted.availability || 'immediate',
          gender: extracted.gender || 'M', candidateSector: extracted.sector || '',
          address: extracted.address || '', languages: extracted.languages || '',
        });
        setScanResult(cleanExtracted(extracted)); // ← EN DERNIER pour déclencher l'affichage du résumé
        return;
      }

      // ── Route 2 : PDF → tenter extraction texte via pdf.js ──
      let fileText = '';
      let pdfIsScanned = false;

      if (isPDF) {
        fileText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              if (!(window as any).pdfjsLib) {
                await new Promise<void>((res, rej) => {
                  const script = document.createElement('script');
                  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                  script.onload = () => res();
                  script.onerror = () => rej(new Error('pdf.js failed to load'));
                  document.head.appendChild(script);
                });
                (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              }
              const pdfjsLib = (window as any).pdfjsLib;
              const arrayBuffer = reader.result as ArrayBuffer;
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              let fullText = '';
              for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
              }
              resolve(fullText.slice(0, 8000));
            } catch (e) {
              reject(e);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        // PDF scanné (image dans PDF) : texte vide → fallback vision via base64
        if (!fileText.trim() || fileText.trim().length < 20) {
          pdfIsScanned = true;
        }

        // ── Render PDF page 1 as image to extract candidate photo ──
        if (!pdfIsScanned) {
          try {
            const pdfjsLib2 = (window as any).pdfjsLib;
            const ab2 = await file.arrayBuffer();
            const pdf2 = await pdfjsLib2.getDocument({ data: ab2 }).promise;
            const page1 = await pdf2.getPage(1);
            const viewport = page1.getViewport({ scale: 3.5 }); // haute résolution pour extraction photo
            const cvCanvas = document.createElement('canvas');
            cvCanvas.width = viewport.width;
            cvCanvas.height = viewport.height;
            const cvCtx = cvCanvas.getContext('2d');
            if (cvCtx) {
              await page1.render({ canvasContext: cvCtx, viewport }).promise;
              const pdfPageDataUrl = cvCanvas.toDataURL('image/jpeg', 0.9);
              const extractedPhoto = await extractCvPhoto(pdfPageDataUrl);
              if (extractedPhoto) setScannedPhotoDataUrl(extractedPhoto);
            }
          } catch { /* photo extraction non critique */ }
        }
      }

      // ── Route 3 : PDF scanné → rendu canvas haute résolution → Groq Vision ──
      if (pdfIsScanned) {
        setScanProgress('PDF scanné détecté — rendu en image...');

        try {
          // pdf.js déjà chargé depuis Route 2 — réutiliser
          const pdfjsLib = (window as any).pdfjsLib;
          const ab = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: ab }).promise;
          const numPages = Math.min(pdfDoc.numPages, 3);

          // Rendre chaque page en canvas haute résolution
          const pageCanvases: HTMLCanvasElement[] = [];
          let totalHeight = 0;
          let maxWidth = 0;

          for (let i = 1; i <= numPages; i++) {
            setScanProgress(`Rendu page ${i}/${numPages}...`);
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 2.5 }); // haute résolution
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff'; // fond blanc
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: ctx, viewport }).promise;
            }
            pageCanvases.push(canvas);
            totalHeight += viewport.height;
            maxWidth = Math.max(maxWidth, viewport.width);
          }

          // Fusionner toutes les pages verticalement en une image
          const mergedCanvas = document.createElement('canvas');
          mergedCanvas.width = maxWidth;
          mergedCanvas.height = totalHeight;
          const mergedCtx = mergedCanvas.getContext('2d');
          if (mergedCtx) {
            mergedCtx.fillStyle = '#ffffff';
            mergedCtx.fillRect(0, 0, maxWidth, totalHeight);
            let yOffset = 0;
            for (const pc of pageCanvases) {
              mergedCtx.drawImage(pc, 0, yOffset);
              yOffset += pc.height;
            }
          }

          // Extraire photo candidat depuis page 1
          if (pageCanvases.length > 0) {
            const extractedPhoto = await extractCvPhoto(pageCanvases[0].toDataURL('image/jpeg', 0.9));
            if (extractedPhoto) setScannedPhotoDataUrl(extractedPhoto);
          }

          // Convertir en base64 JPEG pour Groq Vision
          const imageBase64 = mergedCanvas.toDataURL('image/jpeg', 0.92).split(',')[1];

          setScanProgress('Analyse par IA Vision...');

          const groqKey2 = process.env.NEXT_PUBLIC_GROQ_API_KEY;
          if (!groqKey2) throw new Error('Clé GROQ non configurée');

          const cvPrompt2 = buildCvPrompt();

          // ✅ Modèle VISION avec l'image du PDF rendu — plus de base64 texte
          const groqResponse2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey2}` },
            body: JSON.stringify({
              model: 'meta-llama/llama-4-scout-17b-16e-instruct', // ✅ vision
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: cvPrompt2 },
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
                ],
              }],
              max_tokens: 1000,
              temperature: 0.1,
            }),
          });

          if (!groqResponse2.ok) {
            const err2 = await groqResponse2.json();
            const errMsg2 = err2.error?.message || err2.error?.code || JSON.stringify(err2.error) || 'Groq Vision PDF Error';
            throw new Error(`Groq Vision PDF: ${errMsg2}`);
          }

          const groqData2 = await groqResponse2.json();
          const rawText2 = groqData2.choices?.[0]?.message?.content || '';
          const extracted = cleanExtracted(parseGroqJson(rawText2));
          if (!extracted) throw new Error('Réponse IA invalide');

          setScanProgress('');
          setNewUser({
            role: 'candidate', email: extracted.email || '', password: '',
            phone: extracted.phone || '', displayName: extracted.fullName || '',
            adminLevel: 'admin', companyName: '', contactName: '', rcNumber: '',
            website: '', sector: extracted.sector || '',
            fullName: extracted.fullName || '', whatsapp: extracted.whatsapp || extracted.phone || '',
            nationality: extracted.nationality || '', education: extracted.education || '',
            experience: extracted.experience || '', availability: extracted.availability || 'immediate',
            gender: extracted.gender || 'M', candidateSector: extracted.sector || '',
            address: extracted.address || '', languages: extracted.languages || '',
          });
          setScanResult(cleanExtracted(extracted)); // ← EN DERNIER pour déclencher l'affichage du résumé
          return;

        } catch (visionErr: any) {
          // Fallback serveur si canvas échoue
          setScanProgress('Fallback API serveur...');
          const fb64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve((r.result as string).split(',')[1]);
            r.onerror = reject;
            r.readAsDataURL(file);
          });
          const fallbackRes = await fetch('/api/scan-cv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64: fb64, mimeType: file.type }),
          });
          if (!fallbackRes.ok) throw new Error('Échec scan — ' + visionErr.message);
          const fallbackData = await fallbackRes.json();
          const extracted = cleanExtracted(fallbackData.profile);
          if (!extracted) throw new Error('Réponse API invalide');
          setScanProgress('');
          setNewUser({
            role: 'candidate', email: extracted.email || '', password: '',
            phone: extracted.phone || '', displayName: extracted.fullName || '',
            adminLevel: 'admin', companyName: '', contactName: '', rcNumber: '',
            website: '', sector: extracted.sector || '',
            fullName: extracted.fullName || '', whatsapp: extracted.whatsapp || extracted.phone || '',
            nationality: extracted.nationality || '', education: extracted.education || '',
            experience: extracted.experience || '', availability: extracted.availability || 'immediate',
            gender: extracted.gender || 'M', candidateSector: extracted.sector || '',
            address: extracted.address || '', languages: extracted.languages || '',
          });
          setScanResult(cleanExtracted(extracted)); // ← EN DERNIER pour déclencher l'affichage du résumé
          return;
        }
      }

      setScanProgress('Analyse par Groq IA...');

      // ── Prompt enrichi contexte djiboutien ──
      const prompt = cvScanPrompt.replace('{{CV_TEXT}}', fileText.slice(0, 5500));

      const groqKey3 = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      if (!groqKey3) throw new Error('Clé GROQ non configurée');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey3}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        const errMsg3 = errData.error?.message || errData.error?.code || JSON.stringify(errData.error) || 'Groq Error';
        throw new Error(`Groq text API: ${errMsg3}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const extracted = cleanExtracted(parseGroqJson(raw));
      if (!extracted) throw new Error('Réponse IA invalide — réessayez');

      // Pre-fill the newUser form with extracted data
      setNewUser({
        role: 'candidate',
        email: extracted.email || '',
        password: '',
        phone: extracted.phone || '',
        displayName: extracted.fullName || '',
        adminLevel: 'admin',
        companyName: '',
        contactName: '',
        rcNumber: '',
        website: '',
        sector: extracted.sector || '',
        fullName: extracted.fullName || '',
        whatsapp: extracted.whatsapp || extracted.phone || '',
        nationality: extracted.nationality || '',
        education: extracted.education || '',
        experience: extracted.experience || '',
        availability:    String(extracted.availability || 'immediate'),
        gender: 'M',
        candidateSector: extracted.sector || 'non-precise',
        address: extracted.address || '',
        languages: extracted.languages || '',
      });
      setScanProgress('');
      setScanResult(cleanExtracted(extracted)); // ← EN DERNIER pour déclencher l'affichage du résumé

    } catch (err: any) {
      setScanError(err.message || t.admin.scanError || 'Scan error');
      setScanProgress('');
    } finally {
      setScanLoading(false);
    }
  };

  // ── Formate un montant en DJF avec espaces : 71000 → "71 000"
  const formatSalaryNum = (n: string): string => {
    const digits = n.replace(/\D/g, '');
    if (!digits) return n;
    return parseInt(digits, 10).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g, ' ');
  };

  // ── Formate une plage salariale : "71000-80000" → "71 000 - 80 000"
  const formatSalaryLabel = (raw: string): string => {
    const cleaned = raw.replace(' DJF', '').trim();
    // Detect separator: " - ", "–", "-"
    const sep = cleaned.includes(' - ') ? ' - ' : cleaned.includes('–') ? '–' : '-';
    const parts = cleaned.split(sep).map(p => p.trim());
    if (parts.length === 2) {
      return `${formatSalaryNum(parts[0])} - ${formatSalaryNum(parts[1])}`;
    }
    return formatSalaryNum(cleaned);
  };

  // ── Génère un ID VGM unique : VGM-YYYY-XXXX
  const generateTempId = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `VGM-${year}-`;
    const [usersSnap, candidatesSnap, recruitersSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'candidates')),
      getDocs(collection(db, 'recruiters')),
    ]);
    const allIds = [
      ...usersSnap.docs.flatMap(d => [d.data().tempId, d.data().vgmId]),
      ...candidatesSnap.docs.map(d => d.data().vgmId),
      ...recruitersSnap.docs.map(d => d.data().vgmId),
    ]
      .filter((id): id is string => !!id && id.startsWith(prefix))
      .map(id => parseInt(id.replace(prefix, '')) || 0);
    const nextNum = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  };

  // ── Génère un mot de passe mémorisable
  const generatePassword = (): string => {
    const adjs = ['Bleu', 'Fort', 'Vif', 'Net', 'Grand', 'Vrai'];
    const nouns = ['Phare', 'Delta', 'Atlas', 'Tigre', 'Soleil', 'Cedre'];
    const a = adjs[Math.floor(Math.random() * adjs.length)];
    const n = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${a}${n}${num}!`;
  };

  // ==================== GESTION UTILISATEURS ====================
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.role) return;
    setUserSaving(true);
    setGeneratedCredentials(null);
    try {
      // Mot de passe : celui saisi ou auto-généré
      const tempPassword = newUser.password && newUser.password.length >= 6
        ? newUser.password
        : generatePassword();

      const displayName =
        newUser.role === 'candidate' ? newUser.fullName :
        newUser.role === 'recruiter' ? (newUser.contactName || newUser.companyName) :
        newUser.displayName;

      // ── 1. Firebase Auth via une instance SECONDAIRE ─────────────
      // On utilise une app Firebase temporaire pour NE PAS déconnecter l'admin.
      // L'admin reste connecté sur l'instance principale pendant toute l'opération.
      const secondaryApp = getApps().find(a => a.name === 'Secondary')
        ?? initializeApp(getApp().options, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);

      // Créer le compte sur l'instance secondaire
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, tempPassword);
      await updateProfile(cred.user, { displayName: displayName || '' });

      // Déconnecter immédiatement l'instance secondaire — l'admin n'est pas affecté
      await signOut(secondaryAuth);

      // ── 2. Générer l'ID VGM (recruteurs & candidats uniquement)
      const tempId = newUser.role !== 'admin' ? await generateTempId() : '';

      // ── 2bis. Envoyer l'email de bienvenue via notre route Resend (template perso).
      // Pour recruiter/candidate : passe par /api/send-welcome (noreply@vediorgm.com + reply-to Gmail).
      // Pour admin (pas de template dédié) : on garde le mail natif Firebase en secours.
      let realEmailSent = false;
      try {
        if (newUser.role === 'recruiter') {
          const res = await fetch('/api/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'recruiter',
              companyName: newUser.companyName || '',
              contactName: newUser.contactName || newUser.companyName || '',
              email: newUser.email,
            }),
          });
          realEmailSent = res.ok;
          if (!res.ok) console.error('send-welcome (recruiter) failed:', await res.text());
        } else if (newUser.role === 'candidate') {
          const res = await fetch('/api/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'candidate',
              fullName: newUser.fullName || '',
              email: newUser.email,
              vgmId: tempId,
              tempPassword,
            }),
          });
          realEmailSent = res.ok;
          if (!res.ok) console.error('send-welcome (candidate) failed:', await res.text());
        } else {
          // Admin : pas de template Resend dédié, on garde le lien Firebase natif
          const secondaryApp2 = getApps().find(a => a.name === 'Secondary')
            ?? initializeApp(getApp().options, 'Secondary');
          const secondaryAuth2 = getAuth(secondaryApp2);
          await sendPasswordResetEmail(secondaryAuth2, newUser.email);
          await signOut(secondaryAuth2);
          realEmailSent = true;
        }
      } catch (emailErr: any) {
        console.error('Welcome email failed:', emailErr);
        realEmailSent = false;
      }

      // ── 3. Firestore ────────────────────────────────────────────
      const baseData: any = {
        userId: cred.user.uid,
        firebaseUid: cred.user.uid,
        email: newUser.email,
        displayName: displayName || '',
        role: newUser.role,
        phone: newUser.phone || '',
        createdBy: user.email,
        createdByAdmin: true,
        status: 'active',
        createdAt: serverTimestamp(),
        tempId: tempId || null,
        // tempPassword NON stocké en clair — l'utilisateur définit son mot de passe via l'email envoyé
        gmailConfirmed: false,
      };

      if (newUser.role === 'admin') {
        const adminRef = doc(db, 'admins', cred.user.uid);
        await setDoc(adminRef, { ...baseData, adminLevel: newUser.adminLevel || 'admin' });
        await addDoc(collection(db, 'users'), { ...baseData, adminLevel: newUser.adminLevel || 'admin' });
      } else if (newUser.role === 'recruiter') {
        const recData = {
          ...baseData,
          companyName: newUser.companyName || '',
          contactName: newUser.contactName || '',
          rcNumber: newUser.rcNumber || '',
          website: newUser.website || '',
          sector: newUser.sector || 'btp',
        };
        await addDoc(collection(db, 'recruiters'), recData);
        await addDoc(collection(db, 'users'), recData);
      } else {
        // Upload scanned CV photo to Firebase Storage if available
        let scannedPhotoUrl = '';
        if (manualPhotoFile) {
          try {
            const photoRef = ref(storage, `candidates/${cred.user.uid}/photo_${Date.now()}`);
            await uploadBytes(photoRef, manualPhotoFile);
            scannedPhotoUrl = await getDownloadURL(photoRef);
          } catch (photoErr) {
            console.warn('Manual photo upload failed:', photoErr);
          }
        } else if (scannedPhotoDataUrl && newUser.role === 'candidate') {
          try {
            const blob = await fetch(scannedPhotoDataUrl).then(r => r.blob());
            const photoRef = ref(storage, `candidates/${cred.user.uid}/photo_${Date.now()}`);
            await uploadBytes(photoRef, blob);
            scannedPhotoUrl = await getDownloadURL(photoRef);
          } catch (photoErr) {
            console.warn('Photo upload failed:', photoErr);
          }
        }
        // ── Upload CV scanné vers Firebase Storage ──────────────
        let scannedCvUrl = '';
        let scannedCvFileName = '';
        if (scannedCvFile) {
          try {
            const cvRef = ref(storage, `candidates/${cred.user.uid}/cv_${Date.now()}_${scannedCvFile.name}`);
            await uploadBytes(cvRef, scannedCvFile);
            scannedCvUrl = await getDownloadURL(cvRef);
            scannedCvFileName = scannedCvFile.name;
          } catch (cvErr) {
            console.warn('CV upload failed:', cvErr);
          }
        }

        const candData = {
          ...baseData,
          fullName: newUser.fullName || '',
          whatsapp: newUser.whatsapp || '',
          nationality: newUser.nationality || '',
          education: newUser.education || '',
          experience: newUser.experience || '',
          availability: newUser.availability || 'immediate',
          gender: newUser.gender || 'M',
          sector: newUser.candidateSector || 'non-precise',
          address: newUser.address || '',
          languages: newUser.languages || '',
          jobTitle: '',
          photoUrl: scannedPhotoUrl || '',
          // CV scanné sauvegardé automatiquement
          ...(scannedCvUrl && { cvUrl: scannedCvUrl, cvFileName: scannedCvFileName }),
        };
        await addDoc(collection(db, 'users'), candData);

        // Aussi créer/mettre à jour candidateProfiles directement
        if (scannedCvUrl) {
          try {
            await setDoc(doc(db, 'candidateProfiles', cred.user.uid), {
              ...candData,
              userId: cred.user.uid,
              firebaseUid: cred.user.uid,
              cvUrl: scannedCvUrl,
              cvFileName: scannedCvFileName,
              profileComplete: true,
            }, { merge: true });
          } catch (cpErr) {
            console.warn('candidateProfiles CV update failed:', cpErr);
          }
        }

        setScannedPhotoDataUrl(null);
        setScannedCvFile(null);
      }

      // ── 4. Email de bienvenue ────────────────────────────────────
      // L'envoi réel se fait via /api/send-welcome (Resend, template perso) ci-dessus,
      // capturé dans `realEmailSent`.

      // ── 5. Afficher les identifiants à l'admin ──────────────────
      setGeneratedCredentials({
        tempId,
        tempPassword,
        email: newUser.email,
        role: newUser.role,
        displayName: displayName || newUser.email,
        emailSent: realEmailSent,
      });

      // Réinitialisation du formulaire
      setNewUser({
        role: 'candidate', email: '', password: '', phone: '',
        displayName: '', adminLevel: 'admin',
        companyName: '', contactName: '', rcNumber: '', website: '', sector: 'btp',
        fullName: '', whatsapp: '', nationality: '', education: '', experience: '',
        availability: 'Immédiate', gender: 'M', candidateSector: '', address: '', languages: '',
      });
      setScannedPhotoDataUrl(null);
      setManualPhotoFile(null);
      setManualPhotoPreview(null);
      setShowAddUser(false);

    } catch (err: any) {
      console.error('Error creating user:', err);
      const codes: Record<string, string> = {
        'auth/email-already-in-use': 'Un compte existe déjà avec cet email.',
        'auth/invalid-email': 'Email invalide.',
        'auth/weak-password': 'Mot de passe trop faible (min. 6 caractères).',
      };
      alert(`❌ Erreur : ${codes[err.code] || err.message}`);
    }
    setUserSaving(false);
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    
    // Update in users collection
    await updateDoc(doc(db, 'users', userId), { status: newStatus, updatedAt: serverTimestamp() });
    
    // Also update in recruiters collection if the user is a recruiter
    const user = allUsersDeduped.find(u => u.id === userId || u.uid === userId);
    if (user?.role === 'recruiter') {
      // Find the recruiter doc by email or uid
      try {
        const recSnap = await getDocs(query(collection(db, 'recruiters'), where('email', '==', user.email)));
        for (const d of recSnap.docs) {
          await updateDoc(doc(db, 'recruiters', d.id), { status: newStatus, updatedAt: serverTimestamp() });
        }
        // Also try by uid
        const recSnapUid = await getDocs(query(collection(db, 'recruiters'), where('uid', '==', userId)));
        for (const d of recSnapUid.docs) {
          await updateDoc(doc(db, 'recruiters', d.id), { status: newStatus, updatedAt: serverTimestamp() });
        }
      } catch (err) {
        console.error('Error updating recruiter status:', err);
      }
    }
    
    // Also update in candidates collection if candidate
    if (user?.role === 'candidate') {
      try {
        await updateDoc(doc(db, 'candidateProfiles', userId), { status: newStatus, updatedAt: serverTimestamp() }).catch(() => {});
      } catch (err) { /* ignore */ }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Supprimer cet utilisateur définitivement ?')) {
      await deleteDoc(doc(db, 'users', userId));
    }
  };

  // Dédupliquer : un utilisateur peut être dans recruiters ET users
  const allUsersDeduped = (() => {
    const seen = new Set<string>();
    const combined = [
      ...users,
      ...recruiters.filter(r => !users.find(u => u.email === r.email))
    ];
    return combined.filter(u => {
      const key = u.firebaseUid || u.userId || u.email;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const filteredUsers = allUsersDeduped.filter(u =>
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.displayName || u.fullName || u.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.companyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtrage des offres : seules les offres actives et non expirées sont affichées
  const now = new Date();
  const filteredJobs = jobs
    .filter(j => 
      j.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (j.companyName || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(j => j.status === 'active' && (!j.expiresAt || j.expiresAt.toDate() > now));

  const filteredApplications = applications.filter(a => 
    a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.phone || '').includes(searchTerm) ||
    (a.nationality || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRecruiters = recruiters.filter(r => 
    r.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredNeeds = needs.filter(n =>
    (n.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Garde : traductions pas encore disponibles
  if (!t || !t.admin) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
      <Loader2 className="animate-spin text-orange" size={48} />
    </div>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
      <Loader2 className="animate-spin text-orange" size={48} />
    </div>
  );

  if (!user) {
    const B = '#060d1a';
    const A = '#3B82F6';
    const R = '#F97316';
    const W = '#FFFFFF';

    return (
      <div style={{ position: 'fixed', inset: 0, background: B, zIndex: 200, overflowY: 'auto', overflowX: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Fine grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(59,130,246,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.035) 1px, transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none' }} />

        {/* Diagonal accent lines (centre-right of page) */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.08, overflow: 'hidden' }} preserveAspectRatio="none">
          <line x1="55%" y1="0%" x2="85%" y2="100%" stroke={A} strokeWidth="1" />
          <line x1="62%" y1="0%" x2="92%" y2="100%" stroke={A} strokeWidth="0.7" />
          <line x1="70%" y1="0%" x2="100%" y2="100%" stroke={A} strokeWidth="0.5" />
        </svg>

        {/* Glowing blobs */}
        <div style={{ position: 'absolute', top: '-18%', left: '-6%', width: '50vw', maxWidth: 720, height: 720, background: 'radial-gradient(circle, rgba(59,130,246,0.11), transparent 60%)', pointerEvents: 'none', overflow: 'hidden' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-6%', width: '50vw', maxWidth: 580, height: 580, background: 'radial-gradient(circle, rgba(249,115,22,0.08), transparent 60%)', pointerEvents: 'none', overflow: 'hidden' }} />

        {/* Back button */}
        <button
          onClick={onBack}
          style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.8px', background: 'none', border: 'none', cursor: 'pointer', zIndex: 10 }}
          onMouseEnter={e => (e.currentTarget.style.color = W)}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          <ChevronLeft size={15} /> {t.admin.back}
        </button>

        {/* 60/40 split */}
<style>{`
          @media (max-width: 900px) {
            .vgm-login-grid { grid-template-columns: 1fr !important; min-height: auto !important; overflow-x: hidden !important; max-width: 100vw !important; }
            .vgm-login-left { display: none !important; }
            .vgm-login-right { padding: 32px 16px !important; align-items: flex-start !important; min-height: 100vh; width: 100% !important; max-width: 100vw !important; box-sizing: border-box !important; }
          }
          @media (max-width: 420px) {
            .vgm-login-right { padding: 24px 12px !important; }
          }
        `}</style>
        <div className="vgm-login-grid" style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.15fr 1fr', overflowX: 'hidden', maxWidth: '100vw' }}>

          {/* ══ LEFT PANEL ══ */}
          <div className="vgm-login-left" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 72px 40px 80px' }}>

            {/* Logo + underline */}
            <div style={{ marginBottom: 44 }}>
              <Logo inverted size="lg" />
              <div style={{ width: 52, height: 3, background: `linear-gradient(90deg, ${A}, transparent)`, borderRadius: 2, marginTop: 12 }} />
            </div>

            {/* Badge — blue border + lock */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 100, padding: '7px 18px', marginBottom: 24, alignSelf: 'flex-start' }}>
              <Lock size={12} color={A} />
              <span style={{ fontSize: 11, fontWeight: 800, color: A, textTransform: 'uppercase', letterSpacing: '1.6px' }}>{t.admin.adminAccess}</span>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 56, fontWeight: 900, color: W, lineHeight: 1.05, letterSpacing: '-2.5px', marginBottom: 18, margin: '0 0 18px' }}>
              Central<br />
              <span style={{ color: A }}>Management Console</span>
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.85, maxWidth: 370, margin: '0 0 40px' }}>
              Complete oversight of the Vedior GM platform.<br />
              {lang==='AR' ? 'إدارة المستخدمين والعروض والإحصاءات في الوقت الفعلي.' : lang==='EN' ? 'Manage users, offers and statistics in real time.' : 'Gestion des utilisateurs, des offres et des statistiques en temps réel.'}
            </p>

            {/* Security features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
              {[
                { icon: ShieldCheck, label: 'Secure Email Authentication',           color: '#22C55E' },
                { icon: Fingerprint,  label: 'Access restricted to verified administrators', color: A },
                { icon: Activity,     label: 'Complete logging of admin actions',   color: R },
                { icon: Zap,          label: 'Real-time synchronized data',         color: '#A78BFA' },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={color} />
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.48)', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Stat cards — icon LEFT, value+label RIGHT */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { icon: Activity, val: '99.9%', label: 'AVAILABILITY', color: A,          bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.18)' },
                { icon: Zap,      val: '<100ms', label: 'LATENCY',       color: '#22C55E', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.16)' },
                { icon: Lock,     val: 'AES-256',label: 'ENCRYPTION',   color: '#A78BFA', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.16)' },
              ].map(({ icon: Icon, val, label, color, bg, border }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: W, lineHeight: 1.1 }}>{val}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 40, color: 'rgba(255,255,255,0.16)', fontSize: 11 }}>
              © 2026 Vedior GM — Reference HR Platform in Djibouti
            </div>
          </div>

          {/* ══ RIGHT PANEL — LOGIN CARD ══ */}
          <div className="vgm-login-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 52px 32px 32px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24,
              padding: '52px 48px', width: '100%', maxWidth: 500,
              boxShadow: '0 0 80px rgba(59,130,246,0.06), 0 32px 80px rgba(0,0,0,0.7)',
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Top glow line */}
              <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: `linear-gradient(90deg, transparent, ${A}, transparent)` }} />
              {/* Card inner glow */}
              <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 260, height: 200, background: `radial-gradient(circle, rgba(59,130,246,0.1), transparent 70%)`, pointerEvents: 'none' }} />

              {/* Shield hero */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 88, height: 88, borderRadius: 26,
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 48px rgba(59,130,246,0.12)',
                  }}>
                    <Shield size={40} color={A} strokeWidth={1.5} />
                  </div>
                  <div style={{ position: 'absolute', top: -9, right: -9, width: 28, height: 28, borderRadius: 9, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(249,115,22,0.5)' }}>
                    <Crown size={13} color={W} />
                  </div>
                </div>
              </div>

              {/* Title */}
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h2 style={{ fontSize: 26, fontWeight: 900, color: W, letterSpacing: '-0.5px', margin: '0 0 10px' }}>
                  {t.admin.adminConsole}
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, margin: 0 }}>
                  {t.admin.secureAccess}
                </p>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 28px' }} />

              {/* ── FORMULAIRE EMAIL (mode login) ── */}
              {loginMode === 'login' && (
                <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* ── Bannière TEST MODE ── */}
                  {TEST_MODE && (
                    <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 14, padding: '16px 18px', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 15 }}>🧪</span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(234,179,8,0.9)', textTransform: 'uppercase', letterSpacing: '1.4px' }}>Mode Test — Identifiants Admin</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', borderRadius: 9, padding: '10px 14px' }}>
                          <div>
                            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 3 }}>Email</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace' }}>{TEST_EMAIL}</span>
                          </div>
                          <button type="button"
                            onClick={() => { setLoginEmail(TEST_EMAIL); }}
                            style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', color: 'rgba(234,179,8,0.8)', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                            Copier
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', borderRadius: 9, padding: '10px 14px' }}>
                          <div>
                            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 3 }}>Mot de passe</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace' }}>{TEST_PASSWORD}</span>
                          </div>
                          <button type="button"
                            onClick={() => { setLoginPassword(TEST_PASSWORD); }}
                            style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', color: 'rgba(234,179,8,0.8)', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                            Copier
                          </button>
                        </div>
                        <button type="button"
                          onClick={() => { setLoginEmail(TEST_EMAIL); setLoginPassword(TEST_PASSWORD); }}
                          style={{ width: '100%', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', color: 'rgba(234,179,8,0.9)', borderRadius: 9, padding: '9px', fontSize: 12, fontWeight: 900, cursor: 'pointer', marginTop: 2 }}>
                          ⚡ Remplir automatiquement
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Erreur */}
                  {loginError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 12, padding: '13px 16px', fontSize: 13, fontWeight: 700 }}>
                      ⚠️ {loginError}
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 8 }}>Email administrateur</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: A, display: 'flex' }}>
                        <Mail size={16} />
                      </span>
                      <input
                        type="email" required autoFocus
                        value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                        placeholder="admin@vediorgm.com"
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(59,130,246,0.2)`,
                          borderRadius: 12, padding: '15px 16px 15px 46px', color: W, fontSize: 14,
                          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                        }}
                        onFocus={e => e.target.style.borderColor = A}
                        onBlur={e => e.target.style.borderColor = 'rgba(59,130,246,0.2)'}
                      />
                    </div>
                  </div>

                  {/* Mot de passe */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.4px' }}>Mot de passe</label>
                      <button type="button"
                        onClick={() => { setLoginMode('reset'); setLoginError(''); setResetSent(false); }}
                        style={{ background: 'none', border: 'none', color: A, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                        Mot de passe oublié ?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                        <Lock size={16} />
                      </span>
                      <input
                        type={showLoginPwd ? 'text' : 'password'} required
                        value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••••"
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(59,130,246,0.2)',
                          borderRadius: 12, padding: '15px 48px 15px 46px', color: W, fontSize: 14,
                          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                        }}
                        onFocus={e => e.target.style.borderColor = A}
                        onBlur={e => e.target.style.borderColor = 'rgba(59,130,246,0.2)'}
                      />
                      <button type="button" onClick={() => setShowLoginPwd(p => !p)}
                        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
                        {showLoginPwd ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>

                  {/* Bouton connexion */}
                  <button type="submit" disabled={loginLoading}
                    style={{
                      width: '100%', background: `linear-gradient(135deg, ${A}, #1d4ed8)`, color: W,
                      padding: '17px', borderRadius: 14, fontWeight: 900, fontSize: 14,
                      textTransform: 'uppercase', letterSpacing: '2px', border: 'none', cursor: loginLoading ? 'not-allowed' : 'pointer',
                      opacity: loginLoading ? 0.7 : 1, boxShadow: `0 8px 32px rgba(59,130,246,0.35)`,
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4,
                    }}
                    onMouseEnter={e => { if (!loginLoading) { (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(59,130,246,0.55)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(59,130,246,0.35)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                  >
                    {loginLoading ? 'Connexion...' : <><Mail size={16} /><span>SE CONNECTER</span><span>→</span></>}
                  </button>

                </form>
              )}

              {/* ── FORMULAIRE RESET ── */}
              {loginMode === 'reset' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <button type="button" onClick={() => { setLoginMode('login'); setLoginError(''); setResetSent(false); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
                    ← Retour à la connexion
                  </button>

                  <div>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: '0 0 20px' }}>
                      Entrez votre adresse email admin. Vous recevrez un lien pour réinitialiser votre mot de passe.
                    </p>
                  </div>

                  {resetSent ? (
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                      <p style={{ color: '#86efac', fontWeight: 800, fontSize: 14, margin: '0 0 6px' }}>Email envoyé !</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>Vérifiez votre boîte mail (et le dossier spam).</p>
                    </div>
                  ) : (
                    <form onSubmit={handleAdminReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {loginError && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 12, padding: '13px 16px', fontSize: 13, fontWeight: 700 }}>
                          ⚠️ {loginError}
                        </div>
                      )}
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: A, display: 'flex' }}>
                          <Mail size={16} />
                        </span>
                        <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                          placeholder="admin@vediorgm.com"
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(59,130,246,0.2)`,
                            borderRadius: 12, padding: '15px 16px 15px 46px', color: W, fontSize: 14,
                            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                          }}
                          onFocus={e => e.target.style.borderColor = A}
                          onBlur={e => e.target.style.borderColor = 'rgba(59,130,246,0.2)'}
                        />
                      </div>
                      <button type="submit" disabled={loginLoading}
                        style={{
                          width: '100%', background: `linear-gradient(135deg, ${A}, #1d4ed8)`, color: W,
                          padding: '16px', borderRadius: 14, fontWeight: 900, fontSize: 13,
                          textTransform: 'uppercase', letterSpacing: '1.5px', border: 'none',
                          cursor: loginLoading ? 'not-allowed' : 'pointer', opacity: loginLoading ? 0.7 : 1,
                          transition: 'all 0.2s',
                        }}>
                        {loginLoading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Security notice */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)', borderRadius: 12, padding: '14px 16px', marginTop: 24 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Lock size={13} color={A} />
                </div>
                <div>
                  <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.28)', lineHeight: 1.6, margin: '0 0 2px' }}>Accès restreint aux administrateurs autorisés.</p>
                  <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.52)', lineHeight: 1.6, margin: 0, fontWeight: 700 }}>Toute tentative non autorisée est enregistrée.</p>
                </div>
              </div>

              {/* Footer */}
              <p style={{ textAlign: 'center', marginTop: 22, fontSize: 11, color: 'rgba(255,255,255,0.15)', margin: '22px 0 0' }}>
                Vedior GM Admin Console · v2.6 · By Djibouti
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050E1A', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(239,68,68,0.08), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.08), transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 440, padding: '0 24px' }}>
          {/* Error icon */}
          <div style={{ width: 96, height: 96, borderRadius: 28, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
            <XCircle size={48} color="#EF4444" />
          </div>

          <h1 style={{ fontSize: 30, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.5px', marginBottom: 14 }}>{t.admin.unauthorized}</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, marginBottom: 40 }}>
            {t.admin.account} <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>{user.email}</span> {t.admin.notListed}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={onBack}
              style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 32px rgba(59,130,246,0.25)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {t.admin.backPortal}
            </button>
            <button
              onClick={lgOut}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
            >
              <LogOut size={14} /> {t.admin.logout}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper: navigate + close drawer
  const goTo = (tab: typeof activeTab) => { setActiveTab(tab); setMobileDrawerOpen(false); };

  // Bottom nav items
  const bottomNav = [
    { id: 'dashboard',    icon: LayoutDashboard, label: 'Accueil' },
    { id: 'jobs',         icon: Briefcase,        label: 'Offres', badge: jobs.length },
    { id: 'applications', icon: Users,            label: t.admin.statsApps, badge: applications.filter((a:any)=>(a.status||'new')==='new').length },
    { id: 'messages',     icon: MessageSquare,    label: 'Messages', badge: adminMessages.filter((m:any)=>m.type==='modification_request'&&m.status==='pending').length||undefined },
    { id: 'settings',     icon: Settings,         label: t.admin.settings },
  ];

  return (
    <div dir={dir} className="fixed inset-0 bg-gray-50 z-[200] flex flex-col font-sans" style={{overflow:'hidden', maxWidth:'100vw', width:'100%'}}>

      {/* ── MOBILE HEADER ── */}
      <header className="shrink-0 bg-[#12152B] h-14 flex items-center justify-between px-4 lg:hidden z-30">
        <button onClick={() => setMobileDrawerOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
          <Menu size={22} />
        </button>
        <Logo inverted size="sm" />
        <button className="w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:text-white relative">
          <Bell size={20} />
          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#E8531A] text-white text-[9px] font-bold rounded-full flex items-center justify-center">5</div>
        </button>
      </header>

      {/* ── HAMBURGER DRAWER (mobile) ── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-[300] lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileDrawerOpen(false)} />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#12152B] flex flex-col overflow-hidden z-10">
            {/* Drawer header */}
            <div className="px-4 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Logo inverted size="sm" />
                <div className="text-[10px] text-[#4F6EF7] font-semibold uppercase tracking-wider">Admin</div>
              </div>
              <button onClick={() => setMobileDrawerOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all">
                <X size={18} />
              </button>
            </div>
            {/* User card */}
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-[13px] font-bold text-white shrink-0 overflow-hidden">
                  {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : (user?.displayName?.[0]?.toUpperCase() || 'A')}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{user.displayName || 'Admin'}</p>
                  <p className="text-[11px] text-white/40">Super Admin</p>
                </div>
              </div>
            </div>
            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 px-2 mb-2">Principal</p>
              {[
                { id:'dashboard',    icon:LayoutDashboard, label:t.admin.dashboard,                badge:null, badgeColor:'blue' as const },
                { id:'jobs',         icon:Briefcase,       label:t.admin.jobs,                     badge:jobs.length||null, badgeColor:'blue' as const },
                { id:'applications', icon:Users,           label:t.admin.apps,                     badge:applications.filter((a:any)=>(a.status||'new')==='new').length||null, badgeColor:'orange' as const },
                { id:'recruiters',   icon:Building2,       label:t.admin.recruiters||'Recruteurs',  badge:recruiters.filter(r=>r.status==='pending').length||null, badgeColor:'orange' as const },
                { id:'needs',        icon:Bell,            label:t.admin.needs,                    badge:needs.length||null, badgeColor:'blue' as const },
              ].map(item => (
                <NavItem key={item.id} icon={item.icon} label={item.label} active={activeTab===item.id} onClick={() => goTo(item.id as any)} badge={item.badge} badgeColor={item.badgeColor} />
              ))}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 px-2 mb-2 mt-4">Gestion</p>
              {[
                { id:'diagnostics', icon:Search,   label:t.admin.pitchLeads },
                { id:'users',       icon:UserPlus, label:t.admin.userManagement||'Utilisateurs' },
                { id:'pricing',     icon:Crown,    label:lang==='EN'?'Subscriptions':lang==='AR'?'الاشتراكات':'Abonnements' },
                { id:'settings',    icon:Settings, label:t.admin.settings },
              ].map(item => (
                <NavItem key={item.id} icon={item.icon} label={item.label} active={activeTab===item.id} onClick={() => goTo(item.id as any)} />
              ))}
            </nav>
            {/* Drawer footer */}
            <div className="p-3 border-t border-white/[0.06] flex gap-2">
              <button onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR' as any)} className="flex-1 py-2.5 rounded-lg bg-white/5 text-white/60 text-[11px] font-bold uppercase hover:bg-white/10 transition-all">{lang}</button>
              <button onClick={() => { lgOut(); setMobileDrawerOpen(false); }} className="flex-1 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-bold uppercase flex items-center justify-center gap-1.5 hover:bg-red-500/20 transition-all border border-red-500/20">
                <LogOut size={12} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── DESKTOP LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden min-w-0" style={{width:'100%', maxWidth:'100vw'}}>
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden lg:flex w-60 min-w-[240px] bg-[#12152B] text-white flex-col overflow-hidden shrink-0">
          <div className="px-5 py-5 border-b border-white/[0.06] cursor-pointer shrink-0 flex items-center gap-3" onClick={onBack}>
            <Logo inverted />
            <div className="text-[10px] text-[#4F6EF7] font-semibold uppercase tracking-wider truncate">{t.admin.adminConsole}</div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-2">
            <div className="pt-4 pb-1">
              <div className="text-[10px] font-semibold tracking-[1px] uppercase text-white/25 px-2.5 mb-1.5">{t.admin.navMain || t.admin.navMain || 'Main'}</div>
              <NavItem icon={LayoutDashboard} label={t.admin.dashboard} active={activeTab==='dashboard'} onClick={() => goTo('dashboard')} />
              <NavItem icon={Briefcase} label={t.admin.jobs} active={activeTab==='jobs'} onClick={() => goTo('jobs')} badge={jobs.length||null} />
              <NavItem icon={Users} label={t.admin.apps} active={activeTab==='applications'} onClick={() => goTo('applications')} badge={applications.filter((a:any)=>(a.status||'new')==='new').length||null} badgeColor="orange" />
              <NavItem icon={Building2} label={t.admin.recruiters||'Recruteurs'} active={activeTab==='recruiters'} onClick={() => goTo('recruiters')} badge={recruiters.filter(r=>r.status==='pending').length||null} badgeColor="orange" />
              <NavItem icon={Bell} label={t.admin.needs} active={activeTab==='needs'} onClick={() => goTo('needs')} badge={needs.length||null} />
            </div>
            <div className="pt-5 pb-1">
              <div className="text-[10px] font-semibold tracking-[1px] uppercase text-white/25 px-2.5 mb-1.5">{t.admin.navManagement || t.admin.navManagement || 'Management'}</div>
              <NavItem icon={Search} label={t.admin.pitchLeads} active={activeTab==='diagnostics'} onClick={() => goTo('diagnostics')} />
              <NavItem icon={UserPlus} label={t.admin.userManagement||'Utilisateurs'} active={activeTab==='users'} onClick={() => goTo('users')} />
              <NavItem icon={Crown} label="Abonnements" active={activeTab==='pricing'} onClick={() => goTo('pricing')} />
              <NavItem icon={MessageSquare} label="Messages" active={activeTab==='messages'} onClick={() => goTo('messages')} badge={adminMessages.filter((m:any)=>m.type==='modification_request'&&m.status==='pending').length||undefined} badgeColor="orange" />
              <NavItem icon={Settings} label={t.admin.settings} active={activeTab==='settings'} onClick={() => goTo('settings')} />
            </div>
          </nav>
          <div className="border-t border-white/[0.06] p-3 shrink-0">
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#1E2240] transition-colors cursor-pointer">
              <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-[12px] font-bold text-white shrink-0 overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : (user?.displayName?.[0]?.toUpperCase() || 'A')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-white truncate">{user.displayName}</p>
                <p className="text-[11px] text-white/40 truncate">{t.admin.superAdmin}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => setLang(lang==='FR'?'EN':'FR' as any)} className="bg-white/5 hover:bg-[#1E2240] py-2 rounded-lg border border-white/5 text-[10px] font-bold uppercase text-white/60 hover:text-white transition-all">{lang}</button>
              <button onClick={lgOut} className="bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] py-2 rounded-lg border border-[#EF4444]/20 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5"><LogOut size={12} /> {t.admin.logout}</button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{width:0}}>
          {/* Desktop header */}
          <header className="hidden lg:flex h-16 bg-white border-b border-gray-100 items-center justify-between px-6 shrink-0">
            <div className="relative w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder={t.admin.searchAll} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#4F6EF7]/20 outline-none border border-gray-200 transition-all" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400 font-medium">{typeof window!=='undefined' ? new Date().toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR',{day:'numeric',month:'long',year:'numeric'}) : ''}</span>
              <button onClick={() => setShowNotifPanel(v => !v)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all relative">
                <Bell size={18} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <div className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 bg-[#E8531A] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {notifications.filter(n => !n.read).length}
                  </div>
                )}
              </button>
            </div>
          </header>

          {/* Notification dropdown panel */}
          <AnimatePresence>
            {showNotifPanel && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-4 sm:right-6 top-14 sm:top-16 w-[90vw] max-w-sm bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-black text-gray-900">Notifications</p>
                    {notifications.some(n => !n.read) && (
                      <button
                        onClick={async () => {
                          const unread = notifications.filter(n => !n.read);
                          await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})));
                        }}
                        className="text-[10px] font-bold text-[#4F6EF7] uppercase hover:underline"
                      >
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-gray-300">
                        <Bell size={28} strokeWidth={1.5} className="mx-auto mb-2" />
                        <p className="text-xs font-bold">Aucune notification</p>
                      </div>
                    ) : (
                      notifications.slice(0, 20).map(n => (
                        <button
                          key={n.id}
                          onClick={async () => {
                            if (!n.read) await updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
                            if (n.type === 'new_application') { setActiveTab('applications'); setShowNotifPanel(false); }
                          }}
                          className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-[#4F6EF7]' : 'bg-transparent'}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{n.title}</p>
                            <p className="text-[11px] text-gray-500 truncate">{n.message}</p>
                            <p className="text-[9px] text-gray-300 font-bold mt-0.5">
                              {n.createdAt?.toDate?.()?.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) || ''}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Mobile search bar */}
          <div className="lg:hidden bg-white border-b border-gray-100 px-3 py-2 shrink-0 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 rounded-xl py-2.5 pl-9 pr-4 text-[13px] font-medium outline-none border border-gray-200 focus:border-[#4F6EF7]/50 transition-all" />
            </div>
          </div>

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 pb-20 lg:pb-0" style={{WebkitOverflowScrolling:'touch', overscrollBehaviorY:'contain'}}>
            <div className="px-3 py-3 lg:px-8 lg:py-8 w-full lg:max-w-[1600px] lg:mx-auto box-border">
            {activeTab === 'dashboard' ? (
              <div className="flex flex-col gap-5" style={{ fontFamily: "'Inter', sans-serif" }}>

                {/* ── Topbar ── */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-gray-900" style={{ letterSpacing: '-0.3px' }}>{lang==='EN'?'Dashboard':lang==='AR'?'لوحة التحكم':'Tableau de bord'}</p>
                    <button onClick={() => { setEditingJob(null); setNewJob({ title: '', companyName: '', sector: 'btp', location: 'Djibouti', type: 'CDI', company: '🏢', tags: 'Urgent', profileCount: 1, expRequired: 3, urgency: 'medium', deadline: '', diplomaRequired: '', salaryRange: '', description: '', skills: '', selectedRecruiterId: '' }); setSelectedSkillsJob([]); setSkillInputJob(''); setShowAddJob(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white shrink-0 transition-opacity hover:opacity-90"
                      style={{ background: '#4F6EF7', border: 'none', cursor: 'pointer' }}>
                      <Plus size={13} /> {lang==='EN'?'New':lang==='AR'?'جديد':'New'}
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    {new Date().toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })} · {lang==='EN'?'Week':lang==='AR'?'الأسبوع':'Semaine'} {Math.ceil(new Date().getDate() / 7)}
                  </p>
                </div>

                {/* ── KPI Grid ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    {
                      label: lang==='EN'?'Applications received':lang==='AR'?'الطلبات المستلمة':'Candidatures reçues',
                      value: applications.length,
                      trend: '+18%', up: true,
                      iconColor: '#4F6EF7', iconBg: '#EEF1FE',
                      barColor: '#4F6EF7', barW: Math.min(99, applications.length * 2 + 30),
                      onClick: () => setActiveTab('applications'),
                      icon: (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <circle cx="10" cy="7" r="3"/><path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
                        </svg>
                      ),
                    },
                    {
                      label: lang==='EN'?'Open positions':lang==='AR'?'الوظائف المفتوحة':'Postes ouverts',
                      value: jobs.filter((j: any) => j.status === 'active' || !j.status).length,
                      trend: `+${Math.max(0, jobs.length - 3)} ${lang==='EN'?'new':lang==='AR'?'جديد':'nouveaux'}`, up: true,
                      iconColor: '#10B981', iconBg: '#ECFDF5',
                      barColor: '#10B981', barW: Math.min(99, jobs.length * 5 + 20),
                      onClick: () => setActiveTab('jobs'),
                      icon: (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <rect x="3" y="4" width="14" height="12" rx="2"/><path d="M7 8h6M7 12h4"/>
                        </svg>
                      ),
                    },
                    {
                      label: lang==='EN'?'Planned interviews':lang==='AR'?'المقابلات المجدولة':'Interviews planifiés',
                      value: applications.filter((a: any) => a.status === 'interview').length,
                      trend: '+12%', up: true,
                      iconColor: '#F59E0B', iconBg: '#FFFBEB',
                      barColor: '#F59E0B', barW: Math.min(99, applications.filter((a: any) => a.status === 'interview').length * 8 + 10),
                      onClick: () => setActiveTab('applications'),
                      icon: (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <rect x="3" y="3" width="14" height="14" rx="2"/><path d="M8 3v3M12 3v3M3 9h14"/>
                        </svg>
                      ),
                    },
                    {
                      label: lang==='EN'?'Client needs':lang==='AR'?'احتياجات العملاء':'Besoins clients',
                      value: needs.length,
                      trend: needs.length > 0 ? `+${needs.length}` : '0', up: needs.length > 0,
                      iconColor: '#EF4444', iconBg: '#FEF2F2',
                      barColor: '#EF4444', barW: Math.min(99, needs.length * 10 + 5),
                      onClick: () => setActiveTab('needs'),
                      icon: (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <path d="M10 2a6 6 0 016 6c0 4-2 6-2 8H6c0-2-2-4-2-8a6 6 0 016-6z"/>
                          <path d="M8 16a2 2 0 004 0"/>
                        </svg>
                      ),
                    },
                  ] as any[]).map(({ label, value, trend, up, iconColor, iconBg, barColor, barW, onClick, icon }) => (
                    <button key={label} onClick={onClick} style={{
                      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
                      padding: '14px', display: 'flex', flexDirection: 'column', gap: 10,
                      textAlign: 'left', cursor: 'pointer', transition: 'box-shadow 0.2s', minWidth: 0,
                    }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.07)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', lineHeight: 1.3, minWidth: 0 }}>{label}</span>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {icon}
                        </div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600,
                          padding: '2px 5px', borderRadius: 5,
                          color: up ? '#10B981' : '#EF4444',
                          background: up ? '#ECFDF5' : '#FEF2F2',
                        }}>
                          {up
                            ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><path d="M2 8l4-4 4 4"/></svg>
                            : <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><path d="M2 4l4 4 4-4"/></svg>
                          }
                          {trend}
                        </span>
                      </div>
                      <div style={{ height: 3, background: '#F0F2F8', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${barW}%`, background: barColor, borderRadius: 2, transition: 'width 1s ease' }} />
                      </div>
                    </button>
                  ))}
                </div>

                {/* ── Pipeline + Activité ── */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

                  {/* Pipeline Kanban */}
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>{t.admin.recruitmentPipeline}</p>
                        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{t.admin.activeCandidatesByStep}</p>
                      </div>
                      <button onClick={() => setActiveTab('applications')}
                        style={{ fontSize: 12, fontWeight: 600, color: '#4F6EF7', cursor: 'pointer', border: 'none', background: 'none' }}>
                        {t.admin.seeAll} →
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                      {([
                        { label: lang==='EN'?'Application':lang==='AR'?'الطلب':'Candidature', key: 'new',       lineColor: '#C4B5FD' },
                        { label: lang==='EN'?'Screening':lang==='AR'?'الفرز':'Présélection', key: 'reviewing', lineColor: '#93C5FD' },
                        { label: lang==='EN'?'HR Interview':lang==='AR'?'مقابلة الموارد البشرية':'Interview RH', key: 'interview', lineColor: '#6EE7B7' },
                        { label: lang==='EN'?'Tech test':lang==='AR'?'اختبار تقني':'Test tech.', key: 'hired',     lineColor: '#F59E0B' },
                        { label: 'Offre',        key: 'rejected',  lineColor: '#10B981' },
                      ] as any[]).map(({ label, key, lineColor }) => {
                        const stageApps = applications.filter((a: any) => (a.status || 'new') === key).slice(0, 2);
                        const count = applications.filter((a: any) => (a.status || 'new') === key).length;
                        const avatarColors = ['linear-gradient(135deg,#a78bfa,#7c3aed)', 'linear-gradient(135deg,#86efac,#16a34a)', 'linear-gradient(135deg,#fda4af,#e11d48)', 'linear-gradient(135deg,#fdba74,#ea580c)', 'linear-gradient(135deg,#67e8f9,#0891b2)', 'linear-gradient(135deg,#6ee7b7,#059669)'];
                        return (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6B7280' }}>{label}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', background: '#F0F2F8', padding: '1px 6px', borderRadius: 10 }}>{count}</span>
                            </div>
                            <div style={{ height: 3, background: lineColor, borderRadius: 2, marginBottom: 6 }} />
                            {stageApps.map((app: any, i: number) => {
                              const initials = (app.fullName || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                              const score = app.matchScore || app.aiScore || Math.floor(60 + ((app.fullName?.charCodeAt(0) || 65) % 35));
                              const scoreStyle = score >= 80 ? { background: '#ECFDF5', color: '#10B981' } : score >= 60 ? { background: '#FFFBEB', color: '#F59E0B' } : { background: '#FEF2F2', color: '#EF4444' };
                              const daysAgo = app.createdAt?.seconds ? Math.floor((Date.now() - app.createdAt.seconds * 1000) / 86400000) : null;
                              return (
                                <div key={i}
                                  style={{ background: '#F0F2F8', border: '1px solid #E5E7EB', borderRadius: 8, padding: 10, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                                  onClick={() => setActiveTab('applications')}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', fontSize: 10, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: avatarColors[i % avatarColors.length] }}>
                                      {initials}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>{app.fullName}</div>
                                      <div style={{ fontSize: 10.5, color: '#6B7280' }}>{app.jobTitle || (lang==='EN'?'Application':lang==='AR'?'الطلب':'Candidature')}</div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, ...scoreStyle }}>{score}%</span>
                                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>{daysAgo === null ? '—' : daysAgo === 0 ? "auj." : `il y a ${daysAgo}j`}</span>
                                  </div>
                                </div>
                              );
                            })}
                            {count === 0 && (
                              <div style={{ border: '2px dashed #E5E7EB', borderRadius: 8, padding: '12px 0', textAlign: 'center' }}>
                                <span style={{ fontSize: 10, color: '#D1D5DB' }}>{t.admin.none}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* {t.admin.recentActivity} */}
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>{t.admin.recentActivity}</p>
                        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{t.admin.lastActions}</p>
                      </div>
                      <button onClick={() => setActiveTab('applications')}
                        style={{ fontSize: 12, fontWeight: 600, color: '#4F6EF7', cursor: 'pointer', border: 'none', background: 'none' }}>
                        {lang==='EN'?'See all':lang==='AR'?'عرض الكل':'Tout voir'}
                      </button>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      {applications.length === 0 ? (
                        <div style={{ padding: '32px 0', textAlign: 'center', color: '#D1D5DB', fontSize: 12 }}>{t.admin.noRecentActivity}</div>
                      ) : applications.slice(0, 6).map((app: any, i: number) => {
                        const dotColors = ['#10B981', '#4F6EF7', '#a78bfa', '#F59E0B', '#EF4444', '#10B981'];
                        const isLast = i === Math.min(applications.length, 6) - 1;
                        const msgs = [
                          <span key={0}><strong style={{ fontWeight: 600 }}>{app.fullName}</strong> {t.admin.appliedFor} <strong style={{ fontWeight: 600 }}>{app.jobTitle || '{t.admin.aPosition}'}</strong></span>,
                          <span key={1}>{t.admin.appReceivedFrom} <strong style={{ fontWeight: 600 }}>{app.fullName}</strong></span>,
                          <span key={2}>{t.admin.cvAnalyzedBy} <strong style={{ fontWeight: 600 }}>IA</strong> — profile {app.fullName}</span>,
                          <span key={3}>{t.admin.interviewScheduledWith} <strong style={{ fontWeight: 600 }}>{app.fullName}</strong></span>,
                          <span key={4}>{t.admin.profileUpdated} <strong style={{ fontWeight: 600 }}>{app.fullName}</strong></span>,
                          <span key={5}><strong style={{ fontWeight: 600 }}>{app.fullName}</strong> — {t.admin.newAppReceived}</span>,
                        ];
                        const times = ['il y a 23 min', 'il y a 1h', 'il y a 2h', 'il y a 3h', 'il y a 5h', 'il y a 6h'];
                        return (
                          <div key={i} style={{ display: 'flex', gap: 12, paddingTop: 11, paddingBottom: 11, borderBottom: isLast ? 'none' : '1px solid #E5E7EB' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColors[i % 6], flexShrink: 0, marginTop: 4 }} />
                              {!isLast && <div style={{ width: 1, flex: 1, background: '#E5E7EB', marginTop: 4 }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, color: '#111827', lineHeight: 1.4 }}>{msgs[i % 6]}</div>
                              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{times[i % 6]}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── {t.admin.activeJobs} + Graphique ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Jobs table */}
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>{t.admin.activeJobs}</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {lang==='EN'?['All','Open','On hold']:lang==='AR'?['الكل','مفتوح','موقوف']:['Tous','Ouverts','En pause'].map((f, fi) => (
                          <button key={f} style={{
                            fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
                            border: `1px solid ${fi === 0 ? '#4F6EF7' : '#E5E7EB'}`,
                            background: fi === 0 ? '#4F6EF7' : 'transparent',
                            color: fi === 0 ? '#fff' : '#6B7280',
                            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                          }}>{f}</button>
                        ))}
                      </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E5E7EB' }}>
                          {lang==='EN'?['Position','Status','Candidates','Progress']:lang==='AR'?['المنصب','الحالة','المرشحون','التقدم']:['Poste','Statut','Candidats','Progression'].map(h => (
                            <th key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '11px 20px', textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.slice(0, 5).map((job: any, i: number) => {
                          const count = applications.filter((a: any) => a.jobId === job.id || a.jobTitle === job.title).length;
                          const pct = Math.min(99, count * 8 + ((i * 17 + 15) % 70));
                          const isActive = !job.status || job.status === 'active';
                          const barColor = pct > 70 ? '#10B981' : pct > 40 ? '#4F6EF7' : '#F59E0B';
                          return (
                            <tr key={job.id}
                              style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFD')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              onClick={() => setActiveTab('jobs')}>
                              <td style={{ padding: '13px 20px', fontSize: 13, verticalAlign: 'middle' }}>
                                <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{job.title}</div>
                                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{job.sector || 'Général'} · {job.location || 'Djibouti'}</div>
                              </td>
                              <td style={{ padding: '13px 20px', verticalAlign: 'middle' }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, display: 'inline-block',
                                  background: isActive ? '#ECFDF5' : '#FFFBEB',
                                  color: isActive ? '#10B981' : '#F59E0B',
                                }}>{isActive ? (lang==='EN'?'Open':lang==='AR'?'مفتوح':'Ouvert') : (lang==='EN'?'On hold':lang==='AR'?'موقوف':'En pause')}</span>
                              </td>
                              <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 600, verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums' }}>{count}</td>
                              <td style={{ padding: '13px 20px', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 5, background: '#F0F2F8', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', width: 28, textAlign: 'right' }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {jobs.length === 0 && (
                          <tr><td colSpan={4} style={{ padding: '32px 20px', textAlign: 'center', fontSize: 12, color: '#D1D5DB' }}>{t.admin.noActiveJobs}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Graphique SVG */}
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>{lang==='EN'?'Applications & Recruitments':lang==='AR'?'الطلبات والتوظيف':'Candidatures & Recrutements'}</p>
                        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{lang==='EN'?'Last 6 months':lang==='AR'?'آخر 6 أشهر':'6 derniers mois'}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                      {[{ color: '#4F6EF7', label: lang==='EN'?'Applications':lang==='AR'?'الطلبات':'Candidatures' }, { color: '#10B981', label: lang==='EN'?'Recruitments':lang==='AR'?'التوظيف':'Recrutements' }].map(({ color, label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                          <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 160, position: 'relative' }}>
                      <svg viewBox="0 0 400 160" width="100%" height="100%" style={{ overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="tfGradBlue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4F6EF7" stopOpacity="0.18"/>
                            <stop offset="100%" stopColor="#4F6EF7" stopOpacity="0"/>
                          </linearGradient>
                          <linearGradient id="tfGradGreen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.18"/>
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="160" x2="400" y2="160" stroke="#E5E7EB" strokeWidth="1"/>
                        <line x1="0" y1="120" x2="400" y2="120" stroke="#F3F4F6" strokeWidth="1"/>
                        <line x1="0" y1="80" x2="400" y2="80" stroke="#F3F4F6" strokeWidth="1"/>
                        <line x1="0" y1="40" x2="400" y2="40" stroke="#F3F4F6" strokeWidth="1"/>
                        <path d="M0,130 C30,120 60,100 80,90 C100,80 130,60 160,55 C190,50 220,70 250,60 C280,50 310,30 340,25 C360,22 380,20 400,18 L400,160 L0,160 Z" fill="url(#tfGradBlue)"/>
                        <path d="M0,130 C30,120 60,100 80,90 C100,80 130,60 160,55 C190,50 220,70 250,60 C280,50 310,30 340,25 C360,22 380,20 400,18" fill="none" stroke="#4F6EF7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M0,150 C30,146 60,140 80,138 C100,136 130,128 160,122 C190,116 220,125 250,118 C280,111 310,100 340,95 C360,92 380,88 400,85 L400,160 L0,160 Z" fill="url(#tfGradGreen)"/>
                        <path d="M0,150 C30,146 60,140 80,138 C100,136 130,128 160,122 C190,116 220,125 250,118 C280,111 310,100 340,95 C360,92 380,88 400,85" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        {([0,80,160,250,340,400] as number[]).map((x, i) => {
                          const by = [130,90,55,60,25,18][i];
                          const gy = [150,138,122,118,95,85][i];
                          return (
                            <g key={i}>
                              <circle cx={x} cy={by} r="3.5" fill="#4F6EF7"/>
                              <circle cx={x} cy={gy} r="3.5" fill="#10B981"/>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
                      {['Jan','Fév','Mar','Avr','Mai','Juin'].map(m => (
                        <span key={m} style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{m}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'jobs' ? (
              <div className="space-y-4 w-full">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="min-w-0">
                    <h1 className="text-lg lg:text-3xl font-black text-gray-900 tracking-tight truncate">{t.admin.jobCatalog}</h1>
                    <p className="text-gray-400 text-xs font-medium mt-0.5 hidden sm:block">{t.admin.manageOffers}</p>
                  </div>
                  <button
                    onClick={() => { setEditingJob(null); setNewJob({ title: '', companyName: '', sector: 'btp', location: 'Djibouti', type: 'CDI', company: '🏢', tags: 'Urgent', profileCount: 1, expRequired: 3, urgency: 'medium', deadline: '', diplomaRequired: '', salaryRange: '', description: '', skills: '', selectedRecruiterId: '' }); setSelectedSkillsJob([]); setSkillInputJob(''); setShowAddJob(true); }}
                    className="shrink-0 flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide hover:bg-gray-700 transition-all"
                  >
                    <Plus size={14} /> <span>{t.admin.publish}</span>
                  </button>
                </div>
                {/* Stats pills */}
                <div className="flex gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-[11px] font-black text-gray-700 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />{jobs.filter((j:any)=>j.status==='active'||!j.status).length} actives
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-[11px] font-black text-gray-400 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />{jobs.filter((j:any)=>j.status==='closed').length} archivées
                  </span>
                </div>

                <div className="hidden lg:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.jobTitlePlace}</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.company}</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.sector}</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.expiresOn}</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.status}</th>
                        <th className="px-6 py-5 text-right text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredJobs.map(job => (
                        <tr key={job.id} className="hover:bg-gray-50/30 transition-all group">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl grayscale group-hover:grayscale-0 transition-all duration-500">{job.company}</div>
                              <div>
                                <p className="text-sm font-black text-gray-900 leading-tight">{job.title}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">{job.type} · {job.location}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm font-semibold text-gray-600">{job.companyName}</td>
                          <td className="px-6 py-5">
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg">{job.sector}</span>
                          </td>
                          <td className="px-6 py-5 text-sm font-medium text-gray-400">
                            {job.expiresAt ? new Date(job.expiresAt.toDate()).toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR') : '—'}
                          </td>
                          <td className="px-6 py-5">
                            <button onClick={() => updateStatus('jobs', job.id, job.status === 'active' ? 'closed' : 'active')}
                              className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border transition-all ${job.status === 'active' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${job.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {job.status === 'active' ? t.admin.online : t.admin.archivedStatus}
                            </button>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {job.expiresAt && new Date(job.expiresAt.toDate()) < new Date(Date.now() + 7*24*60*60*1000) && (
                                <button onClick={() => handleRenewJob(job.id)} className="w-9 h-9 flex items-center justify-center bg-gray-900 text-white rounded-xl hover:scale-110 transition-all" title={t.admin.renew}><RefreshCw size={14} /></button>
                              )}
                              <button onClick={() => handleEditJob(job)} className="w-9 h-9 flex items-center justify-center bg-gray-900 text-white rounded-xl hover:scale-110 transition-all"><Edit size={14} /></button>
                              <button onClick={() => handleDeleteJob(job.id)} className="w-9 h-9 flex items-center justify-center bg-red-500 text-white rounded-xl hover:scale-110 transition-all"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredJobs.length === 0 && <div className="p-20 text-center text-gray-200 uppercase font-black tracking-[0.5em] italic">{t.admin.noData}</div>}
                </div>

                {/* ── CARDS mobile (lg:hidden) ── */}
                <div className="lg:hidden space-y-3 w-full">
                  {filteredJobs.length === 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-300 uppercase font-black tracking-widest text-xs">{t.admin.noData}</div>
                  )}
                  {filteredJobs.map(job => {
                    const isActive = !job.status || job.status === 'active';
                    const expiringSoon = job.expiresAt && new Date(job.expiresAt.toDate()) < new Date(Date.now() + 7*24*60*60*1000);
                    return (
                      <div key={job.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full box-border">
                        {/* Card top */}
                        <div className="flex items-start gap-3 p-3.5">
                          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-lg shrink-0">{job.company}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-900 text-sm leading-tight">{job.title || '—'}</p>
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5 truncate">{job.companyName || '—'}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">{job.type}</span>
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">{job.sector}</span>
                              <span className="text-[10px] text-gray-400 font-medium px-1">· {job.location}</span>
                            </div>
                          </div>
                          <span className={`shrink-0 flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1 rounded-full border ${isActive ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                            {isActive ? 'En ligne' : 'Archivé'}
                          </span>
                        </div>
                        {/* Expiry */}
                        {job.expiresAt && (
                          <div className={`mx-3.5 mb-3 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg ${expiringSoon ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-gray-50 text-gray-400'}`}>
                            <Clock size={11} className="shrink-0" />
                            <span>Expire le {new Date(job.expiresAt.toDate()).toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR')}</span>
                            {expiringSoon && <span className="ml-auto text-[9px] font-black uppercase text-amber-500">⚠ Bientôt</span>}
                          </div>
                        )}
                        {/* Actions */}
                        <div className="flex border-t border-gray-100">
                          <button onClick={() => updateStatus('jobs', job.id, isActive ? 'closed' : 'active')}
                            className={`flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-black uppercase transition-all ${isActive ? 'text-green-600 active:bg-green-50' : 'text-gray-500 active:bg-gray-50'}`}>
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                            {isActive ? 'Désactiver' : 'Activer'}
                          </button>
                          <div className="w-px bg-gray-100" />
                          {expiringSoon && (
                            <>
                              <button onClick={() => handleRenewJob(job.id)} className="flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-black uppercase text-amber-600 active:bg-amber-50 transition-all">
                                <RefreshCw size={11} /> Renouveler
                              </button>
                              <div className="w-px bg-gray-100" />
                            </>
                          )}
                          <button onClick={() => handleEditJob(job)} className="flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-black uppercase text-gray-600 active:bg-gray-50 transition-all">
                            <Edit size={11} /> Modifier
                          </button>
                          <div className="w-px bg-gray-100" />
                          <button onClick={() => handleDeleteJob(job.id)} className="flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-black uppercase text-red-500 active:bg-red-50 transition-all">
                            <Trash2 size={11} /> Suppr.
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            ) : activeTab === 'applications' ? (() => {

              // ── CONSTANTES ATS ─────────────────────────────────────────
              const STATUS_TABS = [
                { key:'all',       label:lang==='EN'?'All':lang==='AR'?'الكل':'Tous',       color:'bg-slate-600' },
                { key:'new',       label:'Reçus',      color:'bg-gray-500'  },
                { key:'reviewing', label:'En cours',   color:'bg-blue-600'  },
                { key:'interview', label:'Interview',  color:'bg-violet-600'},
                { key:'hired',     label:'Acceptés',   color:'bg-emerald-600'},
                { key:'rejected',  label:'Refusés',    color:'bg-red-500'   },
              ];
              const STATUS_COLORS: Record<string,{bg:string;text:string;dot:string;badge:string}> = {
                new:       {bg:'bg-slate-50',   text:'text-slate-600',  dot:'bg-slate-400',   badge:'bg-slate-100 text-slate-600'  },
                reviewing: {bg:'bg-blue-50',    text:'text-blue-700',   dot:'bg-blue-500',    badge:'bg-blue-100 text-blue-700'    },
                interview: {bg:'bg-violet-50',  text:'text-violet-700', dot:'bg-violet-500',  badge:'bg-violet-100 text-violet-700'},
                hired:     {bg:'bg-emerald-50', text:'text-emerald-700',dot:'bg-emerald-500', badge:'bg-emerald-100 text-emerald-700'},
                rejected:  {bg:'bg-red-50',     text:'text-red-600',    dot:'bg-red-400',     badge:'bg-red-100 text-red-600'      },
              };
              const STATUS_LABELS: Record<string,string> = {
                new:'Received', reviewing:'In review', interview:'Interview', hired:'Accepted', rejected:'Rejected'
              };
              const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-indigo-500','bg-rose-500'];

              // ── SCORE IA ──────────────────────────────────────────────
              const computeScore = (a: any): number => {
                let s = 30; // base
                if (a.cvUrl) s += 25;
                if (a.education && a.education !== 'Sans diplôme') s += 15;
                const exp = parseInt(a.experience)||0;
                s += Math.min(15, exp * 2);
                if ((a.languages||'').split(',').filter(Boolean).length >= 2) s += 10;
                if (a.availability === 'Immédiate' || a.availability === 'immediate') s += 5;
                return Math.min(99, s);
              };
              const scoreColor = (s: number) => s >= 80 ? {bar:'bg-emerald-500',text:'text-emerald-600',ring:'ring-emerald-200'} :
                                                s >= 60 ? {bar:'bg-amber-500',  text:'text-amber-600',  ring:'ring-amber-200'  } :
                                                          {bar:'bg-red-400',    text:'text-red-500',     ring:'ring-red-200'    };

              // ── RÉSUMÉ IA ────────────────────────────────────────────
              const buildSummary = (a: any): string => {
                const exp = parseInt(a.experience)||0;
                const expStr = exp > 0 ? `${exp} year${exp>1?'s':''} of experience` : 'Junior profile';
                const sector = a.sector || a.jobTitle || 'their field';
                const dispo = (a.availability === 'Immédiate' || a.availability === 'immediate') ? 'immediately available' : a.availability ? `available ${a.availability.toLowerCase()}` : 'availability to confirm';
                const edu = a.education && a.education !== 'Sans diplôme' ? `, holding a ${a.education}` : '';
                const langs = (a.languages||'').split(',').filter(Boolean).slice(0,3).join(', ');
                const langStr = langs ? `, speaks ${langs}` : '';
                return `Candidate with ${expStr} in ${sector}${edu}${langStr}, ${dispo}.`;
              };

              // ── FILTRAGE + PAGINATION ────────────────────────────────
              const appsFiltered = applications
                .filter(a => appStatusFilter === 'all' || a.status === appStatusFilter)
                .filter(a => {
                  if (!appSearch) return true;
                  const s = appSearch.toLowerCase();
                  return (a.fullName||'').toLowerCase().includes(s)
                    || (a.jobTitle||'').toLowerCase().includes(s)
                    || (a.nationality||'').toLowerCase().includes(s)
                    || (a.sector||'').toLowerCase().includes(s)
                    || (a.email||'').toLowerCase().includes(s);
                })
                .sort((a,b) => {
                  if (appSort === 'score') return computeScore(b) - computeScore(a);
                  const da = a.createdAt?.seconds||0, db2 = b.createdAt?.seconds||0;
                  return appSort === 'newest' ? db2 - da : da - db2;
                });

              const totalPages = Math.ceil(appsFiltered.length / APP_PAGE_SIZE);
              const paginated  = appsFiltered.slice((appPage-1)*APP_PAGE_SIZE, appPage*APP_PAGE_SIZE);

              const app = selectedApp ? (applications.find(a => a.id === selectedApp.id) || selectedApp) : null;
              const appScore = app ? computeScore(app) : 0;
              const sc2 = scoreColor(appScore);

              const DETAIL_TABS_ATS = [
                { key:'Profil',     label:'Profil',         icon:'👤' },
                { key:'Experience', label:'Expérience',     icon:'💼' },
                { key:'Skills',     label:'Skills',    icon:'🛠' },
                { key:'Documents',  label:'CV & Docs',      icon:'📄' },
                { key:'Notes',      label:'Notes',          icon:'📝' },
                { key:'History',    label:'Historique',     icon:'🕐' },
              ];

              return (
              <div className="flex gap-0 h-full relative" style={{minHeight:'calc(100vh - 140px)'}}>

                {/* ════════════════════════════════════════════════════
                    COLONNE GAUCHE — 35%
                ════════════════════════════════════════════════════ */}
                <div className={`flex flex-col bg-white border-r border-gray-100 overflow-hidden ${selectedApp ? "hidden lg:flex" : "flex w-full"}`}
                  style={{width: selectedApp ? '35%' : '100%', transition:'width 0.25s ease', minWidth: selectedApp ? '320px' : 'auto'}}>

                  {/* Header */}
                  <div className="px-5 pt-5 pb-4 border-b border-gray-100 space-y-4 shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="text-xl font-black text-gray-900 tracking-tight">
                          Base <span className="text-blue-600">Candidats</span>
                        </h1>
                        <p className="text-gray-400 text-xs font-medium mt-0.5">{applications.length} candidature{applications.length>1?'s':''} au total</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setShowAddApplication(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-all shadow-sm shadow-blue-600/20">
                          <Plus size={13}/> Ajouter
                        </button>
                      </div>
                    </div>

                    {/* Recherche */}
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5">
                      <Search size={14} className="text-gray-400 shrink-0"/>
                      <input value={appSearch} onChange={e=>{setAppSearch(e.target.value);setAppPage(1);}}
                        placeholder="Nom, poste, secteur, email..."
                        className="flex-1 bg-transparent outline-none text-sm text-gray-700 font-medium placeholder:text-gray-300"/>
                      {appSearch && <button onClick={()=>setAppSearch('')} className="text-gray-300 hover:text-gray-500"><X size={13}/></button>}
                    </div>

                    {/* Status tabs + tri */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                        {STATUS_TABS.map(tab => {
                          const count = tab.key==='all' ? applications.length : applications.filter(a=>a.status===tab.key).length;
                          const active = appStatusFilter === tab.key;
                          return (
                            <button key={tab.key} onClick={()=>{setAppStatusFilter(tab.key);setAppPage(1);setSelectedApp(null);}}
                              className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${active ? `${tab.color} text-white shadow-sm` : 'text-gray-400 hover:bg-gray-50'}`}>
                              {tab.label}
                              {count > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${active?'bg-white/25 text-white':'bg-gray-100 text-gray-500'}`}>{count}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <select value={appSort} onChange={e=>setAppSort(e.target.value as any)}
                        className="shrink-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[10px] font-black text-gray-600 outline-none appearance-none">
                        <option value="newest">{t.admin.sortNewest}</option>
                        <option value="oldest">{t.admin.sortOldest}</option>
                        <option value="score">Score IA</option>
                      </select>
                    </div>
                  </div>

                  {/* Liste candidats */}
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-50 pb-20 lg:pb-0">
                    {paginated.length === 0 && (
                      <div className="py-20 text-center">
                        <Users size={36} strokeWidth={1} className="mx-auto mb-3 text-gray-200"/>
                        <p className="font-black text-gray-400 text-sm">{t.admin.none} candidat</p>
                      </div>
                    )}
                    {paginated.map((a) => {
                      const sc = STATUS_COLORS[a.status] || STATUS_COLORS.new;
                      const isSelected = selectedApp?.id === a.id;
                      const avatarBg = AVATAR_COLORS[(a.fullName||'').charCodeAt(0) % AVATAR_COLORS.length];
                      const dateStr = a.createdAt?.seconds ? new Date(a.createdAt.seconds*1000).toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR',{day:'2-digit',month:'short'}) : '—';
                      const score = computeScore(a);
                      const sCol = scoreColor(score);
                      return (
                        <div key={a.id}
                          onClick={()=>{setSelectedApp(isSelected?null:a);if(!isSelected)setDetailTab('Profil');}}
                          className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all group ${isSelected?'bg-blue-50 border-l-[3px] border-blue-600':'border-l-[3px] border-transparent hover:bg-gray-50/80'}`}>
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-xl ${avatarBg} text-white flex items-center justify-center font-black text-sm shrink-0 relative`}>
                            {(a.fullName||'?')[0].toUpperCase()}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${sc.dot}`}/>
                          </div>
                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className={`font-black text-sm truncate ${isSelected?'text-blue-700':'text-gray-900'}`}>{a.fullName||'—'}</p>
                              <span className={`shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${sc.badge}`}>{STATUS_LABELS[a.status]||'Reçu'}</span>
                            </div>
                            <p className="text-xs text-gray-400 font-medium truncate">{a.jobTitle||a.sector||'—'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {a.address && <span className="text-[9px] text-gray-300 font-medium flex items-center gap-0.5"><MapPin size={8}/>{a.address}</span>}
                              {a.experience && <span className="text-[9px] text-gray-300 font-medium">{a.experience} ans</span>}
                            </div>
                          </div>
                          {/* Score + Date */}
                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            <div className={`flex items-center gap-1 text-[10px] font-black ${sCol.text}`}>
                              <span className={`w-2 h-2 rounded-full ${sCol.bar}`}/>
                              {score}%
                            </div>
                            <span className="text-[9px] text-gray-300 font-medium">{dateStr}</span>
                            {a.cvUrl && <span className="text-[8px] bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-md font-black">CV</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
                      <span className="text-[10px] text-gray-400 font-bold">{(appPage-1)*APP_PAGE_SIZE+1}–{Math.min(appPage*APP_PAGE_SIZE,appsFiltered.length)} / {appsFiltered.length}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={()=>setAppPage(p=>Math.max(1,p-1))} disabled={appPage===1}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all text-xs font-black">‹</button>
                        {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                          const pg = appPage <= 3 ? i+1 : appPage >= totalPages-2 ? totalPages-4+i : appPage-2+i;
                          if(pg<1||pg>totalPages) return null;
                          return (
                            <button key={pg} onClick={()=>setAppPage(pg)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${pg===appPage?'bg-blue-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>{pg}</button>
                          );
                        })}
                        <button onClick={()=>setAppPage(p=>Math.min(totalPages,p+1))} disabled={appPage===totalPages}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all text-xs font-black">›</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ════════════════════════════════════════════════════
                    PLACEHOLDER — aucun candidat sélectionné
                ════════════════════════════════════════════════════ */}
                {!app && !selectedApp && (
                  <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-gray-50/50 text-center p-12">
                    <div className="w-20 h-20 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center justify-center mb-6">
                      <Users size={32} strokeWidth={1} className="text-gray-300"/>
                    </div>
                    <p className="font-black text-gray-400 text-lg mb-2">Sélectionnez un candidat</p>
                    <p className="text-gray-300 text-sm font-medium">Cliquez sur un candidat dans la liste pour voir their full profile</p>
                  </div>
                )}

                {/* ════════════════════════════════════════════════════
                    COLONNE DROITE — PROFIL DÉTAILLÉ 65%
                ════════════════════════════════════════════════════ */}
                {app && (
                  <div className="fixed lg:relative inset-0 lg:inset-auto flex-1 flex flex-col overflow-hidden bg-white z-20 lg:z-auto">

                    {/* ── BACK BUTTON MOBILE ── */}
                    <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
                      <button onClick={() => setSelectedApp(null)}
                        className="flex items-center gap-2 text-blue-600 font-black text-sm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        Retour à la liste
                      </button>
                    </div>

                    {/* ── EN-TÊTE PROFIL ── */}
                    <div className="shrink-0 border-b border-gray-100">
                      {/* Top band */}
                      <div className="h-16 bg-gradient-to-r from-[#0F172A] via-[#1E3A5F] to-[#0F172A] relative overflow-hidden">
                        <div className="absolute inset-0 opacity-20" style={{backgroundImage:'radial-gradient(circle at 80% 50%,#3b82f6 0%,transparent 50%)'}}/>
                      </div>

                      <div className="px-7 pb-5 -mt-8">
                        <div className="flex items-end gap-5 mb-4">
                          {/* Avatar grand */}
                          <div className={`w-16 h-16 rounded-2xl ${AVATAR_COLORS[(app.fullName||'').charCodeAt(0) % AVATAR_COLORS.length]} text-white flex items-center justify-center font-black text-2xl ring-4 ring-white shadow-lg shrink-0`}>
                            {(app.fullName||'?')[0].toUpperCase()}
                          </div>
                          {/* Nom + badges */}
                          <div className="flex-1 min-w-0 pt-8">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h2 className="font-black text-gray-900 text-xl tracking-tight">{app.fullName}</h2>
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${(STATUS_COLORS[app.status]||STATUS_COLORS.new).badge}`}>
                                {STATUS_LABELS[app.status]||'Reçu'}
                              </span>
                              {app.cvUrl && <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700">CV ✓</span>}
                            </div>
                            <p className="text-sm text-blue-600 font-black mt-0.5">{app.jobTitle||app.sector||'—'}</p>
                            <div className="flex items-center gap-4 mt-1 flex-wrap">
                              {app.address && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11}/>{app.address}</span>}
                              {app.availability && <span className="text-xs text-green-600 font-bold flex items-center gap-1">● {app.availability}</span>}
                              {app.nationality && <span className="text-xs text-gray-400">{app.nationality}</span>}
                            </div>
                          </div>
                          <button onClick={()=>setSelectedApp(null)} className="mb-0 w-8 h-8 mt-8 shrink-0 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all">
                            <X size={14} className="text-gray-500"/>
                          </button>
                        </div>

                        {/* Score IA + Résumé IA */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {/* Score */}
                          <div className={`rounded-2xl p-4 border ${sc2.ring} ring-2 bg-white shadow-sm`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">🤖 Matching IA</span>
                              <span className={`text-xl font-black ${sc2.text}`}>{appScore}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${sc2.bar} transition-all duration-700`} style={{width:`${appScore}%`}}/>
                            </div>
                            <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                              {appScore>=80?'✅ Highly compatible':appScore>=60?'⚡ Good potential':'⚠️ Partial match'}
                            </p>
                          </div>
                          {/* Résumé IA */}
                          <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1.5">✨ Résumé IA</p>
                            <p className="text-xs text-gray-700 leading-relaxed font-medium">{buildSummary(app)}</p>
                          </div>
                        </div>

                        {/* Actions rapides */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={()=>window.open(`https://wa.me/${(app.whatsapp||app.phone||'').replace(/\s/g,'')}?text=Bonjour ${app.fullName}, Vedior GM vous contacte.`,'_blank')}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white rounded-xl font-black text-xs hover:bg-blue-600 transition-all shadow-sm">
                            <MessageSquare size={13}/> Contact
                          </button>
                          {app.cvUrl && <>
                            <a href={app.cvUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-all">
                              <Eye size={13}/> View CV
                            </a>
                            <a href={app.cvUrl} download={app.cvFileName||'CV.pdf'}
                              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-black text-xs hover:bg-gray-50 transition-all">
                              <Download size={13}/> Download
                            </a>
                          </>}
                          <button onClick={()=>alert('Fonctionnalité entretien — à intégrer avec votre calendrier')}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-black text-xs hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all">
                            <Calendar size={13}/> Interview
                          </button>
                          {/* Modifier statut inline */}
                          <select
                            value={app.status||'new'}
                            onChange={e=>{const k=e.target.value;updateApplicationStatusWithNotif(app,k);setSelectedApp({...app,status:k});setApplications(prev=>prev.map(a=>a.id===app.id?{...a,status:k}:a));}}
                            className={`px-3 py-2 rounded-xl border font-black text-xs outline-none appearance-none cursor-pointer transition-all ${(STATUS_COLORS[app.status]||STATUS_COLORS.new).badge} border-current`}>
                            {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* ONGLETS */}
                      <div className="flex border-t border-gray-100 px-7 overflow-x-auto">
                        {DETAIL_TABS_ATS.map(tab => (
                          <button key={tab.key} onClick={()=>setDetailTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-black whitespace-nowrap border-b-2 transition-all ${detailTab===tab.key?'border-blue-600 text-blue-600':'border-transparent text-gray-400 hover:text-gray-600'}`}>
                            <span>{tab.icon}</span>{tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── CONTENU ONGLETS ── */}
                    <div className="flex-1 overflow-y-auto p-7 space-y-5">

                      {/* ═══ PROFIL ═══ */}
                      {detailTab === 'Profil' && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              {label:'Phone',  val:app.phone||'—',        icon:'📞'},
                              {label:'Email',       val:app.email||'—',        icon:'✉️'},
                              {label:'Birth date',   val:app.birthDate?new Date(app.birthDate).toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR'):'—', icon:'🎂'},
                              {label:'Nationality', val:app.nationality||'—',  icon:'🌍'},
                              {label:'Gender',       val:app.gender==='F'?'Female':'Male', icon:'👤'},
                              {label:'Address',     val:app.address||'—',      icon:'📍'},
                            ].map(({label,val,icon})=>(
                              <div key={label} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">{icon} {label}</p>
                                <p className="text-sm font-bold text-gray-800 break-all">{val}</p>
                              </div>
                            ))}
                          </div>
                          {/* Langues */}
                          {app.languages && (
                            <div>
                              <p className="text-xs font-black text-gray-900 mb-2">🗣 Langues parlées</p>
                              <div className="flex flex-wrap gap-2">
                                {(app.languages||'').split(',').filter(Boolean).map((l:string)=>(
                                  <span key={l} className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-xs font-black">{l.trim()}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {app.message && (
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                              <p className="text-xs font-black text-amber-700 mb-2">💬 Message de candidature</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{app.message}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ═══ EXPÉRIENCE ═══ */}
                      {detailTab === 'Experience' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                              <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest mb-1">💼 Années d'expérience</p>
                              <p className="text-3xl font-black text-blue-700">{app.experience || '—'}</p>
                              <p className="text-xs text-blue-500 font-medium mt-1">{parseInt(app.experience||0)>0?`${parseInt(app.experience||0)} year${parseInt(app.experience||0)>1?'s':''} of professional experience`:'Junior / entry-level profile'}</p>
                            </div>
                            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5">
                              <p className="text-[9px] font-black uppercase text-purple-400 tracking-widest mb-1">🎓 Formation</p>
                              <p className="text-base font-black text-purple-700">{app.education||'Non renseigné'}</p>
                              <p className="text-xs text-purple-500 font-medium mt-1">{app.sector||'Secteur non défini'}</p>
                            </div>
                          </div>
                          {/* Disponibilité */}
                          <div className={`rounded-2xl p-5 border ${app.availability==='Immédiate'||app.availability==='immediate'?'bg-emerald-50 border-emerald-100':'bg-gray-50 border-gray-100'}`}>
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">📅 Disponibilité</p>
                            <p className={`text-lg font-black ${app.availability==='Immédiate'||app.availability==='immediate'?'text-emerald-700':'text-gray-700'}`}>
                              {app.availability==='Immédiate'||app.availability==='immediate'?'✅ Disponible immédiatement':app.availability||'{t.admin.notSpecified}e'}
                            </p>
                          </div>
                          {/* Poste visé */}
                          {(app.jobTitle||app.sector) && (
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                              <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">🎯 Poste / Secteur visé</p>
                              <p className="text-base font-black text-gray-800">{app.jobTitle||app.sector}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ═══ COMPÉTENCES ═══ */}
                      {detailTab === 'Skills' && (
                        <div className="space-y-5">
                          {app.skills ? (
                            <>
                              <p className="text-xs font-black text-gray-900">🛠 Compétences déclarées</p>
                              <div className="flex flex-wrap gap-2">
                                {app.skills.split(',').filter(Boolean).map((s:string,i:number)=>(
                                  <span key={i} className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-all">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"/>
                                    {s.trim()}
                                  </span>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="py-16 text-center">
                              <p className="text-4xl mb-3">🛠</p>
                              <p className="font-black text-gray-400 text-sm mb-1">{t.admin.none}e compétence renseignée</p>
                              <p className="text-xs text-gray-300">Le candidat n'a pas renseigné de compétences spécifiques</p>
                            </div>
                          )}
                          {/* Langues comme compétence */}
                          {app.languages && (
                            <div>
                              <p className="text-xs font-black text-gray-900 mb-3">🗣 Langues</p>
                              <div className="flex flex-wrap gap-2">
                                {(app.languages||'').split(',').filter(Boolean).map((l:string)=>(
                                  <span key={l} className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-bold">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"/>
                                    {l.trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ═══ CV & DOCUMENTS ═══ */}
                      {detailTab === 'Documents' && (
                        <div className="space-y-5">
                          {/* Aperçu PDF inline */}
                          {app.cvUrl && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-black text-gray-900">📄 Curriculum Vitae</p>
                                <div className="flex gap-2">
                                  <a href={app.cvUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all">
                                    <Eye size={11}/> Voir
                                  </a>
                                  <a href={app.cvUrl} download={app.cvFileName||'CV.pdf'}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-black hover:bg-gray-50 transition-all">
                                    <Download size={11}/> Download
                                  </a>
                                </div>
                              </div>
                              {/* Iframe PDF inline */}
                              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{height:'520px'}}>
                                {app.cvUrl.match(/\.(pdf)$/i) ? (
                                  <iframe src={`${app.cvUrl}#toolbar=0`} className="w-full h-full" title="CV PDF"/>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                    <FileText size={48} strokeWidth={1} className="text-gray-300 mb-4"/>
                                    <p className="font-black text-gray-400 text-sm mb-3">Preview not available for this format</p>
                                    <a href={app.cvUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all">
                                      <Eye size={14}/> Ouvrir le document
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Diplôme */}
                          {app.diplomaUrl && (
                            <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-2xl p-5">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-purple-500 rounded-xl flex items-center justify-center"><FileText size={20} className="text-white"/></div>
                                <div><p className="font-black text-gray-900 text-sm">{app.diplomaFileName||'Diplôme'}</p><p className="text-xs text-gray-400">Justificatif de formation</p></div>
                              </div>
                              <a href={app.diplomaUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white rounded-xl font-black text-xs hover:bg-purple-700 transition-all">
                                <Eye size={12}/> Voir
                              </a>
                            </div>
                          )}
                          {/* ID */}
                          {app.idUrl && (
                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center"><FileText size={20} className="text-white"/></div>
                                <div><p className="font-black text-gray-900 text-sm">{app.idFileName||"Pièce d'identité"}</p><p className="text-xs text-gray-400">Document officiel</p></div>
                              </div>
                              <a href={app.idUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 transition-all">
                                <Eye size={12}/> Voir
                              </a>
                            </div>
                          )}
                          {!app.cvUrl && !app.diplomaUrl && !app.idUrl && (
                            <div className="py-16 text-center">
                              <p className="text-4xl mb-3">📂</p>
                              <p className="font-black text-gray-400 text-sm mb-1">{t.admin.none} document</p>
                              <p className="text-xs text-gray-300">Ce candidat n'a pas encore soumis de documents</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ═══ NOTES ═══ */}
                      {detailTab === 'Notes' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-gray-900">📝 Notes de l'équipe</p>
                            <span className="text-[9px] font-bold text-gray-300 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">🔒 Non visible par le candidat</span>
                          </div>
                          <textarea
                            value={app.notes||''}
                            onChange={e=>{const v=e.target.value;setApplications(prev=>prev.map(a=>a.id===app.id?{...a,notes:v}:a));setSelectedApp({...app,notes:v});}}
                            onBlur={()=>updateDoc(doc(db,'applications',app.id),{notes:app.notes??''})}
                            placeholder="Impressions d'entretien, points d'attention, feedback de l'équipe, suivi..."
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:bg-white resize-none font-medium transition-all leading-relaxed"
                            rows={10}/>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>
                            Sauvegarde automatique à chaque modification
                          </p>
                        </div>
                      )}

                      {/* ═══ HISTORIQUE ═══ */}
                      {detailTab === 'History' && (
                        <div className="space-y-3">
                          <p className="text-xs font-black text-gray-900">🕐 Historique des actions</p>
                          {[
                            {date: app.createdAt?.seconds ? new Date(app.createdAt.seconds*1000).toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '—', action:lang==='EN'?'Application received':lang==='AR'?'تم استلام الطلب':'Candidature reçue', icon:'📥', color:'bg-blue-100 text-blue-600'},
                            ...(app.status && app.status !== 'new' ? [{date:'—', action:`Status → ${STATUS_LABELS[app.status]||app.status}`, icon:'🔄', color:'bg-purple-100 text-purple-600'}] : []),
                            ...(app.cvUrl ? [{date:'—', action:'CV uploadé', icon:'📄', color:'bg-emerald-100 text-emerald-600'}] : []),
                            ...(app.notes ? [{date:'—', action:"Note ajoutée par l'équipe", icon:'📝', color:'bg-amber-100 text-amber-600'}] : []),
                          ].map((ev, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-sm transition-all">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${ev.color}`}>{ev.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-gray-900">{ev.action}</p>
                                {ev.date !== '—' && <p className="text-xs text-gray-400 font-medium mt-0.5">{ev.date}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>
                )}

              </div>
              );
            })() : activeTab === 'recruiters' ? (
              <div className="space-y-10">

                {/* Pending recruiters alert banner */}
                {recruiters.filter(r => r.status === 'pending').length > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 flex items-center gap-4">
                    <AlertCircle size={22} className="text-amber-600 shrink-0" />
                    <div className="flex-1">
                      <p className="font-black text-amber-800 text-sm">
                        {recruiters.filter(r => r.status === 'pending').length} recruteur(s) en attente de validation
                      </p>
                      <p className="text-amber-600 text-xs font-medium mt-1">Validez ou refusez les comptes ci-dessous pour activer leur accès.</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-end">
                   <div>
                      <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Validation Recruteurs</h1>
                      <p className="text-gray-400 text-sm font-medium">Validez les comptes entreprises pour activer leur accès</p>
                   </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{lang==='FR'?'Entreprise':lang==='AR'?'الشركة':'Company'}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{lang==='FR'?'Contact':lang==='AR'?'جهة الاتصال':'Contact'}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{lang==='FR'?'RC / SIRET':lang==='AR'?'رقم التسجيل':'Reg. Number'}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{lang==='FR'?'Secteur':lang==='AR'?'القطاع':'Sector'}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Status</th>
                        <th className="px-10 py-6 text-right text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRecruiters.map(rec => (
                        <tr key={rec.id} className="hover:bg-gray-50/30 transition-all group">
                          <td className="px-10 py-6">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-900 font-black">🏢</div>
                                <div>
                                   <p className="text-lg font-black text-gray-900 leading-tight">{rec.companyName}</p>
                                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-normal">{rec.email}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-6 text-sm font-black text-gray-900">{rec.contactName}</td>
                          <td className="px-10 py-6 text-sm font-bold text-gray-400">{rec.rcNumber || 'N/A'}</td>
                          <td className="px-10 py-6 text-sm font-bold text-gray-400">
                            {t.sectors?.[rec.sector] || rec.sector || 'N/A'}
                          </td>
                          <td className="px-10 py-6">
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-normal ${rec.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-900'}`}>
                                {rec.status === 'active' ? 'Validé' : 'En attente'}
                             </span>
                          </td>
                          <td className="px-10 py-6 text-right">
                             <div className="flex justify-end gap-3">
                                {rec.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleValidateRecruiter(rec)}
                                      className="bg-green-600 text-white text-[9px] font-black uppercase px-5 py-2.5 rounded-xl hover:bg-green-700 transition-all flex items-center gap-2">
                                      <CheckCircle size={14} /> Valider
                                    </button>
                                    <button
                                      onClick={() => handleRejectRecruiter(rec)}
                                      className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-black uppercase px-5 py-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center gap-2">
                                      <XCircle size={14} /> Refuser
                                    </button>
                                  </>
                                )}
                                {rec.status === 'active' && (
                                  <button
                                    onClick={() => updateStatus('recruiters', rec.id, 'disabled')}
                                    className="bg-gray-100 text-gray-600 text-[9px] font-black uppercase px-5 py-2.5 rounded-xl hover:bg-gray-900 hover:text-white transition-all flex items-center gap-2">
                                    <ToggleLeft size={14} /> Désactiver
                                  </button>
                                )}
                                {rec.status === 'disabled' && (
                                  <button
                                    onClick={() => handleValidateRecruiter(rec)}
                                    className="bg-blue-50 text-blue-600 border border-blue-200 text-[9px] font-black uppercase px-5 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                                    <CheckCircle size={14} /> Réactiver
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(rec.id)}
                                  className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                                  <Trash2 size={16} />
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRecruiters.length === 0 && <div className="p-32 text-center text-gray-200 uppercase font-black tracking-[0.5em] italic">{t.admin.noData}</div>}
                </div>
              </div>
            ) : activeTab === 'needs' ? (
              <div className="space-y-10">
                <div>
                   <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t.admin.clientNeedsTitle}</h1>
                   <p className="text-gray-400 text-sm font-medium">{t.admin.immediateNeeds}</p>
                </div>

                <div className="space-y-4">
                   {filteredNeeds.map((need, i) => (
                     <motion.div
                       initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                       key={need.id}
                       className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group"
                       onClick={() => setSelectedNeed(need)}
                     >
                       <div className="flex flex-wrap items-center gap-6 p-6">

                         {/* Icon */}
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${need.status === 'validated' || need.status === 'matching' ? 'bg-green-50 text-green-500' : need.status === 'rejected' ? 'bg-red-50 text-red-400' : 'bg-blue-50 text-blue-500'}`}>
                           <Building2 size={24} />
                         </div>

                         {/* Main info */}
                         <div className="flex-1 min-w-[280px]">
                           <div className="flex items-center gap-2 flex-wrap mb-1">
                             <h4 className="text-base font-black text-gray-900">{need.companyName}</h4>
                             <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                               need.urgency === 'high' ? 'bg-red-50 text-red-500 border-red-100' :
                               need.urgency === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                               'bg-gray-50 text-gray-400 border-gray-200'
                             }`}>
                               {need.urgency === 'high' ? t.admin.highPriority : need.urgency === 'medium' ? t.admin.mediumUrgency : lang==='EN'?'🟢 Low':lang==='AR'?'🟢 منخفضة':'🟢 Basse'}
                             </span>
                             {need.status === 'matching' && need.publishedAsOffer
                               ? <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1"><Briefcase size={8} /> Publié</span>
                               : need.status === 'validated'
                               ? <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-green-50 text-green-600 border border-green-100">✓ Validé</span>
                               : null}
                             {need.status === 'rejected' && <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-50 text-red-500 border border-red-100">✗ Refusé</span>}
                           </div>
                           {/* JOB TITLE — le champ le plus important */}
                           {need.jobTitle && (
                             <p className="text-sm font-black text-blue-600 mb-1">🎯 {need.jobTitle}</p>
                           )}
                           <p className="text-xs text-gray-400 font-medium">{need.contactName} • {need.email} • {need.phone}</p>
                           <div className="flex flex-wrap gap-1.5 mt-2">
                             {need.needType && <span className="text-[10px] font-black uppercase text-white bg-gray-800 px-2.5 py-1 rounded-lg">{need.needType}</span>}
                             {need.sector && <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">{need.sector}</span>}
                             {need.location && <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">📍 {need.location}</span>}
                             {need.skills && <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 max-w-[200px] truncate">{need.skills}</span>}
                           </div>
                         </div>

                         {/* Description snippet */}
                         <div className="hidden lg:block max-w-xs flex-1 text-xs text-gray-400 italic line-clamp-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                           "{need.description || '{t.admin.none}e description'}"
                         </div>

                         {/* Date + Actions */}
                         <div className="flex items-center gap-4 shrink-0">
                           <div className="text-center">
                             <p className="text-[9px] font-black uppercase text-gray-300 tracking-wider mb-0.5">{t.admin.submittedOn}</p>
                             <p className="text-xs font-black text-gray-700">{need.createdAt?.toDate().toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR')}</p>
                           </div>
                           <div className="flex gap-2">
                             <button
                               onClick={e => { e.stopPropagation(); setSelectedNeed(need); }}
                               className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                               title="Voir les détails"
                             ><Eye size={16} /></button>
                             <button
                               onClick={e => { e.stopPropagation(); if (need.status !== 'validated' && need.status !== 'matching') handleValidateNeed(need); }}
                               className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${need.status === 'validated' || need.status === 'matching' ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-green-600'}`}
                               title="Valider la demande"
                             ><CheckCircle size={16} /></button>
                           </div>
                         </div>

                       </div>
                     </motion.div>
                   ))}

                   {filteredNeeds.length === 0 && (
                     <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
                       <Bell size={48} strokeWidth={1} className="mx-auto mb-4 text-gray-200" />
                       <p className="text-sm font-black uppercase tracking-widest text-gray-300">{t.admin.none}e demande</p>
                     </div>
                   )}
                </div>
              </div>
            ) : activeTab === 'diagnostics' ? (
              <div className="space-y-10">
                 <div>
                   <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t.admin.pitchLeadsTitle}</h1>
                   <p className="text-gray-400 text-sm font-medium">{t.admin.autoDiagnostics}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   {diagnostics.map((diag, i) => (
                     <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} key={diag.id} className="bg-[#F8FAFC] p-10 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-sm transition-all group h-[500px]">
                        <div>
                           <div className="flex justify-between items-start mb-10">
                              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/10 border border-blue-100">
                                 <Search size={32} />
                              </div>
                              <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-normal border ${diag.urgency === 'high' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                 {diag.urgency === 'high' ? t.admin.callAsap : t.admin.routine}
                              </span>
                           </div>
                           
                           <h4 className="text-2xl font-black text-gray-900 mb-2 font-mono">{diag.sector}</h4>
                           <p className="text-[10px] font-black uppercase text-gray-900 mb-6 bg-gray-100 inline-block px-3 py-1 rounded">{t.admin.pitchLeads}</p>
                           
                           <div className="space-y-6">
                              <div>
                                 <p className="text-[10px] font-black uppercase text-gray-300 tracking-tighter mb-2">{t.admin.painPoint}</p>
                                 <p className="text-sm font-bold text-gray-900 leading-relaxed line-clamp-3 italic">"{diag.painPoint}"</p>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="flex-1 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] font-black uppercase text-gray-300 mb-1">{t.admin.volume}</p>
                                    <p className="text-lg font-black text-gray-900 leading-none">{diag.volume}+ <span className="text-xs font-bold opacity-40 uppercase">{t.admin.jobs}</span></p>
                                 </div>
                                 <div className="flex-1 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] font-black uppercase text-gray-300 mb-1">{t.admin.deadline}</p>
                                    <p className="text-lg font-black text-gray-900 leading-none">{t.admin.immediate}</p>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="pt-8 border-t border-gray-50 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-black">GM</div>
                              <p className="text-xs font-bold text-gray-400">Vedior System</p>
                           </div>
                           <button className="text-gray-900 font-black text-xs uppercase tracking-[0.2em] hover:underline flex items-center gap-2">{t.admin.continue} <ChevronRight size={14} /></button>
                        </div>
                     </motion.div>
                   ))}
                </div>
              </div>
            ) : activeTab === 'users' ? (
              <div className="space-y-10">
                {/* Header */}
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">
                      {t.admin.userManagement || 'User Management'}
                    </h1>
                    <p className="text-gray-500 text-sm font-semibold">
                      {t.admin.userManagementDesc}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowScanCV(true)}
                      className="bg-blue-600 text-white px-8 py-5 rounded-lg font-black uppercase tracking-normal shadow-sm hover:bg-blue-700 transition-all flex items-center gap-3 border-2 border-blue-500"
                    >
                      <FileText size={20} /> {t.admin.scanCvBtn || '📄 Scanner un CV'}
                    </button>
                    <button
                      onClick={() => setShowAddUser(true)}
                      className="bg-gray-900 text-white px-10 py-5 rounded-lg font-black uppercase tracking-normal shadow-sm shadow-gray-200/30 hover:scale-105 hover:shadow-gray-200/50 transition-all flex items-center gap-4 border-2 border-gray-300"
                    >
                      <UserPlus size={22} /> {t.admin.createAccount || 'Créer un compte'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { role: 'admin', label: 'Administrators', icon: Crown, iconBg: 'bg-purple-100 text-gray-700', numColor: 'text-gray-700',
                      count: users.filter(u => u.role === 'admin').length },
                    { role: 'recruiter', label: 'Recruiters', icon: UserCheck, iconBg: 'bg-blue-100 text-blue-700', numColor: 'text-blue-700',
                      count: Math.max(users.filter(u => u.role === 'recruiter').length, recruiters.length) },
                    { role: 'candidate', label: 'Candidates', icon: User, iconBg: 'bg-gray-100 text-gray-900', numColor: 'text-gray-900',
                      count: users.filter(u => u.role === 'candidate' || u.loginMethod === 'google' || u.loginMethod === 'email').length },
                  ].map(({ role, label, icon: Icon, iconBg, numColor, count }) => (
                    <div key={role} className="bg-white p-8 rounded-lg border-2 border-gray-200 shadow-md flex items-center gap-6 hover:shadow-lg transition-shadow">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${iconBg}`}>
                        <Icon size={30} />
                      </div>
                      <div>
                        <p className={`text-4xl font-black ${numColor}`}>{count}</p>
                        <p className="text-xs font-black uppercase text-gray-500 tracking-normal mt-1">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Table utilisateurs */}
                <div className="bg-white rounded-xl border-2 border-gray-200 shadow-md overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-900 border-b border-gray-700">
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">{'User'}</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Email</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">{'Role'}</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">{'Created'}</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">{'Created by'}</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">{'Subscription'}</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">{'Status'}</th>
                        <th className="px-10 py-5 text-right text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map((u, i) => {
                        const roleConfig: any = {
                          admin: { label: 'Admin', color: 'bg-purple-100 text-gray-700 border-purple-200', icon: Crown },
                          recruiter: { label: lang==='EN'?'Recruiter':lang==='AR'?'المجند':'Recruiter', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: UserCheck },
                          candidate: { label: lang==='EN'?'Candidate':lang==='AR'?'المرشح':'Candidate', color: 'bg-gray-100 text-gray-900 border-gray-200', icon: User },
                        };
                        const rc = roleConfig[u.role] || { label: u.role, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: User };
                        const RIcon = rc.icon;
                        return (
                          <motion.tr
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            key={u.id}
                            className="hover:bg-gray-50 transition-all group"
                          >
                            <td className="px-10 py-5">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 font-black text-lg ${rc.color}`}>
                                  {(u.displayName || u.fullName || u.contactName || u.companyName) ? (u.displayName || u.fullName || u.contactName || u.companyName)[0].toUpperCase() : <RIcon size={20} />}
                                </div>
                                <div>
                                  <p className="text-base font-black text-gray-900 leading-tight">{u.displayName || u.fullName || u.contactName || u.companyName || '—'}</p>
                                  <p className={`text-[10px] font-bold uppercase tracking-normal ${u.status === 'active' || !u.status ? 'text-green-600' : 'text-red-500'}`}>
                                    {u.loginMethod === 'google' ? '🔵 Google' : u.loginMethod === 'email' ? '📧 Email' : u.tempId ? `🪪 ${u.tempId}` : ''}
                                    {' '}{u.status === 'disabled' ? '○ Désactivé' : '● Actif'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-5">
                              <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <Mail size={14} className="text-gray-400" /> {u.email}
                              </span>
                            </td>
                            <td className="px-10 py-5">
                              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-normal border-2 flex items-center gap-1.5 w-fit ${rc.color}`}>
                                <RIcon size={12} /> {rc.label}
                              </span>
                            </td>
                            <td className="px-10 py-5 text-sm font-bold text-gray-600">
                              {u.createdAt?.toDate().toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR') || '—'}
                            </td>
                            <td className="px-10 py-5 text-sm font-bold text-gray-600">
                              {u.createdBy || '—'}
                            </td>
                            <td className="px-10 py-5">
                              {u.plan ? (
                                <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border w-fit flex items-center gap-1 ${
                                  u.plan === 'pro' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  u.plan === 'basic' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  'bg-gray-100 text-gray-500 border-gray-200'
                                }`}>
                                  {u.plan === 'pro' ? '💎 Pro' : u.plan === 'basic' ? '⭐ Basic' : u.plan}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-300 font-bold">—</span>
                              )}
                            </td>
                            <td className="px-10 py-5">
                              <button
                                onClick={() => handleToggleUserStatus(u.id, u.status)}
                                className={`flex items-center gap-2 text-[9px] font-black uppercase px-4 py-2 rounded-full border-2 transition-all ${
                                  u.status === 'active'
                                    ? 'bg-green-50 text-green-700 border border-green-100 border-green-300 hover:bg-red-100 hover:text-red-600 hover:border-red-300'
                                    : 'bg-red-100 text-red-600 border-red-300 hover:bg-green-100 hover:text-green-700 hover:border-green-300'
                                }`}
                              >
                                {u.status === 'active'
                                  ? <><ToggleRight size={15} /> Actif</>
                                  : <><ToggleLeft size={15} /> {t.admin.disabled}</>
                                }
                              </button>
                            </td>
                            <td className="px-10 py-5 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setSelectedUser(u); setEditingUser(null); }}
                                  className="w-10 h-10 flex items-center justify-center bg-navy text-white rounded-xl shadow-lg shadow-navy/20 hover:bg-orange transition-all"
                                  title="View profile"
                                >
                                  <Eye size={16} />
                                </button>
                                {u.cvUrl && (
                                  <a href={u.cvUrl} target="_blank" rel="noopener noreferrer" download={u.cvFileName || 'CV.pdf'}>
                                    <button
                                      className="w-10 h-10 flex items-center justify-center bg-gray-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:scale-110 transition-all"
                                      title={lang==='EN'?'Download CV':lang==='AR'?'تحميل السيرة الذاتية':'Download CV'}
                                    >
                                      <Download size={16} />
                                    </button>
                                  </a>
                                )}
                                {u.idUrl && (
                                  <a href={u.idUrl} target="_blank" rel="noopener noreferrer" download={u.idFileName || 'ID.pdf'}>
                                    <button
                                      className="w-10 h-10 flex items-center justify-center bg-gray-500 text-white rounded-xl shadow-lg shadow-purple-500/20 hover:scale-110 transition-all"
                                      title={lang==='EN'?'View ID':lang==='AR'?'عرض الهوية':"Voir pièce d'identité"}
                                    >
                                      <FileText size={16} />
                                    </button>
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="w-10 h-10 flex items-center justify-center bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 hover:scale-110 transition-all"
                                  title={lang==='EN'?'Delete':lang==='AR'?'حذف':'Supprimer'}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="py-24 px-10 text-center bg-gray-50">
                      <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                        <UserX size={36} className="text-gray-500" />
                      </div>
                      <p className="text-gray-600 text-lg font-black uppercase tracking-[0.3em] mb-2">{lang==='FR'?'Aucun utilisateur trouvé':lang==='AR'?'لا يوجد مستخدم':'No user found'}</p>
                      <p className="text-gray-400 font-medium mb-8">{lang==='FR'?'Créez votre premier compte pour commencer':lang==='AR'?'أنشئ أول حساب':'Create your first account to get started'}</p>
                      <button
                        onClick={() => setShowAddUser(true)}
                        className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-normal hover:scale-105 transition-all shadow-lg shadow-gray-200/30 border-2 border-gray-300 inline-flex items-center gap-3"
                      >
                        <UserPlus size={20} /> {lang==='EN'?'Create first account':lang==='AR'?'إنشاء أول حساب':'Créer le premier compte'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'pricing' ? (
              <AdminPricingTab recruiters={recruiters} db={db} />
            ) : activeTab === 'settings' ? (
              <div className="space-y-8">

                {/* ── En-tête ── */}
                <div>
                  <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t.admin.settings}</h1>
                  <p className="text-gray-400 text-sm font-medium">{t.admin.settingsPlatformDesc || 'Configuration de la plateforme'}</p>
                </div>

                {/* ── Navigation sous-onglets ── */}
                <div className="flex gap-2 flex-wrap border-b border-gray-100 pb-4">
                  {([
                    { id: 'company',    icon: '🏢', label: t.admin.settingsTabCompany    || 'Société',     desc: t.admin.settingsTabCompanyDesc    || 'Infos & branding' },
                    { id: 'candidates', icon: '👤', label: t.admin.settingsTabCandidates || 'Candidats',   desc: t.admin.settingsTabCandidatesDesc || 'Documents requis' },
                    { id: 'matching',   icon: '🎯', label: t.admin.settingsTabMatching   || 'Matching IA', desc: t.admin.settingsTabMatchingDesc   || 'Poids & prompt CV' },
                    { id: 'lists',      icon: '📋', label: t.admin.settingsTabLists      || 'Listes',      desc: t.admin.settingsTabListsDesc      || 'Options formulaires' },
                    { id: 'system',     icon: '⚙️', label: t.admin.settingsTabSystem     || 'Système',     desc: t.admin.settingsTabSystemDesc     || 'Langue & sécurité' },
                  ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
                      className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${settingsTab === tab.id ? 'bg-gray-900 text-white border-gray-900 shadow-lg' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <span className="text-base">{tab.icon}</span>
                      <div className="text-left">
                        <p className="text-xs font-black leading-none">{tab.label}</p>
                        <p className={`text-[10px] font-medium mt-0.5 ${settingsTab === tab.id ? 'text-gray-300' : 'text-gray-400'}`}>{tab.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* ══ SOCIÉTÉ ══ */}
                {settingsTab === 'company' && (
                  <CompanyInfoEditor db={db} />
                )}

                {/* ══ CANDIDATS ══ */}
                {settingsTab === 'candidates' && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-navy/5 flex items-center justify-center"><FileText size={20} className="text-navy" /></div>
                        <div>
                          <p className="font-black text-gray-900">Documents requis à l'inscription</p>
                          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Choisissez quels documents le candidat doit fournir lors de son inscription</p>
                        </div>
                      </div>
                      <button onClick={saveRequiredDocs} disabled={savingDocs}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-white font-black text-xs hover:bg-gray-700 transition-all disabled:opacity-50">
                        {savingDocs ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : savedDocs ? <><CheckCircle size={13} className="text-green-400" /> Enregistré</> : <><Save size={13} /> Enregistrer</>}
                      </button>
                    </div>
                    <div className="p-8 space-y-3">
                      {requiredDocs.map((doc_item, idx) => (
                        <div key={doc_item.key} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <span className="text-2xl w-10 text-center">{doc_item.emoji}</span>
                          <div className="flex-1"><p className="font-black text-gray-900 text-sm">{doc_item.label}</p></div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activé</span>
                            <button onClick={() => setRequiredDocs(prev => prev.map((d, i) => i === idx ? { ...d, enabled: !d.enabled, required: !d.enabled ? d.required : false } : d))}
                              className={`relative w-11 h-6 rounded-full transition-all ${doc_item.enabled ? 'bg-navy' : 'bg-gray-200'}`}>
                              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${doc_item.enabled ? 'left-6' : 'left-1'}`} />
                            </button>
                          </div>
                          {doc_item.enabled && (
                            <div className="flex gap-2">
                              <button onClick={() => setRequiredDocs(prev => prev.map((d, i) => i === idx ? { ...d, required: true } : d))}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${doc_item.required ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-400 border-gray-200 hover:border-red-300'}`}>Obligatoire</button>
                              <button onClick={() => setRequiredDocs(prev => prev.map((d, i) => i === idx ? { ...d, required: false } : d))}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${!doc_item.required ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300'}`}>Optionnel</button>
                            </div>
                          )}
                          {!doc_item.enabled && <span className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-300 border border-gray-100">{t.admin.disabled}</span>}
                          {doc_item.key === 'cv' && <span title="Le CV est toujours obligatoire"><Lock size={14} className="text-gray-300" /></span>}
                        </div>
                      ))}
                      <p className="mt-4 text-[11px] text-gray-400 font-medium">ℹ️ Ces paramètres sont lus en temps réel par le formulaire d'inscription candidat.</p>
                    </div>
                  </div>
                )}

                {/* ══ MATCHING IA ══ */}
                {settingsTab === 'matching' && (() => {
                  const sliderClass = "flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 accent-navy";
                  const Row = ({ label, group, fieldKey, min, max, step = 1, suffix = 'pts' }: { label: string; group: 'algo' | 'manual'; fieldKey: string; min: number; max: number; step?: number; suffix?: string }) => {
                    const value = (matchingWeights as any)[group][fieldKey];
                    return (
                      <div className="flex items-center gap-4 py-2.5 border-b border-gray-50 last:border-0">
                        <p className="flex-1 text-xs font-bold text-gray-600">{label}</p>
                        <input type="range" min={min} max={max} step={step} value={value}
                          onChange={(e) => updateMatchingWeight(group, fieldKey, parseFloat(e.target.value))}
                          className={sliderClass + " max-w-[140px]"} />
                        <div className="flex items-center gap-1">
                          <input type="number" min={min} max={max} step={step} value={value}
                            onChange={(e) => { const v = parseFloat(e.target.value); updateMatchingWeight(group, fieldKey, isNaN(v) ? 0 : v); }}
                            className="w-16 text-right text-xs font-black text-gray-900 tabular-nums border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30" />
                          {suffix && <span className="text-[10px] font-bold text-gray-400 w-7">{suffix}</span>}
                        </div>
                      </div>
                    );
                  };
                  const algoMaxFields: (keyof typeof matchingWeights.algo)[] = ['sector', 'experience', 'availabilityImmediate', 'education'];
                  const manualMaxFields: (keyof typeof matchingWeights.manual)[] = ['sector', 'experience', 'availabilityImmediate', 'diploma', 'skillsMax'];
                  const algoTotal = algoMaxFields.reduce((sum, k) => sum + (matchingWeights.algo[k] as number), 0);
                  const manualTotal = manualMaxFields.reduce((sum, k) => sum + (matchingWeights.manual[k] as number), 0);
                  const TotalBadge = ({ total }: { total: number }) => {
                    const ok = total === 100;
                    return <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg border ${ok ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>Total max : {total}/100{!ok && ' ⚠️'}</span>;
                  };
                  return (
                    <div className="space-y-8">
                      {/* Pondérations */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl bg-navy/5 flex items-center justify-center"><Target size={20} className="text-navy" /></div>
                            <div>
                              <p className="font-black text-gray-900">Pondérations du Matching</p>
                              <p className="text-[11px] text-gray-400 font-medium mt-0.5">Réglez l'importance de chaque critère (IA et Manuel)</p>
                            </div>
                          </div>
                          <button onClick={saveMatchingWeights} disabled={savingMatching}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-white font-black text-xs hover:bg-gray-700 transition-all disabled:opacity-50">
                            {savingMatching ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : savedMatching ? <><CheckCircle size={13} className="text-green-400" /> Enregistré</> : <><Save size={13} /> Enregistrer</>}
                          </button>
                        </div>
                        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                          <div>
                            <div className="flex items-center justify-between mb-5">
                              <div className="flex items-center gap-2"><Sparkles size={14} className="text-indigo-500" /><p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Mode IA</p></div>
                              <TotalBadge total={algoTotal} />
                            </div>
                            <Row label="Secteur identique" group="algo" fieldKey="sector" min={0} max={50} />
                            <Row label="Secteur proche" group="algo" fieldKey="sectorPartial" min={0} max={30} />
                            <Row label="Expérience suffisante" group="algo" fieldKey="experience" min={0} max={40} />
                            <Row label="Expérience proche (seuil partiel)" group="algo" fieldKey="experiencePartial" min={0} max={30} />
                            <Row label="Ratio exp. minimum acceptable" group="algo" fieldKey="experiencePartialRatio" min={0} max={1} step={0.05} suffix="" />
                            <Row label="Disponibilité immédiate" group="algo" fieldKey="availabilityImmediate" min={0} max={20} />
                            <Row label="Disponible dans 1 mois" group="algo" fieldKey="availability1Month" min={0} max={20} />
                            <Row label="Disponible dans 2 mois" group="algo" fieldKey="availability2Months" min={0} max={20} />
                            <Row label="Formation Bac+ (Licence/Master/BTS)" group="algo" fieldKey="education" min={0} max={20} />
                            <Row label="Formation Bac / CAP / BEP" group="algo" fieldKey="educationLower" min={0} max={20} />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-5">
                              <div className="flex items-center gap-2"><Users size={14} className="text-blue-500" /><p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Mode Manuel</p></div>
                              <TotalBadge total={manualTotal} />
                            </div>
                            <Row label="Secteur identique" group="manual" fieldKey="sector" min={0} max={50} />
                            <Row label="Secteur différent (bonus présence)" group="manual" fieldKey="sectorOther" min={0} max={20} />
                            <Row label="Expérience ≥ requise" group="manual" fieldKey="experience" min={0} max={40} />
                            <Row label="Expérience proche (écart accepté)" group="manual" fieldKey="experiencePartial" min={0} max={30} />
                            <Row label="Écart d'expérience accepté (années)" group="manual" fieldKey="experiencePartialGap" min={0} max={5} suffix="ans" />
                            <Row label="Disponibilité immédiate" group="manual" fieldKey="availabilityImmediate" min={0} max={20} />
                            <Row label="Autre disponibilité renseignée" group="manual" fieldKey="availabilityOther" min={0} max={20} />
                            <Row label="Diplôme correspondant exactement" group="manual" fieldKey="diploma" min={0} max={20} />
                            <Row label="Diplôme différent (bonus présence)" group="manual" fieldKey="diplomaOther" min={0} max={10} />
                            <Row label="{t.admin.none} diplôme requis (bonus auto)" group="manual" fieldKey="diplomaNoneRequired" min={0} max={20} />
                            <Row label="Compétences — points max" group="manual" fieldKey="skillsMax" min={0} max={30} />
                            <Row label="Compétences — points par compétence" group="manual" fieldKey="skillsPerMatch" min={0} max={10} />
                          </div>
                        </div>
                        <div className="px-8 pb-5 text-[11px] text-gray-400 font-medium">
                          ℹ️ "Total max" = critères composant un score plein de 100. Les bonus/partiels affinent sans dépasser ce maximum.
                        </div>
                      </div>

                      {/* Prompt scan CV */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl bg-navy/5 flex items-center justify-center"><FileText size={20} className="text-navy" /></div>
                            <div>
                              <p className="font-black text-gray-900">Prompt de scan CV</p>
                              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                                Instructions envoyées à l'IA — utilisez <code className="bg-gray-100 px-1 rounded text-[10px]">{"{{CV_TEXT}}"}</code> pour insérer le texte du CV
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setCvScanPrompt(DEFAULT_CV_SCAN_PROMPT)}
                              className="text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-all">
                              Réinitialiser
                            </button>
                            <button onClick={saveCvScanPrompt} disabled={savingCvPrompt}
                              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-white font-black text-xs hover:bg-gray-700 transition-all disabled:opacity-50">
                              {savingCvPrompt ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : savedCvPrompt ? <><CheckCircle size={13} className="text-green-400" /> Enregistré</> : <><Save size={13} /> Enregistrer</>}
                            </button>
                          </div>
                        </div>
                        <div className="p-8">
                          <textarea value={cvScanPrompt} onChange={(e) => setCvScanPrompt(e.target.value)} rows={20}
                            className="w-full text-xs font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-5 resize-y focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 leading-relaxed"
                            spellCheck={false} />
                          <p className="mt-3 text-[11px] text-gray-400 font-medium">
                            ℹ️ Le placeholder <code className="bg-gray-100 px-1 rounded">{"{{CV_TEXT}}"}</code> est remplacé par le contenu extrait du CV (max 5 500 caractères).
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ══ LISTES ══ */}
                {settingsTab === 'lists' && (() => {
                  const optionGroups = [
                    { key: 'settings_sectors',       label: lang==='AR' ? "🏗️ قطاعات النشاط" : lang==='EN' ? "🏗️ Business Sectors" : "🏗️ Secteurs d'activité",    items: dynSectors,       setter: setDynSectors,       color: 'orange' },
                    { key: 'settings_contracts',      label: lang==='AR' ? "📄 أنواع العقود" : lang==='EN' ? "📄 Contract Types" : "📄 Types de contrat",         items: dynContracts,     setter: setDynContracts,     color: 'blue' },
                    { key: 'settings_educations',     label: lang==='AR' ? "🎓 المستويات الدراسية" : lang==='EN' ? "🎓 Education Levels" : "🎓 Niveaux d'études",        items: dynEducations,    setter: setDynEducations,    color: 'purple' },
                    { key: 'settings_availabilities', label: lang==='AR' ? "📅 التوفر" : lang==='EN' ? "📅 Availabilities" : "📅 Disponibilités",           items: dynAvailabilities, setter: setDynAvailabilities, color: 'green' },
                    { key: 'settings_urgencies',      label: lang==='AR' ? "🚨 مستويات الاستعجال" : lang==='EN' ? "🚨 Urgency Levels" : "🚨 Niveaux d'urgence",       items: dynUrgencies,     setter: setDynUrgencies,     color: 'red' },
                    { key: 'settings_salaries',       label: lang==='AR' ? "💰 نطاقات الراتب" : lang==='EN' ? "💰 Salary Ranges" : "💰 Salary ranges",   items: dynSalaries,      setter: setDynSalaries,      color: 'green' },
                    { key: 'settings_nationalities',  label: lang==='AR' ? "🌍 الجنسيات" : lang==='EN' ? "🌍 Nationalities" : "🌍 Nationalités",              items: dynNationalities,  setter: setDynNationalities,  color: 'blue' },
                    { key: 'settings_languages',      label: lang==='AR' ? "🗣️ اللغات" : lang==='EN' ? "🗣️ Languages" : "🗣️ Langues parlées",           items: dynLanguages,      setter: setDynLanguages,      color: 'purple' },
                  ];
                  const handleAddOption = async (colKey: string) => {
                    const input = newOptionInputs[colKey];
                    if (!input?.label?.trim()) return;
                    const val = input.value?.trim() || input.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    const group = optionGroups.find(g => g.key === colKey);
                    const newOrder = (group?.items.length || 0) + 1;
                    await addDoc(collection(db, colKey), { value: val, label: input.label.trim(), order: newOrder, createdAt: serverTimestamp() });
                    setNewOptionInputs(prev => ({ ...prev, [colKey]: { value: '', label: '' } }));
                  };
                  const handleDeleteOption = async (colKey: string, id: string) => {
                    if (!window.confirm(t.admin.deleteOption || 'Supprimer cette option ?')) return;
                    await deleteDoc(doc(db, colKey, id));
                  };
                  const handleSaveEdit = async () => {
                    if (!editingOption) return;
                    const { colKey, id, label, value } = editingOption;
                    if (!label.trim()) return;
                    const finalValue = value.trim() || label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    await updateDoc(doc(db, colKey, id), { label: label.trim(), value: finalValue });
                    setEditingOption(null);
                  };

                  const colorMap: Record<string, string> = {
                    orange: 'bg-gray-100 text-gray-900 border-gray-200',
                    blue:   'bg-blue-50 text-gray-700 border-blue-100',
                    purple: 'bg-gray-50 text-gray-600 border-purple-100',
                    green:  'bg-green-50 text-green-600 border-green-100',
                    red:    'bg-red-50 text-red-500 border-red-100',
                  };
                  const btnMap: Record<string, string> = {
                    orange: 'bg-gray-900 text-white hover:bg-gray-700/80',
                    blue:   'bg-gray-600 text-white hover:bg-gray-700',
                    purple: 'bg-gray-500 text-white hover:bg-gray-700',
                    green:  'bg-green-500 text-white hover:bg-green-600',
                    red:    'bg-red-500 text-white hover:bg-red-600',
                  };

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {optionGroups.map(({ key, label, items, color }) => (
                        <div key={key} className="bg-white p-8 rounded-[36px] border border-gray-100 shadow-sm space-y-6">
                          <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">{label}</h3>

                          {/* Liste des options */}
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {items.length === 0 && (
                              <p className="text-gray-400 text-sm italic text-center py-4">lang==='AR' ? 'لا توجد خيارات — أضف واحدة أدناه' : lang==='EN' ? 'No options yet — add one below' : '{t.admin.none}e option — ajoutez-en ci-dessous'</p>
                            )}
                            {items.map(item => {
                              const isEditing = editingOption?.colKey === key && editingOption?.id === item.id;
                              return (
                                <div key={item.id} className={`rounded-2xl border transition-all ${isEditing ? 'border-orange/40 bg-orange/5 p-3' : `${colorMap[color]} px-4 py-3`}`}>
                                  {isEditing ? (
                                    /* ── Mode édition ── */
                                    <div className="space-y-2">
                                      {/* For salaries: two clean Min / Max inputs */}
                                      {key === 'settings_salaries' ? (() => {
                                        // Parse existing label to extract min/max
                                        const existing = editingOption.label.replace(' DJF','').trim();
                                        const parts = existing.split(/\s*[-–]\s*/);
                                        const minVal = parts[0]?.replace(/\D/g,'') || '';
                                        const maxVal = parts[1]?.replace(/\D/g,'') || '';
                                        const buildLabelValue = (mn: string, mx: string) => {
                                          const mnN = mn.replace(/\D/g,'');
                                          const mxN = mx.replace(/\D/g,'');
                                          const fmt = (n: string) => n ? parseInt(n).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g,' ') : '';
                                          const label = (mnN || mxN) ? `${fmt(mnN)} - ${fmt(mxN)} DJF` : '';
                                          const value = (mnN && mxN) ? `${mnN}-${mxN}` : '';
                                          return { label, value };
                                        };
                                        return (
                                          <div className="space-y-3">
                                            {/* Preview badge */}
                                            {editingOption.value && (
                                              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                                                <span className="text-blue-500 text-xs">👁</span>
                                                <span className="text-sm font-black text-blue-700">{editingOption.label}</span>
                                                <span className="ml-auto text-[9px] font-mono text-blue-400">{editingOption.value}</span>
                                              </div>
                                            )}
                                            {/* Min / Max inputs */}
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Minimum</label>
                                                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                                                  <input
                                                    autoFocus
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="80 000"
                                                    defaultValue={minVal ? parseInt(minVal).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g,' ') : ''}
                                                    onChange={e => {
                                                      const mn = e.target.value.replace(/\D/g,'');
                                                      const mx = editingOption.value.split('-')[1] || '';
                                                      const {label,value} = buildLabelValue(mn, mx);
                                                      setEditingOption(prev => prev ? {...prev, label, value} : null);
                                                    }}
                                                    className="flex-1 bg-transparent outline-none text-sm font-black text-gray-800 w-full"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Maximum</label>
                                                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                                                  <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="110 000"
                                                    defaultValue={maxVal ? parseInt(maxVal).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g,' ') : ''}
                                                    onChange={e => {
                                                      const mx = e.target.value.replace(/\D/g,'');
                                                      const mn = editingOption.value.split('-')[0] || '';
                                                      const {label,value} = buildLabelValue(mn, mx);
                                                      setEditingOption(prev => prev ? {...prev, label, value} : null);
                                                    }}
                                                    className="flex-1 bg-transparent outline-none text-sm font-black text-gray-800 w-full"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                            {/* DJF badge */}
                                            <div className="flex items-center gap-1.5 text-gray-400">
                                              <div className="flex-1 h-px bg-gray-100" />
                                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">FDJ</span>
                                              <div className="flex-1 h-px bg-gray-100" />
                                            </div>
                                          </div>
                                        );
                                      })() : (
                                        <>
                                          <input
                                            autoFocus
                                            value={editingOption.label}
                                            onChange={e => setEditingOption(prev => prev ? { ...prev, label: e.target.value } : null)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingOption(null); }}
                                            placeholder={
                                              key === 'settings_sectors' ? 'ex: BTP & Génie Civil' :
                                              key === 'settings_contracts' ? 'ex: CDI, CDD, Intérim' :
                                              key === 'settings_educations' ? 'ex: Bac+3, Master' :
                                              key === 'settings_availabilities' ? 'ex: Immédiate, Dans 1 mois' :
                                              key === 'settings_urgencies' ? 'ex: Haute, Moyenne' :
                                              key === 'settings_nationalities' ? 'ex: Djiboutienne' :
                                              key === 'settings_languages' ? 'ex: Français, Arabe' :
                                              t.admin.displayName || 'Nom affiché'
                                            }
                                            className="w-full bg-white px-3 py-2 rounded-xl border border-orange/30 outline-none focus:border-orange font-black text-sm text-navy"
                                          />
                                          <input
                                            value={editingOption.value}
                                            onChange={e => setEditingOption(prev => prev ? { ...prev, value: e.target.value } : null)}
                                            placeholder={lang==='AR' ? 'المعرف (مثال: btp، cdi)' : lang==='EN' ? 'Key value (ex: btp, cdi...)' : 'Valeur clé (ex: btp, cdi...)'}
                                            className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-orange font-mono text-xs text-gray-500"
                                          />
                                        </>
                                      )}
                                      <div className="flex gap-2 pt-1">
                                        <button onClick={handleSaveEdit}
                                          className="flex-1 py-2 rounded-xl bg-orange text-white font-black text-xs flex items-center justify-center gap-1.5 hover:bg-navy transition-all">
                                          <CheckCircle size={13} /> Enregistrer
                                        </button>
                                        <button onClick={() => setEditingOption(null)}
                                          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 font-black text-xs hover:bg-gray-200 transition-all">
                                          Annuler
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* ── Mode affichage ── */
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <span className="font-black text-sm">{lang === 'EN' && (item as any).label_EN ? (item as any).label_EN : item.label}</span>
                                        <span className="ml-2 text-[10px] opacity-60 font-mono">{item.value}</span>
                                      </div>
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={() => setEditingOption({ colKey: key, id: item.id, label: item.label, value: item.value })}
                                          className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-gray-400 hover:text-orange hover:bg-orange/10 transition-all border border-gray-200">
                                          <Edit size={12} />
                                        </button>
                                        <button onClick={() => handleDeleteOption(key, item.id)}
                                          className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-all border border-red-100">
                                          <X size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Formulaire ajout */}
                          <div className="pt-3 border-t border-gray-100 space-y-3">
                            {key === 'settings_salaries' ? (
                              <div className="space-y-3">
                                {/* Preview badge */}
                                {newOptionInputs[key]?.value && (
                                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-100">
                                    <span className="text-green-500 text-xs">✓</span>
                                    <span className="text-sm font-black text-green-700">{newOptionInputs[key]?.label}</span>
                                    <span className="ml-auto text-[9px] font-mono text-green-400">{newOptionInputs[key]?.value}</span>
                                  </div>
                                )}
                                {/* Min / Max inputs row */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">💰 lang==='AR' ? 'الحد الأدنى للراتب (DJF)' : lang==='EN' ? 'Minimum salary (DJF)' : 'Salaire minimum'</label>
                                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all focus-within:bg-white">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="ex: 80 000"
                                        value={(() => {
                                          const v = newOptionInputs[key]?.value || '';
                                          const mn = v.split('-')[0] || '';
                                          return mn ? parseInt(mn).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g,' ') : (newOptionInputs[key]?._minRaw || '');
                                        })()}
                                        onChange={e => {
                                          const mn = e.target.value.replace(/\D/g,'');
                                          const mx = (newOptionInputs[key]?.value || '').split('-')[1] || (newOptionInputs[key]?._maxRaw || '');
                                          const fmt = (n: string) => n ? parseInt(n).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g,' ') : '';
                                          const label = (mn || mx) ? `${fmt(mn)} - ${fmt(mx)} DJF` : '';
                                          const value = (mn && mx) ? `${mn}-${mx}` : '';
                                          setNewOptionInputs(prev => ({ ...prev, [key]: { label, value, _minRaw: mn, _maxRaw: mx } }));
                                        }}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(key); } }}
                                        className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-800 w-full"
                                      />
                                      <span className="text-[10px] font-black text-gray-300 ml-1">FDJ</span>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">💰 lang==='AR' ? 'الحد الأقصى للراتب (DJF)' : lang==='EN' ? 'Maximum salary (DJF)' : 'Salaire maximum'</label>
                                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all focus-within:bg-white">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="ex: 110 000"
                                        value={(() => {
                                          const v = newOptionInputs[key]?.value || '';
                                          const mx = v.split('-')[1] || '';
                                          return mx ? parseInt(mx).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g,' ') : (newOptionInputs[key]?._maxRaw || '');
                                        })()}
                                        onChange={e => {
                                          const mx = e.target.value.replace(/\D/g,'');
                                          const mn = (newOptionInputs[key]?.value || '').split('-')[0] || (newOptionInputs[key]?._minRaw || '');
                                          const fmt = (n: string) => n ? parseInt(n).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g,' ') : '';
                                          const label = (mn || mx) ? `${fmt(mn)} - ${fmt(mx)} DJF` : '';
                                          const value = (mn && mx) ? `${mn}-${mx}` : '';
                                          setNewOptionInputs(prev => ({ ...prev, [key]: { label, value, _minRaw: mn, _maxRaw: mx } }));
                                        }}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(key); } }}
                                        className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-800 w-full"
                                      />
                                      <span className="text-[10px] font-black text-gray-300 ml-1">FDJ</span>
                                    </div>
                                  </div>
                                </div>
                                {/* Suggestion rapides */}
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1.5">Suggestions rapides</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[['50000','70000'],['70000','100000'],['100000','150000'],['150000','200000'],['200000','300000'],['300000','500000']].map(([mn,mx])=>{
                                      const fmt = (n:string)=>parseInt(n).toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR').replace(/,/g,' ');
                                      return(
                                        <button key={`${mn}-${mx}`}
                                          type="button"
                                          onClick={()=>{
                                            const label=`${fmt(mn)} - ${fmt(mx)} DJF`;
                                            const value=`${mn}-${mx}`;
                                            setNewOptionInputs(prev=>({...prev,[key]:{label,value,_minRaw:mn,_maxRaw:mx}}));
                                          }}
                                          className="px-2.5 py-1 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-500 hover:text-blue-600 transition-all">
                                          {fmt(mn)}–{fmt(mx)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAddOption(key)}
                                  disabled={!newOptionInputs[key]?.value}
                                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all active:scale-95">
                                  <span>+</span> {t.admin.addRange || 'Ajouter la fourchette'}
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-3">
                              <input
                                type="text"
                                placeholder={
                                  key === 'settings_sectors' ? 'ex: Transport & Logistique' :
                                  key === 'settings_contracts' ? 'ex: Stage / Alternance' :
                                  key === 'settings_educations' ? 'ex: Master / Bac+5' :
                                  key === 'settings_availabilities' ? 'ex: Dans 6 mois' :
                                  key === 'settings_urgencies' ? 'ex: Critique / Vitale' :
                                  key === 'settings_nationalities' ? 'ex: Yéménite' :
                                  key === 'settings_languages' ? 'ex: Tigrigna' :
                                  key === 'settings_experiences' ? 'ex: 10 ans et plus' :
                                  key === 'settings_job_titles' ? 'ex: Responsable RH' :
                                  t.admin.displayName || 'Nom affiché'
                                }
                                value={newOptionInputs[key]?.label || ''}
                                onChange={e => setNewOptionInputs(prev => ({ ...prev, [key]: { ...prev[key], label: e.target.value, value: '' } }))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(key); } }}
                                className="flex-1 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-gray-300 text-sm font-bold text-gray-900"
                              />
                              <button onClick={() => handleAddOption(key)}
                                className={`px-5 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 ${btnMap[color]}`}>
                                <Plus size={16} /> {lang==='AR' ? 'إضافة' : lang==='EN' ? 'Add' : 'Ajouter'}
                              </button>
                            </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ══ SYSTÈME ══ */}
                {settingsTab === 'system' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white p-10 rounded-xl border border-gray-100 shadow-sm space-y-8">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                          <Shield className="text-gray-900" /> {t.admin.security}
                        </h3>
                        <div className="space-y-6">
                          <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                            <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-normal">{t.admin.certifiedAccount}</p>
                            <p className="text-sm font-medium text-blue-900/70">{t.admin.secureAccess}</p>
                          </div>
                          <button className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase tracking-normal hover:bg-gray-700 transition-all">
                            {t.admin.resetPassword}
                          </button>
                        </div>
                      </div>
                      <div className="bg-white p-10 rounded-xl border border-gray-100 shadow-sm space-y-8">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                          <Languages className="text-gray-900" /> {t.admin.preferredLanguage}
                        </h3>
                        <div className="flex gap-4">
                          {['FR', 'EN', 'AR'].map(l => (
                            <button key={l} onClick={() => setLang(l as any)}
                              className={`flex-1 py-4 rounded-2xl font-black transition-all border ${lang === l ? 'bg-gray-900 text-white border-gray-300 shadow-lg' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gray-100 text-gray-900 rounded-2xl flex items-center justify-center"><Settings size={28} /></div>
                        <div>
                          <p className="font-black text-gray-900 text-sm uppercase tracking-normal">v2.4.0-stable</p>
                          <p className="text-gray-400 text-xs font-medium">{lang==='AR' ? 'الخيارات متزامنة في الوقت الفعلي مع Firebase' : lang==='EN' ? 'Options synced in real-time with Firebase' : 'Options synchronisées en temps réel avec Firebase'}</p>
                        </div>
                      </div>
                      <div className="px-6 py-2 bg-green-50 rounded-xl text-[10px] font-black text-green-500 uppercase tracking-normal border border-green-100">Live & Secure</div>
                    </div>
                  </div>
                )}

              </div>
            ) : activeTab === 'messages' ? (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Messages</h1>
                  <p className="text-gray-400 text-sm font-medium">Messagerie recruteurs & demandes de modification</p>
                </div>

                {/* ── Demandes de modification ── */}
                {(() => {
                  const modifRequests = adminMessages.filter((m: any) => m.type === 'modification_request');
                  const pending = modifRequests.filter((m: any) => m.status === 'pending');
                  return (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center">
                            <span className="text-xl">✏️</span>
                          </div>
                          <div>
                            <p className="font-black text-gray-900">Demandes de modification</p>
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Requests de recruteurs pour modifier une offre verrouillée</p>
                          </div>
                        </div>
                        {pending.length > 0 && (
                          <span className="bg-amber-500 text-white text-xs font-black px-3 py-1.5 rounded-full">{pending.length} en attente</span>
                        )}
                      </div>
                      {modifRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                          <span className="text-5xl mb-3">📭</span>
                          <p className="text-sm font-black text-gray-400 uppercase">{t.admin.none}e demande de modification</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {modifRequests.map((msg: any) => (
                            <div key={msg.id} className="px-8 py-5">
                              <div className="flex items-start gap-4">
                                <div className="flex-1 space-y-2">
                                  {/* Référence */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Offre :</span>
                                    <span className="text-sm font-black text-gray-900">{msg.needTitle}</span>
                                    <span className="text-[9px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">#{msg.needId?.slice(-8)}</span>
                                    {msg.needSector && <span className="text-[9px] font-black uppercase text-gray-400">{msg.needSector}</span>}
                                  </div>
                                  {/* Recruteur */}
                                  <p className="text-[10px] text-gray-400">De : <strong className="text-gray-600">{msg.companyName || msg.userEmail}</strong> · {msg.createdAt?.toDate?.().toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR')} à {msg.createdAt?.toDate?.().toLocaleTimeString(lang === 'EN' ? 'en-US' : 'fr-FR',{hour:'2-digit',minute:'2-digit'})}</p>
                                  {/* Message */}
                                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                    <p className="text-sm text-gray-700 font-medium leading-relaxed">{msg.text}</p>
                                  </div>
                                  {/* Réponse admin existante */}
                                  {msg.adminReply && (
                                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                      <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">Your reply</p>
                                      <p className="text-sm text-gray-700 font-medium">{msg.adminReply}</p>
                                    </div>
                                  )}
                                </div>
                                {/* Badge statut */}
                                <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${
                                  msg.status === 'approved' ? 'bg-green-50 text-green-600 border-green-200' :
                                  msg.status === 'rejected' ? 'bg-red-50 text-red-500 border-red-200' :
                                  'bg-amber-100 text-amber-600 border-amber-200'
                                }`}>
                                  {msg.status === 'approved' ? '✅ Approved' : msg.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                                </span>
                              </div>
                              {/* Actions admin si pending */}
                              {msg.status === 'pending' && (
                                <MsgReplyBlock msg={msg} db={db} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Messagerie générale par recruteur ── */}
                {(() => {
                  const generalMsgs = adminMessages.filter((m: any) => m.type !== 'modification_request');
                  // Grouper par recruteur (userId)
                  const convMap = new Map<string, any[]>();
                  generalMsgs.forEach((m: any) => {
                    const key = m.userId || m.userEmail || 'admin';
                    if (!convMap.has(key)) convMap.set(key, []);
                    convMap.get(key)!.push(m);
                  });
                  const convList = Array.from(convMap.entries()).map(([uid, msgs]) => ({
                    uid,
                    company: msgs.find(m => m.companyName)?.companyName || msgs[0]?.userEmail || uid,
                    unread: msgs.filter(m => !m.read && m.sender === 'recruiter').length,
                    lastMsg: msgs[0],
                  }));

                  const activeMsgs = selectedConvUserId
                    ? generalMsgs.filter((m: any) => (m.userId || m.userEmail) === selectedConvUserId).reverse()
                    : [];

                  const sendAdminReply = async () => {
                    if (!adminMsgText.trim() || !selectedConvUserId) return;
                    setSendingAdminMsg(true);
                    const conv = convList.find(c => c.uid === selectedConvUserId);
                    try {
                      await addDoc(collection(db, 'messages'), {
                        userId:      selectedConvUserId,
                        userEmail:   conv?.company || '',
                        sender:      'admin',
                        type:        'general',
                        text:        adminMsgText.trim(),
                        read:        false,
                        createdAt:   serverTimestamp(),
                      });
                      setAdminMsgText('');
                    } finally { setSendingAdminMsg(false); }
                  };

                  return (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-6 border-b border-gray-100">
                        <p className="font-black text-gray-900">Messagerie recruteurs</p>
                        <p className="text-[11px] text-gray-400 font-medium mt-0.5">Conversations générales avec les recruteurs</p>
                      </div>
                      <div className="flex" style={{minHeight: '460px'}}>
                        {/* Liste conversations */}
                        <div className="w-72 border-r border-gray-100 overflow-y-auto">
                          {convList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-40 py-16">
                              <MessageSquare size={40} className="text-gray-300 mb-3" />
                              <p className="text-xs text-gray-400 font-bold">{t.admin.none}e conversation</p>
                            </div>
                          ) : convList.map(conv => (
                            <button key={conv.uid} onClick={() => setSelectedConvUserId(conv.uid)}
                              className={`w-full text-left px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-all ${selectedConvUserId === conv.uid ? 'bg-gray-50 border-l-2 border-l-gray-900' : ''}`}>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-black text-gray-900 truncate">{conv.company}</p>
                                {conv.unread > 0 && <span className="text-[10px] font-black bg-orange text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{conv.unread}</span>}
                              </div>
                              <p className="text-[11px] text-gray-400 font-medium mt-0.5 truncate">{conv.lastMsg?.text?.slice(0,50)}</p>
                            </button>
                          ))}
                        </div>
                        {/* Zone de messages */}
                        <div className="flex-1 flex flex-col">
                          {!selectedConvUserId ? (
                            <div className="flex-1 flex items-center justify-center opacity-30">
                              <div className="text-center">
                                <MessageSquare size={48} className="text-gray-300 mx-auto mb-3" />
                                <p className="text-sm font-black text-gray-400">Sélectionnez une conversation</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                                {activeMsgs.map((msg: any) => (
                                  <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm font-medium ${msg.sender === 'admin' ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
                                      <p>{msg.text}</p>
                                      <p className={`text-[10px] mt-1 ${msg.sender === 'admin' ? 'text-white/50' : 'text-gray-400'}`}>
                                        {msg.createdAt?.toDate?.().toLocaleTimeString(lang === 'EN' ? 'en-US' : 'fr-FR',{hour:'2-digit',minute:'2-digit'})}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="p-4 border-t border-gray-100 flex gap-3">
                                <input type="text" value={adminMsgText} onChange={e => setAdminMsgText(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAdminReply(); }}}
                                  placeholder="Répondre..."
                                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-gray-900" />
                                <button onClick={sendAdminReply} disabled={sendingAdminMsg || !adminMsgText.trim()}
                                  className="bg-gray-900 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-orange transition-all disabled:opacity-40">
                                  <ChevronRight size={20} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Modals */}

      {/* ══ MODAL DÉTAIL DEMANDE RECRUTEUR ══ */}
      <AnimatePresence>
        {selectedNeed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center p-4"
            onClick={() => setSelectedNeed(null)}>
            <div className="absolute inset-0 bg-[#060d1a]/80 backdrop-blur-md" />
            <motion.div initial={{ y: 30, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-start justify-between px-8 py-6 border-b border-gray-100 shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      selectedNeed.urgency === 'high' ? 'bg-red-50 text-red-500' :
                      selectedNeed.urgency === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {selectedNeed.urgency === 'high' ? '🔴 High urgency' : selectedNeed.urgency === 'medium' ? '🟡 Medium urgency' : '🟢 Low urgency'}
                    </span>
                    {(selectedNeed.status === 'validated' || selectedNeed.status === 'matching') && (
                      selectedNeed.publishedAsOffer
                        ? <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1"><Briefcase size={9} /> Published as offer</span>
                        : <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-green-50 text-green-600">✓ Validated</span>
                    )}
                    {selectedNeed.status === 'rejected' && <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-red-50 text-red-500">✗ Rejected</span>}
                  </div>
                  <h3 className="text-xl font-black text-gray-900">{selectedNeed.companyName}</h3>
                  {selectedNeed.jobTitle && <p className="text-blue-600 font-black text-sm mt-0.5">🎯 Position: {selectedNeed.jobTitle}</p>}
                </div>
                <button onClick={() => setSelectedNeed(null)}
                  className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all shrink-0 mt-1">
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto px-8 py-6 space-y-7">

                {/* Section Contact */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">{lang==='FR'?'Contact':lang==='AR'?'جهة الاتصال':'Contact'}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['👤 Contact', selectedNeed.contactName],
                      ['✉ Email', selectedNeed.email],
                      ['📞 Téléphone', selectedNeed.phone],
                    ].map(([label, val]) => val ? (
                      <div key={label} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                        <p className="text-[9px] font-black uppercase text-gray-400 mb-1">{label}</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{val}</p>
                      </div>
                    ) : null)}
                  </div>
                </div>

                {/* Section Poste */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">Position & Contract</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['💼 Contract type', selectedNeed.needType],
                      ['🏢 Sector', selectedNeed.sector],
                      ['📍 Location', selectedNeed.location],
                      ['🖥 Format', selectedNeed.workFormat === 'terrain' ? 'Field/Site' : selectedNeed.workFormat === 'hybride' ? 'Hybrid' : selectedNeed.workFormat === 'decale' ? 'Shifted hours' : selectedNeed.workFormat ? 'Office' : null],
                      ['👥 Nb of profiles', selectedNeed.profileCount?.toString()],
                      ['⚡ Disponibilité', selectedNeed.availability === 'immediate' ? 'Immediate' : selectedNeed.availability === '1month' ? 'In 1 month' : selectedNeed.availability === '3months' ? 'In 3 months' : selectedNeed.availability],
                      ['📅 Délai', selectedNeed.deadline ? new Date(selectedNeed.deadline).toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR') : null],
                      ['🔁 Reason', selectedNeed.recruitmentReason === 'replacement' ? 'Replacement' : selectedNeed.recruitmentReason === 'growth' ? 'Growth' : selectedNeed.recruitmentReason === 'new_project' ? 'New project' : selectedNeed.recruitmentReason === 'seasonal' ? 'Seasonal' : selectedNeed.recruitmentReason],
                    ].filter(([,val]) => val).map(([label, val]) => (
                      <div key={label} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                        <p className="text-[9px] font-black uppercase text-gray-400 mb-1">{label}</p>
                        <p className="text-sm font-bold text-gray-800">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section Profil requis */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">Required profile</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {[
                      ['🎓 Experience', selectedNeed.expRequired !== undefined ? `${selectedNeed.expRequired} year(s) minimum` : null],
                      ['📚 Education', selectedNeed.educationLevel === 'none' ? (t.admin.sansD || 'No diploma') : selectedNeed.educationLevel === 'bac' ? 'High school' : selectedNeed.educationLevel === 'bac2' ? 'Bac+2' : selectedNeed.educationLevel === 'licence' ? 'Bachelor' : selectedNeed.educationLevel === 'master' ? 'Master' : selectedNeed.educationLevel],
                    ].filter(([,val]) => val).map(([label, val]) => (
                      <div key={label} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                        <p className="text-[9px] font-black uppercase text-gray-400 mb-1">{label}</p>
                        <p className="text-sm font-bold text-gray-800">{val}</p>
                      </div>
                    ))}
                  </div>
                  {/* Langues */}
                  {selectedNeed.languages?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase text-gray-400 mb-2">🌍 Langues requises</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNeed.languages.map((l: string) => (
                          <span key={l} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-lg border border-blue-100">
                            {l === 'fr' ? '🇫🇷 French' : l === 'en' ? '🇬🇧 English' : l === 'ar' ? '🇸🇦 Arabic' : l === 'so' ? 'Somali' : l === 'aa' ? 'Afar' : l}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Permis */}
                  {selectedNeed.licenseRequired?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase text-gray-400 mb-2">🪪 Permis / Certifications</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNeed.licenseRequired.map((l: string) => (
                          <span key={l} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-100">{l.toUpperCase()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Compétences */}
                  {selectedNeed.skills && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <p className="text-[9px] font-black uppercase text-gray-400 mb-1">🛠 Compétences souhaitées</p>
                      <p className="text-sm font-semibold text-gray-700">{selectedNeed.skills}</p>
                    </div>
                  )}
                </div>

                {/* Section Rémunération */}
                {(selectedNeed.salaryMin || selectedNeed.salaryMax || selectedNeed.benefits) && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">Rémunération</p>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedNeed.salaryMin && (
                        <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
                          <p className="text-[9px] font-black uppercase text-amber-500 mb-1">Salaire min</p>
                          <p className="text-sm font-black text-gray-800">{typeof selectedNeed.salaryMin === 'number' ? selectedNeed.salaryMin.toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR') : selectedNeed.salaryMin} DJF</p>
                        </div>
                      )}
                      {selectedNeed.salaryMax && (
                        <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
                          <p className="text-[9px] font-black uppercase text-amber-500 mb-1">Salaire max</p>
                          <p className="text-sm font-black text-gray-800">{typeof selectedNeed.salaryMax === 'number' ? selectedNeed.salaryMax.toLocaleString(lang === 'EN' ? 'en-US' : 'fr-FR') : selectedNeed.salaryMax} DJF</p>
                        </div>
                      )}
                      {selectedNeed.benefits && (
                        <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
                          <p className="text-[9px] font-black uppercase text-amber-500 mb-1">Avantages</p>
                          <p className="text-sm font-semibold text-gray-700">{selectedNeed.benefits}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedNeed.description && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">{lang==='EN'?'Job description':lang==='AR'?'وصف الوظيفة':'Job description'}</p>
                    <div className="bg-gray-50 rounded-xl px-5 py-4 border border-gray-100 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {selectedNeed.description}
                    </div>
                  </div>
                )}

                {/* Date soumission */}
                <p className="text-[10px] text-gray-300 font-medium text-center">
                  Soumis le {selectedNeed.createdAt?.toDate().toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {selectedNeed.validatedAt && ` · Validé le ${selectedNeed.validatedAt.toDate().toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR')}`}
                </p>

                {/* ── Matching candidats ── */}
                <MatchingPanel
                  need={selectedNeed}
                  candidates={(() => {
                    // Normaliser applications (les champs sont préfixés candidate...)
                    const normalizedApps = applications.map((a: any) => ({
                      id: a.id,
                      fullName: a.fullName || a.candidateName || a.displayName,
                      displayName: a.displayName,
                      sector: a.sector || a.candidateSector,
                      experience: a.experience || a.candidateExperience,
                      availability: a.availability || a.candidateAvailability,
                      education: a.education || a.candidateEducation,
                      nationality: a.nationality,
                      languages: a.languages || a.candidateLanguages,
                      phone: a.phone || a.candidatePhone,
                      email: a.email || a.candidateEmail,
                      skills: a.skills,
                      cvUrl: a.cvUrl,
                      status: a.status,
                    }));
                    // Ajouter les users candidats pas encore dans applications
                    const appEmails = new Set(normalizedApps.map((a: any) => a.email).filter(Boolean));
                    const usersAsCandidates = users
                      .filter((u: any) => u.role === 'candidate')
                      .filter((u: any) => !appEmails.has(u.email))
                      .map((u: any) => ({
                        id: u.id,
                        fullName: u.fullName || u.displayName || u.contactName,
                        displayName: u.displayName,
                        sector: u.sector || u.candidateSector,
                        experience: u.experience,
                        availability: u.availability,
                        education: u.education,
                        nationality: u.nationality,
                        languages: u.languages,
                        phone: u.phone,
                        email: u.email,
                        skills: u.skills,
                        cvUrl: u.cvUrl,
                        status: u.status,
                      }));
                    return [...normalizedApps, ...usersAsCandidates];
                  })()}
                  onLink={handleLinkCandidate}
                  linkedIds={linkedCandidates[selectedNeed.id] || new Set(selectedNeed.linkedCandidates || [])}
                />

              </div>

              {/* Footer actions */}
              {selectedNeed.status !== 'validated' && selectedNeed.status !== 'matching' && selectedNeed.status !== 'rejected' && (
                <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 shrink-0 space-y-3">
                  {/* Bouton principal — Valider + Publier comme offre */}
                  <button
                    onClick={() => handlePublishNeedAsOffer(selectedNeed)}
                    disabled={publishingAsOffer}
                    className="w-full h-12 rounded-xl bg-navy text-white font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                    {publishingAsOffer
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publication...</>
                      : <><Briefcase size={15} /> ✅ Valider & Publier comme offre</>}
                  </button>
                  {/* Boutons secondaires */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRejectNeed(selectedNeed)}
                      className="flex-1 h-10 rounded-xl border-2 border-red-100 text-red-400 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                      <XCircle size={13} /> Refuser
                    </button>
                    <button
                      onClick={() => handleValidateNeed(selectedNeed)}
                      className="flex-1 h-10 rounded-xl border-2 border-green-100 text-green-500 font-black text-[10px] uppercase tracking-widest hover:bg-green-50 transition-all flex items-center justify-center gap-2">
                      <CheckCircle size={13} /> Valider sans publier
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 font-medium text-center">
                    "Valider & Publier" crée automatiquement une offre publique visible par les candidats
                  </p>
                </div>
              )}
              {(selectedNeed.status === 'validated' || selectedNeed.status === 'matching' || selectedNeed.status === 'rejected') && (
                <div className="px-8 py-5 border-t border-gray-100 shrink-0">
                  {selectedNeed.publishedAsOffer ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        <span className="text-sm font-black text-green-600">✓ Validée & publiée comme offre</span>
                      </div>
                      <button
                        onClick={() => { setSelectedNeed(null); setActiveTab('jobs'); }}
                        className="text-[10px] font-black text-blue-500 hover:underline uppercase tracking-widest">
                        Voir l'offre →
                      </button>
                    </div>
                  ) : (selectedNeed.status === 'validated' || selectedNeed.status === 'matching') ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-green-500">✓ Demande validée (non publiée)</span>
                      <button
                        onClick={() => handlePublishNeedAsOffer(selectedNeed)}
                        disabled={publishingAsOffer}
                        className="text-[10px] font-black text-navy hover:text-blue-600 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50">
                        <Briefcase size={12} /> Publish now
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-black text-red-400">✗ Demande refusée</span>
                  )}
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* ══ Modal Ajouter Candidature ══ */}
        {showAddApplication && (
          <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-navy/80 backdrop-blur-sm" onClick={() => setShowAddApplication(false)} />
            <div className="relative bg-white w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">

              {/* Handle bar mobile */}
              <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <div>
                  <h2 className="text-base font-black text-gray-900">Ajouter une candidature</h2>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">Saisie manuelle d&apos;un candidat</p>
                </div>
                <button onClick={() => setShowAddApplication(false)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-all">
                  <X size={14} />
                </button>
              </div>

              {/* Form — scrollable */}
              <form onSubmit={handleAddApplication} className="flex-1 overflow-y-auto p-5 space-y-4" style={{WebkitOverflowScrolling:'touch'}}>

                {/* Offre liée */}
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">🎯 Offre d&apos;emploi liée</label>
                  <select value={newApplication.jobId}
                    onChange={e => {
                      const job = jobs.find((j: any) => j.id === e.target.value);
                      setNewApplication({...newApplication, jobId: e.target.value, jobTitle: job?.title || newApplication.jobTitle, sector: job?.sector || newApplication.sector});
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-bold text-navy outline-none focus:border-blue-400 bg-white transition-all">
                    <option value="">— {t.admin.spontaneous} —</option>
                    {jobs.filter((j: any) => j.status !== 'closed' && j.status !== 'rejected')
                      .sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''))
                      .map((j: any) => (
                        <option key={j.id} value={j.id}>{j.title}{j.companyName ? ` — ${j.companyName}` : ''}{j.sector ? ` · ${j.sector}` : ''}</option>
                      ))}
                  </select>
                  {newApplication.jobId && (() => {
                    const job = jobs.find((j: any) => j.id === newApplication.jobId);
                    return job ? (
                      <div className="mt-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-2">
                        <Briefcase size={12} className="text-blue-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-blue-700 truncate">{job.title} · {job.type || 'CDI'} · {job.location || 'Djibouti'}{job.salaryRange ? ` · ${job.salaryRange}` : ''}</span>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Infos candidat */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">👤 Informations candidat</p>

                  {/* Nom complet */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t.admin.fullNameLabel || 'Full name'} *</label>
                    <input required value={newApplication.fullName}
                      onChange={e => setNewApplication({...newApplication, fullName: e.target.value})}
                      placeholder="Ex: Ahmed Hassan"
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 transition-all" />
                  </div>

                  {/* Email + Téléphone — 1 col mobile, 2 col desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Email</label>
                      <input type="email" value={newApplication.email}
                        onChange={e => setNewApplication({...newApplication, email: e.target.value})}
                        placeholder="email@exemple.com"
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Téléphone</label>
                      <input value={newApplication.phone}
                        onChange={e => setNewApplication({...newApplication, phone: e.target.value})}
                        placeholder="+253 77 00 00 00"
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 transition-all" />
                    </div>
                  </div>

                  {/* Poste + Secteur */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Poste visé {newApplication.jobId ? '(auto)' : '*'}</label>
                      <input required={!newApplication.jobId} readOnly={!!newApplication.jobId}
                        value={newApplication.jobId ? (jobs.find((j: any) => j.id === newApplication.jobId)?.title || '') : newApplication.jobTitle}
                        onChange={e => setNewApplication({...newApplication, jobTitle: e.target.value})}
                        placeholder="Ex: Chef de chantier"
                        className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm font-medium outline-none transition-all ${newApplication.jobId ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-100 focus:border-blue-400'}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Secteur {newApplication.jobId ? '(auto)' : ''}</label>
                      <select disabled={!!newApplication.jobId} value={newApplication.sector}
                        onChange={e => setNewApplication({...newApplication, sector: e.target.value})}
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 bg-white disabled:bg-gray-50 disabled:text-gray-400 transition-all">
                        {dynSectors.length > 0
                          ? dynSectors.map((s: any) => <option key={s.id} value={s.value}>{lang === 'EN' && (s as any).label_EN ? (s as any).label_EN : s.label}</option>)
                          : ['btp','logistics','hospitality','healthcare','admin','security','technology','commerce'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Expérience + Formation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Expérience</label>
                      <input value={newApplication.experience}
                        onChange={e => setNewApplication({...newApplication, experience: e.target.value})}
                        placeholder="Ex: 5 ans"
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Education / Diploma</label>
                      <input value={newApplication.education}
                        onChange={e => setNewApplication({...newApplication, education: e.target.value})}
                        placeholder="Ex: BTS Civil Engineering"
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 transition-all" />
                    </div>
                  </div>

                  {/* Disponibilité + Nationalité */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t.admin.availabilityLabel || 'Availability'}</label>
                      <select value={newApplication.availability}
                        onChange={e => setNewApplication({...newApplication, availability: e.target.value})}
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 bg-white transition-all">
                        {dynAvailabilities.length > 0
                          ? dynAvailabilities.map((a: any) => <option key={a.id} value={a.value}>{lang === 'EN' && (a as any).label_EN ? (a as any).label_EN : a.label}</option>)
                          : ['Immédiate','Sous 1 mois','Sous 3 mois','À définir'].map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t.admin.nationalityLabel || 'Nationality'}</label>
                      <input value={newApplication.nationality}
                        onChange={e => setNewApplication({...newApplication, nationality: e.target.value})}
                        placeholder="Djiboutienne"
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 transition-all" />
                    </div>
                  </div>

                  {/* Compétences */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Key skills</label>
                    <input value={newApplication.skills}
                      onChange={e => setNewApplication({...newApplication, skills: e.target.value})}
                      placeholder="AutoCAD, Gestion de chantier, MS Project..."
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 transition-all" />
                  </div>

                  {/* Admin notes */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Admin notes</label>
                    <textarea rows={2} value={newApplication.notes}
                      onChange={e => setNewApplication({...newApplication, notes: e.target.value})}
                      placeholder="Internal notes (not visible to the candidate)..."
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 resize-none transition-all" />
                  </div>

                  {/* Statut initial */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Initial status</label>
                    <select value={newApplication.status}
                      onChange={e => setNewApplication({...newApplication, status: e.target.value})}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-100 text-sm font-medium outline-none focus:border-blue-400 bg-white transition-all">
                      <option value="new">🆕 New</option>
                      <option value="reviewing">🔍 Under review</option>
                      <option value="interview">📅 {t.admin.interview}</option>
                      <option value="offer">📩 {t.admin.offerSent}</option>
                      <option value="hired">✅ {t.admin.hired}</option>
                      <option value="rejected">❌ {t.admin.rejected}</option>
                    </select>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 pt-2 border-t border-gray-100 pb-2">
                  <button type="button" onClick={() => setShowAddApplication(false)}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-gray-400 hover:bg-gray-50 border border-gray-200 transition-all">
                    {t.admin.cancel || 'Cancel'}
                  </button>
                  <button type="submit" disabled={submittingApp}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {submittingApp
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                      : <><CheckCircle size={15} /> Save</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

                {showAddJob && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-stretch sm:items-center justify-center"
          >
            <div className="absolute inset-0"
              style={{ background: 'rgba(10,20,40,0.85)', backdropFilter: 'blur(12px)' }}
              onClick={() => { setShowAddJob(false); setEditingJob(null); setSelectedSkillsJob([]); setSkillInputJob(''); }}
            />
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative z-10 w-full max-w-3xl h-full sm:h-auto sm:max-h-[95vh] flex flex-col rounded-none sm:rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl"
              style={{ background: '#FBFBFE' }}
            >
              {/* ── Header ── */}
              <div className="relative flex items-center justify-between px-4 sm:px-10 pt-6 sm:pt-10 pb-5 sm:pb-8 shrink-0"
                style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1e3a5f 100%)' }}>
                <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
                  style={{ background: 'radial-gradient(circle,#f97316,transparent)' }} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange/70 mb-1">
                    Vedior GM · Publishing System
                  </p>
                  <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                    {editingJob ? t.admin.editJobTitle : lang==='EN'?'Publish a job offer':lang==='AR'?'نشر عرض عمل':'Publish a job offer'}
                  </h3>
                </div>
                <button onClick={() => { setShowAddJob(false); setEditingJob(null); setSelectedSkillsJob([]); setSkillInputJob(''); }}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0">
                  <X size={22} />
                </button>
              </div>

              {/* ── Scrollable body ── */}
              <div className="overflow-y-auto flex-1 px-4 sm:px-10 py-5 sm:py-8">
                <form onSubmit={handleAddJob} className="space-y-6 sm:space-y-10" id="job-form">

                  {/* ── Section 1 : Entreprise cliente ── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-7 h-7 rounded-xl bg-[#0F172A] flex items-center justify-center shrink-0">
                        <Building2 size={14} className="text-orange" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-navy/40">Client Company</p>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{t.admin.selectRecruiter}</label>
                      <select
                        value={newJob.selectedRecruiterId || ''}
                        onChange={e => {
                          const rec = recruiters.find((r: any) => r.id === e.target.value);
                          setNewJob((p: any) => ({
                            ...p,
                            selectedRecruiterId: e.target.value,
                            companyName: rec?.companyName || p.companyName,
                            sector: rec?.sector || p.sector,
                          }));
                        }}
                        className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm appearance-none cursor-pointer"
                      >
                        <option value="">— {t.admin.selectRecruiter} —</option>
                        {recruiters.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.companyName} · {r.contactName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Or enter manually':lang==='AR'?'أو أدخل يدويًا':'Or enter manually'}</label>
                      <input type="text" value={newJob.companyName}
                        onChange={e => setNewJob({...newJob, companyName: e.target.value})}
                        placeholder={lang==='EN'?'Client company name...':lang==='AR'?'اسم الشركة العميلة...':"Client company name..."}
                        className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm placeholder:text-gray-300" />
                    </div>
                  </div>

                  {/* ── Section 2 : Détails du poste ── */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-7 h-7 rounded-xl bg-[#0F172A] flex items-center justify-center shrink-0">
                        <Briefcase size={14} className="text-orange" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-navy/40">Job Details</p>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                      {/* Intitulé du poste */}
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Job title *':lang==='AR'?'عنوان الوظيفة *':'Job title *'}</label>
                        <div className="relative">
                          <input required type="text" value={newJob.title}
                            onChange={e => { setNewJob({...newJob, title: e.target.value}); setShowJobSuggestionsModal(true); }}
                            onFocus={() => setShowJobSuggestionsModal(true)}
                            onBlur={() => setTimeout(() => setShowJobSuggestionsModal(false), 150)}
                            placeholder="Ex: Senior Site Manager"
                            className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy text-lg placeholder:text-gray-300 transition-all shadow-sm" />
                          {showJobSuggestionsModal && (JOBS_BY_SECTOR_ADMIN[newJob.sector] || []).filter(j => !newJob.title || j.toLowerCase().includes(newJob.title.toLowerCase())).length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-100 rounded-2xl shadow-xl z-10 overflow-hidden">
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 px-4 pt-3 pb-1">Postes fréquents · {newJob.sector}</p>
                              {(JOBS_BY_SECTOR_ADMIN[newJob.sector] || []).filter(j => !newJob.title || j.toLowerCase().includes(newJob.title.toLowerCase())).map(job => (
                                <button key={job} type="button"
                                  onMouseDown={() => { setNewJob((p: any) => ({...p, title: job})); setShowJobSuggestionsModal(false); }}
                                  className="w-full text-left px-4 py-3 font-bold text-sm text-navy hover:bg-orange/5 hover:text-orange transition-all border-t border-gray-50 first:border-0">
                                  {job}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Secteur */}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block flex items-center gap-2">
                          {lang==='EN'?'Business sector':lang==='AR'?'قطاع النشاط':'Business sector'} <span className="normal-case font-bold text-orange/60 tracking-normal">{lang==='EN'?'· pre-filled, editable':lang==='AR'?'· مملوء مسبقاً':'· pre-filled, editable'}</span>
                        </label>
                        <select value={newJob.sector} onChange={e => setNewJob({...newJob, sector: e.target.value})}
                          className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm appearance-none cursor-pointer">
                          {dynSectors.length > 0
                            ? dynSectors.map(s => <option key={s.id} value={s.value}>{lang === 'EN' && (s as any).label_EN ? (s as any).label_EN : s.label}</option>)
                            : [['btp','BTP & Génie Civil'],['logistics','Logistique & Portuaire'],['hospitality','Hôtellerie & Tourisme'],['security','Sécurité'],['healthcare','Santé & Médical'],['admin','Administration & Finance'],['catering','Restauration'],['commerce','Commerce & Vente']].map(([v,l]) => <option key={v} value={v}>{l}</option>)
                          }
                        </select>
                      </div>

                      {/* Type de contrat */}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Contract type':lang==='AR'?'نوع العقد':'Contract type'}</label>
                        <select value={newJob.type} onChange={e => setNewJob({...newJob, type: e.target.value})}
                          className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm appearance-none cursor-pointer">
                          {dynContracts.length > 0
                            ? dynContracts.map(c => <option key={c.id} value={c.value}>{lang === 'EN' && (c as any).label_EN ? (c as any).label_EN : c.label}</option>)
                            : [['CDI','CDI'],['CDD','CDD'],['Intérim','Intérim'],['Audit','Audit / Conseil'],['Stage','Stage'],['Freelance','Freelance']].map(([v,l]) => <option key={v} value={v}>{l}</option>)
                          }
                        </select>
                      </div>

                      {/* Localisation */}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Location':lang==='AR'?'الموقع':'Location'}</label>
                        <input type="text" value={newJob.location}
                          onChange={e => setNewJob({...newJob, location: e.target.value})}
                          placeholder="Djibouti Ville, Arta..."
                          className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm placeholder:text-gray-300" />
                      </div>

                      {/* Icône emoji */}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Icon (emoji)':lang==='AR'?'أيقونة (إيموجي)':'Icon (emoji)'}</label>
                        <input type="text" value={newJob.company}
                          onChange={e => setNewJob({...newJob, company: e.target.value})}
                          className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-black text-center text-3xl transition-all shadow-sm" />
                      </div>
                    </div>

                    {/* Nb profiles / Expérience / Urgence */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Nb of profiles':lang==='AR'?'عدد الملفات':'Nb of profiles'}</label>
                        <div className="flex items-center gap-2 bg-white border-2 border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                          <button type="button" onClick={() => setNewJob((p: any) => ({...p, profileCount: Math.max(1, p.profileCount - 1)}))}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange hover:text-white font-black text-lg flex items-center justify-center transition-all">−</button>
                          <span className="flex-1 text-center font-black text-navy text-xl">{newJob.profileCount || 1}</span>
                          <button type="button" onClick={() => setNewJob((p: any) => ({...p, profileCount: (p.profileCount || 1) + 1}))}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange hover:text-white font-black text-lg flex items-center justify-center transition-all">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Experience (years)':lang==='AR'?'الخبرة (سنوات)':'Experience (years)'}</label>
                        <div className="flex items-center gap-2 bg-white border-2 border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                          <button type="button" onClick={() => setNewJob((p: any) => ({...p, expRequired: Math.max(0, (p.expRequired||3) - 1)}))}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange hover:text-white font-black text-lg flex items-center justify-center transition-all">−</button>
                          <span className="flex-1 text-center font-black text-navy text-xl">{newJob.expRequired ?? 3}</span>
                          <button type="button" onClick={() => setNewJob((p: any) => ({...p, expRequired: (p.expRequired??3) + 1}))}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange hover:text-white font-black text-lg flex items-center justify-center transition-all">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Urgency':lang==='AR'?'الإلحاح':'Urgency'}</label>
                        <div className="flex gap-2">
                          {(dynUrgencies.length > 0
                            ? dynUrgencies
                            : [{value:'low',label:'Normal'},{value:'medium',label:'Urgent'},{value:'high',label:'Critique'}]
                          ).map(u => (
                            <button key={u.value} type="button"
                              onClick={() => setNewJob((p: any) => ({...p, urgency: u.value}))}
                              className={`flex-1 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wide transition-all border-2 ${
                                (newJob.urgency || 'medium') === u.value
                                  ? u.value === 'high' ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                                  : u.value === 'medium' ? 'bg-orange text-white border-orange shadow-lg shadow-orange/20'
                                  : 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20'
                                  : 'bg-white text-gray-300 border-gray-100 hover:border-gray-200'
                              }`}>
                              {lang === 'EN' && (u as any).label_EN ? (u as any).label_EN : u.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Section 3 : Description & Options ── */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-7 h-7 rounded-xl bg-[#0F172A] flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-orange" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-navy/40">Description & Options</p>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {/* Délai */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Desired deadline':lang==='AR'?'الموعد النهائي المطلوب':'Desired deadline'}</label>
                      <div className="flex gap-3 flex-wrap">
                        {[{label:lang==='EN'?'1 week':'1 week',days:7},{label:lang==='EN'?'1 month':'1 month',days:30},{label:lang==='EN'?'3 months':'3 months',days:90}].map(({label,days}) => {
                          const d = new Date(); d.setDate(d.getDate() + days);
                          const val = d.toISOString().split('T')[0];
                          return (
                            <button key={label} type="button"
                              onClick={() => setNewJob((p: any) => ({...p, deadline: val}))}
                              className={`px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wide border-2 transition-all ${
                                newJob.deadline === val ? 'bg-orange text-white border-orange shadow-md shadow-orange/20' : 'bg-white text-gray-400 border-gray-100 hover:border-orange/30'
                              }`}>{label}</button>
                          );
                        })}
                        <input type="date" value={newJob.deadline || ''}
                          onChange={e => setNewJob({...newJob, deadline: e.target.value})}
                          className="flex-1 min-w-[140px] bg-white px-4 py-2 rounded-xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm text-sm" />
                      </div>
                    </div>

                    {/* Diplôme + Salaire */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">💼 Required diploma</label>
                        <select value={newJob.diplomaRequired || ''} onChange={e => setNewJob({...newJob, diplomaRequired: e.target.value})}
                          className="w-full bg-white px-4 py-3 rounded-xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy text-sm transition-all appearance-none shadow-sm">
                          <option value="">{t.admin.notRequired}</option>
                          {dynEducations.filter(e => e.value !== 'Sans diplôme').map(e => (
                            <option key={e.id} value={e.value}>
                              {lang === 'EN' && (e as any).label_EN ? (e as any).label_EN : e.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">💰 Salary range (DJF)</label>
                        <select value={newJob.salaryRange || ''} onChange={e => setNewJob({...newJob, salaryRange: e.target.value})}
                          className="w-full bg-white px-4 py-3 rounded-xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy text-sm transition-all appearance-none shadow-sm">
                          <option value="">{t.admin.notSpecified}</option>
                          {dynSalaries.length > 0
                            ? dynSalaries.map(s => <option key={s.id} value={s.value}>{lang === 'EN' && (s as any).label_EN ? (s as any).label_EN : s.label}</option>)
                            : ['71 000 - 80 000 DJF','80 000 - 110 000 DJF','110 000 - 140 000 DJF','140 000 - 170 000 DJF','170 000 - 205 000 DJF','205 000 - 250 000 DJF','250 000 - 300 000 DJF','300 000 - 400 000 DJF','400 000 - 500 000 DJF','500 000+ DJF'].map(s => <option key={s} value={s}>{s}</option>)
                          }
                        </select>
                      </div>
                    </div>

                    {/* Compétences clés */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">Key skills</label>
                      {selectedSkillsJob.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {selectedSkillsJob.map(skill => (
                            <span key={skill} className="flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white rounded-xl font-black text-[11px]">
                              {skill}
                              <button type="button" onClick={() => removeSkillJob(skill)}
                                className="w-4 h-4 rounded-full bg-white/20 hover:bg-red-400 flex items-center justify-center transition-all text-[10px]">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mb-3">
                        <input type="text" value={skillInputJob}
                          onChange={e => setSkillInputJob(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkillJob(skillInputJob); } }}
                          placeholder={lang==='EN'?'Type a skill + Enter...':lang==='AR'?'اكتب مهارة + Enter...':'Type a skill + Enter...'}
                          className="flex-1 bg-white px-4 py-3 rounded-xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy placeholder:text-gray-300 text-sm transition-all shadow-sm" />
                        <button type="button" onClick={() => addSkillJob(skillInputJob)}
                          className="px-4 py-3 rounded-xl bg-navy text-white font-black text-sm hover:bg-orange transition-all shadow-sm">+</button>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-2 ml-1">{lang==='EN'?'Suggestions':'Suggestions'} · {newJob.sector}</p>
                        <div className="flex flex-wrap gap-2">
                          {(SKILLS_BY_SECTOR_ADMIN[newJob.sector] || SKILLS_BY_SECTOR_ADMIN['admin']).map(skill => (
                            <button key={skill} type="button" onClick={() => addSkillJob(skill)}
                              disabled={selectedSkillsJob.includes(skill)}
                              className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-all border-2 ${
                                selectedSkillsJob.includes(skill)
                                  ? 'bg-gray-50 text-gray-200 border-gray-50 cursor-not-allowed'
                                  : 'bg-white text-gray-500 border-gray-100 hover:border-orange hover:text-orange hover:shadow-sm'
                              }`}>+ {skill}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">{lang==='EN'?'Job description':lang==='AR'?'وصف الوظيفة':'Job description'}</label>
                      <textarea rows={4}
                        value={newJob.description || ''}
                        onChange={e => setNewJob({...newJob, description: e.target.value})}
                        placeholder="Describe the missions, profile required, context..."
                        className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy placeholder:text-gray-300 transition-all shadow-sm resize-none h-32 leading-relaxed" />
                    </div>
                  </div>
                </form>
              </div>

              {/* ── Sticky footer ── */}
              <div className="shrink-0 px-4 sm:px-10 pt-3 sm:pt-4 pb-5 sm:pb-6 border-t border-gray-100" style={{ background: '#FBFBFE' }}>
                {(() => {
                  const fields = [newJob.title, newJob.companyName, newJob.sector, newJob.type, newJob.description, selectedSkillsJob.length > 0 ? 'ok' : ''];
                  const filled = fields.filter(Boolean).length;
                  const pct = Math.round((filled / fields.length) * 100);
                  return (
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">{lang==='EN'?'Completion':lang==='AR'?'الاكتمال':'Completion'}</span>
                        <span className={`text-[9px] font-black ${pct === 100 ? 'text-green-500' : 'text-orange'}`}>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#f97316' }} />
                      </div>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between gap-4">
                  <div className="hidden sm:block text-[10px] text-gray-400 font-bold">
                    <span className="text-navy font-black">{newJob.title || '—'}</span>
                    {newJob.sector && <span className="ml-2 px-2.5 py-1 bg-orange/10 text-orange rounded-lg">{newJob.sector}</span>}
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setShowAddJob(false); setEditingJob(null); setSelectedSkillsJob([]); setSkillInputJob(''); }}
                      className="px-6 py-3.5 rounded-2xl font-black text-sm text-gray-400 hover:bg-gray-100 transition-all sm:w-auto w-full text-center border border-gray-200 sm:border-0">
                      Cancel
                    </button>
                    <button type="submit" form="job-form"
                      className="flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl font-black text-sm text-white shadow-xl shadow-navy/20 hover:shadow-orange/30 hover:bg-orange transition-all active:scale-95 sm:w-auto w-full"
                      style={{ background: '#0F172A' }}>
                      <CheckCircle size={16} /> {editingJob ? t.admin.updateNow : lang==='EN'?'Publish Now':lang==='AR'?'نشر الآن':'Publish Now'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Modal Scan CV ═══ */}
      <AnimatePresence>
        {showScanCV && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => { setShowScanCV(false); setScanError(''); setScanResult(null); }} />
            <motion.div initial={{ y: 40, scale: 0.95 }} animate={{ y: 0, scale: 1 }}
              className="bg-white rounded-2xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

              {/* Header */}
              <div className="bg-gray-900 px-8 py-6 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-white font-black text-lg uppercase tracking-tight">{t.admin.scanCvTitle || 'Scan a CV'}</h3>
                  <p className="text-white/40 text-xs font-bold mt-1">{lang==='AR' ? 'يستخرج Groq AI البيانات تلقائياً' : 'Groq AI extracts data automatically'}</p>
                </div>
                <button onClick={() => { setShowScanCV(false); setScanError(''); setScanResult(null); }}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                {!scanLoading && !scanResult && (
                  <>
                    {scanError && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-black text-red-800 text-sm mb-1">Scan error</p>
                            <p className="text-red-700 text-xs font-bold">{scanError}</p>
                            <p className="text-red-500 text-xs mt-1.5">Tip: try again with a clear text PDF. If the problem persists, check that the GROQ key is configured in .env.local</p>
                          </div>
                        </div>
                        <button onClick={() => setScanError('')} className="mt-3 w-full text-xs font-bold text-red-600 hover:text-red-800 underline">
                          Try with another file
                        </button>
                      </div>
                    )}
                    <label className="block border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-gray-900 hover:bg-gray-50 transition-all group">
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setScanError('');
                          if (file.size > 10 * 1024 * 1024) {
                            setScanError('File too large (max 10MB)'); return;
                          }
                          await handleScanCV(file);
                        }} />
                      <FileText size={40} className="mx-auto text-gray-300 group-hover:text-gray-900 mb-4 transition-colors" />
                      <p className="font-black text-gray-400 group-hover:text-gray-900 uppercase tracking-widest text-sm transition-colors">
                        Click to upload a CV
                      </p>
                      <p className="text-gray-300 text-xs font-bold mt-2">PDF, JPG, PNG — max 10MB</p>
                    </label>
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-blue-800 font-black text-xs uppercase tracking-wide mb-2">What the AI will extract:</p>
                      <div className="grid grid-cols-2 gap-1">
                        {['Full name','Email','Phone','Nationality','Education','Experience','Languages','Sector'].map(item => (
                          <div key={item} className="text-blue-700 text-xs font-bold flex items-center gap-1.5">
                            <CheckCircle size={10} /> {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {scanLoading && (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-6" />
                    <p className="font-black text-gray-900 uppercase tracking-widest text-sm">{scanProgress || 'Analyzing...'}</p>
                    <p className="text-gray-400 text-xs font-bold mt-2">Groq AI is analyzing your CV</p>
                  </div>
                )}

                {scanResult && !scanLoading && (() => {
                  // Transition immédiate vers le formulaire candidat pré-rempli
                  setTimeout(() => {
                    setShowScanCV(false);
                    setNewUser(prev => ({ ...prev, role: 'candidate' }));
                    setShowAddUser(true);
                    setScanResult(null);
                  }, 0);
                  return null;
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Création Utilisateur */}
      <AnimatePresence>
        {showAddUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/95 backdrop-blur-xl" onClick={() => setShowAddUser(false)} />
            <motion.div initial={{ y: 50, scale: 0.9 }} animate={{ y: 0, scale: 1 }} className="bg-white rounded-xl w-full max-w-2xl relative z-10 shadow-sm overflow-hidden flex flex-col max-h-[95vh]">
              
              {/* Header fixe */}
              <div className="bg-gray-900 px-10 py-8 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">{t.admin.createAccount || 'CREATE ACCOUNT'}</h3>
                  <p className="text-white/40 font-bold uppercase text-[10px] tracking-normal mt-1">{t.admin.accessManagement || 'Vedior GM — Access Management'}</p>
                </div>
                <button onClick={() => setShowAddUser(false)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all outline-none">
                  <X size={22} />
                </button>
              </div>

              {/* Sélecteur de rôle */}
              <div className="px-10 py-6 border-b border-gray-100 bg-gray-50 shrink-0">
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-normal mb-4">{t.admin.accountType || 'Account type'}</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'admin', label: t.admin.adminRole || 'Administrator', icon: Crown, activeClass: 'bg-gray-700 border-purple-600 text-white shadow-lg shadow-purple-200' },
                    { value: 'recruiter', label: t.admin.recruiterRole || 'Recruiter', icon: UserCheck, activeClass: 'bg-gray-700 border-blue-600 text-white shadow-lg shadow-blue-200' },
                    { value: 'candidate', label: t.admin.candidateRole || 'Candidate', icon: User, activeClass: 'bg-gray-900 border-gray-300 text-white shadow-lg shadow-gray-200/30' },
                  ].map(({ value, label, icon: RIcon, activeClass }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNewUser({ ...newUser, role: value })}
                      className={`p-4 rounded-2xl border-2 flex items-center gap-3 transition-all font-black text-sm ${
                        newUser.role === value ? activeClass : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      <RIcon size={20} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corps du formulaire scrollable */}
              <form onSubmit={handleCreateUser} className="overflow-y-auto flex-1">
                <div className="px-10 py-8 space-y-6">

                  {/* ===== CHAMPS ADMIN ===== */}
                  {newUser.role === 'admin' && (
                    <>
                      <div className="flex items-center gap-3 pb-2 border-b border-purple-100">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-gray-600 flex items-center justify-center"><Crown size={16} /></div>
                        <p className="font-black text-gray-700 uppercase text-sm tracking-normal">{t.admin.adminInfo || 'Administrator Information'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.fullNameLabel || 'Full name'} *</label>
                          <input type="text" required value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})}
                            placeholder="Ex: Nasser Ahmed" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.emailLabel || 'Email'} *</label>
                          <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                            placeholder="admin@vedior-gm.dj" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.passwordLabel || 'Password'} *</label>
                          <input type="password" required minLength={6} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                            placeholder={t.admin.passwordPlaceholder || 'Min. 6 characters'} className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Téléphone</label>
                          <input type="tel" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})}
                            placeholder="+253 77 XX XX XX" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Niveau d'accès *</label>
                          <div className="grid grid-cols-2 gap-3">
                            {[{v:'admin',l:'Administrateur',d:'Accès complet sauf gestion des owners'},{v:'owner',l:'Propriétaire (Owner)',d:'Accès total à toutes les fonctionnalités'}].map(({v,l,d}) => (
                              <button key={v} type="button" onClick={() => setNewUser({...newUser, adminLevel: v})}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${newUser.adminLevel === v ? 'bg-gray-50 border-gray-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                                <p className={`font-black text-sm ${newUser.adminLevel === v ? 'text-gray-700' : 'text-gray-600'}`}>{l}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{d}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 border-2 border-purple-100 rounded-xl flex items-start gap-3">
                        <Shield size={16} className="text-gray-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-purple-800 font-medium">Ce compte aura accès au panneau d'administration. L'utilisateur devra se connecter via Google avec cet email.</p>
                      </div>
                    </>
                  )}

                  {/* ===== CHAMPS RECRUTEUR ===== */}
                  {newUser.role === 'recruiter' && (
                    <>
                      <div className="flex items-center gap-3 pb-2 border-b border-blue-100">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-gray-700 flex items-center justify-center"><Building2 size={16} /></div>
                        <p className="font-black text-blue-700 uppercase text-sm tracking-normal">Informations Entreprise</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Nom de la société *</label>
                          <input type="text" required value={newUser.companyName} onChange={e => setNewUser({...newUser, companyName: e.target.value})}
                            placeholder="Ex: Colas Djibouti" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-400 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Nom du contact *</label>
                          <input type="text" required value={newUser.contactName} onChange={e => setNewUser({...newUser, contactName: e.target.value})}
                            placeholder="Ex: Hassan Ali" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-400 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Email professionnel *</label>
                          <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                            placeholder="drh@societe.dj" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-400 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.phoneLabel || 'Phone'} *</label>
                          <input type="tel" required value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})}
                            placeholder="+253 77 XX XX XX" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-400 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">N° Registre de Commerce</label>
                          <input type="text" value={newUser.rcNumber} onChange={e => setNewUser({...newUser, rcNumber: e.target.value})}
                            placeholder="RC-DJ-XXXX" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-400 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Site web</label>
                          <input type="url" value={newUser.website} onChange={e => setNewUser({...newUser, website: e.target.value})}
                            placeholder="https://societe.dj" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-400 font-bold text-gray-900" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Secteur d'activité *</label>
                          <select value={newUser.sector} onChange={e => setNewUser({...newUser, sector: e.target.value})}
                            className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-400 font-bold text-gray-900 appearance-none">
                            {dynSectors.map(s => <option key={s.id} value={s.value}>{lang === 'EN' && (s as any).label_EN ? (s as any).label_EN : s.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ===== CHAMPS CANDIDAT ===== */}
                  {newUser.role === 'candidate' && (
                    <>
                      <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-900 flex items-center justify-center"><User size={16} /></div>
                        <p className="font-black text-gray-900 uppercase text-sm tracking-normal">{t.admin.candidateInfo || 'Candidate Information'}</p>
                      </div>

                      {/* ── Bannière scan CV ── */}
                      {(newUser.fullName || newUser.email || newUser.phone) && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                            <FileText size={14} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-blue-900 text-xs uppercase tracking-wider">{t.admin.aiExtractedBanner || t.admin.aiExtractedBanner || 'AI-EXTRACTED CV DATA'}</p>
                            <p className="text-blue-600 text-[11px] font-medium mt-0.5">{t.admin.aiExtractedDesc || t.admin.aiExtractedDesc || 'Check and correct fields before creating the account'}</p>
                          </div>
                          <Sparkles size={16} className="text-blue-400 shrink-0" />
                        </div>
                      )}

                      {/* ── Profile photo ── */}
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        {/* Avatar preview cliquable */}
                        <div className="relative shrink-0">
                          <button type="button"
                            onClick={() => (manualPhotoPreview || scannedPhotoDataUrl) && setShowPhotoPreview(true)}
                            className={`w-20 h-20 rounded-2xl overflow-hidden border-2 bg-gray-100 flex items-center justify-center shadow-sm transition-all ${(manualPhotoPreview || scannedPhotoDataUrl) ? 'border-blue-300 cursor-zoom-in hover:opacity-90' : 'border-gray-200 cursor-default'}`}>
                            {(manualPhotoPreview || scannedPhotoDataUrl) ? (
                              <img src={manualPhotoPreview || scannedPhotoDataUrl || ''} alt="Profile photo" className="w-full h-full object-cover" />
                            ) : (
                              <User size={32} className="text-gray-300" />
                            )}
                          </button>
                          {(manualPhotoPreview || scannedPhotoDataUrl) && (
                            <>
                              {/* Bouton zoom */}
                              <button type="button" onClick={() => setShowPhotoPreview(true)}
                                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center hover:bg-blue-600 transition-all shadow"
                                title="Agrandir">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                              </button>
                              {/* Bouton supprimer */}
                              <button type="button"
                                onClick={() => { setManualPhotoFile(null); setManualPhotoPreview(null); setScannedPhotoDataUrl(null); }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-all shadow">
                                ×
                              </button>
                            </>
                          )}
                        </div>
                        {/* Infos + bouton upload */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-gray-700 mb-0.5">{t.admin.photoProfile || t.admin.photoProfile || 'Photo de profil'}</p>
                          {scannedPhotoDataUrl && !manualPhotoPreview ? (
                            <p className="text-[10px] text-blue-500 font-semibold mb-2">{t.admin.photoExtracted || '📸 Extracted from CV · Click to enlarge'}</p>
                          ) : manualPhotoPreview ? (
                            <p className="text-[10px] text-green-600 font-semibold mb-2">{t.admin.photoImportedManually || '✅ Photo importée manuellement'}</p>
                          ) : (
                            <p className="text-[10px] text-gray-400 font-medium mb-2">{t.admin.noPhotoDetected || '{t.admin.none}e photo détectée dans le CV'}</p>
                          )}
                          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-gray-200 text-xs font-black text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all">
                            <Download size={12} /> {manualPhotoPreview || scannedPhotoDataUrl ? (t.admin.changePhoto || 'Changer') : (t.admin.importPhoto || 'Importer une photo')}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setManualPhotoFile(f);
                                const reader = new FileReader();
                                reader.onload = ev => setManualPhotoPreview(ev.target?.result as string);
                                reader.readAsDataURL(f);
                                setScannedPhotoDataUrl(null);
                              }} />
                          </label>
                        </div>
                      </div>

                      {/* ── Modal agrandissement photo ── */}
                      {showPhotoPreview && (manualPhotoPreview || scannedPhotoDataUrl) && (
                        <div className="fixed inset-0 z-[600] flex items-center justify-center"
                          onClick={() => setShowPhotoPreview(false)}>
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                          <div className="relative z-10 flex flex-col items-center gap-4">
                            <div className="w-72 h-72 rounded-3xl overflow-hidden border-4 border-white shadow-2xl">
                              <img src={manualPhotoPreview || scannedPhotoDataUrl || ''} alt="Profile photo"
                                className="w-full h-full object-cover" />
                            </div>
                            <p className="text-white/70 text-xs font-semibold">
                              {scannedPhotoDataUrl && !manualPhotoPreview ? (t.admin.photoExtracted || '📸 Photo extraite du CV') : (t.admin.photoImportedManually || '✅ Photo importée')}
                            </p>
                            <button onClick={() => setShowPhotoPreview(false)}
                              className="px-6 py-2 rounded-xl bg-white text-gray-900 font-black text-sm hover:bg-gray-100 transition-all">
                              {t.admin.closeBtn || 'Fermer'}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.fullNameLabel || 'Full name'} *</label>
                          <input type="text" required value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                            placeholder={t.admin.fullNamePlaceholder || 'Ex: Mohamed Ahmed Ali'} className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.emailLabel || 'Email'} *</label>
                          <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                            placeholder={t.admin.emailPlaceholderCandidate || 'candidat@email.com'} className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.phoneLabel || 'Phone'} *</label>
                          <input type="tel" required value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})}
                            placeholder="+253 77 XX XX XX" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">WhatsApp</label>
                          <input type="tel" value={newUser.whatsapp} onChange={e => setNewUser({...newUser, whatsapp: e.target.value})}
                            placeholder="+253 77 XX XX XX" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.nationalityLabel || 'Nationality'}</label>
                          <input type="text" value={newUser.nationality} onChange={e => setNewUser({...newUser, nationality: e.target.value})}
                            placeholder={t.admin.nationalityPlaceholder || 'Ex: Djiboutian'} className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.genderLabel || 'Gender'}</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[{v:'M',l: t.admin.male || 'Male'},{v:'F',l: t.admin.female || 'Female'}].map(({v,l}) => (
                              <button key={v} type="button" onClick={() => setNewUser({...newUser, gender: v})}
                                className={`p-3 rounded-xl border-2 font-black text-sm transition-all ${newUser.gender === v ? 'bg-gray-900 text-white border-gray-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.educationLabel || 'Education level'}</label>
                          <select value={newUser.education} onChange={e => setNewUser({...newUser, education: e.target.value})}
                            className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900 appearance-none">
                            <option value="">{t.admin.select}</option>
                            {dynEducations.map(e => <option key={e.id} value={e.value}>{lang === 'EN' && (e as any).label_EN ? (e as any).label_EN : e.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.experienceLabel || 'Years of experience'}</label>
                          <input type="number" min="0" max="50" value={newUser.experience} onChange={e => setNewUser({...newUser, experience: e.target.value})}
                            placeholder="Ex: 5" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.sectorLabel || 'Target sector'}</label>
                          <select value={newUser.candidateSector} onChange={e => setNewUser({...newUser, candidateSector: e.target.value})}
                            className={`w-full p-4 rounded-xl border-2 outline-none font-bold appearance-none ${!newUser.candidateSector || newUser.candidateSector === 'non-precise' ? 'text-gray-400 bg-amber-50 border-amber-200 focus:border-amber-400' : 'text-gray-900 bg-gray-50 border-gray-200 focus:border-gray-300'}`}>
                            <option value="">{t.admin.selectSector || '— Select a sector —'}</option>
                            {dynSectors.map(s => <option key={s.id} value={s.value}>{lang === 'EN' && (s as any).label_EN ? (s as any).label_EN : s.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.availabilityLabel || 'Availability'}</label>
                          <select value={newUser.availability} onChange={e => setNewUser({...newUser, availability: e.target.value})}
                            className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900 appearance-none">
                            {dynAvailabilities.map(a => <option key={a.id} value={a.value}>{lang === 'EN' && (a as any).label_EN ? (a as any).label_EN : a.label}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.languagesLabel || 'Languages'}</label>
                          <input type="text" value={newUser.languages} onChange={e => setNewUser({...newUser, languages: e.target.value})}
                            placeholder={t.admin.languagesPlaceholder || 'Ex: French, Arabic, English, Somali'} className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">{t.admin.addressLabel || 'Address / District'}</label>
                          <input type="text" value={newUser.address} onChange={e => setNewUser({...newUser, address: e.target.value})}
                            placeholder={t.admin.addressPlaceholder || 'Ex: Balbala, Djibouti...'} className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                      </div>
                    </>
                  )}

                </div>

                {/* Footer fixe */}
                <div className="px-10 py-6 border-t border-gray-100 bg-gray-50 flex gap-4 shrink-0">
                  <button type="button" onClick={() => setShowAddUser(false)}
                    className="flex-1 py-4 font-black text-gray-500 uppercase tracking-normal hover:text-red-500 transition-all border-2 border-gray-200 rounded-2xl bg-white hover:border-red-200">
                    {t.admin.cancel || 'Cancel'}
                  </button>
                  <button type="submit" disabled={userSaving}
                    className={`flex-2 px-10 py-4 rounded-2xl font-black uppercase tracking-[0.15em] shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-white ${
                      newUser.role === 'admin' ? 'bg-gray-700 hover:bg-purple-700 shadow-purple-200'
                      : newUser.role === 'recruiter' ? 'bg-gray-700 hover:bg-blue-700 shadow-blue-200'
                      : 'bg-gray-900 hover:bg-gray-700/90 shadow-gray-200/30'
                    }`}>
                    {userSaving ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
                    {userSaving ? t.admin.creating || 'Creating...' : t.admin.createAccountBtn || 'Create account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ MODALE IDENTIFIANTS GÉNÉRÉS ═══════ */}
      <AnimatePresence>
        {generatedCredentials && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setGeneratedCredentials(null)} />
            <motion.div
              initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }}
              transition={{ type: 'spring', damping: 20 }}
              className="bg-white rounded-xl w-full max-w-lg relative z-10 shadow-sm overflow-hidden"
            >
              {/* Header succès */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-10 py-8 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={36} className="text-white" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">{t.admin.accountCreated}</h3>
                <p className="text-white/70 text-xs font-bold mt-1 uppercase tracking-normal">
                  {generatedCredentials.role === 'recruiter' ? t.admin.roleRecruiter
                    : generatedCredentials.role === 'candidate' ? t.admin.roleCandidate
                    : t.admin.roleAdmin} — {generatedCredentials.displayName}
                </p>
              </div>

              <div className="p-8 space-y-4">

                {/* Email envoyé confirmation */}
                {generatedCredentials.emailSent && (generatedCredentials.role === 'recruiter' || generatedCredentials.role === 'candidate') && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 flex items-start gap-3">
                    <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-black text-green-800">{t.admin.emailAutoSent}</p>
                      <p className="text-xs text-green-600 font-bold mt-0.5">
                        {generatedCredentials.role === 'recruiter'
                          ? `${t.admin.resetLinkSent} ${generatedCredentials.email}`
                          : `${t.admin.vgmIdSent} ${generatedCredentials.email}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Échec réel de l'envoi d'email — partage manuel requis */}
                {!generatedCredentials.emailSent && (generatedCredentials.role === 'recruiter' || generatedCredentials.role === 'candidate') && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-black text-red-800">Échec de l'envoi de l'email</p>
                      <p className="text-xs text-red-600 font-bold mt-0.5">
                        Le compte a bien été créé, mais l'email automatique n'a pas pu être envoyé à {generatedCredentials.email}.
                        Partagez le mot de passe temporaire ci-dessous manuellement avec l'utilisateur.
                      </p>
                    </div>
                  </div>
                )}

                {/* Avertissement */}
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm font-bold text-amber-800">
                    {generatedCredentials.role === 'recruiter'
                      ? t.admin.warningRecruiter
                      : generatedCredentials.role === 'candidate'
                      ? t.admin.warningCandidate
                      : t.admin.warningAdmin}
                  </p>
                </div>

                {/* Email */}
                <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-normal mb-1 flex items-center gap-2">
                    <Mail size={11} /> {t.admin.loginEmailLabel}
                  </p>
                  <p className="font-black text-gray-900 text-base">{generatedCredentials.email}</p>
                </div>

                {/* ID VGM — recruteurs & candidats uniquement */}
                {generatedCredentials.role !== 'admin' && generatedCredentials.tempId && (
                  <div className="bg-gray-100 border-2 border-gray-200 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase text-gray-900 tracking-normal mb-1 flex items-center gap-2">
                      <KeyRound size={11} /> {t.admin.vgmIdentifier}
                    </p>
                    <p className="font-black text-gray-900 text-2xl font-mono tracking-[0.15em]">
                      {generatedCredentials.tempId}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold mt-1">
                      {t.admin.vgmIdDesc}
                    </p>
                  </div>
                )}

                {/* Mot de passe */}
                <div className="bg-gray-900 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase text-white/50 tracking-normal mb-1 flex items-center gap-2">
                    <Shield size={11} /> {t.admin.tempPasswordLabel}
                  </p>
                  <p className="font-black text-white text-2xl font-mono tracking-[0.15em]">
                    {generatedCredentials.tempPassword}
                  </p>
                  <p className="text-[10px] text-white/30 font-bold mt-1">
                    {generatedCredentials.role === 'admin'
                      ? t.admin.tempPasswordDescAdmin
                      : t.admin.tempPasswordDescUser}
                  </p>
                </div>

                {/* Bouton copier */}
                <button
                  onClick={() => {
                    const text = generatedCredentials.role !== 'admin'
                      ? `${t.admin.accessVedior}
Email : ${generatedCredentials.email}
${t.admin.vgmIdentifier} : ${generatedCredentials.tempId}
Mot de passe : ${generatedCredentials.tempPassword}

${t.admin.connectOn}`
                      : `${t.admin.accessVediorAdmin}
Email : ${generatedCredentials.email}
Mot de passe : ${generatedCredentials.tempPassword}`;
                    navigator.clipboard.writeText(text);
                    setCredentialsCopied(true);
                    setTimeout(() => setCredentialsCopied(false), 3000);
                  }}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-normal transition-all flex items-center justify-center gap-3 ${
                    credentialsCopied
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-900 text-white hover:bg-gray-900'
                  }`}
                >
                  {credentialsCopied
                    ? <><CheckCircle size={18} /> {t.admin.copied}</>
                    : <><Mail size={18} /> {t.admin.copyCredentials}</>}
                </button>

                <button
                  onClick={() => { setGeneratedCredentials(null); setCredentialsCopied(false); }}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-normal border-2 border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 transition-all"
                >
                  {t.admin.closeBtn}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
{/* ── User Profile Modal ── */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center p-4"
            onClick={() => { setSelectedUser(null); setEditingUser(null); }}
          >
            <div className="absolute inset-0" style={{ background: 'rgba(10,20,40,0.85)', backdropFilter: 'blur(12px)' }} />
            <motion.div
              initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={e => e.stopPropagation()}
              className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl"
              style={{ background: '#FBFBFE' }}
            >
              {/* Header */}
              <div className="px-10 pt-10 pb-8 shrink-0 flex items-start justify-between"
                style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1e3a5f 100%)' }}>
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-lg"
                    style={{ background: 'rgba(255,255,255,0.15)' }}>
                    {(selectedUser.fullName || selectedUser.displayName || selectedUser.companyName || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange/70 mb-1">
                      {selectedUser.role === 'candidate' ? 'Candidat' : selectedUser.role === 'recruiter' ? 'Recruteur' : 'Administrateur'}
                      {selectedUser.tempId && ` · ${selectedUser.tempId}`}
                    </p>
                    <h3 className="text-2xl font-black text-white">
                      {selectedUser.fullName || selectedUser.displayName || selectedUser.companyName || '—'}
                    </h3>
                    <p className="text-white/50 text-sm font-bold mt-0.5">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!editingUser && (
                    <button onClick={() => setEditingUser({...selectedUser})}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-black text-xs hover:bg-orange transition-all">
                      <Edit size={14} /> Modifier
                    </button>
                  )}
                  <button onClick={() => { setSelectedUser(null); setEditingUser(null); }}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-10 space-y-6">

                {/* Infos grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Text fields */}
                  {[
                    { label: 'Nom complet', field: 'fullName', value: selectedUser.fullName || selectedUser.displayName },
                    { label: 'Email', field: 'email', value: selectedUser.email },
                    { label: 'Téléphone', field: 'phone', value: selectedUser.phone },
                    { label: 'WhatsApp', field: 'whatsapp', value: selectedUser.whatsapp },
                    { label: 'Adresse', field: 'address', value: selectedUser.address },
                    { label: 'Formation', field: 'education', value: selectedUser.education },
                    { label: 'Expérience (années)', field: 'experience', value: selectedUser.experience },
                    { label: 'Langues', field: 'languages', value: selectedUser.languages },
                    { label: 'Poste', field: 'jobTitle', value: selectedUser.jobTitle },
                    { label: 'Société', field: 'companyName', value: selectedUser.companyName },
                  ].filter(f => editingUser ? true : f.value).map(({ label, field, value }) => (
                    <div key={field} className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">{label}</p>
                      {editingUser ? (
                        <input
                          value={editingUser[field] || ''}
                          onChange={e => setEditingUser((prev: any) => ({ ...prev, [field]: e.target.value }))}
                          className="w-full bg-transparent font-black text-sm text-navy outline-none border-b border-orange/30 focus:border-orange pb-0.5"
                        />
                      ) : (
                        <p className="font-black text-sm text-navy">{value || '—'}</p>
                      )}
                    </div>
                  ))}

                  {/* Nationalité — select */}
                  <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Nationalité</p>
                    {editingUser ? (
                      <select value={editingUser.nationality || ''} onChange={e => setEditingUser((prev: any) => ({ ...prev, nationality: e.target.value }))}
                        className="w-full bg-transparent font-black text-sm text-navy outline-none border-b border-orange/30 focus:border-orange pb-0.5">
                        <option value="">—</option>
                        {dynNationalities.map(n => <option key={n.value} value={n.value}>{lang === 'EN' && (n as any).label_EN ? (n as any).label_EN : n.label}</option>)}
                      </select>
                    ) : (
                      <p className="font-black text-sm text-navy">{selectedUser.nationality || '—'}</p>
                    )}
                  </div>

                  {/* Secteur — select */}
                  <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">{lang==='FR'?'Secteur':lang==='AR'?'القطاع':'Sector'}</p>
                    {editingUser ? (
                      <select value={editingUser.sector || editingUser.candidateSector || ''} onChange={e => setEditingUser((prev: any) => ({ ...prev, sector: e.target.value, candidateSector: e.target.value }))}
                        className="w-full bg-transparent font-black text-sm text-navy outline-none border-b border-orange/30 focus:border-orange pb-0.5">
                        <option value="">—</option>
                        <option value="">{t.admin.selectSector || '— Select a sector —'}</option>
                        {dynSectors.map(s => <option key={s.value} value={s.value}>{lang === 'EN' && (s as any).label_EN ? (s as any).label_EN : s.label}</option>)}
                      </select>
                    ) : (
                      <p className="font-black text-sm text-navy">{dynSectors.find(s => s.value === (selectedUser.sector || selectedUser.candidateSector))?.label || selectedUser.sector === 'non-precise' ? '{t.admin.notSpecified}' : selectedUser.sector || '—'}</p>
                    )}
                  </div>

                  {/* Disponibilité — select */}
                  <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Disponibilité</p>
                    {editingUser ? (
                      <select value={editingUser.availability || ''} onChange={e => setEditingUser((prev: any) => ({ ...prev, availability: e.target.value }))}
                        className="w-full bg-transparent font-black text-sm text-navy outline-none border-b border-orange/30 focus:border-orange pb-0.5">
                        <option value="">—</option>
                        {dynAvailabilities.map(a => <option key={a.value} value={a.value}>{lang === 'EN' && (a as any).label_EN ? (a as any).label_EN : a.label}</option>)}
                      </select>
                    ) : (
                      <p className="font-black text-sm text-navy">{dynAvailabilities.find(a => a.value === selectedUser.availability)?.label || selectedUser.availability || '—'}</p>
                    )}
                  </div>

                  {/* Statut — select */}
                  <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">{'Status'}</p>
                    {editingUser ? (
                      <select value={editingUser.status || 'active'} onChange={e => setEditingUser((prev: any) => ({ ...prev, status: e.target.value }))}
                        className="w-full bg-transparent font-black text-sm text-navy outline-none border-b border-orange/30 focus:border-orange pb-0.5">
                        <option value="active">{t.admin.active}</option>
                        <option value="pending">{t.admin.pending}</option>
                        <option value="disabled">{t.admin.disabled}</option>
                        <option value="rejected">{t.admin.rejected}</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        selectedUser.status === 'active' ? 'bg-green-100 text-green-700' :
                        selectedUser.status === 'disabled' ? 'bg-red-100 text-red-500' :
                        'bg-orange/10 text-orange'
                      }`}>
                        {selectedUser.status === 'active' ? 'Actif' : selectedUser.status === 'disabled' ? 'Désactivé' : selectedUser.status || '—'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Compétences */}
                {(selectedUser.skills || editingUser) && (
                  <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-2">Compétences</p>
                    {editingUser ? (
                      <input
                        value={editingUser.skills || ''}
                        onChange={e => setEditingUser((prev: any) => ({ ...prev, skills: e.target.value }))}
                        placeholder="Compétences séparées par virgules..."
                        className="w-full bg-transparent font-bold text-sm text-navy outline-none border-b border-orange/30 focus:border-orange"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(selectedUser.skills || '').split(',').filter(Boolean).map((s: string) => (
                          <span key={s} className="px-3 py-1.5 bg-navy text-white text-[11px] font-black rounded-xl">{s.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Documents / Pièces jointes */}
                <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-3">📎 Attachments</p>
                  {(() => {
                    const docs = [
                      selectedUser.cvUrl ? { label: '📄 Resume', url: selectedUser.cvUrl, color: 'bg-navy text-white' } : null,
                      selectedUser.idUrl ? { label: '🪪 ID document', url: selectedUser.idUrl, color: 'bg-blue-50 text-navy' } : null,
                      selectedUser.diplomaUrl ? { label: '🎓 Diploma', url: selectedUser.diplomaUrl, color: 'bg-purple-50 text-purple-700' } : null,
                      selectedUser.certUrl ? { label: '📜 Certificate', url: selectedUser.certUrl, color: 'bg-green-50 text-green-700' } : null,
                      ...(selectedUser.cvUrls || []).map((url: string, i: number) => ({ label: `📄 Document ${i + 1}`, url, color: 'bg-gray-100 text-navy' })),
                      ...(selectedUser.documents || []).map((doc: any, i: number) => ({ label: doc.name || `📎 Fichier ${i + 1}`, url: doc.url || doc, color: 'bg-gray-100 text-navy' })),
                    ].filter(Boolean);

                    return docs.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {docs.map((doc: any) => (
                          <a key={doc.url} href={doc.url} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs hover:opacity-80 transition-all ${doc.color}`}>
                            {doc.label}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-300 text-sm font-bold italic">{t.admin.none}attachments</p>
                    );
                  })()}
                </div>

                {/* Meta */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Created on', value: selectedUser.createdAt?.toDate?.()?.toLocaleDateString(lang === 'EN' ? 'en-US' : 'fr-FR') },
                    { label: 'Created by', value: selectedUser.createdBy || 'Auto' },
                    { label: 'Login', value: selectedUser.loginMethod === 'google' ? '🔵 Google' : '📧 Email' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">{label}</p>
                      <p className="font-black text-xs text-navy">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              {editingUser && (
                <div className="shrink-0 px-10 py-6 border-t border-gray-100 flex gap-3">
                  <button onClick={handleSaveUser} disabled={savingUser}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-orange text-white font-black text-sm hover:bg-navy transition-all shadow-lg disabled:opacity-50">
                    {savingUser ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : <><CheckCircle size={16} /> Save changes</>}
                  </button>
                  <button onClick={() => setEditingUser(null)}
                    className="px-8 py-4 rounded-2xl text-gray-400 font-black text-sm hover:bg-gray-100 transition-all">
                    {t.admin.cancel || 'Cancel'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-stretch z-[300]" style={{height:60, paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
        {bottomNav.map(item => (
          <button key={item.id} onClick={() => goTo(item.id as any)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${activeTab===item.id?'text-[#4F6EF7]':'text-gray-400'}`}>
            {item.badge ? (
              <div className="relative">
                <item.icon size={20} strokeWidth={1.8} />
                <div className={`absolute -top-1.5 -right-2 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${activeTab===item.id?'bg-[#4F6EF7]':'bg-[#E8531A]'}`}>{item.badge>9?'9+':item.badge}</div>
              </div>
            ) : (
              <item.icon size={20} strokeWidth={1.8} />
            )}
            <span className="text-[10px] font-medium">{item.label}</span>
            {activeTab===item.id && <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-[#4F6EF7] rounded-full" />}
          </button>
        ))}
      </nav>
    </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge, badgeColor = 'blue' }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: string | number | null, badgeColor?: 'blue' | 'orange' }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-[9px] rounded-lg transition-colors mb-0.5 ${active ? 'bg-[#4F6EF7]/[0.18]' : 'hover:bg-[#1E2240]'}`}
    >
      <Icon size={18} strokeWidth={1.8} className={`shrink-0 ${active ? 'text-[#4F6EF7]' : 'text-white/60'}`} />
      <span className={`flex-1 text-left text-[13.5px] font-medium truncate ${active ? 'text-white' : 'text-white/60'}`}>{label}</span>
      {badge ? (
        <span className={`text-[10px] font-bold leading-none px-[7px] py-[3px] rounded-full text-white shrink-0 ${badgeColor === 'orange' ? 'bg-[#F59E0B]' : 'bg-[#4F6EF7]'}`}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function StatCard({ title, value, icon: Icon, change, data, color, onClick, t }: { title: string, value: string, icon: any, change: string, data: any[], color: string, onClick?: () => void, t: any }) {
  const colors: any = {
    blue: 'text-blue-500 bg-blue-50 border-blue-100 shadow-blue-500/10',
    orange: 'text-gray-900 bg-gray-100 border-gray-200 shadow-gray-200/10',
    green: 'text-green-500 bg-green-50 border-green-100 shadow-green-500/10',
    purple: 'text-purple-500 bg-gray-50 border-purple-100 shadow-purple-500/10',
  };

  return (
    <div onClick={onClick} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-sm hover:scale-[1.02] transition-all cursor-pointer group">
       <div className="flex justify-between items-start mb-6">
          <div>
             <p className="text-[11px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2">{title}</p>
             <p className="text-4xl font-black text-gray-900">{value}</p>
          </div>
          <div className={`w-14 h-14 rounded-3xl flex items-center justify-center border shadow-lg group-hover:rotate-12 transition-transform ${colors[color]}`}>
             <Icon size={28} />
          </div>
       </div>
       <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-2">
             <div className="text-[10px] font-black text-green-500 bg-green-50 px-2.5 py-1 rounded-lg border border-green-100">{change}</div>
             <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter italic">{t.admin.vsLastMonth}</p>
          </div>
          <div className="h-12 w-28 opacity-40 group-hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height={48}>
              <AreaChart data={data}>
                <Area type="monotone" dataKey="v" stroke={color === 'orange' ? '#f97316' : color === 'blue' ? '#3b82f6' : '#22c55e'} fill={color === 'orange' ? '#f97316' : color === 'blue' ? '#3b82f6' : '#22c55e'} fillOpacity={0.1} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
}