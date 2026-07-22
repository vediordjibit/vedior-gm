// src/app/api/payment/cac/confirm/route.ts
// Confirme le paiement CAC Pay via OTP et active le plan Pro dans Firestore
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Init Firebase Admin (une seule fois)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'vediorgm',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

const MOCK_MODE = process.env.PAYMENT_MOCK_MODE === 'true' || process.env.NODE_ENV !== 'production';
const MOCK_OTP = '123456';

// Durées des plans en jours
const PLAN_DURATIONS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, otp, recruiterId, plan, billingCycle, amount } = body;

    if (!transactionId || !otp || !recruiterId || !plan) {
      return NextResponse.json(
        { error: 'transactionId, otp, recruiterId et plan sont requis' },
        { status: 400 }
      );
    }

    // ── MODE MOCK ──────────────────────────────────────────────────────────
    if (MOCK_MODE) {
      if (otp !== MOCK_OTP) {
        return NextResponse.json(
          { error: 'Code OTP incorrect. En mode mock, utilisez : 123456' },
          { status: 400 }
        );
      }

      // Activer le plan dans Firestore
      await activatePlan(recruiterId, plan, billingCycle, amount, transactionId, 'mock');

      console.log(`[CAC Mock] Paiement confirmé pour ${recruiterId} — plan ${plan}`);
      return NextResponse.json({
        success: true,
        message: 'Paiement confirmé (mode mock) — plan Pro activé',
        mock: true,
      });
    }

    // ── MODE RÉEL ──────────────────────────────────────────────────────────
    const CAC_API_URL = process.env.CAC_PAY_API_URL;
    const CAC_API_KEY = process.env.CAC_PAY_API_KEY;

    if (!CAC_API_URL || !CAC_API_KEY) {
      return NextResponse.json({ error: 'CAC Pay non configuré' }, { status: 500 });
    }

    const response = await fetch(`${CAC_API_URL}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CAC_API_KEY}`,
      },
      body: JSON.stringify({ transaction_id: transactionId, otp }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || 'OTP incorrect ou transaction expirée' },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (data.status !== 'success' && data.status !== 'approved') {
      return NextResponse.json(
        { error: data.message || 'Paiement refusé par CAC Pay' },
        { status: 400 }
      );
    }

    // Activer le plan dans Firestore
    await activatePlan(recruiterId, plan, billingCycle, amount, transactionId, 'cac_pay');

    return NextResponse.json({
      success: true,
      message: 'Paiement confirmé — plan Pro activé',
    });

  } catch (err: any) {
    console.error('[CAC Confirm] Erreur:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}

// ── Active le plan dans Firestore ─────────────────────────────────────────
async function activatePlan(
  recruiterId: string,
  plan: string,
  billingCycle: string = 'monthly',
  amount: number = 0,
  transactionId: string,
  method: string
) {
  const durationDays = PLAN_DURATIONS[billingCycle] || 30;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + durationDays);
  const expiryStr = expiry.toISOString().split('T')[0]; // YYYY-MM-DD

  // Chercher le recruteur par ID ou userId
  const recruitersSnap = await db.collection('recruiters')
    .where('uid', '==', recruiterId)
    .limit(1)
    .get();

  let recruiterRef;
  if (!recruitersSnap.empty) {
    recruiterRef = recruitersSnap.docs[0].ref;
  } else {
    // Fallback : chercher par doc ID
    recruiterRef = db.collection('recruiters').doc(recruiterId);
  }

  const batch = db.batch();

  // Mettre à jour le recruteur
  batch.update(recruiterRef, {
    plan: 'pro',
    planStatus: 'active',
    planExpiry: expiryStr,
    planBillingCycle: billingCycle,
    planActivatedAt: new Date().toISOString(),
    planUpdatedAt: new Date().toISOString(),
  });

  // Créer un doc paiement
  const paymentRef = db.collection('payments').doc();
  batch.set(paymentRef, {
    recruiterId,
    transactionId,
    amount,
    plan,
    billingCycle,
    method,
    status: 'success',
    planExpiry: expiryStr,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}
