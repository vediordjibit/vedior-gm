import React, { useState, useEffect } from 'react';
import {
  Briefcase, Users, Calendar, MapPin, MessageCircle, ChevronRight,
  Upload, Menu, X, Phone, Mail, Clock, Building2, Ship,
  HardHat, Utensils, ShieldCheck, Hospital, CheckCircle2,
  FileText, Search, Loader2, Star, ArrowRight, ArrowUpCircle,
  ExternalLink, User, BarChart3, Grid, List,
  Banknote, GraduationCap, Timer, BookOpen, ChevronDown, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from './lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import AdminPanel from './components/AdminPanel';
import RecruiterPanel from './components/RecruiterPanel';
import CandidatePanel from './components/CandidatePanel';
import { useTranslation, setLangStorage, type Lang } from './lib/i18n';
import { useCompanyInfo } from './lib/useCompanyInfo';

// ==================== TYPES ====================
type Job = {
  id: number;
  title: string;
  sector: string;
  location: string;
  type: string;
  tags: string[];
  company: string;
};

// ==================== DONNÉES STATIQUES ====================
const SECTORS = [
  { id: 'btp', key: 'btp', icon: HardHat, color: 'bg-blue-500' },
  { id: 'logistics', key: 'logistics', icon: Ship, color: 'bg-navy' },
  { id: 'hospitality', key: 'hospitality', icon: Utensils, color: 'bg-orange' },
  { id: 'security', key: 'security', icon: ShieldCheck, color: 'bg-red-600' },
  { id: 'catering', key: 'catering', icon: Utensils, color: 'bg-yellow-600' },
  { id: 'commerce', key: 'commerce', icon: Briefcase, color: 'bg-green-600' },
  { id: 'healthcare', key: 'healthcare', icon: Hospital, color: 'bg-cyan-500' },
  { id: 'admin', key: 'admin', icon: FileText, color: 'bg-slate-600' },
];

// ==================== COMPOSANTS ====================
const Logo = ({ scrolled = false, inverted = false, className = "", size = "md" }: { scrolled?: boolean; inverted?: boolean; className?: string; size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: "h-12",
    md: "h-20",
    lg: "h-28"
  };
  const currentSize = sizes[size];
  const isDark = inverted || scrolled;

  return (
    <div className={`flex items-center transition-all duration-500 ${className}`}>
      <img 
        src="/logo.png" 
        alt="Vedior GM" 
        className={`${currentSize} w-auto object-contain transition-all duration-500 ${isDark ? 'brightness-100' : 'brightness-100'}`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

const Navbar = ({ onContactClick, onAdminClick, onRecruiterClick, onCandidateClick, lang, setLang, t }: { onContactClick: () => void; onAdminClick: () => void; onRecruiterClick: () => void; onCandidateClick: () => void; lang: string; setLang: (l: string) => void; t: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks: { name: string; href?: string; onClick?: () => void; important?: boolean; badge?: string }[] = [
    { name: t.nav.home, href: '#home' },
    { name: t.nav.candidate, href: '#candidate' },
    { name: t.hero_section.mySpace, onClick: onCandidateClick, important: true },
    { name: t.nav.recruiterPanel, onClick: onRecruiterClick, important: true },
    { name: t.nav.services, href: '#services' },
    { name: t.nav.offers, href: '#offers' },
    { name: t.nav.about, href: '#about' },
    { name: t.nav.admin, onClick: onAdminClick },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-in-out ${
      scrolled 
        ? 'bg-navy/97 backdrop-blur-2xl h-22 border-b border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]' 
        : 'bg-navy backdrop-blur-xl h-26 border-b border-white/10 shadow-[0_4px_24px_rgba(13,43,78,0.3)]'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between h-full relative">
        {/* LOGO AREA */}
        <a href="#home" className="group">
          <Logo scrolled={scrolled} />
        </a>

        {/* DESKTOP NAV */}
        <div className="hidden lg:flex items-center gap-4">
          <div className={`flex items-center p-1 rounded-full border transition-all duration-500 ${scrolled ? 'bg-white/5 border-white/10' : 'bg-navy/5 border-navy/10'}`}>
            {navLinks.slice(0, 7).map((link) => (
              link.href ? (
                <a 
                  key={link.name} 
                  href={link.href} 
                  className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all duration-300 rounded-full text-white hover:text-orange hover:bg-white/10`}
                >
                  {link.name}
                </a>
              ) : (
                <button 
                  key={link.name} 
                  onClick={link.onClick} 
                  className={`relative px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-full transition-all duration-300 group ${
                    link.important 
                      ? 'text-white font-black bg-orange hover:bg-orange/80 hover:text-white mx-1 shadow-lg shadow-orange/30' 
                      : 'text-white hover:text-orange hover:bg-white/10'
                  }`}
                >
                  {link.name}
                  {link.badge && (
                    <span className="absolute -top-1 -right-1 bg-orange text-[7px] text-white px-1.5 py-0.5 rounded-full font-black animate-pulse shadow-lg shadow-orange/40">
                      {link.badge}
                    </span>
                  )}
                </button>
              )
            ))}
          </div>

          <div className="flex items-center gap-3 ml-4">
            {/* Lang Switcher */}
            <div className="flex p-1 rounded-lg border bg-white/5 border-white/10">
              {['FR', 'AR', 'EN'].map((l) => (
                <button 
                  key={l} 
                  onClick={() => setLang(l as 'FR'|'AR'|'EN')} 
                  className={`w-8 h-7 flex items-center justify-center text-[10px] font-black rounded transition-all ${
                    lang === l 
                      ? 'bg-orange text-white' 
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* CTA */}
            <button 
              onClick={onContactClick} 
              className="relative group overflow-hidden bg-[#FBFBFE] text-navy px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl"
            >
              <div className="absolute inset-0 bg-orange translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative z-10 group-hover:text-white transition-colors">{t.nav.contact}</span>
            </button>

            {/* Admin trigger - more discreet */}
            <button 
              onClick={onAdminClick}
              className="p-3 transition-colors text-white/30 hover:text-white"
              title={t.nav.admin}
            >
              <Users size={16} />
            </button>
          </div>
        </div>

        {/* MOBILE TRIGGER */}
        <button 
          className="lg:hidden w-12 h-12 flex items-center justify-center rounded-xl border bg-white/5 border-white/10 text-white transition-all duration-500"  
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            className="lg:hidden absolute top-full left-0 right-0 border-t border-white/10 p-8 shadow-2xl h-screen overflow-y-auto bg-navy/97 backdrop-blur-2xl" 
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                link.href ? (
                  <a 
                    key={link.name} 
                    href={link.href} 
                    onClick={() => setIsOpen(false)} 
                    className="text-2xl font-black hover:text-orange transition-colors uppercase tracking-tighter italic text-white" 
                  >
                    {link.name}
                  </a>
                ) : (
                  <button 
                    key={link.name} 
                    onClick={() => { setIsOpen(false); link.onClick?.(); }} 
                    className={`text-2xl font-black uppercase tracking-tighter text-left transition-colors italic ${link.important ? 'text-orange' : 'text-white'}`}
                  >
                    {link.name}
                  </button>
                )
              ))}
              
              <div className="h-px my-4 bg-white/10" />
              
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {['FR', 'AR', 'EN'].map((l) => (
                    <button 
                      key={l} 
                      onClick={() => setLang(l as 'FR'|'AR'|'EN')} 
                      className={`px-4 py-2 rounded-lg font-black text-sm transition-all ${
                        lang === l ? 'bg-orange text-white' : (scrolled ? 'bg-white/5 text-white/40' : 'bg-navy/5 text-navy/40')
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => { setIsOpen(false); onContactClick(); }} 
                  className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all bg-orange text-white shadow-xl hover:bg-orange/80" 
                >
                  {t.nav.contact}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const SectionHeading = ({ title, subtitle, centered = false }: { title: string; subtitle?: string; centered?: boolean }) => (
  <div className={`mb-12 ${centered ? 'text-center' : ''}`}>
    <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
      {title}
    </motion.h2>
    {subtitle && (
      <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-white/60 max-w-2xl mx-auto">
        {subtitle}
      </motion.p>
    )}
    <div className={`w-20 h-1.5 bg-orange mt-6 rounded-full ${centered ? 'mx-auto' : ''}`} />
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 glass backdrop-blur-md opacity-95" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl shadow-2xl relative z-10 w-full max-w-xl overflow-hidden border border-white/20">
        <div className="bg-white/5 border-b border-white/10 p-6 text-white flex items-center justify-between">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto text-gray-800">{children}</div>
      </motion.div>
    </div>
  );
};

// ==================== COMPOSANT PRINCIPAL ====================
export default function App() {
  const { lang, setLang, t, dir } = useTranslation();
  const { company } = useCompanyInfo(db);
  const [filter, setFilter] = useState('all');
  const [candidateTab, setCandidateTab] = useState<'apply' | 'recruiter'>('apply');
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Recruiter registration state ──
  const [regCompany, setRegCompany] = useState('');
  const [regContact, setRegContact] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regSector, setRegSector] = useState('btp');
  const [regRc, setRegRc] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Documents requis configurés par l'admin ──
  const DEFAULT_DOCS = [
    { key: 'cv',         label_fr: 'CV (Obligatoire)',       label_en: 'CV (Required)',    emoji: '📄', required: true,  enabled: true  },
    { key: 'diplome',    label_fr: 'Diplôme',                label_en: 'Diploma',          emoji: '🎓', required: false, enabled: false },
    { key: 'certificat', label_fr: 'Certificat',             label_en: 'Certificate',      emoji: '📋', required: false, enabled: false },
    { key: 'cni',        label_fr: "Carte d'identité",       label_en: 'ID Card',          emoji: '🪪', required: false, enabled: false },
    { key: 'photo',      label_fr: 'Photo professionnelle',  label_en: 'Professional Photo',emoji: '🖼️', required: false, enabled: false },
  ];
  const [requiredDocs, setRequiredDocs] = useState(DEFAULT_DOCS);
  const [modalFiles, setModalFiles] = useState<Record<string, File | null>>({});
  // ── URL-aware navigation ─────────────────────────────────────
  const getViewFromUrl = (): 'site' | 'admin' | 'recruiter' | 'candidate' => {
    if (typeof window === 'undefined') return 'site';
    const hash = window.location.hash;
    const path = window.location.pathname;
    if (hash.includes('admin') || path.includes('admin')) return 'admin';
    if (hash.includes('recruiter') || path.includes('recruiter') || hash.includes('recruteur')) return 'recruiter';
    if (hash.includes('candidate') || path.includes('candidate') || hash.includes('candidat')) return 'candidate';
    return 'site';
  };

  const [currentView, setCurrentViewState] = useState<'site' | 'admin' | 'recruiter' | 'candidate'>(getViewFromUrl);
  // Firebase auth state — null=loading, false=unauthenticated, object=authenticated
  const [appAuthUser, setAppAuthUser] = useState<any>('loading');
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && currentView === 'candidate') {
        // Vérifier que le compte a des données Firestore valides
        try {
          const { getDocs, query: q2, collection: col2, where: wh } = await import('firebase/firestore');
          const snap = await getDocs(q2(col2(db, 'users'), wh('firebaseUid', '==', u.uid)));
          if (snap.empty) {
            // Compte Firebase sans doc Firestore → déconnecter
            const { signOut: so } = await import('firebase/auth');
            await so(auth);
            setAppAuthUser(false);
            return;
          }
          const data = snap.docs[0].data();
          const hasValidData = !!(data.fullName && (data.phone || data.email));
          if (!hasValidData || (data.role && data.role !== 'candidate')) {
            const { signOut: so } = await import('firebase/auth');
            await so(auth);
            setAppAuthUser(false);
            return;
          }
        } catch (_) {}
      }
      setAppAuthUser(u ?? false);
    });
    return () => unsub();
  }, [currentView]);


  const VIEW_PATHS: Record<string, string> = {
    site: '/',
    admin: '/admin',
    recruiter: '/recruiter',
    candidate: '/candidate',
  };

  const setCurrentView = (view: 'site' | 'admin' | 'recruiter' | 'candidate') => {
    setCurrentViewState(view);
    // Push new entry so back button works correctly
    window.history.pushState({ view }, '', VIEW_PATHS[view] || '/');
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    // Replace initial history entry with proper state
    // This ensures the FIRST back press goes to 'site' not out of the app
    const initialView = getViewFromUrl();
    window.history.replaceState({ view: initialView }, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      // e.state is set by our pushState calls
      const view = (e.state?.view as 'site' | 'admin' | 'recruiter' | 'candidate') || getViewFromUrl();
      setCurrentViewState(view);
      // Scroll to top on navigation
      window.scrollTo(0, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [search, setSearch] = useState('');
  const [jobView, setJobView] = useState<'grid' | 'list'>('grid');
  const [jobDetailOpen, setJobDetailOpen] = useState(false);
  const [jobDetail, setJobDetail] = useState<any>(null);

  // ── Charger la config des documents requis ──
  useEffect(() => {
    import('firebase/firestore').then(({ getDoc, doc: fsDoc }) => {
      getDoc(fsDoc(db, 'settings_company', 'required_docs')).then(snap => {
        if (snap.exists()) {
          const saved = snap.data().docs;
          if (Array.isArray(saved)) {
            setRequiredDocs(prev => prev.map(d => {
              const found = saved.find((s: any) => s.key === d.key);
              return found ? { ...d, required: found.required, enabled: found.enabled } : d;
            }));
          }
        }
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    // Offres publiques : seulement status='active', temps réel via onSnapshot
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((j: any) => j.status === 'active' || !j.status);
      setJobs(jobsData);
      setLoadingJobs(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
      setLoadingJobs(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.sector === filter);
  const searchedJobs = search.trim()
    ? filteredJobs.filter(j =>
        (j.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (j.company || '').toLowerCase().includes(search.toLowerCase()) ||
        (j.location || '').toLowerCase().includes(search.toLowerCase()) ||
        (j.tags || []).join(' ').toLowerCase().includes(search.toLowerCase())
      )
    : filteredJobs;

  const handleApply = (job?: any) => {
    // Forcer connexion : rediriger vers l'espace candidat
    setActiveJob(job || null);
    setCurrentView('candidate');
  };

  // ── Upload file to Firebase Storage ────────────────────────
  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    try {
      const storage = getStorage();
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return url;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const submitToFirestore = async (collectionName: string, data: any) => {
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, collectionName), {
        status: 'new',
        ...data,
        userId: user ? user.uid : null,
        userEmail: user ? user.email : null,
        createdAt: serverTimestamp()
      });
      setFormSubmitted(true);
      setTimeout(() => {
        setFormSubmitted(false);
        setIsJobModalOpen(false);
        setIsCompanyModalOpen(false);
      }, 2500);
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.WRITE, collectionName);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCandidateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setUploadProgress(0);

    try {
      const user = auth.currentUser;
      const formData = new FormData(e.currentTarget);
      const timestamp = Date.now();
      const uid = user?.uid || 'anonymous';

      // ── Upload files to Firebase Storage ──────────────────
      let cvUrl: string | null = null;
      let diplomaUrl: string | null = null;
      let certUrl: string | null = null;

      setUploadProgress(10);
      if (cvFile) {
        cvUrl = await uploadFile(cvFile, `applications/${uid}/${timestamp}_cv_${cvFile.name}`);
      }
      setUploadProgress(40);
      if (diplomaFile) {
        diplomaUrl = await uploadFile(diplomaFile, `applications/${uid}/${timestamp}_diploma_${diplomaFile.name}`);
      }
      setUploadProgress(70);
      if (certFile) {
        certUrl = await uploadFile(certFile, `applications/${uid}/${timestamp}_cert_${certFile.name}`);
      }
      setUploadProgress(90);

      // ── Save application to Firestore ──────────────────────
      const appData = {
        fullName: formData.get('fullName') as string,
        phone: formData.get('phone') as string,
        whatsapp: formData.get('whatsapp') as string,
        nationality: formData.get('nationality') as string,
        education: formData.get('education') as string,
        experience: formData.get('experience') as string,
        availability: formData.get('availability') as string,
        email: formData.get('email') as string,
        sector: activeJob?.sector || formData.get('sector') as string || '',
        message: formData.get('message') as string,
        jobTitle: activeJob?.title || 'Candidature Spontanée',
        jobId: activeJob?.id || 'spontaneous',
        companyName: activeJob?.companyName || '',
        cvUrl,
        diplomaUrl,
        certUrl,
        status: 'new',
        userId: uid !== 'anonymous' ? uid : null,
        userEmail: user?.email || formData.get('email') as string,
        createdAt: serverTimestamp(),
        source: 'public_form',
      };

      const appRef = await addDoc(collection(db, 'applications'), appData);
      setUploadProgress(100);

      // ── Link to candidateProfiles if user is logged in ─────
      if (user?.uid) {
        try {
          const { doc: d2, setDoc: sd, getDoc: gd } = await import('firebase/firestore');
          const profileRef = d2(db, 'candidateProfiles', user.uid);
          const profileSnap = await gd(profileRef);
          const existing = profileSnap.exists() ? (profileSnap.data().applications || []) : [];
          await sd(profileRef, {
            applications: [...existing, appRef.id],
            lastApplication: serverTimestamp(),
            // Update profile fields if empty
            fullName: profileSnap.data()?.fullName || appData.fullName,
            phone: profileSnap.data()?.phone || appData.phone,
            email: profileSnap.data()?.email || appData.email,
          }, { merge: true });
        } catch (profileErr) {
          console.warn('Profile link failed:', profileErr);
        }
      }

      // ── Create admin notification ──────────────────────────
      try {
        await addDoc(collection(db, 'notifications'), {
          type: 'new_application',
          title: 'Nouvelle candidature',
          message: `${appData.fullName} a postulé pour "${appData.jobTitle}"`,
          applicationId: appRef.id,
          jobId: appData.jobId,
          candidateName: appData.fullName,
          candidateEmail: appData.email,
          read: false,
          userId: 'admin',
          createdAt: serverTimestamp(),
        });
      } catch (notifErr) {
        console.warn('Notification failed:', notifErr);
      }

      // ── Reset files + show success ─────────────────────────
      setCvFile(null);
      setDiplomaFile(null);
      setCertFile(null);
      setFormSubmitted(true);
      setTimeout(() => {
        setFormSubmitted(false);
        setIsJobModalOpen(false);
      }, 3000);

    } catch (error) {
      console.error('Application submit error:', error);
      handleFirestoreError(error, OperationType.WRITE, 'applications');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleRecruiterRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegError('');
    if (regPassword !== regConfirm) {
      setRegError(lang === 'FR' ? 'Les mots de passe ne correspondent pas.' : lang === 'EN' ? 'Passwords do not match.' : 'كلمات المرور غير متطابقة.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError(lang === 'FR' ? 'Mot de passe trop court (6 caractères min).' : lang === 'EN' ? 'Password too short (min 6 chars).' : 'كلمة المرور قصيرة جداً.');
      return;
    }
    setRegLoading(true);
    try {
      // Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      await updateProfile(cred.user, { displayName: regContact });

      // Save recruiter profile in Firestore
      await setDoc(doc(db, 'recruiters', cred.user.uid), {
        uid: cred.user.uid,
        email: regEmail,
        companyName: regCompany,
        contactName: regContact,
        phone: regPhone,
        sector: regSector,
        rcNumber: regRc || '',
        role: 'recruiter',
        status: 'pending',
        loginMethod: 'email',
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: regEmail,
        displayName: regContact,
        companyName: regCompany,
        phone: regPhone,
        sector: regSector,
        role: 'recruiter',
        status: 'pending',
        loginMethod: 'email',
        createdAt: serverTimestamp(),
      });

      setRegSuccess(true);
      // Redirect to recruiter panel after 2s
      setTimeout(() => setCurrentView('recruiter'), 2000);
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') {
        setRegError(lang === 'FR' ? 'Cet email est déjà utilisé.' : lang === 'EN' ? 'Email already in use.' : 'البريد الإلكتروني مستخدم بالفعل.');
      } else if (code === 'auth/invalid-email') {
        setRegError(lang === 'FR' ? 'Email invalide.' : lang === 'EN' ? 'Invalid email.' : 'بريد إلكتروني غير صالح.');
      } else {
        setRegError(err.message || 'Erreur inscription');
      }
    } finally {
      setRegLoading(false);
    }
  };

  const handleCompanyNeedSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      companyName: formData.get('company'),
      contactName: formData.get('contactName'),
      phone: formData.get('phone'),
      jobTitle: formData.get('jobTitle'),
      profileCount: formData.get('profileCount'),
      contractType: formData.get('needType'),
      deadline: formData.get('deadline'),
      expRequired: formData.get('expRequired'),
      description: formData.get('description'),
    };
    submitToFirestore('needs', data);
  };

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get('fullName'),
      contact: formData.get('contact'),
      subject: formData.get('subject'),
      message: formData.get('message'),
      needType: 'contact'
    };
    submitToFirestore('needs', data);
  };



  if (currentView === 'admin') {
    return <AdminPanel onBack={() => setCurrentView('site')} />;
  }

  if (currentView === 'recruiter') {
    return <RecruiterPanel onBack={() => setCurrentView('site')} />;
  }

  if (currentView === 'candidate') {
    // Wait for Firebase to restore auth state
    if (appAuthUser === 'loading') {
      return (
        <div className="min-h-screen bg-[#0A192F] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-orange border-t-transparent rounded-full animate-spin" />
            <p className="text-white/40 text-xs font-black uppercase tracking-widest">Loading...</p>
          </div>
        </div>
      );
    }
    // If a non-candidate is logged in (admin/recruiter), sign them out first
    // CandidatePanel will then show the login screen
    if (appAuthUser && (appAuthUser as any)._forceSignOut) {
      // already being handled
    }
    return <CandidatePanel
      onBack={() => setCurrentView('site')}
      onSignOut={() => {
        setCurrentViewState('site');
        window.history.replaceState({ view: 'site' }, '', '/');
      }}
    />;
  }

  return (
    <>
      <style>{`
        .bg-navy { background-color: #0A192F; }
        .text-navy { color: #0A192F; }
        .bg-orange { background-color: #f97316; }
        .text-orange { color: #f97316; }
        .border-orange { border-color: #f97316; }
        [class*="bg-orange\/"] { background-color: rgba(249,115,22,var(--tw-bg-opacity,1)); }
        [class*="text-orange\/"] { color: rgba(249,115,22,var(--tw-text-opacity,1)); }
        [class*="border-orange\/"] { border-color: rgba(249,115,22,var(--tw-border-opacity,1)); }
        [class*="shadow-orange"] { --tw-shadow-color: rgba(249,115,22,0.3); }
        [class*="from-orange"] { --tw-gradient-from: #f97316; }
        [class*="bg-navy\/"] { background-color: rgba(10,25,47,var(--tw-bg-opacity,1)); }
        [class*="text-navy\/"] { color: rgba(10,25,47,var(--tw-text-opacity,1)); }
        .bg-dark-grey { background-color: #6D7278; }
        .text-dark-grey { color: #6D7278; }
        .bg-light { background-color: #f8fafc; }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .mesh-gradient { background: radial-gradient(circle at 10% 20%, rgba(10, 25, 47, 1) 0%, rgba(2, 12, 27, 1) 90%); }
        .whatsapp-pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(37, 211, 102, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); } }
      `}</style>

      <div dir={dir} className="font-sans text-white mesh-gradient min-h-screen selection:bg-orange/30 pb-24">
        <Navbar 
          onContactClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} 
          onAdminClick={() => setCurrentView('admin')} 
          onRecruiterClick={() => setCurrentView('recruiter')} 
          onCandidateClick={() => setCurrentView('candidate')}
          lang={lang} 
          setLang={setLangStorage} 
          t={t} 
        />

        {/* HERO */}
        {/* ══════════════════════════════════════════════════════
            HERO COMPACT + SEARCH — Style Job Board International
        ═══════════════════════════════════════════════════════ */}
        <section id="home" className="relative pt-24 pb-0 overflow-hidden bg-white">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50/60 to-transparent" />

          <div className="max-w-6xl mx-auto px-6 relative z-10 text-center pb-0">
            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-orange/10 text-orange px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest mb-6 border border-orange/20">
              <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
              {t.hero_section.platformLabel}
            </motion.div>

            {/* Headline */}
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-3xl sm:text-5xl md:text-6xl font-black text-navy tracking-tight mb-4 leading-tight px-2">
              {lang === 'AR'
                ? t.hero_section.headlineAR
                : <>{t.hero_section.headlineLine1} <span className="text-blue-600">{t.hero_section.headlineLine3}</span></>
              }
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="text-gray-500 text-base mb-8 max-w-xl mx-auto">
              {t.hero_section.subtitle2}
            </motion.p>

            {/* Search bar */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-8 px-2">
              <div className="flex-1 flex items-center gap-3 bg-white border-2 border-gray-200 rounded-2xl px-5 py-3.5 shadow-sm focus-within:border-orange transition-all">
                <Search size={18} className="text-gray-300 shrink-0" />
                <input
                  type="text"
                  placeholder={lang === 'FR' ? 'Rechercher un poste, une compétence...' : lang === 'EN' ? 'Search a job, skill...' : 'ابحث عن وظيفة...'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm font-bold text-navy placeholder:text-gray-300 min-w-0"
                />
              </div>
              <button
                onClick={() => document.getElementById('jobs-board')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto bg-orange text-white px-7 py-3.5 rounded-2xl font-black text-sm hover:bg-navy transition-all shadow-lg shadow-orange/25 shrink-0">
                {lang === 'FR' ? 'Rechercher' : lang === 'EN' ? 'Search' : 'بحث'}
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="flex justify-center gap-8 mb-10 flex-wrap">
              {[
                { n: jobs.length || '0', label: lang === 'FR' ? 'Offres actives' : lang === 'EN' ? 'Active jobs' : 'وظائف نشطة' },
                { n: '+15K', label: lang === 'FR' ? 'Candidats' : lang === 'EN' ? 'Candidates' : 'مرشح' },
                { n: '+500', label: lang === 'FR' ? 'Entreprises' : lang === 'EN' ? 'Companies' : 'شركة' },
              ].map(({ n, label }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-black text-navy">{n}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            JOB BOARD — Catégories + Offres en temps réel
        ═══════════════════════════════════════════════════════ */}
        <section id="jobs-board" className="py-10 bg-white">
          <div className="max-w-6xl mx-auto px-6">

            {/* Catégories cliquables */}
            <div className="flex gap-3 flex-wrap mb-8 pb-6 border-b border-gray-100">
              <button
                onClick={() => setFilter('all')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wide transition-all border-2 ${filter === 'all' ? 'bg-navy text-white border-navy shadow-lg' : 'bg-white text-gray-500 border-gray-100 hover:border-navy/20'}`}>
                🌐 {lang === 'FR' ? 'Tous les secteurs' : lang === 'EN' ? 'All sectors' : 'جميع القطاعات'}
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${filter === 'all' ? 'bg-white/20' : 'bg-gray-100'}`}>{jobs.length}</span>
              </button>
              {SECTORS.map(s => {
                const Icon = s.icon;
                const count = jobs.filter(j => j.sector === s.id).length;
                if (count === 0) return null;
                return (
                  <button key={s.id}
                    onClick={() => setFilter(s.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wide transition-all border-2 ${filter === s.id ? 'bg-navy text-white border-navy shadow-lg' : 'bg-white text-gray-500 border-gray-100 hover:border-navy/20'}`}>
                    <Icon size={14} />
                    {t.sectors[s.key]}
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${filter === s.id ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Résultats */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-bold text-gray-400">
                <span className="text-navy font-black">{searchedJobs.length}</span>
                {lang === 'FR' ? ` offre${searchedJobs.length > 1 ? 's' : ''} trouvée${searchedJobs.length > 1 ? 's' : ''}` : lang === 'EN' ? ` job${searchedJobs.length > 1 ? 's' : ''} found` : ' وظيفة'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setJobView('grid')}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${jobView === 'grid' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                  <Grid size={15} />
                </button>
                <button onClick={() => setJobView('list')}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${jobView === 'list' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                  <List size={15} />
                </button>
              </div>
            </div>

            {/* Grid / List */}
            {loadingJobs ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange" size={48} /></div>
            ) : searchedJobs.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Briefcase size={28} className="text-gray-200" />
                </div>
                <p className="font-black text-gray-300 uppercase tracking-widest text-sm">
                  {lang === 'FR' ? 'Aucune offre trouvée' : lang === 'EN' ? 'No jobs found' : 'لا توجد وظائف'}
                </p>
              </div>
            ) : jobView === 'grid' ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence mode="popLayout">
                  {searchedJobs.map((job, i) => {
                    const sector = SECTORS.find(s => s.id === job.sector);
                    const SectorIcon = sector?.icon || Briefcase;
                    const isUrgent = job.tags?.includes('Urgent') || job.urgent;
                    const dateStr = job.createdAt?.toDate ? new Date(job.createdAt.toDate()).toLocaleDateString('fr-FR') : '';
                    return (
                      <motion.div key={job.id} layout
                        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}
                        className="group rounded-2xl border-2 border-[#0A192F]/10 hover:border-orange/60 hover:shadow-2xl hover:shadow-orange/10 transition-all duration-300 flex flex-col cursor-pointer overflow-hidden"
                        style={{ background: 'linear-gradient(145deg, #0d2340 0%, #0A192F 100%)' }}
                        onClick={() => { setJobDetail(job); setJobDetailOpen(true); }}
                      >
                        {/* Top accent bar */}
                        <div className="h-1 w-full bg-gradient-to-r from-orange via-orange/80 to-transparent" />

                        <div className="p-6 flex flex-col flex-1">
                          {/* Header row */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all shrink-0 border border-white/10">
                              <SectorIcon size={22} />
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              {isUrgent && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  {t.offers.urgent}
                                </span>
                              )}
                              {dateStr && <span className="text-[9px] font-bold text-white/30">{dateStr}</span>}
                            </div>
                          </div>

                          {/* Title + company */}
                          <h3 className="text-base font-black text-white mb-1 leading-snug group-hover:text-orange transition-colors line-clamp-2">
                            {job.title}
                          </h3>
                          <p className="text-[11px] font-bold text-white/50 mb-4 flex items-center gap-1.5">
                            <Building2 size={11} className="text-orange/60" />
                            {job.company || 'Vedior GM'}
                          </p>

                          {/* Info pills */}
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5">
                              <MapPin size={10} className="text-orange shrink-0" />
                              <span className="text-[10px] font-bold text-white/70 truncate">{job.location || 'Djibouti'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/20 rounded-lg px-2.5 py-1.5">
                              <FileText size={10} className="text-blue-300 shrink-0" />
                              <span className="text-[10px] font-bold text-blue-200 truncate">{job.type || 'CDI'}</span>
                            </div>
                            {job.salary && (
                              <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-400/20 rounded-lg px-2.5 py-1.5">
                                <Banknote size={10} className="text-green-300 shrink-0" />
                                <span className="text-[10px] font-bold text-green-200 truncate">{job.salary}</span>
                              </div>
                            )}
                            {job.experience && (
                              <div className="flex items-center gap-1.5 bg-purple-500/20 border border-purple-400/20 rounded-lg px-2.5 py-1.5">
                                <GraduationCap size={10} className="text-purple-300 shrink-0" />
                                <span className="text-[10px] font-bold text-purple-200 truncate">{job.experience}</span>
                              </div>
                            )}
                          </div>

                          {/* Description preview */}
                          {job.description && (
                            <p className="text-[11px] text-white/40 leading-relaxed mb-4 line-clamp-2 flex-1">
                              {job.description}
                            </p>
                          )}

                          {/* Footer */}
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                              {t.sectors[sector?.key || 'admin']}
                            </span>
                            <button className="flex items-center gap-1.5 text-[10px] font-black text-orange/80 group-hover:text-orange transition-colors uppercase tracking-wide">
                              Voir l'offre <ChevronRight size={12} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              /* LIST VIEW */
              <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {searchedJobs.map((job, i) => {
                    const sector = SECTORS.find(s => s.id === job.sector);
                    const SectorIcon = sector?.icon || Briefcase;
                    const isUrgent = job.tags?.includes('Urgent') || job.urgent;
                    return (
                      <motion.div key={job.id} layout
                        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                        className="group rounded-xl px-5 py-4 border border-white/10 hover:border-orange/50 hover:shadow-xl hover:shadow-orange/10 transition-all flex items-center gap-4 cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #0d2340 0%, #0A192F 100%)' }}
                        onClick={() => { setJobDetail(job); setJobDetailOpen(true); }}
                      >
                        {/* Icon */}
                        <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all shrink-0">
                          <SectorIcon size={19} />
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-black text-white text-sm group-hover:text-orange transition-colors truncate">{job.title}</h3>
                            {isUrgent && <span className="shrink-0 px-2 py-0.5 bg-red-500 text-white rounded-full text-[8px] font-black uppercase shadow-sm">Urgent</span>}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[10px] text-white/40 font-bold flex items-center gap-1">
                              <Building2 size={9} className="text-white/30" /> {job.company || 'Vedior GM'}
                            </span>
                            <span className="text-[10px] text-white/40 font-bold flex items-center gap-1">
                              <MapPin size={9} className="text-orange/70" /> {job.location}
                            </span>
                            {job.salary && <span className="text-[10px] text-green-300 font-black flex items-center gap-1"><Banknote size={9} />{job.salary}</span>}
                          </div>
                        </div>

                        {/* Right side chips */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-[9px] font-black border border-blue-400/20 hidden sm:block">{job.type}</span>
                          <span className="text-[9px] text-white/20 font-bold hidden lg:block">
                            {job.createdAt?.toDate ? new Date(job.createdAt.toDate()).toLocaleDateString('fr-FR') : ''}
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 group-hover:bg-orange group-hover:text-white group-hover:border-orange transition-all">
                            <ChevronRight size={14} />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* CV Banner inline */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              className="mt-12 rounded-[2.5rem] bg-navy p-10 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-orange/20 to-transparent" />
              <div className="relative z-10">
                <h3 className="text-2xl font-black text-white mb-2">
                  {t.cv_banner.title1} <span className="text-orange">{t.cv_banner.title2}</span>
                </h3>
                <p className="text-white/60 text-sm mb-6 max-w-md mx-auto">{t.cv_banner.desc}</p>
                <button onClick={() => handleApply()}
                  className="bg-orange text-white px-8 py-3.5 rounded-xl font-black text-sm hover:bg-white hover:text-navy transition-all shadow-lg">
                  📎 {lang === 'FR' ? 'Déposer mon CV' : lang === 'EN' ? 'Submit my CV' : 'إرسال سيرتي'}
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="services" className="py-40 overflow-hidden relative bg-[#F1F5F9]">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40">
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-orange/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-navy/5 rounded-full blur-[120px]" />
          </div>

          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid lg:grid-cols-[1fr_2fr] gap-24 items-center mb-24">
              <div>
                <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}>
                  <span className="text-orange font-black uppercase tracking-[0.4em] text-[10px] block mb-6 italic">
                    {t.hero_section.ourExpertise}
                  </span>
                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-navy leading-[1.05] mb-8 tracking-tighter uppercase italic">
                    {t.services.title}
                  </h2>
                  <p className="text-lg text-navy/50 font-bold italic border-l-4 border-orange pl-8 mb-10">
                    {t.services.subtitle}
                  </p>
                  <a href="#contact" className="inline-flex items-center gap-4 bg-navy text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange transition-all shadow-xl shadow-navy/20 active:scale-95">
                    {t.hero_section.consultExpert} <ArrowRight size={18} />
                  </a>
                </motion.div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {[
                  { title: t.services.recrutement.title, desc: t.services.recrutement.desc, features: t.services.recrutement.features, icon: Users, color: 'orange' },
                  { title: t.services.rpo.title, desc: t.services.rpo.desc, features: t.services.rpo.features, icon: Search, color: 'navy' },
                  { title: t.services.rh.title, desc: t.services.rh.desc, features: t.services.rh.features, icon: Building2, color: 'orange' },
                  { 
                    title: t.services.digital.title, 
                    desc: t.services.digital.desc, 
                    features: t.services.digital.features, 
                    icon: Ship, 
                    color: 'navy' 
                  },
                ].map((svc, i) => (
                  <motion.div 
                    key={svc.title} 
                    initial={{ opacity: 0, y: 30 }} 
                    whileInView={{ opacity: 1, y: 0 }} 
                    transition={{ delay: i * 0.1 }}
                    className="group bg-[#FBFBFE] p-10 rounded-[3rem] shadow-[0_15px_50px_rgba(0,0,0,0.03)] border border-gray-50 hover:border-orange/20 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2"
                  >
                    <div className={`w-16 h-16 ${svc.color === 'orange' ? 'bg-orange text-white' : 'bg-navy text-white'} rounded-2xl flex items-center justify-center mb-8 shadow-lg group-hover:rotate-6 transition-transform`}>
                      <svc.icon size={28} />
                    </div>
                    <h3 className="text-xl font-black text-navy mb-4 uppercase tracking-tighter italic">{svc.title}</h3>
                    <p className="text-xs text-navy/40 mb-8 font-black uppercase tracking-widest leading-relaxed">{svc.desc}</p>
                    
                    <ul className="space-y-4 pt-6 border-t border-navy/5">
                      {svc.features.map(f => (
                        <li key={f} className="flex items-center gap-3 text-[10px] text-navy/60 font-black uppercase italic">
                          <div className="w-1.5 h-1.5 bg-orange rounded-full" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* RECRUITMENT EXPERTISE - DETAILED */}
        <section className="py-40 bg-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-orange/10 rounded-[3rem] blur-2xl -rotate-2" />
                <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden shadow-2xl">
                  <img 
                    src="/expert.png" 
                    alt="Recruitment Expert" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/60 to-transparent" />
                  <div className="absolute bottom-10 left-10 right-10 p-8 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <p className="text-white text-xl font-black italic tracking-tighter uppercase mb-2">Vedior GM Hub</p>
                    <p className="text-orange text-[10px] font-black uppercase tracking-[0.3em]">{t.hero_section.excellenceLabel}</p>
                  </div>
                </div>
              </motion.div>

              <div>
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <span className="text-orange font-black uppercase tracking-[0.4em] text-[10px] block mb-6 italic">
                    {t.expertise.subtitle}
                  </span>
                  <h2 className="text-2xl sm:text-5xl md:text-4xl sm:text-7xl font-black text-navy leading-[0.95] mb-12 tracking-tighter uppercase italic">
                    {t.expertise.title}
                  </h2>

                  <div className="space-y-10">
                    {t.expertise.items.map((item: any, i: number) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex gap-6 group"
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-navy/5 rounded-2xl flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all duration-500">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-navy uppercase tracking-widest mb-2 italic group-hover:text-orange transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-xs text-navy/40 font-bold leading-relaxed uppercase tracking-wider">
                            {item.desc}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE VALUES BAR */}
        <div className="bg-navy py-12 border-y border-white/5">
          <div className="max-w-7xl mx-auto px-8 grid md:grid-cols-3 gap-12">
            <div className="flex items-center gap-6 group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h5 className="text-white text-xs font-black uppercase tracking-widest mb-1 italic">{t.values_bar.title1}</h5>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider leading-relaxed">{t.values_bar.desc1}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all">
                <MapPin size={24} />
              </div>
              <div>
                <h5 className="text-white text-xs font-black uppercase tracking-widest mb-1 italic">{t.values_bar.title2}</h5>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider leading-relaxed">{t.values_bar.desc2}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all">
                <Phone size={24} />
              </div>
              <div>
                <h5 className="text-white text-xs font-black uppercase tracking-widest mb-1 italic">{t.values_bar.title3}</h5>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider leading-relaxed">{t.values_bar.desc3}</p>
              </div>
            </div>
          </div>
        </div>

        {/* OFFRES D'EMPLOI */}
        <section id="candidate" className="py-32 relative overflow-hidden bg-navy">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-orange rounded-full blur-[120px] -mr-1/4 -mt-1/4" />
             <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-[#FBFBFE] rounded-full blur-[120px] -ml-1/4 -mb-1/4" />
          </div>
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <div className="flex flex-col justify-center">
                <span className="text-orange font-black uppercase tracking-[0.3em] text-[11px] block mb-6 italic opacity-80">{t.candidateSpace.badge}</span>
                <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mb-12 leading-[1.05] tracking-tighter uppercase">{t.candidateSpace.title}</h2>
                <div className="grid sm:grid-cols-2 gap-8">
                  <div className="bg-white/5 border border-white/10 p-8 rounded-3xl group hover:bg-[#FBFBFE] transition-all duration-500">
                    <div className="w-14 h-14 bg-orange/10 rounded-2xl flex items-center justify-center text-orange mb-6 group-hover:bg-orange group-hover:text-white transition-all duration-500">
                      <Upload size={28} />
                    </div>
                    <h4 className="text-white group-hover:text-navy text-sm font-black mb-3 uppercase tracking-widest transition-colors">{t.candidateSpace.card1}</h4>
                    <p className="text-white/40 group-hover:text-navy/50 text-[11px] leading-relaxed font-bold transition-colors">{t.candidateSpace.card1Desc}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-8 rounded-3xl group hover:bg-[#FBFBFE] transition-all duration-500">
                    <div className="w-14 h-14 bg-orange/10 rounded-2xl flex items-center justify-center text-orange mb-6 group-hover:bg-orange group-hover:text-white transition-all duration-500">
                      <MessageCircle size={28} />
                    </div>
                    <h4 className="text-white group-hover:text-navy text-sm font-black mb-3 uppercase tracking-widest transition-colors">{t.candidateSpace.card2}</h4>
                    <p className="text-white/40 group-hover:text-navy/50 text-[11px] leading-relaxed font-bold transition-colors">{t.candidateSpace.card2Desc}</p>
                  </div>
                </div>
                
                <motion.button 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  onClick={() => setCurrentView('candidate')}
                  className="mt-12 group flex items-center gap-6 bg-white px-10 py-6 rounded-3xl shadow-2xl hover:scale-105 transition-all active:scale-95"
                >
                  <div className="w-14 h-14 bg-navy text-white rounded-2xl flex items-center justify-center group-hover:bg-orange transition-colors">
                    <User size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange mb-1 italic">{t.hero_section.accsPro}</p>
                    <p className="text-xl font-black text-navy uppercase italic tracking-tighter">{t.hero_section.monEspaceCandidat}</p>
                  </div>
                  <ArrowRight className="text-navy group-hover:text-orange transition-colors ml-4" />
                </motion.button>
              </div>

              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} className="bg-[#FBFBFE] rounded-[3rem] p-10 shadow-2xl relative">
                <div className="flex gap-8 mb-10 border-b border-navy/5">
                  <button onClick={() => setCandidateTab('apply')} className={`text-[10px] font-black uppercase tracking-widest transition-all border-b-2 pb-4 ${candidateTab === 'apply' ? 'text-orange border-orange' : 'text-navy/30 border-transparent hover:text-navy'}`}>{t.candidateSpace.tabApply}</button>
                  <button onClick={() => setCandidateTab('recruiter')} className={`text-[10px] font-black uppercase tracking-widest transition-all border-b-2 pb-4 ${candidateTab === 'recruiter' ? 'text-orange border-orange' : 'text-navy/30 border-transparent hover:text-navy'}`}>{t.candidateSpace.tabRecruit}</button>
                </div>
                {candidateTab === 'apply' ? (
                  <form onSubmit={handleCandidateSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formName}</label>
                        <input type="text" name="fullName" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formPhone}</label>
                        <input type="tel" name="phone" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formWhatsapp}</label>
                        <input type="tel" name="whatsapp" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formNationality}</label>
                        <input type="text" name="nationality" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formEducation}</label>
                        <input type="text" name="education" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formExperience}</label>
                        <input type="number" name="experience" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formAvailability}</label>
                        <input type="text" name="availability" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formSector}</label>
                        <select name="sector" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-black text-navy uppercase italic appearance-none cursor-pointer">{SECTORS.map(s => <option key={s.id} value={s.id} className="bg-[#FBFBFE] text-navy uppercase font-black">{t.sectors[s.key]}</option>)}</select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="group relative border-2 border-dashed border-navy/10 rounded-2xl p-6 text-center hover:border-orange/50 transition-all bg-navy/5">
                        <input type="file" name="cv" required accept=".pdf,.doc,.docx" className="absolute inset-0 opacity-0 cursor-pointer" />
                        <Upload size={18} className="mx-auto mb-2 text-navy/20 group-hover:text-orange" />
                        <p className="text-[8px] font-black uppercase text-navy tracking-widest">{t.candidateSpace.uploadCv}</p>
                      </div>
                      <div className="group relative border-2 border-dashed border-navy/10 rounded-2xl p-6 text-center hover:border-orange/50 transition-all bg-navy/5">
                        <input type="file" name="diploma" accept=".pdf,.doc,.docx" className="absolute inset-0 opacity-0 cursor-pointer" />
                        <Upload size={18} className="mx-auto mb-2 text-navy/20 group-hover:text-orange" />
                        <p className="text-[8px] font-black uppercase text-navy tracking-widest">{t.candidateSpace.uploadDiploma}</p>
                      </div>
                      <div className="group relative border-2 border-dashed border-navy/10 rounded-2xl p-6 text-center hover:border-orange/50 transition-all bg-navy/5">
                        <input type="file" name="cert" accept=".pdf,.doc,.docx" className="absolute inset-0 opacity-0 cursor-pointer" />
                        <Upload size={18} className="mx-auto mb-2 text-navy/20 group-hover:text-orange" />
                        <p className="text-[8px] font-black uppercase text-navy tracking-widest">{t.candidateSpace.uploadCert}</p>
                      </div>
                    </div>

                    <button type="submit" disabled={submitting} className="w-full bg-orange py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-orange/30 hover:bg-navy transition-all duration-300 text-[10px] text-white disabled:opacity-50">
                      {submitting ? t.common.sending : t.candidateSpace.submitCv}
                    </button>
                  </form>
                ) : (
                  <>{regSuccess ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-10 space-y-4">
                      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={32} className="text-green-500" />
                      </div>
                      <h3 className="text-xl font-black text-navy">
                        {lang === 'FR' ? 'Compte créé !' : lang === 'EN' ? 'Account created!' : 'تم إنشاء الحساب!'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {lang === 'FR' ? 'Redirection vers votre espace...' : lang === 'EN' ? 'Redirecting to your space...' : 'جاري التحويل...'}
                      </p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleRecruiterRegister} className="space-y-5">
                      {/* Société + RC */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">
                            {t.candidateSpace.recruiterForm.company} *
                          </label>
                          <input type="text" required value={regCompany} onChange={e => setRegCompany(e.target.value)}
                            placeholder="ex: CLE Djibouti"
                            className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-orange focus:bg-white transition-all font-bold text-navy placeholder:text-navy/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">
                            RC (optionnel)
                          </label>
                          <input type="text" value={regRc} onChange={e => setRegRc(e.target.value)}
                            placeholder="N° registre commerce"
                            className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-orange focus:bg-white transition-all font-bold text-navy placeholder:text-navy/20" />
                        </div>
                      </div>

                      {/* Nom contact */}
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">
                          {t.candidateSpace.recruiterForm.contactName} *
                        </label>
                        <input type="text" required value={regContact} onChange={e => setRegContact(e.target.value)}
                          placeholder="Nom du DRH / Responsable"
                          className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-orange focus:bg-white transition-all font-bold text-navy placeholder:text-navy/20" />
                      </div>

                      {/* Téléphone + Secteur */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">
                            Téléphone *
                          </label>
                          <input type="tel" required value={regPhone} onChange={e => setRegPhone(e.target.value)}
                            placeholder="+253 77 XX XX XX"
                            className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-orange focus:bg-white transition-all font-bold text-navy placeholder:text-navy/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">
                            {t.footer_ext.sectorLabel} *
                          </label>
                          <select required value={regSector} onChange={e => setRegSector(e.target.value)}
                            className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-orange focus:bg-white transition-all font-bold text-navy appearance-none">
                            {SECTORS.map(s => (
                              <option key={s.id} value={s.id}>{t.sectors[s.key]}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">
                          Email professionnel *
                        </label>
                        <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)}
                          placeholder="contact@societe.dj"
                          className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-orange focus:bg-white transition-all font-bold text-navy placeholder:text-navy/20" />
                      </div>

                      {/* Mots de passe */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">
                            Mot de passe *
                          </label>
                          <input type="password" required value={regPassword} onChange={e => setRegPassword(e.target.value)}
                            placeholder="6 caractères min."
                            className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-orange focus:bg-white transition-all font-bold text-navy placeholder:text-navy/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">
                            Confirmer *
                          </label>
                          <input type="password" required value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                            placeholder="Répéter le mot de passe"
                            className={`w-full bg-navy/5 border rounded-2xl px-5 py-4 text-sm focus:outline-none transition-all font-bold text-navy placeholder:text-navy/20 ${regConfirm && regPassword !== regConfirm ? 'border-red-300 bg-red-50' : 'border-navy/10 focus:border-orange focus:bg-white'}`} />
                        </div>
                      </div>

                      {/* Error */}
                      {regError && (
                        <div className="px-5 py-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-2">
                          <X size={14} className="shrink-0" /> {regError}
                        </div>
                      )}

                      <p className="text-[10px] text-navy/40 font-bold italic">
                        {lang === 'FR'
                          ? "Votre compte sera activé après validation par notre équipe. Vous recevrez une confirmation par email."
                          : lang === 'EN'
                          ? "Your account will be activated after validation by our team. You will receive a confirmation email."
                          : "سيتم تفعيل حسابك بعد التحقق من قبل فريقنا."}
                      </p>

                      <button type="submit" disabled={regLoading}
                        className="w-full bg-orange py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-orange/30 hover:bg-navy transition-all duration-300 text-[10px] text-white disabled:opacity-50 flex items-center justify-center gap-3">
                        {regLoading
                          ? <><Loader2 size={18} className="animate-spin" /> {lang === 'FR' ? 'Création du compte...' : 'Creating account...'}</>
                          : lang === 'FR' ? '🚀 Créer mon compte recruteur' : lang === 'EN' ? '🚀 Create my recruiter account' : '🚀 إنشاء حساب'}
                      </button>

                      <div className="text-center">
                        <button type="button" onClick={() => setCurrentView('recruiter')}
                          className="text-[11px] text-navy/50 font-bold hover:text-orange transition-colors underline">
                          {lang === 'FR' ? "J'ai déjà un compte → Se connecter" : lang === 'EN' ? 'Already have an account → Sign in' : 'لدي حساب بالفعل → تسجيل الدخول'}
                        </button>
                      </div>
                    </form>
                  )}</>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ESPACE RECRUTEUR (dashboard + steps) */}
        <section id="recruiter" className="py-32 bg-[#F1F5F9] overflow-hidden relative">
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} className="order-2 lg:order-1 bg-[#F5F8FC] p-10 md:p-16 rounded-[4rem] shadow-inner relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="absolute top-12 left-12 flex gap-2"><div className="w-3 h-3 rounded-full bg-red-400 shadow-sm" /><div className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm" /><div className="w-3 h-3 rounded-full bg-green-400 shadow-sm" /></div>
                
                <div className="mt-12 bg-[#F8FAFC] rounded-[2.5rem] p-10 shadow-2xl relative z-10">
                  <div className="flex justify-between items-center mb-10">
                    <h4 className="font-black text-navy uppercase tracking-[0.2em] text-[10px] italic">{t.recruiterSpace.dashboard.title}</h4>
                    <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-orange animate-pulse" /><div className="w-2 h-2 rounded-full bg-orange/20" /></div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    <div className="bg-navy p-6 rounded-3xl text-white text-center shadow-lg">
                      <div className="text-3xl font-black mb-1">12</div>
                      <div className="text-[7px] font-black uppercase tracking-widest opacity-50">{t.recruiterSpace.dashboard.activeOffers}</div>
                    </div>
                    <div className="bg-orange p-6 rounded-3xl text-white text-center shadow-lg">
                      <div className="text-3xl font-black mb-1">47</div>
                      <div className="text-[7px] font-black uppercase tracking-widest opacity-50">{t.recruiterSpace.dashboard.candidates}</div>
                    </div>
                    <div className="bg-[#10b981] p-6 rounded-3xl text-white text-center shadow-lg">
                      <div className="text-3xl font-black mb-1">8</div>
                      <div className="text-[7px] font-black uppercase tracking-widest opacity-50">{t.recruiterSpace.dashboard.interviews}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { name: 'Ahmed K.', pos: 'Conducteur BTP', status: t.recruiterSpace.dashboard.new, color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/5' },
                      { name: 'Layla S.', pos: 'Logistique Port', status: t.recruiterSpace.dashboard.interview, color: 'text-[#10b981]', bg: 'bg-[#10b981]/5' },
                      { name: 'Omar M.', pos: 'Réceptionniste', status: t.recruiterSpace.dashboard.retained, color: 'text-orange', bg: 'bg-orange/5' }
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between p-5 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-navy/5 flex items-center justify-center font-black text-navy text-[10px]">{row.name[0]}</div>
                          <div>
                            <div className="text-xs font-black text-navy uppercase tracking-tighter">{row.name}</div>
                            <div className="text-[9px] text-navy/30 font-black uppercase tracking-widest">{row.pos}</div>
                          </div>
                        </div>
                        <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${row.bg} ${row.color} border border-current opacity-80`}>{row.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-14 space-y-4">
                  <button onClick={() => setCurrentView('recruiter')} className="w-full bg-navy hover:bg-orange text-white px-10 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] transform transition-all duration-300 shadow-2xl shadow-navy/20 active:scale-95 text-[10px]">
                    {t.nav.recruiterPanel}
                  </button>
                  <button onClick={() => setIsCompanyModalOpen(true)} className="w-full bg-[#FBFBFE] border-2 border-navy/5 text-navy px-10 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all duration-300 hover:border-orange hover:text-orange text-[10px]">
                    {t.recruiterSpace.dashboard.submitNeed}
                  </button>
                </div>
              </motion.div>
              
              <div className="order-1 lg:order-2">
                <span className="text-orange font-black uppercase tracking-[0.3em] text-[11px] block mb-6 italic">{t.recruiterSpace.badge}</span>
                <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-navy mb-12 leading-[1.05] tracking-tighter uppercase italic">{t.recruiterSpace.title}</h2>
                <div className="space-y-12">
                  {[
                    { step: '01', title: t.recruiterSpace.steps.step1, desc: t.recruiterSpace.steps.desc1, icon: Search },
                    { step: '02', title: t.recruiterSpace.steps.step2, desc: t.recruiterSpace.steps.desc2, icon: Users },
                    { step: '03', title: t.recruiterSpace.steps.step3, desc: t.recruiterSpace.steps.desc3, icon: CheckCircle2 }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-10 group">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-navy/5 flex items-center justify-center text-navy font-black text-xl group-hover:bg-orange group-hover:text-white transition-all duration-500 shadow-sm relative">
                           {item.step}
                           <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-0.5 h-10 bg-navy/5" />
                        </div>
                      </div>
                      <div className="pt-2">
                        <h4 className="text-xl font-black text-navy mb-3 group-hover:text-orange transition-colors uppercase tracking-tight flex items-center gap-3">
                          <item.icon size={20} className="text-navy/20 group-hover:text-orange transition-colors" />
                          {item.title}
                        </h4>
                        <p className="text-sm text-navy/40 leading-relaxed font-bold max-w-sm italic">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* À PROPOS */}
        <section id="about" className="py-40 bg-[#F8FAFC] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[#F1F5F9] -z-0" />
          
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }}>
                <div className="relative">
                  <div className="bg-navy p-16 md:p-24 rounded-[4rem] text-white relative z-10 shadow-2xl">
                    <div className="absolute top-12 left-12 w-24 h-24 bg-orange/20 rounded-full blur-2xl" />
                    <div className="text-8xl font-black text-orange/20 mb-10 tracking-tighter italic select-none">
                      {t.about.year}
                    </div>
                    <h3 className="text-3xl md:text-4xl font-black mb-8 italic leading-[1.1] uppercase tracking-tighter">
                      {t.about.text.split('.')[0]}.
                    </h3>
                    <p className="text-white/50 leading-relaxed mb-12 font-bold italic border-l-2 border-orange/40 pl-8">
                      {t.about.text}
                    </p>
                    <div className="grid grid-cols-2 gap-8">
                      {t.about.values.map(val => (
                        <div key={val} className="flex items-center gap-4 group">
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all duration-300">
                            <CheckCircle2 size={20} />
                          </div>
                          <span className="font-black uppercase tracking-widest text-[10px] italic">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Decorative Elements */}
                  <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-orange rounded-[3rem] -z-10 group-hover:rotate-12 transition-transform duration-700" />
                  <div className="absolute top-24 -left-12 w-32 h-32 border-4 border-navy rounded-[2.5rem] -z-10" />
                </div>
              </motion.div>

              <div>
                <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}>
                  <span className="text-orange font-black uppercase tracking-[0.4em] text-[10px] block mb-6 italic">
                    {t.about.badge}
                  </span>
                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-navy mb-8 tracking-tighter uppercase italic leading-[1.05]">
                    {t.about.title}
                  </h2>
                  <p className="text-lg text-navy/40 font-bold italic mb-12 max-w-md">
                    {t.about.subtitle}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                    {[
                      { name: t.about.teams.dir, icon: Users },
                      { name: t.about.teams.recruit, icon: Search },
                      { name: t.about.teams.ops, icon: Clock }
                    ].map((item, i) => (
                      <div key={i} className="text-center group">
                        <div className="w-full aspect-square bg-[#F1F5F9] rounded-3xl flex items-center justify-center text-navy/20 group-hover:bg-navy group-hover:text-white transition-all duration-500 mb-4 shadow-inner">
                          <item.icon size={32} strokeWidth={1} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-navy/60 leading-tight italic">{item.name}</p>
                      </div>
                    ))}
                  </div>

                  <div className="relative p-12 bg-[#FBFBFE] rounded-[3rem] border border-gray-100 shadow-xl italic text-navy/60 leading-relaxed font-serif text-xl group overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange/5 rounded-full -mr-16 -mt-16" />
                    <span className="text-2xl sm:text-5xl text-orange font-black leading-none block mb-6 select-none leading-none opacity-20 group-hover:opacity-100 transition-opacity">"</span>
                    <p className="relative z-10 font-bold italic">{t.about.quote}</p>
                    <div className="mt-8 flex items-center gap-4 relative z-10">
                       <div className="w-10 h-[2px] bg-orange" />
                       <span className="text-navy font-black text-[10px] uppercase tracking-[0.3em] italic">{t.about.signature}</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="py-40 bg-navy relative overflow-hidden">
          {/* Animated Background Icons */}
          <div className="absolute inset-0 opacity-10 pointer-events-none grid grid-cols-6 gap-20 p-20">
             {[...Array(24)].map((_, i) => (
               <Phone key={i} size={40} className={`text-white rotate-[${i * 15}deg] opacity-${(i % 5) * 20}`} />
             ))}
          </div>
          
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="text-center mb-24">
              <span className="text-orange font-black uppercase tracking-[0.4em] text-[10px] block mb-6 italic">
                {t.contact.title}
              </span>
              <h2 className="text-4xl md:text-4xl sm:text-7xl font-black text-white mb-6 tracking-tighter uppercase italic">
                {t.contact.ready.split('?')[0]}?
              </h2>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 mt-16 max-w-6xl mx-auto items-stretch">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} className="bg-white/5 backdrop-blur-2xl p-12 md:p-16 rounded-[4rem] text-white flex flex-col justify-between border border-white/10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700" />
                
                <div>
                  <h3 className="text-3xl font-black mb-12 leading-[1.1] uppercase tracking-tighter italic">{t.contact.subtitle}</h3>
                  <div className="space-y-12">
                    {[
                      { icon: MapPin, title: t.contact.location, val: company.address },
                      { icon: Phone, title: t.contact.phone, val: company.phone },
                      { icon: Mail, title: t.contact.email, val: company.email }
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-8 group/item">
                        <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center group-hover/item:bg-orange group-hover/item:text-white transition-all duration-300 border border-white/5">
                          <item.icon size={28} />
                        </div>
                        <div className="pt-2">
                          <div className="text-[10px] font-black uppercase text-orange tracking-[0.3em] mb-2 italic opacity-60">{item.title}</div>
                          <div className="font-black text-xl italic tracking-tight">{item.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-20 pt-10 border-t border-white/10 flex gap-6">
                  {['LinkedIn', 'Facebook', 'Twitter'].map(social => (
                    <a key={social} href="#" className="w-14 h-14 rounded-2xl border border-white/10 flex items-center justify-center hover:bg-orange hover:border-orange transition-all duration-300 group/social">
                      <span className="text-[10px] font-black uppercase tracking-widest group-social:rotate-12 transition-transform">{social[0]}</span>
                    </a>
                  ))}
                </div>
              </motion.div>

              <motion.form 
                onSubmit={handleContactSubmit} 
                initial={{ opacity: 0, x: 30 }} 
                whileInView={{ opacity: 1, x: 0 }} 
                className="bg-[#FBFBFE] p-12 md:p-20 rounded-[4rem] shadow-2xl relative"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange/5 rounded-full -mr-16 -mt-16" />
                
                <div className="space-y-8 relative z-10">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-navy/30 ml-2 italic">{t.contact.formName}</label>
                      <input type="text" name="fullName" required className="w-full bg-navy/5 border border-transparent focus:border-orange/20 focus:bg-[#FBFBFE] p-6 rounded-2xl outline-none transition-all font-bold text-navy" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-navy/30 ml-2 italic">{t.contact.formContact}</label>
                      <input type="text" name="contact" required className="w-full bg-navy/5 border border-transparent focus:border-orange/20 focus:bg-[#FBFBFE] p-6 rounded-2xl outline-none transition-all font-bold text-navy" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-navy/30 ml-2 italic">{t.contact.subject}</label>
                    <select name="subject" className="w-full bg-navy/5 border border-transparent focus:border-orange/20 focus:bg-[#FBFBFE] p-6 rounded-2xl outline-none transition-all font-black text-navy uppercase italic appearance-none cursor-pointer">
                      <option>{t.contact.subjectCandidate}</option>
                      <option>{t.contact.subjectCompany}</option>
                      <option>{t.contact.subjectInfo}</option>
                    </select>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-navy/30 ml-2 italic">{t.contact.message}</label>
                    <textarea name="message" rows={4} required className="w-full bg-navy/5 border border-transparent focus:border-orange/20 focus:bg-[#FBFBFE] p-6 rounded-2xl outline-none transition-all font-bold text-navy" />
                  </div>
                  
                  <button type="submit" disabled={submitting} className="w-full bg-orange p-6 md:p-8 rounded-[2rem] text-white font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-orange/30 hover:bg-navy hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 mt-4 italic">
                    {submitting ? t.common.sending : t.contact.send}
                  </button>
                </div>
              </motion.form>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-navy pt-24 pb-12 border-t border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
              {/* Column 1: Brand */}
              <div className="space-y-8">
                <Logo inverted />
                <p className="text-white/50 text-sm leading-relaxed max-w-xs font-medium">
                  {t.footer_ext.brandDesc}
                </p>
                <div className="flex gap-4">
                  {[ExternalLink, ExternalLink, ExternalLink].map((Icon, i) => (
                    <a key={i} href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:bg-orange hover:text-white transition-all duration-300">
                      <Icon size={16} />
                    </a>
                  ))}
                </div>
              </div>

              {/* Column 2: Services */}
              <div>
                <h4 className="text-white font-black uppercase tracking-[0.2em] text-[10px] mb-8 opacity-80">{t.nav?.services || 'SERVICES'}</h4>
                <ul className="space-y-4 text-white/40 text-sm font-bold uppercase tracking-wider">
                  <li onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">{t.services.recrutement.title}</li>
                  <li onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">Intérim</li>
                  <li onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">RPO</li>
                  <li onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">{t.services.rh.title}</li>
                </ul>
              </div>

              {/* Column 3: Candidats */}
              <div>
                <h4 className="text-white font-black uppercase tracking-[0.2em] text-[10px] mb-8 opacity-80">{t.footer_ext.candidatesCol}</h4>
                <ul className="space-y-4 text-white/40 text-sm font-bold uppercase tracking-wider">
                  <li onClick={() => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">{t.offers.title}</li>
                  <li onClick={() => setCurrentView('candidate')} className="hover:text-orange transition-colors cursor-pointer">{t.hero.ctaCV}</li>
                  <li onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">{t.footer_ext.ourSectors}</li>
                  <li onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">{t.footer_ext.contact}</li>
                </ul>
              </div>

              {/* Column 4: Entreprises */}
              <div>
                <h4 className="text-white font-black uppercase tracking-[0.2em] text-[10px] mb-8 opacity-80">{t.nav?.recruiter || 'RECRUTEURS'}</h4>
                <ul className="space-y-4 text-white/40 text-sm font-bold uppercase tracking-wider">
                  <li onClick={() => setCurrentView('recruiter')} className="hover:text-orange transition-colors cursor-pointer">{t.recruiterSpace.dashboard.submitNeed}</li>
                  <li onClick={() => setCurrentView('recruiter')} className="hover:text-orange transition-colors cursor-pointer">{t.footer_ext.postJob}</li>
                  <li onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">{t.footer_ext.ourSolutionsLink}</li>
                  <li onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange transition-colors cursor-pointer">{t.footer_ext.contactUs}</li>
                </ul>
              </div>
            </div>

            <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.1em]">
                © {company.copyright} — {t.footer_ext.allRights} — {t.footer_ext.designedBy} <span className="text-orange">Nasser Taher</span>
              </p>
            </div>
          </div>
        </footer>
        
        {/* BENEFITS BAR - FROM IMAGE */}
        <div className="bg-navy border-t border-white/5 py-12 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
            <Logo inverted />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 w-full md:w-auto">
              {t.benefits_bar.items.map((benefit, i) => {
                const Icon = i === 0 ? CheckCircle2 : i === 1 ? Star : i === 2 ? Users : ArrowUpCircle;
                return (
                  <div key={i} className="flex items-center gap-4 group">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h4 className="text-white font-black text-[11px] uppercase tracking-widest mb-1">{benefit.title}</h4>
                      <p className="text-white/40 text-[9px] font-medium leading-tight whitespace-nowrap">{benefit.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Animated Background */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-orange/5 to-transparent skew-x-12" />
        </div>

        {/* WHATSAPP FLOATING BUTTON */}
        <motion.a href={`https://wa.me/${company.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1 }} className="fixed bottom-24 right-8 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-xl whatsapp-pulse z-50 group transition-all"><MessageCircle size={28} className="transition-transform group-hover:rotate-12" /></motion.a>

        {/* MODAL DÉTAIL OFFRE */}
        <AnimatePresence>
          {jobDetailOpen && jobDetail && (() => {
            const sector = SECTORS.find(s => s.id === jobDetail.sector);
            const SectorIcon = sector?.icon || Briefcase;
            const isUrgent = jobDetail.tags?.includes('Urgent') || jobDetail.urgent;
            const dateStr = jobDetail.createdAt?.toDate ? new Date(jobDetail.createdAt.toDate()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
            return (
              <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setJobDetailOpen(false)} />
                <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
                  className="relative z-10 w-full sm:max-w-2xl bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                  
                  {/* Header banner */}
                  <div className="bg-navy px-8 pt-8 pb-6 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-orange/10 rounded-full -mr-24 -mt-24" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16" />
                    <button onClick={() => setJobDetailOpen(false)}
                      className="absolute top-5 right-5 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition-all">
                      <X size={16} />
                    </button>
                    <div className="relative z-10">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
                          <SectorIcon size={26} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {isUrgent && (
                              <span className="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-400/30 rounded-full text-[9px] font-black uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Urgent
                              </span>
                            )}
                            <span className="text-white/40 text-[10px] font-bold">{dateStr}</span>
                          </div>
                          <h2 className="text-xl font-black text-white leading-tight mb-1">{jobDetail.title}</h2>
                          <p className="text-white/60 text-sm font-bold flex items-center gap-1.5">
                            <Building2 size={12} /> {jobDetail.company || 'Vedior GM'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="overflow-y-auto flex-1 p-8 space-y-6">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { icon: MapPin, label: 'Lieu', value: jobDetail.location, color: 'text-orange' },
                        { icon: FileText, label: 'Contrat', value: jobDetail.type, color: 'text-blue-500' },
                        { icon: Banknote, label: 'Salaire', value: jobDetail.salary || 'À négocier', color: 'text-green-500' },
                        { icon: GraduationCap, label: 'Expérience', value: jobDetail.experience || 'Non précisé', color: 'text-purple-500' },
                        { icon: Timer, label: 'Disponibilité', value: jobDetail.availability || 'Immédiate', color: 'text-cyan-500' },
                        { icon: Users, label: 'Profils', value: jobDetail.profileCount ? `${jobDetail.profileCount} poste(s)` : '1 poste', color: 'text-indigo-500' },
                        { icon: Calendar, label: 'Date limite', value: jobDetail.deadline || 'Ouvert', color: 'text-red-400' },
                        { icon: Briefcase, label: 'Secteur', value: t.sectors[sector?.key || 'admin'], color: 'text-gray-400' },
                      ].filter(item => item.value).map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon size={11} className={color} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">{label}</span>
                          </div>
                          <p className="text-xs font-black text-navy truncate">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    {jobDetail.description && (
                      <div>
                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-300 mb-3">
                          <BookOpen size={11} /> Description du poste
                        </h4>
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                          <p className="text-sm text-gray-600 leading-relaxed font-medium whitespace-pre-line">{jobDetail.description}</p>
                        </div>
                      </div>
                    )}

                    {/* Requirements */}
                    {jobDetail.requirements && (
                      <div>
                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-300 mb-3">
                          <CheckCircle2 size={11} /> Profil recherché
                        </h4>
                        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                          <p className="text-sm text-blue-700 leading-relaxed font-medium whitespace-pre-line">{jobDetail.requirements}</p>
                        </div>
                      </div>
                    )}

                    {/* Skills */}
                    {jobDetail.skills && (
                      <div>
                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-300 mb-3">
                          <Sparkles size={11} /> Compétences clés
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {String(jobDetail.skills).split(',').filter(Boolean).map((s: string) => (
                            <span key={s} className="px-3 py-1.5 bg-navy/5 text-navy rounded-lg text-[10px] font-black border border-navy/10">{s.trim()}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer CTA */}
                  <div className="shrink-0 px-4 sm:px-8 py-4 sm:py-5 border-t border-gray-100 flex gap-3 bg-white">
                    <button onClick={() => { setJobDetailOpen(false); handleApply(jobDetail); }}
                      className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-orange text-white font-black text-sm hover:bg-navy transition-all shadow-lg shadow-orange/20 uppercase tracking-wide">
                      <Upload size={15} /> Postuler maintenant
                    </button>
                    <button onClick={() => setJobDetailOpen(false)}
                      className="px-6 py-4 rounded-xl border border-gray-200 text-gray-400 font-black text-sm hover:bg-gray-50 transition-all">
                      Fermer
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

        {/* MODAL CANDIDATURE — redirige vers espace candidat */}
        <Modal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} title={lang === 'FR' ? 'Connexion requise' : 'Login required'}>
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 bg-orange/10 rounded-full flex items-center justify-center mx-auto">
              <User size={36} className="text-orange" />
            </div>
            {activeJob && (
              <div className="bg-orange/5 border border-orange/20 rounded-xl p-3 flex items-center gap-3 text-left">
                <div className="w-8 h-8 bg-orange/10 rounded-lg flex items-center justify-center text-orange font-black text-sm shrink-0">
                  {activeJob.company || '🏢'}
                </div>
                <div>
                  <p className="font-black text-navy text-sm">{activeJob.title}</p>
                  <p className="text-xs text-gray-400 font-medium">{activeJob.companyName || ''} · {activeJob.location || 'Djibouti'}</p>
                </div>
              </div>
            )}
            <div>
              <h4 className="text-xl font-black text-navy mb-2">
                {lang === 'FR' ? 'Créez votre espace candidat' : 'Create your candidate account'}
              </h4>
              <p className="text-gray-400 text-sm font-medium leading-relaxed">
                {lang === 'FR'
                  ? 'Pour postuler, vous devez être connecté. Créez votre compte gratuit en 2 minutes et suivez toutes vos candidatures.'
                  : 'To apply, you need to be logged in. Create your free account in 2 minutes and track all your applications.'}
              </p>
            </div>
            <button
              onClick={() => { setIsJobModalOpen(false); setCurrentView('candidate'); }}
              className="w-full bg-orange text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange/20 hover:bg-navy transition-all flex items-center justify-center gap-3">
              <User size={18} />
              {lang === 'FR' ? 'Créer mon compte / Se connecter' : 'Create account / Sign in'}
            </button>
            <button
              onClick={() => setIsJobModalOpen(false)}
              className="w-full text-gray-400 text-sm font-bold hover:text-gray-600 transition-colors">
              {lang === 'FR' ? 'Annuler' : 'Cancel'}
            </button>
          </div>
        </Modal>

                {/* MODAL BESOIN RECRUTEUR */}
        <Modal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} title={t.modals.needTitle}>
          {formSubmitted ? (
            <div className="text-center py-10 space-y-6"><div className="w-20 h-20 bg-orange/10 text-orange rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={40} /></div><h4 className="text-2xl font-bold text-navy">{t.modals.successNeed}</h4><p className="text-gray-500 font-medium italic">{t.modals.successNeedMsg}</p></div>
          ) : (
            <form onSubmit={handleCompanyNeedSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" name="company" required placeholder={t.modals.company} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-bold text-navy shadow-sm text-gray-800" />
                <input type="text" name="contactName" required placeholder={t.modals.contactPerson} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="tel" name="phone" required placeholder={t.modals.phoneLabel} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
                <input type="text" name="jobTitle" required placeholder={t.modals.jobTitle} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="number" name="profileCount" required placeholder={t.modals.profileCount} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
                <select name="needType" className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-bold text-navy shadow-sm">
                  <option value="CDI">{t.modals.needTypePerm}</option>
                  <option value="CDD">{t.modals.needTypeCDD}</option>
                  <option value="Interim">{t.modals.needTypeTemp}</option>
                  <option value="Audit">{t.modals.needTypeAudit}</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 ml-2">{t.modals.deadline}</label>
                  <input type="date" name="deadline" className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 ml-2">{t.modals.expRequired}</label>
                  <input type="number" name="expRequired" placeholder="Ex: 5" className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
                </div>
              </div>
              <textarea name="description" placeholder={t.modals.describeProfile} rows={4} required className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
              <button type="submit" disabled={submitting} className="w-full bg-navy text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-navy/20 active:scale-95 transition-all disabled:opacity-50">{submitting ? t.common.sending : t.modals.submitProject}</button>
            </form>
          )}
        </Modal>
      </div>
    </>
  );
}