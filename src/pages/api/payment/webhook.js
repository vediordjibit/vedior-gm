// pages/api/payment/webhook.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simuler la réception d'un webhook de confirmation de paiement
  const { transactionId, status, reference } = req.body;

  console.log(`📩 Webhook reçu : transaction ${transactionId}, statut ${status}`);

  // En production, on mettrait à jour Firestore ici

  return res.status(200).json({ received: true });
}