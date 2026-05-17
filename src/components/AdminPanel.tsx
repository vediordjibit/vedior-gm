import React, { useState, useEffect } from 'react';
import { 
  db, auth 
} from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
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

import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Bell, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  LogOut, 
  ChevronLeft,
  Loader2,
  Edit,
  Save,
  Search,
  BarChart3,
  MessageSquare,
  Building2,
  Settings,
  Clock,
  User,
  MoreVertical,
  ChevronRight,
  AlertCircle,
  Shield,
  FileText,
  MapPin,
  X,
  Languages,
  RefreshCw           // <-- ajouté pour le renouvellement des offres
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

type AdminPanelProps = {
  onBack: () => void;
  lang: string;
  setLang: (l: string) => void;
  t: any;   // Ajouté : traductions passées par le parent
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

export default function AdminPanel({ onBack, lang, setLang, t }: AdminPanelProps) {
  const dir = lang === 'AR' ? 'rtl' : 'ltr';
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'applications' | 'recruiters' | 'needs' | 'diagnostics' | 'settings'>('dashboard');
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [needs, setNeeds] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAddJob, setShowAddJob] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [newJob, setNewJob] = useState({ title: '', companyName: '', sector: 'btp', location: 'Djibouti', type: 'CDI', company: '🏢', tags: 'Urgent' });

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

          if (!isAuthorized && u.email === 'nassert93@gmail.com') {
            try {
              await setDoc(adminDocRef, { 
                email: u.email, 
                role: 'owner',
                createdAt: serverTimestamp() 
              });
              isAuthorized = true;
            } catch (createErr) {
              console.error("Admin creation error:", createErr);
              if (u.email === 'nassert93@gmail.com') isAuthorized = true;
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
          if (u.email === 'nassert93@gmail.com') setIsAdmin(true);
          else setIsAdmin(false);
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

    return () => { unsubJobs(); unsubApps(); unsubRecruiters(); unsubNeeds(); unsubDiag(); };
  }, [isAdmin]);

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
      tags: typeof newJob.tags === 'string' ? newJob.tags.split(',').map(t => t.trim()) : newJob.tags,
      updatedAt: serverTimestamp(),
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expiration automatique dans 30 jours (Q35)
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
    setNewJob({ title: '', companyName: '', sector: 'btp', location: 'Djibouti', type: 'CDI', company: '🏢', tags: 'Urgent' });
  };

  const handleEditJob = (job: any) => {
    setEditingJob(job);
    setNewJob({
      title: job.title,
      companyName: job.companyName || '',
      sector: job.sector,
      location: job.location,
      type: job.type,
      company: job.company,
      tags: Array.isArray(job.tags) ? job.tags.join(', ') : job.tags
    });
    setShowAddJob(true);
  };

  const handleDeleteJob = async (id: string) => {
    if (confirm(t.admin.confirmDelete || 'Delete this job?')) {
      await deleteDoc(doc(db, 'jobs', id));
    }
  };

  const updateStatus = async (coll: string, id: string, status: string) => {
    await updateDoc(doc(db, coll, id), { status, updatedAt: serverTimestamp() });
  };

  // Renouveler une offre pour 30 jours supplémentaires (Q35)
  const handleRenewJob = async (jobId: string) => {
    const newExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await updateDoc(doc(db, 'jobs', jobId), { expiresAt: newExp });
  };

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
      <Loader2 className="animate-spin text-orange" size={48} />
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] px-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 opacity-20" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 opacity-20" />
        
        <button onClick={onBack} className="absolute top-8 left-8 text-white/40 hover:text-white flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest"><ChevronLeft size={16} /> {t.admin.back}</button>
        
        <div className="text-center space-y-8 max-w-md relative z-10">
          <Logo inverted />
          <div>
            <h1 className="text-4xl font-black text-white mb-2 leading-tight">{t.admin.adminConsole}</h1>
            <p className="text-white/40 font-medium italic">{t.admin.secureAccess}</p>
          </div>
          
          <button onClick={login} className="w-full bg-[#f8fafc] text-navy py-5 rounded-2xl font-black flex items-center justify-center gap-4 hover:bg-[#F1F5F9] transition-all shadow-xl group">
           <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="google" referrerPolicy="no-referrer" />
           {t.admin.loginGoogle}
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] px-4">
         <div className="text-center space-y-8 max-w-md">
           <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-[32px] flex items-center justify-center mx-auto"><XCircle size={64} /></div>
           <div>
             <h1 className="text-3xl font-black text-white mb-2">{t.admin.unauthorized}</h1>
             <p className="text-white/40 font-medium leading-relaxed">{t.admin.account} <span className="text-white/80 font-bold underline decoration-orange">{user.email}</span> {t.admin.notListed}</p>
           </div>
           <div className="flex flex-col gap-4">
             <button onClick={onBack} className="bg-orange text-white py-4 rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-orange/20">{t.admin.backPortal}</button>
             <button onClick={lgOut} className="text-white/40 hover:text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"><LogOut size={14} /> {t.admin.logout}</button>
           </div>
         </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="fixed inset-0 bg-[#F1F5F9] z-[200] flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0F172A] text-white flex flex-col p-8 overflow-hidden shrink-0">
        <div className="flex items-center gap-4 mb-14 cursor-pointer" onClick={onBack}>
          <Logo inverted />
          <div className="overflow-hidden">
            <span className="text-[10px] text-orange font-black uppercase tracking-[0.2em] block mt-1">{t.admin.adminConsole}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutDashboard} label={t.admin.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={Briefcase} label={t.admin.jobs} active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />
          <NavItem icon={Users} label={t.admin.apps} active={activeTab === 'applications'} onClick={() => setActiveTab('applications')} />
          <NavItem icon={Building2} label={t.admin.recruiters || 'Recruteurs'} active={activeTab === 'recruiters'} onClick={() => setActiveTab('recruiters')} />
          <NavItem icon={Bell} label={t.admin.needs} active={activeTab === 'needs'} onClick={() => setActiveTab('needs')} />
          <NavItem icon={Search} label={t.admin.pitchLeads} active={activeTab === 'diagnostics'} onClick={() => setActiveTab('diagnostics')} />
          <NavItem icon={Settings} label={t.admin.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="mt-auto space-y-6 pt-10 border-t border-white/5">
           <div className="flex items-center gap-4 px-2">
              <div className="w-10 h-10 rounded-full border-2 border-orange/50 overflow-hidden bg-gray-700">
                <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-black truncate">{user.displayName}</p>
                <p className="text-[10px] text-white/40 truncate font-bold uppercase tracking-widest">{t.admin.superAdmin}</p>
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR')} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 text-[10px] font-black uppercase transition-all">{lang}</button>
              <button onClick={lgOut} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-3 rounded-xl border border-red-400/20 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"><LogOut size={12} /> {t.admin.logout}</button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-24 bg-[#F8FAFC] border-b border-gray-100 flex items-center justify-between px-12 shrink-0">
          <div className="relative w-[500px]">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
             <input 
               type="text" 
               placeholder={t.admin.searchAll} 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-[#F3F4F6] border-none rounded-2xl py-4 pl-16 pr-6 text-sm font-bold focus:ring-2 focus:ring-orange/20 outline-none transition-all placeholder:text-gray-400"
             />
          </div>

          <div className="flex items-center gap-8">
             <div className="flex items-center gap-3 bg-gray-50 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-400">
                <Clock size={16} className="text-orange" /> {new Date().toLocaleDateString(lang === 'AR' ? 'ar-DJ' : lang === 'EN' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
             </div>
             <div className="flex items-center gap-4">
                <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-navy hover:bg-gray-50 rounded-2xl transition-all relative">
                   <Bell size={24} />
                   <div className="absolute top-3 right-3 w-4 h-4 bg-orange text-white text-[9px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-lg">5</div>
                </button>
                <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-navy hover:bg-gray-50 rounded-2xl transition-all">
                   <Settings size={24} />
                </button>
             </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-12 bg-[#F1F5F9]">
          <div className="max-w-[1600px] mx-auto">
            {activeTab === 'dashboard' ? (
              <div className="space-y-12">
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="text-4xl font-black text-navy mb-2 tracking-tight">{t.admin.summaryReport}</h1>
                    <p className="text-gray-400 text-sm font-medium">{t.admin.hubManagement}</p>
                  </div>
                  <div className="flex gap-4">
                    <button className="bg-[#FBFBFE] border border-gray-100 px-6 py-3 rounded-2xl font-bold text-navy text-xs shadow-sm hover:shadow-md transition-all uppercase tracking-widest">{t.admin.exportCsv}</button>
                    <button className="bg-navy text-white px-8 py-3 rounded-2xl font-bold text-xs shadow-lg shadow-navy/20 hover:scale-105 transition-all uppercase tracking-widest">{t.admin.summaryReport}</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <StatCard title={t.admin.statsJobs} value={jobs.length.toString()} icon={Briefcase} change="+5%" data={SPARKLINE_DATA} color="blue" onClick={() => setActiveTab('jobs')} t={t} />
                  <StatCard title={t.admin.statsApps} value={applications.length.toString()} icon={Users} change="+12%" data={SPARKLINE_DATA} color="orange" onClick={() => setActiveTab('applications')} t={t} />
                  <StatCard title={t.admin.clientNeeds} value={needs.length.toString()} icon={Bell} change="+8%" data={SPARKLINE_DATA} color="green" onClick={() => setActiveTab('needs')} t={t} />
                  <StatCard title={t.admin.pitchLeads} value={diagnostics.length.toString()} icon={Search} change="+2%" data={SPARKLINE_DATA} color="purple" onClick={() => setActiveTab('diagnostics')} t={t} />
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2 bg-[#FBFBFE] p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-10 font-black text-[120px] text-gray-50 -z-0 pointer-events-none select-none">STATS</div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-center mb-12">
                           <h3 className="text-xl font-black text-navy uppercase tracking-tight">{t.admin.candidateFlow}</h3>
                           <div className="flex gap-2">
                              <span className="w-3 h-3 rounded-full bg-orange" />
                              <span className="text-[10px] font-black uppercase text-gray-400">{t.admin.last7Days}</span>
                           </div>
                        </div>
                        <div className="h-[400px]">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={getChartData(lang)}>
                                 <defs>
                                    <linearGradient id="colorAdmin" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#f97316" stopOpacity={0.15}/>
                                       <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                    </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 700}} dy={15} />
                                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 700}} />
                                 <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px'}} />
                                 <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={6} fillOpacity={1} fill="url(#colorAdmin)" dot={{fill: '#f97316', stroke: '#fff', strokeWidth: 4, r: 8}} activeDot={{r: 10, strokeWidth: 0}} />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                      </div>
                   </div>

                   <div className="bg-[#FBFBFE] p-10 rounded-[40px] border border-gray-100 shadow-sm flex flex-col">
                      <div className="flex justify-between items-center mb-8">
                         <h3 className="text-xl font-black text-navy uppercase tracking-tight">{t.admin.recentActivity}</h3>
                         <button className="text-orange text-xs font-black uppercase tracking-widest hover:underline">{t.admin.seeAll}</button>
                      </div>
                      <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                         {applications.slice(0, 6).map((app, i) => (
                           <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100 group">
                              <div className="w-12 h-12 bg-navy text-white rounded-xl flex items-center justify-center font-black text-sm shadow-lg group-hover:scale-110 transition-transform">{app.fullName[0]}</div>
                              <div className="flex-1">
                                 <p className="text-sm font-black text-navy">{app.fullName}</p>
                                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight truncate">{app.jobTitle}</p>
                              </div>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${app.status === 'new' ? 'bg-orange/10 text-orange' : 'bg-green-50 text-green-500'}`}>
                                 {app.status === 'new' ? <Plus size={14} /> : <CheckCircle size={14} />}
                              </div>
                           </div>
                         ))}
                         {applications.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-300 italic font-bold">{t.admin.noActivity}</div>}
                      </div>
                      <button onClick={() => setActiveTab('applications')} className="w-full mt-8 bg-gray-50 py-4 rounded-2xl text-navy font-black text-xs uppercase tracking-[0.2em] hover:bg-navy hover:text-white transition-all">{t.admin.viewFiles}</button>
                   </div>
                </div>
              </div>
            ) : activeTab === 'jobs' ? (
              <div className="space-y-10">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-4xl font-black text-navy mb-2 tracking-tight">{t.admin.jobCatalog}</h1>
                    <p className="text-gray-400 text-sm font-medium">{t.admin.manageOffers}</p>
                  </div>
                  <button 
                    onClick={() => { setEditingJob(null); setNewJob({ title: '', companyName: '', sector: 'btp', location: 'Djibouti', type: 'CDI', company: '🏢', tags: 'Urgent' }); setShowAddJob(true); }}
                    className="bg-orange text-white px-10 py-5 rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-orange/20 hover:scale-105 transition-all flex items-center gap-4"
                  >
                    <Plus size={24} /> {t.admin.publishJob}
                  </button>
                </div>

                <div className="bg-[#FBFBFE] rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.jobTitlePlace}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.company}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.sector}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.expiresOn}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.status}</th>
                        <th className="px-10 py-6 text-right text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.actions}</th>
                      </table>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredJobs.map(job => (
                        <tr key={job.id} className="hover:bg-gray-50/30 transition-all group">
                          <td className="px-10 py-6">
                             <div className="flex items-center gap-4">
                                <div className="text-3xl grayscale group-hover:grayscale-0 transition-all duration-500">{job.company}</div>
                                <div>
                                   <p className="text-lg font-black text-navy leading-tight">{job.title}</p>
                                   <p className="text-[10px] font-black text-orange uppercase tracking-widest">{job.type} • {job.location}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-6 text-sm font-black text-gray-600">{job.companyName}</td>
                          <td className="px-10 py-6">
                             <span className="text-[10px] font-black uppercase px-3 py-1 bg-navy/5 text-navy border border-navy/10 rounded-lg">{job.sector}</span>
                          </td>
                          <td className="px-10 py-6 text-sm font-bold text-gray-400">
                            {job.expiresAt ? new Date(job.expiresAt.toDate()).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-10 py-6">
                            <button 
                              onClick={() => updateStatus('jobs', job.id, job.status === 'active' ? 'closed' : 'active')}
                              className={`flex items-center gap-2 text-[9px] font-black uppercase px-4 py-1.5 rounded-full border transition-all ${job.status === 'active' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                            >
                               <div className={`w-2 h-2 rounded-full animate-pulse ${job.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                               {job.status === 'active' ? t.admin.online : t.admin.archivedStatus}
                            </button>
                          </td>
                          <td className="px-10 py-6 text-right">
                             <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Bouton Renouveler visible si expiration dans moins de 7 jours */}
                                {job.expiresAt && new Date(job.expiresAt.toDate()) < new Date(Date.now() + 7*24*60*60*1000) && (
                                  <button onClick={() => handleRenewJob(job.id)} className="w-10 h-10 flex items-center justify-center bg-orange text-white rounded-xl shadow-lg hover:scale-110 transition-all" title={t.admin.renew}>
                                    <RefreshCw size={16} />
                                  </button>
                                )}
                                <button onClick={() => handleEditJob(job)} className="w-10 h-10 flex items-center justify-center bg-navy text-white rounded-xl shadow-lg shadow-navy/20 hover:scale-110 transition-all"><Edit size={16} /></button>
                                <button onClick={() => handleDeleteJob(job.id)} className="w-10 h-10 flex items-center justify-center bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 hover:scale-110 transition-all"><Trash2 size={16} /></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredJobs.length === 0 && <div className="p-32 text-center text-gray-200 uppercase font-black tracking-[0.5em] italic">{t.admin.noData}</div>}
                </div>
              </div>
            ) : activeTab === 'applications' ? (
              <div className="space-y-10">
                <div className="flex justify-between items-end">
                   <div>
                      <h1 className="text-4xl font-black text-navy mb-2 tracking-tight">{t.admin.candidatesDb}</h1>
                      <p className="text-gray-400 text-sm font-medium">{t.admin.manageApps}</p>
                   </div>
                   <div className="flex gap-4">
                      <div className="bg-navy/5 px-6 py-3 rounded-2xl flex items-center gap-3">
                         <span className="text-[10px] font-black uppercase text-navy/40">Total:</span>
                         <span className="text-lg font-black text-navy">{applications.length}</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                   {filteredApplications.map((app, i) => (
                     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={app.id} className="bg-[#FBFBFE] p-10 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative flex flex-col md:flex-row gap-10">
                        <div className="flex flex-col items-center gap-6 md:w-64 pt-4">
                          <div className="w-32 h-32 bg-navy text-white rounded-[40px] flex items-center justify-center font-black text-5xl shadow-2xl shadow-navy/20">{app.fullName[0]}</div>
                          <div className="text-center">
                             <p className="text-2xl font-black text-navy mb-1">{app.fullName}</p>
                             <div className="flex flex-col gap-1 items-center">
                                <span className="text-[10px] font-black uppercase bg-orange/10 text-orange px-3 py-1 rounded-full">{app.nationality}</span>
                                <span className="text-[10px] font-black uppercase text-gray-400">{app.education}</span>
                                {app.birthDate && (
                                  <span className="text-[9px] font-bold text-navy/40 uppercase">{new Date(app.birthDate).toLocaleDateString()}</span>
                                )}
                             </div>
                          </div>
                          <div className="w-full h-px bg-gray-100 my-2" />
                          <div className="flex gap-3">
                             <button onClick={() => window.open(`https://wa.me/${app.whatsapp || app.phone}`, '_blank')} className="w-12 h-12 bg-[#25D366] text-white rounded-2xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-green-500/20"><MessageSquare size={20} /></button>
                             <button className="w-12 h-12 bg-navy text-white rounded-2xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-navy/20"><FileText size={20} /></button>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-6">
                              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100/50">
                                 <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">{t.admin.role}</p>
                                 <p className="text-lg font-black text-navy">{app.jobTitle}</p>
                                 <p className="text-xs font-bold text-gray-400 mt-2 flex items-center gap-2"><MapPin size={12} className="text-orange" /> {app.sector}</p>
                              </div>
                              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100/50">
                                 <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Informations Pro & Contact</p>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Expérience</p>
                                       <p className="text-sm font-black text-navy">{app.experience} ans</p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Sexe</p>
                                       <p className="text-sm font-black text-navy">{app.gender === 'F' ? 'Féminin' : 'Masculin'}</p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Langues</p>
                                       <p className="text-[11px] font-black text-navy truncate">{app.languages || 'N/A'}</p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Disponibilité</p>
                                       <p className="text-[11px] font-black text-navy truncate">{app.availability || 'Immédiate'}</p>
                                    </div>
                                    <div className="col-span-2">
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Adresse</p>
                                       <p className="text-xs font-bold text-navy">{app.address || 'Non spécifiée'}</p>
                                    </div>
                                    <div className="col-span-2">
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Téléphone</p>
                                       <p className="text-sm font-black text-orange">{app.phone || 'N/A'}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-6">
                              <div className="bg-orange/5 p-6 rounded-3xl border border-orange/10 relative">
                                 <p className="text-[10px] font-black uppercase text-orange mb-4 tracking-widest">{t.admin.messageHint}</p>
                                 <p className="text-sm font-medium text-navy/70 leading-relaxed italic line-clamp-3">"{app.message || t.admin.noMessage}"</p>
                                 <div className="absolute top-4 right-4"><AlertCircle size={16} className="text-orange opacity-20" /></div>
                              </div>
                              <div className="space-y-4">
                                 <p className="text-[10px] font-black uppercase text-gray-400 px-1 tracking-widest">{t.admin.status}</p>
                                 <select 
                                   value={app.status || 'new'} 
                                   onChange={(e) => updateStatus('applications', app.id, e.target.value)}
                                   className={`w-full bg-[#f8fafc] border py-5 px-8 rounded-3xl outline-none font-black text-xs uppercase tracking-[0.2em] transition-all shadow-sm ${
                                     app.status === 'new' ? 'text-orange border-orange/20' : 
                                     app.status === 'interview' ? 'text-blue-500 border-blue-200' :
                                     app.status === 'hired' ? 'text-green-500 border-green-200' :
                                     'text-gray-400 border-gray-200'
                                   }`}
                                 >
                                   <option value="new">{t.admin.received}</option>
                                   <option value="reviewing">{t.admin.reviewing}</option>
                                   <option value="interview">{t.admin.interview}</option>
                                   <option value="hired">{t.admin.hired}</option>
                                   <option value="rejected">{t.admin.rejected}</option>
                                 </select>
                              </div>
                              {/* NOTES INTERNES (Q29) */}
                              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100/50 mt-4">
                                 <p className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">{t.admin.notesInternes || 'Notes internes'}</p>
                                 <textarea
                                   value={app.notes || ''}
                                   onChange={(e) => {
                                     setApplications(prev => prev.map(a => a.id === app.id ? {...a, notes: e.target.value} : a));
                                   }}
                                   onBlur={() => updateDoc(doc(db, 'applications', app.id), { notes: app.notes })}
                                   placeholder="Notes visibles uniquement par l'équipe..."
                                   className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-medium text-navy outline-none focus:border-orange"
                                   rows={3}
                                 />
                              </div>
                           </div>
                        </div>
                     </motion.div>
                   ))}
                   {filteredApplications.length === 0 && <div className="p-32 text-center text-gray-200 uppercase font-black tracking-[0.5em] italic">{t.admin.noData}</div>}
                </div>
              </div>
            ) : activeTab === 'recruiters' ? (
              <div className="space-y-10">
                <div className="flex justify-between items-end">
                   <div>
                      <h1 className="text-4xl font-black text-navy mb-2 tracking-tight">Validation Recruteurs</h1>
                      <p className="text-gray-400 text-sm font-medium">Validez les comptes entreprises pour activer leur accès</p>
                   </div>
                </div>

                <div className="bg-[#FBFBFE] rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Entreprise</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Contact</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">RC / SIRET</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Secteur</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Status</th>
                        <th className="px-10 py-6 text-right text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRecruiters.map(rec => (
                        <tr key={rec.id} className="hover:bg-gray-50/30 transition-all group">
                          <td className="px-10 py-6">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-navy/5 rounded-2xl flex items-center justify-center text-navy font-black">🏢</div>
                                <div>
                                   <p className="text-lg font-black text-navy leading-tight">{rec.companyName}</p>
                                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{rec.email}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-6 text-sm font-black text-navy">{rec.contactName}</td>
                          <td className="px-10 py-6 text-sm font-bold text-gray-400">{rec.rcNumber || 'N/A'}</td>
                          <td className="px-10 py-6 text-sm font-bold text-gray-400">
                            {t.sectors?.[rec.sector] || rec.sector || 'N/A'}
                          </td>
                          <td className="px-10 py-6">
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${rec.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-orange/10 text-orange'}`}>
                                {rec.status === 'active' ? 'Validé' : 'En attente'}
                             </span>
                          </td>
                          <td className="px-10 py-6 text-right">
                             <div className="flex justify-end gap-3">
                                {rec.status !== 'active' && (
                                  <button onClick={() => updateStatus('recruiters', rec.id, 'active')} className="bg-navy text-white text-[9px] font-black uppercase px-6 py-2.5 rounded-xl hover:bg-orange transition-all tracking-widest flex items-center gap-2">
                                     <CheckCircle size={14} /> Valider
                                  </button>
                                )}
                                <button className="w-10 h-10 flex items-center justify-center bg-gray-50 text-navy rounded-xl hover:bg-navy hover:text-white transition-all"><MoreVertical size={16} /></button>
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
                   <h1 className="text-4xl font-black text-navy mb-2 tracking-tight">{t.admin.clientNeedsTitle}</h1>
                   <p className="text-gray-400 text-sm font-medium">{t.admin.immediateNeeds}</p>
                </div>

                <div className="space-y-6">
                   {filteredNeeds.map((need, i) => (
                     <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={need.id} className="bg-[#FBFBFE] p-8 rounded-[40px] border border-gray-100 shadow-sm hover:border-green-500/20 transition-all group flex flex-wrap items-center justify-between gap-10">
                        <div className="flex items-center gap-8 flex-1 min-w-[400px]">
                            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-[28px] flex items-center justify-center shadow-lg shadow-green-500/10 border border-green-100">
                               <Building2 size={32} />
                            </div>
                            <div className="flex-1">
                               <div className="flex items-center gap-3 mb-1">
                                  <h4 className="text-2xl font-black text-navy leading-none">{need.companyName}</h4>
                                  <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${need.urgency === 'high' ? 'bg-red-500 text-white border-red-500' : 'bg-orange/10 text-orange border-orange/10'}`}>
                                     {need.urgency === 'high' ? t.admin.highPriority : t.admin.mediumUrgency}
                                  </span>
                               </div>
                               <p className="text-sm font-bold text-gray-400 mb-3">{need.contactName} • <span className="text-navy">{need.email}</span> • {need.phone}</p>
                               <div className="flex gap-2">
                                  <span className="text-[10px] font-black uppercase text-white bg-navy px-3 py-1 rounded-lg tracking-widest">{need.needType}</span>
                                  {need.skills && <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">{need.skills}</span>}
                               </div>
                            </div>
                        </div>

                        <div className="max-w-md flex-1 p-6 bg-gray-50/50 rounded-3xl italic text-sm text-gray-500 border border-gray-100 line-clamp-2">
                           "{need.description}"
                        </div>

                        <div className="flex items-center gap-6">
                           <div className="text-center px-4">
                              <p className="text-[10px] font-black uppercase text-gray-300 tracking-wider mb-1">{t.admin.submittedOn}</p>
                              <p className="text-xs font-black text-navy">{need.createdAt?.toDate().toLocaleDateString(lang === 'AR' ? 'ar-DJ' : lang === 'EN' ? 'en-US' : 'fr-FR')}</p>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => updateStatus('needs', need.id, 'processed')} className="w-14 h-14 flex items-center justify-center bg-[#FBFBFE] text-navy border border-gray-100 rounded-2xl shadow-sm hover:bg-navy hover:text-white transition-all"><Edit size={20} /></button>
                              <button onClick={() => updateStatus('needs', need.id, 'closed')} className="w-14 h-14 flex items-center justify-center bg-orange text-white rounded-2xl shadow-lg shadow-orange/20 hover:scale-110 active:scale-95 transition-all"><CheckCircle size={20} /></button>
                           </div>
                        </div>
                     </motion.div>
                   ))}
                </div>
              </div>
            ) : activeTab === 'diagnostics' ? (
              <div className="space-y-10">
                 <div>
                   <h1 className="text-4xl font-black text-navy mb-2 tracking-tight">{t.admin.pitchLeadsTitle}</h1>
                   <p className="text-gray-400 text-sm font-medium">{t.admin.autoDiagnostics}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   {diagnostics.map((diag, i) => (
                     <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} key={diag.id} className="bg-[#F8FAFC] p-10 rounded-[40px] border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all group h-[500px]">
                        <div>
                           <div className="flex justify-between items-start mb-10">
                              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/10 border border-blue-100">
                                 <Search size={32} />
                              </div>
                              <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${diag.urgency === 'high' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                 {diag.urgency === 'high' ? t.admin.callAsap : t.admin.routine}
                              </span>
                           </div>
                           
                           <h4 className="text-2xl font-black text-navy mb-2 font-mono">{diag.sector}</h4>
                           <p className="text-[10px] font-black uppercase text-orange mb-6 bg-orange/5 inline-block px-3 py-1 rounded">{t.admin.pitchLeads}</p>
                           
                           <div className="space-y-6">
                              <div>
                                 <p className="text-[10px] font-black uppercase text-gray-300 tracking-tighter mb-2">{t.admin.painPoint}</p>
                                 <p className="text-sm font-bold text-navy leading-relaxed line-clamp-3 italic">"{diag.painPoint}"</p>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="flex-1 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] font-black uppercase text-gray-300 mb-1">{t.admin.volume}</p>
                                    <p className="text-lg font-black text-navy leading-none">{diag.volume}+ <span className="text-xs font-bold opacity-40 uppercase">{t.admin.jobs}</span></p>
                                 </div>
                                 <div className="flex-1 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] font-black uppercase text-gray-300 mb-1">{t.admin.deadline}</p>
                                    <p className="text-lg font-black text-navy leading-none">{t.admin.immediate}</p>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="pt-8 border-t border-gray-50 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-[10px] font-black">GM</div>
                              <p className="text-xs font-bold text-gray-400">Vedior System</p>
                           </div>
                           <button className="text-orange font-black text-xs uppercase tracking-[0.2em] hover:underline flex items-center gap-2">{t.admin.continue} <ChevronRight size={14} /></button>
                        </div>
                     </motion.div>
                   ))}
                </div>
              </div>
            ) : activeTab === 'settings' ? (
              <div className="space-y-10">
                <div>
                  <h1 className="text-4xl font-black text-navy mb-2 tracking-tight">{t.admin.settings}</h1>
                  <p className="text-gray-400 text-sm font-medium">{t.admin.personalInfoPreferences}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-[#FBFBFE] p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
                    <h3 className="text-xl font-black text-navy uppercase tracking-tight flex items-center gap-3">
                      <Shield className="text-orange" /> {t.admin.security}
                    </h3>
                    <div className="space-y-6">
                      <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                        <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-widest">{t.admin.certifiedAccount}</p>
                        <p className="text-sm font-medium text-blue-900/70">{t.admin.secureAccess}</p>
                      </div>
                      <button className="w-full bg-navy text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-orange transition-all duration-500">
                        {t.admin.resetPassword}
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#FBFBFE] p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
                    <h3 className="text-xl font-black text-navy uppercase tracking-tight flex items-center gap-3">
                      <Languages className="text-orange" /> {t.admin.preferredLanguage}
                    </h3>
                    <div className="flex gap-4">
                      {['FR', 'EN', 'AR'].map(l => (
                        <button 
                          key={l}
                          onClick={() => setLang(l)}
                          className={`flex-1 py-4 rounded-2xl font-black transition-all border ${lang === l ? 'bg-orange text-white border-orange shadow-lg shadow-orange/20' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-[#FBFBFE] p-10 rounded-[40px] border border-gray-100 shadow-sm text-center">
                   <div className="w-20 h-20 bg-orange/10 text-orange rounded-full flex items-center justify-center mx-auto mb-6">
                      <Settings size={40} className="animate-spin-slow" />
                   </div>
                   <h3 className="text-2xl font-black text-navy mb-2 uppercase tracking-tight">{t.admin.controlCenter}</h3>
                   <p className="text-gray-400 max-w-lg mx-auto font-medium">{t.admin.syncing}</p>
                   <div className="mt-8 flex justify-center gap-4">
                      <div className="px-6 py-2 bg-gray-50 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest border border-gray-100">v2.4.0-stable</div>
                      <div className="px-6 py-2 bg-green-50 rounded-xl text-[10px] font-black text-green-500 uppercase tracking-widest border border-green-100">Live & Secure</div>
                   </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddJob && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/95 backdrop-blur-xl" onClick={() => { setShowAddJob(false); setEditingJob(null); }} />
            <motion.div initial={{ y: 50, scale: 0.9 }} animate={{ y: 0, scale: 1 }} className="bg-[#FBFBFE] rounded-[50px] p-12 w-full max-w-2xl relative z-10 shadow-2xl overflow-y-auto max-h-[95vh]">
              <div className="flex justify-between items-center mb-12">
                 <div>
                    <h3 className="text-4xl font-black text-navy tracking-tight">{editingJob ? t.admin.editJobTitle.toUpperCase() : t.admin.publishJob.toUpperCase()}</h3>
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Vedior GM Publishing System</p>
                 </div>
                 <button onClick={() => { setShowAddJob(false); setEditingJob(null); }} className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all outline-none">
                   <X size={32} />
                 </button>
              </div>

              <form onSubmit={handleAddJob} className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                   <div className="col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-widest">{t.admin.formJobTitle}</label>
                     <input type="text" required value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} className="w-full bg-gray-50 p-6 rounded-3xl border border-gray-100 outline-none focus:border-orange font-black text-navy text-xl shadow-inner" placeholder={t.admin.formJobTitleEx} />
                   </div>
                   <div className="col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-widest">{t.admin.formCompanyClient}</label>
                     <input type="text" required value={newJob.companyName} onChange={e => setNewJob({...newJob, companyName: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none focus:border-orange font-bold text-navy" />
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-widest">{t.admin.formSector}</label>
                     <select value={newJob.sector} onChange={e => setNewJob({...newJob, sector: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy appearance-none">
                       <option value="btp">BTP & Génie Civil</option>
                       <option value="logistics">Logistique & Port</option>
                       <option value="hospitality">Hôtellerie & Restauration</option>
                       <option value="security">Sécurité & Gardiennage</option>
                       <option value="healthcare">Santé & Social</option>
                       <option value="admin">Administration & Finance</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-widest">{t.admin.formContract}</label>
                     <input type="text" value={newJob.type} onChange={e => setNewJob({...newJob, type: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" placeholder="CDI, CDD, Intérim..." />
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-widest">{t.admin.formLocation}</label>
                     <input type="text" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" placeholder="Djibouti Ville, Arta..." />
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-widest">{t.admin.formIcon}</label>
                     <input type="text" value={newJob.company} onChange={e => setNewJob({...newJob, company: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-black text-center text-4xl" />
                   </div>
                   <div className="col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-widest">{t.admin.formTags}</label>
                     <input type="text" placeholder={t.admin.formTagsEx} value={newJob.tags} onChange={e => setNewJob({...newJob, tags: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-navy" />
                   </div>
                </div>
                
                <div className="pt-8 flex gap-6">
                   <button type="button" onClick={() => { setShowAddJob(false); setEditingJob(null); }} className="flex-1 py-5 font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition-all">{t.admin.cancel}</button>
                   <button type="submit" className="flex-1 bg-navy text-white py-6 rounded-[28px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-navy/20 hover:bg-orange hover:shadow-orange/30 hover:scale-105 active:scale-95 transition-all outline-none border-none">
                     {editingJob ? t.admin.updateNow : t.admin.publishNow}
                   </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`relative w-full flex items-center gap-4 px-6 py-4 rounded-[20px] font-black text-sm transition-all group ${active ? 'bg-orange text-white shadow-xl shadow-orange/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
    >
      <Icon size={22} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
      <span className="truncate tracking-tight">{label}</span>
      {active && <motion.div layoutId="nav-glow" className="absolute -left-2 w-1 h-6 bg-orange rounded-full blur-[2px]" />}
    </button>
  );
}

function StatCard({ title, value, icon: Icon, change, data, color, onClick, t }: { title: string, value: string, icon: any, change: string, data: any[], color: string, onClick?: () => void, t: any }) {
  const colors: any = {
    blue: 'text-blue-500 bg-blue-50 border-blue-100 shadow-blue-500/10',
    orange: 'text-orange bg-orange/5 border-orange/10 shadow-orange/10',
    green: 'text-green-500 bg-green-50 border-green-100 shadow-green-500/10',
    purple: 'text-purple-500 bg-purple-50 border-purple-100 shadow-purple-500/10',
  };

  return (
    <div onClick={onClick} className="bg-[#FBFBFE] p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group">
       <div className="flex justify-between items-start mb-6">
          <div>
             <p className="text-[11px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2">{title}</p>
             <p className="text-4xl font-black text-navy">{value}</p>
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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <Area type="monotone" dataKey="v" stroke={color === 'orange' ? '#f97316' : color === 'blue' ? '#3b82f6' : '#22c55e'} fill={color === 'orange' ? '#f97316' : color === 'blue' ? '#3b82f6' : '#22c55e'} fillOpacity={0.1} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
}