import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Briefcase, FileText, Settings, LogOut, 
  Search, Bell, CheckCircle2, CheckCircle, Clock, X, Eye,
  LayoutDashboard, Send, MapPin, Calendar, ArrowRight,
  TrendingUp, Activity, MessageSquare, ShieldCheck, Star,
  AlertCircle, MoreVertical, Upload, Download, Loader
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { auth, db } from '../lib/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useTranslation } from '../lib/i18n';
import { 
  collection, query, where, orderBy, onSnapshot, doc, setDoc, addDoc, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { 
  signInWithPopup as authSignInWithPopup, GoogleAuthProvider, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification
} from 'firebase/auth';
import {
  getDocs
} from 'firebase/firestore';

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

export default function CandidatePanel({ onBack }: CandidatePanelProps) {
  const { lang, setLang, t, dir } = useTranslation();

  const [user, setUser] = useState(auth.currentUser);
  const [authLoading, setAuthLoading] = useState(!auth.currentUser); // true until Firebase resolves
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUrl, setCvUrl] = useState<string>('');
  const [cvFileName, setCvFileName] = useState<string>('');
  const [cvUploading, setCvUploading] = useState(false);
  const [cvUploadProgress, setCvUploadProgress] = useState(0);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [idUrl, setIdUrl] = useState<string>('');
  const [idFileName, setIdFileName] = useState<string>('');
  const [idUploading, setIdUploading] = useState(false);
  const [idUploadProgress, setIdUploadProgress] = useState(0);
  const [idDocType, setIdDocType] = useState<'passport' | 'id_card'>('id_card');
  const idInputRef = useRef<HTMLInputElement>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'offers' | 'favorites' | 'messages' | 'profile' | 'settings'>('dashboard');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [notifSettings, setNotifSettings] = useState({ jobAlerts: true, liveStatus: true, pushMsg: false });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  // ── Login mode states
  const [loginTab, setLoginTab] = useState<'google' | 'email' | 'id'>('google');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginConfirm, setLoginConfirm] = useState('');
  const [loginMode, setLoginMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [tempId, setTempId] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginResetSent, setLoginResetSent] = useState(false);
  const [gmailRequired, setGmailRequired] = useState(false);
  const [gmailInput, setGmailInput] = useState('');
  const [gmailSent, setGmailSent] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [savingOnboarding, setSavingOnboarding] = useState(false);

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

  // ── Options dynamiques depuis Firestore ──
  const [dynEducations, setDynEducations] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynAvailabilities, setDynAvailabilities] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynSectors, setDynSectors] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynNationalities, setDynNationalities] = useState<{id:string; value:string; label:string}[]>([]);
  const [dynLanguagesList, setDynLanguagesList] = useState<{id:string; value:string; label:string}[]>([]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthLoading(false); // BUG 8 FIX: Firebase resolved
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, 'settings_educations'), orderBy('order', 'asc')), snap => setDynEducations(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
      onSnapshot(query(collection(db, 'settings_availabilities'), orderBy('order', 'asc')), snap => setDynAvailabilities(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
      onSnapshot(query(collection(db, 'settings_sectors'), orderBy('order', 'asc')), snap => setDynSectors(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
      onSnapshot(query(collection(db, 'settings_nationalities'), orderBy('order', 'asc')), snap => setDynNationalities(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
      onSnapshot(query(collection(db, 'settings_languages'), orderBy('order', 'asc')), snap => setDynLanguagesList(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))),
    ];
    return () => unsubs.forEach(u => u());
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
    const unsubscribeProfile = onSnapshot(doc(db, 'candidateProfiles', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({ id: docSnap.id, ...data });
        setSavedJobs(data.savedJobs || []);
        if (data.cvUrl) { setCvUrl(data.cvUrl); setCvFileName(data.cvFileName || 'CV.pdf'); }
        if (data.idUrl) { setIdUrl(data.idUrl); setIdFileName(data.idFileName || 'ID.pdf'); setIdDocType(data.idDocType || 'id_card'); }
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
        // Chercher aussi dans la collection 'candidates' (compte créé par admin)
        try {
          const { getDoc } = await import('firebase/firestore');
          const candidateDoc = await getDoc(doc(db, 'candidates', user.uid));
          if (candidateDoc.exists()) {
            const data = candidateDoc.data();
            setProfileForm(prev => ({
              ...prev,
              fullName: data.fullName || data.displayName || user.displayName || '',
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
            return;
          }
        } catch (e) {}
        // Nouveau utilisateur — déclencher l'onboarding
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
        setIsNewUser(true);
        setOnboardingStep(1);
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
        ...(cvUrl && { cvUrl, cvFileName }),
        ...(idUrl && { idUrl, idFileName, idDocType }),
        updatedAt: serverTimestamp()
      }, { merge: true });
      // Sync to users collection for admin visibility
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: profileForm.fullName,
        fullName: profileForm.fullName,
        phone: profileForm.phone || '',
        ...(cvUrl && { cvUrl, cvFileName }),
        updatedAt: serverTimestamp(),
      }).catch(() => {}); // ignore if doc doesn't exist yet
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

  const handleCvUpload = async (file: File) => {
    if (!user || !file) return;
    setCvUploading(true);
    setCvUploadProgress(0);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `cvs/${user.uid}/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setCvUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error('Upload error:', error);
          setNotification({ message: lang === 'FR' ? 'Erreur upload CV' : 'CV upload error', type: 'error' });
          setCvUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setCvUrl(downloadURL);
          setCvFileName(file.name);
          // Save immediately to Firestore
          await updateDoc(doc(db, 'candidateProfiles', user.uid), {
            cvUrl: downloadURL,
            cvFileName: file.name,
            cvUpdatedAt: serverTimestamp(),
          }).catch(() => {});
          await updateDoc(doc(db, 'users', user.uid), {
            cvUrl: downloadURL,
            cvFileName: file.name,
          }).catch(() => {});
          setCvUploading(false);
          setNotification({ message: lang === 'FR' ? 'CV uploadé avec succès !' : 'CV uploaded successfully!', type: 'success' });
          setTimeout(() => setNotification(null), 3000);
        }
      );
    } catch (error) {
      console.error('CV upload error:', error);
      setCvUploading(false);
    }
  };

  const handleIdUpload = async (file: File) => {
    if (!user || !file) return;
    setIdUploading(true);
    setIdUploadProgress(0);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `ids/${user.uid}/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed',
        (snapshot) => {
          setIdUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        },
        (error) => {
          console.error('ID upload error:', error);
          setNotification({ message: lang === 'FR' ? 'Erreur upload pièce d\'identité' : 'ID upload error', type: 'error' });
          setIdUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setIdUrl(downloadURL);
          setIdFileName(file.name);
          await updateDoc(doc(db, 'candidateProfiles', user.uid), {
            idUrl: downloadURL,
            idFileName: file.name,
            idDocType,
            idUpdatedAt: serverTimestamp(),
          }).catch(() => {});
          await updateDoc(doc(db, 'users', user.uid), {
            idUrl: downloadURL,
            idFileName: file.name,
            idDocType,
          }).catch(() => {});
          setIdUploading(false);
          setNotification({ message: lang === 'FR' ? 'Pièce d\'identité uploadée !' : 'ID document uploaded!', type: 'success' });
          setTimeout(() => setNotification(null), 3000);
        }
      );
    } catch (error) {
      console.error('ID upload error:', error);
      setIdUploading(false);
    }
  };

  const handleSaveOnboarding = async () => {
    if (!user) return;
    setSavingOnboarding(true);
    try {
      await setDoc(doc(db, 'candidateProfiles', user.uid), {
        ...profileForm,
        email: user.email,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        profileComplete: true,
      }, { merge: true });
      // Mettre à jour aussi la collection users pour que l'admin voit le profil complet
      const { doc: d2, setDoc: sd, getDoc: gd } = await import('firebase/firestore');
      await sd(d2(db, 'users', user.uid), {
        displayName: profileForm.fullName,
        phone: profileForm.phone || '',
        profileComplete: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setIsNewUser(false);
      setNotification({ message: lang === 'FR' ? 'Profil créé avec succès ! Bienvenue 🎉' : 'Profile created! Welcome 🎉', type: 'success' });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      console.error('Onboarding save error:', error);
      setNotification({ message: 'Erreur lors de la sauvegarde', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
    setSavingOnboarding(false);
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
      const result = await authSignInWithPopup(auth, provider);
      const u = result.user;
      // Vérifier si déjà enregistré dans Firestore
      const { getDoc: gd, doc: d2, setDoc: sd } = await import('firebase/firestore');
      const userRef = d2(db, 'users', u.uid);
      const userSnap = await gd(userRef);
      if (!userSnap.exists()) {
        // Première connexion Google → créer dans 'users'
        await sd(userRef, {
          uid: u.uid,
          firebaseUid: u.uid,
          email: u.email || '',
          displayName: u.displayName || '',
          photoURL: u.photoURL || '',
          role: 'candidate',
          status: 'active',
          loginMethod: 'google',
          createdAt: serverTimestamp(),
          gmailConfirmed: true,
          profileComplete: false,
        });
        // BUG 3 FIX: Also create empty candidateProfiles so listeners don't fail
        const profileRef = d2(db, 'candidateProfiles', u.uid);
        const profileSnap = await gd(profileRef);
        if (!profileSnap.exists()) {
          await sd(profileRef, {
            uid: u.uid,
            email: u.email || '',
            fullName: u.displayName || '',
            profileComplete: false,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) { setLoginError('Veuillez remplir tous les champs.'); return; }
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error: any) {
      const codes: Record<string, string> = {
        'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/invalid-credential': 'Email ou mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
        'auth/invalid-email': 'Format email invalide.',
      };
      setLoginError(codes[error.code] || 'Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) { setLoginError('Veuillez remplir tous les champs.'); return; }
    if (loginPassword !== loginConfirm) { setLoginError('Les mots de passe ne correspondent pas.'); return; }
    if (loginPassword.length < 6) { setLoginError('Mot de passe minimum 6 caractères.'); return; }
    setLoginLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
      const u = cred.user;

      // BUG 7 FIX: Send email verification
      await sendEmailVerification(u);

      // Save to Firestore
      const { doc: d2, setDoc: sd } = await import('firebase/firestore');
      await sd(d2(db, 'users', u.uid), {
        uid: u.uid,
        firebaseUid: u.uid,
        email: u.email || loginEmail,
        displayName: u.displayName || '',
        role: 'candidate',
        status: 'active',
        loginMethod: 'email',
        createdAt: serverTimestamp(),
        gmailConfirmed: false,
        profileComplete: false,
        emailVerified: false,
      });
      // Also create empty candidateProfiles (BUG 3 FIX)
      await sd(d2(db, 'candidateProfiles', u.uid), {
        uid: u.uid,
        email: u.email || loginEmail,
        fullName: '',
        profileComplete: false,
        createdAt: serverTimestamp(),
      });

      setLoginError('');
      // Show verification message
      setLoginResetSent(true); // reuse this state to show success message
    } catch (error: any) {
      const codes: Record<string, string> = {
        'auth/email-already-in-use': 'Cet email est déjà utilisé.',
        'auth/invalid-email': 'Format email invalide.',
        'auth/weak-password': 'Mot de passe trop faible.',
      };
      setLoginError(codes[error.code] || 'Erreur lors de la création du compte.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail) { setLoginError('Entrez votre adresse email.'); return; }
    setLoginLoading(true);
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      setLoginResetSent(true);
    } catch (error: any) {
      setLoginError('Email introuvable ou invalide.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleTempIdLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!tempId || !tempPassword) { setLoginError(`Veuillez remplir l'identifiant et le mot de passe.`); return; }
    if (!tempId.startsWith('VGM-')) { setLoginError('Format invalide. Exemple : VGM-2025-0034'); return; }
    setLoginLoading(true);
    try {
      // Look up the temp email from Firestore
      const q = query(collection(db, 'users'), where('tempId', '==', tempId));
      const snap = await getDocs(q);
      if (snap.empty) {
        setLoginError('Identifiant VGM introuvable. Contactez Vedior GM.');
        setLoginLoading(false);
        return;
      }
      const userData = snap.docs[0].data();
      const tempEmail = userData.tempEmail || `${tempId.toLowerCase()}@vediorgm.temp`;
      await signInWithEmailAndPassword(auth, tempEmail, tempPassword);
      // If first login, require Gmail confirmation
      if (!userData.gmailConfirmed) {
        setGmailRequired(true);
      }
    } catch (error: any) {
      const codes: Record<string, string> = {
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/invalid-credential': 'Identifiant ou mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
      };
      setLoginError(codes[error.code] || 'Erreur de connexion. Vérifiez vos identifiants.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGmailConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailInput.includes('@')) { setLoginError('Email invalide.'); return; }
    setLoginLoading(true);
    try {
      await sendPasswordResetEmail(auth, gmailInput);
      setGmailSent(true);
      // Update Firestore
      if (auth.currentUser) {
        const q = query(collection(db, 'users'), where('tempId', '==', tempId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const { updateDoc: ud, doc: d } = await import('firebase/firestore');
          await ud(d(db, 'users', snap.docs[0].id), { gmailPending: gmailInput });
        }
      }
    } catch (err) {
      setLoginError(`Erreur lors de l'envoi. Vérifiez votre email.`);
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => signOut(auth).then(() => onBack());

  // Garde : traductions pas encore disponibles
  if (!t || !t.admin) return null;

  // BUG 8 FIX: Show loading screen while Firebase resolves auth state
  if (authLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0A192F', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(249,115,22,0.3)', borderTop: '4px solid #f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  // ── Gmail confirmation screen (after ID login)
  if (user && gmailRequired && !gmailSent) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl relative z-10 text-center">
          <div className="mb-6 flex justify-center"><Logo /></div>
          <div className="w-16 h-16 bg-orange/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={32} className="text-orange" />
          </div>
          <h2 className="text-2xl font-black text-navy uppercase italic tracking-tighter mb-3">
            {lang === 'FR' ? 'Sécurisez votre compte' : 'Secure your account'}
          </h2>
          <p className="text-navy/50 font-bold mb-8 text-sm leading-relaxed">
            {lang === 'FR'
              ? `Votre compte a été créé avec l'identifiant ${tempId}. Confirmez votre Gmail pour sécuriser l'accès.`
              : `Your account was created with ID ${tempId}. Confirm your Gmail to secure access.`}
          </p>
          {/* Gmail button */}
          <button onClick={login}
            className="w-full bg-navy text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-orange transition-all shadow-xl shadow-navy/10 active:scale-95 mb-4">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
            {lang === 'FR' ? 'Confirmer avec Google' : 'Confirm with Google'}
          </button>
          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-navy/10" />
            <span className="text-[10px] font-black text-navy/30 uppercase tracking-widest">{lang === 'FR' ? 'ou' : 'or'}</span>
            <div className="flex-1 h-px bg-navy/10" />
          </div>
          <form onSubmit={handleGmailConfirm} className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-navy/40 mb-2">
              {lang === 'FR' ? 'Entrez votre adresse email' : 'Enter your email address'}
            </p>
            <input type="email" placeholder="votre.email@gmail.com" value={gmailInput}
              onChange={e => setGmailInput(e.target.value)}
              className="w-full border-2 border-navy/10 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-orange mb-3" />
            {loginError && <p className="text-red-500 text-xs font-bold mb-3">⚠️ {loginError}</p>}
            <button type="submit" disabled={loginLoading}
              className="w-full bg-orange text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-navy transition-all shadow-xl shadow-orange/20 active:scale-95 disabled:opacity-50">
              {loginLoading ? '...' : lang === 'FR' ? 'Envoyer le lien →' : 'Send link →'}
            </button>
          </form>
          <button onClick={() => setGmailRequired(false)} className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-navy/30 hover:text-orange transition-colors">
            {lang === 'FR' ? `Ignorer pour l'instant` : 'Skip for now'}
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Gmail confirmation sent screen
  if (user && gmailRequired && gmailSent) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl relative z-10 text-center">
          <div className="mb-6 flex justify-center"><Logo /></div>
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-black text-navy uppercase italic tracking-tighter mb-3">
            {lang === 'FR' ? 'Email envoyé !' : 'Email sent!'}
          </h2>
          <p className="text-navy/50 font-bold mb-8 text-sm leading-relaxed">
            {lang === 'FR'
              ? `Un lien de confirmation a été envoyé à ${gmailInput}. Vérifiez votre boîte mail.`
              : `A confirmation link has been sent to ${gmailInput}. Check your inbox.`}
          </p>
          <button onClick={() => { setGmailRequired(false); setGmailSent(false); }}
            className="w-full bg-navy text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-orange transition-all">
            {lang === 'FR' ? 'Accéder à mon espace →' : 'Access my space →'}
          </button>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    const N = '#050E1A';
    const O = '#F97316';
    const W = '#FFFFFF';

    const iStyle: React.CSSProperties = {
      width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(249,115,22,0.2)',
      color: W, padding: '15px 20px 15px 48px', borderRadius: 14, outline: 'none',
      fontSize: 15, fontWeight: 500, boxSizing: 'border-box', transition: 'border 0.2s',
    };
    const lStyle: React.CSSProperties = {
      fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8,
    };
    const tabLabel = lang === 'FR'
      ? { google: 'Gmail', email: 'Email', id: 'ID VGM' }
      : lang === 'EN'
      ? { google: 'Gmail', email: 'Email', id: 'VGM ID' }
      : { google: 'جيميل', email: 'بريد', id: 'هوية VGM' };

    return (
      <div style={{ position: 'fixed', inset: 0, background: N, zIndex: 200, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>

        {/* Background grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(249,115,22,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.03) 1px, transparent 1px)', backgroundSize: '50px 50px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 700, height: 700, background: 'radial-gradient(circle, rgba(249,115,22,0.12), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,87,168,0.2), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

          {/* ══ LEFT PANEL ══ */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 72px' }}>
            <div style={{ marginBottom: 52 }}>
              <Logo inverted size="lg" />
              <div style={{ width: 60, height: 3, background: `linear-gradient(90deg, ${O}, transparent)`, borderRadius: 2, marginTop: 12 }} />
            </div>

            <h1 style={{ fontSize: 44, fontWeight: 900, color: W, lineHeight: 1.1, letterSpacing: '-2px', marginBottom: 20 }}>
              {lang === 'FR' ? <><span>Trouvez votre</span><br /><span style={{ color: O }}>prochain emploi</span></> :
               lang === 'EN' ? <><span>Find your</span><br /><span style={{ color: O }}>next opportunity</span></> :
               <><span>ابحث عن</span><br /><span style={{ color: O }}>فرصتك القادمة</span></>}
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, maxWidth: 400, marginBottom: 48 }}>
              {lang === 'FR' ? "Accédez aux meilleures offres d'emploi à Djibouti. Déposez votre CV et laissez nos experts vous accompagner." :
               lang === 'EN' ? 'Access the best job offers in Djibouti. Upload your CV and let our experts guide you.' :
               'الوصول إلى أفضل عروض العمل في جيبوتي. ارفع سيرتك الذاتية ودع خبراءنا يرشدونك.'}
            </p>

            {/* Visual dots */}
            <div style={{ position: 'relative', marginBottom: 48, height: 100, overflow: 'hidden' }}>
              <svg viewBox="0 0 500 100" style={{ width: '100%', opacity: 0.15 }}>
                {Array.from({length: 60}).map((_, i) => (
                  <circle key={i} cx={(i % 15) * 34 + 8} cy={Math.floor(i / 15) * 26 + 8} r={1.5} fill={O} opacity={i % 3 === 0 ? 1 : 0.3} />
                ))}
                <line x1="80" y1="50" x2="220" y2="30" stroke={O} strokeWidth="0.8" opacity="0.5" strokeDasharray="4,4" />
                <line x1="220" y1="30" x2="380" y2="60" stroke={O} strokeWidth="0.8" opacity="0.5" strokeDasharray="4,4" />
                <circle cx="80" cy="50" r="5" fill={O} opacity="0.9" />
                <circle cx="220" cy="30" r="5" fill={O} opacity="0.9" />
                <circle cx="380" cy="60" r="5" fill={O} opacity="0.9" />
              </svg>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
              {([
                ['500+', lang === 'FR' ? 'Talents placés' : lang === 'EN' ? 'Placed talents' : 'موهبة موظفة', '👥'],
                ['15+',  lang === 'FR' ? "Ans d'expérience" : lang === 'EN' ? 'Years exp.' : 'سنة خبرة', '💼'],
                ['🇩🇯',  'Djibouti', '📍'],
              ] as [string,string,string][]).map(([n, l, icon]) => (
                <div key={l} style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 16, padding: '18px 16px' }}>
                  <div style={{ fontSize: 11, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: O, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Trust badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(lang === 'FR'
                ? ['✅ Candidature gratuite et confidentielle', '✅ Suivi de dossier en temps réel', '✅ Experts RH locaux dédiés']
                : lang === 'EN'
                ? ['✅ Free and confidential application', '✅ Real-time application tracking', '✅ Dedicated local HR experts']
                : ['✅ تقديم مجاني وسري', '✅ متابعة الملف في الوقت الفعلي', '✅ خبراء موارد بشرية متخصصون']
              ).map(label => (
                <div key={label} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>{label}</div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              © 2026 Vedior GM — {lang === 'FR' ? 'Plateforme de recrutement à Djibouti' : lang === 'EN' ? 'Recruitment platform in Djibouti' : 'منصة التوظيف في جيبوتي'}
            </div>
          </div>

          {/* ══ RIGHT PANEL ══ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 60px' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(32px)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 28, padding: '48px 48px', width: '100%', maxWidth: 540, boxShadow: '0 0 80px rgba(249,115,22,0.06), 0 40px 100px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, ${O}, transparent)` }} />
              <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 300, height: 200, background: 'radial-gradient(circle, rgba(249,115,22,0.12), transparent 70%)', pointerEvents: 'none' }} />

              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Logo inverted size="lg" /></div>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: W, letterSpacing: '-0.5px', marginBottom: 8 }}>
                  {lang === 'FR' ? <span>ESPACE <span style={{ color: O }}>CANDIDAT</span></span> :
                   lang === 'EN' ? <span>CANDIDATE <span style={{ color: O }}>SPACE</span></span> :
                   <span><span style={{ color: O }}>مساحة</span> المرشح</span>}
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  {lang === 'FR' ? 'Choisissez votre mode de connexion' :
                   lang === 'EN' ? 'Choose your login method' : 'اختر طريقة تسجيل الدخول'}
                </p>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, marginBottom: 28, gap: 4 }}>
                {(['google', 'id'] as const).map(tab => (
                  <button key={tab} onClick={() => { setLoginTab(tab); setLoginError(''); setLoginResetSent(false); }}
                    style={{ flex: 1, padding: '11px 8px', borderRadius: 10, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: loginTab === tab ? O : 'transparent', color: loginTab === tab ? W : 'rgba(255,255,255,0.3)', boxShadow: loginTab === tab ? '0 4px 20px rgba(249,115,22,0.35)' : 'none' }}>
                    <span>{tab === 'google' ? '🔑' : '🪪'}</span>
                    {tabLabel[tab]}
                  </button>
                ))}
              </div>

              {loginError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 12, padding: '13px 16px', marginBottom: 20, fontSize: 13, fontWeight: 700 }}>⚠️ {loginError}</div>
              )}

              {/* GOOGLE */}
              {loginTab === 'google' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 500, textAlign: 'center', lineHeight: 1.6 }}>
                    {lang === 'FR' ? 'Connexion rapide et sécurisée avec votre compte Google.' : lang === 'EN' ? 'Quick and secure login with your Google account.' : 'تسجيل دخول سريع وآمن بحساب Google.'}
                  </p>
                  <button onClick={login} disabled={loginLoading}
                    style={{ width: '100%', background: W, color: '#0A192F', padding: '18px', borderRadius: 14, fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '2px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, boxShadow: '0 8px 32px rgba(255,255,255,0.15)', transition: 'all 0.3s', opacity: loginLoading ? 0.6 : 1 }}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style={{ width: 22, height: 22 }} alt="Google" />
                    {loginLoading ? '...' : lang === 'FR' ? 'Continuer avec Google' : lang === 'EN' ? 'Continue with Google' : 'المتابعة مع Google'}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>
                      {lang === 'FR' ? 'ou' : lang === 'EN' ? 'or' : 'أو'}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                  <button onClick={() => setLoginTab('id')}
                    style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}>
                    🪪 {lang === 'FR' ? 'Connexion avec ID VGM' : lang === 'EN' ? 'Login with VGM ID' : 'دخول بهوية VGM'}
                  </button>
                </div>
              )}



              {/* ID VGM */}
              {loginTab === 'id' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 14, padding: '16px 20px' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: O, marginBottom: 6 }}>
                      🪪 {lang === 'FR' ? 'Identifiant fourni par Vedior GM' : lang === 'EN' ? 'ID provided by Vedior GM' : 'هوية مقدمة من Vedior GM'}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500, lineHeight: 1.6 }}>
                      {lang === 'FR' ? "Votre ID et mot de passe vous ont été remis par l'agence. Format : VGM-2025-XXXX" : lang === 'EN' ? 'Your ID and password were provided by the agency. Format: VGM-2025-XXXX' : 'هويتك وكلمة مرورك قُدِّمت من الوكالة. الصيغة: VGM-2025-XXXX'}
                    </p>
                  </div>
                  <div>
                    <label style={lStyle}>{lang === 'FR' ? 'Identifiant VGM' : lang === 'EN' ? 'VGM ID' : 'هوية VGM'}</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🪪</span>
                      <input placeholder="VGM-2025-0034" value={tempId} onChange={e => setTempId(e.target.value.toUpperCase())} style={{ ...iStyle, fontFamily: 'monospace', letterSpacing: 2 }} onFocus={e => e.target.style.borderColor = O} onBlur={e => e.target.style.borderColor = 'rgba(249,115,22,0.2)'} />
                    </div>
                  </div>
                  <div>
                    <label style={lStyle}>{lang === 'FR' ? 'Mot de passe temporaire' : lang === 'EN' ? 'Temporary password' : 'كلمة المرور المؤقتة'}</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔒</span>
                      <input type="password" placeholder="••••••••" value={tempPassword} onChange={e => setTempPassword(e.target.value)} style={iStyle} onFocus={e => e.target.style.borderColor = O} onBlur={e => e.target.style.borderColor = 'rgba(249,115,22,0.2)'} />
                    </div>
                  </div>
                  <button onClick={handleTempIdLogin} disabled={loginLoading} style={{ width: '100%', background: `linear-gradient(135deg, ${O}, #ea580c)`, color: W, padding: '17px', borderRadius: 14, fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '2px', border: 'none', cursor: 'pointer', opacity: loginLoading ? 0.6 : 1, boxShadow: '0 8px 32px rgba(249,115,22,0.35)', transition: 'all 0.3s' }}>
                    {loginLoading ? '...' : lang === 'FR' ? 'ACCÉDER À MON ESPACE →' : lang === 'EN' ? 'ACCESS MY SPACE →' : 'الوصول إلى مساحتي →'}
                  </button>
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                    {lang === 'FR' ? 'Identifiant perdu ? ' : lang === 'EN' ? 'Lost your ID? ' : 'فقدت هويتك؟ '}
                    <span style={{ color: O, cursor: 'pointer' }}>{lang === 'FR' ? 'Contactez Vedior GM' : lang === 'EN' ? 'Contact Vedior GM' : 'اتصل بـ Vedior GM'}</span>
                  </p>
                </div>
              )}

              <button onClick={onBack}
                style={{ width: '100%', marginTop: 24, background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = W}
                onMouseLeave={e => (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.2)'}>
                ← {lang === 'FR' ? 'Retour au portail' : lang === 'EN' ? 'Back to portal' : 'العودة إلى البوابة'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const stats = {
    total: applications.length,
    new: applications.filter(a => a.status === 'new' || !a.status).length,
    interview: applications.filter(a => a.status === 'interview').length,
    accepted: applications.filter(a => a.status === 'hired').length
  };


  // ══════════════════════════════════════════
  // ONBOARDING — Nouvel utilisateur
  // ══════════════════════════════════════════
  if (user && isNewUser) {
    const steps = [
      { num: 1, label: lang === 'FR' ? 'Identité' : 'Identity' },
      { num: 2, label: lang === 'FR' ? 'Formation' : 'Education' },
      { num: 3, label: lang === 'FR' ? 'Disponibilité' : 'Availability' },
      { num: 4, label: 'CV' },
    ];

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A192F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {/* Blobs */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 500, height: 500, backgroundColor: '#f97316', borderRadius: '50%', filter: 'blur(160px)', transform: 'translate(-50%,-50%)', opacity: 0.07, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 500, height: 500, backgroundColor: '#3b82f6', borderRadius: '50%', filter: 'blur(160px)', transform: 'translate(50%,50%)', opacity: 0.07, pointerEvents: 'none' }} />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 10 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}><Logo inverted /></div>
            <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.02em' }}>
              {lang === 'FR' ? 'Bienvenue !' : 'Welcome!'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '8px' }}>
              {lang === 'FR' ? 'Complétez votre profil pour commencer' : 'Complete your profile to get started'}
            </p>
          </div>

          {/* Progress steps */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
            {steps.map((s, i) => (
              <React.Fragment key={s.num}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: onboardingStep > s.num ? '#22c55e' : onboardingStep === s.num ? '#f97316' : 'rgba(255,255,255,0.1)',
                    color: onboardingStep >= s.num ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontWeight: 900, fontSize: '14px', transition: 'all 0.3s'
                  }}>
                    {onboardingStep > s.num ? '✓' : s.num}
                  </div>
                  <span style={{ color: onboardingStep === s.num ? '#f97316' : 'rgba(255,255,255,0.3)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: 40, height: 2, backgroundColor: onboardingStep > s.num ? '#22c55e' : 'rgba(255,255,255,0.1)', marginBottom: '18px', transition: 'all 0.3s' }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Card */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', padding: '32px' }}>

            {/* STEP 1 — Identité */}
            {onboardingStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: '#f97316', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>
                  {lang === 'FR' ? '👤 Vos informations personnelles' : '👤 Your personal information'}
                </p>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
                    {lang === 'FR' ? 'Nom complet *' : 'Full name *'}
                  </label>
                  <input value={profileForm.fullName} onChange={e => setProfileForm(p => ({...p, fullName: e.target.value}))}
                    placeholder={lang === 'FR' ? 'Mohamed Ahmed Ali' : 'Mohamed Ahmed Ali'}
                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? 'Téléphone *' : 'Phone *'}</label>
                    <input value={profileForm.phone} onChange={e => setProfileForm(p => ({...p, phone: e.target.value}))}
                      placeholder="+253 77 XX XX XX"
                      style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? 'Nationalité *' : 'Nationality *'}</label>
                    <select required value={profileForm.nationality} onChange={e => setProfileForm(p => ({...p, nationality: e.target.value}))}
                      style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark', appearance: 'none' }}>
                      <option value="" style={{backgroundColor:'#0A192F'}}>{lang === 'FR' ? 'Sélectionner *' : 'Select *'}</option>
                      {dynNationalities.length > 0
                        ? dynNationalities.map(n => <option key={n.id} value={n.value} style={{backgroundColor:'#0A192F'}}>{n.label}</option>)
                        : ['Djiboutienne','Éthiopienne','Somalienne','Érythréenne','Française','Américaine','Autre'].map(n => <option key={n} value={n} style={{backgroundColor:'#0A192F'}}>{n}</option>)
                      }
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? 'Sexe' : 'Gender'}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[{v:'M',l:lang==='FR'?'Homme':'Male'},{v:'F',l:lang==='FR'?'Femme':'Female'}].map(({v,l}) => (
                        <button key={v} type="button" onClick={() => setProfileForm(p => ({...p, gender: v}))}
                          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid', fontWeight: 900, fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
                            backgroundColor: profileForm.gender === v ? '#f97316' : 'rgba(255,255,255,0.05)',
                            borderColor: profileForm.gender === v ? '#f97316' : 'rgba(255,255,255,0.12)',
                            color: profileForm.gender === v ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? 'Date de naissance *' : 'Birth date *'}</label>
                    <input type="date" value={profileForm.birthDate} onChange={e => setProfileForm(p => ({...p, birthDate: e.target.value}))}
                      style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '13px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
                  </div>
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? 'Adresse / Quartier *' : 'Address / District *'}</label>
                  <input value={profileForm.address} onChange={e => setProfileForm(p => ({...p, address: e.target.value}))}
                    placeholder={lang === 'FR' ? 'Ex: Balbala, Djibouti Ville...' : 'Ex: Balbala, Djibouti City...'}
                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* STEP 2 — Formation */}
            {onboardingStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: '#f97316', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>
                  {lang === 'FR' ? '🎓 Formation & Expérience' : '🎓 Education & Experience'}
                </p>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? "Niveau d'études" : "Education level"}</label>
                  <select required value={profileForm.education} onChange={e => setProfileForm(p => ({...p, education: e.target.value}))}
                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}>
                    <option value="" style={{backgroundColor:'#0A192F'}}>{lang === 'FR' ? 'Sélectionner' : 'Select'}</option>
                    {dynEducations.length > 0
                      ? dynEducations.map(e => <option key={e.id} value={e.value} style={{backgroundColor:'#0A192F'}}>{e.label}</option>)
                      : ['Sans diplôme','BEP / CAP','Baccalauréat','BTS / DUT','Licence / Bachelor','Master / Ingénieur','Doctorat'].map(e => (
                          <option key={e} value={e} style={{backgroundColor:'#0A192F'}}>{e}</option>
                        ))
                    }
                  </select>
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? "Années d'expérience" : "Years of experience"}</label>
                  <select required value={profileForm.experience} onChange={e => setProfileForm(p => ({...p, experience: e.target.value}))}
                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}>
                    <option value="" style={{backgroundColor:'#0A192F'}}>{lang === 'FR' ? 'Sélectionner' : 'Select'}</option>
                    {['0 (Sans expérience)','1 - 2 ans','3 - 5 ans','6 - 10 ans','Plus de 10 ans'].map(e => (
                      <option key={e} value={e} style={{backgroundColor:'#0A192F'}}>{e}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? 'Langues parlées *' : 'Languages spoken *'}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(dynLanguagesList.length > 0
                      ? dynLanguagesList.map(l => l.value)
                      : ['Français','Arabe','Somali','Afar','Anglais','Amharique','Oromo']
                    ).map(l => {
                      const selected = profileForm.languages.split(',').map(x => x.trim()).filter(Boolean).includes(l);
                      return (
                        <button key={l} type="button"
                          onClick={() => {
                            const current = profileForm.languages.split(',').map(x => x.trim()).filter(Boolean);
                            const updated = selected ? current.filter(x => x !== l) : [...current, l];
                            setProfileForm(p => ({...p, languages: updated.join(', ')}));
                          }}
                          style={{ padding: '10px 16px', borderRadius: '12px', border: '1.5px solid', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
                            backgroundColor: selected ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.05)',
                            borderColor: selected ? '#f97316' : 'rgba(255,255,255,0.12)',
                            color: selected ? '#f97316' : 'rgba(255,255,255,0.5)' }}>
                          {selected ? '✓ ' : ''}{l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Disponibilité */}
            {onboardingStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: '#f97316', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>
                  {lang === 'FR' ? '📅 Disponibilité' : '📅 Availability'}
                </p>
                {(dynAvailabilities.length > 0
                  ? dynAvailabilities.map(a => a.value)
                  : ['Immédiate','Dans 1 mois','Dans 2 mois','Dans 3 mois','En poste (à définir)']
                ).map(opt => (
                  <button key={opt} type="button" onClick={() => setProfileForm(p => ({...p, availability: opt}))}
                    style={{ padding: '16px 20px', borderRadius: '16px', border: '2px solid', fontWeight: 900, fontSize: '14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                      backgroundColor: profileForm.availability === opt ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                      borderColor: profileForm.availability === opt ? '#f97316' : 'rgba(255,255,255,0.1)',
                      color: profileForm.availability === opt ? '#f97316' : 'rgba(255,255,255,0.5)' }}>
                    {profileForm.availability === opt ? '✓ ' : ''}{opt}
                  </button>
                ))}
                <div style={{ backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '14px', padding: '14px', marginTop: '8px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700 }}>
                    {lang === 'FR'
                      ? '✅ Votre profil sera visible par tous les recruteurs partenaires de Vedior GM.'
                      : '✅ Your profile will be visible to all Vedior GM partner recruiters.'}
                  </p>
                </div>
              </div>
            )}

            {/* STEP 4 — Upload CV obligatoire */}
            {onboardingStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: '#f97316', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>
                  {lang === 'FR' ? '📄 Upload de votre CV (Obligatoire)' : '📄 Upload your CV (Required)'}
                </p>
                <div style={{ border: `2px dashed ${cvUrl ? '#22c55e' : 'rgba(249,115,22,0.4)'}`, borderRadius: '20px', padding: '32px', textAlign: 'center', backgroundColor: cvUrl ? 'rgba(34,197,94,0.08)' : 'rgba(249,115,22,0.05)', transition: 'all 0.3s' }}>
                  {cvUrl ? (
                    <div>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                      <p style={{ color: '#22c55e', fontWeight: 900, fontSize: '15px', marginBottom: '8px' }}>
                        {lang === 'FR' ? 'CV uploadé avec succès !' : 'CV uploaded successfully!'}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '16px' }}>{cvFileName}</p>
                      <button type="button" onClick={() => { setCvUrl(''); setCvFileName(''); }}
                        style={{ padding: '8px 20px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                        {lang === 'FR' ? 'Changer le CV' : 'Change CV'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
                        {lang === 'FR' ? 'Déposez votre CV ici' : 'Drop your CV here'}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '20px' }}>
                        {lang === 'FR' ? 'PDF, DOC, DOCX — Max 5 MB' : 'PDF, DOC, DOCX — Max 5 MB'}
                      </p>
                      <label style={{ display: 'inline-block', padding: '14px 32px', borderRadius: '14px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', fontWeight: 900, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1.5px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(249,115,22,0.35)' }}>
                        {cvUploading ? (lang === 'FR' ? 'Upload en cours...' : 'Uploading...') : (lang === 'FR' ? '📎 Choisir mon CV' : '📎 Choose my CV')}
                        <input type="file" accept=".pdf,.doc,.docx" onChange={e => { const f = e.target.files?.[0]; if (f) handleCvUpload(f); }} style={{ display: 'none' }} disabled={cvUploading} />
                      </label>
                    </div>
                  )}
                </div>
                {!cvUrl && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '12px 16px' }}>
                    <p style={{ color: '#f87171', fontSize: '12px', fontWeight: 700, textAlign: 'center' }}>
                      ⚠️ {lang === 'FR' ? 'Le CV est obligatoire pour finaliser votre inscription.' : 'CV is required to complete your registration.'}
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            {onboardingStep > 1 && (
              <button onClick={() => setOnboardingStep(s => s - 1)}
                style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer' }}>
                ← {lang === 'FR' ? 'Retour' : 'Back'}
              </button>
            )}
            {onboardingStep < 4 ? (
              <button onClick={() => {
                if (onboardingStep === 1) {
                  if (!profileForm.fullName) { setNotification({ message: lang === 'FR' ? 'Veuillez saisir votre nom complet' : 'Please enter your full name', type: 'error' }); setTimeout(() => setNotification(null), 3000); return; }
                  if (!profileForm.phone) { setNotification({ message: lang === 'FR' ? 'Veuillez saisir votre téléphone' : 'Please enter your phone number', type: 'error' }); setTimeout(() => setNotification(null), 3000); return; }
                  if (!profileForm.nationality) { setNotification({ message: lang === 'FR' ? 'Veuillez sélectionner votre nationalité' : 'Please select your nationality', type: 'error' }); setTimeout(() => setNotification(null), 3000); return; }
                  if (!profileForm.birthDate) { setNotification({ message: lang === 'FR' ? 'Veuillez saisir votre date de naissance' : 'Please enter your birth date', type: 'error' }); setTimeout(() => setNotification(null), 3000); return; }
                  if (!profileForm.address) { setNotification({ message: lang === 'FR' ? 'Veuillez saisir votre adresse' : 'Please enter your address', type: 'error' }); setTimeout(() => setNotification(null), 3000); return; }
                }
                if (onboardingStep === 2) {
                  if (!profileForm.education) { setNotification({ message: lang === 'FR' ? "Veuillez sélectionner votre niveau d'études" : 'Please select your education level', type: 'error' }); setTimeout(() => setNotification(null), 3000); return; }
                  if (!profileForm.experience) { setNotification({ message: lang === 'FR' ? "Veuillez sélectionner vos années d'expérience" : 'Please select your years of experience', type: 'error' }); setTimeout(() => setNotification(null), 3000); return; }
                  if (!profileForm.languages) { setNotification({ message: lang === 'FR' ? 'Veuillez sélectionner au moins une langue' : 'Please select at least one language', type: 'error' }); setTimeout(() => setNotification(null), 3000); return; }
                }
                if (onboardingStep === 3 && !profileForm.availability) {
                  setNotification({ message: lang === 'FR' ? 'Veuillez sélectionner votre disponibilité' : 'Please select your availability', type: 'error' });
                  setTimeout(() => setNotification(null), 3000); return;
                }
                setOnboardingStep(s => s + 1);
              }}
                style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#f97316', color: '#fff', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', border: 'none' }}>
                {lang === 'FR' ? 'Suivant →' : 'Next →'}
              </button>
            ) : (
              <button onClick={() => {
                if (!cvUrl) {
                  setNotification({ message: lang === 'FR' ? 'Veuillez uploader votre CV avant de terminer' : 'Please upload your CV before finishing', type: 'error' });
                  setTimeout(() => setNotification(null), 4000); return;
                }
                handleSaveOnboarding();
              }} disabled={savingOnboarding}
                style={{ flex: 1, padding: '16px', borderRadius: '16px', backgroundColor: '#22c55e', color: '#fff', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', border: 'none', opacity: savingOnboarding ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {savingOnboarding
                  ? (lang === 'FR' ? 'Sauvegarde...' : 'Saving...')
                  : (lang === 'FR' ? '✓ Terminer & accéder' : '✓ Finish & access')}
              </button>
            )}
          </div>

          {/* Notification inline */}
          {notification && (
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '14px', backgroundColor: notification.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${notification.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: notification.type === 'success' ? '#4ade80' : '#f87171', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
              {notification.message}
            </div>
          )}

        </motion.div>
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-orange/30">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-sm flex items-center gap-3 font-bold border ${
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
      <aside className={`fixed top-0 bottom-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-64 bg-[#0f1f3d] text-white z-50 flex flex-col`}>
        {/* Logo */}
        <div className="px-6 py-7 cursor-pointer" onClick={onBack}>
          <Logo inverted size="sm" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard',    icon: LayoutDashboard, label: lang === 'FR' ? 'Tableau de bord'  : 'Dashboard' },
            { id: 'applications', icon: FileText,         label: lang === 'FR' ? 'Mes Candidatures' : 'My Applications' },
            { id: 'offers',       icon: Search,           label: lang === 'FR' ? "Offres d'emploi"  : 'Job Offers' },
            { id: 'favorites',    icon: Star,             label: lang === 'FR' ? 'Favoris'           : 'Favorites' },
            { id: 'messages',     icon: MessageSquare,    label: lang === 'FR' ? 'Messages'          : 'Messages' },
            { id: 'profile',      icon: User,             label: lang === 'FR' ? 'Mon Profil'        : 'My Profile' },
            { id: 'settings',     icon: Settings,         label: lang === 'FR' ? 'Paramètres'        : 'Settings' },
          ].map((item: any) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold tracking-wide transition-all ${
                activeTab === item.id
                  ? 'bg-gray-700 text-white shadow-lg shadow-blue-600/30'
                  : 'text-white/50 hover:text-white hover:bg-white/8'
              }`}
            >
              <item.icon size={17} />
              <span className="uppercase tracking-normal text-[10px] font-black">{item.label}</span>
              {item.id === 'messages' && messages.length > 0 && (
                <span className="ml-auto bg-gray-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {messages.length}
                </span>
              )}
              {item.id === 'applications' && applications.length > 0 && activeTab !== 'applications' && (
                <span className="ml-auto bg-white/15 text-white/70 text-[9px] font-black px-2 py-0.5 rounded-full">
                  {applications.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User card + logout */}
        <div className="p-4 border-t border-white/8 space-y-2">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 border-2 border-gray-300">
                {user.photoURL
                  ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-900 font-black">{user.email?.charAt(0).toUpperCase()}</div>
                }
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0f1f3d]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-white truncate">{user.displayName || user.email?.split('@')[0]}</p>
              <p className="text-[9px] text-white/40 font-semibold">{lang === 'FR' ? "Gestionnaire d'entreprise" : 'Enterprise Manager'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-normal text-white/40 hover:text-white hover:bg-white/8 transition-all"
          >
            <LogOut size={15} />
            {lang === 'FR' ? 'Déconnexion' : 'Sign Out'}
          </button>
        </div>
      </aside>

      <main className={`transition-all duration-500 min-h-screen bg-[#f0f4fb] ${dir === 'rtl' ? 'mr-64' : 'ml-64'}`}>
        {/* HEADER */}
        <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between gap-6">
          {/* Left: tab label + greeting */}
          <div>
            <span className="text-blue-500 font-black uppercase tracking-[0.35em] text-[10px] block mb-1">
              {activeTab === 'offers' ? (lang === 'FR' ? 'OFFRES' : 'OFFERS') : activeTab.toUpperCase()}
            </span>
            <h1 className="text-2xl font-black text-[#0f1f3d]">
              {lang === 'FR' ? 'Bonjour,' : 'Hello,'}{' '}
              <span className="text-[#1a56db]">{user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</span>{' '}
              <span>👋</span>
            </h1>
          </div>

          {/* Right: search + bell + lang */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder={lang === 'FR' ? 'Rechercher une offre...' : 'Search a position...'}
                className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-64 transition-all"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center">
                <Search size={13} className="text-white" />
              </button>
            </div>

            {/* Bell */}
            <button className="relative w-10 h-10 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] font-black flex items-center justify-center border border-white">1</span>
            </button>

            {/* Language */}
            <button
              onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR' as any)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-black text-gray-600 hover:border-blue-400 transition-all"
            >
              {lang} <span className="text-gray-400">▾</span>
            </button>
          </div>
        </header>

        <div className="p-8">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-navy/5 border-t-gray-700 rounded-full animate-spin" />
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
                    <div className="lg:col-span-2 bg-gray-900 rounded-[3rem] p-12 text-white relative overflow-hidden group shadow-sm">
                      <div className="absolute top-0 right-0 w-96 h-96 bg-gray-100 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:scale-110 transition-transform duration-700" />
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-4 mb-10">
                          <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                            <Star className="text-gray-900" size={32} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-900 mb-1 italic">Status Premium</p>
                            <h2 className="text-2xl font-black font-semibold">Profil Optimisé</h2>
                          </div>
                        </div>
                        <p className="text-white/60 text-lg font-bold italic border-l-4 border-gray-300 pl-8 mb-12 max-w-lg">
                          {lang === 'FR' 
                            ? 'Votre visibilité auprès des recruteurs est actuellement augmentée de 45% grâce à la complétion de votre CV Vedior.' 
                            : 'Your visibility to recruiters is currently increased by 45% thanks to the completion of your Vedior CV.'}
                        </p>
                        <div className="mt-auto flex flex-wrap gap-4">
                          <button 
                            onClick={() => setActiveTab('profile')}
                            className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-normal hover:bg-gray-900 hover:text-white transition-all shadow-sm shadow-gray-200/20 active:scale-95 italic flex items-center gap-3"
                          >
                             {lang === 'FR' ? 'Peaufiner mon CV' : 'Refine my CV'} <ArrowRight size={16} />
                          </button>
                          <button 
                            onClick={() => setActiveTab('offers')}
                            className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-normal hover:bg-white/10 transition-all italic"
                          >
                             {lang === 'FR' ? 'Explorer les offres' : 'Explore offers'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900 rounded-[3rem] p-10 text-white flex flex-col justify-between shadow-sm shadow-gray-200/30 group relative overflow-hidden">
                       <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                       <div className="relative z-10">
                         <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-8">
                           <Bell size={28} />
                         </div>
                         <h3 className="text-4xl font-black font-semibold leading-none mb-4">5+</h3>
                         <p className="text-[11px] font-black uppercase tracking-normal opacity-80">{lang === 'FR' ? 'Nouveaux messages de recruteurs' : 'New recruiter messages'}</p>
                       </div>
                       <button 
                         onClick={() => setActiveTab('messages')}
                         className="relative z-10 mt-8 w-full py-4 bg-white text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-normal hover:scale-105 transition-all shadow-lg active:scale-95 italic"
                       >
                         {lang === 'FR' ? 'Consulter ma boîte' : 'Check Inbox'}
                       </button>
                    </div>
                  </div>

                  {/* STATS GRID */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                      { label: lang === 'FR' ? 'Postulations' : 'Applications', val: stats.total, icon: Briefcase, color: 'navy', trend: '+2' },
                      { label: lang === 'FR' ? 'En Attente' : 'Pending', val: stats.new, icon: Clock, color: 'gray', trend: 'Soon' },
                      { label: lang === 'FR' ? 'Entretiens' : 'Interviews', val: stats.interview, icon: Calendar, color: 'navy', trend: 'HOT' },
                      { label: lang === 'FR' ? 'Réussites' : 'Accepted', val: stats.accepted, icon: CheckCircle2, color: 'gray', trend: '100%' }
                    ].map((s, i) => (
                      <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-sm transition-all group overflow-hidden relative">
                        <div className={`absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity font-black text-[10px] italic ${s.color === 'orange' ? 'text-gray-900' : 'text-gray-900'}`}>
                          {s.trend}
                        </div>
                        <div className={`w-14 h-14 ${s.color === 'orange' ? 'bg-gray-900 text-white shadow-gray-200/30' : 'bg-gray-900 text-white shadow-gray-200/30'} rounded-2xl flex items-center justify-center mb-8 shadow-sm transition-all group-hover:-rotate-6`}>
                          <s.icon size={26} />
                        </div>
                        <div className="text-5xl font-black text-gray-900 mb-3 tabular-nums tracking-tighter italic">{s.val}</div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] italic">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-[1.8fr_1.2fr] gap-10">
                    {/* CHART */}
                    <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="flex items-center justify-between mb-12">
                        <div>
                          <h3 className="text-2xl font-black text-gray-900 font-semibold mb-2">
                             Performance <span className="text-gray-900">Recrutement</span>
                          </h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-normal">{lang === 'FR' ? 'Tendances de consultation de votre profil' : 'Profile view trends'}</p>
                        </div>
                        <div className="p-4 bg-gray-100 text-gray-900 rounded-2xl group-hover:bg-gray-900 group-hover:text-white transition-all"><TrendingUp size={24} /></div>
                      </div>
                      <div className="h-[350px] w-full" style={{ minHeight: 350, minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={350}>
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
                    <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gray-100 rounded-full -mr-16 -mt-16" />
                      <div className="flex items-center justify-between mb-10 relative z-10">
                        <h3 className="text-xl font-black text-gray-900 font-semibold">{lang === 'FR' ? 'Dossier Récent' : 'Recent Files'}</h3>
                        <Activity size={20} className="text-gray-900" />
                      </div>
                      <div className="space-y-4 flex-1 relative z-10">
                        {applications.slice(0, 5).length > 0 ? (
                          applications.slice(0, 5).map((app, i) => (
                            <div key={app.id} className="group bg-gray-50/50 hover:bg-white p-5 rounded-2xl border border-transparent hover:border-navy/5 hover:shadow-lg transition-all flex gap-5 items-center">
                               <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-white shrink-0 group-hover:bg-gray-900 transition-colors shadow-lg">
                                 {app.sector ? getSectorIcon(app.sector) : <Briefcase size={20} />}
                               </div>
                               <div className="min-w-0">
                                 <p className="text-[12px] font-black uppercase text-gray-900 truncate leading-none group-hover:text-gray-900 transition-colors">
                                   {app.jobTitle || 'Candidature Spontanée'}
                                 </p>
                                 <div className="flex items-center gap-2 mt-2">
                                   <StatusBadge status={app.status || 'new'} lang={lang} />
                                   <span className="text-[9px] font-bold text-gray-400 uppercase tracking-normal">• {new Date(app.createdAt?.seconds * 1000).toLocaleDateString()}</span>
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
                        className="relative z-10 mt-10 w-full py-5 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-900 transition-all shadow-sm shadow-gray-200/10 active:scale-95 italic flex items-center justify-center gap-3"
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
                      <h2 className="text-3xl font-black text-gray-900 font-semibold mb-2 underline decoration-orange decoration-4 underline-offset-8 decoration-skip-ink-none">{lang === 'FR' ? 'Suivi Dossiers' : 'Application Tracking'}</h2>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-normal leading-relaxed">
                        {lang === 'FR' ? 'Gestion en temps réel de votre parcours professionnel' : 'Real-time management of your professional journey'}
                      </p>
                    </div>
                    <div className="flex gap-4">
                       <div className="relative group">
                          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-900 transition-colors" size={18} />
                          <input type="text" placeholder={lang === 'FR' ? 'Filtrer...' : 'Filter...'} className="pl-16 pr-8 py-5 bg-white border border-gray-100 rounded-[2rem] text-[10px] font-black uppercase tracking-normal outline-none focus:ring-4 focus:ring-orange/10 w-72 shadow-sm shadow-gray-200/5 transition-all" />
                       </div>
                    </div>
                  </div>
                  
                  <div className="grid gap-8">
                    {applications.length > 0 ? (
                      applications.map((app) => (
                        <div key={app.id} className="group bg-white p-8 rounded-xl border border-gray-100 shadow-sm hover:shadow-sm transition-all flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-2 h-full bg-gray-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="w-24 h-24 bg-gray-900 rounded-[3rem] flex items-center justify-center text-white shadow-sm shadow-gray-200/20 group-hover:bg-gray-900 transition-all duration-700 shrink-0 -rotate-3 group-hover:rotate-0 relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/5 skew-y-12 translate-y-1/2 group-hover:translate-y-0 transition-transform" />
                            <div className="relative z-10">
                              {app.sector ? getSectorIcon(app.sector) : <Briefcase size={36} />}
                            </div>
                          </div>
                          
                          <div className="flex-1 text-center md:text-left">
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mb-4">
                              <p className="text-2xl font-black text-gray-900 uppercase tracking-tight italic group-hover:text-gray-900 transition-all group-hover:translate-x-2 duration-500">{app.jobTitle || 'Candidature Spontanée'}</p>
                              <span className="px-5 py-1.5 bg-gray-100 rounded-full text-[9px] font-black uppercase text-gray-400 italic">Ref: {app.id.slice(0, 8)}</span>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-[10px] font-black text-gray-400 uppercase tracking-normal italic">
                               <span className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-2xl text-gray-900"><Calendar size={14} className="text-gray-900" /> {app.createdAt ? new Date(app.createdAt.seconds * 1000).toLocaleDateString() : '--/--'}</span>
                               <span className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-2xl text-gray-900"><Briefcase size={14} className="text-gray-900" /> {app.sector || 'Général'}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-center md:items-end gap-6 shrink-0 md:min-w-[200px]">
                            <StatusBadge status={app.status || 'new'} lang={lang} />
                            <div className="flex items-center gap-3 w-full">
                              <button 
                                onClick={() => setSelectedApp(app)}
                                className="flex-1 px-8 py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-normal rounded-2xl hover:bg-gray-900 transition-all shadow-sm shadow-gray-200/10 italic flex items-center justify-center gap-3 active:scale-95 group/btn">
                                {lang === 'FR' ? 'Consulter' : 'View Details'} 
                                <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed border-navy/5 opacity-40">
                         <Search size={80} strokeWidth={1.5} className="mx-auto mb-8 text-gray-400" />
                         <p className="font-black uppercase text-base tracking-[0.4em] text-gray-900 italic">{lang === 'FR' ? 'Aucun Dossier Trouvé' : 'No Applications Found'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-12">
                   {/* Profile Header Card */}
                   <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gray-100 rounded-full -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-110" />
                      <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                        <div className="relative group/avatar">
                          <div className="w-48 h-48 bg-gray-900 rounded-[3rem] p-1.5 shadow-sm relative overflow-hidden transition-transform duration-500 group-hover/avatar:rotate-3">
                             {user.photoURL ? (
                               <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover rounded-[2.5rem]" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-white text-6xl font-black italic">{user.displayName?.charAt(0) || user.email?.charAt(0)}</div>
                             )}
                          </div>
                          <button className="absolute -bottom-4 -right-4 w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow-sm border-4 border-white active:scale-90 transition-all hover:rotate-12">
                             <PlusIcon className="w-6 h-6" />
                          </button>
                        </div>
                        
                        <div className="flex-1 text-center md:text-left">
                          <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 mb-4">
                            <h3 className="text-4xl font-black text-gray-900 font-semibold">{user.displayName || user.email?.split('@')[0]}</h3>
                            <div className="px-5 py-1.5 bg-green-50 text-green-600 border border-green-100 rounded-full text-[10px] font-black uppercase tracking-normal flex items-center gap-2 shadow-sm">
                              <ShieldCheck size={14} /> {lang === 'FR' ? 'Vérifié' : 'Verified'}
                            </div>
                          </div>
                          <p className="text-gray-400 font-bold text-lg mb-8 italic">{user.email}</p>
                          <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <div className="px-6 py-3 bg-gray-100 rounded-2xl flex items-center gap-3">
                              <MapPin size={16} className="text-gray-900" />
                              <span className="text-[10px] font-black uppercase text-gray-900 italic">{profileForm.address || 'Djibouti'}</span>
                            </div>
                            <div className="px-6 py-3 bg-gray-100 rounded-2xl flex items-center gap-3">
                              <Briefcase size={16} className="text-gray-900" />
                              <span className="text-[10px] font-black uppercase text-gray-900 italic">{profileForm.experience} {lang === 'FR' ? 'Ans d\'Exp.' : 'Years Exp.'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                   </div>

                   <form onSubmit={handleSaveProfile} className="grid lg:grid-cols-2 gap-10">
                      {/* Personal Details Card */}
                      <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm space-y-10">
                        <div className="flex items-center gap-4 mb-2">
                           <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200/20">
                             <User size={24} />
                           </div>
                           <h3 className="text-xl font-black text-gray-900 font-semibold">{lang === 'FR' ? 'Identité & Contact' : 'Identity & Contact'}</h3>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Nom Complet' : 'Full Name'}</label>
                            <input 
                              type="text" 
                              value={profileForm.fullName}
                              onChange={(e) => setProfileForm({...profileForm, fullName: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none" 
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Nationalité' : 'Nationality'}</label>
                            <select
                              value={profileForm.nationality}
                              onChange={(e) => setProfileForm({...profileForm, nationality: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none"
                            >
                              <option value="">{lang === 'FR' ? '-- Sélectionnez --' : '-- Select --'}</option>
                              {[
                                'Djiboutienne','Française','Américaine','Britannique','Canadienne',
                                'Algérienne','Angolaise','Béninoise','Botswanaise','Burkinabé','Burundaise',
                                'Camerounaise','Cap-Verdienne','Centrafricaine','Comorienne','Congolaise',
                                'Égyptienne','Érythréenne','Éthiopienne','Gabonaise','Gambienne','Ghanéenne',
                                'Guinéenne','Ivoirienne','Kényane','Lesothane','Libérienne','Libyenne',
                                'Malgache','Malawienne','Malienne','Mauritanienne','Mauricienne','Marocaine',
                                'Mozambicaine','Namibienne','Nigériane','Nigérienne','Ougandaise','Rwandaise',
                                'Sao-Toméenne','Sénégalaise','Sierra-Léonaise','Somalienne','Soudanaise',
                                'Sud-Africaine','Sud-Soudanaise','Swazillandaise','Tanzanienne','Tchadienne',
                                'Togolaise','Tunisienne','Zambienne','Zimbabwéenne',
                                'Allemande','Australienne','Autrichienne','Belge','Brésilienne','Chilienne',
                                'Chinoise','Colombienne','Coréenne','Danoise','Espagnole','Finlandaise',
                                'Grecque','Hongroise','Indienne','Indonésienne','Irlandaise','Israélienne',
                                'Italienne','Japonaise','Mexicaine','Néerlandaise','Néo-Zélandaise',
                                'Norvégienne','Pakistanaise','Polonaise','Portugaise','Roumaine','Russe',
                                'Saoudienne','Suédoise','Suisse','Turque','Ukrainienne',
                                'Émiratie','Yéménite','Jordanienne','Libanaise','Syrienne','Iranienne','Irakienne',
                                'Afghane','Bangladaise','Sri-Lankaise','Népalaise','Philippine','Thaïlandaise','Vietnamienne',
                              ].sort().map(country => (
                                <option key={country} value={country}>{country}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Téléphone' : 'Phone'}</label>
                            <input 
                              type="tel" 
                              value={profileForm.phone}
                              onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none" 
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Date de Naissance' : 'Birth Date'}</label>
                            <input 
                              type="date" 
                              value={profileForm.birthDate}
                              onChange={(e) => setProfileForm({...profileForm, birthDate: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none" 
                            />
                          </div>
                          <div className="space-y-3 sm:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Adresse de Résidence' : 'Residential Address'}</label>
                            <input 
                              type="text" 
                              value={profileForm.address}
                              onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                              placeholder="Ex: Plateau du Serpent, Djibouti"
                              className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none" 
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic uppercase tracking-tighter">{lang === 'FR' ? 'Sexe' : 'Gender'}</label>
                            <select 
                              value={profileForm.gender}
                              onChange={(e) => setProfileForm({...profileForm, gender: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none"
                            >
                              <option value="M">{lang === 'FR' ? 'Masculin' : 'Male'}</option>
                              <option value="F">{lang === 'FR' ? 'Féminin' : 'Female'}</option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Disponibilité' : 'Availability'}</label>
                            <input 
                              type="text" 
                              value={profileForm.availability}
                              onChange={(e) => setProfileForm({...profileForm, availability: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none" 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Experience & Education Card */}
                      <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div className="space-y-10">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200/20">
                               <FileText size={24} />
                             </div>
                             <h3 className="text-xl font-black text-gray-900 font-semibold">{lang === 'FR' ? 'Parcours & CV' : 'Background & CV'}</h3>
                          </div>

                          <div className="space-y-8">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Dernier Diplôme ou Formation' : 'Last Degree or Training'}</label>
                              <input 
                                type="text" 
                                value={profileForm.education}
                                onChange={(e) => setProfileForm({...profileForm, education: e.target.value})}
                                placeholder="Ex: Licence en Management" 
                                className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none" 
                              />
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Années d\'Expérience Totales' : 'Total Years of Experience'}</label>
                              <input 
                                type="number" 
                                value={profileForm.experience}
                                onChange={(e) => setProfileForm({...profileForm, experience: e.target.value})}
                                placeholder="Ex: 5" 
                                className="w-full bg-gray-100 border border-transparent px-8 py-5 rounded-3xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none" 
                              />
                            </div>
                            
                            <div className="pt-6 relative group/cv">
                               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic mb-4">{lang === 'FR' ? 'Document CV Actuel' : 'Current CV Document'}</p>
                               
                               {/* Hidden file input */}
                               <input
                                 ref={cvInputRef}
                                 type="file"
                                 accept=".pdf,.doc,.docx"
                                 className="hidden"
                                 onChange={e => {
                                   const file = e.target.files?.[0];
                                   if (file) { setCvFile(file); handleCvUpload(file); }
                                 }}
                               />

                               {cvUrl ? (
                                 <div className="bg-gray-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-sm transition-all duration-500 hover:scale-[1.02] -skew-x-2">
                                   <div className="absolute top-0 right-0 w-32 h-32 bg-gray-100 rounded-full blur-3xl -mr-16 -mt-16" />
                                   <div className="relative z-10 flex items-center justify-between skew-x-2">
                                     <div className="flex items-center gap-6">
                                       <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                                         <FileText size={32} className="text-gray-900" />
                                       </div>
                                       <div>
                                         <p className="text-sm font-black font-semibold mb-1">{cvFileName || 'CV.pdf'}</p>
                                         <p className="text-[8px] font-bold text-white/40 uppercase tracking-normal">{lang === 'FR' ? 'CV enregistré ✓' : 'CV saved ✓'}</p>
                                       </div>
                                     </div>
                                     <div className="flex gap-2">
                                       <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                                         <button type="button" className="p-3 bg-white/10 rounded-xl hover:bg-gray-900 transition-all" title="Voir le CV"><Eye size={18} /></button>
                                       </a>
                                       <a href={cvUrl} download={cvFileName}>
                                         <button type="button" className="p-3 bg-white/10 rounded-xl hover:bg-gray-900 transition-all" title="Télécharger"><Download size={18} /></button>
                                       </a>
                                       <button type="button" onClick={() => cvInputRef.current?.click()} className="p-3 bg-white/10 rounded-xl hover:bg-gray-900 transition-all" title="Remplacer">
                                         <Upload size={18} />
                                       </button>
                                     </div>
                                   </div>
                                 </div>
                               ) : (
                                 <button
                                   type="button"
                                   onClick={() => cvInputRef.current?.click()}
                                   disabled={cvUploading}
                                   className="w-full border-2 border-dashed border-gray-200 rounded-3xl p-10 flex flex-col items-center gap-4 hover:border-gray-300 hover:bg-gray-100 transition-all group/upload disabled:opacity-60"
                                 >
                                   {cvUploading ? (
                                     <>
                                       <Loader size={32} className="text-gray-900 animate-spin" />
                                       <p className="text-sm font-black text-gray-900">{cvUploadProgress}%</p>
                                       <div className="w-full bg-gray-100 rounded-full h-2">
                                         <div className="bg-gray-900 h-2 rounded-full transition-all" style={{ width: `${cvUploadProgress}%` }} />
                                       </div>
                                     </>
                                   ) : (
                                     <>
                                       <Upload size={32} className="text-gray-400 group-hover/upload:text-gray-900 transition-colors" />
                                       <p className="text-sm font-black text-gray-400 group-hover/upload:text-gray-900 transition-colors">
                                         {lang === 'FR' ? 'Cliquez pour uploader votre CV' : 'Click to upload your CV'}
                                       </p>
                                       <p className="text-[10px] text-gray-400 font-bold uppercase tracking-normal">PDF, DOC, DOCX</p>
                                     </>
                                   )}
                                 </button>
                               )}
                            </div>
                          </div>
                        </div>

                        {/* ID Document Card */}
                        <div className="bg-white rounded-[2rem] border border-navy/5 shadow-sm p-8 space-y-6">
                          <h3 className="text-xl font-black text-gray-900 font-semibold">
                            {lang === 'FR' ? '🪪 Pièce d\'Identité' : '🪪 Identity Document'}
                          </h3>

                          {/* Doc type selector */}
                          <div className="flex gap-3">
                            {[
                              { value: 'id_card', label: lang === 'FR' ? 'Carte d\'identité' : 'ID Card', icon: '🪪' },
                              { value: 'passport', label: lang === 'FR' ? 'Passeport' : 'Passport', icon: '📘' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setIdDocType(opt.value as 'id_card' | 'passport')}
                                className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-normal transition-all border-2 ${
                                  idDocType === opt.value
                                    ? 'bg-gray-900 text-white border-gray-300 shadow-lg shadow-gray-200/20'
                                    : 'bg-gray-100 text-gray-400 border-transparent hover:border-gray-200'
                                }`}
                              >
                                {opt.icon} {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* Hidden file input */}
                          <input
                            ref={idInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleIdUpload(file);
                            }}
                          />

                          {idUrl ? (
                            <div className="bg-gray-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-sm">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-gray-100 rounded-full blur-3xl -mr-12 -mt-12" />
                              <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">
                                    {idDocType === 'passport' ? '📘' : '🪪'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{idFileName}</p>
                                    <p className="text-[9px] text-white/40 uppercase tracking-normal font-bold">
                                      {idDocType === 'passport' ? (lang === 'FR' ? 'Passeport' : 'Passport') : (lang === 'FR' ? 'Carte d\'identité' : 'ID Card')} ✓
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <a href={idUrl} target="_blank" rel="noopener noreferrer">
                                    <button type="button" className="p-3 bg-white/10 rounded-xl hover:bg-gray-900 transition-all"><Eye size={16} /></button>
                                  </a>
                                  <a href={idUrl} download={idFileName}>
                                    <button type="button" className="p-3 bg-white/10 rounded-xl hover:bg-gray-900 transition-all"><Download size={16} /></button>
                                  </a>
                                  <button type="button" onClick={() => idInputRef.current?.click()} className="p-3 bg-white/10 rounded-xl hover:bg-gray-900 transition-all"><Upload size={16} /></button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => idInputRef.current?.click()}
                              disabled={idUploading}
                              className="w-full border-2 border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center gap-3 hover:border-gray-300 hover:bg-gray-100 transition-all disabled:opacity-60"
                            >
                              {idUploading ? (
                                <>
                                  <Loader size={28} className="text-gray-900 animate-spin" />
                                  <p className="text-sm font-black text-gray-900">{idUploadProgress}%</p>
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-gray-900 h-2 rounded-full transition-all" style={{ width: `${idUploadProgress}%` }} />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-4xl">{idDocType === 'passport' ? '📘' : '🪪'}</span>
                                  <p className="text-sm font-black text-gray-400">
                                    {lang === 'FR' ? 'Uploader votre pièce d\'identité' : 'Upload your ID document'}
                                  </p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-normal">PDF, JPG, PNG</p>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="pt-12">
                          <button 
                            type="submit" 
                            disabled={savingProfile}
                            className="w-full py-6 bg-gray-900 text-white text-xs font-black uppercase tracking-[0.3em] rounded-3xl shadow-[0_25px_50px_rgba(249,115,22,0.4)] hover:scale-[1.02] active:scale-95 transition-all italic disabled:opacity-50 disabled:cursor-not-allowed group"
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
                <div className="space-y-8">
                  {/* Title section */}
                  <div>
                    <h2 className="text-4xl font-black text-[#0f1f3d] mb-1">
                      Opportunités{' '}
                      <span className="text-[#1a56db] italic underline decoration-[#1a56db] decoration-4 underline-offset-4">Directes</span>
                    </h2>
                    <p className="text-sm text-gray-400 font-medium">
                      {lang === 'FR' ? "Trouvez l'emploi qui correspond à votre profil expert." : 'Find the job that matches your expert profile.'}
                    </p>
                  </div>

                  {/* Stat pills */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { icon: Briefcase,    color: 'bg-blue-100 text-gray-700',   val: jobs.length,             label: lang === 'FR' ? 'Offres disponibles'    : 'Available offers' },
                      { icon: Send,         color: 'bg-purple-100 text-purple-500', val: applications.length,   label: lang === 'FR' ? 'Candidatures envoyées' : 'Applications sent' },
                      { icon: Star,         color: 'bg-gray-900-100 text-gray-900-500', val: savedJobs.length,      label: lang === 'FR' ? 'Favoris'               : 'Favorites' },
                      { icon: CheckCircle2, color: 'bg-green-100 text-green-600',  val: profile?.profileComplete ? '100%' : '0%', label: lang === 'FR' ? 'Profil complété' : 'Profile completed' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm border border-gray-100">
                        <div className={`w-11 h-11 rounded-xl ${s.color} flex items-center justify-center shrink-0`}>
                          <s.icon size={20} />
                        </div>
                        <div>
                          <p className="text-xl font-black text-[#0f1f3d]">{s.val}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{s.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Job cards grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {jobs.length > 0 ? (
                      jobs.map((job, idx) => {
                        // Thematic gradient banners per sector
                        const bannerGrads = [
                          'from-blue-100 via-indigo-50 to-blue-200',
                          'from-purple-100 via-pink-50 to-purple-200',
                          'from-sky-100 via-cyan-50 to-sky-200',
                          'from-emerald-100 via-teal-50 to-emerald-200',
                          'from-gray-700-100 via-amber-50 to-gray-700-200',
                          'from-rose-100 via-pink-50 to-rose-200',
                        ];
                        const grad = bannerGrads[idx % bannerGrads.length];
                        const isSaved = savedJobs.includes(job.id);
                        return (
                          <div key={job.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all flex flex-col group">
                            {/* Banner image area */}
                            <div className={`relative h-36 bg-gradient-to-br ${grad} flex items-center justify-center overflow-hidden`}>
                              <div className="w-16 h-16 rounded-2xl bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-md">
                                <Briefcase size={30} className="text-[#1a56db]" />
                              </div>
                              {/* Favorite button */}
                              <button
                                onClick={() => toggleFavorite(job.id)}
                                className={`absolute top-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                                  isSaved ? 'bg-red-50 text-red-400' : 'bg-white/80 text-gray-400 hover:text-red-400'
                                }`}
                              >
                                <Star size={17} fill={isSaved ? 'currentColor' : 'none'} />
                              </button>
                              {/* Sector icon */}
                              <div className="absolute top-3 left-3 w-11 h-11 rounded-xl bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm">
                                <Briefcase size={20} className="text-[#1a56db]" />
                              </div>
                            </div>

                            {/* Card body */}
                            <div className="p-5 flex flex-col flex-1">
                              <h3 className="text-[15px] font-black text-[#0f1f3d] mb-1.5 leading-tight group-hover:text-[#1a56db] transition-colors">
                                {job.title}
                              </h3>

                              <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium mb-3">
                                <MapPin size={13} className="text-[#1a56db] shrink-0" />
                                <span>{job.location || 'Djibouti Centre'}</span>
                              </div>

                              {/* Divider */}
                              <div className="border-t border-gray-100 mb-3" />

                              {/* Tags row */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-500 text-[10px] font-semibold px-2.5 py-1 rounded-lg">
                                  <Clock size={11} /> {lang === 'FR' ? 'Temps plein' : 'Full-time'}
                                </span>
                                <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-500 text-[10px] font-semibold px-2.5 py-1 rounded-lg">
                                  <Briefcase size={11} /> {job.experience || lang === 'FR' ? 'Exp. 1-3 ans' : 'Exp. 1-3 yrs'}
                                </span>
                                {job.companyName && (
                                  <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-500 text-[10px] font-semibold px-2.5 py-1 rounded-lg">
                                    <ShieldCheck size={11} /> {job.companyName.slice(0, 8)}
                                  </span>
                                )}
                              </div>

                              {/* Description */}
                              {job.description && (
                                <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">{job.description}</p>
                              )}

                              {/* Footer meta */}
                              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                                  <Calendar size={12} />
                                  <span>{lang === 'FR' ? 'Publiée récemment' : 'Posted recently'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-500">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                  {lang === 'FR' ? 'Actif' : 'Active'}
                                </div>
                              </div>

                              {/* CTA */}
                              <button
                                onClick={() => handleApply(job)}
                                className="mt-4 w-full py-3 bg-[#1a56db] hover:bg-[#1648c0] text-white rounded-xl text-[11px] font-black uppercase tracking-normal flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                              >
                                {lang === 'FR' ? 'Postuler maintenant' : 'Apply now'}
                                <ArrowRight size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-full py-32 text-center bg-white rounded-2xl border border-gray-100">
                        <Search size={60} strokeWidth={1} className="mx-auto mb-6 text-gray-200" />
                        <p className="font-black uppercase text-sm tracking-normal text-gray-300">
                          {lang === 'FR' ? 'Aucune opportunité disponible' : 'No available positions'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
               {activeTab === 'favorites' && (
                <div className="space-y-12">
                   <div className="px-4">
                     <h2 className="text-4xl font-black text-gray-900 font-semibold mb-4 underline decoration-orange decoration-4 transition-all hover:decoration-8">{lang === 'FR' ? 'Sélection Élite' : 'Elite Selection'}</h2>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-normal italic">{lang === 'FR' ? 'Votre curation personnelle des meilleures opportunités' : 'Your personal curation of top tier roles'}</p>
                   </div>
                   
                   <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {jobs.filter(j => savedJobs.includes(j.id)).length > 0 ? (
                        jobs.filter(j => savedJobs.includes(j.id)).map(job => (
                        <div key={job.id} className="bg-white p-10 rounded-[4rem] border border-gray-100 shadow-sm hover:shadow-sm transition-all group relative overflow-hidden flex flex-col h-full hover:scale-[1.02] duration-500">
                           <div className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                           <div className="flex justify-between items-start mb-10 relative z-10">
                             <div className="w-16 h-16 bg-gray-900 text-white rounded-[2rem] flex items-center justify-center shadow-sm shadow-gray-200/30 group-hover:rotate-12 transition-transform">
                               <Star size={28} fill="currentColor" />
                             </div>
                             <button 
                               onClick={() => toggleFavorite(job.id)} 
                               className="p-4 bg-white/80 backdrop-blur-md rounded-2xl text-gray-400 hover:text-red-500 transition-all shadow-sm hover:rotate-90"
                             >
                               <X size={20} />
                             </button>
                           </div>
                           <div className="relative z-10 flex-1 flex flex-col">
                             <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tighter uppercase italic leading-tight group-hover:text-gray-900 transition-colors">{job.title}</h3>
                             <p className="text-[11px] font-black text-gray-900 uppercase tracking-normal mb-10 italic">{job.companyName}</p>
                             
                             <button 
                               onClick={() => handleApply(job)}
                               className="mt-auto w-full py-5 bg-gray-900 text-white rounded-3xl text-[10px] font-black uppercase tracking-normal hover:bg-gray-900 transition-all shadow-sm shadow-gray-200/30 italic flex items-center justify-center gap-4 active:scale-95 group/btn"
                             >
                                {lang === 'FR' ? 'Propulser ma Candidature' : 'Fast Track Now'} 
                                <ArrowRight size={18} className="group-hover/btn:translate-x-2 transition-transform" />
                             </button>
                           </div>
                        </div>
                        ))
                      ) : (
                        <div className="col-span-full py-48 text-center bg-white rounded-[4rem] border-2 border-dashed border-navy/5 group hover:border-gray-200 transition-all relative overflow-hidden">
                          <div className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Star size={80} strokeWidth={1} className="mx-auto mb-8 text-gray-400 group-hover:scale-110 transition-transform duration-700" />
                          <p className="font-black uppercase tracking-[0.5em] text-gray-400 italic text-sm group-hover:text-gray-400 transition-colors uppercase italic">{lang === 'FR' ? 'Curriculum Vide' : 'Curation Empty'}</p>
                        </div>
                      )}
                   </div>
                </div>
              )}

              {activeTab === 'messages' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[750px] relative">
                   <div className="p-10 border-b border-navy/5 bg-gray-900 text-white flex items-center justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gray-100 rounded-full blur-3xl -mr-32 -mt-32" />
                      <div className="flex items-center gap-6 relative z-10">
                         <div className="relative">
                           <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10 shadow-sm">
                              <MessageSquare size={32} className="text-gray-900" />
                           </div>
                           <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-gray-300 rounded-full animate-pulse" />
                         </div>
                         <div>
                            <h2 className="text-2xl font-black font-semibold leading-none mb-2">{lang === 'FR' ? 'Vedior Direct' : 'Vedior Direct'}</h2>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-normal flex items-center gap-2">
                              <span className="w-2 h-2 bg-gray-900 rounded-full" />
                              {lang === 'FR' ? 'Ligne de recrutement sécurisée' : 'Secure recruitment line'}
                            </p>
                         </div>
                      </div>
                      <button className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:text-gray-900 hover:bg-white/10 transition-all relative z-10 border-dashed">
                        <MoreVertical size={20} />
                      </button>
                   </div>

                   <div className="flex-1 overflow-y-auto p-12 space-y-8 bg-white">
                      {messages.length > 0 ? (
                        messages.map((msg) => (
                           <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                              <div className={`max-w-[80%] p-8 rounded-[3rem] shadow-sm relative group overflow-hidden ${
                                msg.senderId === user.uid 
                                  ? 'bg-gray-900 text-white rounded-tr-none shadow-gray-200/20' 
                                  : 'bg-white text-gray-900 rounded-tl-none border border-navy/5 shadow-sm shadow-gray-200/5'
                              }`}>
                                 {msg.senderId === user.uid && (
                                   <div className="absolute top-0 left-0 w-full h-1 bg-gray-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                                 )}
                                 <p className="text-[14px] font-bold leading-[1.6]">{msg.text}</p>
                                 <div className={`flex items-center gap-2 mt-4 opacity-40 text-[9px] font-semibold ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                                    {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    {msg.senderId === user.uid && <CheckCircle2 size={10} className="text-gray-900" />}
                                 </div>
                              </div>
                           </div>
                        ))
                      ) : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-10">
                            <div className="w-32 h-32 bg-gray-100 rounded-[3rem] flex items-center justify-center animate-bounce">
                               <MessageSquare size={64} strokeWidth={1} />
                            </div>
                            <div className="text-center">
                               <p className="text-lg font-black font-semibold text-gray-400 mb-2">{lang === 'FR' ? 'Démarrez la conversation' : 'Start the conversation'}</p>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-normal">{lang === 'FR' ? 'Posez vos questions à l\'équipe recrutement' : 'Ask our recruitment team anything'}</p>
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
                              className="w-full bg-gray-100 border-2 border-transparent px-10 py-6 rounded-[2.5rem] outline-none text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all pr-24"
                              disabled={sendingMessage}
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex gap-2">
                               <button type="button" className="p-3 text-gray-400 hover:text-gray-900 transition-colors"><PlusIcon className="w-5 h-5" /></button>
                            </div>
                         </div>
                         <button 
                           type="submit" 
                           disabled={sendingMessage || !newMessage.trim()}
                           className="bg-gray-900 text-white w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-sm shadow-gray-200/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 group shrink-0"
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

                    {/* Alertes */}
                    <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gray-100 rounded-full -mr-16 -mt-16" />
                      <h3 className="text-2xl font-black text-gray-900 font-semibold mb-10 border-l-4 border-gray-300 pl-6">
                        {lang === 'FR' ? 'Alertes Canaux' : 'Channel Alerts'}
                      </h3>
                      <div className="space-y-10">
                        {([
                          { key: 'jobAlerts', label: lang === 'FR' ? 'Intelligence Jobs' : 'Job Intelligence', desc: lang === 'FR' ? 'Alertes prédictives sur les offres BTP & Logistique.' : 'Predictive alerts on BTP & Logistics offers.' },
                          { key: 'liveStatus', label: lang === 'FR' ? 'Status Live' : 'Live Status', desc: lang === 'FR' ? 'Mises à jour instantanées sur vos dossiers en cours.' : 'Instant updates on your ongoing applications.' },
                          { key: 'pushMsg', label: lang === 'FR' ? 'Messagerie Push' : 'Push Messaging', desc: lang === 'FR' ? 'Notifications directes pour les messages privés.' : 'Direct notifications for private messages.' }
                        ] as { key: keyof typeof notifSettings; label: string; desc: string }[]).map((item) => (
                          <div key={item.key} className="flex items-center justify-between">
                            <div className="flex-1 pr-6">
                              <p className="text-[12px] font-black uppercase text-gray-900 italic mb-1">{item.label}</p>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-normal leading-relaxed">{item.desc}</p>
                            </div>
                            <button
                              onClick={() => {
                                setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }));
                                setNotification({ message: lang === 'FR' ? 'Préférence mise à jour' : 'Preference updated', type: 'success' });
                                setTimeout(() => setNotification(null), 2000);
                              }}
                              className={`w-14 h-8 rounded-full p-1 transition-all duration-300 relative flex-shrink-0 ${notifSettings[item.key] ? 'bg-gray-900 shadow-lg' : 'bg-gray-200'}`}
                            >
                              <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${notifSettings[item.key] ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-10">
                      {/* Confidentialité */}
                      <div className="bg-gray-900 p-12 rounded-xl text-white shadow-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-700/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <h3 className="text-2xl font-black font-semibold mb-6 relative z-10">
                          {lang === 'FR' ? 'Confidentialité' : 'Privacy Mode'}
                        </h3>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-normal leading-relaxed mb-10 relative z-10">
                          {lang === 'FR' ? 'Sécurisez vos données avec le chiffrement de bout en bout Vedior.' : 'Secure your data with Vedior end-to-end encryption.'}
                        </p>
                        <button
                          onClick={() => {
                            setNotification({ message: lang === 'FR' ? 'Fonctionnalité disponible prochainement' : 'Feature coming soon', type: 'success' });
                            setTimeout(() => setNotification(null), 3000);
                          }}
                          className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-normal text-white hover:bg-gray-900 transition-all italic relative z-10 shadow-sm shadow-black/20 active:scale-95"
                        >
                          {lang === 'FR' ? 'Gérer les clés' : 'Manage keys'}
                        </button>
                      </div>

                      {/* Suppression compte */}
                      <div className="bg-red-50 p-12 rounded-xl border border-red-100 shadow-sm">
                        <h3 className="text-2xl font-black text-red-600 font-semibold mb-4">
                          {lang === 'FR' ? 'Compte' : 'Account'}
                        </h3>
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-normal leading-relaxed mb-10">
                          {lang === 'FR' ? 'Toutes les données seront définitivement effacées.' : 'All data will be permanently erased.'}
                        </p>
                        {!showDeleteConfirm ? (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full py-6 bg-white border-2 border-red-200 text-red-600 rounded-3xl text-[10px] font-black uppercase tracking-normal hover:bg-red-600 hover:text-white transition-all shadow-sm italic active:scale-95"
                          >
                            {lang === 'FR' ? 'Suppression Irréversible' : 'Irreversible Deletion'}
                          </button>
                        ) : (
                          <div className="space-y-4">
                            <div className="bg-red-100 border border-red-200 rounded-2xl p-4 text-center">
                              <p className="text-red-700 font-black text-sm uppercase tracking-wide">
                                ⚠️ {lang === 'FR' ? 'Êtes-vous sûr ? Cette action est irréversible.' : 'Are you sure? This cannot be undone.'}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="py-4 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-normal hover:border-gray-400 transition-all"
                              >
                                {lang === 'FR' ? 'Annuler' : 'Cancel'}
                              </button>
                              <button
                                disabled={deletingAccount}
                                onClick={async () => {
                                  if (!user) return;
                                  setDeletingAccount(true);
                                  try {
                                    // Supprimer les données Firestore
                                    const { deleteDoc: dd, doc: d2 } = await import('firebase/firestore');
                                    await dd(d2(db, 'candidateProfiles', user.uid));
                                    await dd(d2(db, 'users', user.uid));
                                    // Supprimer le compte Firebase Auth
                                    await user.delete();
                                    onBack();
                                  } catch (err: any) {
                                    if (err.code === 'auth/requires-recent-login') {
                                      setNotification({ message: lang === 'FR' ? 'Reconnectez-vous pour confirmer la suppression.' : 'Please re-login to confirm deletion.', type: 'error' });
                                    } else {
                                      setNotification({ message: 'Erreur lors de la suppression.', type: 'error' });
                                    }
                                    setTimeout(() => setNotification(null), 4000);
                                    setShowDeleteConfirm(false);
                                  }
                                  setDeletingAccount(false);
                                }}
                                className="py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-normal hover:bg-red-700 transition-all disabled:opacity-50 active:scale-95"
                              >
                                {deletingAccount ? '...' : lang === 'FR' ? 'Confirmer' : 'Confirm'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>

      {/* ── Application Detail Modal ── */}
      {selectedApp && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(10,25,47,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedApp(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[2rem] shadow-sm w-full max-w-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gray-900 px-8 py-6 flex items-center justify-between">
              <div>
                <p className="text-gray-900 text-[10px] font-black uppercase tracking-normal mb-1">Ref: {selectedApp.id?.slice(-8).toUpperCase()}</p>
                <h2 className="text-white text-2xl font-black font-semibold">{selectedApp.jobTitle || 'Poste'}</h2>
              </div>
              <button onClick={() => setSelectedApp(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-gray-900 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedApp.status || 'new'} lang={lang} />
                <span className="text-[10px] font-black uppercase tracking-normal text-gray-400">
                  {selectedApp.createdAt?.toDate?.()?.toLocaleDateString() || ''}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: lang === 'FR' ? 'Nom Complet' : 'Full Name', value: selectedApp.fullName },
                  { label: lang === 'FR' ? 'Email' : 'Email', value: selectedApp.email },
                  { label: lang === 'FR' ? 'Téléphone' : 'Phone', value: selectedApp.phone || '—' },
                  { label: lang === 'FR' ? 'Nationalité' : 'Nationality', value: selectedApp.nationality || '—' },
                  { label: lang === 'FR' ? 'Secteur' : 'Sector', value: selectedApp.sector || '—' },
                  { label: lang === 'FR' ? 'Disponibilité' : 'Availability', value: selectedApp.availability || '—' },
                  { label: lang === 'FR' ? 'Formation' : 'Education', value: selectedApp.education || '—' },
                  { label: lang === 'FR' ? "Années d'exp." : 'Years exp.', value: selectedApp.experience ? `${selectedApp.experience} ans` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-normal text-gray-400 mb-1">{label}</p>
                    <p className="text-sm font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {/* Address */}
              {selectedApp.address && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-normal text-gray-400 mb-1">{lang === 'FR' ? 'Adresse' : 'Address'}</p>
                  <p className="text-sm font-black text-gray-900">{selectedApp.address}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 pb-8">
              <button
                onClick={() => setSelectedApp(null)}
                className="w-full py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-normal rounded-2xl hover:bg-gray-900 transition-all"
              >
                {lang === 'FR' ? 'Fermer' : 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
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
    new: { label: { FR: 'Reçue', EN: 'Received' }, color: 'bg-blue-100 text-gray-700 border-blue-200' },
    reviewed: { label: { FR: 'En étude', EN: 'Reviewing' }, color: 'bg-yellow-100 text-yellow-600 border-yellow-200' },
    interview: { label: { FR: 'Entretien', EN: 'Interview' }, color: 'bg-purple-100 text-gray-600 border-purple-200' },
    hired: { label: { FR: 'Retenu', EN: 'Accepted' }, color: 'bg-green-100 text-green-600 border-green-200' },
    rejected: { label: { FR: 'Refusé', EN: 'Rejected' }, color: 'bg-red-100 text-red-600 border-red-200' }
  };

  const config = configs[status] || configs.new;
  const label = config.label[lang === 'AR' ? 'EN' : lang] || config.label.EN;

  return (
    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-normal border italic ${config.color}`}>
      {label}
    </span>
  );
};