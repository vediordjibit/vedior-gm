// pages/api/payment/cac/confirm.js
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert } from 'firebase-admin/app';

// Initialiser Firebase Admin si ce n'est pas déjà fait
if (!global._firebaseAdminApp) {
  const serviceAccount = JSON.parse(process.env.ADMIN_SDK_KEY);
  const app = initializeApp({
    credential: cert(serviceAccount),
  });
  global._firebaseAdminApp = app;
}
const db = getFirestore();
const auth = getAuth();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transactionId, otp, recruiterId, billing, amount } = req.body;

  if (!transactionId || !otp || !recruiterId || !billing) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // En mode mock, on accepte le code 123456
  if (process.env.NEXT_PUBLIC_PAYMENT_MOCK_MODE === 'true') {
    if (otp !== '123456') {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    // On simule une confirmation
    try {
      // Récupérer le recruteur
      const recruiterRef = db.collection('recruiters').doc(recruiterId);
      const recruiterSnap = await recruiterRef.get();
      if (!recruiterSnap.exists) {
        return res.status(404).json({ error: 'Recruiter not found' });
      }
      const recruiterData = recruiterSnap.data();

      // Calculer la date d'expiration
      const now = new Date();
      const expiry = new Date(now);
      if (billing === 'monthly') expiry.setMonth(expiry.getMonth() + 1);
      else if (billing === 'quarterly') expiry.setMonth(expiry.getMonth() + 3);
      else if (billing === 'yearly') expiry.setFullYear(expiry.getFullYear() + 1);

      // Mettre à jour le statut du recruteur
      await recruiterRef.update({
        plan: 'pro',
        planStatus: 'active',
        planBilling: billing,
        planActivatedAt: now.toISOString(),
        planExpiry: expiry.toISOString().split('T')[0],
        planNote: `Paiement CAC Pay confirmé (transaction ${transactionId})`,
        planUpdatedAt: now.toISOString(),
      });

      // Ajouter une entrée dans l'historique des paiements
      const paymentsRef = db.collection('payments');
      await paymentsRef.add({
        recruiterId: recruiterId,
        recruiterEmail: recruiterData.email || '',
        recruiterName: recruiterData.companyName || recruiterData.contactName || '',
        amount: amount || 0,
        billing: billing,
        method: 'cac',
        status: 'confirmed',
        transactionId: transactionId,
        createdAt: now,
        confirmedAt: now,
        expiryDate: expiry.toISOString().split('T')[0],
      });

      // Envoyer l'email d'activation (via la fonction existante)
      // On peut appeler la fonction sendActivationEmail via un import ou une Cloud Function
      // Pour simplifier, on va juste logger
      console.log(`✅ Abonnement Pro activé pour ${recruiterData.email}`);

      return res.status(200).json({ success: true, message: 'Paiement confirmé' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erreur lors de la confirmation' });
    }
  }

  // En production, on appellerait l'API réelle de la banque pour vérifier l'OTP
  // et ensuite on mettrait à jour Firestore comme ci-dessus.
  return res.status(501).json({ error: 'Endpoint de production non implémenté' });
}