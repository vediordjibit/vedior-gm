import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Briefcase, Users, Bell, Plus, Trash2, 
  CheckCircle, XCircle, LogOut, ChevronLeft, Loader2, Edit,
  Save, Search, BarChart3, MessageSquare, Building2, Settings,
  Clock, User, MoreVertical, ChevronRight, AlertCircle, Shield,
  FileText, MapPin, X, Languages, RefreshCw, UserPlus, Mail,
  ToggleLeft, ToggleRight, Crown, UserCheck, UserX, KeyRound, Download,
  Lock, Eye, EyeOff, Fingerprint, ShieldCheck, Activity, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { db, auth } from '../lib/firebase';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { useTranslation } from '../lib/i18n';
import MatchingPanel from './MatchingPanel';
import { 
  collection, onSnapshot, query, orderBy, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp, getDocs, getDoc, setDoc, where
} from 'firebase/firestore';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
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

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const { lang, setLang, t, dir } = useTranslation();

  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'applications' | 'recruiters' | 'needs' | 'diagnostics' | 'settings' | 'users'>('dashboard');
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [needs, setNeeds] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [selectedNeed, setSelectedNeed] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [publishingAsOffer, setPublishingAsOffer] = useState(false);
  const [publishedOfferId, setPublishedOfferId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      await addDoc(collection(db, 'propositions'), {
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

      // 4. Create a notification for the recruiter
      if (needDoc?.userId) {
        await addDoc(collection(db, 'notifications'), {
          userId: needDoc.userId,
          type: 'new_proposition',
          title: 'Nouveau profil proposé',
          message: `Un profil a été sélectionné pour votre demande "${needDoc?.jobTitle || needDoc?.title || 'N/A'}"`,
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
    availability: 'immediate', gender: 'M', candidateSector: 'btp', address: '', languages: '',
  });
  const [userSaving, setUserSaving] = useState(false);
  const [showScanCV, setShowScanCV] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState('');
  const [scanProgress, setScanProgress] = useState('');
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    tempId: string; tempPassword: string; email: string; role: string; displayName: string; emailSent?: boolean;
  } | null>(null);
  const [credentialsCopied, setCredentialsCopied] = useState(false);
  
  const [showAddJob, setShowAddJob] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [newJob, setNewJob] = useState({ title: '', companyName: '', sector: 'btp', location: 'Djibouti', type: 'CDI', company: '🏢', tags: 'Urgent' });

  // ── Options dynamiques depuis Firestore ──
  const [dynSectors, setDynSectors] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynContracts, setDynContracts] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynEducations, setDynEducations] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynAvailabilities, setDynAvailabilities] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynUrgencies, setDynUrgencies] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynSalaries, setDynSalaries] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynNationalities, setDynNationalities] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynLanguages, setDynLanguages] = useState<{id:string; value:string; label:string}[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  // Formulaire ajout d'option dans Settings
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, {value:string; label:string; _minRaw?:string; _maxRaw?:string}>>({});
  const [editingOption, setEditingOption] = useState<{colKey: string; id: string; label: string; value: string} | null>(null);

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

    return () => { unsubJobs(); unsubApps(); unsubRecruiters(); unsubNeeds(); unsubDiag(); unsubUsers(); };
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
        ],
        settings_contracts: [
          { value: 'CDI', label: 'CDI', order: 1 },
          { value: 'CDD', label: 'CDD', order: 2 },
          { value: 'Intérim', label: 'Intérim', order: 3 },
          { value: 'Audit', label: 'Audit / Conseil', order: 4 },
        ],
        settings_educations: [
          { value: 'Sans diplôme', label: 'Sans diplôme', order: 1 },
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
    return () => unsubs.forEach(u => u());
  }, []);

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

  const updateStatus = async (coll: string, id: string, status: string, extraData?: any) => {
    await updateDoc(doc(db, coll, id), { status, updatedAt: serverTimestamp(), ...extraData });
  };

  const handleValidateNeed = async (need: any) => {
    await updateDoc(doc(db, 'needs', need.id), {
      status: 'processed',
      validatedAt: serverTimestamp(),
      validatedBy: user?.email || 'admin',
    });
    setSelectedNeed(null);
  };

  const handleRejectNeed = async (need: any) => {
    if (!confirm('Refuser cette demande ?')) return;
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
        status: 'processed',
        validatedAt: serverTimestamp(),
        validatedBy: user?.email || 'admin',
        publishedAsOffer: true,
        offerId: offerRef.id,
      });

      setPublishedOfferId(offerRef.id);
      setSelectedNeed((prev: any) => prev ? { ...prev, status: 'processed', publishedAsOffer: true, offerId: offerRef.id } : null);
    } catch (err) {
      console.error('Erreur publication offre:', err);
      alert('Erreur lors de la publication');
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

      console.log('Recruteur validé avec succès !');
    } catch (err) {
      console.error('Validation error:', err);
    }
  };

  // Reject recruiter
  const handleRejectRecruiter = async (rec: any) => {
    if (!confirm('Refuser ce recruteur ?')) return;
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

  const handleScanCV = async (file: File) => {
    setScanLoading(true);
    setScanError('');
    setScanResult(null);
    setScanProgress('Lecture du fichier...');

    try {
      const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      let fileText = '';

      setScanProgress('Extraction du texte...');

      if (isPDF) {
        // ── Extract text from PDF using pdf.js (CDN) ──────────────
        fileText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              // Load pdf.js from CDN dynamically
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
                const content = await page.getTextContent();
                fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
              }
              resolve(fullText.slice(0, 8000));
            } catch (e) {
              reject(e);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
      } else {
        // ── Image or text file — read as text directly ────────────
        fileText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const text = reader.result as string;
            const readable = text.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ').replace(/\s+/g, ' ').slice(0, 8000);
            resolve(readable);
          };
          reader.onerror = reject;
          reader.readAsText(file, 'utf-8');
        });
      }

      if (!fileText.trim() || fileText.trim().length < 20) {
        throw new Error('Impossible de lire le contenu du fichier. Essayez un PDF avec texte sélectionnable (pas scanné).');
      }

      setScanProgress('Analyse par Groq IA...');

      const prompt = `Voici le contenu texte extrait d'un CV. Analyse-le et extrais les informations du candidat.

Contenu CV :
${fileText.slice(0, 5000)}

Réponds UNIQUEMENT avec un objet JSON valide (pas de texte avant ou après) avec ces champs exacts :
{
  "fullName": "prénom et nom complet ou null",
  "email": "adresse@email.com ou null",
  "phone": "numéro de téléphone ou null",
  "whatsapp": "numéro whatsapp si différent ou null",
  "nationality": "nationalité ex: Djiboutienne ou null",
  "education": "dernier diplôme obtenu ou null",
  "experience": "nombre d'années d'expérience (chiffre seul) ou 0",
  "languages": "langues parlées séparées par virgule ou null",
  "sector": "un seul parmi: btp, logistics, hospitality, healthcare, admin, commerce, security ou null",
  "address": "adresse ou ville ou null",
  "jobTitle": "poste actuel ou recherché ou null",
  "skills": "compétences clés séparées par virgule ou null"
}`;

      const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || (window as any).__GROQ_KEY__;
      if (!groqKey) throw new Error('Clé NEXT_PUBLIC_GROQ_API_KEY manquante — rebuilder le projet après ajout dans .env.production');

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Erreur API Groq');
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '';
      // Extract JSON even if wrapped in markdown
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Réponse IA invalide — réessayez');
      const extracted = JSON.parse(jsonMatch[0]);

      setScanResult(extracted);
      setScanProgress('');

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
        sector: extracted.sector || 'btp',
        fullName: extracted.fullName || '',
        whatsapp: extracted.whatsapp || '',
        nationality: extracted.nationality || '',
        education: extracted.education || '',
        experience: extracted.experience || '',
        availability: 'immediate',
        gender: 'M',
        candidateSector: extracted.sector || 'btp',
        address: extracted.address || '',
        languages: extracted.languages || '',
      });

      // Open create account modal with pre-filled data
      setShowScanCV(false);
      setShowAddUser(true);

    } catch (err: any) {
      setScanError(err.message || 'Erreur lors du scan');
      setScanProgress('');
    } finally {
      setScanLoading(false);
    }
  };

  // ── Formate un montant en DJF avec espaces : 71000 → "71 000"
  const formatSalaryNum = (n: string): string => {
    const digits = n.replace(/\D/g, '');
    if (!digits) return n;
    return parseInt(digits, 10).toLocaleString('fr-FR').replace(/,/g, ' ');
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

      // Envoyer un email "Définissez votre mot de passe" à TOUS les nouveaux utilisateurs.
      // L'utilisateur recevra un lien Firebase pour choisir son propre mot de passe
      // et accéder à son compte — il n'a jamais besoin de connaître le mot de passe temporaire.
      await sendPasswordResetEmail(secondaryAuth, newUser.email);

      // Déconnecter immédiatement l'instance secondaire — l'admin n'est pas affecté
      await signOut(secondaryAuth);

      // ── 2. Générer l'ID VGM (recruteurs & candidats uniquement)
      const tempId = newUser.role !== 'admin' ? await generateTempId() : '';

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
        const candData = {
          ...baseData,
          fullName: newUser.fullName || '',
          whatsapp: newUser.whatsapp || '',
          nationality: newUser.nationality || '',
          education: newUser.education || '',
          experience: newUser.experience || '',
          availability: newUser.availability || 'immediate',
          gender: newUser.gender || 'M',
          sector: newUser.candidateSector || 'btp',
          address: newUser.address || '',
          languages: newUser.languages || '',
          jobTitle: '',
        };
        await addDoc(collection(db, 'users'), candData);
      }

      // ── 4. Envoyer l'email de bienvenue via Resend ──────────────
      try {
        if (newUser.role === 'recruiter') {
          // Email recruteur : lien reset mot de passe
          await fetch('/api/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'recruiter',
              companyName: newUser.companyName || '',
              contactName: newUser.contactName || newUser.email,
              email: newUser.email,
              resetLink: `https://vediorgm.web.app`, // Firebase reset link already sent via sendPasswordResetEmail
            }),
          });
        } else if (newUser.role === 'candidate') {
          // Email candidat : ID VGM + mot de passe temporaire
          await fetch('/api/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'candidate',
              fullName: newUser.fullName || newUser.email,
              email: newUser.email,
              vgmId: tempId,
              tempPassword: tempPassword,
            }),
          });
        }
      } catch (emailErr) {
        console.warn('Email sending failed (non-blocking):', emailErr);
      }

      // ── 5. Afficher les identifiants à l'admin ──────────────────
      setGeneratedCredentials({
        tempId,
        tempPassword,
        email: newUser.email,
        role: newUser.role,
        displayName: displayName || newUser.email,
        emailSent: true,
      });

      // Réinitialisation du formulaire
      setNewUser({
        role: 'candidate', email: '', password: '', phone: '',
        displayName: '', adminLevel: 'admin',
        companyName: '', contactName: '', rcNumber: '', website: '', sector: 'btp',
        fullName: '', whatsapp: '', nationality: '', education: '', experience: '',
        availability: 'immediate', gender: 'M', candidateSector: 'btp', address: '', languages: '',
      });
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
      <div style={{ position: 'fixed', inset: 0, background: B, zIndex: 200, overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Fine grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(59,130,246,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.035) 1px, transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none' }} />

        {/* Diagonal accent lines (centre-right of page) */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.08 }} preserveAspectRatio="none">
          <line x1="55%" y1="0%" x2="85%" y2="100%" stroke={A} strokeWidth="1" />
          <line x1="62%" y1="0%" x2="92%" y2="100%" stroke={A} strokeWidth="0.7" />
          <line x1="70%" y1="0%" x2="100%" y2="100%" stroke={A} strokeWidth="0.5" />
        </svg>

        {/* Glowing blobs */}
        <div style={{ position: 'absolute', top: '-18%', left: '-6%', width: 720, height: 720, background: 'radial-gradient(circle, rgba(59,130,246,0.11), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-6%', width: 580, height: 580, background: 'radial-gradient(circle, rgba(249,115,22,0.08), transparent 60%)', pointerEvents: 'none' }} />

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
        <div style={{ position: 'relative', zIndex: 1, height: '100vh', display: 'grid', gridTemplateColumns: '1.15fr 1fr' }}>

          {/* ══ LEFT PANEL ══ */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 72px 64px 80px' }}>

            {/* Logo + underline */}
            <div style={{ marginBottom: 44 }}>
              <Logo inverted size="lg" />
              <div style={{ width: 52, height: 3, background: `linear-gradient(90deg, ${A}, transparent)`, borderRadius: 2, marginTop: 12 }} />
            </div>

            {/* Badge — blue border + lock */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 100, padding: '7px 18px', marginBottom: 24, alignSelf: 'flex-start' }}>
              <Lock size={12} color={A} />
              <span style={{ fontSize: 11, fontWeight: 800, color: A, textTransform: 'uppercase', letterSpacing: '1.6px' }}>Accès Administrateur</span>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 56, fontWeight: 900, color: W, lineHeight: 1.05, letterSpacing: '-2.5px', marginBottom: 18, margin: '0 0 18px' }}>
              Console de<br />
              <span style={{ color: A }}>Gestion Centrale</span>
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.85, maxWidth: 370, margin: '0 0 40px' }}>
              Supervision complète de la plateforme Vedior GM.<br />
              {lang==='AR' ? 'إدارة المستخدمين والعروض والإحصاءات في الوقت الفعلي.' : lang==='EN' ? 'Manage users, offers and statistics in real time.' : 'Gestion des utilisateurs, des offres et des statistiques en temps réel.'}
            </p>

            {/* Security features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
              {[
                { icon: ShieldCheck, label: 'Authentification Google sécurisée',          color: '#22C55E' },
                { icon: Fingerprint,  label: 'Accès réservé aux administrateurs vérifiés', color: A },
                { icon: Activity,     label: 'Journalisation complète des actions admin',   color: R },
                { icon: Zap,          label: 'Données synchronisées en temps réel',         color: '#A78BFA' },
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
                { icon: Activity, val: '99.9%', label: 'DISPONIBILITÉ', color: A,          bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.18)' },
                { icon: Zap,      val: '<100ms', label: 'LATENCE',       color: '#22C55E', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.16)' },
                { icon: Lock,     val: 'AES-256',label: 'CHIFFREMENT',   color: '#A78BFA', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.16)' },
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
              © 2026 Vedior GM — Plateforme RH de référence à Djibouti
            </div>
          </div>

          {/* ══ RIGHT PANEL — LOGIN CARD ══ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 52px 40px 32px' }}>
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

              {/* Google button */}
              <button
                onClick={login}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  background: W, color: '#0a1628', border: 'none', borderRadius: 14,
                  padding: '17px 24px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 6px 28px rgba(0,0,0,0.45)', transition: 'all 0.18s', letterSpacing: '-0.2px',
                  marginBottom: 20,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(0,0,0,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.45)'; }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t.admin.loginGoogle}
              </button>

              {/* Security notice — two-tone text like the screenshot */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Lock size={14} color={A} />
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', lineHeight: 1.6, margin: '0 0 3px' }}>
                    Connexion réservée aux administrateurs autorisés.
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 1.6, margin: 0, fontWeight: 700 }}>
                    Toute tentative non autorisée est enregistrée et signalée.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <p style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: 'rgba(255,255,255,0.18)', margin: '28px 0 0' }}>
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

  return (
    <div dir={dir} className="fixed inset-0 bg-gray-50 z-[200] flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-900 text-white flex flex-col p-8 overflow-hidden shrink-0">
        <div className="flex items-center gap-4 mb-14 cursor-pointer" onClick={onBack}>
          <Logo inverted />
          <div className="overflow-hidden">
            <span className="text-[10px] text-gray-900 font-black uppercase tracking-[0.2em] block mt-1">{t.admin.adminConsole}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutDashboard} label={t.admin.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={Briefcase} label={t.admin.jobs} active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />
          <NavItem icon={Users} label={t.admin.apps} active={activeTab === 'applications'} onClick={() => setActiveTab('applications')} />
          <NavItem icon={Building2} label={`${t.admin.recruiters || 'Recruteurs'}${recruiters.filter(r => r.status === 'pending').length > 0 ? ` (${recruiters.filter(r => r.status === 'pending').length})` : ''}`} active={activeTab === 'recruiters'} onClick={() => setActiveTab('recruiters')} />
          <NavItem icon={Bell} label={t.admin.needs} active={activeTab === 'needs'} onClick={() => setActiveTab('needs')} />
          <NavItem icon={Search} label={t.admin.pitchLeads} active={activeTab === 'diagnostics'} onClick={() => setActiveTab('diagnostics')} />
          <NavItem icon={UserPlus} label={t.admin.userManagement || 'Utilisateurs'} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <NavItem icon={Settings} label={t.admin.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="mt-auto space-y-6 pt-10 border-t border-white/5">
           <div className="flex items-center gap-4 px-2">
              <div className="w-10 h-10 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-700">
                <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-black truncate">{user.displayName}</p>
                <p className="text-[10px] text-white/40 truncate font-bold uppercase tracking-normal">{t.admin.superAdmin}</p>
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR' as any)} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 text-[10px] font-black uppercase transition-all">{lang}</button>
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
             <div className="flex items-center gap-3 bg-gray-50 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-normal text-gray-400">
                <Clock size={16} className="text-gray-900" /> {typeof window !== 'undefined' ? new Date().toLocaleDateString(lang === 'AR' ? 'ar-DJ' : lang === 'EN' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
             </div>
             <div className="flex items-center gap-4">
                <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all relative">
                   <Bell size={24} />
                   <div className="absolute top-3 right-3 w-4 h-4 bg-gray-900 text-white text-[9px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-lg">5</div>
                </button>
                <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all">
                   <Settings size={24} />
                </button>
             </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-12 bg-gray-50">
          <div className="max-w-[1600px] mx-auto">
            {activeTab === 'dashboard' ? (
              <div className="space-y-12">
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t.admin.summaryReport}</h1>
                    <p className="text-gray-400 text-sm font-medium">{t.admin.hubManagement}</p>
                  </div>
                  <div className="flex gap-4">
                    <button className="bg-white border border-gray-100 px-6 py-3 rounded-2xl font-bold text-gray-900 text-xs shadow-sm hover:shadow-md transition-all uppercase tracking-normal">{t.admin.exportCsv}</button>
                    <button className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-bold text-xs shadow-lg shadow-gray-200/20 hover:scale-105 transition-all uppercase tracking-normal">{t.admin.summaryReport}</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <StatCard title={t.admin.statsJobs} value={jobs.length.toString()} icon={Briefcase} change="+5%" data={SPARKLINE_DATA} color="blue" onClick={() => setActiveTab('jobs')} t={t} />
                  <StatCard title={t.admin.statsApps} value={applications.length.toString()} icon={Users} change="+12%" data={SPARKLINE_DATA} color="orange" onClick={() => setActiveTab('applications')} t={t} />
                  <StatCard title={t.admin.clientNeeds} value={needs.length.toString()} icon={Bell} change="+8%" data={SPARKLINE_DATA} color="green" onClick={() => setActiveTab('needs')} t={t} />
                  <StatCard title={t.admin.pitchLeads} value={diagnostics.length.toString()} icon={Search} change="+2%" data={SPARKLINE_DATA} color="purple" onClick={() => setActiveTab('diagnostics')} t={t} />
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2 bg-white p-10 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-10 font-black text-[120px] text-gray-50 -z-0 pointer-events-none select-none">STATS</div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-center mb-12">
                           <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{t.admin.candidateFlow}</h3>
                           <div className="flex gap-2">
                              <span className="w-3 h-3 rounded-full bg-gray-900" />
                              <span className="text-[10px] font-black uppercase text-gray-400">{t.admin.last7Days}</span>
                           </div>
                        </div>
                        <div className="h-[400px]">
                           <ResponsiveContainer width="100%" height={400}>
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

                   <div className="bg-white p-10 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                      <div className="flex justify-between items-center mb-8">
                         <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{t.admin.recentActivity}</h3>
                         <button className="text-gray-900 text-xs font-black uppercase tracking-normal hover:underline">{t.admin.seeAll}</button>
                      </div>
                      <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                         {applications.slice(0, 6).map((app, i) => (
                           <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100 group">
                              <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-lg group-hover:scale-110 transition-transform">{app.fullName[0]}</div>
                              <div className="flex-1">
                                 <p className="text-sm font-black text-gray-900">{app.fullName}</p>
                                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight truncate">{app.jobTitle}</p>
                              </div>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${app.status === 'new' ? 'bg-gray-100 text-gray-900' : 'bg-green-50 text-green-500'}`}>
                                 {app.status === 'new' ? <Plus size={14} /> : <CheckCircle size={14} />}
                              </div>
                           </div>
                         ))}
                         {applications.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-300 italic font-bold">{t.admin.noActivity}</div>}
                      </div>
                      <button onClick={() => setActiveTab('applications')} className="w-full mt-8 bg-gray-50 py-4 rounded-2xl text-gray-900 font-black text-xs uppercase tracking-[0.2em] hover:bg-gray-900 hover:text-white transition-all">{t.admin.viewFiles}</button>
                   </div>
                </div>
              </div>
            ) : activeTab === 'jobs' ? (
              <div className="space-y-10">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t.admin.jobCatalog}</h1>
                    <p className="text-gray-400 text-sm font-medium">{t.admin.manageOffers}</p>
                  </div>
                  <button 
                    onClick={() => { setEditingJob(null); setNewJob({ title: '', companyName: '', sector: 'btp', location: 'Djibouti', type: 'CDI', company: '🏢', tags: 'Urgent' }); setShowAddJob(true); }}
                    className="bg-gray-900 text-white px-10 py-5 rounded-lg font-black uppercase tracking-normal shadow-sm shadow-gray-200/20 hover:scale-105 transition-all flex items-center gap-4"
                  >
                    <Plus size={24} /> {t.admin.publishJob}
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.jobTitlePlace}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.company}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.sector}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.expiresOn}</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.status}</th>
                        <th className="px-10 py-6 text-right text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{t.admin.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredJobs.map(job => (
                        <tr key={job.id} className="hover:bg-gray-50/30 transition-all group">
                          <td className="px-10 py-6">
                             <div className="flex items-center gap-4">
                                <div className="text-3xl grayscale group-hover:grayscale-0 transition-all duration-500">{job.company}</div>
                                <div>
                                   <p className="text-lg font-black text-gray-900 leading-tight">{job.title}</p>
                                   <p className="text-[10px] font-black text-gray-900 uppercase tracking-normal">{job.type} • {job.location}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-6 text-sm font-black text-gray-600">{job.companyName}</td>
                          <td className="px-10 py-6">
                             <span className="text-[10px] font-black uppercase px-3 py-1 bg-gray-100 text-gray-900 border border-gray-200 rounded-lg">{job.sector}</span>
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
                                  <button onClick={() => handleRenewJob(job.id)} className="w-10 h-10 flex items-center justify-center bg-gray-900 text-white rounded-xl shadow-lg hover:scale-110 transition-all" title={t.admin.renew}>
                                    <RefreshCw size={16} />
                                  </button>
                                )}
                                <button onClick={() => handleEditJob(job)} className="w-10 h-10 flex items-center justify-center bg-gray-900 text-white rounded-xl shadow-lg shadow-gray-200/20 hover:scale-110 transition-all"><Edit size={16} /></button>
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
                      <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t.admin.candidatesDb}</h1>
                      <p className="text-gray-400 text-sm font-medium">{t.admin.manageApps}</p>
                   </div>
                   <div className="flex gap-4">
                      <div className="bg-gray-100 px-6 py-3 rounded-2xl flex items-center gap-3">
                         <span className="text-[10px] font-black uppercase text-gray-400">Total:</span>
                         <span className="text-lg font-black text-gray-900">{applications.length}</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                   {filteredApplications.map((app, i) => (
                     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={app.id} className="bg-white p-10 rounded-xl border border-gray-100 shadow-sm hover:shadow-sm transition-all group overflow-hidden relative flex flex-col md:flex-row gap-10">
                        <div className="flex flex-col items-center gap-6 md:w-64 pt-4">
                          <div className="w-32 h-32 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black text-5xl shadow-sm shadow-gray-200/20">{app.fullName[0]}</div>
                          <div className="text-center">
                             <p className="text-2xl font-black text-gray-900 mb-1">{app.fullName}</p>
                             <div className="flex flex-col gap-1 items-center">
                                <span className="text-[10px] font-black uppercase bg-gray-100 text-gray-900 px-3 py-1 rounded-full">{app.nationality}</span>
                                <span className="text-[10px] font-black uppercase text-gray-400">{app.education}</span>
                                {app.birthDate && (
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(app.birthDate).toLocaleDateString()}</span>
                                )}
                             </div>
                          </div>
                          <div className="w-full h-px bg-gray-100 my-2" />
                          <div className="flex gap-3">
                             <button onClick={() => window.open(`https://wa.me/${app.whatsapp || app.phone}`, '_blank')} className="w-12 h-12 bg-[#25D366] text-white rounded-2xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-green-500/20"><MessageSquare size={20} /></button>
                             <button className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-gray-200/20"><FileText size={20} /></button>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-6">
                              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100/50">
                                 <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-normal">{t.admin.role}</p>
                                 <p className="text-lg font-black text-gray-900">{app.jobTitle}</p>
                                 <p className="text-xs font-bold text-gray-400 mt-2 flex items-center gap-2"><MapPin size={12} className="text-gray-900" /> {app.sector}</p>
                              </div>
                              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100/50">
                                 <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-normal">Informations Pro & Contact</p>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Expérience</p>
                                       <p className="text-sm font-black text-gray-900">{app.experience} ans</p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Sexe</p>
                                       <p className="text-sm font-black text-gray-900">{app.gender === 'F' ? 'Féminin' : 'Masculin'}</p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Langues</p>
                                       <p className="text-[11px] font-black text-gray-900 truncate">{app.languages || 'N/A'}</p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Disponibilité</p>
                                       <p className="text-[11px] font-black text-gray-900 truncate">{app.availability || 'Immédiate'}</p>
                                    </div>
                                    <div className="col-span-2">
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Adresse</p>
                                       <p className="text-xs font-bold text-gray-900">{app.address || 'Non spécifiée'}</p>
                                    </div>
                                    <div className="col-span-2">
                                       <p className="text-[9px] font-black text-gray-300 uppercase">Téléphone</p>
                                       <p className="text-sm font-black text-gray-900">{app.phone || 'N/A'}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-6">
                              <div className="bg-gray-100 p-6 rounded-3xl border border-gray-200 relative">
                                 <p className="text-[10px] font-black uppercase text-gray-900 mb-4 tracking-normal">{t.admin.messageHint}</p>
                                 <p className="text-sm font-medium text-gray-400 leading-relaxed italic line-clamp-3">"{app.message || t.admin.noMessage}"</p>
                                 <div className="absolute top-4 right-4"><AlertCircle size={16} className="text-gray-900 opacity-20" /></div>
                              </div>
                              <div className="space-y-4">
                                 <p className="text-[10px] font-black uppercase text-gray-400 px-1 tracking-normal">{t.admin.status}</p>
                                 <select 
                                   value={app.status || 'new'} 
                                   onChange={(e) => updateStatus('applications', app.id, e.target.value)}
                                   className={`w-full bg-[#f8fafc] border py-5 px-8 rounded-3xl outline-none font-black text-xs uppercase tracking-[0.2em] transition-all shadow-sm ${
                                     app.status === 'new' ? 'text-gray-900 border-gray-200' : 
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
                                 <p className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-normal">{t.admin.notesInternes || 'Notes internes'}</p>
                                 <textarea
                                   value={app.notes || ''}
                                   onChange={(e) => {
                                     setApplications(prev => prev.map(a => a.id === app.id ? {...a, notes: e.target.value} : a));
                                   }}
                                   onBlur={() => updateDoc(doc(db, 'applications', app.id), { notes: app.notes ?? '' })}
                                   placeholder="Notes visibles uniquement par l'équipe..."
                                   className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-medium text-gray-900 outline-none focus:border-gray-300"
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
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${need.status === 'processed' ? 'bg-green-50 text-green-500' : need.status === 'rejected' ? 'bg-red-50 text-red-400' : 'bg-blue-50 text-blue-500'}`}>
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
                               {need.urgency === 'high' ? t.admin.highPriority : need.urgency === 'medium' ? t.admin.mediumUrgency : '🟢 Basse'}
                             </span>
                             {need.status === 'processed' && need.publishedAsOffer
                               ? <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1"><Briefcase size={8} /> Publié</span>
                               : need.status === 'processed'
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
                           "{need.description || 'Aucune description'}"
                         </div>

                         {/* Date + Actions */}
                         <div className="flex items-center gap-4 shrink-0">
                           <div className="text-center">
                             <p className="text-[9px] font-black uppercase text-gray-300 tracking-wider mb-0.5">{t.admin.submittedOn}</p>
                             <p className="text-xs font-black text-gray-700">{need.createdAt?.toDate().toLocaleDateString('fr-FR')}</p>
                           </div>
                           <div className="flex gap-2">
                             <button
                               onClick={e => { e.stopPropagation(); setSelectedNeed(need); }}
                               className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                               title="Voir les détails"
                             ><Eye size={16} /></button>
                             <button
                               onClick={e => { e.stopPropagation(); if (!need.publishedAsOffer) handleValidateNeed(need); }}
                               className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${need.status === 'processed' ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-green-600'}`}
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
                       <p className="text-sm font-black uppercase tracking-widest text-gray-300">Aucune demande</p>
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
                      {t.admin.userManagement || 'Gestion des Utilisateurs'}
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
                      <FileText size={20} /> 📄 Scanner un CV
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
                    { role: 'admin', label: 'Administrateurs', icon: Crown, iconBg: 'bg-purple-100 text-gray-700', numColor: 'text-gray-700',
                      count: users.filter(u => u.role === 'admin').length },
                    { role: 'recruiter', label: 'Recruteurs', icon: UserCheck, iconBg: 'bg-blue-100 text-blue-700', numColor: 'text-blue-700',
                      count: Math.max(users.filter(u => u.role === 'recruiter').length, recruiters.length) },
                    { role: 'candidate', label: 'Candidats', icon: User, iconBg: 'bg-gray-100 text-gray-900', numColor: 'text-gray-900',
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
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Utilisateur</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Email</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Rôle</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Créé le</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Créé par</th>
                        <th className="px-10 py-5 text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Statut</th>
                        <th className="px-10 py-5 text-right text-[10px] font-black uppercase text-white/70 tracking-[0.2em]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map((u, i) => {
                        const roleConfig: any = {
                          admin: { label: 'Admin', color: 'bg-purple-100 text-gray-700 border-purple-200', icon: Crown },
                          recruiter: { label: 'Recruteur', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: UserCheck },
                          candidate: { label: 'Candidat', color: 'bg-gray-100 text-gray-900 border-gray-200', icon: User },
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
                                  : <><ToggleLeft size={15} /> Désactivé</>
                                }
                              </button>
                            </td>
                            <td className="px-10 py-5 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setSelectedUser(u); setEditingUser(null); }}
                                  className="w-10 h-10 flex items-center justify-center bg-navy text-white rounded-xl shadow-lg shadow-navy/20 hover:bg-orange transition-all"
                                  title="Voir le profil"
                                >
                                  <Eye size={16} />
                                </button>
                                {u.cvUrl && (
                                  <a href={u.cvUrl} target="_blank" rel="noopener noreferrer" download={u.cvFileName || 'CV.pdf'}>
                                    <button
                                      className="w-10 h-10 flex items-center justify-center bg-gray-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:scale-110 transition-all"
                                      title="Télécharger CV"
                                    >
                                      <Download size={16} />
                                    </button>
                                  </a>
                                )}
                                {u.idUrl && (
                                  <a href={u.idUrl} target="_blank" rel="noopener noreferrer" download={u.idFileName || 'ID.pdf'}>
                                    <button
                                      className="w-10 h-10 flex items-center justify-center bg-gray-500 text-white rounded-xl shadow-lg shadow-purple-500/20 hover:scale-110 transition-all"
                                      title="Voir pièce d'identité"
                                    >
                                      <FileText size={16} />
                                    </button>
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="w-10 h-10 flex items-center justify-center bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 hover:scale-110 transition-all"
                                  title="Supprimer"
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
                      <p className="text-gray-600 text-lg font-black uppercase tracking-[0.3em] mb-2">Aucun utilisateur trouvé</p>
                      <p className="text-gray-400 font-medium mb-8">Créez votre premier compte pour commencer</p>
                      <button
                        onClick={() => setShowAddUser(true)}
                        className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-normal hover:scale-105 transition-all shadow-lg shadow-gray-200/30 border-2 border-gray-300 inline-flex items-center gap-3"
                      >
                        <UserPlus size={20} /> Créer le premier compte
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'settings' ? (
              <div className="space-y-10">
                <div>
                  <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t.admin.settings}</h1>
                  <p className="text-gray-400 text-sm font-medium">lang==='AR' ? 'إدارة خيارات نماذج المرشحين والمجندين' : lang==='EN' ? 'Manage candidate and recruiter form options' : 'Gérez les options des formulaires candidat et recruteur'</p>
                </div>

                {/* Langue + Sécurité */}
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
                      <button className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase tracking-normal hover:bg-gray-900 transition-all duration-500">
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
                          className={`flex-1 py-4 rounded-2xl font-black transition-all border ${lang === l ? 'bg-gray-900 text-white border-gray-300 shadow-lg shadow-gray-200/20' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Gestionnaire d'options dynamiques ── */}
                {(() => {
                  const optionGroups = [
                    { key: 'settings_sectors',       label: lang==='AR' ? "🏗️ قطاعات النشاط" : lang==='EN' ? "🏗️ Business Sectors" : "🏗️ Secteurs d'activité",    items: dynSectors,       setter: setDynSectors,       color: 'orange' },
                    { key: 'settings_contracts',      label: lang==='AR' ? "📄 أنواع العقود" : lang==='EN' ? "📄 Contract Types" : "📄 Types de contrat",         items: dynContracts,     setter: setDynContracts,     color: 'blue' },
                    { key: 'settings_educations',     label: lang==='AR' ? "🎓 المستويات الدراسية" : lang==='EN' ? "🎓 Education Levels" : "🎓 Niveaux d'études",        items: dynEducations,    setter: setDynEducations,    color: 'purple' },
                    { key: 'settings_availabilities', label: lang==='AR' ? "📅 التوفر" : lang==='EN' ? "📅 Availabilities" : "📅 Disponibilités",           items: dynAvailabilities, setter: setDynAvailabilities, color: 'green' },
                    { key: 'settings_urgencies',      label: lang==='AR' ? "🚨 مستويات الاستعجال" : lang==='EN' ? "🚨 Urgency Levels" : "🚨 Niveaux d'urgence",       items: dynUrgencies,     setter: setDynUrgencies,     color: 'red' },
                    { key: 'settings_salaries',       label: lang==='AR' ? "💰 نطاقات الراتب" : lang==='EN' ? "💰 Salary Ranges" : "💰 Fourchettes de salaire",   items: dynSalaries,      setter: setDynSalaries,      color: 'green' },
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
                    if (!window.confirm(lang==='AR' ? 'حذف هذا الخيار؟' : lang==='EN' ? 'Delete this option?' : 'Supprimer cette option ?')) return;
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
                              <p className="text-gray-400 text-sm italic text-center py-4">lang==='AR' ? 'لا توجد خيارات — أضف واحدة أدناه' : lang==='EN' ? 'No options yet — add one below' : 'Aucune option — ajoutez-en ci-dessous'</p>
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
                                          const fmt = (n: string) => n ? parseInt(n).toLocaleString('fr-FR').replace(/,/g,' ') : '';
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
                                                    defaultValue={minVal ? parseInt(minVal).toLocaleString('fr-FR').replace(/,/g,' ') : ''}
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
                                                    defaultValue={maxVal ? parseInt(maxVal).toLocaleString('fr-FR').replace(/,/g,' ') : ''}
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
                                              lang==='AR' ? 'اسم العرض' : lang==='EN' ? 'Display name' : 'Nom affiché'
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
                                        <span className="font-black text-sm">{item.label}</span>
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
                                          return mn ? parseInt(mn).toLocaleString('fr-FR').replace(/,/g,' ') : (newOptionInputs[key]?._minRaw || '');
                                        })()}
                                        onChange={e => {
                                          const mn = e.target.value.replace(/\D/g,'');
                                          const mx = (newOptionInputs[key]?.value || '').split('-')[1] || (newOptionInputs[key]?._maxRaw || '');
                                          const fmt = (n: string) => n ? parseInt(n).toLocaleString('fr-FR').replace(/,/g,' ') : '';
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
                                          return mx ? parseInt(mx).toLocaleString('fr-FR').replace(/,/g,' ') : (newOptionInputs[key]?._maxRaw || '');
                                        })()}
                                        onChange={e => {
                                          const mx = e.target.value.replace(/\D/g,'');
                                          const mn = (newOptionInputs[key]?.value || '').split('-')[0] || (newOptionInputs[key]?._minRaw || '');
                                          const fmt = (n: string) => n ? parseInt(n).toLocaleString('fr-FR').replace(/,/g,' ') : '';
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
                                      const fmt = (n:string)=>parseInt(n).toLocaleString('fr-FR').replace(/,/g,' ');
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
                                  <span>+</span> {lang==='AR' ? 'إضافة النطاق' : lang==='EN' ? 'Add range' : 'Ajouter la fourchette'}
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
                                  lang==='AR' ? 'اسم العرض' : lang==='EN' ? 'Display name' : 'Nom affiché'
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

                <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-100 text-gray-900 rounded-2xl flex items-center justify-center"><Settings size={28} /></div>
                    <div>
                      <p className="font-black text-gray-900 text-sm uppercase tracking-normal">v2.4.0-stable</p>
                      <p className="text-gray-400 text-xs font-medium">lang==='AR' ? 'الخيارات متزامنة في الوقت الفعلي مع Firebase' : lang==='EN' ? 'Options synced in real-time with Firebase' : 'Options synchronisées en temps réel avec Firebase'</p>
                    </div>
                  </div>
                  <div className="px-6 py-2 bg-green-50 rounded-xl text-[10px] font-black text-green-500 uppercase tracking-normal border border-green-100">Live & Secure</div>
                </div>
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
                      {selectedNeed.urgency === 'high' ? '🔴 Urgence haute' : selectedNeed.urgency === 'medium' ? '🟡 Urgence moyenne' : '🟢 Urgence basse'}
                    </span>
                    {selectedNeed.status === 'processed' && (
                      selectedNeed.publishedAsOffer
                        ? <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1"><Briefcase size={9} /> Publié comme offre</span>
                        : <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-green-50 text-green-600">✓ Validé</span>
                    )}
                    {selectedNeed.status === 'rejected' && <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-red-50 text-red-500">✗ Refusé</span>}
                  </div>
                  <h3 className="text-xl font-black text-gray-900">{selectedNeed.companyName}</h3>
                  {selectedNeed.jobTitle && <p className="text-blue-600 font-black text-sm mt-0.5">🎯 Poste : {selectedNeed.jobTitle}</p>}
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
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">Contact</p>
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
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">Poste & Contrat</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['💼 Type contrat', selectedNeed.needType],
                      ['🏢 Secteur', selectedNeed.sector],
                      ['📍 Lieu', selectedNeed.location],
                      ['🖥 Format', selectedNeed.workFormat === 'terrain' ? 'Terrain/Chantier' : selectedNeed.workFormat === 'hybride' ? 'Hybride' : selectedNeed.workFormat === 'decale' ? 'Horaires décalés' : selectedNeed.workFormat ? 'Bureau' : null],
                      ['👥 Nb profils', selectedNeed.profileCount?.toString()],
                      ['⚡ Disponibilité', selectedNeed.availability === 'immediate' ? 'Immédiate' : selectedNeed.availability === '1month' ? 'Dans 1 mois' : selectedNeed.availability === '3months' ? 'Dans 3 mois' : selectedNeed.availability],
                      ['📅 Délai', selectedNeed.deadline ? new Date(selectedNeed.deadline).toLocaleDateString('fr-FR') : null],
                      ['🔁 Motif', selectedNeed.recruitmentReason === 'replacement' ? 'Remplacement' : selectedNeed.recruitmentReason === 'growth' ? 'Croissance' : selectedNeed.recruitmentReason === 'new_project' ? 'Nouveau projet' : selectedNeed.recruitmentReason === 'seasonal' ? 'Saisonnier' : selectedNeed.recruitmentReason],
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
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">Profil requis</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {[
                      ['🎓 Expérience', selectedNeed.expRequired !== undefined ? `${selectedNeed.expRequired} an(s) minimum` : null],
                      ['📚 Études', selectedNeed.educationLevel === 'none' ? 'Sans diplôme' : selectedNeed.educationLevel === 'bac' ? 'Bac' : selectedNeed.educationLevel === 'bac2' ? 'Bac+2' : selectedNeed.educationLevel === 'licence' ? 'Licence' : selectedNeed.educationLevel === 'master' ? 'Master' : selectedNeed.educationLevel],
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
                            {l === 'fr' ? '🇫🇷 Français' : l === 'en' ? '🇬🇧 Anglais' : l === 'ar' ? '🇸🇦 Arabe' : l === 'so' ? 'Somali' : l === 'aa' ? 'Afar' : l}
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
                          <p className="text-sm font-black text-gray-800">{typeof selectedNeed.salaryMin === 'number' ? selectedNeed.salaryMin.toLocaleString('fr-FR') : selectedNeed.salaryMin} DJF</p>
                        </div>
                      )}
                      {selectedNeed.salaryMax && (
                        <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
                          <p className="text-[9px] font-black uppercase text-amber-500 mb-1">Salaire max</p>
                          <p className="text-sm font-black text-gray-800">{typeof selectedNeed.salaryMax === 'number' ? selectedNeed.salaryMax.toLocaleString('fr-FR') : selectedNeed.salaryMax} DJF</p>
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
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-3">Description du poste</p>
                    <div className="bg-gray-50 rounded-xl px-5 py-4 border border-gray-100 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {selectedNeed.description}
                    </div>
                  </div>
                )}

                {/* Date soumission */}
                <p className="text-[10px] text-gray-300 font-medium text-center">
                  Soumis le {selectedNeed.createdAt?.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {selectedNeed.validatedAt && ` · Validé le ${selectedNeed.validatedAt.toDate().toLocaleDateString('fr-FR')}`}
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
              {selectedNeed.status !== 'processed' && selectedNeed.status !== 'rejected' && (
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
              {(selectedNeed.status === 'processed' || selectedNeed.status === 'rejected') && (
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
                  ) : selectedNeed.status === 'processed' ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-green-500">✓ Demande validée (non publiée)</span>
                      <button
                        onClick={() => handlePublishNeedAsOffer(selectedNeed)}
                        disabled={publishingAsOffer}
                        className="text-[10px] font-black text-navy hover:text-blue-600 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50">
                        <Briefcase size={12} /> Publier maintenant
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
        {showAddJob && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/95 backdrop-blur-xl" onClick={() => { setShowAddJob(false); setEditingJob(null); }} />
            <motion.div initial={{ y: 50, scale: 0.9 }} animate={{ y: 0, scale: 1 }} className="bg-white rounded-xl p-12 w-full max-w-2xl relative z-10 shadow-sm overflow-y-auto max-h-[95vh]">
              <div className="flex justify-between items-center mb-12">
                 <div>
                    <h3 className="text-4xl font-black text-gray-900 tracking-tight">{editingJob ? t.admin.editJobTitle.toUpperCase() : t.admin.publishJob.toUpperCase()}</h3>
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-normal mt-1">Vedior GM Publishing System</p>
                 </div>
                 <button onClick={() => { setShowAddJob(false); setEditingJob(null); }} className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all outline-none">
                   <X size={32} />
                 </button>
              </div>

              <form onSubmit={handleAddJob} className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                   <div className="col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-normal">{t.admin.formJobTitle}</label>
                     <input type="text" required value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} className="w-full bg-gray-50 p-6 rounded-3xl border border-gray-100 outline-none focus:border-gray-300 font-black text-gray-900 text-xl shadow-inner" placeholder={t.admin.formJobTitleEx} />
                   </div>
                   <div className="col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-normal">{t.admin.formCompanyClient}</label>
                     <input type="text" required value={newJob.companyName} onChange={e => setNewJob({...newJob, companyName: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none focus:border-gray-300 font-bold text-gray-900" />
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-normal">{t.admin.formSector}</label>
                     <select value={newJob.sector} onChange={e => setNewJob({...newJob, sector: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-gray-900 appearance-none">
                       {dynSectors.map(s => <option key={s.id} value={s.value}>{s.label}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-normal">{t.admin.formContract}</label>
                     <select value={newJob.type} onChange={e => setNewJob({...newJob, type: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-gray-900 appearance-none">
                       {dynContracts.map(c => <option key={c.id} value={c.value}>{c.label}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-normal">{t.admin.formLocation}</label>
                     <input type="text" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-gray-900" placeholder="Djibouti Ville, Arta..." />
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-normal">{t.admin.formIcon}</label>
                     <input type="text" value={newJob.company} onChange={e => setNewJob({...newJob, company: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-black text-center text-4xl" />
                   </div>
                   <div className="col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 ml-4 mb-3 block tracking-normal">{t.admin.formTags}</label>
                     <input type="text" placeholder={t.admin.formTagsEx} value={newJob.tags} onChange={e => setNewJob({...newJob, tags: e.target.value})} className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 outline-none font-bold text-gray-900" />
                   </div>
                </div>
                
                <div className="pt-8 flex gap-6">
                   <button type="button" onClick={() => { setShowAddJob(false); setEditingJob(null); }} className="flex-1 py-5 font-black text-gray-400 uppercase tracking-normal hover:text-red-500 transition-all">{t.admin.cancel}</button>
                   <button type="submit" className="flex-1 bg-gray-900 text-white py-6 rounded-[28px] font-black uppercase tracking-[0.3em] shadow-sm shadow-gray-200/20 hover:bg-gray-900 hover:shadow-gray-200/30 hover:scale-105 active:scale-95 transition-all outline-none border-none">
                     {editingJob ? t.admin.updateNow : t.admin.publishNow}
                   </button>
                </div>
              </form>
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
              className="bg-white rounded-2xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="bg-gray-900 px-8 py-6 flex justify-between items-center">
                <div>
                  <h3 className="text-white font-black text-lg uppercase tracking-tight">Scanner un CV</h3>
                  <p className="text-white/40 text-xs font-bold mt-1">Groq IA extrait les données automatiquement</p>
                </div>
                <button onClick={() => { setShowScanCV(false); setScanError(''); setScanResult(null); }}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8">
                {!scanLoading && !scanResult && (
                  <>
                    <label className="block border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-gray-900 hover:bg-gray-50 transition-all group">
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) {
                            setScanError('Fichier trop lourd (max 10MB)'); return;
                          }
                          await handleScanCV(file);
                        }} />
                      <FileText size={40} className="mx-auto text-gray-300 group-hover:text-gray-900 mb-4 transition-colors" />
                      <p className="font-black text-gray-400 group-hover:text-gray-900 uppercase tracking-widest text-sm transition-colors">
                        Cliquer pour charger un CV
                      </p>
                      <p className="text-gray-300 text-xs font-bold mt-2">PDF, JPG, PNG — max 10MB</p>
                    </label>
                    {scanError && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-bold">
                        ⚠️ {scanError}
                      </div>
                    )}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-blue-800 font-black text-xs uppercase tracking-wide mb-2">Ce que l'IA va extraire :</p>
                      <div className="grid grid-cols-2 gap-1">
                        {['Nom complet','Email','Téléphone','Nationalité','Formation','Expérience','Langues','Secteur'].map(item => (
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
                    <p className="font-black text-gray-900 uppercase tracking-widest text-sm">{scanProgress || 'Analyse en cours...'}</p>
                    <p className="text-gray-400 text-xs font-bold mt-2">Groq IA analyse votre CV</p>
                  </div>
                )}

                {scanResult && !scanLoading && (
                  <div>
                    <div className="flex items-center gap-3 mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle size={20} className="text-green-600 shrink-0" />
                      <div>
                        <p className="font-black text-green-800 text-sm">CV analysé avec succès !</p>
                        <p className="text-green-600 text-xs font-bold mt-0.5">Le formulaire de création a été pré-rempli</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Nom', scanResult.fullName],
                        ['Email', scanResult.email],
                        ['Téléphone', scanResult.phone],
                        ['Nationalité', scanResult.nationality],
                        ['Formation', scanResult.education],
                        ['Expérience', scanResult.experience ? `${scanResult.experience} ans` : null],
                        ['Langues', scanResult.languages],
                        ['Secteur', scanResult.sector],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={String(k)} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{k}</p>
                          <p className="font-bold text-gray-900 text-sm mt-1 truncate">{v}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setShowScanCV(false); setShowAddUser(true); setScanResult(null); }}
                      className="w-full mt-6 bg-gray-900 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-gray-700 transition-all flex items-center justify-center gap-3">
                      <UserPlus size={18} /> Créer le compte avec ces données
                    </button>
                  </div>
                )}
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
                  <h3 className="text-2xl font-black text-white tracking-tight">CRÉER UN COMPTE</h3>
                  <p className="text-white/40 font-bold uppercase text-[10px] tracking-normal mt-1">Vedior GM — Gestion des accès</p>
                </div>
                <button onClick={() => setShowAddUser(false)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all outline-none">
                  <X size={22} />
                </button>
              </div>

              {/* Sélecteur de rôle */}
              <div className="px-10 py-6 border-b border-gray-100 bg-gray-50 shrink-0">
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-normal mb-4">Type de compte</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'admin', label: 'Administrateur', icon: Crown, activeClass: 'bg-gray-700 border-purple-600 text-white shadow-lg shadow-purple-200' },
                    { value: 'recruiter', label: 'Recruteur', icon: UserCheck, activeClass: 'bg-gray-700 border-blue-600 text-white shadow-lg shadow-blue-200' },
                    { value: 'candidate', label: 'Candidat', icon: User, activeClass: 'bg-gray-900 border-gray-300 text-white shadow-lg shadow-gray-200/30' },
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
                        <p className="font-black text-gray-700 uppercase text-sm tracking-normal">Informations Administrateur</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Nom complet *</label>
                          <input type="text" required value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})}
                            placeholder="Ex: Nasser Ahmed" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Email *</label>
                          <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                            placeholder="admin@vedior-gm.dj" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Mot de passe *</label>
                          <input type="password" required minLength={6} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                            placeholder="Min. 6 caractères" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
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
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Téléphone *</label>
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
                            {dynSectors.map(s => <option key={s.id} value={s.value}>{s.label}</option>)}
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
                        <p className="font-black text-gray-900 uppercase text-sm tracking-normal">Informations Candidat</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Nom complet *</label>
                          <input type="text" required value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                            placeholder="Ex: Mohamed Ahmed Ali" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Email *</label>
                          <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                            placeholder="candidat@email.com" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Téléphone *</label>
                          <input type="tel" required value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})}
                            placeholder="+253 77 XX XX XX" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">WhatsApp</label>
                          <input type="tel" value={newUser.whatsapp} onChange={e => setNewUser({...newUser, whatsapp: e.target.value})}
                            placeholder="+253 77 XX XX XX" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Nationalité</label>
                          <input type="text" value={newUser.nationality} onChange={e => setNewUser({...newUser, nationality: e.target.value})}
                            placeholder="Ex: Djiboutienne" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Sexe</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[{v:'M',l:'Masculin'},{v:'F',l:'Féminin'}].map(({v,l}) => (
                              <button key={v} type="button" onClick={() => setNewUser({...newUser, gender: v})}
                                className={`p-3 rounded-xl border-2 font-black text-sm transition-all ${newUser.gender === v ? 'bg-gray-900 text-white border-gray-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Niveau d'études</label>
                          <select value={newUser.education} onChange={e => setNewUser({...newUser, education: e.target.value})}
                            className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900 appearance-none">
                            <option value="">Sélectionner</option>
                            {dynEducations.map(e => <option key={e.id} value={e.value}>{e.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Années d'expérience</label>
                          <input type="number" min="0" max="50" value={newUser.experience} onChange={e => setNewUser({...newUser, experience: e.target.value})}
                            placeholder="Ex: 5" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Secteur visé</label>
                          <select value={newUser.candidateSector} onChange={e => setNewUser({...newUser, candidateSector: e.target.value})}
                            className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900 appearance-none">
                            {dynSectors.map(s => <option key={s.id} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Disponibilité</label>
                          <select value={newUser.availability} onChange={e => setNewUser({...newUser, availability: e.target.value})}
                            className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900 appearance-none">
                            {dynAvailabilities.map(a => <option key={a.id} value={a.value}>{a.label}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Langues parlées</label>
                          <input type="text" value={newUser.languages} onChange={e => setNewUser({...newUser, languages: e.target.value})}
                            placeholder="Ex: Français, Arabe, Anglais, Somali" className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-2 block tracking-normal">Adresse / Quartier</label>
                          <input type="text" value={newUser.address} onChange={e => setNewUser({...newUser, address: e.target.value})}
                            placeholder="Ex: Balbala, Djibouti Ville..." className="w-full bg-gray-50 p-4 rounded-xl border-2 border-gray-200 outline-none focus:border-gray-300 font-bold text-gray-900" />
                        </div>
                      </div>
                    </>
                  )}

                </div>

                {/* Footer fixe */}
                <div className="px-10 py-6 border-t border-gray-100 bg-gray-50 flex gap-4 shrink-0">
                  <button type="button" onClick={() => setShowAddUser(false)}
                    className="flex-1 py-4 font-black text-gray-500 uppercase tracking-normal hover:text-red-500 transition-all border-2 border-gray-200 rounded-2xl bg-white hover:border-red-200">
                    Annuler
                  </button>
                  <button type="submit" disabled={userSaving}
                    className={`flex-2 px-10 py-4 rounded-2xl font-black uppercase tracking-[0.15em] shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-white ${
                      newUser.role === 'admin' ? 'bg-gray-700 hover:bg-purple-700 shadow-purple-200'
                      : newUser.role === 'recruiter' ? 'bg-gray-700 hover:bg-blue-700 shadow-blue-200'
                      : 'bg-gray-900 hover:bg-gray-700/90 shadow-gray-200/30'
                    }`}>
                    {userSaving ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
                    {userSaving ? 'Création en cours...' : 'Créer le compte'}
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
                  {[
                    { label: 'Nom complet', field: 'fullName', value: selectedUser.fullName || selectedUser.displayName },
                    { label: 'Email', field: 'email', value: selectedUser.email },
                    { label: 'Téléphone', field: 'phone', value: selectedUser.phone },
                    { label: 'WhatsApp', field: 'whatsapp', value: selectedUser.whatsapp },
                    { label: 'Nationalité', field: 'nationality', value: selectedUser.nationality },
                    { label: 'Adresse', field: 'address', value: selectedUser.address },
                    { label: 'Formation', field: 'education', value: selectedUser.education },
                    { label: 'Expérience', field: 'experience', value: selectedUser.experience ? `${selectedUser.experience} ans` : null },
                    { label: 'Langues', field: 'languages', value: selectedUser.languages },
                    { label: 'Secteur', field: 'sector', value: selectedUser.sector || selectedUser.candidateSector },
                    { label: 'Poste', field: 'jobTitle', value: selectedUser.jobTitle },
                    { label: 'Société', field: 'companyName', value: selectedUser.companyName },
                    { label: 'Disponibilité', field: 'availability', value: selectedUser.availability },
                    { label: 'Statut', field: 'status', value: selectedUser.status },
                  ].filter(f => editingUser ? true : f.value).map(({ label, field, value }) => (
                    <div key={field} className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">{label}</p>
                      {editingUser && !['status'].includes(field) ? (
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

                {/* Documents */}
                {(selectedUser.cvUrl || selectedUser.idUrl) && (
                  <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-3">Documents</p>
                    <div className="flex gap-3">
                      {selectedUser.cvUrl && (
                        <a href={selectedUser.cvUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-navy text-white font-black text-xs hover:bg-orange transition-all">
                          <FileText size={14} /> Voir le CV
                        </a>
                      )}
                      {selectedUser.idUrl && (
                        <a href={selectedUser.idUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-100 text-navy font-black text-xs hover:bg-gray-200 transition-all">
                          <Shield size={14} /> Pièce d'identité
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Créé le', value: selectedUser.createdAt?.toDate().toLocaleDateString('fr-FR') },
                    { label: 'Créé par', value: selectedUser.createdBy || 'Auto' },
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
                    {savingUser ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sauvegarde...</> : <><CheckCircle size={16} /> Enregistrer les modifications</>}
                  </button>
                  <button onClick={() => setEditingUser(null)}
                    className="px-8 py-4 rounded-2xl text-gray-400 font-black text-sm hover:bg-gray-100 transition-all">
                    Annuler
                  </button>
                </div>
              )}
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
      className={`relative w-full flex items-center gap-4 px-6 py-4 rounded-[20px] font-black text-sm transition-all group ${active ? 'bg-gray-900 text-white shadow-sm shadow-gray-200/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
    >
      <Icon size={22} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
      <span className="truncate tracking-tight">{label}</span>
      {active && <motion.div layoutId="nav-glow" className="absolute -left-2 w-1 h-6 bg-gray-900 rounded-full blur-[2px]" />}
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