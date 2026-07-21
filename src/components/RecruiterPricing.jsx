// RecruiterPricing.jsx (complet)
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, getDoc, updateDoc, addDoc, doc, orderBy, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { motion, AnimatePresence } from "framer-motion";

const T = {
  FR: {
    badge:"💼 Abonnements Recruteurs",
    title1:"Choisissez votre", title2:"niveau de recrutement",
    subtitle:"Des outils puissants pour trouver les meilleurs profils à Djibouti.",
    free:"Gratuit", pro:"Pro",
    freeSub:"Pour démarrer et tester la plateforme",
    proSub:"Tout ce qu'il faut pour recruter efficacement",
    recommended:"⚡ Recommandé",
    monthly:"Mensuel", quarterly:"Trimestriel", yearly:"Annuel",
    saves:["","Économisez ~7%","Économisez ~13% 🔥"],
    ctaFree:"Continuer gratuitement",
    ctaPro:(p)=>`Passer au Pro — ${p} FDJ`,
    comparison:"Comparatif détaillé", feat:"Fonctionnalité",
    payTitle:"💎 Abonnement Pro",
    chooseMethod:"Choisissez votre mode de paiement",
    cardLabel:"Carte bancaire", cardSub:"Visa / Mastercard",
    cacLabel:"CAC Pay", cacSub:"Paiement mobile Djibouti",
    transferLabel:"Virement bancaire", transferSub:"Coordonnées fournies",
    cardHolder:"Titulaire", cardNum:"Numéro de carte",
    cardName:"Nom du titulaire", cardExpiry:"Date d'expiration", cardCvv:"CVV",
    previewName:"VOTRE NOM", previewExpiry:"MM/AA",
    cacTitle:"CAC Pay — Djibouti",
    cacDesc:(p)=>`Envoyez ${p} FDJ au numéro CAC Pay ci-dessous, puis envoyez la capture à notre équipe.`,
    cacNum:"Numéro CAC Pay",
    cacNote:"Après paiement, envoyez votre preuve à",
    copy:"Copier", copied:"✓ Copié",
    bankTitle:"Coordonnées bancaires",
    bankWarn:"Mentionnez votre email comme référence. Activation sous",
    bankWarn2:"24h ouvrées",
    bankWarn3:"après réception.",
    payBtn:(p)=>`💳 Payer ${p} FDJ`,
    cacBtn:"📱 Confirmer CAC Pay",
    secure:"Paiement sécurisé SSL 256-bit",
    per:{monthly:"mois",quarterly:"trimestre",yearly:"an"},
    freeF:[
      {t:"1 offre d'emploi active",ok:true},{t:"5 candidatures visibles / offre",ok:true},
      {t:"Tableau de bord basique",ok:true},{t:"1 demande recrutement / mois",ok:true},
      {t:"Support email (48h)",ok:true},{t:"Matching IA automatique",ok:false},
      {t:"Accès profils complets",ok:false},{t:"Contact direct candidats",ok:false},
      {t:"Statistiques avancées",ok:false},{t:"Export Excel / PDF",ok:false},
      {t:"Badge Recruteur Vérifié ✓",ok:false},{t:"Offres illimitées",ok:false},
    ],
    proF:[
      {t:"Offres illimitées",s:true},{t:"Candidatures illimitées visibles",s:false},
      {t:"🤖 Matching IA (score 0–100)",s:true},{t:"Accès profils complets candidats",s:true},
      {t:"Contact direct & messagerie",s:false},{t:"Statistiques & rapports avancés",s:false},
      {t:"Export Excel / PDF",s:false},{t:"Badge Recruteur Vérifié ✓",s:true},
      {t:"Demandes recrutement illimitées",s:false},{t:"Multi-utilisateurs (3 comptes)",s:false},
      {t:"Support prioritaire (2h)",s:false},{t:"Historique des recrutements",s:false},
    ],
    rows:[
      ["Offres actives","1","Illimité"],["Candidatures / offre","5","Illimité"],
      ["Matching IA","—","✓"],["Profils complets","—","✓"],
      ["Contact direct","—","✓"],["Demandes recrutement","1/mois","Illimité"],
      ["Export données","—","✓"],["Multi-comptes","1","3"],
      ["Badge Vérifié","—","✓"],["Support","Email 48h","Prioritaire 2h"],
    ],
  },
  EN: {
    badge:"💼 Recruiter Plans",
    title1:"Choose your", title2:"recruitment level",
    subtitle:"Powerful tools to find the best profiles in Djibouti.",
    free:"Free", pro:"Pro",
    freeSub:"To get started and test the platform",
    proSub:"Everything you need to recruit effectively",
    recommended:"⚡ Recommended",
    monthly:"Monthly", quarterly:"Quarterly", yearly:"Yearly",
    saves:["","Save ~7%","Save ~13% 🔥"],
    ctaFree:"Continue for free",
    ctaPro:(p)=>`Go Pro — ${p} FDJ`,
    comparison:"Detailed comparison", feat:"Feature",
    payTitle:"💎 Pro Subscription",
    chooseMethod:"Choose your payment method",
    cardLabel:"Bank card", cardSub:"Visa / Mastercard",
    cacLabel:"CAC Pay", cacSub:"Djibouti mobile payment",
    transferLabel:"Bank transfer", transferSub:"Details provided below",
    cardHolder:"Cardholder", cardNum:"Card number",
    cardName:"Cardholder name", cardExpiry:"Expiry date", cardCvv:"CVV",
    previewName:"YOUR NAME", previewExpiry:"MM/YY",
    cacTitle:"CAC Pay — Djibouti",
    cacDesc:(p)=>`Send ${p} FDJ to the CAC Pay number below, then send the screenshot to our team.`,
    cacNum:"CAC Pay number",
    cacNote:"After payment, send your proof to",
    copy:"Copy", copied:"✓ Copied",
    bankTitle:"Bank details",
    bankWarn:"Use your email as the reference. Activation within",
    bankWarn2:"24 business hours",
    bankWarn3:"after receipt.",
    payBtn:(p)=>`💳 Pay ${p} FDJ`,
    cacBtn:"📱 Confirm CAC Pay",
    secure:"Secure payment SSL 256-bit",
    per:{monthly:"month",quarterly:"quarter",yearly:"year"},
    freeF:[
      {t:"1 active job offer",ok:true},{t:"5 applications visible / offer",ok:true},
      {t:"Basic dashboard",ok:true},{t:"1 recruitment request / month",ok:true},
      {t:"Email support (48h)",ok:true},{t:"AI automatic matching",ok:false},
      {t:"Full candidate profiles",ok:false},{t:"Direct candidate contact",ok:false},
      {t:"Advanced statistics",ok:false},{t:"Excel / PDF export",ok:false},
      {t:"Verified Recruiter Badge ✓",ok:false},{t:"Unlimited offers",ok:false},
    ],
    proF:[
      {t:"Unlimited job offers",s:true},{t:"Unlimited visible applications",s:false},
      {t:"🤖 AI Matching (score 0–100)",s:true},{t:"Full candidate profiles access",s:true},
      {t:"Direct contact & messaging",s:false},{t:"Advanced statistics & reports",s:false},
      {t:"Excel / PDF export",s:false},{t:"Verified Recruiter Badge ✓",s:true},
      {t:"Unlimited recruitment requests",s:false},{t:"Multi-user (3 accounts)",s:false},
      {t:"Priority support (2h)",s:false},{t:"Full recruitment history",s:false},
    ],
    rows:[
      ["Active offers","1","Unlimited"],["Applications / offer","5","Unlimited"],
      ["AI Matching","—","✓"],["Full profiles","—","✓"],
      ["Direct contact","—","✓"],["Recruitment requests","1/month","Unlimited"],
      ["Data export","—","✓"],["Multi-accounts","1","3"],
      ["Verified Badge","—","✓"],["Support","Email 48h","Priority 2h"],
    ],
  },
};

// ─── Helper pour mettre à jour le statut du recruteur dans Firestore ───
async function updatePlanStatus(db, userUid, userEmail, data) {
  let updated = false;
  for (const col of ['users', 'recruiters']) {
    for (const field of ['userId', 'firebaseUid', 'uid']) {
      try {
        const snap = await getDocs(query(collection(db, col), where(field, '==', userUid)));
        if (!snap.empty) {
          await updateDoc(doc(db, col, snap.docs[0].id), data);
          updated = true;
          break;
        }
      } catch (err) {}
    }
    if (updated) break;
  }
  if (!updated && userEmail) {
    for (const col of ['users', 'recruiters']) {
      try {
        const snap = await getDocs(query(collection(db, col), where('email', '==', userEmail)));
        if (!snap.empty) {
          await updateDoc(doc(db, col, snap.docs[0].id), data);
          updated = true;
          break;
        }
      } catch (err) {}
    }
  }
  if (!updated) {
    await addDoc(collection(db, 'pendingPayments'), {
      ...data, userUid, userEmail, createdAt: new Date().toISOString(),
    });
  }
}

// ─── Composant des factures ───
function MyInvoices({ lang }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [errorId, setErrorId] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user?.email) { setLoading(false); return; }
    const q = query(
      collection(db, 'payments'),
      where('recruiterEmail', '==', user.email),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const fetchInvoiceBlob = async (paymentId) => {
    const fns = getFunctions(db.app, 'europe-west1');
    const call = httpsCallable(fns, 'downloadInvoice');
    const res = await call({ paymentId });
    const { pdfBase64, filename } = res.data;
    const byteChars = atob(pdfBase64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: filename || 'facture.pdf' };
  };

  const downloadInvoice = async (paymentId) => {
    setBusyId(paymentId + ':download');
    setErrorId(null);
    try {
      const { blob, filename } = await fetchInvoiceBlob(paymentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('downloadInvoice failed:', e);
      setErrorId(paymentId);
      setTimeout(() => setErrorId(null), 3000);
    } finally {
      setBusyId(null);
    }
  };

  const previewInvoice = async (paymentId) => {
    setBusyId(paymentId + ':preview');
    setErrorId(null);
    try {
      const { blob } = await fetchInvoiceBlob(paymentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error('previewInvoice failed:', e);
      setErrorId(paymentId);
      setTimeout(() => setErrorId(null), 3000);
    } finally {
      setBusyId(null);
    }
  };

  const confirmed = payments.filter(p => p.status === 'confirmed');
  if (loading || confirmed.length === 0) return null;

  return (
    <div style={{maxWidth:900,margin:"0 auto 40px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,overflow:"hidden"}}>
      <div style={{padding:"20px 28px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <p style={{margin:0,fontSize:14,fontWeight:900,color:"#fff"}}>
          {lang === "FR" ? "📄 Mes factures" : "📄 My invoices"}
        </p>
      </div>
      <div>
        {confirmed.map(p => (
          <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 28px",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
            <div>
              <p style={{margin:0,fontSize:13,color:"#fff",fontWeight:700}}>
                {p.billing === 'yearly' ? (lang==='FR'?'Abonnement annuel':'Yearly plan') : p.billing === 'quarterly' ? (lang==='FR'?'Abonnement trimestriel':'Quarterly plan') : (lang==='FR'?'Abonnement mensuel':'Monthly plan')}
              </p>
              <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.4)"}}>
                {p.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || '—'} · {Number(p.amount || 0).toLocaleString('fr-FR')} FDJ
              </p>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button
                onClick={() => previewInvoice(p.id)}
                disabled={busyId === p.id + ':preview' || busyId === p.id + ':download'}
                style={{
                  padding:"8px 16px", borderRadius:10, border:"none",
                  background:"rgba(255,255,255,0.06)",
                  color:"rgba(255,255,255,0.7)",
                  fontSize:11, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.5px",
                  cursor: busyId ? "wait" : "pointer", opacity: busyId ? 0.6 : 1,
                }}>
                {busyId === p.id + ':preview'
                  ? (lang==='FR'?'Chargement...':'Loading...')
                  : (lang==='FR'?'👁 Aperçu':'👁 Preview')
                }
              </button>
              <button
                onClick={() => downloadInvoice(p.id)}
                disabled={busyId === p.id + ':download' || busyId === p.id + ':preview'}
                style={{
                  padding:"8px 16px", borderRadius:10, border:"none",
                  background: errorId === p.id ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                  color: errorId === p.id ? "#f87171" : "#60a5fa",
                  fontSize:11, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.5px",
                  cursor: busyId ? "wait" : "pointer", opacity: busyId ? 0.6 : 1,
                }}>
                {busyId === p.id + ':download'
                  ? (lang==='FR'?'Génération...':'Generating...')
                  : errorId === p.id
                  ? (lang==='FR'?'Erreur':'Error')
                  : (lang==='FR'?'⬇ Télécharger':'⬇ Download')
                }
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ───
export default function RecruiterPricing({ lang: langProp = "FR" }){
  const [lang,setLang]=useState(langProp);
  const [billing,setBilling]=useState("monthly");
  const [method,setMethod]=useState("card");
  const [paymentRef,setPaymentRef]=useState("");
  const [modal,setModal]=useState(false);
  const [copied,setCopied]=useState("");
  const [card,setCard]=useState({number:"",name:"",expiry:"",cvv:""});
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [cacStep, setCacStep] = useState('phone'); // 'phone' ou 'otp'
  const [cacPhone, setCacPhone] = useState('');
  const [cacOtp, setCacOtp] = useState('');
  const [cacTransactionId, setCacTransactionId] = useState('');
  const [cacLoading, setCacLoading] = useState(false);
  const [cacError, setCacError] = useState('');

  // Load pricing config from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings_pricing', 'config'),
      (snap) => {
        if (snap.exists()) setPricing(prev => ({ ...prev, ...snap.data() }));
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const PLANS = [
    { id: "monthly",   price: pricing.monthlyPrice,   saveIdx: 0 },
    { id: "quarterly", price: pricing.quarterlyPrice, saveIdx: 1 },
    { id: "yearly",    price: pricing.yearlyPrice,    saveIdx: 2 },
  ];

  const BANK = [
    ["Banque / Bank", pricing.bankName],
    ["Titulaire", pricing.bankHolder],
    ["N° Compte", pricing.bankAccount],
    ["IBAN", pricing.bankIban],
    ["BIC / SWIFT", pricing.bankBic],
    ["Référence / Reference", `PRO-[votre email]`],
  ];

  const mSave = ((1 - pricing.quarterlyPrice / (pricing.monthlyPrice * 3)) * 100).toFixed(0);
  const ySave = ((1 - pricing.yearlyPrice / (pricing.monthlyPrice * 12)) * 100).toFixed(0);

  const t=T[lang];

  useEffect(() => {
    const enabledIds = [
      pricing.cardEnabled ? "card" : null,
      pricing.cacEnabled ? "cac" : null,
      pricing.bankEnabled ? "transfer" : null,
    ].filter(Boolean);
    if (enabledIds.length > 0 && !enabledIds.includes(method)) {
      setMethod(enabledIds[0]);
    }
  }, [pricing.cardEnabled, pricing.cacEnabled, pricing.bankEnabled, method]);

  const paymentMethods = [
    {id:"card",icon:"💳",label:t.cardLabel,sub:t.cardSub,enabled:pricing.cardEnabled},
    {id:"cac",icon:"📱",label:t.cacLabel,sub:t.cacSub,enabled:pricing.cacEnabled},
    {id:"transfer",icon:"🏦",label:t.transferLabel,sub:t.transferSub,enabled:pricing.bankEnabled},
  ].filter(m => m.enabled);

  const saves = [
    "",
    lang === 'FR' ? `Économisez ${mSave}% (${((pricing.monthlyPrice*3)-pricing.quarterlyPrice).toLocaleString('fr-FR')} FDJ)` : `Save ${mSave}%`,
    lang === 'FR' ? `Économisez ${ySave}% 🔥` : `Save ${ySave}% 🔥`,
  ];

  const freeF = lang === 'FR' ? [
    {t:`${pricing.freeJobsLimit} offre${pricing.freeJobsLimit>1?'s':''} active${pricing.freeJobsLimit>1?'s':''}`,ok:true},
    {t:`${pricing.freeApplicationsLimit} candidatures visibles / offre`,ok:true},
    {t:"Tableau de bord basique",ok:true},
    {t:`${pricing.freeRequestsLimit} demande${pricing.freeRequestsLimit>1?'s':''} / mois`,ok:true},
    {t:"Support email (48h)",ok:true},
    {t:"Matching IA automatique",ok:false},
    {t:"Accès profils complets",ok:false},
    {t:"Contact direct candidats",ok:false},
    {t:"Statistiques avancées",ok:false},
    {t:"Export Excel / PDF",ok:false},
    {t:"Badge Recruteur Vérifié ✓",ok:false},
    {t:"Offres illimitées",ok:false},
  ] : [
    {t:`${pricing.freeJobsLimit} active job offer${pricing.freeJobsLimit>1?'s':''}`,ok:true},
    {t:`${pricing.freeApplicationsLimit} applications visible / offer`,ok:true},
    {t:"Basic dashboard",ok:true},
    {t:`${pricing.freeRequestsLimit} request${pricing.freeRequestsLimit>1?'s':''} / month`,ok:true},
    {t:"Email support (48h)",ok:true},
    {t:"AI automatic matching",ok:false},
    {t:"Full candidate profiles",ok:false},
    {t:"Direct candidate contact",ok:false},
    {t:"Advanced statistics",ok:false},
    {t:"Excel / PDF export",ok:false},
    {t:"Verified Recruiter Badge ✓",ok:false},
    {t:"Unlimited offers",ok:false},
  ];

  const proJobsLabel = pricing.proJobsLimit === -1
    ? (lang==='FR' ? 'Offres illimitées' : 'Unlimited offers')
    : (lang==='FR' ? `${pricing.proJobsLimit} offres actives max` : `${pricing.proJobsLimit} active offers max`);
  const proF = (lang === 'FR' ? [
    {t:proJobsLabel,s:true},{t:"Candidatures illimitées visibles",s:false},
    {t:"🤖 Matching IA (score 0–100)",s:true},{t:"Accès profils complets candidats",s:true},
    {t:"Contact direct & messagerie",s:false},{t:"Statistiques & rapports avancés",s:false},
    {t:"Export Excel / PDF",s:false},{t:"Badge Recruteur Vérifié ✓",s:true},
    {t:"Demandes recrutement illimitées",s:false},{t:"Multi-utilisateurs (3 comptes)",s:false},
    {t:"Support prioritaire (2h)",s:false},{t:"Historique des recrutements",s:false},
  ] : [
    {t:proJobsLabel,s:true},{t:"Unlimited visible applications",s:false},
    {t:"🤖 AI Matching (score 0–100)",s:true},{t:"Full candidate profiles access",s:true},
    {t:"Direct contact & messaging",s:false},{t:"Advanced statistics & reports",s:false},
    {t:"Excel / PDF export",s:false},{t:"Verified Recruiter Badge ✓",s:true},
    {t:"Unlimited recruitment requests",s:false},{t:"Multi-user (3 accounts)",s:false},
    {t:"Priority support (2h)",s:false},{t:"Recruitment history",s:false},
  ]);

  const rows = [
    [lang==='FR'?"Offres actives":"Active offers", String(pricing.freeJobsLimit), pricing.proJobsLimit===-1?(lang==='FR'?'Illimité':'Unlimited'):String(pricing.proJobsLimit)],
    [lang==='FR'?"Candidatures / offre":"Applications / offer", String(pricing.freeApplicationsLimit), lang==='FR'?'Illimité':'Unlimited'],
    [lang==='FR'?"Matching IA":"AI Matching","—","✓"],
    [lang==='FR'?"Profils complets":"Full profiles","—","✓"],
    [lang==='FR'?"Contact direct":"Direct contact","—","✓"],
    [lang==='FR'?"Demandes recrutement":"Recruitment requests", `${pricing.freeRequestsLimit}/${lang==='FR'?'mois':'month'}`, lang==='FR'?'Illimité':'Unlimited'],
    [lang==='FR'?"Export données":"Data export","—","✓"],
    [lang==='FR'?"Multi-comptes":"Multi-accounts","1","3"],
    [lang==='FR'?"Badge Vérifié":"Verified Badge","—","✓"],
    [lang==='FR'?"Support":"Support", lang==='FR'?"Email 48h":"Email 48h", lang==='FR'?"Prioritaire 2h":"Priority 2h"],
  ];

  const plan=PLANS.find(p=>p.id===billing);
  const price=plan.price.toLocaleString("fr-FR");
  const cp=(text,key)=>{navigator.clipboard.writeText(text);setCopied(key);setTimeout(()=>setCopied(""),2000);};

  // ── Gestion CAC Pay ──
  const initiateCacPayment = async () => {
    setCacLoading(true);
    setCacError('');
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setCacError(lang==='FR'?'Vous devez être connecté':'You must be logged in');
        setCacLoading(false);
        return;
      }
      // Nettoyer le numéro
      const cleanPhone = cacPhone.replace(/\D/g, '');
      if (cleanPhone.length < 6) {
        setCacError(lang==='FR'?'Numéro invalide':'Invalid phone number');
        setCacLoading(false);
        return;
      }
      const response = await fetch('/api/payment/cac/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          amount: plan.price,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'initiation');
      }
      setCacTransactionId(data.transactionId);
      setCacStep('otp');
      // En mode mock, on peut pré-remplir l'OTP pour faciliter les tests
      if (process.env.NEXT_PUBLIC_PAYMENT_MOCK_MODE === 'true') {
        setCacOtp(data.otp || '');
      }
    } catch (error) {
      setCacError(error.message);
    } finally {
      setCacLoading(false);
    }
  };

  const confirmCacPayment = async () => {
    setCacLoading(true);
    setCacError('');
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setCacError(lang==='FR'?'Vous devez être connecté':'You must be logged in');
        setCacLoading(false);
        return;
      }
      // Récupérer l'ID du recruteur depuis Firestore
      const recruitersSnap = await getDocs(query(collection(db, 'recruiters'), where('email', '==', user.email)));
      let recruiterId = null;
      if (!recruitersSnap.empty) {
        recruiterId = recruitersSnap.docs[0].id;
      } else {
        // Fallback : créer un doc recruteur si inexistant
        const newRecruiterRef = await addDoc(collection(db, 'recruiters'), {
          email: user.email,
          displayName: user.displayName || '',
          companyName: '',
          plan: 'free',
          createdAt: new Date().toISOString(),
        });
        recruiterId = newRecruiterRef.id;
      }

      const response = await fetch('/api/payment/cac/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: cacTransactionId,
          otp: cacOtp,
          recruiterId: recruiterId,
          billing: billing,
          amount: plan.price,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la confirmation');
      }
      // Succès
      alert(lang==='FR'?'✅ Paiement confirmé ! Abonnement Pro activé.' : '✅ Payment confirmed! Pro plan activated.');
      setModal(false);
      // Recharger la page pour mettre à jour l'interface
      window.location.reload();
    } catch (error) {
      setCacError(error.message);
    } finally {
      setCacLoading(false);
    }
  };

  // ── Gestion Carte (mock) ──
  const handleCardPayment = async () => {
    // Validation basique
    if (!card.number || !card.expiry || !card.cvv || !card.name) {
      alert(lang==='FR'?'Veuillez remplir tous les champs de la carte':'Please fill all card fields');
      return;
    }
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert(lang==='FR'?'Vous devez être connecté':'You must be logged in');
        return;
      }
      const response = await fetch('/api/payment/card/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: card.number.replace(/\s/g, ''),
          expiry: card.expiry,
          cvv: card.cvv,
          name: card.name,
          amount: plan.price,
          billing: billing,
          recruiterId: user.uid, // on utilisera l'uid en attendant de récupérer l'id du recruteur
          email: user.email,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du paiement');
      }
      if (data.mockConfirmed) {
        // En mock, on simule une confirmation immédiate
        alert(lang==='FR'?'✅ Paiement par carte simulé ! (mode mock)':'✅ Card payment simulated! (mock mode)');
        setModal(false);
        window.location.reload();
      } else if (data.redirectUrl) {
        // Rediriger vers la page de paiement (en production)
        window.location.href = data.redirectUrl;
      }
    } catch (error) {
      alert(error.message);
    }
  };

  // ── Gestion Virement (transfer) ──
  const handleTransferPayment = async () => {
    if (!paymentRef.trim()) {
      alert(lang==='FR'?'Veuillez entrer une référence de paiement':'Please enter a payment reference');
      return;
    }
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert(lang==='FR'?'Vous devez être connecté':'You must be logged in');
        return;
      }
      await updatePlanStatus(db, user.uid, user.email, {
        plan: 'pro',
        planBilling: billing,
        planRequestedAt: new Date().toISOString(),
        planStatus: 'pending_confirmation',
        paymentMethod: 'transfer',
        paymentRef: paymentRef.trim(),
      });
      alert(lang==='FR'?'✅ Demande de virement enregistrée. Confirmation sous 24h.':'✅ Transfer request recorded. Confirmation within 24h.');
      setModal(false);
      window.location.reload();
    } catch (error) {
      alert(error.message);
    }
  };

  // ── Rendu ──
  return (
    <div style={{minHeight:"100vh",background:"#060d1a",fontFamily:"'DM Sans',system-ui,sans-serif",color:"#fff",overflowX:"hidden"}}>
      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px)",backgroundSize:"48px 48px",pointerEvents:"none"}}/>
      <div style={{position:"fixed",top:"-20%",left:"-10%",width:700,height:700,background:"radial-gradient(circle,rgba(59,130,246,0.1),transparent 60%)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"-20%",right:"-10%",width:600,height:600,background:"radial-gradient(circle,rgba(99,102,241,0.08),transparent 60%)",pointerEvents:"none"}}/>

      {/* Lang */}
      <div style={{position:"fixed",top:20,right:24,zIndex:200,display:"flex",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,overflow:"hidden"}}>
        {["FR","EN"].map(l=>(
          <button key={l} onClick={()=>setLang(l)} style={{padding:"9px 18px",border:"none",cursor:"pointer",fontSize:12,fontWeight:900,background:lang===l?"rgba(59,130,246,0.3)":"transparent",color:lang===l?"#60a5fa":"rgba(255,255,255,0.35)",transition:"all 0.18s"}}>{l}</button>
        ))}
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"64px 24px 80px",position:"relative",zIndex:1}}>

        {/* Header */}
        <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} style={{textAlign:"center",marginBottom:56}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:100,padding:"6px 18px",marginBottom:20}}>
            <span style={{fontSize:11,fontWeight:800,color:"#60a5fa",textTransform:"uppercase",letterSpacing:"1.6px"}}>{t.badge}</span>
          </div>
          <h1 style={{fontSize:"clamp(32px,4vw,56px)",fontWeight:900,margin:"0 0 16px",letterSpacing:"-2px",lineHeight:1.05}}>
            {t.title1}<br/>
            <span style={{background:"linear-gradient(90deg,#3b82f6,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{t.title2}</span>
          </h1>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:16,maxWidth:500,margin:"0 auto",lineHeight:1.7}}>{t.subtitle}</p>
        </motion.div>

        {/* Billing toggle */}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:48}}>
          {[{id:"monthly",l:t.monthly},{id:"quarterly",l:t.quarterly},{id:"yearly",l:t.yearly}].map((p,i)=>(
            <button key={p.id} onClick={()=>setBilling(p.id)} style={{padding:"10px 22px",borderRadius:12,border:`1px solid ${billing===p.id?"#3b82f6":"rgba(255,255,255,0.1)"}`,background:billing===p.id?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.03)",color:billing===p.id?"#60a5fa":"rgba(255,255,255,0.4)",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all 0.18s"}}>
              {p.l}{i>0&&<span style={{marginLeft:6,fontSize:9,background:"#f97316",color:"#fff",padding:"2px 6px",borderRadius:6,verticalAlign:"middle"}}>PROMO</span>}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:64}}>

          {/* FREE */}
          <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0,transition:{delay:0.15}}}
            style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:24,padding:"36px 32px"}}>
            <span style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"rgba(255,255,255,0.4)"}}>{t.free}</span>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:8,marginBottom:4}}>
              <span style={{fontSize:48,fontWeight:900}}>0</span>
              <span style={{fontSize:16,color:"rgba(255,255,255,0.4)"}}>FDJ</span>
            </div>
            <p style={{color:"rgba(255,255,255,0.35)",fontSize:13,margin:"0 0 24px"}}>{t.freeSub}</p>
            <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:24}}/>
            <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:32}}>
              {freeF.map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,opacity:f.ok?1:0.3}}>
                  <div style={{width:20,height:20,borderRadius:6,background:f.ok?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${f.ok?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.08)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11}}>{f.ok?"✓":"✕"}</div>
                  <span style={{fontSize:13,color:f.ok?"rgba(255,255,255,0.75)":"rgba(255,255,255,0.3)"}}>{f.t}</span>
                </div>
              ))}
            </div>
            <button style={{width:"100%",padding:"14px",borderRadius:14,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.5)",fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",cursor:"pointer"}}>{t.ctaFree}</button>
          </motion.div>

          {/* PRO */}
          <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0,transition:{delay:0.25}}}
            style={{background:"rgba(59,130,246,0.07)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:24,padding:"36px 32px",position:"relative",overflow:"hidden",boxShadow:"0 0 80px rgba(59,130,246,0.1)"}}>
            <div style={{position:"absolute",top:0,left:"20%",right:"20%",height:1,background:"linear-gradient(90deg,transparent,#3b82f6,transparent)"}}/>
            <div style={{position:"absolute",top:20,right:20,background:"linear-gradient(135deg,#f97316,#ef4444)",color:"#fff",fontSize:9,fontWeight:900,textTransform:"uppercase",letterSpacing:"1.5px",padding:"5px 12px",borderRadius:100}}>{t.recommended}</div>
            <span style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"#60a5fa"}}>{t.pro}</span>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:8,marginBottom:4,flexWrap:"wrap"}}>
              <span style={{fontSize:48,fontWeight:900}}>{price}</span>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>{lang==="FR"?["FDJ/mois","FDJ/3 mois","FDJ/an"][PLANS.findIndex(p=>p.id===billing)]:["FDJ/month","FDJ/3 months","FDJ/year"][PLANS.findIndex(p=>p.id===billing)]}</span>
            </div>
            {plan.saveIdx>0&&(
              <div style={{display:"inline-block",background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:8,padding:"3px 10px",marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:"#4ade80"}}>{saves[plan.saveIdx]}</span>
              </div>
            )}
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,margin:"4px 0 24px"}}>{t.proSub}</p>
            <div style={{height:1,background:"rgba(59,130,246,0.15)",marginBottom:24}}/>
            <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:32}}>
              {proF.map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:20,height:20,borderRadius:6,background:f.s?"rgba(59,130,246,0.2)":"rgba(34,197,94,0.15)",border:`1px solid ${f.s?"rgba(59,130,246,0.4)":"rgba(34,197,94,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,color:f.s?"#60a5fa":"#4ade80"}}>✓</div>
                  <span style={{fontSize:13,color:f.s?"#fff":"rgba(255,255,255,0.75)",fontWeight:f.s?700:400}}>{f.t}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>setModal(true)}
              style={{width:"100%",padding:"16px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"#fff",fontSize:13,fontWeight:900,textTransform:"uppercase",letterSpacing:"1.5px",cursor:"pointer",boxShadow:"0 8px 32px rgba(59,130,246,0.35)",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 16px 40px rgba(59,130,246,0.5)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 8px 32px rgba(59,130,246,0.35)";}}>
              {t.ctaPro(price)}
            </button>
          </motion.div>
        </div>

        {/* Comparison */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0,transition:{delay:0.35}}}
          style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,overflow:"hidden"}}>
          <div style={{padding:"18px 28px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{margin:0,fontSize:11,fontWeight:900,textTransform:"uppercase",letterSpacing:"2px",color:"rgba(255,255,255,0.3)"}}>{t.comparison}</p>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <th style={{padding:"13px 28px",textAlign:"left",fontSize:11,fontWeight:800,textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>{t.feat}</th>
                <th style={{padding:"13px 20px",textAlign:"center",fontSize:11,fontWeight:800,textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>{t.free}</th>
                <th style={{padding:"13px 20px",textAlign:"center",fontSize:11,fontWeight:800,textTransform:"uppercase",color:"#60a5fa"}}>{t.pro}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([f,fr,pr],i)=>(
                <tr key={i} style={{borderTop:"1px solid rgba(255,255,255,0.04)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                  <td style={{padding:"12px 28px",fontSize:13,color:"rgba(255,255,255,0.6)"}}>{f}</td>
                  <td style={{padding:"12px 20px",textAlign:"center",fontSize:13,color:fr==="—"?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.5)"}}>{fr}</td>
                  <td style={{padding:"12px 20px",textAlign:"center",fontSize:13,color:pr==="✓"?"#4ade80":"#60a5fa",fontWeight:700}}>{pr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>

      <MyInvoices lang={lang} />

      {/* PAYMENT MODAL */}
      <AnimatePresence>
        {modal&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(6,13,26,0.88)",backdropFilter:"blur(14px)"}}
            onClick={()=>{
              setModal(false);
              setCacStep('phone');
              setCacOtp('');
              setCacPhone('');
              setCacTransactionId('');
              setCacError('');
            }}>
            <motion.div initial={{y:40,scale:0.96}} animate={{y:0,scale:1}} exit={{y:20,opacity:0}}
              onClick={e=>e.stopPropagation()}
              style={{background:"#0d1a2e",border:"1px solid rgba(59,130,246,0.2)",borderRadius:28,width:"100%",maxWidth:560,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 0 100px rgba(59,130,246,0.1),0 40px 80px rgba(0,0,0,0.7)",position:"relative"}}>

              <div style={{position:"absolute",top:0,left:"25%",right:"25%",height:1,background:"linear-gradient(90deg,transparent,#3b82f6,transparent)"}}/>

              {/* Modal header */}
              <div style={{padding:"24px 28px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
                <div>
                  <p style={{margin:0,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"2px",color:"#60a5fa"}}>{t.payTitle}</p>
                  <p style={{margin:"6px 0 0",fontSize:22,fontWeight:900,color:"#fff",letterSpacing:"-0.5px"}}>
                    {price} <span style={{fontSize:13,color:"rgba(255,255,255,0.4)",fontWeight:500}}>FDJ / {t.per[billing]}</span>
                  </p>
                </div>
                <button onClick={()=>{
                  setModal(false);
                  setCacStep('phone');
                  setCacOtp('');
                  setCacPhone('');
                  setCacTransactionId('');
                  setCacError('');
                }} style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
              </div>

              <div style={{overflowY:"auto",padding:"24px 28px 32px"}}>
                <p style={{fontSize:10,fontWeight:900,textTransform:"uppercase",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:12}}>{t.chooseMethod}</p>

                {/* Method buttons */}
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:28}}>
                  {paymentMethods.map(m=>(
                    <button key={m.id} onClick={()=>{
                      setMethod(m.id);
                      if (m.id === 'cac') {
                        setCacStep('phone');
                        setCacOtp('');
                        setCacPhone('');
                        setCacTransactionId('');
                        setCacError('');
                      }
                    }}
                      style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,border:`1px solid ${method===m.id?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.07)"}`,background:method===m.id?"rgba(59,130,246,0.1)":"rgba(255,255,255,0.02)",cursor:"pointer",transition:"all 0.18s",textAlign:"left",width:"100%"}}>
                      <span style={{fontSize:24,flexShrink:0}}>{m.icon}</span>
                      <div style={{flex:1}}>
                        <p style={{margin:0,fontSize:13,fontWeight:800,color:method===m.id?"#fff":"rgba(255,255,255,0.6)"}}>{m.label}</p>
                        <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.3)"}}>{m.sub}</p>
                      </div>
                      <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${method===m.id?"#3b82f6":"rgba(255,255,255,0.15)"}`,background:method===m.id?"#3b82f6":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {method===m.id&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}
                      </div>
                    </button>
                  ))}
                  {paymentMethods.length===0&&(
                    <div style={{padding:"16px",borderRadius:14,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",color:"#fbbf24",fontSize:12,fontWeight:700,lineHeight:1.6}}>
                      Aucun moyen de paiement n'est actif. Contactez l'equipe Vedior GM.
                    </div>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {/* CARD */}
                  {method==="card"&&pricing.cardEnabled&&(
                    <motion.div key="card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                      <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb,#4f46e5)",borderRadius:18,padding:"24px",marginBottom:20,position:"relative",overflow:"hidden"}}>
                        <div style={{position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                          <div style={{width:42,height:30,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",borderRadius:5}}/>
                          <span style={{fontSize:11,fontWeight:900,color:"rgba(255,255,255,0.6)",letterSpacing:"1px"}}>VEDIOR GM</span>
                        </div>
                        <p style={{fontFamily:"monospace",fontSize:19,letterSpacing:"3px",color:"#fff",margin:"0 0 16px",fontWeight:700}}>{card.number||"•••• •••• •••• ••••"}</p>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <div><p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{t.cardHolder}</p><p style={{margin:0,fontSize:13,color:"#fff",fontWeight:700}}>{card.name||t.previewName}</p></div>
                          <div style={{textAlign:"right"}}><p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Exp.</p><p style={{margin:0,fontSize:13,color:"#fff",fontWeight:700}}>{card.expiry||t.previewExpiry}</p></div>
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:12}}>
                        {[{label:t.cardNum,key:"number",fmt:fmtCard,mono:true,ph:"1234 5678 9012 3456"},{label:t.cardName,key:"name",mono:false,ph:t.previewName}].map(f=>(
                          <div key={f.key}>
                            <label style={{display:"block",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"rgba(255,255,255,0.35)",marginBottom:6}}>{f.label}</label>
                            <input placeholder={f.ph} value={card[f.key]} type="text"
                              onChange={e=>setCard({...card,[f.key]:f.fmt?f.fmt(e.target.value):e.target.value.toUpperCase()})}
                              style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"13px 16px",color:"#fff",fontSize:14,fontFamily:f.mono?"monospace":"inherit",outline:"none",boxSizing:"border-box",letterSpacing:f.mono?"2px":"normal"}}/>
                          </div>
                        ))}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                          <div>
                            <label style={{display:"block",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"rgba(255,255,255,0.35)",marginBottom:6}}>{t.cardExpiry}</label>
                            <input placeholder={t.previewExpiry} value={card.expiry} maxLength={5}
                              onChange={e=>setCard({...card,expiry:fmtExp(e.target.value)})}
                              style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"13px 16px",color:"#fff",fontSize:14,fontFamily:"monospace",outline:"none",boxSizing:"border-box",letterSpacing:"2px"}}/>
                          </div>
                          <div>
                            <label style={{display:"block",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"rgba(255,255,255,0.35)",marginBottom:6}}>{t.cardCvv}</label>
                            <input placeholder="•••" maxLength={3} type="password" value={card.cvv}
                              onChange={e=>setCard({...card,cvv:e.target.value.replace(/\D/g,"")})}
                              style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"13px 16px",color:"#fff",fontSize:14,fontFamily:"monospace",outline:"none",boxSizing:"border-box",letterSpacing:"4px"}}/>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleCardPayment}
                        style={{width:"100%",marginTop:20,padding:"16px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"#fff",fontSize:13,fontWeight:900,textTransform:"uppercase",letterSpacing:"1.5px",cursor:"pointer",boxShadow:"0 8px 24px rgba(59,130,246,0.3)"}}>
                        {t.payBtn(price)}
                      </button>
                    </motion.div>
                  )}

                  {/* CAC */}
                  {method==="cac"&&pricing.cacEnabled&&(
                    <motion.div key="cac" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                      <div style={{background:"rgba(59,130,246,0.07)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:18,padding:"24px",textAlign:"center"}}>
                        <div style={{fontSize:52,marginBottom:12}}>📱</div>
                        <h3 style={{fontSize:20,fontWeight:900,color:"#fff",margin:"0 0 10px"}}>{t.cacTitle}</h3>
                        <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,lineHeight:1.7,margin:"0 0 24px"}}>{t.cacDesc(price)}</p>
                        <div style={{background:"rgba(255,255,255,0.06)",borderRadius:14,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                          <div style={{textAlign:"left"}}>
                            <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"1px"}}>{t.cacNum}</p>
                            <p style={{fontSize:26,fontWeight:900,color:"#60a5fa",fontFamily:"monospace",margin:0,letterSpacing:"3px"}}>{pricing.cacNumber}</p>
                          </div>
                          <button onClick={()=>cp(pricing.cacNumber,"cac")} style={{padding:"10px 18px",borderRadius:10,background:copied==="cac"?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",color:copied==="cac"?"#4ade80":"rgba(255,255,255,0.6)",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                            {copied==="cac"?t.copied:t.copy}
                          </button>
                        </div>

                        {/* Formulaire CAC Pay : deux étapes */}
                        {cacStep === 'phone' ? (
                          <>
                            <div style={{margin:"12px 0 16px"}}>
                              <label style={{display:"block",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"rgba(255,255,255,0.4)",marginBottom:8}}>
                                {lang==="FR"?"Numéro de téléphone":"Phone number"}
                              </label>
                              <input
                                type="tel"
                                value={cacPhone}
                                onChange={e=>setCacPhone(e.target.value)}
                                placeholder="77 00 00 00"
                                style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"12px 16px",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"}}
                              />
                            </div>
                            {cacError && <p style={{color:"#f87171",fontSize:12,margin:"-8px 0 12px"}}>{cacError}</p>}
                            <button
                              onClick={initiateCacPayment}
                              disabled={cacLoading || !cacPhone.trim()}
                              style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:cacLoading || !cacPhone.trim()?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#3b82f6,#6366f1)",color:cacLoading || !cacPhone.trim()?"rgba(255,255,255,0.3)":"#fff",fontSize:13,fontWeight:900,textTransform:"uppercase",letterSpacing:"1.5px",cursor:cacLoading || !cacPhone.trim()?"not-allowed":"pointer",transition:"all 0.2s"}}>
                              {cacLoading ? (lang==="FR"?"Envoi...":"Sending...") : (lang==="FR"?"📲 Recevoir le code OTP":"📲 Get OTP code")}
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{margin:"12px 0 16px"}}>
                              <label style={{display:"block",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"rgba(255,255,255,0.4)",marginBottom:8}}>
                                {lang==="FR"?"Code OTP reçu par SMS":"OTP code received by SMS"}
                              </label>
                              <input
                                type="text"
                                value={cacOtp}
                                onChange={e=>setCacOtp(e.target.value.replace(/\D/g,""))}
                                placeholder="123456"
                                maxLength={6}
                                style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"12px 16px",color:"#fff",fontSize:14,fontFamily:"monospace",letterSpacing:"4px",outline:"none",boxSizing:"border-box"}}
                              />
                            </div>
                            {cacError && <p style={{color:"#f87171",fontSize:12,margin:"-8px 0 12px"}}>{cacError}</p>}
                            <button
                              onClick={confirmCacPayment}
                              disabled={cacLoading || !cacOtp.trim()}
                              style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:cacLoading || !cacOtp.trim()?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#22c55e,#16a34a)",color:cacLoading || !cacOtp.trim()?"rgba(255,255,255,0.3)":"#fff",fontSize:13,fontWeight:900,textTransform:"uppercase",letterSpacing:"1.5px",cursor:cacLoading || !cacOtp.trim()?"not-allowed":"pointer",transition:"all 0.2s"}}>
                              {cacLoading ? (lang==="FR"?"Vérification...":"Verifying...") : t.cacBtn}
                            </button>
                            <button
                              onClick={()=>{setCacStep('phone');setCacOtp('');setCacError('');}}
                              style={{marginTop:10,background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:11,cursor:"pointer",textDecoration:"underline"}}>
                              {lang==="FR"?"← Retourner au numéro":"← Back to phone"}
                            </button>
                          </>
                        )}

                        <div style={{background:"rgba(59,130,246,0.08)",borderRadius:10,padding:"12px 16px",marginTop:16,display:"flex",gap:10,textAlign:"left"}}>
                          <span style={{fontSize:16,flexShrink:0}}>ℹ️</span>
                          <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0,lineHeight:1.7}}>{t.cacNote} <strong style={{color:"#60a5fa"}}>{pricing.supportEmail}</strong></p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* TRANSFER */}
                  {method==="transfer"&&pricing.bankEnabled&&(
                    <motion.div key="transfer" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,overflow:"hidden",marginBottom:12}}>
                        <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <p style={{margin:0,fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"rgba(255,255,255,0.35)"}}>{t.bankTitle}</p>
                          <span style={{fontSize:20}}>🏦</span>
                        </div>
                        {BANK.map(([label,val])=>(
                          <div key={label} style={{padding:"12px 20px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                            <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",minWidth:110,textTransform:"uppercase",letterSpacing:"0.3px"}}>{label}</span>
                            <div style={{display:"flex",alignItems:"center",gap:8,flex:1,justifyContent:"flex-end"}}>
                              <span style={{fontSize:12,fontWeight:700,color:"#fff",fontFamily:label.includes("N°")||label.includes("IBAN")||label.includes("BIC")?"monospace":"inherit",letterSpacing:label.includes("N°")||label.includes("IBAN")?"1px":"normal",textAlign:"right",wordBreak:"break-all"}}>{val}</span>
                              {!["Banque / Bank","Titulaire"].includes(label)&&(
                                <button onClick={()=>cp(val,label)} style={{padding:"4px 10px",borderRadius:7,background:copied===label?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",color:copied===label?"#4ade80":"rgba(255,255,255,0.35)",fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                                  {copied===label?"✓":t.copy}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"12px 16px",display:"flex",gap:10}}>
                        <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
                        <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.45)",lineHeight:1.7}}>{t.bankWarn} <strong style={{color:"#fbbf24"}}>{t.bankWarn2}</strong> {t.bankWarn3}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {paymentMethods.length>0 && (
                  <div style={{marginTop:20}}>
                    {/* Payment reference input pour les méthodes autres que CAC (pour CAC, on gère l'OTP) */}
                    {method !== 'cac' && (
                      <div style={{marginBottom:12}}>
                        <label style={{display:"block",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"1.5px",color:"rgba(255,255,255,0.4)",marginBottom:8}}>
                          {lang==="FR"?"📎 Référence de paiement *":"📎 Payment reference *"}
                        </label>
                        <input
                          type="text"
                          value={paymentRef}
                          onChange={e=>setPaymentRef(e.target.value)}
                          placeholder={
                            method==="card"
                              ? (lang==="FR"?"Ex: REF-CARD-20250607":"Ex: REF-CARD-20250607")
                              : (lang==="FR"?"Ex: VIR-BCI-20250607-001":"Ex: VIR-BCI-20250607-001")
                          }
                          style={{width:"100%",background:"rgba(255,255,255,0.06)",border:`1px solid ${paymentRef.trim()?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.12)"}`,borderRadius:12,padding:"12px 16px",color:"#fff",fontSize:13,fontWeight:600,outline:"none",boxSizing:"border-box",transition:"border-color 0.2s",letterSpacing:"0.5px"}}
                        />
                        <p style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:5,fontStyle:"italic"}}>
                          {lang==="FR"
                            ? "Cette référence sera transmise à l'admin pour valider votre paiement."
                            : "This reference will be sent to the admin to validate your payment."}
                        </p>
                      </div>
                    )}

                    {/* Bouton de confirmation pour les méthodes non-CAC */}
                    {method !== 'cac' && (
                      <button
                        disabled={!paymentRef.trim() && method !== 'card'}
                        onClick={method === 'card' ? handleCardPayment : handleTransferPayment}
                        style={{width:"100%",padding:"16px",borderRadius:14,border:"none",background:(paymentRef.trim() || method === 'card')?"linear-gradient(135deg,#3b82f6,#6366f1)":"rgba(255,255,255,0.08)",color:(paymentRef.trim() || method === 'card')?"#fff":"rgba(255,255,255,0.3)",fontSize:13,fontWeight:900,textTransform:"uppercase",letterSpacing:"1.5px",cursor:(paymentRef.trim() || method === 'card')?"pointer":"not-allowed",boxShadow:(paymentRef.trim() || method === 'card')?"0 8px 24px rgba(59,130,246,0.3)":"none",transition:"all 0.2s"}}>
                        {method==="card"?t.payBtn(price):method==="transfer"?(lang==="FR"?"✅ J'ai effectué le virement":"✅ I've made the transfer"):t.payBtn(price)}
                      </button>
                    )}
                  </div>
                )}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:14,opacity:0.3}}>
                  <span>🔒</span><span style={{fontSize:11,fontWeight:600}}>{t.secure}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helpers ───
const fmtCard = (v) => v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
const fmtExp = (v) => {
  const d = v.replace(/\D/g,"").slice(0,4);
  return d.length>=3 ? d.slice(0,2)+"/"+d.slice(2) : d;
};

const DEFAULT_PRICING = {
  monthlyPrice: 15000,
  quarterlyPrice: 39000,
  yearlyPrice: 144000,
  freeJobsLimit: 1,
  freeApplicationsLimit: 5,
  freeRequestsLimit: 1,
  proJobsLimit: -1,
  cacNumber: "+253 77 XX XX XX",
  cacEnabled: true,
  bankName: "Banque Centrale de Djibouti (BCD)",
  bankHolder: "Vedior GM SARL",
  bankAccount: "DJ 01 0001 0000 XXXX XXXX XXXX",
  bankIban: "DJ 01 0001 0000 XXXX XXXX XXXX",
  bankBic: "BCDIJDJA",
  bankEnabled: true,
  cardEnabled: true,
  cardProvider: "Mock",
  cardPublicKey: "",
  cardSecretKeyEnv: "PAYMENT_SECRET_KEY",
  cardCheckoutUrl: "",
  cardWebhookUrl: "",
  supportEmail: "support@vedior-gm.dj",
};