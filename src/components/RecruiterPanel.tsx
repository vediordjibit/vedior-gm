import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Clock, CheckCircle2, LogOut, Bell, Search,
  LayoutDashboard, FileText, User, AlertCircle, MessageSquare,
  BarChart3, Settings, X, ChevronRight, ChevronLeft, MoreVertical,
  Users, Briefcase, MapPin, Shield, Save, Languages, Mail, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { auth, db } from '../lib/firebase';
import { useTranslation } from '../lib/i18n';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc,
  serverTimestamp, doc, getDocs, setDoc, getDoc
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile
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

type RecruiterPanelProps = {
  onBack: () => void;
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
  diplomaRequired: string;
  salaryRange: string;
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

const SKILLS_BY_SECTOR: Record<string, string[]> = {
  btp:         ['CACES', 'AutoCAD', 'Gestion de chantier', 'Lecture de plans', 'Soudure', 'Électricité BT', 'Sécurité chantier', 'Béton armé'],
  logistics:   ['Gestion de stock', 'WMS', 'CACES R489', 'Douane', 'Transport maritime', 'SAP', 'Manutention', 'Permis PL'],
  hospitality: ['Service en salle', 'Sommellerie', 'HACCP', 'Réservation', 'Accueil client', 'Caisse', 'Ménage hôtelier', 'Cuisine'],
  security:    ['Ronde de sécurité', 'Surveillance caméra', 'CQP APS', 'Gestion des accès', 'Secourisme', 'Radio communication'],
  healthcare:  ['Soins infirmiers', 'Pharmacologie', 'Urgences', 'Bloc opératoire', 'Pédiatrie', 'Maternité', 'Radiologie'],
  admin:       ['Excel avancé', 'Comptabilité', 'Sage', 'Paie', 'Ressources humaines', 'Rédaction', 'Archivage', 'PowerPoint'],
  catering:    ['HACCP', 'Cuisine gastronomique', 'Pâtisserie', 'Gestion des coûts', 'Commandes fournisseurs', 'Service traiteur'],
  commerce:    ['Négociation', 'CRM', 'Prospection', 'Merchandising', 'Caisse', 'Gestion de rayon', 'Export', 'E-commerce'],
};

const JOBS_BY_SECTOR: Record<string, string[]> = {
  btp:         ['Chef de chantier', 'Conducteur de travaux', 'Maçon', 'Électricien', 'Plombier', 'Ingénieur BTP', 'Topographe'],
  logistics:   ['Agent logistique', 'Responsable entrepôt', 'Chauffeur PL', 'Agent portuaire', 'Coordinateur transport'],
  hospitality: ['Réceptionniste', 'Barman', 'Chef de rang', 'Gouvernante', 'Directeur hôtel', 'Cuisinier', "Maître d'hôtel"],
  security:    ['Agent de sécurité', 'Chef de poste', 'Superviseur sécurité', 'Technicien CCTV', 'Garde du corps'],
  healthcare:  ['Infirmier(e)', 'Médecin généraliste', 'Sage-femme', 'Aide-soignant(e)', 'Pharmacien(ne)', 'Laborantin'],
  admin:       ['Assistant(e) RH', 'Comptable', 'Secrétaire', 'Responsable administratif', 'Contrôleur de gestion'],
  catering:    ['Chef cuisinier', 'Commis de cuisine', 'Pâtissier', 'Responsable restauration', 'Plongeur'],
  commerce:    ['Commercial(e)', 'Chef de rayon', 'Responsable boutique', 'Merchandiser', 'Chargé(e) export'],
};

export default function RecruiterPanel({ onBack }: RecruiterPanelProps) {
  const { lang, setLang, t, dir } = useTranslation();

  const [user, setUser] = useState(auth.currentUser);
  const [authLoading, setAuthLoading] = useState(!auth.currentUser);
  const [recruiterProfile, setRecruiterProfile] = useState<any>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [needs, setNeeds] = useState<any[]>([]);
  const [propositions, setPropositions] = useState<any[]>([]);
  const [selectedNeed, setSelectedNeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const stats = {
    pending: needs.filter(n => n.status === 'new').length,
    processed: needs.filter(n => n.status === 'processed').length,
    total: needs.length,
    rejected: needs.filter(n => n.status === 'rejected').length
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'needs' | 'propositions' | 'candidates' | 'stats' | 'messages' | 'settings'>('dashboard');
  const [formattedDate, setFormattedDate] = useState('');
  const [needsPage, setNeedsPage] = useState(1);
  const [needsPerPage, setNeedsPerPage] = useState(10);
  const [showAddNeed, setShowAddNeed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsCompany, setSettingsCompany] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Auth email/password states
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authCompany, setAuthCompany] = useState('');
  const [authContact, setAuthContact] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authSector, setAuthSector] = useState('btp');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // ── Options dynamiques depuis Firestore ──
  const [dynSectors, setDynSectors] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynContracts, setDynContracts] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynUrgencies, setDynUrgencies] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynSalaries, setDynSalaries] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynDiplomas, setDynDiplomas] = useState<{id:string; value:string; label:string}[]>([]);

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [showJobSuggestions, setShowJobSuggestions] = useState(false);

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      const updated = [...selectedSkills, trimmed];
      setSelectedSkills(updated);
      setNewNeed(prev => ({ ...prev, skills: updated.join(', ') }));
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    const updated = selectedSkills.filter(s => s !== skill);
    setSelectedSkills(updated);
    setNewNeed(prev => ({ ...prev, skills: updated.join(', ') }));
  };

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
    deadline: '',
    diplomaRequired: '',
    salaryRange: '',
  });

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, 'settings_sectors'), orderBy('order', 'asc')), snap => setDynSectors(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
      onSnapshot(query(collection(db, 'settings_contracts'), orderBy('order', 'asc')), snap => setDynContracts(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
      onSnapshot(query(collection(db, 'settings_urgencies'), orderBy('order', 'asc')), snap => setDynUrgencies(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
      onSnapshot(query(collection(db, 'settings_salaries'), orderBy('order', 'asc')), snap => setDynSalaries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
      onSnapshot(query(collection(db, 'settings_educations'), orderBy('order', 'asc')), snap => setDynDiplomas(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Fix hydration mismatch — date only set client-side
  useEffect(() => {
    setFormattedDate(new Date().toLocaleDateString(
      lang === 'AR' ? 'ar-DJ' : lang === 'EN' ? 'en-US' : 'fr-FR',
      { day: 'numeric', month: 'long', year: 'numeric' }
    ));
  }, [lang]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setNewNeed(prev => ({ ...prev, email: u.email || '' }));
        setSettingsName(u.displayName || '');
        const qRec = query(collection(db, 'recruiters'), where('email', '==', u.email));
        onSnapshot(qRec, (snap) => {
          if (!snap.empty) {
            const profile = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
            setRecruiterProfile(profile);
            // Pré-remplir les champs settings dès le chargement du profil
            setSettingsName(u.displayName || profile.contactName || profile.companyName || '');
            setSettingsCompany(profile.companyName || '');
            setSettingsPhone(profile.phone || '');
            // Only show onboarding if essential fields are truly missing
            const hasEssentialInfo = profile.companyName && profile.contactName;
            if (profile.status === 'active' && !hasEssentialInfo) {
              setNeedsOnboarding(true);
            } else {
              setNeedsOnboarding(false); // Profile already complete
            }
          } else {
            // New user with no recruiter doc yet — trigger onboarding
            setNeedsOnboarding(true);
          }
        });
        // Load messages
        const qMsg = query(
          collection(db, 'messages'),
          where('userId', '==', u.uid),
          orderBy('createdAt', 'asc')
        );
        onSnapshot(qMsg, (snap) => {
          setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

    // Listen to propositions for this recruiter
    const qProps = query(
      collection(db, 'propositions'),
      where('recruiterId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubProps = onSnapshot(qProps, (snapshot) => {
      setPropositions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
      // fallback: try by email
      const qProps2 = query(collection(db, 'propositions'), where('recruiterEmail', '==', user.email || ''));
      onSnapshot(qProps2, (snap2) => {
        setPropositions(snap2.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    });

    return () => { unsubscribe(); unsubProps(); };
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (error: any) {
      const codes: Record<string, string> = {
        'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/invalid-credential': 'Email ou mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
        'auth/invalid-email': 'Email invalide.',
      };
      setAuthError(codes[error.code] || 'Erreur de connexion.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (authPassword !== authConfirmPassword) {
      setAuthError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setAuthLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      const uid = cred.user.uid;

      // BUG 1 FIX: Save in BOTH recruiters AND users collections
      const recruiterData = {
        uid,
        userId: uid,
        email: authEmail,
        companyName: authCompany,
        contactName: authContact,
        phone: authPhone,
        sector: authSector, // BUG 5 FIX: include sector
        status: 'pending',
        role: 'recruiter',
        loginMethod: 'email',
        profileComplete: false,
        createdAt: serverTimestamp(),
      };

      // Save to recruiters collection
      await setDoc(doc(db, 'recruiters', uid), recruiterData);

      // BUG 1 FIX: Also save to users so admin can see it
      await setDoc(doc(db, 'users', uid), {
        ...recruiterData,
        displayName: authContact || authCompany,
      });

      // BUG 2 FIX: profileComplete = false triggers onboarding check below

    } catch (error: any) {
      const codes: Record<string, string> = {
        'auth/email-already-in-use': 'Un compte existe déjà avec cet email.',
        'auth/invalid-email': 'Email invalide.',
        'auth/weak-password': 'Mot de passe trop faible (min. 6 caractères).',
      };
      setAuthError(codes[error.code] || 'Erreur lors de la création du compte.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, authEmail);
      setResetSent(true);
    } catch (error: any) {
      setAuthError('Email introuvable ou invalide.');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => signOut(auth).then(() => onBack());

  const handleSendMessage = async () => {
    if (!user || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      await addDoc(collection(db, 'messages'), {
        userId: user.uid,
        userEmail: user.email,
        companyName: recruiterProfile?.companyName || '',
        text: messageText.trim(),
        sender: 'recruiter',
        createdAt: serverTimestamp(),
        read: false
      });
      setMessageText('');
    } catch (err) {
      console.error('Message error:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      await updateProfile(user, { displayName: settingsName });
      if (recruiterProfile?.id) {
        await updateDoc(doc(db, 'recruiters', recruiterProfile.id), {
          contactName: settingsName,
          updatedAt: serverTimestamp()
        });
      }
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error('Settings save error:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetPasswordFromSettings = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert('Email de réinitialisation envoyé à ' + user.email);
    } catch (err) {
      console.error(err);
    }
  };

  // Automatically pre-fill company info + sector from profile
  useEffect(() => {
    if (recruiterProfile?.companyName && !showAddNeed) {
      setNewNeed(prev => ({
        ...prev,
        companyName: recruiterProfile.companyName,
        contactName: recruiterProfile.contactName || prev.contactName,
        phone: recruiterProfile.phone || prev.phone,
        sector: recruiterProfile.sector || prev.sector,
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
        diplomaRequired: '',
        salaryRange: '',
        expRequired: 3,
        deadline: ''
      });
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };


  // Garde : traductions pas encore disponibles
  if (!t || !t.admin) return null;

  const handleSaveRecruiterOnboarding = async () => {
    if (!user) return;
    setSavingOnboarding(true);
    try {
      const profileData = {
        uid: user.uid,
        userId: user.uid,
        email: user.email,
        companyName: settingsCompany || recruiterProfile?.companyName || '',
        contactName: settingsName || '',
        phone: settingsPhone || '',
        sector: authSector || recruiterProfile?.sector || 'btp',
        status: 'pending',
        role: 'recruiter',
        profileComplete: true,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'recruiters', user.uid), profileData, { merge: true });
      await setDoc(doc(db, 'users', user.uid), {
        ...profileData,
        displayName: settingsName || recruiterProfile?.contactName || '',
      }, { merge: true });
      setNeedsOnboarding(false);
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setSavingOnboarding(false);
    }
  };

  // BUG 8 FIX: Show loading while Firebase resolves
  if (authLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#050E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(0,163,224,0.3)', borderTop: '4px solid #00A3E0', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  // BUG 2: Recruiter onboarding screen
  // ── PENDING VALIDATION SCREEN ─────────────────────────────
  if (user && recruiterProfile && recruiterProfile.status === 'pending') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#050E1A', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {/* Background */}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,163,224,0.1), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 520, textAlign: 'center' }}>

          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <Logo inverted size="lg" />
          </div>

          {/* Clock icon */}
          <div style={{ width: 96, height: 96, background: 'rgba(251,191,36,0.15)', border: '2px solid rgba(251,191,36,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
            <span style={{ fontSize: 48 }}>⏳</span>
          </div>

          <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px', marginBottom: 16 }}>
            Compte en attente
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 12px' }}>
            Votre compte recruteur a bien été créé et est en cours de validation par notre équipe.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, lineHeight: 1.6, maxWidth: 380, margin: '0 auto 40px' }}>
            Vous recevrez un email de confirmation dès que votre compte sera activé. Ce processus prend généralement moins de 24h.
          </p>

          {/* Info cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 40 }}>
            {[
              ['📧', 'Email envoyé', 'Vérifiez votre boîte'],
              ['⏱', '< 24h', 'Délai de validation'],
              ['✅', 'Activation', 'Par notre équipe'],
            ].map(([icon, title, sub]) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 12px' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{title}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Account info */}
          <div style={{ background: 'rgba(0,163,224,0.08)', border: '1px solid rgba(0,163,224,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 32, textAlign: 'left' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Compte soumis</p>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{recruiterProfile.companyName || authCompany || 'Votre entreprise'}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>{user.email}</p>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ background: 'linear-gradient(135deg, #00A3E0, #0057A8)', color: '#fff', padding: '14px 28px', borderRadius: 12, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '1.5px', border: 'none', cursor: 'pointer' }}>
              🔄 Actualiser
            </button>
            <button
              onClick={() => signOut(auth).then(() => onBack())}
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', padding: '14px 28px', borderRadius: 12, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── REJECTED SCREEN ──────────────────────────────────────────
  if (user && recruiterProfile && recruiterProfile.status === 'rejected') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#050E1A', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <Logo inverted size="lg" />
          </div>
          <div style={{ width: 96, height: 96, background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
            <span style={{ fontSize: 48 }}>❌</span>
          </div>
          <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 900, textTransform: 'uppercase', marginBottom: 16 }}>Compte refusé</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7, maxWidth: 380, margin: '0 auto 32px' }}>
            Votre demande d'accès recruteur a été refusée. Contactez notre équipe pour plus d'informations.
          </p>
          <a href="mailto:contact@vedior-gm.com"
            style={{ display: 'inline-block', background: 'linear-gradient(135deg, #00A3E0, #0057A8)', color: '#fff', padding: '14px 28px', borderRadius: 12, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '1.5px', textDecoration: 'none', marginBottom: 16 }}>
            📧 Contacter l'équipe
          </a>
          <br />
          <button onClick={() => signOut(auth).then(() => onBack())}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            ← Retour au portail
          </button>
        </div>
      </div>
    );
  }

  if (user && needsOnboarding) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#050E1A', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 520, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,163,224,0.2)', borderRadius: 32, padding: 40 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', marginBottom: 8 }}>
              Complétez votre profil
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Informations entreprise requises
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Nom de l'entreprise *</label>
              <input
                type="text"
                value={settingsCompany || ''}
                onChange={e => setSettingsCompany(e.target.value)}
                placeholder="Ex: Djibouti Transport SARL"
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,163,224,0.2)', color: '#fff', padding: '16px 20px', borderRadius: 14, outline: 'none', fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Nom du contact *</label>
              <input
                type="text"
                value={settingsName || ''}
                onChange={e => setSettingsName(e.target.value)}
                placeholder="Votre nom complet"
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,163,224,0.2)', color: '#fff', padding: '16px 20px', borderRadius: 14, outline: 'none', fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Téléphone</label>
              <input
                type="tel"
                value={settingsPhone || ''}
                onChange={e => setSettingsPhone(e.target.value)}
                placeholder="+253 XX XX XX XX"
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,163,224,0.2)', color: '#fff', padding: '16px 20px', borderRadius: 14, outline: 'none', fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Secteur d'activité</label>
              <select
                value={authSector}
                onChange={e => setAuthSector(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,163,224,0.2)', color: '#fff', padding: '16px 20px', borderRadius: 14, outline: 'none', fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }}
              >
                {dynSectors.length > 0
                  ? dynSectors.map(s => <option key={s.id} value={s.value} style={{ backgroundColor: '#050E1A' }}>{s.label}</option>)
                  : ['btp','logistics','hospitality','security','healthcare','admin'].map(v => (
                      <option key={v} value={v} style={{ backgroundColor: '#050E1A' }}>{v}</option>
                    ))
                }
              </select>
            </div>
          </div>

          <button
            onClick={handleSaveRecruiterOnboarding}
            disabled={savingOnboarding || !settingsCompany || !settingsName}
            style={{ width: '100%', marginTop: 24, backgroundColor: '#00A3E0', color: '#fff', padding: '18px', borderRadius: 16, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', border: 'none', cursor: 'pointer', opacity: savingOnboarding ? 0.6 : 1 }}
          >
            {savingOnboarding ? 'Enregistrement...' : 'Accéder à mon espace →'}
          </button>

          <button onClick={() => setNeedsOnboarding(false)} style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            Ignorer pour l'instant
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    const N = '#050E1A';
    const O = '#00A3E0';
    const W = '#FFFFFF';

    const inputStyle: React.CSSProperties = {
      width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,163,224,0.2)',
      color: W, padding: '16px 20px 16px 48px', borderRadius: 14, outline: 'none',
      fontSize: 15, fontWeight: 500, boxSizing: 'border-box', transition: 'border 0.2s',
    };
    const labelStyle: React.CSSProperties = {
      fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8,
    };

    return (
      <div style={{ position: 'fixed', inset: 0, background: N, zIndex: 200, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>

        {/* Animated background grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,163,224,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,163,224,0.04) 1px, transparent 1px)', backgroundSize: '50px 50px', pointerEvents: 'none' }} />

        {/* Glowing blobs */}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 700, height: 700, background: 'radial-gradient(circle, rgba(0,163,224,0.15), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,87,168,0.2), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '35%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(0,163,224,0.06), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

          {/* ══ LEFT PANEL ══ */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 72px' }}>

            {/* Logo big */}
            <div style={{ marginBottom: 52 }}>
              <div style={{ marginBottom: 8 }}>
                <Logo inverted size="lg" />
              </div>
              {/* Accent line */}
              <div style={{ width: 60, height: 3, background: `linear-gradient(90deg, ${O}, transparent)`, borderRadius: 2, marginTop: 12 }} />
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 48, fontWeight: 900, color: W, lineHeight: 1.1, letterSpacing: '-2px', marginBottom: 20 }}>
              Connectez-vous à votre<br />
              <span style={{ color: O }}>espace recruteur</span>
            </h1>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, maxWidth: 400, marginBottom: 48 }}>
              Gérez vos besoins en recrutement à Djibouti. Accédez aux meilleurs talents locaux qualifiés dans votre secteur.
            </p>

            {/* Djibouti visual */}
            <div style={{ position: 'relative', marginBottom: 48, height: 120, overflow: 'hidden' }}>
              <svg viewBox="0 0 500 120" style={{ width: '100%', opacity: 0.15 }}>
                {Array.from({length: 80}).map((_, i) => {
                  const x = (i % 16) * 32 + (i * 13 % 10);
                  const y = Math.floor(i / 16) * 24 + (i * 7 % 8);
                  return <circle key={i} cx={x} cy={y} r={1.5} fill={O} opacity={(i * 11 % 10) > 5 ? 1 : 0.3} />;
                })}
                <line x1="100" y1="60" x2="250" y2="40" stroke={O} strokeWidth="0.8" opacity="0.5" strokeDasharray="4,4" />
                <line x1="250" y1="40" x2="380" y2="70" stroke={O} strokeWidth="0.8" opacity="0.5" strokeDasharray="4,4" />
                <circle cx="100" cy="60" r="5" fill={O} opacity="0.9" />
                <circle cx="250" cy="40" r="5" fill={O} opacity="0.9" />
                <circle cx="380" cy="70" r="5" fill={O} opacity="0.9" />
                <text x="85" y="78" fill={O} fontSize="9" opacity="0.7">Djibouti</text>
                <text x="235" y="30" fill={O} fontSize="9" opacity="0.7">Doraleh</text>
                <text x="365" y="87" fill={O} fontSize="9" opacity="0.7">Arta</text>
              </svg>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
              {[['500+', 'Talents placés', '👥'], ['15+', 'Années d\'expérience', '💼'], ['🇩🇯', 'Djibouti', '📍']].map(([n, l, icon]) => (
                <div key={l} style={{ background: 'rgba(0,163,224,0.06)', border: '1px solid rgba(0,163,224,0.15)', borderRadius: 16, padding: '18px 16px' }}>
                  <div style={{ fontSize: 11, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: O, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Trust badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['✅', 'Entreprises djiboutiennes vérifiées'],
                ['✅', 'Activation de compte sous 24h'],
                ['✅', 'Accompagnement RH local dédié'],
              ].map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span> {label}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              © 2026 Vedior GM — Plateforme de recrutement à Djibouti
            </div>
          </div>

          {/* ══ RIGHT PANEL — CARD ══ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 60px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(32px)',
              border: '1px solid rgba(0,163,224,0.15)', borderRadius: 28,
              padding: '52px 52px', width: '100%', maxWidth: 560,
              boxShadow: '0 0 80px rgba(0,163,224,0.08), 0 40px 100px rgba(0,0,0,0.6)',
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Top glow line */}
              <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, ${O}, transparent)`, borderRadius: 1 }} />
              {/* Subtle glow behind card */}
              <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 300, height: 200, background: `radial-gradient(circle, rgba(0,163,224,0.15), transparent 70%)`, pointerEvents: 'none' }} />

              {/* Card header */}
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <Logo inverted size="lg" />
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 900, color: W, letterSpacing: '-0.5px', marginBottom: 8 }}>
                  ESPACE <span style={{ color: O }}>
                    {authMode === 'login' ? 'RECRUTEUR' : authMode === 'register' ? 'INSCRIPTION' : 'RESET'}
                  </span>
                </h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                  {authMode === 'login' ? 'Connectez-vous avec vos identifiants professionnels' :
                   authMode === 'register' ? 'Votre compte sera validé par un administrateur' :
                   'Entrez votre email pour recevoir le lien de réinitialisation'}
                </p>
              </div>

              {authError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 12, padding: '13px 16px', marginBottom: 24, fontSize: 13, fontWeight: 700 }}>
                  ⚠️ {authError}
                </div>
              )}

              {/* ── LOGIN FORM ── */}
              {authMode === 'login' && (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Email professionnel</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>✉</span>
                      <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                        placeholder="vous@entreprise.com"
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = O}
                        onBlur={e => e.target.style.borderColor = 'rgba(0,163,224,0.2)'} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Mot de passe</label>
                      <button type="button" onClick={() => { setAuthMode('reset'); setAuthError(''); }}
                        style={{ background: 'none', border: 'none', color: O, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Mot de passe oublié ?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔒</span>
                      <input type={showPassword ? 'text' : 'password'} required value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                        placeholder="••••••••••"
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = O}
                        onBlur={e => e.target.style.borderColor = 'rgba(0,163,224,0.2)'} />
                      <button type="button" onClick={() => setShowPassword(p => !p)}
                        style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18 }}>
                        {showPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>

                  {/* Remember me */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div onClick={() => setRememberMe(p => !p)}
                      style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${rememberMe ? O : 'rgba(255,255,255,0.2)'}`, background: rememberMe ? O : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                      {rememberMe && <span style={{ color: W, fontSize: 12, fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }} onClick={() => setRememberMe(p => !p)}>Se souvenir de moi</span>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={authLoading}
                    style={{
                      width: '100%', background: `linear-gradient(135deg, ${O}, #0057A8)`, color: W,
                      padding: '18px', borderRadius: 14, fontWeight: 900, fontSize: 14,
                      textTransform: 'uppercase', letterSpacing: '2px', border: 'none', cursor: 'pointer',
                      marginTop: 4, opacity: authLoading ? 0.6 : 1,
                      boxShadow: `0 8px 32px rgba(0,163,224,0.35)`,
                      transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,163,224,0.6)'; (e.target as HTMLElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,163,224,0.35)'; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
                  >
                    {authLoading ? 'Connexion...' : <><span>SE CONNECTER</span><span>→</span></>}
                  </button>

                  {/* Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>OU</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  </div>

                  <button type="button" onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    style={{ width: '100%', background: 'transparent', border: '1px solid rgba(0,163,224,0.3)', color: O, padding: '14px', borderRadius: 14, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                    Créer un compte recruteur <span style={{ fontSize: 16 }}>👤</span>
                  </button>
                </form>
              )}

              {/* ── REGISTER FORM ── */}
              {authMode === 'register' && (
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Société *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🏢</span>
                        <input type="text" required value={authCompany} onChange={e => setAuthCompany(e.target.value)} placeholder="Nom de votre entreprise" style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Contact *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>👤</span>
                        <input type="text" required value={authContact} onChange={e => setAuthContact(e.target.value)} placeholder="Nom / Fonction" style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Téléphone *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>📞</span>
                        <input type="tel" required value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="+253..." style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Email professionnel *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>✉</span>
                        <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="vous@entreprise.com" style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Mot de passe *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔒</span>
                        <input type={showPassword ? 'text' : 'password'} required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
                        <button type="button" onClick={() => setShowPassword(p => !p)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                          {showPassword ? '🙈' : '👁'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Confirmer le mot de passe *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔒</span>
                        <input type={showPassword ? 'text' : 'password'} required value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} placeholder="••••••••"
                          style={{ ...inputStyle, borderColor: authConfirmPassword && authConfirmPassword !== authPassword ? 'rgba(239,68,68,0.6)' : authConfirmPassword && authConfirmPassword === authPassword ? 'rgba(34,197,94,0.6)' : 'rgba(0,163,224,0.2)' }} />
                        {authConfirmPassword && (
                          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>
                            {authConfirmPassword === authPassword ? '✅' : '❌'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Secteur *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🏭</span>
                        <select required value={authSector} onChange={e => setAuthSector(e.target.value)}
                          style={{ ...inputStyle, appearance: 'none' as const }}>
                          <option value="btp" style={{ background: '#050E1A' }}>BTP & Génie Civil</option>
                          <option value="logistics" style={{ background: '#050E1A' }}>Logistique & Port</option>
                          <option value="hospitality" style={{ background: '#050E1A' }}>Hôtellerie</option>
                          <option value="healthcare" style={{ background: '#050E1A' }}>Santé</option>
                          <option value="admin" style={{ background: '#050E1A' }}>Administration</option>
                          <option value="other" style={{ background: '#050E1A' }}>Autre</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={authLoading}
                    style={{ width: '100%', background: `linear-gradient(135deg, ${O}, #0057A8)`, color: W, padding: '17px', borderRadius: 14, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '1.5px', border: 'none', cursor: 'pointer', marginTop: 4, opacity: authLoading ? 0.6 : 1, boxShadow: `0 8px 32px rgba(0,163,224,0.3)` }}>
                    {authLoading ? 'Création...' : 'Créer mon compte →'}
                  </button>
                  <button type="button" onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                    ← Déjà un compte ? Se connecter
                  </button>
                </form>
              )}

              {/* ── RESET FORM ── */}
              {authMode === 'reset' && (
                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Votre email</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>✉</span>
                      <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="vous@entreprise.com" style={inputStyle} />
                    </div>
                  </div>
                  {resetSent ? (
                    <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: 12, padding: '16px', textAlign: 'center', fontWeight: 700 }}>
                      ✅ Email envoyé ! Vérifiez votre boîte.
                    </div>
                  ) : (
                    <button type="submit" disabled={authLoading}
                      style={{ width: '100%', background: `linear-gradient(135deg, ${O}, #0057A8)`, color: W, padding: '17px', borderRadius: 14, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '1.5px', border: 'none', cursor: 'pointer', boxShadow: `0 8px 32px rgba(0,163,224,0.3)` }}>
                      {authLoading ? 'Envoi...' : 'Envoyer le lien →'}
                    </button>
                  )}
                  <button type="button" onClick={() => { setAuthMode('login'); setAuthError(''); setResetSent(false); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                    ← Retour à la connexion
                  </button>
                </form>
              )}

              {/* Bottom link */}
              <div style={{ textAlign: 'center', marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={onBack}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  ← RETOUR AU PORTAIL PUBLIC
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="fixed inset-0 bg-gray-50 z-[200] flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-10 cursor-pointer" onClick={onBack}>
          <Logo inverted />
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutDashboard} label={t.admin.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={Briefcase} label={t.admin.needs} active={activeTab === 'needs'} onClick={() => setActiveTab('needs')} />
          <div className="relative">
            <NavItem icon={Users} label="Profils proposés" active={activeTab === 'propositions'} onClick={() => setActiveTab('propositions')} />
            {propositions.filter(p => p.status === 'pending').length > 0 && (
              <span className="absolute top-2 right-3 w-5 h-5 bg-orange text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {propositions.filter(p => p.status === 'pending').length}
              </span>
            )}
          </div>
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
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#F3F4F6] border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange/20 outline-none"
            />
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-gray-400 font-bold text-sm bg-gray-50 px-3 py-1.5 rounded-xl">
              <Clock size={16} /> {formattedDate}
            </div>
            <button className="relative w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
              <Bell size={22} />
              <div className="absolute top-2 right-2 w-4 h-4 bg-gray-900 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center">2</div>
            </button>
            <div className="flex items-center gap-3 border-l border-gray-100 pl-6 cursor-pointer group">
              <div className="text-right">
                <p className="text-sm font-black text-gray-900">{user.displayName || 'Recruteur'}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.admin.proRecruiter}</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                {user.photoURL ? <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-gray-900 bg-gray-100"><User size={20} /></div>}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-10 bg-gray-50">
          <div className="max-w-[1440px] mx-auto">
            {activeTab === 'dashboard' ? (
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 xl:col-span-8 space-y-8">
                  <div>
                    <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">{t.admin.hello} {user.displayName?.split(' ')[0] || 'Nasser'} 👋</h1>
                    <p className="text-gray-400 text-sm font-medium">{t.admin.dashboardSummary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard title={t.admin.pendingDemands} value={stats.pending.toString()} change="+0%" color="orange" data={SPARKLINE_DATA_UP} bgColor="bg-gray-900-50" textColor="text-gray-900" t={t} />
                    <StatCard title={t.admin.candidatesInProgress} value={stats.processed.toString()} change="+0%" color="blue" data={SPARKLINE_DATA_UP} bgColor="bg-blue-50" textColor="text-blue-500" t={t} />
                    <StatCard title={t.admin.validatedRecruitments} value={stats.total.toString()} change="+0%" color="green" data={SPARKLINE_DATA_UP} bgColor="bg-green-50" textColor="text-green-500" t={t} />
                    <StatCard title={t.admin.rejected} value={stats.rejected.toString()} change="-0%" color="red" data={SPARKLINE_DATA_DOWN} bgColor="bg-red-50" textColor="text-red-500" t={t} />
                  </div>

                  <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-lg font-black text-gray-900 tracking-tight">{t.admin.appEvolution}</h3>
                      <select className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-gray-500 outline-none">
                        <option>{t.admin.last7Days}</option>
                        <option>30 {t.admin.last30days}</option>
                      </select>
                    </div>
                    <div className="h-[300px] w-full" style={{ minHeight: 300, minWidth: 0, overflow: 'hidden' }}>
                      <ResponsiveContainer width="100%" height={300}>
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

                  <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-lg font-black text-gray-900 tracking-tight">{t.admin.recentActivity}</h3>
                      <button className="text-gray-900 text-xs font-black uppercase tracking-normal hover:underline" onClick={() => setActiveTab('needs')}>{t.admin.seeAll}</button>
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
                  <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight mb-6">{t.admin.quickActions}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <ActionButton icon={Plus} label={t.admin.newDemand} color="blue" onClick={() => setShowAddNeed(true)} />
                      {/* Bouton "Voir mes CV" retiré car les profils arrivent par email */}
                      <ActionButton icon={MessageSquare} label="Support" color="purple" onClick={() => setActiveTab('messages')} />
                      <ActionButton icon={BarChart3} label={t.admin.viewStats} color="orange" onClick={() => setActiveTab('stats')} />
                      <ActionButton icon={Settings} label={t.admin.settings} color="blue" onClick={() => setActiveTab('settings')} />
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-900">
                      <Users size={24} />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Propositions de profils</h4>
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
                <h2 className="text-2xl font-black text-gray-900 mb-2">Consultation des profils</h2>
                <p className="text-gray-400 max-w-md font-medium italic">
                  Les profils retenus pour vos demandes vous sont communiqués directement par email par l'équipe Vedior GM.
                </p>
                <button onClick={() => setActiveTab('dashboard')} className="mt-6 text-gray-900 font-bold hover:underline">{t.admin.backToDashboard}</button>
              </div>
            ) : activeTab === 'needs' ? (
              <NeedsTab
                needs={needs}
                loading={loading}
                searchQuery={searchQuery}
                recruiterProfile={recruiterProfile}
                needsPage={needsPage}
                setNeedsPage={setNeedsPage}
                needsPerPage={needsPerPage}
                setNeedsPerPage={setNeedsPerPage}
                setShowAddNeed={setShowAddNeed}
                setSelectedNeed={setSelectedNeed}
                t={t}
              />
            ) : activeTab === 'propositions' ? (
              <div className="space-y-8">
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="text-4xl font-black text-navy mb-2 tracking-tight">Profils Proposés</h1>
                    <p className="text-gray-400 text-sm font-medium">Candidats sélectionnés par Vedior GM pour vos demandes</p>
                  </div>
                  <div className="flex gap-4">
                    {[
                      { label: 'En attente', count: propositions.filter(p => p.status === 'pending').length, color: 'text-orange' },
                      { label: 'Acceptés', count: propositions.filter(p => p.status === 'accepted').length, color: 'text-green-500' },
                      { label: 'Refusés', count: propositions.filter(p => p.status === 'rejected').length, color: 'text-red-400' },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="text-center">
                        <p className={`text-2xl font-black ${color}`}>{count}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-300">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {propositions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[32px] border border-gray-100">
                    <div className="w-20 h-20 bg-gray-50 rounded-[28px] flex items-center justify-center mb-4 border border-gray-100">
                      <Users size={32} className="text-gray-200" />
                    </div>
                    <p className="text-lg font-black text-gray-300 uppercase tracking-widest">Aucun profil proposé</p>
                    <p className="text-sm text-gray-300 mt-1">Vedior GM vous proposera des candidats ici</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {propositions.map((prop, i) => (
                      <motion.div key={prop.id}
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={`bg-[#FBFBFE] rounded-[28px] border-2 transition-all overflow-hidden ${
                          prop.status === 'accepted' ? 'border-green-200' :
                          prop.status === 'rejected' ? 'border-red-100 opacity-60' :
                          'border-orange/20 shadow-md shadow-orange/5'
                        }`}
                      >
                        <div className="p-6 flex flex-wrap items-center gap-6">
                          {/* Avatar */}
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl text-white shrink-0 shadow-lg"
                            style={{ background: 'linear-gradient(135deg,#0F172A,#1e3a5f)' }}>
                            {(prop.candidateName || '?')[0].toUpperCase()}
                          </div>

                          {/* Infos candidat */}
                          <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="text-lg font-black text-navy">{prop.candidateName || '—'}</h4>
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                                prop.status === 'pending' ? 'bg-orange/10 text-orange border-orange/20' :
                                prop.status === 'accepted' ? 'bg-green-50 text-green-600 border-green-200' :
                                'bg-red-50 text-red-400 border-red-100'
                              }`}>
                                {prop.status === 'pending' ? '⏳ En attente' : prop.status === 'accepted' ? '✅ Accepté' : '❌ Refusé'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 font-bold mb-2">
                              Pour : <span className="text-navy font-black">{prop.jobTitle || '—'}</span>
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 font-bold">
                              {prop.candidateEmail && <span className="flex items-center gap-1"><Mail size={11} />{prop.candidateEmail}</span>}
                              {prop.candidatePhone && <span className="flex items-center gap-1"><Phone size={11} />{prop.candidatePhone}</span>}
                              {prop.candidateSector && <span className="px-2 py-0.5 bg-gray-100 rounded-lg uppercase text-[10px]">{prop.candidateSector}</span>}
                              {prop.candidateExperience && <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded-lg text-[10px]">{prop.candidateExperience} ans exp.</span>}
                              {prop.candidateEducation && <span className="px-2 py-0.5 bg-purple-50 text-purple-500 rounded-lg text-[10px]">{prop.candidateEducation}</span>}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2 shrink-0">
                            {prop.cvUrl && (
                              <a href={prop.cvUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy text-white font-black text-xs hover:bg-orange transition-all">
                                <FileText size={13} /> Voir le CV
                              </a>
                            )}
                            {prop.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    await updateDoc(doc(db, 'propositions', prop.id), { status: 'accepted', respondedAt: serverTimestamp() });
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-500 text-white font-black text-xs hover:bg-green-600 transition-all shadow-lg shadow-green-500/20">
                                  <CheckCircle2 size={13} /> Accepter
                                </button>
                                <button
                                  onClick={async () => {
                                    await updateDoc(doc(db, 'propositions', prop.id), { status: 'rejected', respondedAt: serverTimestamp() });
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-100 text-red-500 font-black text-xs hover:bg-red-200 transition-all">
                                  <X size={13} /> Refuser
                                </button>
                              </div>
                            )}
                            <p className="text-[9px] text-gray-300 font-bold text-center">
                              Reçu le {prop.createdAt?.toDate().toLocaleDateString('fr-FR') || '—'}
                            </p>
                          </div>
                        </div>

                        {/* Extra infos si accepté */}
                        {prop.status === 'accepted' && prop.candidatePhone && (
                          <div className="mx-6 mb-4 px-5 py-3 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3">
                            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                            <p className="text-sm text-green-700 font-bold">
                              Contactez ce candidat : <span className="font-black">{prop.candidatePhone}</span>
                              {prop.candidateEmail && <> · <span className="font-black">{prop.candidateEmail}</span></>}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

            ) : activeTab === 'stats' ? (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">{t.admin.detailedStats}</h1>
                  <p className="text-gray-400 text-sm font-medium">{t.admin.analysisDesc || 'Analysez l\'efficacité de vos processus RH'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 border border-green-100"><Users size={32} /></div>
                      <p className="text-5xl font-black text-gray-900 mb-2">{stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0}%</p>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-normal">{t.admin.retentionRate}</p>
                   </div>
                   <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 border border-blue-100"><Clock size={32} /></div>
                      <p className="text-5xl font-black text-gray-900 mb-2">{stats.processed > 0 ? Math.ceil(stats.processed * 4.2) : 0}j</p>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-normal">{t.admin.avgHiringTime}</p>
                   </div>
                   <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-gray-900-50 text-gray-900 rounded-full flex items-center justify-center mb-6 border border-gray-300-100"><BarChart3 size={32} /></div>
                      <p className="text-5xl font-black text-gray-900 mb-2">{stats.total}</p>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-normal">{t.admin.appsPerMonth}</p>
                   </div>
                </div>

                <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
                   <h3 className="text-xl font-black text-gray-900 mb-8 tracking-tight">{t.admin.appsBySector}</h3>
                   <div className="h-[400px] w-full" style={{ minHeight: 400, minWidth: 0, overflow: 'hidden' }}>
                      <ResponsiveContainer width="100%" height={400}>
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
                  <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">{t.admin.centralizedMessaging}</h1>
                  <p className="text-gray-400 text-sm font-medium">Messagerie interne avec l'équipe Vedior GM</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden" style={{minHeight: '500px'}}>
                  <div className="flex-1 overflow-y-auto p-8 space-y-4" style={{minHeight: '380px'}}>
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
                        <MessageSquare size={64} className="mb-4 text-gray-300" />
                        <p className="text-lg font-black uppercase text-gray-400 tracking-tight">Contactez votre chargé de recrutement</p>
                        <p className="text-sm text-gray-400 italic mt-2">Cette messagerie vous permet d'échanger directement avec l'équipe dédiée à votre compte.</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'recruiter' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] px-5 py-3 rounded-[20px] text-sm font-medium ${msg.sender === 'recruiter' ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
                            <p>{msg.text}</p>
                            <p className={`text-[10px] mt-1 ${msg.sender === 'recruiter' ? 'text-white/60' : 'text-gray-400'}`}>
                              {msg.createdAt?.toDate?.().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) || ''}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-6 border-t border-gray-100 flex gap-4">
                    <input 
                      type="text" 
                      placeholder="Écrivez votre message..." 
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      className="flex-1 bg-white border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:border-gray-300 shadow-sm font-bold text-sm" 
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !messageText.trim()}
                      className="bg-gray-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                      {sendingMessage ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ChevronRight size={24} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === 'settings' ? (
              <div className="space-y-8 max-w-4xl mx-auto">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">{t.admin.accountSettings}</h1>
                  <p className="text-gray-400 text-sm font-medium">{t.admin.personalInfoPreferences}</p>
                </div>
                {/* ══ SETTINGS PAGE ══ */}
                <div className="space-y-6">

                  {/* Hero card — profil */}
                  <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A5F] rounded-3xl p-8 flex items-center gap-8 relative overflow-hidden shadow-xl">
                    <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 80% 50%, #00A3E0 0%, transparent 60%)'}} />
                    <div className="relative group shrink-0">
                      <div className="w-24 h-24 rounded-2xl border-4 border-white/10 bg-white/10 overflow-hidden shadow-xl">
                        {user.photoURL
                          ? <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white"><User size={40} /></div>}
                      </div>
                      <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#00A3E0] text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all border-2 border-white">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="relative z-10 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl font-black text-white tracking-tight">{settingsName || user.displayName || 'Recruteur'}</h3>
                        <span className="bg-[#00A3E0]/20 text-[#00A3E0] text-[10px] font-black px-3 py-1 rounded-full border border-[#00A3E0]/30 uppercase tracking-widest">
                          {t.admin.certifiedAccount}
                        </span>
                      </div>
                      <p className="text-white/50 font-medium text-sm mb-3">{user.email}</p>
                      {settingsCompany && (
                        <div className="flex items-center gap-2 text-white/60 text-sm font-bold">
                          <Building2 size={14} className="text-[#00A3E0]" />
                          {settingsCompany}
                          {settingsPhone && <><span className="text-white/20 mx-1">·</span><span>{settingsPhone}</span></>}
                        </div>
                      )}
                    </div>
                    <div className="relative z-10 text-right shrink-0">
                      <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Vedior GM</div>
                      <div className="text-[10px] font-bold text-[#00A3E0]">Recruteur Pro</div>
                    </div>
                  </div>

                  {/* Grid principale */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Colonne gauche — Infos personnelles */}
                    <div className="lg:col-span-2 space-y-6">

                      {/* Informations personnelles */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-50 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><User size={16} className="text-blue-500" /></div>
                          <div>
                            <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest">{lang === 'AR' ? 'المعلومات الشخصية' : lang === 'EN' ? 'Personal Information' : 'Informations personnelles'}</h4>
                          </div>
                        </div>
                        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
                          {/* Nom complet */}
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">{t.admin.fullName}</label>
                            <div className="relative">
                              <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                              <input type="text" value={settingsName} onChange={e => setSettingsName(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 pl-10 pr-4 py-3.5 rounded-xl outline-none focus:border-blue-300 focus:bg-white font-bold text-gray-900 transition-all text-sm" />
                            </div>
                          </div>
                          {/* Email */}
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">{t.admin.emailLabel || 'Email'}</label>
                            <div className="relative">
                              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                              <input type="email" readOnly value={user.email || ''}
                                className="w-full bg-gray-50/50 border border-gray-100 pl-10 pr-4 py-3.5 rounded-xl outline-none font-bold text-gray-400 cursor-not-allowed text-sm" />
                            </div>
                          </div>
                          {/* Société */}
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">{t.admin.companyLabel || 'Nom de la société'}</label>
                            <div className="relative">
                              <Building2 size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                              <input type="text" value={settingsCompany} onChange={e => setSettingsCompany(e.target.value)}
                                placeholder={lang === 'EN' ? 'Ex: Sheraton Hotel' : 'Ex: Hôtel Sheraton'}
                                className="w-full bg-gray-50 border border-gray-100 pl-10 pr-4 py-3.5 rounded-xl outline-none focus:border-blue-300 focus:bg-white font-bold text-gray-900 transition-all text-sm" />
                            </div>
                          </div>
                          {/* Téléphone */}
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">{lang === 'AR' ? 'الهاتف' : lang === 'EN' ? 'Phone' : 'Téléphone'}</label>
                            <div className="relative">
                              <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                              <input type="tel" value={settingsPhone} onChange={e => setSettingsPhone(e.target.value)}
                                placeholder="+253 XX XX XX XX"
                                className="w-full bg-gray-50 border border-gray-100 pl-10 pr-4 py-3.5 rounded-xl outline-none focus:border-blue-300 focus:bg-white font-bold text-gray-900 transition-all text-sm" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Langue */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-50 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center"><Languages size={16} className="text-purple-500" /></div>
                          <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest">{t.admin.preferredLanguage}</h4>
                        </div>
                        <div className="p-8">
                          <div className="flex gap-3">
                            {(['FR', 'EN', 'AR'] as const).map(l => (
                              <button key={l} onClick={() => setLang(l)}
                                className={`flex-1 py-3.5 rounded-xl font-black text-sm transition-all border-2 ${lang === l ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-lg' : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300'}`}>
                                {l === 'FR' ? '🇫🇷 Français' : l === 'EN' ? '🇬🇧 English' : '🇸🇦 العربية'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Colonne droite */}
                    <div className="space-y-6">

                      {/* Notifications */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center"><Bell size={16} className="text-orange" /></div>
                          <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest">Notifications</h4>
                        </div>
                        <div className="p-6 space-y-4">
                          {[
                            { label: t.admin.newApps, active: true },
                            { label: t.admin.weeklyEmailAlerts, active: false },
                          ].map(({ label, active }) => (
                            <div key={label} className="flex items-center justify-between py-1">
                              <span className="text-sm font-semibold text-gray-600">{label}</span>
                              <div className={`w-11 h-6 rounded-full relative transition-all cursor-pointer ${active ? 'bg-[#0F172A]' : 'bg-gray-200'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${active ? 'right-1' : 'left-1'}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Sécurité */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"><Shield size={16} className="text-red-500" /></div>
                          <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest">{t.admin.security}</h4>
                        </div>
                        <div className="p-6 space-y-3">
                          <p className="text-xs text-gray-400 font-medium leading-relaxed">
                            {lang === 'AR' ? 'أرسل رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.' : lang === 'EN' ? 'Send a password reset link to your email address.' : 'Envoyez un lien de réinitialisation à votre adresse email.'}
                          </p>
                          <button onClick={handleResetPasswordFromSettings}
                            className="w-full bg-red-50 text-red-500 border border-red-100 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                            {t.admin.resetPassword}
                          </button>
                        </div>
                      </div>

                      {/* Compte info */}
                      <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-2xl p-6 text-white">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                            <CheckCircle2 size={16} className="text-green-400" />
                          </div>
                          <div>
                            <p className="font-black text-sm">{t.admin.certifiedAccount}</p>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Vedior GM</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-[11px] text-white/40 font-bold uppercase">Plan</span>
                            <span className="text-[11px] font-black text-[#00A3E0]">Pro Recruteur</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-[11px] text-white/40 font-bold uppercase">Status</span>
                            <span className="flex items-center gap-1.5 text-[11px] font-black text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Actif</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-5 flex items-center justify-between">
                    <p className="text-xs text-gray-400 font-medium">
                      {settingsSaved ? <span className="text-green-500 font-bold flex items-center gap-2"><CheckCircle2 size={14} /> {lang === 'AR' ? 'تم الحفظ!' : lang === 'EN' ? 'Changes saved!' : 'Modifications enregistrées !'}</span>
                       : lang === 'AR' ? 'سيتم تطبيق التغييرات على حسابك فوراً.' : lang === 'EN' ? 'Changes will be applied to your account immediately.' : 'Les modifications seront appliquées immédiatement.'}
                    </p>
                    <div className="flex gap-3">
                      <button className="text-gray-400 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-gray-50 transition-all" onClick={() => setActiveTab('dashboard')}>{t.admin.cancel}</button>
                      <button onClick={handleSaveSettings} disabled={savingSettings}
                        className="bg-[#0F172A] text-white px-8 py-2.5 rounded-xl font-black text-sm shadow-lg hover:bg-[#1E293B] active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2">
                        {savingSettings
                          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{lang === 'EN' ? 'Saving...' : 'Enregistrement...'}</>
                          : <><Save size={15} />{t.admin.saveChanges}</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Modal Add Need — redesigned */}
      <AnimatePresence>
        {showAddNeed && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(10,20,40,0.85)', backdropFilter: 'blur(12px)' }}
              onClick={() => setShowAddNeed(false)}
            />

            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative z-10 w-full max-w-3xl max-h-[95vh] flex flex-col rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl"
              style={{ background: '#FBFBFE' }}
            >
              {/* ── Header strip ── */}
              <div className="relative flex items-center justify-between px-10 pt-10 pb-8 shrink-0"
                style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1e3a5f 100%)' }}>
                {/* Decorative circle */}
                <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
                  style={{ background: 'radial-gradient(circle,#f97316,transparent)' }} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange/70 mb-1">
                    Vedior GM · Demande RH
                  </p>
                  <h3 className="text-3xl font-black text-white tracking-tight">
                    {t.admin.newDemand}
                  </h3>
                </div>
                <button
                  onClick={() => { setShowAddNeed(false); setSelectedSkills([]); setSkillInput(''); }}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
                >
                  <X size={22} />
                </button>
              </div>

              {/* ── Scrollable body ── */}
              <div className="overflow-y-auto flex-1 px-10 py-8">
                <form onSubmit={handleAddNeed} className="space-y-10" id="need-form">

                  {/* Section 1 — Carte identité recruteur (lecture seule) */}
                  <div className="flex items-center gap-5 p-5 rounded-3xl border-2 border-gray-100 bg-white shadow-sm">
                    {/* Avatar initiales */}
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg text-white"
                      style={{ background: 'linear-gradient(135deg,#0F172A,#1e3a5f)' }}>
                      {(recruiterProfile?.companyName || newNeed.companyName || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-navy text-base truncate">
                        {recruiterProfile?.companyName || newNeed.companyName || '—'}
                      </p>
                      <p className="text-sm text-gray-400 font-bold truncate">
                        {recruiterProfile?.contactName || newNeed.contactName || '—'}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                        <Mail size={12} />
                        {newNeed.email || '—'}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                        <Phone size={12} />
                        {recruiterProfile?.phone || newNeed.phone || '—'}
                      </span>
                    </div>
                    <div className="shrink-0">
                      <span className="flex items-center gap-1.5 text-[10px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Connecté
                      </span>
                    </div>
                  </div>

                  {/* Section 2 — Poste */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-7 h-7 rounded-xl bg-[#0F172A] flex items-center justify-center shrink-0">
                        <Briefcase size={14} className="text-orange" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-navy/40">
                        Détails du poste
                      </p>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange">
                          Intitulé du poste
                        </label>
                        <div className="relative">
                          <input
                            required type="text"
                            value={newNeed.jobTitle}
                            onChange={e => { setNewNeed({...newNeed, jobTitle: e.target.value}); setShowJobSuggestions(true); }}
                            onFocus={() => setShowJobSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowJobSuggestions(false), 150)}
                            placeholder="Ex: Chef de chantier senior"
                            className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy text-lg placeholder:text-gray-300 transition-all shadow-sm"
                          />
                          {showJobSuggestions && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-100 rounded-2xl shadow-xl z-10 overflow-hidden">
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 px-4 pt-3 pb-1">
                                Postes fréquents · {newNeed.sector}
                              </p>
                              {(JOBS_BY_SECTOR[newNeed.sector] || []).filter(j =>
                                !newNeed.jobTitle || j.toLowerCase().includes(newNeed.jobTitle.toLowerCase())
                              ).map(job => (
                                <button key={job} type="button"
                                  onMouseDown={() => { setNewNeed(p => ({...p, jobTitle: job})); setShowJobSuggestions(false); }}
                                  className="w-full text-left px-4 py-3 font-bold text-sm text-navy hover:bg-orange/5 hover:text-orange transition-all border-t border-gray-50 first:border-0">
                                  {job}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="group">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange flex items-center gap-2">
                          Secteur
                          <span className="normal-case font-bold text-orange/60 tracking-normal">· pré-rempli, modifiable</span>
                        </label>
                        <select
                          value={newNeed.sector}
                          onChange={e => setNewNeed({...newNeed, sector: e.target.value})}
                          className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm appearance-none cursor-pointer"
                        >
                          {dynSectors.length > 0
                            ? dynSectors.map(s => <option key={s.id} value={s.value}>{s.label}</option>)
                            : [['btp','BTP / Construction'],['logistics','Logistique & Portuaire'],['hospitality','Hôtellerie & Tourisme'],['security','Sécurité'],['healthcare','Santé & Médical'],['admin','Administratif']].map(([v,l]) => <option key={v} value={v}>{l}</option>)
                          }
                        </select>
                      </div>
                      <div className="group">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange">
                          {t.modals.needType}
                        </label>
                        <select
                          value={newNeed.needType}
                          onChange={e => setNewNeed({...newNeed, needType: e.target.value as any})}
                          className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm appearance-none cursor-pointer"
                        >
                          {dynContracts.length > 0
                            ? dynContracts.map(c => <option key={c.id} value={c.value}>{c.label}</option>)
                            : [['CDI','CDI'],['CDD','CDD'],['Intérim','Intérim'],['Audit','Audit / Conseil']].map(([v,l]) => <option key={v} value={v}>{l}</option>)
                          }
                        </select>
                      </div>
                    </div>

                    {/* Nb profils / Exp / Urgence — pill selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div className="group">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange">
                          Nb de profils
                        </label>
                        <div className="flex items-center gap-2 bg-white border-2 border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                          <button type="button"
                            onClick={() => setNewNeed(p => ({...p, profileCount: Math.max(1, p.profileCount - 1)}))}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange hover:text-white font-black text-lg flex items-center justify-center transition-all">−</button>
                          <span className="flex-1 text-center font-black text-navy text-xl">{newNeed.profileCount}</span>
                          <button type="button"
                            onClick={() => setNewNeed(p => ({...p, profileCount: p.profileCount + 1}))}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange hover:text-white font-black text-lg flex items-center justify-center transition-all">+</button>
                        </div>
                      </div>
                      <div className="group">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange">
                          Expérience (ans)
                        </label>
                        <div className="flex items-center gap-2 bg-white border-2 border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                          <button type="button"
                            onClick={() => setNewNeed(p => ({...p, expRequired: Math.max(0, p.expRequired - 1)}))}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange hover:text-white font-black text-lg flex items-center justify-center transition-all">−</button>
                          <span className="flex-1 text-center font-black text-navy text-xl">{newNeed.expRequired}</span>
                          <button type="button"
                            onClick={() => setNewNeed(p => ({...p, expRequired: p.expRequired + 1}))}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange hover:text-white font-black text-lg flex items-center justify-center transition-all">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">
                          Urgence
                        </label>
                        <div className="flex gap-2">
                          {(dynUrgencies.length > 0
                            ? dynUrgencies
                            : [{value:'low',label:'Basse'},{value:'medium',label:'Moyenne'},{value:'high',label:'Haute'}]
                          ).map(u => (
                            <button key={u.value} type="button"
                              onClick={() => setNewNeed(p => ({...p, urgency: u.value as any}))}
                              className={`flex-1 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wide transition-all border-2 ${
                                newNeed.urgency === u.value
                                  ? u.value === 'high'
                                    ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                                    : u.value === 'medium'
                                    ? 'bg-orange text-white border-orange shadow-lg shadow-orange/20'
                                    : 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20'
                                  : 'bg-white text-gray-300 border-gray-100 hover:border-gray-200'
                              }`}>
                              {u.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3 — Détails */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-7 h-7 rounded-xl bg-[#0F172A] flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-orange" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-navy/40">
                        Compétences & description
                      </p>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {/* Délai — date picker + raccourcis */}
                    <div className="group">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange">
                        Délai souhaité
                      </label>
                      <div className="flex gap-3 flex-wrap">
                        {[
                          { label: '1 sem.', days: 7 },
                          { label: '1 mois', days: 30 },
                          { label: '3 mois', days: 90 },
                        ].map(({ label, days }) => {
                          const d = new Date(); d.setDate(d.getDate() + days);
                          const val = d.toISOString().split('T')[0];
                          return (
                            <button key={label} type="button"
                              onClick={() => setNewNeed(p => ({ ...p, deadline: val }))}
                              className={`px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wide border-2 transition-all ${
                                newNeed.deadline === val
                                  ? 'bg-orange text-white border-orange shadow-md shadow-orange/20'
                                  : 'bg-white text-gray-400 border-gray-100 hover:border-orange/30'
                              }`}>
                              {label}
                            </button>
                          );
                        })}
                        <input
                          type="date" value={newNeed.deadline}
                          onChange={e => setNewNeed({...newNeed, deadline: e.target.value})}
                          className="flex-1 min-w-[140px] bg-white px-4 py-2 rounded-xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy transition-all shadow-sm text-sm"
                        />
                      </div>
                    </div>

                    {/* Diplôme + Salaire */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange">
                          💼 Diplôme requis
                        </label>
                        <select value={newNeed.diplomaRequired} onChange={e => setNewNeed({...newNeed, diplomaRequired: e.target.value})}
                          className="w-full bg-white px-4 py-3 rounded-xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy text-sm transition-all appearance-none shadow-sm">
                          <option value="">Non requis</option>
                          {dynDiplomas.length > 0
                            ? dynDiplomas.map(d => <option key={d.id} value={d.value}>{d.label}</option>)
                            : ['BEP / CAP','Baccalauréat','BTS / DUT','Licence / Bachelor','Master / Ingénieur','Doctorat'].map(d => <option key={d} value={d}>{d}</option>)
                          }
                        </select>
                      </div>
                      <div className="group">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange">
                          💰 Fourchette salaire (DJF)
                        </label>
                        <select value={newNeed.salaryRange} onChange={e => setNewNeed({...newNeed, salaryRange: e.target.value})}
                          className="w-full bg-white px-4 py-3 rounded-xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy text-sm transition-all appearance-none shadow-sm">
                          <option value="">Non précisé</option>
                          {dynSalaries.length > 0
                            ? dynSalaries.map(s => <option key={s.id} value={s.value}>{s.label}</option>)
                            : [
                              '71 000 - 80 000 DJF',
                              '80 000 - 110 000 DJF',
                              '110 000 - 140 000 DJF',
                              '140 000 - 170 000 DJF',
                              '170 000 - 205 000 DJF',
                              '205 000 - 250 000 DJF',
                              '250 000 - 300 000 DJF',
                              '300 000 - 400 000 DJF',
                              '400 000 - 500 000 DJF',
                              '500 000+ DJF',
                            ].map(s => <option key={s} value={s}>{s}</option>)
                          }
                        </select>
                      </div>
                    </div>

                    {/* Compétences clés — tags interactifs */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block">
                        Compétences clés
                      </label>

                      {/* Tags sélectionnés */}
                      {selectedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {selectedSkills.map(skill => (
                            <span key={skill}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white rounded-xl font-black text-[11px]">
                              {skill}
                              <button type="button" onClick={() => removeSkill(skill)}
                                className="w-4 h-4 rounded-full bg-white/20 hover:bg-red-400 flex items-center justify-center transition-all text-[10px]">
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Input + bouton ajouter */}
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={skillInput}
                          onChange={e => setSkillInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput); } }}
                          placeholder="Taper une compétence + Entrée..."
                          className="flex-1 bg-white px-4 py-3 rounded-xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy placeholder:text-gray-300 text-sm transition-all shadow-sm"
                        />
                        <button type="button" onClick={() => addSkill(skillInput)}
                          className="px-4 py-3 rounded-xl bg-navy text-white font-black text-sm hover:bg-orange transition-all shadow-sm">
                          +
                        </button>
                      </div>

                      {/* Suggestions par secteur */}
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-2 ml-1">
                          Suggestions · {newNeed.sector}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(SKILLS_BY_SECTOR[newNeed.sector] || SKILLS_BY_SECTOR['admin']).map(skill => (
                            <button key={skill} type="button"
                              onClick={() => addSkill(skill)}
                              disabled={selectedSkills.includes(skill)}
                              className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-all border-2 ${
                                selectedSkills.includes(skill)
                                  ? 'bg-gray-50 text-gray-200 border-gray-50 cursor-not-allowed'
                                  : 'bg-white text-gray-500 border-gray-100 hover:border-orange hover:text-orange hover:shadow-sm'
                              }`}>
                              + {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="group">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-1.5 block transition-colors group-focus-within:text-orange">
                        {t.modals.describeProfile}
                      </label>
                      <textarea
                        rows={4} required
                        value={newNeed.description}
                        onChange={e => setNewNeed({...newNeed, description: e.target.value})}
                        placeholder="Décrivez le profil recherché, les missions, le contexte..."
                        className="w-full bg-white px-5 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-orange font-bold text-navy placeholder:text-gray-300 transition-all shadow-sm resize-none h-32 leading-relaxed"
                      />
                    </div>
                  </div>
                </form>
              </div>

              {/* ── Sticky footer ── */}
              <div className="shrink-0 px-10 pt-4 pb-6 border-t border-gray-100" style={{ background: '#FBFBFE' }}>
                {/* Barre de progression */}
                {(() => {
                  const fields = [newNeed.jobTitle, newNeed.sector, newNeed.needType, newNeed.description, selectedSkills.length > 0 ? 'ok' : ''];
                  const filled = fields.filter(Boolean).length;
                  const pct = Math.round((filled / fields.length) * 100);
                  return (
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Complétion</span>
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
                <div className="text-[10px] text-gray-400 font-bold">
                  <span className="text-navy font-black">{newNeed.jobTitle || '—'}</span>
                  {newNeed.sector && <span className="ml-2 px-2.5 py-1 bg-orange/10 text-orange rounded-lg">{newNeed.sector}</span>}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowAddNeed(false); setSelectedSkills([]); setSkillInput(''); }}
                    className="px-6 py-3.5 rounded-2xl font-black text-sm text-gray-400 hover:bg-gray-100 transition-all">
                    Annuler
                  </button>
                  <button type="submit" form="need-form" disabled={submitting}
                    className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-black text-sm text-white shadow-xl shadow-navy/20 hover:shadow-orange/30 hover:bg-orange transition-all disabled:opacity-50 active:scale-95"
                    style={{ background: submitting ? '#94a3b8' : '#0F172A' }}>
                    {submitting
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t.common.sending}</>
                      : <><CheckCircle2 size={16} /> {t.common.send}</>}
                  </button>
                </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Need Detail Modal ── */}
      {selectedNeed && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(10,25,47,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedNeed(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-sm w-full max-w-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gray-900 px-8 py-6 flex items-center justify-between">
              <div>
                <p className="text-gray-900 text-[10px] font-black uppercase tracking-normal mb-1">{selectedNeed.needType} — {selectedNeed.sector}</p>
                <h2 className="text-white text-2xl font-black font-semibold">{selectedNeed.jobTitle}</h2>
              </div>
              <button onClick={() => setSelectedNeed(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-gray-900 transition-all">
                ✕
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Entreprise', value: selectedNeed.companyName },
                  { label: 'Contact', value: selectedNeed.contactName },
                  { label: 'Email', value: selectedNeed.email },
                  { label: 'Téléphone', value: selectedNeed.phone || '—' },
                  { label: 'Profils recherchés', value: selectedNeed.profileCount || 1 },
                  { label: 'Expérience requise', value: selectedNeed.expRequired ? `${selectedNeed.expRequired} ans` : '—' },
                  { label: 'Statut', value: selectedNeed.status || 'new' },
                  { label: 'Date', value: selectedNeed.createdAt?.toDate?.()?.toLocaleDateString() || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-normal text-gray-400 mb-1">{label}</p>
                    <p className="text-sm font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              {selectedNeed.description && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-normal text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-900 font-medium">{selectedNeed.description}</p>
                </div>
              )}
            </div>
            <div className="px-8 pb-8">
              <button onClick={() => setSelectedNeed(null)} className="w-full py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-normal rounded-2xl hover:bg-gray-900 transition-all">
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Composants internes (inchangés)
function NavItem({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick} 
      className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all group ${active ? 'bg-gray-900 text-white shadow-lg shadow-gray-200/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
    >
      <Icon size={20} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
      <span className="truncate">{label}</span>
      {badge && (
        <div className="absolute right-4 w-5 h-5 bg-gray-900 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
          {badge}
        </div>
      )}
    </button>
  );
}

function StatCard({ title, value, change, color, data, bgColor, textColor, t }: { title: string, value: string, change: string, color: string, data: any[], bgColor: string, textColor: string, t: any }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-black text-gray-900">{value}</p>
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
          <ResponsiveContainer width="100%" height="100%" minHeight={0}>
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
    orange: 'bg-gray-100 text-gray-900 border-gray-200',
    blue: 'bg-blue-50 text-blue-500 border-blue-100',
    green: 'bg-green-50 text-green-500 border-green-100',
    purple: 'bg-gray-50 text-purple-500 border-purple-100',
  };
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 rounded-[28px] border ${colors[color]} hover:shadow-lg hover:bg-white transition-all space-y-2 group shadow-sm`}
    >
      <div className={`p-2 rounded-xl bg-white shadow-sm group-hover:scale-110 transition-transform`}>
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
    'Ongoing': 'bg-gray-600/10 text-blue-500 border-blue-100',
    'New': 'bg-gray-900-500/10 text-gray-900-500 border-gray-300-100',
  };
  const statusLabel = status === 'Accepted' ? t.admin.accepted : status === 'Ongoing' ? t.admin.ongoing : t.admin.newStatus;
  return (
    <div className="flex flex-wrap items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 group hover:bg-white hover:border-gray-200 hover:shadow-md transition-all gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-[200px]">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-gray-100">
          <img src={logo} className="max-w-full max-h-full object-contain" alt={company} referrerPolicy="no-referrer" />
        </div>
        <div>
          <p className="text-sm font-black text-gray-900">{company}</p>
          <p className="text-xs text-gray-400 font-bold">{role}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 md:gap-8 flex-wrap">
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${statusStyles[status]}`}>
          {statusLabel}
        </span>
        <div className="text-[10px] text-gray-400 font-bold text-center">
          <p className="uppercase tracking-normal">{time.split(' ')[0]}</p>
          <p>{time.split(' ')[1]}</p>
        </div>

        <button className="text-gray-300 hover:text-gray-900 transition-colors"><MoreVertical size={18} /></button>
      </div>
    </div>
  );
};

// ── NeedsTab sub-component to avoid IIFE in JSX ──────────────────────────
const sectorColors: Record<string, string> = {
  btp: '#f97316', logistics: '#3b82f6', hospitality: '#f59e0b',
  security: '#8b5cf6', healthcare: '#10b981', admin: '#6366f1',
  catering: '#ec4899', commerce: '#14b8a6', it: '#0ea5e9', finance: '#84cc16',
};

function NeedsTab({ needs, loading, searchQuery, recruiterProfile, needsPage, setNeedsPage, needsPerPage, setNeedsPerPage, setShowAddNeed, setSelectedNeed, t }: any) {
  const filtered = needs.filter((n: any) =>
    !searchQuery ||
    n.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / needsPerPage));
  const paginated = filtered.slice((needsPage - 1) * needsPerPage, needsPage * needsPerPage);
  const active = needs.filter((n: any) => n.status !== 'archived' && n.status !== 'expired' && n.status !== 'draft').length;
  const draft = needs.filter((n: any) => n.status === 'draft').length;
  const expired = needs.filter((n: any) => n.status === 'expired').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t.admin.recruitmentDemands || 'Catalogue des Demandes'}</h1>
          <p className="text-gray-400 text-sm mt-1">{t.admin.manageDemandsDesc || 'Gérez vos postes ouverts et besoins en personnel'}</p>
        </div>
        <button onClick={() => setShowAddNeed(true)} className="flex items-center gap-2 bg-navy text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wide shadow-lg hover:bg-orange transition-all">
          <Plus size={18} /> {t.admin.newDemand || 'Publier une demande'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Demandes', value: needs.length, color: '#6366f1' },
          { label: 'Actives', value: active, color: '#10b981' },
          { label: 'Brouillon', value: draft, color: '#f59e0b' },
          { label: 'Expirées', value: expired, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + '15' }}>
                <Briefcase size={16} style={{ color: s.color }} />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{s.label}</span>
            </div>
            <p className="text-3xl font-black text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 font-bold animate-pulse">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="mx-auto text-gray-200 mb-4" size={48} />
            <p className="text-lg font-black text-gray-400 uppercase">Aucune demande trouvée</p>
            <button onClick={() => setShowAddNeed(true)} className="mt-3 text-navy font-bold hover:underline text-sm">+ Créer la première demande</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
              {['POSTE & TYPE','ENTREPRISE','SECTEUR','DATE','STATUT','ACTIONS'].map((h, i) => (
                <div key={h} className={`text-[10px] font-black text-gray-400 uppercase tracking-widest ${i===0?'col-span-4':i===1?'col-span-2':i===5?'col-span-1 text-right':'col-span-2'}`}>{h}</div>
              ))}
            </div>

            {paginated.map((need: any) => {
              const sColor = sectorColors[need.sector] || '#6b7280';
              const isActive = need.status !== 'archived' && need.status !== 'expired' && need.status !== 'draft';
              return (
                <div key={need.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors items-center group">
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sColor+'15' }}>
                      <Briefcase size={16} style={{ color: sColor }} />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-sm">{need.jobTitle || 'Sans titre'}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{need.needType||'CDI'} • {need.location||'DJIBOUTI'}</p>
                    </div>
                  </div>
                  <div className="col-span-2"><p className="text-sm font-bold text-gray-700">{need.companyName || recruiterProfile?.companyName || '—'}</p></div>
                  <div className="col-span-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase" style={{ background: sColor+'15', color: sColor }}>{need.sector?.toUpperCase()||'N/A'}</span>
                  </div>
                  <div className="col-span-2"><p className="text-sm text-gray-400">{need.createdAt?.toDate?.()?.toLocaleDateString('fr-FR')||'—'}</p></div>
                  <div className="col-span-1">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-fit ${isActive?'bg-green-50 text-green-600':need.status==='draft'?'bg-yellow-50 text-yellow-600':'bg-red-50 text-red-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive?'bg-green-500':need.status==='draft'?'bg-yellow-500':'bg-red-400'}`} />
                      {isActive?'Online':need.status==='draft'?'Draft':'Expiré'}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => setSelectedNeed(need)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-400">Showing {(needsPage-1)*needsPerPage+1} to {Math.min(needsPage*needsPerPage, filtered.length)} of {filtered.length} results</p>
              <div className="flex items-center gap-2">
                <select value={needsPerPage} onChange={e => { setNeedsPerPage(Number(e.target.value)); setNeedsPage(1); }} className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 outline-none mr-4">
                  {[5,10,20].map(v => <option key={v} value={v}>{v} / page</option>)}
                </select>
                <button onClick={() => setNeedsPage((p: number) => Math.max(1, p-1))} disabled={needsPage===1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-gray-400 disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => i+1).map(p => (
                  <button key={p} onClick={() => setNeedsPage(p)} className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${needsPage===p?'bg-navy text-white':'border border-gray-200 text-gray-500 hover:border-gray-400'}`}>{p}</button>
                ))}
                {totalPages > 6 && <span className="text-gray-400">...</span>}
                {totalPages > 6 && <button onClick={() => setNeedsPage(totalPages)} className={`w-8 h-8 rounded-lg text-xs font-black border ${needsPage===totalPages?'bg-navy text-white':'border-gray-200 text-gray-500'}`}>{totalPages}</button>}
                <button onClick={() => setNeedsPage((p: number) => Math.min(totalPages, p+1))} disabled={needsPage===totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-gray-400 disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}