// src/app/api/payment/cac/confirm/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

function getDb() {
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'vediorgm',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

const MOCK_MODE = process.env.PAYMENT_MOCK_MODE === 'true' || process.env.NODE_ENV !== 'production';
const MOCK_OTP = '123456';
const PLAN_DURATIONS: Record<string, number> = { monthly: 30, quarterly: 90, annual: 365 };

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

    if (MOCK_MODE) {
      if (otp !== MOCK_OTP) {
        return NextResponse.json(
          { error: 'Code OTP incorrect. En mode mock, utilisez : 123456' },
          { status: 400 }
        );
      }
      await activatePlan(recruiterId, plan, billingCycle, amount, transactionId, 'mock');
      return NextResponse.json({ success: true, message: 'Paiement confirmé (mode mock)', mock: true });
    }

    const CAC_API_URL = process.env.CAC_PAY_API_URL;
    const CAC_API_KEY = process.env.CAC_PAY_API_KEY;
    if (!CAC_API_URL || !CAC_API_KEY) {
      return NextResponse.json({ error: 'CAC Pay non configuré' }, { status: 500 });
    }

    const response = await fetch(`${CAC_API_URL}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CAC_API_KEY}` },
      body: JSON.stringify({ transaction_id: transactionId, otp }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json({ error: err.message || 'OTP incorrect' }, { status: response.status });
    }

    const data = await response.json();
    if (data.status !== 'success' && data.status !== 'approved') {
      return NextResponse.json({ error: data.message || 'Paiement refusé' }, { status: 400 });
    }

    await activatePlan(recruiterId, plan, billingCycle, amount, transactionId, 'cac_pay');
    return NextResponse.json({ success: true, message: 'Paiement confirmé — plan Pro activé' });

  } catch (err: any) {
    console.error('[CAC Confirm]', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}

async function activatePlan(
  recruiterId: string, plan: string, billingCycle = 'monthly',
  amount = 0, transactionId: string, method: string
) {
  const { FieldValue } = require('firebase-admin/firestore');
  const db = getDb();
  const durationDays = PLAN_DURATIONS[billingCycle] || 30;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + durationDays);
  const expiryStr = expiry.toISOString().split('T')[0];

  const snap = await db.collection('recruiters').where('uid', '==', recruiterId).limit(1).get();
  const recruiterRef = !snap.empty ? snap.docs[0].ref : db.collection('recruiters').doc(recruiterId);

  const batch = db.batch();
  batch.update(recruiterRef, {
    plan: 'pro', planStatus: 'active', planExpiry: expiryStr,
    planBillingCycle: billingCycle, planActivatedAt: new Date().toISOString(),
    planUpdatedAt: new Date().toISOString(),
  });
  batch.set(db.collection('payments').doc(), {
    recruiterId, transactionId, amount, plan, billingCycle,
    method, status: 'success', planExpiry: expiryStr,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}