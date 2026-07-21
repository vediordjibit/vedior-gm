// pages/api/payment/card/create.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cardNumber, expiry, cvv, name, amount, billing, recruiterId } = req.body;

  // Validation basique (Luhn non implémenté pour le mock)
  if (!cardNumber || !expiry || !cvv || !amount || !recruiterId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Simuler une autorisation (toujours réussie en mock)
  const transactionId = 'CARD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

  // Retourner un statut de succès immédiat
  // Dans la réalité, on renverrait une URL de redirection vers la banque
  return res.status(200).json({
    success: true,
    transactionId,
    redirectUrl: `/payment/success?tx=${transactionId}`,
    // Pour le mock, on peut aussi simuler une confirmation directe
    mockConfirmed: true,
  });
}