import React, { useState, useEffect } from 'react';
import { 
  User, Briefcase, FileText, Settings, LogOut, 
  Search, Bell, CheckCircle2, Clock, X, Eye,
  LayoutDashboard, Send, MapPin, Calendar, ArrowRight,
  TrendingUp, Activity, MessageSquare, ShieldCheck, Star,
  AlertCircle, MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { auth, db } from '../lib/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, doc, setDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  signInWithPopup as authSignInWithPopup, GoogleAuthProvider, signOut 
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
        src="/logo (2).png" 
        alt="Vedior GM" 
        className={`${currentSize} w-auto object-contain transition-all duration-500 ${inverted ? 'brightness-100' : 'brightness-100'}`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type CandidatePanelProps = {
  onBack: () => void;
  lang: string;
  setLang: (l: 'FR' | 'EN' | 'AR') => void;
  t: any;
};

const getChartData = (lang: string) => {
  const months = {
    FR: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    EN: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    AR: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
  };
  const data = [2, 5, 3, 8, 4, 6, 9];
  const currentDays = (months as any)[lang] || months.EN;
  return currentDays.map((name: string, i: number) => ({ name, value: data[i] }));
};

export default function CandidatePanel({ onBack, lang, setLang, t }: CandidatePanelProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [applications, setApplications] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'offers' | 'favorites' | 'messages' | 'profile' | 'settings'>('dashboard');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    nationality: 'Djiboutienne',
    education: '',
    experience: '',
    phone: '',
    address: '',
    birthDate: '',
    languages: 'Français, Somali, Afar',
    gender: 'M',
    availability: 'Immédiate'
  });

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Applications listen
    const qApps = query(
      collection(db, 'applications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
      setApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'applications');
    });

    // Profile listen
    const unsubscribeProfile = onSnapshot(doc(db, 'candidateProfiles', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({ id: docSnap.id, ...data });
        setSavedJobs(data.savedJobs || []);
        setProfileForm(prev => ({
          ...prev,
          fullName: data.fullName || user.displayName || '',
          nationality: data.nationality || 'Djiboutienne',
          education: data.education || '',
          experience: data.experience || '',
          phone: data.phone || '',
          address: data.address || '',
          birthDate: data.birthDate || '',
          languages: data.languages || 'Français, Somali, Afar',
          gender: data.gender || 'M',
          availability: data.availability || 'Immédiate'
        }));
      } else {
        setProfileForm(prev => ({
          ...prev,
          fullName: user.displayName || '',
          nationality: 'Djiboutienne',
          education: '',
          experience: '',
          phone: '',
          address: '',
          birthDate: '',
          languages: 'Français, Somali, Afar',
          gender: 'M',
          availability: 'Immédiate'
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `candidateProfiles/${user.uid}`);
    });

    // Messages listen
    const qMessages = query(
      collection(db, 'messages'),
      where('participantIds', 'array-contains', user.uid),
      orderBy('createdAt', 'asc')
    );
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    // Jobs listen
    const qJobs = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubscribeJobs = onSnapshot(qJobs, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
    });

    return () => {
      unsubscribeApps();
      unsubscribeProfile();
      unsubscribeMessages();
      unsubscribeJobs();
    };
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const profilePath = `candidateProfiles/${user.uid}`;
    try {
      await setDoc(doc(db, 'candidateProfiles', user.uid), {
        ...profileForm,
        email: user.email,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setNotification({ message: lang === 'FR' ? 'Profil mis à jour !' : 'Profile updated!', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, profilePath);
      setNotification({ message: 'Error', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleApply = async (job: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'applications'), {
        userId: user.uid,
        jobId: job.id,
        jobTitle: job.title,
        sector: job.sector,
        fullName: profileForm.fullName || user.displayName || 'Utilisateur Vedior',
        email: user.email,
        phone: profileForm.phone || '',
        nationality: profileForm.nationality || 'Djiboutienne',
        education: profileForm.education || '',
        experience: profileForm.experience || '',
        address: profileForm.address || '',
        birthDate: profileForm.birthDate || '',
        languages: profileForm.languages || '',
        gender: profileForm.gender || 'M',
        availability: profileForm.availability || 'Immédiate',
        status: 'new',
        createdAt: serverTimestamp()
      });
      setNotification({ message: lang === 'FR' ? 'Candidature envoyée !' : 'Application sent!', type: 'success' });
      setTimeout(() => {
        setNotification(null);
        setActiveTab('applications');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'applications');
      setNotification({ message: 'Error', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const toggleFavorite = async (jobId: string) => {
    if (!user) return;
    const isSaved = savedJobs.includes(jobId);
    const newSaved = isSaved 
      ? savedJobs.filter(id => id !== jobId)
      : [...savedJobs, jobId];
    
    const profilePath = `candidateProfiles/${user.uid}`;
    try {
      await setDoc(doc(db, 'candidateProfiles', user.uid), {
        savedJobs: newSaved
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, profilePath);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage,
        senderId: user.uid,
        senderName: profileForm.fullName || user.displayName || 'Candidat',
        participantIds: [user.uid, 'admin'], // Simple chat with admin/team
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    } finally {
      setSendingMessage(false);
    }
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await authSignInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = () => signOut(auth).then(() => onBack());

  if (!user) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl relative z-10 text-center"
        >
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          <h2 className="text-3xl font-black text-navy uppercase italic tracking-tighter mb-4">
            {lang === 'FR' ? 'Espace Candidat' : 'Candidate Space'}
          </h2>
          <p className="text-navy/50 font-bold mb-10 text-sm">
            {lang === 'FR' 
              ? 'Connectez-vous pour suivre vos candidatures et gérer votre profil.' 
              : 'Log in to track your applications and manage your profile.'}
          </p>
          <button 
            onClick={login}
            className="w-full bg-navy text-white py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-orange transition-all shadow-xl shadow-navy/10 active:scale-95"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
            {lang === 'FR' ? 'Continuer avec Google' : 'Continue with Google'}
          </button>
          
          <button onClick={onBack} className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-navy/40 hover:text-orange transition-colors">
            {lang === 'FR' ? 'Retour au portail' : 'Back to portal'}
          </button>
        </motion.div>
      </div>
    );
  }

  const stats = {
    total: applications.length,
    new: applications.filter(a => a.status === 'new' || !a.status).length,
    interview: applications.filter(a => a.status === 'interview').length,
    accepted: applications.filter(a => a.status === 'hired').length
  };

  const dir = lang === 'AR' ? 'rtl' : 'ltr';

  return (
    <div dir={dir} className="min-h-screen bg-[#F1F5F9] text-navy font-sans selection:bg-orange/30">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border ${
              notification.type === 'success' 
                ? 'bg-green-500 text-white border-green-400' 
                : 'bg-red-500 text-white border-red-400'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
      {/* SIDEBAR */}
      <aside className={`fixed top-0 bottom-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-72 bg-navy text-white z-50 flex flex-col shadow-[20px_0_50px_rgba(10,25,47,0.2)] transition-all duration-500`}>
        <div className="p-10 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={onBack}>
          <Logo inverted size="md" />
        </div>

        <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: lang === 'FR' ? 'Tableau de bord' : 'Dashboard' },
            { id: 'applications', icon: Briefcase, label: lang === 'FR' ? 'Mes Candidatures' : 'My Applications' },
            { id: 'offers', icon: Search, label: lang === 'FR' ? 'Offres d\'emploi' : 'Job Offers' },
            { id: 'favorites', icon: Star, label: lang === 'FR' ? 'Favoris' : 'Favorites' },
            { id: 'messages', icon: MessageSquare, label: lang === 'FR' ? 'Messages' : 'Messages' },
            { id: 'profile', icon: User, label: lang === 'FR' ? 'Mon Profil' : 'My Profile' },
            { id: 'settings', icon: Settings, label: lang === 'FR' ? 'Paramètres' : 'Settings' }
          ].map((item: any) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all relative overflow-hidden group ${
                activeTab === item.id 
                  ? 'bg-orange text-white shadow-xl shadow-orange/20 -skew-x-6 scale-[1.02]' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className={`${activeTab === item.id ? 'skew-x-6' : ''} flex items-center gap-4`}>
                <item.icon size={18} className={activeTab === item.id ? 'animate-pulse' : ''} />
                <span>{item.label}</span>
              </div>
              {item.id === 'applications' && applications.length > 0 && (
                <span className={`ml-auto bg-white/20 text-white px-2 py-0.5 rounded-md text-[8px] ${activeTab === item.id ? 'skew-x-6' : ''}`}>
                  {applications.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-white/5 mt-auto">
          <div className="bg-white/5 rounded-3xl p-5 flex items-center gap-4 mb-6 border border-white/5 group hover:bg-white/10 transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-orange/20 border border-orange/40 overflow-hidden shadow-lg group-hover:scale-110 transition-transform">
               {user.photoURL ? (
                 <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-orange font-black text-xl italic">{user.email?.charAt(0)}</div>
               )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-black truncate uppercase italic">{user.displayName || user.email?.split('@')[0]}</p>
              <p className="text-[8px] font-bold text-orange uppercase tracking-widest">Candidate ID: {user.uid.slice(0, 6)}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all group"
          >
            <LogOut size={16} className="group-hover:rotate-12 transition-transform" />
            {lang === 'FR' ? 'Fermer Session' : 'Logout Session'}
          </button>
        </div>
      </aside>

      <main className={`transition-all duration-500 p-8 md:p-12 ${dir === 'rtl' ? 'mr-72' : 'ml-72'}`}>
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8">
          <div>
            <span className="text-orange font-black uppercase tracking-[0.4em] text-[10px] block mb-2 italic">
              {activeTab.toUpperCase()}
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-navy uppercase italic tracking-tighter">
              {lang === 'FR' ? 'Bonjour,' : 'Hello,'} <span className="text-orange not-italic">{user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-navy/5">
            <button className="p-3 text-navy/30 hover:text-orange transition-colors relative">
               <Bell size={20} />
               <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-orange rounded-full border-2 border-white" />
            </button>
            <div className="w-px h-6 bg-navy/5" />
            <button 
              onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR' as any)}
              className="px-4 py-2 font-black text-[10px] uppercase tracking-widest text-navy/40 hover:text-navy"
            >
              {lang}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-navy/5 border-t-orange rounded-full animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
                {activeTab === 'dashboard' && (
                <div className="space-y-12">
                  {/* BENTO HERO SECTION */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-navy rounded-[3rem] p-12 text-white relative overflow-hidden group shadow-2xl">
                      <div className="absolute top-0 right-0 w-96 h-96 bg-orange/20 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:scale-110 transition-transform duration-700" />
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-4 mb-10">
                          <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                            <Star className="text-orange" size={32} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange mb-1 italic">Status Premium</p>
                            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Profil Optimisé</h2>
                          </div>
                        </div>
                        <p className="text-white/60 text-lg font-bold italic border-l-4 border-orange pl-8 mb-12 max-w-lg">
                          {lang === 'FR' 
                            ? 'Votre visibilité auprès des recruteurs est actuellement augmentée de 45% grâce à la complétion de votre CV Vedior.' 
                            : 'Your visibility to recruiters is currently increased by 45% thanks to the completion of your Vedior CV.'}
                        </p>
                        <div className="mt-auto flex flex-wrap gap-4">
                          <button 
                            onClick={() => setActiveTab('profile')}
                            className="bg-white text-navy px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange hover:text-white transition-all shadow-xl shadow-navy/20 active:scale-95 italic flex items-center gap-3"
                          >
                             {lang === 'FR' ? 'Peaufiner mon CV' : 'Refine my CV'} <ArrowRight size={16} />
                          </button>
                          <button 
                            onClick={() => setActiveTab('offers')}
                            className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all italic"
                          >
                             {lang === 'FR' ? 'Explorer les offres' : 'Explore offers'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange rounded-[3rem] p-10 text-white flex flex-col justify-between shadow-2xl shadow-orange/30 group relative overflow-hidden">
                       <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                       <div className="relative z-10">
                         <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-8">
                           <Bell size={28} />
                         </div>
                         <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-4">5+</h3>
                         <p className="text-[11px] font-black uppercase tracking-widest opacity-80">{lang === 'FR' ? 'Nouveaux messages de recruteurs' : 'New recruiter messages'}</p>
                       </div>
                       <button 
                         onClick={() => setActiveTab('messages')}
                         className="relative z-10 mt-8 w-full py-4 bg-white text-orange rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95 italic"
                       >
                         {lang === 'FR' ? 'Consulter ma boîte' : 'Check Inbox'}
                       </button>
                    </div>
                  </div>

                  {/* STATS GRID */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                      { label: lang === 'FR' ? 'Postulations' : 'Applications', val: stats.total, icon: Briefcase, color: 'navy', trend: '+2' },
                      { label: lang === 'FR' ? 'En Attente' : 'Pending', val: stats.new, icon: Clock, color: 'orange', trend: 'Soon' },
                      { label: lang === 'FR' ? 'Entretiens' : 'Interviews', val: stats.interview, icon: Calendar, color: 'navy', trend: 'HOT' },
                      { label: lang === 'FR' ? 'Réussites' : 'Accepted', val: stats.accepted, icon: CheckCircle2, color: 'orange', trend: '100%' }
                    ].map((s, i) => (
                      <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden relative">
                        <div className={`absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity font-black text-[10px] italic ${s.color === 'orange' ? 'text-orange' : 'text-navy'}`}>
                          {s.trend}
                        </div>
                        <div className={`w-14 h-14 ${s.color === 'orange' ? 'bg-orange text-white shadow-orange/30' : 'bg-navy text-white shadow-navy/30'} rounded-2xl flex items-center justify-center mb-8 shadow-xl transition-all group-hover:-rotate-6`}>
                          <s.icon size={26} />
                        </div>
                        <div className="text-5xl font-black text-navy mb-3 tabular-nums tracking-tighter italic">{s.val}</div>
                        <p className="text-[11px] font-black text-navy/30 uppercase tracking-[0.3em] italic">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-[1.8fr_1.2fr] gap-10">
                    {/* CHART */}
                    <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="flex items-center justify-between mb-12">
                        <div>
                          <h3 className="text-2xl font-black text-navy uppercase italic tracking-tighter mb-2">
                             Performance <span className="text-orange">Recrutement</span>
                          </h3>
                          <p className="text-[10px] font-bold text-navy/30 uppercase tracking-widest">{lang === 'FR' ? 'Tendances de consultation de votre profil' : 'Profile view trends'}</p>
                        </div>
                        <div className="p-4 bg-navy/5 text-navy rounded-2xl group-hover:bg-orange group-hover:text-white transition-all"><TrendingUp size={24} /></div>
                      </div>
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getChartData(lang)}>
                            <defs>
                              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fontWeight: 900, fill: '#0a192f', opacity: 0.3 }} 
                            />
                            <YAxis hide />
                            <Tooltip 
                              cursor={{ stroke: '#f97316', strokeWidth: 2, strokeDasharray: '5 5' }}
                              contentStyle={{ 
                                borderRadius: '24px', 
                                border: 'none', 
                                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                                fontWeight: 900,
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                padding: '15px'
                              }} 
                            />
                            <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={5} fillOpacity={1} fill="url(#colorVal)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* RECENT ACTIVITY BENTO CARD */}
                    <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange/5 rounded-full -mr-16 -mt-16" />
                      <div className="flex items-center justify-between mb-10 relative z-10">
                        <h3 className="text-xl font-black text-navy uppercase italic tracking-tighter">{lang === 'FR' ? 'Dossier Récent' : 'Recent Files'}</h3>
                        <Activity size={20} className="text-orange" />
                      </div>
                      <div className="space-y-4 flex-1 relative z-10">
                        {applications.slice(0, 5).length > 0 ? (
                          applications.slice(0, 5).map((app, i) => (
                            <div key={app.id} className="group bg-gray-50/50 hover:bg-white p-5 rounded-2xl border border-transparent hover:border-navy/5 hover:shadow-lg transition-all flex gap-5 items-center">
                               <div className="w-12 h-12 bg-navy rounded-xl flex items-center justify-center text-white shrink-0 group-hover:bg-orange transition-colors shadow-lg">
                                 {app.sector ? getSectorIcon(app.sector) : <Briefcase size={20} />}
                               </div>
                               <div className="min-w-0">
                                 <p className="text-[12px] font-black uppercase text-navy truncate leading-none group-hover:text-orange transition-colors">
                                   {app.jobTitle || 'Candidature Spontanée'}
                                 </p>
                                 <div className="flex items-center gap-2 mt-2">
                                   <StatusBadge status={app.status || 'new'} lang={lang} />
                                   <span className="text-[9px] font-bold text-navy/30 uppercase tracking-widest">• {new Date(app.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                                 </div>
                               </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-20">
                            <FileText size={64} strokeWidth={1} className="mb-6" />
                            <p className="text-[12px] font-black uppercase tracking-[0.3em]">{lang === 'FR' ? 'Aucune activité' : 'No activity'}</p>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setActiveTab('applications')}
                        className="relative z-10 mt-10 w-full py-5 bg-navy text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-orange transition-all shadow-xl shadow-navy/10 active:scale-95 italic flex items-center justify-center gap-3"
                      >
                         {lang === 'FR' ? 'Voir l\'historique' : 'View History'} <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'applications' && (
                <div className="space-y-12">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                    <div>
                      <h2 className="text-3xl font-black text-navy uppercase italic tracking-tighter mb-2 underline decoration-orange decoration-4 underline-offset-8 decoration-skip-ink-none">{lang === 'FR' ? 'Suivi Dossiers' : 'Application Tracking'}</h2>
                      <p className="text-[10px] font-bold text-navy/30 uppercase tracking-widest leading-relaxed">
                        {lang === 'FR' ? 'Gestion en temps réel de votre parcours professionnel' : 'Real-time management of your professional journey'}
                      </p>
                    </div>
                    <div className="flex gap-4">
                       <div className="relative group">
                          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-navy/20 group-focus-within:text-orange transition-colors" size={18} />
                          <input type="text" placeholder={lang === 'FR' ? 'Filtrer...' : 'Filter...'} className="pl-16 pr-8 py-5 bg-white border border-gray-100 rounded-[2rem] text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-orange/10 w-72 shadow-xl shadow-navy/5 transition-all" />
                       </div>
                    </div>
                  </div>
                  
                  <div className="grid gap-8">
                    {applications.length > 0 ? (
                      applications.map((app) => (
                        <div key={app.id} className="group bg-white p-8 rounded-[3.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-2 h-full bg-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="w-24 h-24 bg-navy rounded-[3rem] flex items-center justify-center text-white shadow-2xl shadow-navy/20 group-hover:bg-orange transition-all duration-700 shrink-0 -rotate-3 group-hover:rotate-0 relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/5 skew-y-12 translate-y-1/2 group-hover:translate-y-0 transition-transform" />
                            <div className="relative z-10">
                              {app.sector ? getSectorIcon(app.sector) : <Briefcase size={36} />}
                            </div>
                          </div>
                          
                          <div className="flex-1 text-center md:text-left">
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mb-4">
                              <p className="text-2xl font-black text-navy uppercase tracking-tight italic group-hover:text-orange transition-all group-hover:translate-x-2 duration-500">{app.jobTitle || 'Candidature Spontanée'}</p>
                              <span className="px-5 py-1.5 bg-navy/5 rounded-full text-[9px] font-black uppercase text-navy/40 italic">Ref: {app.id.slice(0, 8)}</span>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-[10px] font-black text-navy/30 uppercase tracking-widest italic">
                               <span className="flex items-center gap-2 bg-navy/5 px-4 py-2 rounded-2xl text-navy"><Calendar size={14} className="text-orange" /> {app.createdAt ? new Date(app.createdAt.seconds * 1000).toLocaleDateString() : '--/--'}</span>
                               <span className="flex items-center gap-2 bg-navy/5 px-4 py-2 rounded-2xl text-navy"><Briefcase size={14} className="text-orange" /> {app.sector || 'Général'}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-center md:items-end gap-6 shrink-0 md:min-w-[200px]">
                            <StatusBadge status={app.status || 'new'} lang={lang} />
                            <div className="flex items-center gap-3 w-full">
                              <button className="flex-1 px-8 py-4 bg-navy text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-orange transition-all shadow-xl shadow-navy/10 italic flex items-center justify-center gap-3 active:scale-95 group/btn">
                                {lang === 'FR' ? 'Consulter' : 'View Details'} 
                                <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed border-navy/5 opacity-40">
                         <Search size={80} strokeWidth={1.5} className="mx-auto mb-8 text-navy/20" />
                         <p className="font-black uppercase text-base tracking-[0.4em] text-navy italic">{lang === 'FR' ? 'Aucun Dossier Trouvé' : 'No Applications Found'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-12">
                   {/* Profile Header Card */}
                   <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-orange/5 rounded-full -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-110" />
                      <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                        <div className="relative group/avatar">
                          <div className="w-48 h-48 bg-navy rounded-[3rem] p-1.5 shadow-2xl relative overflow-hidden transition-transform duration-500 group-hover/avatar:rotate-3">
                             {user.photoURL ? (
                               <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover rounded-[2.5rem]" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-white text-6xl font-black italic">{user.displayName?.charAt(0) || user.email?.charAt(0)}</div>
                             )}
                          </div>
                          <button className="absolute -bottom-4 -right-4 w-12 h-12 bg-orange text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white active:scale-90 transition-all hover:rotate-12">
                             <PlusIcon className="w-6 h-6" />
                          </button>
                        </div>
                        
                        <div className="flex-1 text-center md:text-left">
                          <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 mb-4">
                            <h3 className="text-4xl font-black text-navy uppercase italic tracking-tighter">{user.displayName || user.email?.split('@')[0]}</h3>
                            <div className="px-5 py-1.5 bg-green-50 text-green-600 border border-green-100 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                              <ShieldCheck size={14} /> {lang === 'FR' ? 'Vérifié' : 'Verified'}
                            </div>
                          </div>
                          <p className="text-navy/40 font-bold text-lg mb-8 italic">{user.email}</p>
                          <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <div className="px-6 py-3 bg-navy/5 rounded-2xl flex items-center gap-3">
                              <MapPin size={16} className="text-orange" />
                              <span className="text-[10px] font-black uppercase text-navy italic">{profileForm.address || 'Djibouti'}</span>
                            </div>
                            <div className="px-6 py-3 bg-navy/5 rounded-2xl flex items-center gap-3">
                              <Briefcase size={16} className="text-orange" />
                              <span className="text-[10px] font-black uppercase text-navy italic">{profileForm.experience} {lang === 'FR' ? 'Ans d\'Exp.' : 'Years Exp.'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                   </div>

                   <form onSubmit={handleSaveProfile} className="grid lg:grid-cols-2 gap-10">
                      {/* Personal Details Card */}
                      <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm space-y-10">
                        <div className="flex items-center gap-4 mb-2">
                           <div className="w-12 h-12 bg-orange text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange/20">
                             <User size={24} />
                           </div>
                           <h3 className="text-xl font-black text-navy uppercase italic tracking-tighter">{lang === 'FR' ? 'Identité & Contact' : 'Identity & Contact'}</h3>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic">{lang === 'FR' ? 'Nom Complet' : 'Full Name'}</label>
                            <input 
                              type="text" 
                              value={profileForm.fullName}
                              onChange={(e) => setProfileForm({...profileForm, fullName: e.target.value})}
                              className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none" 
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic">{lang === 'FR' ? 'Nationalité' : 'Nationality'}</label>
                            <input 
                              type="text" 
                              value={profileForm.nationality}
                              onChange={(e) => setProfileForm({...profileForm, nationality: e.target.value})}
                              className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none" 
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic">{lang === 'FR' ? 'Téléphone' : 'Phone'}</label>
                            <input 
                              type="tel" 
                              value={profileForm.phone}
                              onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                              className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none" 
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic">{lang === 'FR' ? 'Date de Naissance' : 'Birth Date'}</label>
                            <input 
                              type="date" 
                              value={profileForm.birthDate}
                              onChange={(e) => setProfileForm({...profileForm, birthDate: e.target.value})}
                              className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none appearance-none" 
                            />
                          </div>
                          <div className="space-y-3 sm:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic">{lang === 'FR' ? 'Adresse de Résidence' : 'Residential Address'}</label>
                            <input 
                              type="text" 
                              value={profileForm.address}
                              onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                              placeholder="Ex: Plateau du Serpent, Djibouti"
                              className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none" 
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic uppercase tracking-tighter">{lang === 'FR' ? 'Sexe' : 'Gender'}</label>
                            <select 
                              value={profileForm.gender}
                              onChange={(e) => setProfileForm({...profileForm, gender: e.target.value})}
                              className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none appearance-none"
                            >
                              <option value="M">{lang === 'FR' ? 'Masculin' : 'Male'}</option>
                              <option value="F">{lang === 'FR' ? 'Féminin' : 'Female'}</option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic">{lang === 'FR' ? 'Disponibilité' : 'Availability'}</label>
                            <input 
                              type="text" 
                              value={profileForm.availability}
                              onChange={(e) => setProfileForm({...profileForm, availability: e.target.value})}
                              className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none" 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Experience & Education Card */}
                      <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div className="space-y-10">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-navy text-white rounded-2xl flex items-center justify-center shadow-lg shadow-navy/20">
                               <FileText size={24} />
                             </div>
                             <h3 className="text-xl font-black text-navy uppercase italic tracking-tighter">{lang === 'FR' ? 'Parcours & CV' : 'Background & CV'}</h3>
                          </div>

                          <div className="space-y-8">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic">{lang === 'FR' ? 'Dernier Diplôme ou Formation' : 'Last Degree or Training'}</label>
                              <input 
                                type="text" 
                                value={profileForm.education}
                                onChange={(e) => setProfileForm({...profileForm, education: e.target.value})}
                                placeholder="Ex: Licence en Management" 
                                className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none" 
                              />
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic">{lang === 'FR' ? 'Années d\'Expérience Totales' : 'Total Years of Experience'}</label>
                              <input 
                                type="number" 
                                value={profileForm.experience}
                                onChange={(e) => setProfileForm({...profileForm, experience: e.target.value})}
                                placeholder="Ex: 5" 
                                className="w-full bg-navy/5 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all outline-none" 
                              />
                            </div>
                            
                            <div className="pt-6 relative group/cv">
                               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 ml-2 italic mb-4">{lang === 'FR' ? 'Document CV Actuel' : 'Current CV Document'}</p>
                               <div className="bg-navy rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl transition-all duration-500 hover:scale-[1.02] -skew-x-2">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange/20 rounded-full blur-3xl -mr-16 -mt-16" />
                                  <div className="relative z-10 flex items-center justify-between skew-x-2">
                                    <div className="flex items-center gap-6">
                                      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                                        <FileText size={32} className="text-orange" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-black uppercase italic tracking-tight mb-1">Candidat_Vedior_2024.pdf</p>
                                        <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{lang === 'FR' ? 'Modifié il y a 48h' : 'Updated 48h ago'}</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button type="button" className="p-3 bg-white/10 rounded-xl hover:bg-orange transition-all"><Eye size={18} /></button>
                                      <button type="button" className="p-3 bg-white/10 rounded-xl hover:bg-orange transition-all"><Send size={18} /></button>
                                    </div>
                                  </div>
                               </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-12">
                          <button 
                            type="submit" 
                            disabled={savingProfile}
                            className="w-full py-6 bg-orange text-white text-xs font-black uppercase tracking-[0.3em] rounded-3xl shadow-[0_25px_50px_rgba(249,115,22,0.4)] hover:scale-[1.02] active:scale-95 transition-all italic disabled:opacity-50 disabled:cursor-not-allowed group"
                          >
                             <div className="flex items-center justify-center gap-4">
                               {savingProfile ? (lang === 'FR' ? 'Synchronisation...' : 'Syncing...') : (lang === 'FR' ? 'Mettre à jour mon dossier' : 'Update my profile')}
                               {!savingProfile && <CheckCircle2 size={18} className="group-hover:rotate-12 transition-transform" />}
                             </div>
                          </button>
                        </div>
                      </div>
                   </form>
                </div>
              )}

              {activeTab === 'offers' && (
                <div className="space-y-12">
                   <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 px-4">
                     <div>
                       <h2 className="text-5xl font-black text-navy uppercase italic tracking-tighter mb-4">Opportunités <span className="text-orange">Directes</span></h2>
                       <p className="text-[10px] font-bold text-navy/30 uppercase tracking-widest leading-relaxed">
                          {lang === 'FR' ? 'Filtrage intelligent basé sur votre profil expert' : 'Smart filtering based on your expert profile'}
                       </p>
                     </div>
                     <button className="flex items-center gap-6 bg-white px-10 py-5 rounded-[2rem] shadow-sm border border-navy/5 font-black text-[10px] uppercase tracking-widest text-navy hover:bg-navy hover:text-white transition-all italic group">
                        {lang === 'FR' ? 'Secteurs Clés' : 'Key Industries'} 
                        <div className="w-10 h-10 bg-orange text-white rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-orange/20">
                          <Search size={18} /> 
                        </div>
                     </button>
                   </div>
                   
                   <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {jobs.length > 0 ? (
                        jobs.map(job => (
                        <div key={job.id} className="bg-white p-10 rounded-[4rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col h-full hover:border-orange/20 -skew-y-1 hover:skew-y-0 duration-500 transform-gpu">
                           <div className="absolute top-0 left-0 w-full h-3 bg-orange translate-y-full group-hover:translate-y-0 transition-transform duration-700" />
                           <div className="flex justify-between items-start mb-10">
                             <div className="w-16 h-16 bg-navy text-white rounded-[2.2rem] flex items-center justify-center group-hover:bg-orange transition-all duration-700 shadow-2xl shadow-navy/20 rotate-3 group-hover:rotate-0">
                               <Briefcase size={28} />
                             </div>
                             <div className="flex flex-col items-end gap-3">
                               <button 
                                 onClick={() => toggleFavorite(job.id)}
                                 className={`p-4 rounded-2xl transition-all shadow-sm active:scale-90 ${savedJobs.includes(job.id) ? 'bg-orange text-white' : 'bg-navy/5 text-navy/20 hover:text-orange hover:bg-orange/5'}`}
                               >
                                 <Star size={20} fill={savedJobs.includes(job.id) ? "currentColor" : "none"} />
                               </button>
                               {job.tags?.includes('Urgent') && (
                                 <div className="px-5 py-1.5 bg-red-50 text-red-500 rounded-full text-[9px] font-black uppercase tracking-widest italic border border-red-100 animate-pulse">Hot Talent</div>
                               )}
                             </div>
                           </div>

                             <div className="flex-1">
                               <h3 className="text-2xl font-black text-navy mb-4 tracking-tighter uppercase italic leading-tight group-hover:text-orange transition-colors min-h-[4rem]">{job.title}</h3>
                               
                               <div className="flex items-center gap-4 text-navy/40 mb-10 font-bold text-[10px] uppercase tracking-[0.2em] italic">
                                  <MapPin size={14} className="text-orange" /> {job.location || 'Djibouti Centre'}
                               </div>

                               <div className="grid grid-cols-2 gap-4 pt-10 border-t border-navy/5 mb-10">
                                  <div className="space-y-2">
                                    <span className="text-[8px] font-black uppercase text-navy/20 tracking-widest block italic">Modèle</span>
                                    <span className="text-[11px] font-black text-navy italic bg-navy/5 px-4 py-1.5 rounded-xl block text-center uppercase">{job.type || 'CDI'}</span>
                                  </div>
                                  <div className="space-y-2">
                                    <span className="text-[8px] font-black uppercase text-navy/20 tracking-widest block italic">{lang === 'FR' ? 'Employeur' : 'Employer'}</span>
                                    <span className="text-[11px] font-black text-orange italic truncate block bg-orange/5 px-4 py-1.5 rounded-xl text-center">{job.companyName}</span>
                                  </div>
                               </div>
                             </div>

                           <button 
                             onClick={() => handleApply(job)}
                             className="w-full py-6 bg-navy text-white rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-orange transition-all shadow-2xl shadow-navy/20 italic flex items-center justify-center gap-4 active:scale-95 group/btn overflow-hidden relative"
                           >
                              <div className="absolute inset-0 bg-white/5 skew-x-12 translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500" />
                              <span className="relative z-10">{lang === 'FR' ? 'Propulser mon CV' : 'Fast Track Application'}</span> 
                              <ArrowRight size={18} className="relative z-10 group-hover/btn:translate-x-2 transition-transform" />
                           </button>
                        </div>
                        ))
                      ) : (
                        <div className="col-span-full py-48 text-center bg-white/50 border-4 border-dashed border-navy/5 rounded-[4rem] group hover:border-orange/20 transition-colors">
                          <Search size={100} strokeWidth={1} className="mx-auto mb-8 text-navy/10 group-hover:text-orange/20 transition-colors" />
                          <p className="font-black uppercase text-xl tracking-[0.5em] text-navy/10 italic">{lang === 'FR' ? 'Aucune opportunité' : 'No search results'}</p>
                        </div>
                      )}
                   </div>
                </div>
              )}
              
               {activeTab === 'favorites' && (
                <div className="space-y-12">
                   <div className="px-4">
                     <h2 className="text-4xl font-black text-navy uppercase italic tracking-tighter mb-4 underline decoration-orange decoration-4 transition-all hover:decoration-8">{lang === 'FR' ? 'Sélection Élite' : 'Elite Selection'}</h2>
                     <p className="text-[10px] font-bold text-navy/30 uppercase tracking-widest italic">{lang === 'FR' ? 'Votre curation personnelle des meilleures opportunités' : 'Your personal curation of top tier roles'}</p>
                   </div>
                   
                   <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {jobs.filter(j => savedJobs.includes(j.id)).length > 0 ? (
                        jobs.filter(j => savedJobs.includes(j.id)).map(job => (
                        <div key={job.id} className="bg-white p-10 rounded-[4rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col h-full hover:scale-[1.02] duration-500">
                           <div className="absolute inset-0 bg-navy/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                           <div className="flex justify-between items-start mb-10 relative z-10">
                             <div className="w-16 h-16 bg-orange text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-orange/30 group-hover:rotate-12 transition-transform">
                               <Star size={28} fill="currentColor" />
                             </div>
                             <button 
                               onClick={() => toggleFavorite(job.id)} 
                               className="p-4 bg-white/80 backdrop-blur-md rounded-2xl text-navy/20 hover:text-red-500 transition-all shadow-sm hover:rotate-90"
                             >
                               <X size={20} />
                             </button>
                           </div>
                           <div className="relative z-10 flex-1 flex flex-col">
                             <h3 className="text-2xl font-black text-navy mb-3 tracking-tighter uppercase italic leading-tight group-hover:text-orange transition-colors">{job.title}</h3>
                             <p className="text-[11px] font-black text-orange uppercase tracking-widest mb-10 italic">{job.companyName}</p>
                             
                             <button 
                               onClick={() => handleApply(job)}
                               className="mt-auto w-full py-5 bg-navy text-white rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-orange transition-all shadow-2xl shadow-navy/30 italic flex items-center justify-center gap-4 active:scale-95 group/btn"
                             >
                                {lang === 'FR' ? 'Propulser ma Candidature' : 'Fast Track Now'} 
                                <ArrowRight size={18} className="group-hover/btn:translate-x-2 transition-transform" />
                             </button>
                           </div>
                        </div>
                        ))
                      ) : (
                        <div className="col-span-full py-48 text-center bg-white rounded-[4rem] border-2 border-dashed border-navy/5 group hover:border-orange/20 transition-all relative overflow-hidden">
                          <div className="absolute inset-0 bg-orange/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Star size={80} strokeWidth={1} className="mx-auto mb-8 text-navy/10 group-hover:scale-110 transition-transform duration-700" />
                          <p className="font-black uppercase tracking-[0.5em] text-navy/20 italic text-sm group-hover:text-navy/40 transition-colors uppercase italic">{lang === 'FR' ? 'Curriculum Vide' : 'Curation Empty'}</p>
                        </div>
                      )}
                   </div>
                </div>
              )}

              {activeTab === 'messages' && (
                <div className="bg-white rounded-[3.5rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-[750px] relative">
                   <div className="p-10 border-b border-navy/5 bg-navy text-white flex items-center justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-orange/10 rounded-full blur-3xl -mr-32 -mt-32" />
                      <div className="flex items-center gap-6 relative z-10">
                         <div className="relative">
                           <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
                              <MessageSquare size={32} className="text-orange" />
                           </div>
                           <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-navy rounded-full animate-pulse" />
                         </div>
                         <div>
                            <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-2">{lang === 'FR' ? 'Vedior Direct' : 'Vedior Direct'}</h2>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                              <span className="w-2 h-2 bg-orange rounded-full" />
                              {lang === 'FR' ? 'Ligne de recrutement sécurisée' : 'Secure recruitment line'}
                            </p>
                         </div>
                      </div>
                      <button className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:text-orange hover:bg-white/10 transition-all relative z-10 border-dashed">
                        <MoreVertical size={20} />
                      </button>
                   </div>

                   <div className="flex-1 overflow-y-auto p-12 space-y-8 bg-[#FBFBFE]">
                      {messages.length > 0 ? (
                        messages.map((msg) => (
                           <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                              <div className={`max-w-[80%] p-8 rounded-[3rem] shadow-sm relative group overflow-hidden ${
                                msg.senderId === user.uid 
                                  ? 'bg-navy text-white rounded-tr-none shadow-navy/20' 
                                  : 'bg-white text-navy rounded-tl-none border border-navy/5 shadow-xl shadow-navy/5'
                              }`}>
                                 {msg.senderId === user.uid && (
                                   <div className="absolute top-0 left-0 w-full h-1 bg-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                                 )}
                                 <p className="text-[14px] font-bold leading-[1.6]">{msg.text}</p>
                                 <div className={`flex items-center gap-2 mt-4 opacity-40 text-[9px] font-black uppercase italic ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                                    {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    {msg.senderId === user.uid && <CheckCircle2 size={10} className="text-orange" />}
                                 </div>
                              </div>
                           </div>
                        ))
                      ) : (
                         <div className="h-full flex flex-col items-center justify-center text-navy/10 gap-10">
                            <div className="w-32 h-32 bg-navy/5 rounded-[3rem] flex items-center justify-center animate-bounce">
                               <MessageSquare size={64} strokeWidth={1} />
                            </div>
                            <div className="text-center">
                               <p className="text-lg font-black uppercase italic tracking-tighter text-navy/20 mb-2">{lang === 'FR' ? 'Démarrez la conversation' : 'Start the conversation'}</p>
                               <p className="text-[10px] font-bold text-navy/10 uppercase tracking-widest">{lang === 'FR' ? 'Posez vos questions à l\'équipe recrutement' : 'Ask our recruitment team anything'}</p>
                            </div>
                         </div>
                      )}
                   </div>

                   <div className="p-10 bg-white border-t border-navy/5 relative">
                      <form onSubmit={handleSendMessage} className="flex gap-6 items-center">
                         <div className="flex-1 relative group">
                            <input 
                              type="text" 
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder={lang === 'FR' ? 'Votre message professionnel...' : 'Your professional message...'} 
                              className="w-full bg-navy/5 border-2 border-transparent px-10 py-6 rounded-[2.5rem] outline-none text-sm font-bold text-navy focus:bg-white focus:border-orange transition-all pr-24"
                              disabled={sendingMessage}
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex gap-2">
                               <button type="button" className="p-3 text-navy/20 hover:text-orange transition-colors"><PlusIcon className="w-5 h-5" /></button>
                            </div>
                         </div>
                         <button 
                           type="submit" 
                           disabled={sendingMessage || !newMessage.trim()}
                           className="bg-orange text-white w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-orange/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 group shrink-0"
                         >
                            {sendingMessage ? (
                              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Send size={28} className="group-hover:rotate-12 transition-transform" />
                            )}
                         </button>
                      </form>
                   </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-4xl space-y-12">
                   <div className="grid md:grid-cols-2 gap-10">
                      <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-orange/5 rounded-full -mr-16 -mt-16" />
                         <h3 className="text-2xl font-black text-navy uppercase italic tracking-tighter mb-10 border-l-4 border-orange pl-6">{lang === 'FR' ? 'Alertes Canaux' : 'Channel Alerts'}</h3>
                         <div className="space-y-10">
                            {[
                              { label: lang === 'FR' ? 'Intelligence Jobs' : 'Job Intelligence', desc: 'Alertes prédictives sur les offres BTP & Logistique.', active: true },
                              { label: lang === 'FR' ? 'Status Live' : 'Live Status', desc: 'Mises à jour instantanées sur vos dossiers en cours.', active: true },
                              { label: lang === 'FR' ? 'Messagerie Push' : 'Push Messaging', desc: 'Notifications directes pour les messages privés.', active: false }
                            ].map((notif, i) => (
                              <div key={i} className="flex items-center justify-between group/item">
                                 <div className="flex-1 pr-6">
                                    <p className="text-[12px] font-black uppercase text-navy italic mb-1 group-hover/item:text-orange transition-colors">{notif.label}</p>
                                    <p className="text-[9px] font-bold text-navy/30 uppercase tracking-widest leading-relaxed">{notif.desc}</p>
                                 </div>
                                 <button className={`w-14 h-8 rounded-full p-1 transition-all duration-500 relative ${notif.active ? 'bg-orange shadow-lg shadow-orange/30' : 'bg-navy/10'}`}>
                                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-500 ${notif.active ? 'translate-x-6' : 'translate-x-0'}`} />
                                 </button>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="space-y-10">
                         <div className="bg-navy p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-6 relative z-10">{lang === 'FR' ? 'Confidentialité' : 'Privacy Mode'}</h3>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-relaxed mb-10 relative z-10">{lang === 'FR' ? 'Sécurisez vos données avec le chiffrement de bout en bout Vedior.' : 'Secure your data with Vedior end-to-end encryption.'}</p>
                            <button className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-orange transition-all italic relative z-10 shadow-xl shadow-black/20">
                               {lang === 'FR' ? 'Gérer les clés' : 'Manage keys'}
                            </button>
                         </div>

                         <div className="bg-red-50 p-12 rounded-[3.5rem] border border-red-100 shadow-sm group">
                            <h3 className="text-2xl font-black text-red-600 uppercase italic tracking-tighter mb-4">{lang === 'FR' ? 'Compte' : 'Account'}</h3>
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest leading-relaxed mb-10">{lang === 'FR' ? 'Toutes les données seront définitivement effacées.' : 'All data will be permanently erased.'}</p>
                            <button className="w-full py-6 bg-white border-2 border-red-100 text-red-600 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl shadow-red-200/50 italic active:scale-95">
                               {lang === 'FR' ? 'Suppression Irréversible' : 'Irreversible Deletion'}
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Helper components
const PlusIcon = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const getSectorIcon = (sector: string) => {
  switch (sector.toLowerCase()) {
    case 'btp': return <TrendingUp size={20} />;
    case 'logistics': return <Activity size={20} />;
    case 'hospitality': return <ArrowRight size={20} />;
    default: return <Briefcase size={20} />;
  }
};

const StatusBadge = ({ status, lang }: { status: string, lang: string }) => {
  const configs: any = {
    new: { label: { FR: 'Reçue', EN: 'Received' }, color: 'bg-blue-100 text-blue-600 border-blue-200' },
    reviewed: { label: { FR: 'En étude', EN: 'Reviewing' }, color: 'bg-yellow-100 text-yellow-600 border-yellow-200' },
    interview: { label: { FR: 'Entretien', EN: 'Interview' }, color: 'bg-purple-100 text-purple-600 border-purple-200' },
    hired: { label: { FR: 'Retenu', EN: 'Accepted' }, color: 'bg-green-100 text-green-600 border-green-200' },
    rejected: { label: { FR: 'Refusé', EN: 'Rejected' }, color: 'bg-red-100 text-red-600 border-red-200' }
  };

  const config = configs[status] || configs.new;
  const label = config.label[lang === 'AR' ? 'EN' : lang] || config.label.EN;

  return (
    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border italic ${config.color}`}>
      {label}
    </span>
  );
};