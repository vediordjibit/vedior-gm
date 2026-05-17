import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Clock, CheckCircle2, LogOut, Bell, Search,
  LayoutDashboard, FileText, User, AlertCircle, MessageSquare,
  BarChart3, Settings, X, ChevronRight, MoreVertical,
  Users, Briefcase, MapPin, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { auth, db } from '@/lib/firebase';   // <-- MODIFICATION ICI

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

import { 
  collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  signInWithPopup as authSignInWithPopup, GoogleAuthProvider, signOut 
} from 'firebase/auth';

type RecruiterPanelProps = {
  onBack: () => void;
  lang: string;
  setLang: (l: 'FR' | 'EN' | 'AR') => void;
  t: any;
};

type NewNeed = {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  jobTitle: string;
  sector: string;
  profileCount: number;
  description: string;
  needType: 'CDI' | 'CDD' | 'Intérim' | 'Audit';
  urgency: 'low' | 'medium' | 'high';
  skills: string;
  expRequired: number;
  deadline: string;
};

const getChartData = (lang: string) => {
  const months = {
    FR: ['29 Avr', '30 Avr', '1 Mai', '2 Mai', '3 Mai', '4 Mai', '5 Mai'],
    EN: ['Apr 29', 'Apr 30', 'May 1', 'May 2', 'May 3', 'May 4', 'May 5'],
    AR: ['٢٩ أبريل', '٣٠ أبريل', '١ مايو', '٢ مايو', '٣ مايو', '٤ مايو', '٥ مايو']
  };
  const data = [10, 18, 25, 42, 20, 28, 32];
  const currentMonths = (months as any)[lang] || months.EN;
  return currentMonths.map((name: string, i: number) => ({ name, value: data[i] }));
};

const SPARKLINE_DATA_UP = [{ v: 10 }, { v: 15 }, { v: 12 }, { v: 18 }, { v: 25 }, { v: 22 }, { v: 30 }];
const SPARKLINE_DATA_DOWN = [{ v: 30 }, { v: 25 }, { v: 28 }, { v: 20 }, { v: 15 }, { v: 18 }, { v: 12 }];

export default function RecruiterPanel({ onBack, lang, setLang, t }: RecruiterPanelProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [recruiterProfile, setRecruiterProfile] = useState<any>(null);
  const [needs, setNeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const stats = {
    pending: needs.filter(n => n.status === 'new').length,
    processed: needs.filter(n => n.status === 'processed').length,
    total: needs.length,
    rejected: needs.filter(n => n.status === 'rejected').length
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'needs' | 'candidates' | 'stats' | 'messages' | 'settings'>('dashboard');
  const [showAddNeed, setShowAddNeed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newNeed, setNewNeed] = useState<NewNeed>({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    jobTitle: '',
    sector: 'btp',
    profileCount: 1,
    description: '',
    needType: 'CDI',
    urgency: 'medium',
    skills: '',
    expRequired: 3,
    deadline: ''
  });

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        setNewNeed(prev => ({ ...prev, email: u.email || '' }));
        const qRec = query(collection(db, 'recruiters'), where('email', '==', u.email));
        onSnapshot(qRec, (snap) => {
          if (!snap.empty) {
            setRecruiterProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Strictly filter by userId to ensure privacy and avoid permission errors
    // (Shared company view would require more complex rules)
    const q = query(
      collection(db, 'needs'), 
      where('userId', '==', user.uid), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const needsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNeeds(needsData);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Listen Error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await authSignInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  const logout = () => signOut(auth).then(() => onBack());

  // Automatically pre-fill company name if profile exists
  useEffect(() => {
    if (recruiterProfile?.companyName && !showAddNeed) {
      setNewNeed(prev => ({
        ...prev,
        companyName: recruiterProfile.companyName,
        contactName: recruiterProfile.contactName || prev.contactName
      }));
    }
  }, [recruiterProfile, showAddNeed]);

  const handleAddNeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'needs'), {
        ...newNeed,
        userId: user.uid,
        userEmail: user.email,
        status: 'new',
        createdAt: serverTimestamp()
      });
      setShowAddNeed(false);
      setNewNeed({
        companyName: '',
        contactName: '',
        phone: '',
        email: user.email || '',
        jobTitle: '',
        sector: 'btp',
        profileCount: 1,
        description: '',
        needType: 'CDI',
        urgency: 'medium',
        skills: '',
        expRequired: 3,
        deadline: ''
      });
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const dir = lang === 'AR' ? 'rtl' : 'ltr';

  if (!user) {
    return (
      <div className="fixed inset-0 bg-navy z-[200] flex items-center justify-center p-6 overflow-hidden">
        <div className="text-center space-y-8 max-w-md relative z-10">
          <Logo inverted />
          <h1 className="text-4xl font-extrabold text-white leading-tight">{t.admin.recruiterPortal}</h1>
          <p className="text-white/60 font-medium italic">{t.admin.recruiterWelcome}</p>
          <div className="space-y-4">
            <button onClick={login} className="w-full bg-[#F8FAFC] text-navy py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-[#F1F5F9] transition-all shadow-xl">
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="google" referrerPolicy="no-referrer" />
              {t.admin.loginGoogle}
            </button>
            <button onClick={onBack} className="w-full text-white/40 hover:text-white transition-all text-sm font-bold uppercase tracking-widest">{t.admin.backPortal}</button>
          </div>
        </div>
      </div>
    );
  }

  if (recruiterProfile && recruiterProfile.status !== 'active') {
    return (
      <div className="fixed inset-0 bg-navy z-[200] flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-orange/10 border-4 border-orange/20 rounded-[40px] flex items-center justify-center mx-auto text-orange">
            <Shield size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">Compte en attente</h1>
            <p className="text-white/60 font-medium leading-relaxed italic">
              Merci pour votre inscription, <span className="text-orange">{recruiterProfile.companyName}</span>.<br />
              Votre compte est actuellement en cours de validation par nos administrateurs.
            </p>
          </div>
          <div className="p-8 bg-white/5 rounded-[32px] border border-white/10 space-y-4">
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-white/40">
              <span>RC / SIRET</span>
              <span className="text-white">{recruiterProfile.rcNumber || 'En cours...'}</span>
            </div>
            <div className="h-px bg-white/5 w-full" />
            <div className="flex items-center gap-3 text-orange font-black text-[10px] uppercase tracking-[0.2em] justify-center">
              <Clock size={14} /> Validation sous 24/48h
            </div>
          </div>
          <button onClick={logout} className="text-white/40 hover:text-white font-black text-[10px] uppercase tracking-widest transition-all">Se déconnecter</button>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="fixed inset-0 bg-[#F1F5F9] z-[200] flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F172A] text-white flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-10 cursor-pointer" onClick={onBack}>
          <Logo inverted />
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutDashboard} label={t.admin.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={Briefcase} label={t.admin.needs} active={activeTab === 'needs'} onClick={() => setActiveTab('needs')} />
          {/* L'onglet Candidats n'apparaît plus dans la sidebar */}
          <NavItem icon={BarChart3} label={t.admin.detailedStats} active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
          <NavItem icon={MessageSquare} label={t.admin.centralizedMessaging} active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} />
          <NavItem icon={Settings} label={t.admin.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <button onClick={logout} className="mt-auto flex items-center gap-3 px-4 py-3 text-white/50 font-bold text-sm hover:text-white transition-all group">
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" /> {t.admin.logout}
        </button>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-[#F8FAFC] border-b border-gray-100 flex items-center justify-between px-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder={t.admin.searchAll} 
              className="w-full bg-[#F3F4F6] border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange/20 outline-none"
            />
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-gray-400 font-bold text-sm bg-gray-50 px-3 py-1.5 rounded-xl">
              <Clock size={16} /> {new Date().toLocaleDateString(lang === 'AR' ? 'ar-DJ' : lang === 'EN' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <button className="relative w-10 h-10 flex items-center justify-center text-gray-400 hover:text-navy transition-colors">
              <Bell size={22} />
              <div className="absolute top-2 right-2 w-4 h-4 bg-orange text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center">2</div>
            </button>
            <div className="flex items-center gap-3 border-l border-gray-100 pl-6 cursor-pointer group">
              <div className="text-right">
                <p className="text-sm font-black text-navy">{user.displayName || 'Recruteur'}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.admin.proRecruiter}</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                {user.photoURL ? <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-navy bg-orange/10"><User size={20} /></div>}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-10 bg-[#F1F5F9]">
          <div className="max-w-[1440px] mx-auto">
            {activeTab === 'dashboard' ? (
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 xl:col-span-8 space-y-8">
                  <div>
                    <h1 className="text-3xl font-black text-navy mb-1 tracking-tight">{t.admin.hello} {user.displayName?.split(' ')[0] || 'Nasser'} 👋</h1>
                    <p className="text-gray-400 text-sm font-medium">{t.admin.dashboardSummary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard title={t.admin.pendingDemands} value={stats.pending.toString()} change="+0%" color="orange" data={SPARKLINE_DATA_UP} bgColor="bg-orange-50" textColor="text-orange" t={t} />
                    <StatCard title={t.admin.candidatesInProgress} value={stats.processed.toString()} change="+0%" color="blue" data={SPARKLINE_DATA_UP} bgColor="bg-blue-50" textColor="text-blue-500" t={t} />
                    <StatCard title={t.admin.validatedRecruitments} value={stats.total.toString()} change="+0%" color="green" data={SPARKLINE_DATA_UP} bgColor="bg-green-50" textColor="text-green-500" t={t} />
                    <StatCard title={t.admin.rejected} value={stats.rejected.toString()} change="-0%" color="red" data={SPARKLINE_DATA_DOWN} bgColor="bg-red-50" textColor="text-red-500" t={t} />
                  </div>

                  <div className="bg-[#FBFBFE] p-8 rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-lg font-black text-navy tracking-tight">{t.admin.appEvolution}</h3>
                      <select className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-gray-500 outline-none">
                        <option>{t.admin.last7Days}</option>
                        <option>30 {t.admin.last30days}</option>
                      </select>
                    </div>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getChartData(lang)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}} />
                          <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            cursor={{stroke: '#f97316', strokeWidth: 2}}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#f97316" 
                            strokeWidth={4} 
                            dot={{fill: '#f97316', stroke: '#fff', strokeWidth: 3, r: 6}} 
                            activeDot={{r: 8, strokeWidth: 4}} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-[#FBFBFE] p-8 rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-lg font-black text-navy tracking-tight">{t.admin.recentActivity}</h3>
                      <button className="text-orange text-xs font-black uppercase tracking-widest hover:underline" onClick={() => setActiveTab('needs')}>{t.admin.seeAll}</button>
                    </div>
                    <div className="space-y-4">
                      {needs.length > 0 ? (
                        needs.slice(0, 5).map((need) => {
                          const dateObj = need.createdAt?.toDate?.() || new Date();
                          const timeStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <ActivityItem 
                              key={need.id}
                              logo={recruiterProfile?.logo || "https://api.dicebear.com/7.x/initials/svg?seed=" + (need.companyName || 'C')} 
                              company={need.companyName || ''} 
                              role={need.jobTitle || (need.description ? need.description.substring(0, 20) + '...' : '')} 
                              status={need.status === 'new' ? 'New' : 'Ongoing'} 
                              time={timeStr} 
                              t={t} 
                            />
                          );
                        })
                      ) : (
                        <div className="text-center py-10 text-gray-400 font-medium italic">
                          {t.admin.noActivity || 'Aucune activité récente'}
                        </div>
                      )}
                    </div>
                    <button className="w-full mt-8 py-3 text-blue-500 font-bold text-sm flex items-center justify-center gap-2 hover:gap-3 transition-all" onClick={() => setActiveTab('needs')}>
                      {t.admin.seeAllActivities || 'Voir tous les besoins'} <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                <div className="col-span-12 xl:col-span-4 space-y-8">
                  <div className="bg-[#FBFBFE] p-8 rounded-[32px] border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-black text-navy tracking-tight mb-6">{t.admin.quickActions}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <ActionButton icon={Plus} label={t.admin.newDemand} color="blue" onClick={() => setShowAddNeed(true)} />
                      {/* Bouton "Voir mes CV" retiré car les profils arrivent par email */}
                      <ActionButton icon={MessageSquare} label="Support" color="purple" onClick={() => setActiveTab('messages')} />
                      <ActionButton icon={BarChart3} label={t.admin.viewStats} color="orange" onClick={() => setActiveTab('stats')} />
                      <ActionButton icon={Settings} label={t.admin.settings} color="blue" onClick={() => setActiveTab('settings')} />
                    </div>
                  </div>

                  <div className="bg-[#FBFBFE] p-8 rounded-[32px] border border-gray-100 shadow-sm text-center">
                    <div className="w-16 h-16 bg-orange/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange">
                      <Users size={24} />
                    </div>
                    <h4 className="text-lg font-bold text-navy mb-2">Propositions de profils</h4>
                    <p className="text-xs text-gray-500 font-medium italic">
                      Les profils sélectionnés par nos experts vous seront envoyés directement par email. Aucune action n'est nécessaire pour l'instant.
                    </p>
                  </div>
                </div>
              </div>
            ) : activeTab === 'candidates' ? (
              // Page de repli si l'URL pointe encore vers cet onglet
              <div className="flex flex-col items-center justify-center h-full text-center p-10">
                <Users size={48} className="text-gray-300 mb-4" />
                <h2 className="text-2xl font-black text-navy mb-2">Consultation des profils</h2>
                <p className="text-gray-400 max-w-md font-medium italic">
                  Les profils retenus pour vos demandes vous sont communiqués directement par email par l'équipe Vedior GM.
                </p>
                <button onClick={() => setActiveTab('dashboard')} className="mt-6 text-orange font-bold hover:underline">{t.admin.backToDashboard}</button>
              </div>
            ) : activeTab === 'needs' ? (
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-black text-navy mb-1 tracking-tight">{t.admin.recruitmentDemands}</h1>
                    <p className="text-gray-400 text-sm font-medium">{t.admin.manageDemandsDesc || 'Gérez vos postes ouverts et besoins en personnel'}</p>
                  </div>
                  <button onClick={() => setShowAddNeed(true)} className="bg-orange text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-orange/20 hover:scale-105 transition-all flex items-center gap-3">
                    <Plus size={20} /> {t.admin.newDemand}
                  </button>
                </div>

                <div className="space-y-6">
                  {loading ? (
                    <div className="flex items-center justify-center h-64 text-gray-400 font-bold animate-pulse">{t.admin.loadingDemands}</div>
                  ) : needs.length > 0 ? (
                    needs.map((need, i) => (
                      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={need.id} className="bg-[#FBFBFE] p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between hover:border-orange/20 transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-gray-50 rounded-[20px] flex items-center justify-center text-orange border border-gray-100"><Briefcase size={28} /></div>
                          <div>
                            <h4 className="text-xl font-black text-navy">{need.jobTitle || need.companyName}</h4>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><User size={12} /> {need.contactName}</span>
                              <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg">{need.needType}</span>
                              <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><Clock size={12} /> {need.createdAt?.toDate().toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-gray-300">{t.admin.urgencyLabel || 'Urgence'}</p>
                            <p className={`text-xs font-black uppercase ${need.urgency === 'high' ? 'text-red-500' : 'text-orange'}`}>{need.urgency}</p>
                          </div>
                          <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${need.status === 'new' ? 'bg-orange/10 text-orange' : 'bg-green-50 text-green-500'}`}>
                            {need.status === 'new' ? (t.admin.pendingStatus || 'En attente') : (t.admin.processedStatus || 'Traité')}
                          </div>
                          <button className="w-12 h-12 bg-gray-50 flex items-center justify-center rounded-2xl text-gray-400 hover:text-navy transition-all"><MoreVertical size={20} /></button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
                      <AlertCircle className="mx-auto text-gray-300 mb-4" size={48} />
                      <p className="text-xl font-black text-gray-400 uppercase tracking-tight">{t.admin.noDemandsFound}</p>
                      <button onClick={() => setShowAddNeed(true)} className="mt-4 text-orange font-bold hover:underline">{t.admin.createFirstDemand}</button>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'stats' ? (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-black text-navy mb-1 tracking-tight">{t.admin.detailedStats}</h1>
                  <p className="text-gray-400 text-sm font-medium">{t.admin.analysisDesc || 'Analysez l\'efficacité de vos processus RH'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="bg-[#FBFBFE] p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 border border-green-100"><Users size={32} /></div>
                      <p className="text-5xl font-black text-navy mb-2">84%</p>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t.admin.retentionRate}</p>
                   </div>
                   <div className="bg-[#FBFBFE] p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 border border-blue-100"><Clock size={32} /></div>
                      <p className="text-5xl font-black text-navy mb-2">12j</p>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t.admin.avgHiringTime}</p>
                   </div>
                   <div className="bg-[#FBFBFE] p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-orange-50 text-orange rounded-full flex items-center justify-center mb-6 border border-orange-100"><BarChart3 size={32} /></div>
                      <p className="text-5xl font-black text-navy mb-2">45</p>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t.admin.appsPerMonth}</p>
                   </div>
                </div>

                <div className="bg-[#FBFBFE] p-8 rounded-[40px] border border-gray-100 shadow-sm">
                   <h3 className="text-xl font-black text-navy mb-8 tracking-tight">{t.admin.appsBySector}</h3>
                   <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={getChartData(lang)}>
                            <defs>
                               <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}} />
                            <Tooltip 
                              contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                            />
                            <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={5} fillOpacity={1} fill="url(#colorVal)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              </div>
            ) : activeTab === 'messages' ? (
              <div className="h-full flex flex-col space-y-8">
                <div>
                  <h1 className="text-3xl font-black text-navy mb-1 tracking-tight">{t.admin.centralizedMessaging}</h1>
                  <p className="text-gray-400 text-sm font-medium">Messagerie interne avec l’équipe Vedior GM</p>
                </div>
                <div className="bg-[#FBFBFE] rounded-[40px] border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-40">
                    <MessageSquare size={64} className="mb-4 text-gray-300" />
                    <p className="text-lg font-black uppercase text-gray-400 tracking-tight">Contactez votre chargé de recrutement</p>
                    <p className="text-sm text-gray-400 italic mt-2">Cette messagerie vous permet d'échanger directement avec l'équipe dédiée à votre compte.</p>
                  </div>
                  <div className="p-6 border-t border-gray-50 flex gap-4">
                    <input type="text" placeholder="Écrivez votre message..." className="flex-1 bg-[#FBFBFE] border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:border-orange shadow-sm font-bold text-sm" />
                    <button className="bg-orange text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-orange/20 hover:scale-105 active:scale-95 transition-all">
                      <ChevronRight size={24} />
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === 'settings' ? (
              <div className="space-y-8 max-w-4xl mx-auto">
                <div>
                  <h1 className="text-3xl font-black text-navy mb-1 tracking-tight">{t.admin.accountSettings}</h1>
                  <p className="text-gray-400 text-sm font-medium">{t.admin.personalInfoPreferences}</p>
                </div>
                <div className="bg-[#FBFBFE] rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
                   <div className="p-10 border-b border-gray-100 flex items-center gap-8">
                      <div className="relative group">
                         <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-100 overflow-hidden shadow-xl group-hover:opacity-80 transition-all">
                            {user.photoURL ? <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-navy bg-orange/10 text-4xl"><User size={48} /></div>}
                         </div>
                         <button className="absolute bottom-1 right-1 w-10 h-10 bg-orange text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white hover:scale-110 transition-all">
                            <Plus size={18} />
                         </button>
                      </div>
                      <div>
                         <h3 className="text-2xl font-black text-navy">{user.displayName}</h3>
                         <p className="text-gray-400 font-medium mb-4">{user.email}</p>
                         <div className="flex gap-2">
                            <span className="bg-orange/10 text-orange text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-orange/10">{t.admin.certifiedAccount}</span>
                            <span className="bg-blue-50 text-blue-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-50">Admin</span>
                         </div>
                      </div>
                   </div>
                   <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                         <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">{t.admin.fullName}</label>
                            <input type="text" defaultValue={user.displayName || ''} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl outline-none focus:border-orange font-bold text-navy" />
                         </div>
                         <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">{t.admin.emailLabel || 'Adresse Email'}</label>
                            <input type="email" readOnly value={user.email || ''} className="w-full bg-gray-50/50 border border-gray-100 p-4 rounded-2xl outline-none font-bold text-gray-400 cursor-not-allowed" />
                         </div>
                         <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">{t.admin.preferredLanguage}</label>
                            <select className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl outline-none font-bold text-navy" defaultValue={lang} onChange={(e) => setLang(e.target.value as any)}>
                               <option value="FR">Français</option>
                               <option value="EN">English</option>
                               <option value="AR">العربية</option>
                            </select>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                            <h4 className="font-black text-navy uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><Bell size={14} className="text-orange" /> Notifications</h4>
                            <div className="space-y-4">
                               <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-gray-500">{t.admin.newApps}</span>
                                  <div className="w-12 h-6 bg-orange rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-[#FBFBFE] rounded-full" /></div>
                               </div>
                               <div className="flex items-center justify-between opacity-50">
                                  <span className="text-sm font-bold text-gray-500">{t.admin.weeklyEmailAlerts}</span>
                                  <div className="w-12 h-6 bg-gray-200 rounded-full relative"><div className="absolute left-1 top-1 w-4 h-4 bg-[#FBFBFE] rounded-full" /></div>
                               </div>
                            </div>
                         </div>
                         <div className="p-6 bg-red-50 rounded-3xl border border-red-100">
                            <h4 className="font-black text-red-500 uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><Shield size={14} /> {t.admin.security}</h4>
                            <button className="w-full bg-[#FBFBFE] text-red-500 border border-red-100 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm">
                               {t.admin.resetPassword}
                            </button>
                         </div>
                      </div>
                   </div>
                   <div className="px-10 py-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
                      <button className="text-gray-400 font-bold text-sm px-6 py-2" onClick={() => setActiveTab('dashboard')}>{t.admin.cancel}</button>
                      <button className="bg-orange text-white px-10 py-3 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-orange/20 hover:scale-105 active:scale-95 transition-all">{t.admin.saveChanges}</button>
                   </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Modal Add Need - Formulaire complet avec tous les champs du questionnaire */}
      <AnimatePresence>
        {showAddNeed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/90 backdrop-blur-md" onClick={() => setShowAddNeed(false)} />
            <motion.div initial={{ y: 50, scale: 0.9 }} animate={{ y: 0, scale: 1 }} className="bg-[#FBFBFE] rounded-[40px] p-10 w-full max-w-4xl relative z-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-black uppercase text-navy tracking-tight">{t.admin.newDemand}</h3>
                <button onClick={() => setShowAddNeed(false)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors outline-none">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleAddNeed} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">{t.modals.company}</label>
                    <input required type="text" value={newNeed.companyName} onChange={e => setNewNeed({...newNeed, companyName: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none focus:border-orange font-bold text-navy" placeholder="ex: Hôtel Sheraton" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">{t.modals.contactPerson}</label>
                    <input required type="text" value={newNeed.contactName} onChange={e => setNewNeed({...newNeed, contactName: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" placeholder={t.modals.contactPerson} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">{t.modals.phoneLabel}</label>
                    <input required type="tel" value={newNeed.phone} onChange={e => setNewNeed({...newNeed, phone: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" placeholder="+253 XX XX XX XX" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">Email</label>
                    <input type="email" value={newNeed.email} readOnly className="w-full bg-gray-100 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-gray-500 cursor-not-allowed" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">Intitulé du poste</label>
                    <input required type="text" value={newNeed.jobTitle} onChange={e => setNewNeed({...newNeed, jobTitle: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none focus:border-orange font-bold text-navy" placeholder="Ex: Chef de chantier" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">Secteur</label>
                    <select value={newNeed.sector} onChange={e => setNewNeed({...newNeed, sector: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy">
                      <option value="btp">BTP / Construction</option>
                      <option value="logistics">Logistique & Portuaire</option>
                      <option value="hospitality">Hôtellerie & Tourisme</option>
                      <option value="security">Sécurité & Gardiennage</option>
                      <option value="healthcare">Santé & Médical</option>
                      <option value="admin">Administratif & Support</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">Nb profils recherchés</label>
                    <input required type="number" min="1" value={newNeed.profileCount} onChange={e => setNewNeed({...newNeed, profileCount: parseInt(e.target.value) || 1})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">{t.modals.needType}</label>
                    <select value={newNeed.needType} onChange={e => setNewNeed({...newNeed, needType: e.target.value as any})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy">
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="Intérim">Intérim</option>
                      <option value="Audit">Audit / Conseil</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">Expérience requise (années)</label>
                    <input required type="number" min="0" value={newNeed.expRequired} onChange={e => setNewNeed({...newNeed, expRequired: parseInt(e.target.value) || 0})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">Délai souhaité</label>
                    <input type="date" value={newNeed.deadline} onChange={e => setNewNeed({...newNeed, deadline: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">Urgence</label>
                    <select value={newNeed.urgency} onChange={e => setNewNeed({...newNeed, urgency: e.target.value as any})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy">
                      <option value="low">Basse</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">Compétences souhaitées (séparées par des virgules)</label>
                  <input type="text" value={newNeed.skills} onChange={e => setNewNeed({...newNeed, skills: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" placeholder="Ex: CACES, anglais courant" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2 mb-2 block">{t.modals.describeProfile}</label>
                  <textarea rows={4} required value={newNeed.description} onChange={e => setNewNeed({...newNeed, description: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy h-40" placeholder="Description détaillée du poste..." />
                </div>

                <button type="submit" disabled={submitting} className="w-full bg-orange text-white py-5 rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-orange/20 disabled:opacity-50 hover:scale-105 active:scale-95 transition-all">
                  {submitting ? t.common.sending : t.common.send}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Composants internes (inchangés)
function NavItem({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick} 
      className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all group ${active ? 'bg-orange text-white shadow-lg shadow-orange/20' : 'text-gray-400 hover:bg-[#FBFBFE]/5 hover:text-white'}`}
    >
      <Icon size={20} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
      <span className="truncate">{label}</span>
      {badge && (
        <div className="absolute right-4 w-5 h-5 bg-orange text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
          {badge}
        </div>
      )}
    </button>
  );
}

function StatCard({ title, value, change, color, data, bgColor, textColor, t }: { title: string, value: string, change: string, color: string, data: any[], bgColor: string, textColor: string, t: any }) {
  return (
    <div className="bg-[#FBFBFE] p-6 rounded-[24px] shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-black text-navy">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-2xl ${bgColor} flex items-center justify-center ${textColor}`}>
          <FileText size={20} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className={`text-[10px] font-black ${change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
          {change} <span className="text-gray-300 ml-1 italic font-bold">{t.admin.vsLastWeek}</span>
        </p>
        <div className="h-10 w-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <Area type="monotone" dataKey="v" stroke={change.startsWith('+') ? '#22c55e' : '#ef4444'} fill={change.startsWith('+') ? '#dcfce7' : '#fee2e2'} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, color, onClick }: { icon: any, label: string, color: string, onClick?: () => void }) {
  const colors: any = {
    orange: 'bg-orange/10 text-orange border-orange/20',
    blue: 'bg-blue-50 text-blue-500 border-blue-100',
    green: 'bg-green-50 text-green-500 border-green-100',
    purple: 'bg-purple-50 text-purple-500 border-purple-100',
  };
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 rounded-[28px] border ${colors[color]} hover:shadow-lg hover:bg-[#FBFBFE] transition-all space-y-2 group shadow-sm`}
    >
      <div className={`p-2 rounded-xl bg-[#FBFBFE] shadow-sm group-hover:scale-110 transition-transform`}>
        <Icon size={20} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-tight text-center leading-tight">{label}</p>
    </button>
  );
}

interface ActivityItemProps {
  logo: string;
  company: string;
  role: string;
  status: string;
  time: string;
  t: any;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ logo, company, role, status, time, t }) => {
  const statusStyles: any = {
    'Accepted': 'bg-green-500/10 text-green-500 border-green-100',
    'Ongoing': 'bg-blue-500/10 text-blue-500 border-blue-100',
    'New': 'bg-orange-500/10 text-orange-500 border-orange-100',
  };
  const statusLabel = status === 'Accepted' ? t.admin.accepted : status === 'Ongoing' ? t.admin.ongoing : t.admin.newStatus;
  return (
    <div className="flex flex-wrap items-center justify-between p-4 bg-gray-50 rounded-[24px] border border-gray-100 group hover:bg-[#FBFBFE] hover:border-orange/20 hover:shadow-md transition-all gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-[200px]">
        <div className="w-12 h-12 bg-[#FBFBFE] rounded-2xl flex items-center justify-center p-2 shadow-sm border border-gray-100">
          <img src={logo} className="max-w-full max-h-full object-contain" alt={company} referrerPolicy="no-referrer" />
        </div>
        <div>
          <p className="text-sm font-black text-navy">{company}</p>
          <p className="text-xs text-gray-400 font-bold">{role}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 md:gap-8 flex-wrap">
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${statusStyles[status]}`}>
          {statusLabel}
        </span>
        <div className="text-[10px] text-gray-400 font-bold text-center">
          <p className="uppercase tracking-widest">{time.split(' ')[0]}</p>
          <p>{time.split(' ')[1]}</p>
        </div>
        <button className="bg-[#FBFBFE] text-navy border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-navy hover:text-white transition-all shadow-sm">{t.admin.viewDetails || 'Details'}</button>
        <button className="text-gray-300 hover:text-navy transition-colors"><MoreVertical size={18} /></button>
      </div>
    </div>
  );
};