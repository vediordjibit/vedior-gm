import React, { useState, useEffect } from 'react';
import {
  Briefcase, Users, Calendar, MapPin, MessageCircle, ChevronRight,
  Upload, Menu, X, Phone, Mail, Clock, Building2, Ship,
  HardHat, Utensils, ShieldCheck, Hospital, CheckCircle2,
  FileText, Search, Loader2, Star, ArrowRight, ArrowUpCircle,
  ExternalLink, User, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from './lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import AdminPanel from './components/AdminPanel';
import RecruiterPanel from './components/RecruiterPanel';
import CandidatePanel from './components/CandidatePanel';
import { useTranslation, setLangStorage, type Lang } from './lib/i18n';

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
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-full relative">
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
  const [filter, setFilter] = useState('all');
  const [candidateTab, setCandidateTab] = useState<'apply' | 'recruiter'>('apply');
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentView, setCurrentView] = useState<'site' | 'admin' | 'recruiter' | 'candidate'>('site');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setJobs(jobsData);
      setLoadingJobs(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
      setLoadingJobs(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.sector === filter);

  const handleApply = (job?: any) => {
    setActiveJob(job || null);
    setIsJobModalOpen(true);
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
      // Remplacé alert par console error pour plus de fluidité
    } finally {
      setSubmitting(false);
    }
  };

  const handleCandidateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get('fullName'),
      phone: formData.get('phone'),
      whatsapp: formData.get('whatsapp'),
      nationality: formData.get('nationality'),
      education: formData.get('education'),
      experience: formData.get('experience'),
      availability: formData.get('availability'),
      email: formData.get('email'),
      sector: formData.get('sector'),
      message: formData.get('message'),
      jobTitle: activeJob?.title || 'Spontaneous',
      jobId: activeJob?.id || 'spontaneous'
    };
    submitToFirestore('applications', data);
  };

  const handleRecruiterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      companyName: formData.get('company'),
      contactName: formData.get('contactName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      rcNumber: formData.get('rcNumber'),
      sector: formData.get('sector'),   // <-- CHAMP AJOUTÉ
      description: formData.get('jobDescription'),
      status: 'pending',
      createdAt: serverTimestamp()
    };
    submitToFirestore('recruiters', data);
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
    return <CandidatePanel onBack={() => setCurrentView('site')} />;
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
        <section id="home" className="relative pt-28 pb-16 md:pt-40 md:pb-24 overflow-hidden bg-white">
          {/* Subtle background */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#EFF6FF_0%,transparent_60%)]" />

          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* LEFT */}
              <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease: "easeOut" }}>
                {/* Top label */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-blue-500 font-bold uppercase tracking-[0.35em] text-[10px]">
                    {t.hero_section.platformLabel}
                  </span>
                </div>

                {/* Headline */}
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-[#0a1628] leading-[0.95] mb-8 tracking-tight">
                  {<>
                    {lang === 'AR' 
                      ? <>{t.hero_section.headlineAR}</>
                      : <>{t.hero_section.headlineLine1}<br />{t.hero_section.headlineLine2}<br /><span className="text-blue-600">{t.hero_section.headlineLine3}</span></>
                    }
                  </>}
                </h1>

                {/* Subtitle */}
                <p className="text-[15px] text-gray-500 mb-4 max-w-md leading-relaxed font-semibold">
                  {t.hero_section.subtitle2}
                </p>
                <p className="text-sm text-gray-400 mb-10 max-w-md leading-relaxed">
                  {t.hero.subtitle}
                </p>

                {/* CTA buttons */}
                <div className="flex flex-wrap gap-4 mb-12">
                  <a href="#offers" className="h-12 px-7 border-2 border-[#0a1628] text-[#0a1628] rounded-xl flex items-center gap-2.5 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-[#0a1628] hover:text-white transition-all active:scale-95">
                    {t.hero.ctaJobs} <ChevronRight size={16} />
                  </a>
                  <button onClick={() => handleApply()} className="h-12 px-7 bg-blue-600 text-white rounded-xl flex items-center gap-2.5 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 active:scale-95">
                    {t.hero.ctaCV} <Upload size={15} />
                  </button>
                </div>

                {/* Social proof */}
                <div className="flex items-center gap-6 pt-6 border-t border-gray-100">
                  <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-3 border-white bg-gray-200 overflow-hidden shadow-sm ring-2 ring-white">
                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-blue-600 text-white flex items-center justify-center text-[9px] font-black shadow-sm ring-2 ring-white">+15k</div>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-gray-700 uppercase tracking-widest">
                      {t.hero_section.socialProof}
                    </p>
                    <div className="flex text-yellow-400 mt-1 gap-0.5">
                      {[1,2,3,4,5].map(i => <Star key={i} size={11} fill="currentColor" />)}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* RIGHT — Photo grid */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="relative grid grid-cols-2 gap-3"
              >
                {/* Top-left: large landscape photo */}
                <div className="rounded-2xl overflow-hidden relative h-56 shadow-xl">
                  <img src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=800&auto=format&fit=crop" alt="Leadership" referrerPolicy="no-referrer" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-black uppercase tracking-widest text-[8px] opacity-80">
                      {t.hero_section.leadershipLabel}
                    </p>
                  </div>
                </div>

                {/* Top-right: stat badges card */}
                <div className="flex flex-col gap-3">
                  <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Users size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-[#0a1628] leading-none">15+</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{t.stats.experience}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                      <ShieldCheck size={20} className="text-green-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-[#0a1628]">{t.hero_section.security}</p>
                      <p className="text-[9px] text-gray-400 font-medium">{t.hero_section.rgpd}</p>
                    </div>
                  </div>
                  {/* Blue feature card */}
                  <div className="bg-blue-600 rounded-2xl p-5 flex-1 shadow-xl shadow-blue-600/20 flex flex-col justify-between">
                    <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                      <Users size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-black text-[11px] uppercase tracking-wide mb-1">
                        {t.hero_section.hrAdmin}
                      </p>
                      <p className="text-white/70 text-[10px] leading-relaxed">
                        {t.hero_section.hrAdminDesc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom-right: hotel photo */}
                <div className="col-start-2 rounded-2xl overflow-hidden relative h-44 shadow-xl -mt-32">
                  {/* this is now overlapping — we skip this; use a simple bottom row instead */}
                </div>

                {/* Bottom row — full width landscape */}
                <div className="col-span-2 rounded-2xl overflow-hidden relative h-44 shadow-xl">
                  <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop" alt="Hospitality" referrerPolicy="no-referrer" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <p className="text-white font-black uppercase tracking-widest text-[8px] opacity-80">
                      {t.hero_section.hospitality}
                    </p>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* PLATFORM FEATURES */}
        <section className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid lg:grid-cols-[1fr_1.6fr] gap-16 items-start">

              {/* LEFT — label + heading + mission card */}
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <span className="text-blue-500 font-black uppercase tracking-[0.35em] text-[10px] block mb-5">
                  {t.hero_section.ourSolutions}
                </span>
                <h2 className="text-3xl md:text-4xl font-black text-[#0a1628] mb-3 tracking-tight leading-tight">
                  {t.offers_section.title}
                </h2>
                <div className="w-10 h-1 bg-orange rounded-full mb-10" />

                {/* Mission card */}
                <div className="bg-[#0a1628] rounded-2xl p-7 text-white shadow-2xl shadow-navy/20">
                  <div className="inline-flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 mb-5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                      {t.hero_section.ourMission}
                    </span>
                  </div>
                  <h3 className="text-xl font-black leading-tight mb-3">
                    {t.hero_section.missionTitle}
                  </h3>
                  <p className="text-white/50 text-[13px] leading-relaxed mb-7">
                    {t.hero_section.missionDesc}
                  </p>
                  {/* Feature pills */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: ShieldCheck, label: t.hero_section.security },
                      { icon: BarChart3,   label: t.hero_section.performant },
                      { icon: Search,      label: t.hero_section.intelligent },
                      { icon: Users,       label: t.hero_section.collaborative },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-2 bg-white/6 rounded-xl px-3 py-2.5">
                        <Icon size={13} className="text-blue-400 shrink-0" />
                        <span className="text-[10px] font-black tracking-widest text-white/60">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* RIGHT — 2×3 feature grid */}
              <div className="grid sm:grid-cols-2 gap-5">
                {t.offers_section.items.map((item, i) => {
                  const Icon = {
                    Briefcase, Users, Search, MessageCircle, BarChart: Calendar, Lock: ShieldCheck
                  }[item.icon] || Briefcase;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-blue-100 hover:bg-white hover:shadow-lg transition-all group cursor-default"
                    >
                      <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Icon size={22} />
                      </div>
                      <h3 className="text-[12px] font-black text-[#0a1628] uppercase tracking-tight mb-2 leading-snug">{item.title}</h3>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{item.desc}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* FOR WHOM - FROM IMAGE */}
        <section className="py-24 bg-navy relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.1),transparent)]" />
          </div>
          
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase italic tracking-tighter">
                {t.target_audience.title}
              </h2>
              <div className="w-20 h-1.5 bg-orange rounded-full mx-auto" />
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {t.target_audience.items.map((audience, i) => {
                const Icon = i === 0 ? Building2 : i === 1 ? Users : Users;
                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white/5 backdrop-blur-sm p-10 rounded-[2.5rem] border border-white/10 text-center hover:bg-white/10 transition-all group"
                  >
                    <div className="w-20 h-20 bg-orange/20 rounded-3xl flex items-center justify-center text-orange mx-auto mb-8 group-hover:scale-110 transition-transform shadow-2xl shadow-orange/20">
                      <Icon size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">{audience.title}</h3>
                    <p className="text-white/60 leading-relaxed text-sm font-medium">{audience.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="relative px-8 -mt-12 z-20">
          <div className="max-w-7xl mx-auto bg-navy rounded-[3rem] shadow-[0_30px_100px_rgba(10,25,47,0.4)] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5 relative z-10">
              {[
                { label: t.stats.placements, val: '500+', icon: Users, delay: 0 },
                { label: t.stats.companies, val: '50+', icon: Building2, delay: 0.1 },
                { label: t.stats.experience, val: '15', icon: Calendar, delay: 0.2 },
                { label: t.stats.sectors, val: '8', icon: Star, delay: 0.3 },
              ].map((stat, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: stat.delay, duration: 0.6 }}
                  className="p-10 text-center hover:bg-white/[0.02] transition-colors"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white/5 rounded-2xl mb-6 text-orange group-hover:scale-110 transition-transform">
                    <stat.icon size={24} />
                  </div>
                  <div className="text-4xl md:text-5xl font-black text-white mb-2 tabular-nums">
                    {stat.val}
                  </div>
                  <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black italic">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* SERVICES */}
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
                  <h2 className="text-4xl md:text-6xl font-black text-navy leading-[1.05] mb-8 tracking-tighter uppercase italic">
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
                  <h2 className="text-5xl md:text-7xl font-black text-navy leading-[0.95] mb-12 tracking-tighter uppercase italic">
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
        <section id="offers" className="py-40 bg-[#F8FAFC] relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 gap-8">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}>
                <span className="text-orange font-black uppercase tracking-[0.4em] text-[10px] block mb-6 italic">
                  {t.offers.badge}
                </span>
                <h2 className="text-4xl md:text-7xl font-black text-navy tracking-tighter uppercase italic leading-none">
                  {t.offers.title.split(' ')[0]} <br />
                  <span className="text-orange not-italic">{t.offers.title.split(' ').slice(1).join(' ')}</span>
                </h2>
              </motion.div>
              
              <div className="flex flex-wrap gap-3">
                {['Tous', ...SECTORS.map(s => t.sectors[s.key])].map(sector => (
                  <button key={sector} className="px-8 py-4 rounded-2xl bg-[#FBFBFE] border border-gray-100 font-black text-[10px] uppercase tracking-widest text-navy hover:bg-orange hover:text-white transition-all shadow-sm active:scale-95 italic">
                    {sector}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
              <AnimatePresence mode="popLayout">
                {loadingJobs ? (
                  <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin text-orange" size={48} /></div>
                ) : filteredJobs.map((job, i) => {
                  const sector = SECTORS.find(s => s.id === job.sector);
                  const Icon = sector?.icon || Briefcase;
                  return (
                    <motion.div 
                      layout
                      key={job.id} 
                      initial={{ opacity: 0, y: 30 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.1 }}
                      className="group bg-[#FBFBFE] rounded-[3rem] p-10 shadow-[0_15px_50px_rgba(0,0,0,0.03)] border border-gray-100 hover:border-orange/20 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 relative overflow-hidden flex flex-col h-full"
                    >
                      <div className="flex justify-between items-start mb-10">
                        <div className="w-16 h-16 bg-navy/5 rounded-2xl flex items-center justify-center text-navy group-hover:bg-orange group-hover:text-white transition-all duration-500">
                          <Icon size={28} />
                        </div>
                        {job.tags && job.tags.includes('Urgent') && (
                          <span className="px-5 py-2 bg-orange/10 text-orange rounded-full text-[9px] font-black uppercase tracking-widest italic group-hover:bg-orange group-hover:text-white transition-all">
                            {t.offers.urgent}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-2xl font-black text-navy mb-4 tracking-tighter uppercase italic leading-tight">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-4 text-navy/40 mb-10">
                        <MapPin size={14} className="text-orange" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">
                          {job.location}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-10 pt-8 border-t border-navy/5">
                        <div>
                          <div className="text-[8px] font-black uppercase text-navy/30 tracking-[0.2em] mb-1 italic">{t.offers.type}</div>
                          <div className="text-[11px] font-black text-navy italic">{job.type}</div>
                        </div>
                        <div>
                          <div className="text-[8px] font-black uppercase text-navy/30 tracking-[0.2em] mb-1 italic">{t.offers.salary}</div>
                          <div className="text-[11px] font-black text-orange italic">{job.salary || 'N/A'}</div>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleApply(job)}
                        className="mt-auto w-full bg-navy text-white text-[10px] font-black uppercase tracking-[0.2em] py-5 rounded-2xl group-hover:bg-orange transition-all shadow-xl shadow-navy/10 active:scale-95 italic flex items-center justify-center gap-3"
                      >
                        {t.offers.apply} <ArrowRight size={18} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* CV Banner */}
            <motion.div 
               initial={{ opacity: 0, y: 50 }}
               whileInView={{ opacity: 1, y: 0 }}
               className="mt-32 relative rounded-[4rem] overflow-hidden bg-navy p-12 md:p-24 text-center group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-24 duration-700" />
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange/10 rounded-full blur-[100px]" />
              
              <div className="relative z-10 max-w-3xl mx-auto">
                <div className="w-20 h-20 bg-orange rounded-3xl mx-auto flex items-center justify-center text-white mb-10 shadow-2xl group-hover:scale-110 transition-transform">
                  <FileText size={40} />
                </div>
                <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter uppercase italic leading-none">
                  {t.cv_banner.title1} <br />
                  <span className="text-orange not-italic">{t.cv_banner.title2}</span>
                </h2>
                <p className="text-white/40 text-lg mb-12 font-bold italic">
                  {t.cv_banner.desc}
                </p>
                <button 
                  onClick={() => handleApply()}
                  className="bg-[#FBFBFE] text-navy px-12 py-6 rounded-3xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-orange hover:text-white transition-all shadow-2xl shadow-navy/40 active:scale-95 italic"
                >
                  {t.hero.ctaCV}
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ESPACE CANDIDAT */}
        <section id="candidate" className="py-32 relative overflow-hidden bg-navy">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-orange rounded-full blur-[120px] -mr-1/4 -mt-1/4" />
             <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-[#FBFBFE] rounded-full blur-[120px] -ml-1/4 -mb-1/4" />
          </div>
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <div className="flex flex-col justify-center">
                <span className="text-orange font-black uppercase tracking-[0.3em] text-[11px] block mb-6 italic opacity-80">{t.candidateSpace.badge}</span>
                <h2 className="text-4xl md:text-6xl font-black text-white mb-12 leading-[1.05] tracking-tighter uppercase">{t.candidateSpace.title}</h2>
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
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formName}</label>
                        <input type="text" name="fullName" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formPhone}</label>
                        <input type="tel" name="phone" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formWhatsapp}</label>
                        <input type="tel" name="whatsapp" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formNationality}</label>
                        <input type="text" name="nationality" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formEducation}</label>
                        <input type="text" name="education" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formExperience}</label>
                        <input type="number" name="experience" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formAvailability}</label>
                        <input type="text" name="availability" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.formSector}</label>
                        <select name="sector" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-black text-navy uppercase italic appearance-none cursor-pointer">{SECTORS.map(s => <option key={s.id} value={s.id} className="bg-[#FBFBFE] text-navy uppercase font-black">{t.sectors[s.key]}</option>)}</select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <form onSubmit={handleRecruiterSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.recruiterForm.company}</label>
                        <input type="text" name="company" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.modals.rcNumber}</label>
                        <input type="text" name="rcNumber" className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.recruiterForm.contactName}</label>
                       <input type="text" name="contactName" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.recruiterForm.email}</label>
                         <input type="email" name="email" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.recruiterForm.phone}</label>
                         <input type="tel" name="phone" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                      </div>
                    </div>
                    {/* CHAMP SECTEUR AJOUTÉ */}
                    <div className="space-y-2">
                       <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.footer_ext.sectorLabel}</label>
                       <select name="sector" required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy">
                         {SECTORS.map(s => (
                           <option key={s.id} value={s.id} className="bg-[#FBFBFE] text-navy uppercase font-black">
                             {t.sectors[s.key]}
                           </option>
                         ))}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] uppercase text-navy/40 font-black tracking-widest ml-1">{t.candidateSpace.recruiterForm.jobDesc}</label>
                       <textarea name="jobDescription" rows={3} required className="w-full bg-navy/5 border border-navy/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-orange focus:bg-[#FBFBFE] transition-all font-bold text-navy" />
                    </div>
                    <p className="text-[10px] text-navy/40 font-bold italic">{t.recruiterSpace.registrationInfo}</p>
                    <button type="submit" disabled={submitting} className="w-full bg-orange py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-orange/30 hover:bg-navy transition-all duration-300 text-[10px] text-white disabled:opacity-50">
                      {submitting ? t.common.sending : t.candidateSpace.recruiterForm.submit}
                    </button>
                  </form>
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
                  
                  <div className="grid grid-cols-3 gap-6 mb-10">
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
                <h2 className="text-4xl md:text-6xl font-black text-navy mb-12 leading-[1.05] tracking-tighter uppercase italic">{t.recruiterSpace.title}</h2>
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
                  <h2 className="text-4xl md:text-6xl font-black text-navy mb-8 tracking-tighter uppercase italic leading-[1.05]">
                    {t.about.title}
                  </h2>
                  <p className="text-lg text-navy/40 font-bold italic mb-12 max-w-md">
                    {t.about.subtitle}
                  </p>

                  <div className="grid grid-cols-3 gap-6 mb-16">
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
                    <span className="text-5xl text-orange font-black leading-none block mb-6 select-none leading-none opacity-20 group-hover:opacity-100 transition-opacity">"</span>
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
              <h2 className="text-4xl md:text-7xl font-black text-white mb-6 tracking-tighter uppercase italic">
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
                      { icon: MapPin, title: t.contact.location, val: 'Avenue Guelleh Batal, DJIBOUTI BP 2009' },
                      { icon: Phone, title: t.contact.phone, val: '+253 21 35 XX XX' },
                      { icon: Mail, title: t.contact.email, val: 'contact@vedior-gm.dj' }
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
          <div className="max-w-7xl mx-auto px-8">
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
                © 2025 VEDIOR GM — {t.footer_ext.allRights} — {t.footer_ext.designedBy} <span className="text-orange">Nasser Taher</span>
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
        <motion.a href="https://wa.me/2532135XXXX" target="_blank" rel="noopener noreferrer" initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1 }} className="fixed bottom-24 right-8 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-xl whatsapp-pulse z-50 group transition-all"><MessageCircle size={28} className="transition-transform group-hover:rotate-12" /></motion.a>

        {/* MODAL CANDIDATURE */}
        <Modal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} title={activeJob ? `${t.modals.applyTitle} : ${activeJob.title}` : t.modals.spontaneousTitle}>
          {formSubmitted ? (
            <div className="text-center py-10 space-y-6"><div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={40} /></div><h4 className="text-2xl font-bold text-navy">{t.modals.successApply}</h4><p className="text-gray-500 font-medium italic">{t.modals.successApplyMsg}</p></div>
          ) : (
            <form onSubmit={handleCandidateSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <input type="text" name="fullName" required placeholder={t.candidateSpace.formName} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
                <input type="tel" name="phone" required placeholder={t.candidateSpace.formPhone} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <input type="tel" name="whatsapp" placeholder={t.candidateSpace.formWhatsapp} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
                <input type="text" name="nationality" placeholder={t.candidateSpace.formNationality} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <input type="text" name="education" placeholder={t.candidateSpace.formEducation} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
                <input type="number" name="experience" placeholder={t.candidateSpace.formExperience} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
              </div>
              <input type="text" name="availability" placeholder={t.candidateSpace.formAvailability} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
              <input type="email" name="email" required placeholder="Email" className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
              <textarea name="message" placeholder="Parlez-nous de votre parcours" rows={3} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium text-gray-800" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center relative group">
                  <input type="file" name="cv" required accept=".pdf,.doc,.docx" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <Upload size={16} className="mx-auto mb-1 text-gray-300 group-hover:text-orange" />
                  <p className="text-[8px] font-black uppercase text-gray-400">CV (Obligatoire)</p>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center relative group">
                  <input type="file" name="diploma" accept=".pdf,.doc,.docx" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <Upload size={16} className="mx-auto mb-1 text-gray-300 group-hover:text-orange" />
                  <p className="text-[8px] font-black uppercase text-gray-400">Diplôme</p>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center relative group">
                  <input type="file" name="cert" accept=".pdf,.doc,.docx" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <Upload size={16} className="mx-auto mb-1 text-gray-300 group-hover:text-orange" />
                  <p className="text-[8px] font-black uppercase text-gray-400">Certificat</p>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-orange text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange/20 disabled:opacity-50">{submitting ? t.common.sending : t.common.send}</button>
            </form>
          )}
        </Modal>

        {/* MODAL BESOIN RECRUTEUR */}
        <Modal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} title={t.modals.needTitle}>
          {formSubmitted ? (
            <div className="text-center py-10 space-y-6"><div className="w-20 h-20 bg-orange/10 text-orange rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={40} /></div><h4 className="text-2xl font-bold text-navy">{t.modals.successNeed}</h4><p className="text-gray-500 font-medium italic">{t.modals.successNeedMsg}</p></div>
          ) : (
            <form onSubmit={handleCompanyNeedSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <input type="text" name="company" required placeholder={t.modals.company} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-bold text-navy shadow-sm text-gray-800" />
                <input type="text" name="contactName" required placeholder={t.modals.contactPerson} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <input type="tel" name="phone" required placeholder={t.modals.phoneLabel} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
                <input type="text" name="jobTitle" required placeholder={t.modals.jobTitle} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <input type="number" name="profileCount" required placeholder={t.modals.profileCount} className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-medium shadow-sm text-gray-800" />
                <select name="needType" className="w-full bg-gray-50 p-4 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange/20 font-bold text-navy shadow-sm">
                  <option value="CDI">{t.modals.needTypePerm}</option>
                  <option value="CDD">{t.modals.needTypeCDD}</option>
                  <option value="Interim">{t.modals.needTypeTemp}</option>
                  <option value="Audit">{t.modals.needTypeAudit}</option>
                </select>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
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