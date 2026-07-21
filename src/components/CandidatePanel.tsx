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
import { useCompanyInfo } from '../lib/useCompanyInfo';
import { 
  collection, query, where, orderBy, onSnapshot, doc, setDoc, addDoc, serverTimestamp, updateDoc,
  getDocs
} from 'firebase/firestore';
import { 
  signInWithPopup as authSignInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification,
  applyActionCode, verifyPasswordResetCode, confirmPasswordReset
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
  onSignOut?: () => void;
};

// Build real chart data from applications — last 7 days
const getRealChartData = (applications: any[]) => {
  const days: { name: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000;
    const dayEnd = dayStart + 86400;
    const count = applications.filter(a => {
      const ts = a.createdAt?.seconds;
      return ts && ts >= dayStart && ts < dayEnd;
    }).length;
    days.push({ name: label, value: count });
  }
  return days;
};

export default function CandidatePanel({ onBack, onSignOut }: CandidatePanelProps) {
  const { lang, setLang, t, dir } = useTranslation();
  const { company } = useCompanyInfo(db);

  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileChecked, setProfileChecked] = useState(false);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'offers' | 'favorites' | 'messages' | 'profile' | 'settings'>('dashboard');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [notifSettings, setNotifSettings] = useState({ jobAlerts: true, liveStatus: true, pushMsg: false });
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  // ── Login mode states
  const [loginTab, setLoginTab] = useState<'google' | 'phone'>('phone');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginConfirm, setLoginConfirm] = useState('');
  const [loginMode, setLoginMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [tempPassword, setTempPassword] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginResetSent, setLoginResetSent] = useState(false);
  const [gmailRequired, setGmailRequired] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  // ── États pour la réinitialisation de mot de passe via lien ──
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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

  const onSignOutRef = React.useRef(onSignOut);
  const onBackRef = React.useRef(onBack);
  useEffect(() => { onSignOutRef.current = onSignOut; onBackRef.current = onBack; });

  // ── Gestion des liens d'action Firebase (vérification email / réinitialisation) ──
  useEffect(() => {
    const handleActionCode = async () => {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const oobCode = params.get('oobCode');

      if (!mode || !oobCode) return;

      try {
        if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode);
          if (auth.currentUser) {
            await auth.currentUser.reload();
          }
          window.history.replaceState({}, '', window.location.pathname);
          setNotification({
            message: lang === 'FR' ? '✅ Email vérifié avec succès !' : '✅ Email verified successfully!',
            type: 'success'
          });
          setTimeout(() => setNotification(null), 5000);
        } 
        else if (mode === 'resetPassword') {
          const email = await verifyPasswordResetCode(auth, oobCode);
          setResetCode(oobCode);
          setResetEmail(email);
          setShowResetForm(true);
        }
      } catch (error) {
        console.error('Action code error:', error);
        setNotification({
          message: lang === 'FR' ? '❌ Lien invalide ou expiré.' : '❌ Invalid or expired link.',
          type: 'error'
        });
        setTimeout(() => setNotification(null), 5000);
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    handleActionCode();
  }, [lang]);

  // ── Traitement retour redirect Google ──────────────────────────────────────
  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (!result) return;
      const u = result.user;
      try {
        const { getDoc: gd, doc: d2, setDoc: sd } = await import('firebase/firestore');
        const userRef = d2(db, 'users', u.uid);
        const userSnap = await gd(userRef);
        if (!userSnap.exists()) {
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
        }
      } catch (e) {
        console.warn('[Auth] getRedirectResult user doc error:', e);
      }
    }).catch(err => {
      console.error('[Auth] getRedirectResult error:', err);
    });
  }, []);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      console.log('[Auth] onAuthStateChanged:', u ? u.email || u.uid : 'null');
      if (u) {
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('firebaseUid', '==', u.uid)));
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const role = data.role;
            if (role && role !== 'candidate') {
              console.log('[Auth] Non-candidate role — signing out:', role);
              await signOut(auth); setUser(null); setAuthLoading(false); return;
            }
            console.log('[Auth] Candidate logged in:', data.fullName || data.email || u.uid);
          } else {
            console.log('[Auth] No Firestore doc — creating minimal doc');
            try {
              const { addDoc, collection: col3, serverTimestamp: st3 } = await import('firebase/firestore');
              await addDoc(col3(db, 'users'), {
                firebaseUid: u.uid,
                email: u.email || '',
                displayName: u.displayName || '',
                photoUrl: u.photoURL || '',
                role: 'candidate',
                fullName: u.displayName || '',
                phone: '',
                profileComplete: false,
                loginMethod: 'google',
                gmailConfirmed: true,
                createdAt: st3(),
                source: 'google',
              });
              console.log('[Auth] Minimal doc created for Google user');
            } catch (createErr) {
              console.warn('[Auth] Failed to create user doc (non-blocking):', createErr);
            }
          }
        } catch (firestoreErr) {
          console.warn('[Auth] Firestore error (non-blocking):', firestoreErr);
        }
        setUser(u);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
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

    const qApps = query(
      collection(db, 'applications'),
      where('userId', '==', user?.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
      setApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'applications');
    });

    const unsubscribeProfile = onSnapshot(doc(db, 'candidateProfiles', user?.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({ id: docSnap.id, ...data });
        setSavedJobs(data.savedJobs || []);
        if (data.cvUrl) { setCvUrl(data.cvUrl); setCvFileName(data.cvFileName || 'CV.pdf'); }
        if (data.idUrl) { setIdUrl(data.idUrl); setIdFileName(data.idFileName || 'ID.pdf'); setIdDocType(data.idDocType || 'id_card'); }
        setProfileForm(prev => ({
          ...prev,
          fullName: data.fullName || user.displayName || '',
          nationality: data.nationality || '',
          education: data.education || '',
          experience: data.experience || '',
          phone: data.phone || '',
          address: data.address || '',
          birthDate: data.birthDate || '',
          languages: data.languages || '',
          gender: data.gender || 'M',
          availability: data.availability || 'Immediate'
        }));
        const hasKeyData = !!(data.fullName && data.phone);
        if (!data.profileComplete && !hasKeyData) {
          try {
            const { getDocs, query: q2, collection: col2, where: wh } = await import('firebase/firestore');
            const usersSnap = await getDocs(q2(col2(db, 'users'), wh('firebaseUid', '==', user?.uid)));
            if (!usersSnap.empty) {
              const uData = usersSnap.docs[0].data();
              const uHasData = !!(uData.fullName && uData.phone);
              if (uHasData) {
                setProfileForm(prev => ({
                  ...prev,
                  fullName: uData.fullName || prev.fullName,
                  nationality: uData.nationality || prev.nationality,
                  education: uData.education || prev.education,
                  experience: uData.experience || prev.experience,
                  phone: uData.phone || prev.phone,
                  address: uData.address || prev.address,
                  birthDate: uData.birthDate || prev.birthDate,
                  languages: uData.languages || prev.languages,
                  gender: uData.gender || prev.gender,
                  availability: uData.availability || prev.availability,
                }));
                if (uData.cvUrl) { setCvUrl(uData.cvUrl); setCvFileName(uData.cvFileName || 'CV.pdf'); }
                updateDoc(doc(db, 'candidateProfiles', user?.uid), {
                  ...uData,
                  profileComplete: true,
                  userId: user?.uid,
                  firebaseUid: user?.uid,
                }).catch(() => {});
                setIsNewUser(false);
                setProfileChecked(true);
                return;
              }
            }
          } catch (e) { console.warn('users fallback failed:', e); }
          setIsNewUser(true);
          setOnboardingStep(1);
        } else {
          setIsNewUser(false);
          if (!data.profileComplete && hasKeyData) {
            updateDoc(doc(db, 'candidateProfiles', user?.uid), { profileComplete: true }).catch(() => {});
          }
        }
        setProfileChecked(true);
      } else {
        try {
          const { getDocs, query: q2, collection: col2, where: wh } = await import('firebase/firestore');
          const usersSnap = await getDocs(q2(col2(db, 'users'), wh('firebaseUid', '==', user?.uid)));
          if (!usersSnap.empty) {
            const data = usersSnap.docs[0].data();
            const hasData = !!(data.fullName || data.nationality || data.phone);
            setProfileForm(prev => ({
              ...prev,
              fullName: data.fullName || data.displayName || user.displayName || '',
              nationality: data.nationality || '',
              education: data.education || '',
              experience: data.experience || '',
              phone: data.phone || '',
              address: data.address || '',
              birthDate: data.birthDate || '',
              languages: data.languages || '',
              gender: data.gender || 'M',
              availability: data.availability || 'Immediate',
            }));
            if (data.cvUrl) { setCvUrl(data.cvUrl); setCvFileName(data.cvFileName || 'CV.pdf'); }
            if (hasData) {
              const { setDoc: sd2, doc: d3, serverTimestamp: st2 } = await import('firebase/firestore');
              await sd2(d3(db, 'candidateProfiles', user?.uid), {
                ...data, userId: user?.uid, firebaseUid: user?.uid,
                profileComplete: true, createdAt: st2(),
              }).catch(() => {});
              setProfile({ id: usersSnap.docs[0].id, ...data });
              setIsNewUser(false);
              setProfileChecked(true);
              return;
            }
          }
        } catch (e) { console.warn('users lookup failed:', e); }
        setProfileForm(prev => ({
          ...prev, fullName: user.displayName || '',
          nationality: '', education: '', experience: '',
          phone: '', address: '', birthDate: '',
          languages: '', gender: 'M', availability: 'Immediate',
        }));
        setIsNewUser(true);
        setOnboardingStep(1);
        setProfileChecked(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `candidateProfiles/${user?.uid}`);
    });

    const qMessages = query(
      collection(db, 'messages'),
      where('participantIds', 'array-contains', user?.uid),
      orderBy('createdAt', 'asc')
    );
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    const qJobs = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubscribeJobs = onSnapshot(qJobs, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
    });

    const qUserNotifs = query(
      collection(db, 'notifications'),
      where('userId', '==', user?.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeNotifs = onSnapshot(qUserNotifs, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUserNotifications(notifs);
      setUnreadNotifCount(notifs.filter((n: any) => !n.read).length);
    }, () => {});

    return () => {
      unsubscribeApps();
      unsubscribeProfile();
      unsubscribeMessages();
      unsubscribeJobs();
      unsubscribeNotifs();
    };
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const profilePath = `candidateProfiles/${user?.uid}`;
    try {
      await setDoc(doc(db, 'candidateProfiles', user?.uid), {
        ...profileForm,
        email: user.email,
        ...(cvUrl && { cvUrl, cvFileName }),
        ...(idUrl && { idUrl, idFileName, idDocType }),
        updatedAt: serverTimestamp()
      }, { merge: true });
      await updateDoc(doc(db, 'users', user?.uid), {
        displayName: profileForm.fullName,
        fullName: profileForm.fullName,
        phone: profileForm.phone || '',
        ...(cvUrl && { cvUrl, cvFileName }),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
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
      const storageRef = ref(storage, `cvs/${user?.uid}/${file.name}`);
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
          await updateDoc(doc(db, 'candidateProfiles', user?.uid), {
            cvUrl: downloadURL,
            cvFileName: file.name,
            cvUpdatedAt: serverTimestamp(),
          }).catch(() => {});
          await updateDoc(doc(db, 'users', user?.uid), {
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
      const storageRef = ref(storage, `ids/${user?.uid}/${file.name}`);
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
          await updateDoc(doc(db, 'candidateProfiles', user?.uid), {
            idUrl: downloadURL,
            idFileName: file.name,
            idDocType,
            idUpdatedAt: serverTimestamp(),
          }).catch(() => {});
          await updateDoc(doc(db, 'users', user?.uid), {
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
      await setDoc(doc(db, 'candidateProfiles', user?.uid), {
        ...profileForm,
        email: user.email,
        userId: user?.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        profileComplete: true,
      }, { merge: true });
      try {
        const { getDocs, query: q3, collection: col3, where: wh3, updateDoc, doc: d3 } = await import('firebase/firestore');
        const usersSnap = await getDocs(q3(col3(db, 'users'), wh3('firebaseUid', '==', user.uid)));
        if (!usersSnap.empty) {
          await updateDoc(d3(db, 'users', usersSnap.docs[0].id), {
            displayName: profileForm.fullName,
            fullName: profileForm.fullName,
            phone: profileForm.phone || '',
            nationality: profileForm.nationality || '',
            education: profileForm.education || '',
            experience: profileForm.experience || '',
            address: profileForm.address || '',
            birthDate: profileForm.birthDate || '',
            languages: profileForm.languages || '',
            gender: profileForm.gender || 'M',
            availability: profileForm.availability || '',
            profileComplete: true,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (usersErr) {
        console.warn('users doc update failed:', usersErr);
      }
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
        userId: user?.uid,
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
    
    const profilePath = `candidateProfiles/${user?.uid}`;
    try {
      await setDoc(doc(db, 'candidateProfiles', user?.uid), {
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
        senderId: user?.uid,
        senderName: profileForm.fullName || user.displayName || 'Candidat',
        participantIds: [user?.uid, 'admin'],
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
      setLoginError('');
      const provider = new GoogleAuthProvider();
      // signInWithPopup au lieu de signInWithRedirect : la page reste sur
      // vediorgm.com en permanence — seule une popup s'ouvre brièvement vers
      // Google/Firebase pour l'authentification (incontournable pour tout
      // login Google), sans jamais rediriger l'onglet principal. Évite aussi
      // le bug "missing initial state" du redirect cross-origin.
      const result = await authSignInWithPopup(auth, provider);
      const u = result.user;
      try {
        const { getDoc: gd, doc: d2, setDoc: sd } = await import('firebase/firestore');
        const userRef = d2(db, 'users', u.uid);
        const userSnap = await gd(userRef);
        if (!userSnap.exists()) {
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
        }
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
      } catch (e) {
        console.warn('[Auth] Google login user doc error:', e);
      }
    } catch (err: any) {
      console.error('[Auth] Google popup error:', err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setLoginError(err.message || 'Erreur connexion Google');
      }
    }
  };

  const loginLegacy = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await authSignInWithPopup(auth, provider);
      const u = result.user;
      const { getDoc: gd, doc: d2, setDoc: sd } = await import('firebase/firestore');
      const userRef = d2(db, 'users', u.uid);
      const userSnap = await gd(userRef);
      if (!userSnap.exists()) {
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

      try {
        const fns = getFunctions(db.app, 'europe-west1');
        const call = httpsCallable(fns, 'sendVerificationEmail');
        await call({});
      } catch (verifyErr) {
        console.error('sendVerificationEmail failed:', verifyErr);
      }

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
      await sd(d2(db, 'candidateProfiles', u.uid), {
        uid: u.uid,
        email: u.email || loginEmail,
        fullName: '',
        profileComplete: false,
        createdAt: serverTimestamp(),
      });

      setLoginError('');
      setLoginResetSent(true);
      setLoginPassword('');
      setLoginConfirm('');
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
      const fns = getFunctions(db.app, 'europe-west1');
      const call = httpsCallable(fns, 'requestPasswordReset');
      await call({ email: loginEmail });
      setLoginResetSent(true);
      setLoginPassword('');
      setLoginConfirm('');
    } catch (error: any) {
      setLoginError(error.code === 'functions/resource-exhausted' ? 'Trop de tentatives. Réessayez dans 15 minutes.' : 'Email introuvable ou invalide.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginPhone || !tempPassword) { setLoginError('Please fill in your phone number and password.'); return; }
    const digits = loginPhone.replace(/[\s\-\+]/g, '').replace(/^253/, '');
    if (!/^[0-9]{6,15}$/.test(digits)) { setLoginError('Invalid format. Example: 77310000 or +25377310000'); return; }
    setLoginLoading(true);
    try {
      const authEmail = `${digits}@vediorgm.candidate`;
      const cred = await signInWithEmailAndPassword(auth, authEmail, tempPassword);
      try {
        const userSnap = await getDocs(query(collection(db, 'users'), where('firebaseUid', '==', cred.user.uid)));
        if (!userSnap.empty) {
          const uData = userSnap.docs[0].data();
          const hasRealEmail = uData.email && !uData.email.endsWith('@vediorgm.candidate');
          if (!uData.gmailConfirmed && hasRealEmail) { setGmailRequired(true); }
          else if (!uData.gmailConfirmed) { await updateDoc(userSnap.docs[0].ref, { gmailConfirmed: true }).catch(() => {}); }
        }
      } catch (_) {}
    } catch (error: any) {
      const codes: Record<string, string> = {
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-credential': 'Incorrect phone number or password.',
        'auth/user-not-found': 'No account found. Please contact Vedior GM.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
      };
      setLoginError(codes[error.code] || `Login failed (${error.code}). Please contact Vedior GM.`);
    } finally { setLoginLoading(false); }
  };

  const stats = {
    total: applications.length,
    new: applications.filter(a => a.status === 'new' || !a.status).length,
    interview: applications.filter(a => a.status === 'interview').length,
    accepted: applications.filter(a => a.status === 'hired').length
  };

  // ══════════════════════════════════════════
  // RENDU — Priorité au formulaire de réinitialisation
  // ══════════════════════════════════════════
  if (showResetForm && resetCode) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A192F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowX: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '40vw', maxWidth: 500, height: 500, backgroundColor: '#f97316', borderRadius: '50%', filter: 'blur(160px)', transform: 'translate(-50%,-50%)', opacity: 0.07, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '40vw', maxWidth: 500, height: 500, backgroundColor: '#3b82f6', borderRadius: '50%', filter: 'blur(160px)', transform: 'translate(50%,50%)', opacity: 0.07, pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}><Logo inverted /></div>
            <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.02em' }}>
              {lang === 'FR' ? 'Nouveau mot de passe' : 'New password'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '8px' }}>
              {lang === 'FR' ? 'Pour le compte' : 'For account'} <span style={{ color: '#f97316' }}>{resetEmail}</span>
            </p>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', padding: '32px' }}>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (newPassword !== resetConfirmPassword) {
                setNotification({ message: lang === 'FR' ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.', type: 'error' });
                setTimeout(() => setNotification(null), 3000);
                return;
              }
              if (newPassword.length < 6) {
                setNotification({ message: lang === 'FR' ? 'Minimum 6 caractères.' : 'Minimum 6 characters.', type: 'error' });
                setTimeout(() => setNotification(null), 3000);
                return;
              }
              setResetLoading(true);
              try {
                await confirmPasswordReset(auth, resetCode, newPassword);
                setNotification({ message: lang === 'FR' ? '✅ Mot de passe mis à jour !' : '✅ Password updated!', type: 'success' });
                setTimeout(() => {
                  setNotification(null);
                  setShowResetForm(false);
                  setResetCode('');
                  setResetEmail('');
                  window.history.replaceState({}, '', window.location.pathname);
                }, 2000);
              } catch (error) {
                console.error('Reset error:', error);
                setNotification({ message: lang === 'FR' ? '❌ Erreur, lien invalide ou expiré.' : '❌ Invalid or expired link.', type: 'error' });
                setTimeout(() => setNotification(null), 4000);
              } finally {
                setResetLoading(false);
              }
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
                  {lang === 'FR' ? 'Nouveau mot de passe' : 'New password'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
                  {lang === 'FR' ? 'Confirmer' : 'Confirm'}
                </label>
                <input
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                style={{
                  width: '100%', background: resetLoading ? 'rgba(249,115,22,0.5)' : '#f97316', color: 'white',
                  border: 'none', borderRadius: '14px', padding: '16px',
                  fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: resetLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {resetLoading ? '...' : (lang === 'FR' ? 'Mettre à jour' : 'Update')}
              </button>
            </form>
          </div>
          {notification && (
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '14px', backgroundColor: notification.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${notification.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: notification.type === 'success' ? '#4ade80' : '#f87171', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
              {notification.message}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── ONBOARDING ──
  if (user && profileChecked && isNewUser) {
    const steps = [
      { num: 1, label: lang === 'FR' ? 'Identité' : 'Identity' },
      { num: 2, label: lang === 'FR' ? 'Formation' : 'Education' },
      { num: 3, label: lang === 'FR' ? 'Disponibilité' : 'Availability' },
      { num: 4, label: 'CV' },
    ];

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A192F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowX: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '40vw', maxWidth: 500, height: 500, backgroundColor: '#f97316', borderRadius: '50%', filter: 'blur(160px)', transform: 'translate(-50%,-50%)', opacity: 0.07, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '40vw', maxWidth: 500, height: 500, backgroundColor: '#3b82f6', borderRadius: '50%', filter: 'blur(160px)', transform: 'translate(50%,50%)', opacity: 0.07, pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}><Logo inverted /></div>
            <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.02em' }}>
              {lang === 'FR' ? 'Bienvenue !' : 'Welcome!'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '8px' }}>
              {lang === 'FR' ? 'Complétez votre profil pour commencer' : 'Complete your profile to get started'}
            </p>
          </div>
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
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', padding: '32px' }}>
            {onboardingStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: '#f97316', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>
                  {lang === 'FR' ? '👤 Vos informations personnelles' : '👤 Your personal information'}
                </p>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
                    {lang === 'FR' ? 'Nom complet *' : 'Full name *'}
                  </label>
                  <input id="fullName" name="fullName" value={profileForm.fullName} onChange={e => setProfileForm(p => ({...p, fullName: e.target.value}))}
                    placeholder={lang === 'FR' ? 'Mohamed Ahmed Ali' : 'Mohamed Ahmed Ali'}
                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? 'Téléphone *' : 'Phone *'}</label>
                    <input id="phone" name="phone" value={profileForm.phone} onChange={e => setProfileForm(p => ({...p, phone: e.target.value}))}
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
                    <input type="text" id="birthDate" name="birthDate" 
                      value={profileForm.birthDate}
                      onChange={e => {
                        let v = e.target.value.replace(/[^0-9]/g, '');
                        if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
                        if (v.length >= 6) v = v.slice(0,5) + '/' + v.slice(5,9);
                        setProfileForm(p => ({...p, birthDate: v.slice(0,10)}));
                      }}
                      placeholder="jj/mm/aaaa" maxLength={10}
                      style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '13px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
                  </div>
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? 'Adresse / Quartier *' : 'Address / District *'}</label>
                  <input id="address" name="address" value={profileForm.address} onChange={e => setProfileForm(p => ({...p, address: e.target.value}))}
                    placeholder={lang === 'FR' ? 'Ex: Balbala, Djibouti Ville...' : 'Ex: Balbala, Djibouti City...'}
                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '14px', padding: '14px 18px', fontWeight: 700, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
            {onboardingStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: '#f97316', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>
                  {lang === 'FR' ? '🎓 Formation & Expérience' : '🎓 Education & Experience'}
                </p>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? "Niveau d'études" : 'Education level'}</label>
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
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>{lang === 'FR' ? "Années d'expérience" : 'Years of experience'}</label>
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
          {notification && (
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '14px', backgroundColor: notification.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${notification.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: notification.type === 'success' ? '#4ade80' : '#f87171', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
              {notification.message}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-[#0A192F] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (user && !profileChecked) {
    return (
      <div className="fixed inset-0 bg-[#0A192F] flex flex-col items-center justify-center gap-5">
        <div className="w-12 h-12 border-4 border-white/10 border-t-orange rounded-full animate-spin" />
        <p className="text-white/30 text-xs font-black uppercase tracking-widest">Loading profile...</p>
        <button
          onClick={async () => { try { await signOut(auth); } catch(e) {} setUser(null); if (onSignOutRef.current) { onSignOutRef.current(); } else if (onBackRef.current) { onBackRef.current(); } }}
          className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white/50 text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all"
        >← Sign out</button>
      </div>
    );
  }

  if (!user && !authLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A192F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 500, height: 500, backgroundColor: '#f97316', borderRadius: '50%', filter: 'blur(160px)', transform: 'translate(-50%,-50%)', opacity: 0.07, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 500, height: 500, backgroundColor: '#3b82f6', borderRadius: '50%', filter: 'blur(160px)', transform: 'translate(50%,50%)', opacity: 0.07, pointerEvents: 'none' }} />
        <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}><Logo inverted /></div>
            <p style={{ color: 'white', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
              CANDIDATE <span style={{ color: '#f97316' }}>SPACE</span>
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '6px' }}>
              {lang === 'FR' ? 'Choisissez votre méthode de connexion' : lang === 'AR' ? 'اختر طريقة تسجيل الدخول' : 'Choose your login method'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '4px' }}>
            {(['phone', 'google'] as const).map(tab => (
              <button key={tab} onClick={() => setLoginTab(tab)} style={{
                flex: 1, padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'all 0.2s',
                background: loginTab === tab ? '#f97316' : 'transparent',
                color: loginTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
              }}>
                {tab === 'phone' ? '📱 ' : '🔑 '}
                {tab === 'phone' ? (lang === 'FR' ? 'Téléphone' : lang === 'AR' ? 'هاتف' : 'Phone') : 'Gmail'}
              </button>
            ))}
          </div>
          {loginError && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', color: '#fca5a5', fontSize: '13px', fontWeight: 600 }}>
              ⚠️ {loginError}
            </div>
          )}
          {loginTab === 'phone' && (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '20px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ background: 'rgba(249,115,22,0.1)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📱</span>
                <div>
                  <p style={{ color: '#f97316', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                    {lang === 'FR' ? 'CONNEXION PAR TÉLÉPHONE' : lang === 'AR' ? 'تسجيل الدخول برقم الهاتف' : 'LOGIN WITH PHONE NUMBER'}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px' }}>
                    {lang === 'FR' ? 'Entrez votre numéro et mot de passe.' : lang === 'AR' ? 'أدخل رقم هاتفك وكلمة المرور.' : 'Enter your registered phone number and password.'}
                  </p>
                </div>
              </div>
              <form onSubmit={handlePhoneLogin}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
                    {lang === 'FR' ? 'NUMÉRO DE TÉLÉPHONE' : lang === 'AR' ? 'رقم الهاتف' : 'PHONE NUMBER'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>📱</span>
                    <input id="loginPhone" name="loginPhone" type="tel"
                      value={loginPhone} onChange={e => setLoginPhone(e.target.value)}
                      placeholder="77310000" autoComplete="off"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '14px 16px 14px 48px', color: 'white', fontSize: '15px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '6px' }}>Example: 77310000 or +25377310000</p>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
                    {lang === 'FR' ? 'MOT DE PASSE' : lang === 'AR' ? 'كلمة المرور' : 'PASSWORD'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>🔒</span>
                    <input id="loginPassword" name="loginPassword" type="password"
                      value={tempPassword} onChange={e => setTempPassword(e.target.value)}
                      autoComplete="current-password"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '14px 16px 14px 48px', color: 'white', fontSize: '15px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <button type="submit" disabled={loginLoading} style={{
                  width: '100%', background: loginLoading ? 'rgba(249,115,22,0.5)' : '#f97316', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loginLoading ? 'not-allowed' : 'pointer'
                }}>
                  {loginLoading ? '...' : (lang === 'FR' ? 'ACCÉDER À MON ESPACE →' : lang === 'AR' ? 'الوصول إلى مساحتي ←' : 'ACCESS MY SPACE →')}
                </button>
              </form>
              <p style={{ textAlign: 'center', marginTop: '16px', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>
                {lang === 'FR' ? 'Numéro inconnu ?' : 'Unknown number?'}{' '}
                <a href="mailto:vediordjib.it@gmail.com" style={{ color: '#f97316', fontWeight: 700, textDecoration: 'none' }}>Contact Vedior GM</a>
              </p>
            </div>
          )}
          {loginTab === 'google' && (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '20px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '20px' }}>
                {lang === 'FR' ? 'Connectez-vous avec votre compte Google.' : 'Sign in with your Google account.'}
              </p>
              <button onClick={login} disabled={loginLoading} style={{
                width: '100%', background: 'white', color: '#1a1a1a', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
              }}>
                <span style={{ fontSize: '20px' }}>🔑</span>
                {lang === 'FR' ? 'Continuer avec Google' : 'Continue with Google'}
              </button>
            </div>
          )}
          <p style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={onBack} style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ← {lang === 'FR' ? 'RETOUR AU PORTAIL' : lang === 'AR' ? 'العودة إلى البوابة' : 'BACK TO PORTAL'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── DASHBOARD PRINCIPAL ──
  return (
    <div dir={dir} className="fixed inset-0 bg-[#F0F2F8] text-gray-900 font-sans flex overflow-hidden relative">
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
      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:sticky lg:top-0 z-50 w-[240px] min-w-[240px] bg-[#12152B] text-white flex flex-col overflow-hidden shrink-0 h-screen transition-transform duration-300`}>
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.06] cursor-pointer" onClick={onBack}>
          <div className="flex items-center gap-3">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-orange-500 flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <Logo inverted size="sm" />
          </div>
          <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-[0.12em] block mt-2">{lang === 'FR' ? 'Espace Candidat' : 'Candidate Space'}</span>
        </div>
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/25">{lang === 'FR' ? 'Principal' : 'Main'}</p>
          <CandNavItem icon={LayoutDashboard} label={lang === 'FR' ? 'Tableau de bord' : 'Dashboard'} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} />
          <CandNavItem icon={FileText} label={lang === 'FR' ? 'Mes Candidatures' : 'My Applications'} active={activeTab === 'applications'} onClick={() => { setActiveTab('applications'); setSidebarOpen(false); }} badge={activeTab !== 'applications' && applications.length > 0 ? applications.length : undefined} />
          <CandNavItem icon={Search} label={lang === 'FR' ? "Offres d'emploi" : 'Job Offers'} active={activeTab === 'offers'} onClick={() => { setActiveTab('offers'); setSidebarOpen(false); }} />
          <CandNavItem icon={Star} label={lang === 'FR' ? 'Favoris' : 'Favorites'} active={activeTab === 'favorites'} onClick={() => { setActiveTab('favorites'); setSidebarOpen(false); }} />
          <p className="px-2 mt-5 mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/25">{lang === 'FR' ? 'Compte' : 'Account'}</p>
          <CandNavItem icon={MessageSquare} label={lang === 'FR' ? 'Messages' : 'Messages'} active={activeTab === 'messages'} onClick={() => { setActiveTab('messages'); setSidebarOpen(false); }} badge={messages.length > 0 ? messages.length : undefined} />
          <CandNavItem icon={User} label={lang === 'FR' ? 'Mon Profil' : 'My Profile'} active={activeTab === 'profile'} onClick={() => { setActiveTab('profile'); setSidebarOpen(false); }} />
          <CandNavItem icon={Settings} label={lang === 'FR' ? 'Paramètres' : 'Settings'} active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }} />
        </nav>
        <div className="mt-auto p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#1E2240] transition-colors">
            <div className="w-[34px] h-[34px] rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {(profile?.photoUrl || profile?.photoURL || user?.photoURL)
                ? <img src={profile?.photoUrl || profile?.photoURL || user?.photoURL || ''} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                : <span>{(profileForm.fullName || user?.email)?.charAt(0).toUpperCase()}</span>
              }
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
              <p className="text-[11px] text-white/60 truncate">{lang === 'FR' ? 'Candidat' : 'Candidate'}</p>
            </div>
          </div>
          <button onClick={async () => {
            if (onSignOutRef.current) { onSignOutRef.current(); } else { onBackRef.current?.(); }
            try { await signOut(auth); } catch(e) { console.warn('signOut error:', e); }
          }} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 text-red-300 font-semibold text-[10px] uppercase hover:bg-red-500/20 transition-all">
            <LogOut size={12} /> {lang === 'FR' ? 'Déconnexion' : 'Sign Out'}
          </button>
        </div>
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#12152B] border-t border-white/10 flex items-stretch z-40" style={{height:56, paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
        {[
          { tab: 'dashboard', icon: '🏠', labelFR: 'Accueil', labelEN: 'Home' },
          { tab: 'offers',    icon: '💼', labelFR: 'Offres',  labelEN: 'Offers' },
          { tab: 'applications', icon: '📋', labelFR: 'Dossiers', labelEN: 'Apps' },
          { tab: 'messages',  icon: '💬', labelFR: 'Messages', labelEN: 'Messages' },
          { tab: 'profile',   icon: '👤', labelFR: 'Profil',  labelEN: 'Profile' },
        ].map(item => (
          <button key={item.tab} onClick={() => setActiveTab(item.tab as any)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${activeTab === item.tab ? 'text-orange-400' : 'text-white/40'}`}>
            <span className="text-base leading-none">{item.icon}</span>
            <span className="text-[9px] font-black uppercase tracking-wider">{lang === 'FR' ? item.labelFR : item.labelEN}</span>
            {activeTab === item.tab && <div className="absolute top-0 w-8 h-0.5 bg-orange-400 rounded-full" />}
          </button>
        ))}
      </nav>
      <main className="flex-1 flex flex-col overflow-auto bg-[#f0f4fb] pb-[70px] lg:pb-0">
        <header className="bg-white border-b border-gray-100 px-3 py-3 flex items-center gap-2 sm:gap-4">
          <button onClick={() => setSidebarOpen(o => !o)} className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-500 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div>
            <span className="text-blue-500 font-black uppercase tracking-[0.35em] text-[10px] block mb-1">
              {activeTab === 'offers' ? (lang === 'FR' ? 'OFFRES' : 'OFFERS') : activeTab.toUpperCase()}
            </span>
            <h1 className="text-base sm:text-2xl font-black text-[#0f1f3d] leading-tight">
              {lang === 'FR' ? 'Bonjour,' : 'Hello,'}{' '}
              <span className="text-[#1a56db]">{user?.displayName?.split(' ')[0] || user?.email?.split('@')[0]}</span>{' '}
              <span>👋</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <div className="relative hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                id="search" name="search"
                placeholder={lang === 'FR' ? 'Rechercher une offre...' : 'Search a position...'}
                className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-48 sm:w-64 transition-all"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center">
                <Search size={13} className="text-white" />
              </button>
            </div>
            <button onClick={() => setShowNotifPanel(v => !v)} className="relative w-10 h-10 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
              <Bell size={17} />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] font-black flex items-center justify-center border border-white">{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</span>
              )}
            </button>
            <AnimatePresence>
              {showNotifPanel && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-3 sm:right-6 top-14 w-[90vw] max-w-sm bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-black text-gray-900">{lang === 'FR' ? 'Notifications' : 'Notifications'}</p>
                      {unreadNotifCount > 0 && (
                        <button
                          onClick={async () => {
                            const unread = userNotifications.filter((n: any) => !n.read);
                            await Promise.all(unread.map((n: any) => updateDoc(doc(db, 'notifications', n.id), { read: true })));
                          }}
                          className="text-[10px] font-bold text-blue-600 uppercase hover:underline"
                        >
                          {lang === 'FR' ? 'Tout marquer lu' : 'Mark all read'}
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {userNotifications.length === 0 ? (
                        <div className="py-10 text-center text-gray-300">
                          <Bell size={28} strokeWidth={1.5} className="mx-auto mb-2" />
                          <p className="text-xs font-bold">{lang === 'FR' ? 'Aucune notification' : 'No notifications'}</p>
                        </div>
                      ) : (
                        userNotifications.slice(0, 20).map((n: any) => (
                          <button
                            key={n.id}
                            onClick={async () => {
                              if (!n.read) await updateDoc(doc(db, 'notifications', n.id), { read: true });
                              if (n.type === 'application_status' || n.type === 'pipeline_update') { setActiveTab('applications'); setShowNotifPanel(false); }
                            }}
                            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}
                          >
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
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
            <button
              onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR' as any)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-black text-gray-600 hover:border-blue-400 transition-all"
            >
              {lang} <span className="text-gray-400">▾</span>
            </button>
          </div>
        </header>
        <div className="p-3 sm:p-5 lg:p-8">
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
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="lg:col-span-2 bg-gray-900 rounded-2xl p-4 sm:p-8 text-white relative overflow-hidden group">
                      <div className="absolute -top-20 -right-20 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
                      <div className="relative z-10 flex flex-col h-full gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center">
                            <Star className="text-orange-400" size={22} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-0.5">{lang === 'FR' ? 'STATUT PROFIL' : lang === 'AR' ? 'حالة الملف' : 'PROFILE STATUS'}</p>
                            <h2 className="text-xl font-black">{lang === 'FR' ? 'Profil Optimisé' : lang === 'AR' ? 'الملف الشخصي' : 'Optimised Profile'}</h2>
                          </div>
                        </div>
                        {(() => {
                          const pct = Math.round(([!!profileForm.fullName,!!profileForm.phone,!!profileForm.nationality,!!profileForm.birthDate,!!profileForm.address,!!profileForm.education,!!profileForm.experience,!!profileForm.languages,!!cvUrl,!!idUrl].filter(Boolean).length/10)*100);
                          return (
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <p className="text-white/60 text-sm font-semibold">
                                  {lang === 'FR' ? `Complété à ${pct}%` : lang === 'AR' ? `مكتمل بنسبة ${pct}%` : `${pct}% complete`}
                                </p>
                                <span className="text-orange-400 text-sm font-black">{pct}%</span>
                              </div>
                              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                              </div>
                              {pct < 100 && (
                                <p className="text-white/40 text-[11px] font-medium mt-2 italic">
                                  {lang === 'FR' ? 'Complétez votre profil pour augmenter votre visibilité auprès des recruteurs.' : lang === 'AR' ? 'أكمل ملفك لتحسين ظهورك للمجندين.' : 'Complete your profile to boost your visibility with recruiters.'}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex flex-wrap gap-3 mt-auto">
                          <button onClick={() => setActiveTab('profile')}
                            className="bg-white text-gray-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-400 hover:text-white transition-all flex items-center gap-2 active:scale-95">
                            {lang === 'FR' ? 'Peaufiner mon CV' : lang === 'AR' ? 'تحسين سيرتي' : 'Refine my CV'} <ArrowRight size={14} />
                          </button>
                          <button onClick={() => setActiveTab('offers')}
                            className="bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95">
                            {lang === 'FR' ? 'Explorer les offres' : lang === 'AR' ? 'استعرض الوظائف' : 'Explore offers'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="bg-gray-900 rounded-2xl p-5 text-white flex flex-col justify-between flex-1 relative overflow-hidden group">
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl" />
                        <div className="relative z-10">
                          <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center mb-5">
                            <Bell size={20} />
                          </div>
                          <h3 className="text-3xl font-black leading-none mb-2">{messages.filter((m: any) => !m.readByCandidate).length}</h3>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{lang === 'FR' ? 'Nouveaux messages' : lang === 'AR' ? 'رسائل جديدة' : 'New messages'}</p>
                        </div>
                        <button onClick={() => setActiveTab('messages')}
                          className="relative z-10 mt-6 w-full py-3 bg-white text-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-400 hover:text-white transition-all active:scale-95">
                          {lang === 'FR' ? 'Ma boîte mail' : lang === 'AR' ? 'صندوق الرسائل' : 'Check Inbox'}
                        </button>
                      </div>
                      <div className="bg-orange-500 rounded-2xl p-4 sm:p-7 text-white relative overflow-hidden">
                        <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-white/70">{lang === 'FR' ? 'OFFRES DISPONIBLES' : lang === 'AR' ? 'وظائف متاحة' : 'AVAILABLE JOBS'}</p>
                        <h3 className="text-4xl font-black">{jobs.filter(j => j.status === 'active' || j.status === 'published').length}</h3>
                        <button onClick={() => setActiveTab('offers')}
                          className="mt-4 text-[10px] font-black uppercase tracking-widest text-white/80 hover:text-white flex items-center gap-1 transition-all">
                          {lang === 'FR' ? 'Voir tout' : lang === 'AR' ? 'عرض الكل' : 'View all'} <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { label: lang === 'FR' ? 'Candidatures' : lang === 'AR' ? 'طلباتي' : 'Applications', val: stats.total, icon: Briefcase, bg: 'bg-white', num: 'text-gray-900' },
                      { label: lang === 'FR' ? 'En attente' : lang === 'AR' ? 'قيد المعالجة' : 'Pending', val: stats.new, icon: Clock, bg: 'bg-white', num: 'text-gray-900' },
                      { label: lang === 'FR' ? 'Entretiens' : lang === 'AR' ? 'مقابلات' : 'Interviews', val: stats.interview, icon: Calendar, bg: 'bg-white', num: 'text-gray-900' },
                      { label: lang === 'FR' ? 'Acceptés' : lang === 'AR' ? 'مقبول' : 'Accepted', val: stats.accepted, icon: CheckCircle2, bg: 'bg-gray-900', num: 'text-white' }
                    ].map((s, i) => (
                      <div key={i} className={`${s.bg} p-3 sm:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer`}
                        onClick={() => setActiveTab('applications')}>
                        <div className={`w-10 h-10 ${i === 3 ? 'bg-orange-500' : 'bg-gray-100'} rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:-rotate-6 transition-transform`}>
                          <s.icon size={20} className={i === 3 ? 'text-white' : 'text-gray-700'} />
                        </div>
                        <div className={`text-2xl font-black ${s.num} mb-1 tabular-nums`}>{s.val}</div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${i === 3 ? 'text-white/50' : 'text-gray-400'}`}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-50">
                        <div>
                          <h3 className="text-lg font-black text-gray-900">{lang === 'FR' ? 'Offres récentes' : lang === 'AR' ? 'أحدث الوظائف' : 'Recent Job Offers'}</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{lang === 'FR' ? 'Correspondant à votre profil' : lang === 'AR' ? 'تتوافق مع ملفك' : 'Matching your profile'}</p>
                        </div>
                        <button onClick={() => setActiveTab('offers')}
                          className="text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-all">
                          {lang === 'FR' ? 'Voir tout' : lang === 'AR' ? 'الكل' : 'All'} <ArrowRight size={12} />
                        </button>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {jobs.filter(j => j.status === 'active' || j.status === 'published').slice(0, 5).length > 0 ? (
                          jobs.filter(j => j.status === 'active' || j.status === 'published').slice(0, 5).map((job, i) => (
                            <div key={job.id} className="flex items-center gap-3 p-3 sm:p-4 hover:bg-gray-50/80 transition-all cursor-pointer group"
                              onClick={() => setActiveTab('offers')}>
                              <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center text-white shrink-0 group-hover:bg-orange-500 transition-colors">
                                {job.sector ? getSectorIcon(job.sector) : <Briefcase size={18} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-black text-gray-900 truncate">{job.title || job.jobTitle || '—'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-gray-400">{job.company || job.companyName || '—'}</span>
                                  {job.location && <span className="text-[10px] text-gray-300">· {job.location}</span>}
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1">
                                {job.contractType && (
                                  <span className="text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{job.contractType}</span>
                                )}
                                {job.salary && (
                                  <span className="text-[9px] font-bold text-orange-500">{job.salary}</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center p-8 sm:p-14 text-center opacity-30">
                            <Briefcase size={40} strokeWidth={1} className="mb-3 text-gray-400" />
                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{lang === 'FR' ? 'Aucune offre disponible' : lang === 'AR' ? 'لا توجد وظائف' : 'No jobs available'}</p>
                          </div>
                        )}
                      </div>
                      {jobs.filter(j => j.status === 'active' || j.status === 'published').length > 5 && (
                        <div className="p-5 border-t border-gray-50">
                          <button onClick={() => setActiveTab('offers')}
                            className="w-full py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all active:scale-95">
                            {lang === 'FR' ? `Voir toutes les offres (${jobs.filter(j => j.status === 'active' || j.status === 'published').length})` : lang === 'AR' ? `عرض كل الوظائف (${jobs.filter(j => j.status === 'active' || j.status === 'published').length})` : `View all jobs (${jobs.filter(j => j.status === 'active' || j.status === 'published').length})`}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-50">
                        <div>
                          <h3 className="text-lg font-black text-gray-900">{lang === 'FR' ? 'Mes candidatures' : lang === 'AR' ? 'طلباتي الأخيرة' : 'My Applications'}</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{lang === 'FR' ? 'Activité récente' : lang === 'AR' ? 'النشاط الأخير' : 'Recent activity'}</p>
                        </div>
                        <Activity size={18} className="text-gray-400" />
                      </div>
                      <div className="flex-1 divide-y divide-gray-50">
                        {applications.slice(0, 5).length > 0 ? (
                          applications.slice(0, 5).map((app) => (
                            <div key={app.id} className="flex items-center gap-3 p-3 sm:p-4 hover:bg-gray-50/80 transition-all cursor-pointer group"
                              onClick={() => setActiveTab('applications')}>
                              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-all shrink-0">
                                {app.sector ? getSectorIcon(app.sector) : <Briefcase size={16} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-gray-900 truncate">{app.jobTitle || (lang === 'FR' ? 'Candidature spontanée' : 'Spontaneous application')}</p>
                                <div className="mt-1">
                                  <StatusBadge status={app.status || 'new'} lang={lang} />
                                </div>
                              </div>
                              <span className="text-[9px] text-gray-300 font-bold shrink-0">{app.createdAt ? new Date(app.createdAt.seconds * 1000).toLocaleDateString() : '—'}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center p-8 text-center opacity-30">
                            <Search size={32} strokeWidth={1} className="mb-2 text-gray-400" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{lang === 'FR' ? 'Aucun dossier trouvé' : lang === 'AR' ? 'لا يوجد طلبات' : 'No applications yet'}</p>
                          </div>
                        )}
                      </div>
                      <div className="p-5 border-t border-gray-50 mt-auto">
                        <button onClick={() => setActiveTab('applications')}
                          className="w-full py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all active:scale-95 flex items-center justify-center gap-2">
                          {lang === 'FR' ? "Voir l'historique" : lang === 'AR' ? 'عرض السجل' : 'View History'} <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:block bg-white p-4 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4 sm:mb-8">
                      <div>
                        <h3 className="text-lg font-black text-gray-900">{lang === 'FR' ? 'Performance Recrutement' : lang === 'AR' ? 'أداء التوظيف' : 'Recruitment Performance'}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{lang === 'FR' ? 'Tendances de consultation de votre profil' : lang === 'AR' ? 'إحصائيات الملف' : 'Profile view trends'}</p>
                      </div>
                      <div className="p-3 bg-gray-100 rounded-xl hover:bg-gray-900 hover:text-white transition-all group cursor-pointer">
                        <TrendingUp size={20} className="text-gray-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={getRealChartData(applications)}>
                          <defs>
                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                          <YAxis hide />
                          <Tooltip cursor={{ stroke: '#f97316', strokeWidth: 1.5, strokeDasharray: '5 5' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.12)', fontWeight: 900, fontSize: '11px', padding: '12px' }} />
                          <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'applications' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-0 sm:px-6">
                    <div>
                      <h2 className="text-xl sm:text-3xl font-black text-gray-900 mb-1">{lang === 'FR' ? 'Suivi Dossiers' : 'Application Tracking'}</h2>
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
                  <div className="grid gap-3">
                    {applications.length > 0 ? (
                      applications.map((app) => (
                        <div key={app.id} className="group bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-1 h-full bg-gray-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center text-white shrink-0">
                            {app.sector ? getSectorIcon(app.sector) : <Briefcase size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate">{app.jobTitle || 'Candidature Spontanée'}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">Ref: {app.id.slice(0, 8).toUpperCase()}</span>
                              <span className="flex items-center gap-1 text-[9px] font-bold text-gray-400"><Calendar size={10} /> {app.createdAt ? new Date(app.createdAt.seconds * 1000).toLocaleDateString() : '--'}</span>
                              <span className="text-[9px] font-bold text-gray-400">{app.sector || 'Général'}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <StatusBadge status={app.status || 'new'} lang={lang} />
                            <button 
                              onClick={() => setSelectedApp(app)}
                              className="px-3 py-1.5 bg-gray-900 text-white text-[9px] font-black uppercase tracking-normal rounded-lg flex items-center gap-1.5 active:scale-95 transition-all">
                              {lang === 'FR' ? 'Consulter' : 'View'} 
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100 opacity-40">
                         <Search size={40} strokeWidth={1.5} className="mx-auto mb-3 text-gray-400" />
                         <p className="font-black uppercase text-sm tracking-normal text-gray-400">{lang === 'FR' ? 'Aucun Dossier Trouvé' : 'No Applications Found'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                   <div className="bg-white p-4 sm:p-8 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                      <div className="flex flex-row items-center gap-4 relative z-10">
                        <div className="relative shrink-0">
                          <div className="w-20 h-20 sm:w-28 sm:h-28 bg-gray-900 rounded-2xl sm:rounded-3xl overflow-hidden">
                             {(profile?.photoUrl || profile?.photoURL || user?.photoURL) ? (
                               <img src={profile?.photoUrl || profile?.photoURL || user?.photoURL || ''} alt={profileForm.fullName || user?.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-white text-3xl sm:text-5xl font-black">{(profileForm.fullName || user?.displayName)?.charAt(0)?.toUpperCase() || '?'}</div>
                             )}
                          </div>
                          <button className="absolute -bottom-2 -right-2 w-7 h-7 sm:w-9 sm:h-9 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow border-2 border-white active:scale-90 transition-all">
                             <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="text-base sm:text-2xl font-black text-gray-900 truncate max-w-[200px] sm:max-w-none">{profileForm.fullName || user?.displayName || user?.email?.split('@')[0]}</h3>
                            <div className="px-2 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded-full text-[9px] font-black uppercase tracking-wide flex items-center gap-1 shrink-0">
                              <ShieldCheck size={10} /> {lang === 'FR' ? 'Vérifié' : 'Verified'}
                            </div>
                          </div>
                          {user?.email && !user.email.endsWith('@vediorgm.candidate') && (
                            <p className="text-gray-400 text-xs font-medium mb-2 truncate">{user.email}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(profileForm.address && profileForm.address.length > 2) && (
                              <div className="px-3 py-1.5 bg-gray-100 rounded-xl flex items-center gap-1.5">
                                <MapPin size={11} className="text-gray-600 shrink-0" />
                                <span className="text-[10px] font-black uppercase text-gray-700">{profileForm.address}</span>
                              </div>
                            )}
                            {profileForm.experience && profileForm.experience !== '0 (Sans expérience)' && (
                              <div className="px-3 py-1.5 bg-gray-100 rounded-xl flex items-center gap-1.5">
                                <Briefcase size={11} className="text-gray-600 shrink-0" />
                                <span className="text-[10px] font-black uppercase text-gray-700">{profileForm.experience}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                   </div>
                   <form onSubmit={handleSaveProfile} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="bg-white p-4 sm:p-8 rounded-xl border border-gray-100 shadow-sm space-y-5">
                        <div className="flex items-center gap-4 mb-2">
                           <div className="w-9 h-9 bg-gray-900 text-white rounded-xl flex items-center justify-center">
                             <User size={18} />
                           </div>
                           <h3 className="text-xl font-black text-gray-900 font-semibold">{lang === 'FR' ? 'Identité & Contact' : 'Identity & Contact'}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 ml-1 flex items-center gap-1">
                              {lang === 'FR' ? 'Nom Complet' : 'Full Name'}
                              <span className="text-gray-300" title={lang === 'FR' ? 'Non modifiable' : 'Not editable'}>🔒</span>
                            </label>
                            <input 
                              type="text" 
                              value={profileForm.fullName}
                              readOnly
                              disabled
                              className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 outline-none cursor-not-allowed select-none" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 ml-1">{lang === 'FR' ? 'Nationalité' : 'Nationality'}</label>
                            <select
                              value={profileForm.nationality}
                              onChange={(e) => setProfileForm({...profileForm, nationality: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-4 py-3 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none"
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
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 ml-1 flex items-center gap-1">
                              {lang === 'FR' ? 'Téléphone' : 'Phone'}
                              <span className="text-gray-300" title={lang === 'FR' ? 'Non modifiable' : 'Not editable'}>🔒</span>
                            </label>
                            <input 
                              type="tel" 
                              value={profileForm.phone}
                              readOnly
                              disabled
                              className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 outline-none cursor-not-allowed select-none" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 ml-1">{lang === 'FR' ? 'Date de Naissance' : 'Birth Date'}</label>
                            <input 
                              type="text" 
                              value={profileForm.birthDate}
                              onChange={(e) => {
                                let v = e.target.value.replace(/[^0-9]/g, '');
                                if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
                                if (v.length >= 6) v = v.slice(0,5) + '/' + v.slice(5,9);
                                setProfileForm({...profileForm, birthDate: v.slice(0,10)});
                              }}
                              placeholder="jj/mm/aaaa"
                              maxLength={10}
                              className="w-full bg-gray-100 border border-transparent px-4 py-3 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none" 
                            />
                          </div>
                          <div className="space-y-3 sm:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Adresse de Résidence' : 'Residential Address'}</label>
                            <input 
                              type="text" 
                              value={profileForm.address}
                              onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                              placeholder={lang === 'FR' ? 'Ex: Plateau du Serpent, Djibouti' : lang === 'AR' ? 'مثال: حي البلاط، جيبوتي' : 'Ex: Plateau du Serpent, Djibouti'}
                              minLength={5}
                              className={`w-full bg-gray-100 border px-4 py-3 rounded-xl text-sm font-bold text-gray-900 focus:bg-white transition-all outline-none ${profileForm.address && profileForm.address.length < 5 ? 'border-red-300 bg-red-50' : 'border-transparent focus:border-gray-300'}`}
                            />
                            {profileForm.address && profileForm.address.length < 5 && (
                              <p className="text-[10px] text-red-500 font-bold ml-1">
                                {lang === 'FR' ? '⚠️ Adresse trop courte (min. 5 caractères)' : lang === 'AR' ? '⚠️ العنوان قصير جداً' : '⚠️ Address too short (min. 5 characters)'}
                              </p>
                            )}
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic uppercase tracking-tighter">{lang === 'FR' ? 'Sexe' : 'Gender'}</label>
                            <select 
                              value={profileForm.gender}
                              onChange={(e) => setProfileForm({...profileForm, gender: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-4 py-3 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none"
                            >
                              <option value="M">{lang === 'FR' ? 'Masculin' : 'Male'}</option>
                              <option value="F">{lang === 'FR' ? 'Féminin' : 'Female'}</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 ml-1">{lang === 'FR' ? 'Disponibilité' : 'Availability'}</label>
                            <select
                              value={profileForm.availability}
                              onChange={(e) => setProfileForm({...profileForm, availability: e.target.value})}
                              className="w-full bg-gray-100 border border-transparent px-4 py-3 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none"
                            >
                              <option value="Immediate">{lang === 'FR' ? 'Immédiate' : lang === 'AR' ? 'فوري' : 'Immediate'}</option>
                              <option value="1 mois">{lang === 'FR' ? '1 mois' : lang === 'AR' ? 'شهر واحد' : '1 month'}</option>
                              <option value="2 mois">{lang === 'FR' ? '2 mois' : lang === 'AR' ? 'شهران' : '2 months'}</option>
                              <option value="3 mois">{lang === 'FR' ? '3 mois' : lang === 'AR' ? '3 أشهر' : '3 months'}</option>
                              <option value="6 mois">{lang === 'FR' ? '6 mois' : lang === 'AR' ? '6 أشهر' : '6 months'}</option>
                              <option value="Non disponible">{lang === 'FR' ? 'Non disponible' : lang === 'AR' ? 'غير متاح' : 'Not available'}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div className="space-y-5">
                          <div className="flex items-center gap-4">
                             <div className="w-9 h-9 bg-gray-900 text-white rounded-xl flex items-center justify-center">
                               <FileText size={24} />
                             </div>
                             <h3 className="text-xl font-black text-gray-900 font-semibold">{lang === 'FR' ? 'Parcours & CV' : 'Background & CV'}</h3>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Dernier Diplôme ou Formation' : 'Last Degree or Training'}</label>
                              {dynEducations.length > 0 ? (
                                <select
                                  value={profileForm.education}
                                  onChange={(e) => setProfileForm({...profileForm, education: e.target.value})}
                                  className="w-full bg-gray-100 border border-transparent px-4 py-3 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none"
                                >
                                  <option value="">{lang === 'FR' ? '— Sélectionner —' : lang === 'AR' ? '— اختر —' : '— Select —'}</option>
                                  {dynEducations.map((e: any) => <option key={e.id} value={e.value || e.label}>{e.label}</option>)}
                                </select>
                              ) : (
                                <select
                                  value={profileForm.education}
                                  onChange={(e) => setProfileForm({...profileForm, education: e.target.value})}
                                  className="w-full bg-gray-100 border border-transparent px-4 py-3 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none"
                                >
                                  <option value="">{lang === 'FR' ? '— Sélectionner —' : lang === 'AR' ? '— اختر —' : '— Select —'}</option>
                                  <option value="Sans diplôme">{lang === 'FR' ? 'Sans diplôme' : lang === 'AR' ? 'بدون شهادة' : 'No diploma'}</option>
                                  <option value="BEP/CAP">{lang === 'FR' ? 'BEP / CAP' : lang === 'AR' ? 'شهادة مهنية' : 'Vocational cert.'}</option>
                                  <option value="Baccalauréat">{lang === 'FR' ? 'Baccalauréat' : lang === 'AR' ? 'البكالوريا' : 'High school diploma'}</option>
                                  <option value="Bac+2">{lang === 'FR' ? 'Bac+2 (BTS/DUT)' : lang === 'AR' ? 'دبلوم' : 'Associate degree'}</option>
                                  <option value="Licence">{lang === 'FR' ? 'Licence (Bac+3)' : lang === 'AR' ? 'ليسانس' : 'Bachelor'}</option>
                                  <option value="Master">{lang === 'FR' ? 'Master (Bac+5)' : lang === 'AR' ? 'ماستر' : 'Master'}</option>
                                  <option value="Doctorat">{lang === 'FR' ? 'Doctorat' : lang === 'AR' ? 'دكتوراه' : 'PhD'}</option>
                                  <option value="Formation professionnelle">{lang === 'FR' ? 'Formation professionnelle' : lang === 'AR' ? 'تدريب مهني' : 'Professional training'}</option>
                                </select>
                              )}
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic">{lang === 'FR' ? 'Années d\'Expérience Totales' : 'Total Years of Experience'}</label>
                              <select
                                value={profileForm.experience}
                                onChange={(e) => setProfileForm({...profileForm, experience: e.target.value})}
                                className="w-full bg-gray-100 border border-transparent px-4 py-3 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all outline-none appearance-none"
                              >
                                <option value="">{lang === 'FR' ? '— Sélectionner —' : lang === 'AR' ? '— اختر —' : '— Select —'}</option>
                                <option value="0">{lang === 'FR' ? 'Aucune expérience' : lang === 'AR' ? 'لا خبرة' : 'No experience'}</option>
                                <option value="1">{lang === 'FR' ? 'Moins d\'1 an' : lang === 'AR' ? 'أقل من سنة' : 'Less than 1 year'}</option>
                                <option value="1-2">{lang === 'FR' ? '1 – 2 ans' : lang === 'AR' ? '1-2 سنة' : '1 – 2 years'}</option>
                                <option value="3-5">{lang === 'FR' ? '3 – 5 ans' : lang === 'AR' ? '3-5 سنوات' : '3 – 5 years'}</option>
                                <option value="5-10">{lang === 'FR' ? '5 – 10 ans' : lang === 'AR' ? '5-10 سنوات' : '5 – 10 years'}</option>
                                <option value="10+">{lang === 'FR' ? 'Plus de 10 ans' : lang === 'AR' ? 'أكثر من 10 سنوات' : 'More than 10 years'}</option>
                              </select>
                            </div>
                            <div className="pt-6 relative group/cv">
                               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2 italic mb-4">{lang === 'FR' ? 'Document CV Actuel' : 'Current CV Document'}</p>
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
                                 <div className="bg-gray-900 rounded-2xl p-4 text-white relative overflow-hidden shadow-sm">
                                   <div className="absolute top-0 right-0 w-16 h-16 bg-gray-100 rounded-full blur-3xl -mr-8 -mt-8" />
                                   <div className="relative z-10 flex items-center justify-between">
                                     <div className="flex items-center gap-3">
                                       <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                         <FileText size={20} className="text-gray-900" />
                                       </div>
                                       <div>
                                         <p className="text-sm font-black mb-0.5">{cvFileName || 'CV.pdf'}</p>
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
                                   className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center gap-2 hover:border-gray-300 hover:bg-gray-100 transition-all group/upload disabled:opacity-60"
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
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
                          <h3 className="text-xl font-black text-gray-900 font-semibold">
                            {lang === 'FR' ? '🪪 Pièce d\'Identité' : '🪪 Identity Document'}
                          </h3>
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
                            <div className="bg-gray-900 rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden shadow-sm">
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
                              className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center gap-2 hover:border-gray-300 hover:bg-gray-100 transition-all disabled:opacity-60"
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
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-black text-[#0f1f3d] mb-0.5">
                      Opportunités{' '}
                      <span className="text-[#1a56db] italic underline decoration-[#1a56db] decoration-2 underline-offset-2">Directes</span>
                    </h2>
                    <p className="text-xs text-gray-400 font-medium">
                      {lang === 'FR' ? "Trouvez l'emploi qui correspond à votre profil." : "Find the job that matches your profile."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { icon: Briefcase,    color: 'bg-blue-100 text-gray-700',   val: jobs.length,             label: lang === 'FR' ? 'Offres disponibles'    : 'Available offers' },
                      { icon: Send,         color: 'bg-purple-100 text-purple-500', val: applications.length,   label: lang === 'FR' ? 'Candidatures envoyées' : 'Applications sent' },
                      { icon: Star,         color: 'bg-gray-900-100 text-gray-900-500', val: savedJobs.length,      label: lang === 'FR' ? 'Favoris'               : 'Favorites' },
                      { icon: CheckCircle2, color: 'bg-green-100 text-green-600',  val: `${Math.round(([!!profileForm.fullName,!!profileForm.phone,!!profileForm.nationality,!!profileForm.birthDate,!!profileForm.address,!!profileForm.education,!!profileForm.experience,!!profileForm.languages,!!cvUrl,!!idUrl].filter(Boolean).length/10)*100)}%`, label: 'Profile complete' },
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {jobs.length > 0 ? (
                      jobs.map((job, idx) => {
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
                            <div className={`relative h-16 bg-gradient-to-br ${grad} flex items-center justify-center overflow-hidden`}>
                              <div className="w-10 h-10 rounded-xl bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-md">
                                <Briefcase size={18} className="text-[#1a56db]" />
                              </div>
                              <button
                                onClick={() => toggleFavorite(job.id)}
                                className={`absolute top-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                                  isSaved ? 'bg-red-50 text-red-400' : 'bg-white/80 text-gray-400 hover:text-red-400'
                                }`}
                              >
                                <Star size={17} fill={isSaved ? 'currentColor' : 'none'} />
                              </button>
                              <div className="absolute top-3 left-3 w-11 h-11 rounded-xl bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm">
                                <Briefcase size={20} className="text-[#1a56db]" />
                              </div>
                            </div>
                            <div className="p-5 flex flex-col flex-1">
                              <h3 className="text-[15px] font-black text-[#0f1f3d] mb-1.5 leading-tight group-hover:text-[#1a56db] transition-colors">
                                {job.title}
                              </h3>
                              <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium mb-3">
                                <MapPin size={13} className="text-[#1a56db] shrink-0" />
                                <span>{job.location || 'Djibouti Centre'}</span>
                              </div>
                              <div className="border-t border-gray-100 mb-3" />
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
                              {job.description && (
                                <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">{job.description}</p>
                              )}
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
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-180px)] sm:h-[750px] relative">
                   <div className="p-3 sm:p-4 border-b border-gray-100 bg-gray-900 text-white flex items-center justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gray-100 rounded-full blur-3xl -mr-16 -mt-16" />
                      <div className="flex items-center gap-3 relative z-10">
                         <div className="relative">
                           <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/10">
                              <MessageSquare size={18} className="text-gray-900" />
                           </div>
                           <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-300 rounded-full" />
                         </div>
                         <div>
                            <h2 className="text-base font-black leading-none mb-0.5">{lang === 'FR' ? 'Vedior Direct' : 'Vedior Direct'}</h2>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-normal">
                              {lang === 'FR' ? 'Ligne de recrutement sécurisée' : 'Secure recruitment line'}
                            </p>
                         </div>
                      </div>
                      <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-gray-900 hover:bg-white/10 transition-all relative z-10">
                        <MoreVertical size={16} />
                      </button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-5 sm:space-y-8 bg-white">
                      {messages.length > 0 ? (
                        messages.map((msg) => (
                           <div key={msg.id} className={`flex flex-col ${msg.senderId === user?.uid ? 'items-end' : 'items-start'}`}>
                              <div className={`max-w-[80%] p-8 rounded-[3rem] shadow-sm relative group overflow-hidden ${
                                msg.senderId === user?.uid 
                                  ? 'bg-gray-900 text-white rounded-tr-none shadow-gray-200/20' 
                                  : 'bg-white text-gray-900 rounded-tl-none border border-navy/5 shadow-sm shadow-gray-200/5'
                              }`}>
                                 {msg.senderId === user?.uid && (
                                   <div className="absolute top-0 left-0 w-full h-1 bg-gray-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                                 )}
                                 <p className="text-[14px] font-bold leading-[1.6]">{msg.text}</p>
                                 <div className={`flex items-center gap-2 mt-4 opacity-40 text-[9px] font-semibold ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                                    {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    {msg.senderId === user?.uid && <CheckCircle2 size={10} className="text-gray-900" />}
                                 </div>
                              </div>
                           </div>
                        ))
                      ) : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                               <MessageSquare size={32} strokeWidth={1} />
                            </div>
                            <div className="text-center">
                               <p className="text-sm font-black text-gray-400 mb-1">{lang === 'FR' ? 'Démarrez la conversation' : 'Start the conversation'}</p>
                               <p className="text-[10px] font-bold text-gray-300 uppercase tracking-normal">{lang === 'FR' ? 'Posez vos questions à l\'équipe recrutement' : 'Ask our recruitment team anything'}</p>
                            </div>
                         </div>
                      )}
                   </div>
                   <div className="p-3 bg-white border-t border-gray-100 relative">
                      <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
                         <div className="flex-1 relative group">
                            <input 
                              type="text" 
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder={lang === 'FR' ? 'Votre message...' : 'Your message...'} 
                              className="w-full bg-gray-100 border-2 border-transparent px-4 py-3 rounded-2xl outline-none text-sm font-bold text-gray-900 focus:bg-white focus:border-gray-300 transition-all pr-10"
                              disabled={sendingMessage}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                               <button type="button" className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"><PlusIcon className="w-4 h-4" /></button>
                            </div>
                         </div>
                         <button 
                           type="submit" 
                           disabled={sendingMessage || !newMessage.trim()}
                           className="bg-gray-900 text-white w-11 h-11 rounded-xl flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50 group shrink-0"
                         >
                            {sendingMessage ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Send size={16} className="group-hover:rotate-12 transition-transform" />
                            )}
                         </button>
                      </form>
                   </div>
                </div>
              )}
              {activeTab === 'settings' && (
                <div className="max-w-4xl space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                    <div className="bg-white p-4 sm:p-8 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
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
                                    const { deleteDoc: dd, doc: d2 } = await import('firebase/firestore');
                                    await dd(d2(db, 'candidateProfiles', user?.uid));
                                    await dd(d2(db, 'users', user?.uid));
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
      {selectedApp && (
        <div 
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6"
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
            <div className="bg-gray-900 px-8 py-6 flex items-center justify-between">
              <div>
                <p className="text-gray-900 text-[10px] font-black uppercase tracking-normal mb-1">Ref: {selectedApp.id?.slice(-8).toUpperCase()}</p>
                <h2 className="text-white text-2xl font-black font-semibold">{selectedApp.jobTitle || 'Poste'}</h2>
              </div>
              <button onClick={() => setSelectedApp(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-gray-900 transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedApp.status || 'new'} lang={lang} />
                <span className="text-[10px] font-black uppercase tracking-normal text-gray-400">
                  {selectedApp.createdAt?.toDate?.()?.toLocaleDateString() || ''}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: lang === 'FR' ? 'Nom Complet' : 'Full Name', value: selectedApp.fullName },
                  ...(!selectedApp.email?.endsWith('@vediorgm.candidate') ? [{ label: lang === 'FR' ? 'Email' : 'Email', value: selectedApp.email || '—' }] : []),
                  { label: lang === 'FR' ? 'Téléphone' : 'Phone', value: selectedApp.phone || '—' },
                  { label: lang === 'FR' ? 'Nationalité' : 'Nationality', value: selectedApp.nationality || '—' },
                  { label: lang === 'FR' ? 'Secteur' : 'Sector', value: selectedApp.sector || '—' },
                  { label: lang === 'FR' ? 'Disponibilité' : 'Availability', value: selectedApp.availability || '—' },
                  { label: lang === 'FR' ? 'Formation' : 'Education', value: selectedApp.education || '—' },
                  { label: lang === 'FR' ? "Années d'exp." : 'Years exp.', value: selectedApp.experience ? `${selectedApp.experience} ans` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase tracking-normal text-gray-400 mb-0.5">{label}</p>
                    <p className="text-xs font-black text-gray-900 break-words">{value}</p>
                  </div>
                ))}
              </div>
              {selectedApp.address && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-normal text-gray-400 mb-0.5">{lang === 'FR' ? 'Adresse' : 'Address'}</p>
                  <p className="text-xs font-black text-gray-900">{selectedApp.address}</p>
                </div>
              )}
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setSelectedApp(null)}
                className="w-full py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-normal rounded-xl hover:bg-gray-900 transition-all"
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

function CandNavItem({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all group ${active ? 'bg-gray-900 text-white shadow-lg shadow-gray-200/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
    >
      <Icon size={20} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
      <span className="truncate">{label}</span>
      {badge ? (
        <div className="absolute right-4 w-5 h-5 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
          {badge}
        </div>
      ) : null}
    </button>
  );
}

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