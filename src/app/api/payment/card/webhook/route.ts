// src/app/api/payment/card/webhook/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'vediorgm',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

const PLAN_DURATIONS: Record<string, number> = {
  monthly: 30, quarterly: 90, annual: 365,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, data } = body;

    const webhookSecret = process.env.CARD_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get('x-webhook-signature') || req.headers.get('stripe-signature');
      if (!signature) {
        return NextResponse.json({ error: 'Signature manquante' }, { status: 401 });
      }
    }

    if (event === 'payment.success' || event === 'checkout.session.completed' || event === 'payment_intent.succeeded') {
      const recruiterId = data?.metadata?.recruiterId || data?.recruiterId;
      const plan = data?.metadata?.plan || data?.plan || 'pro';
      const billingCycle = data?.metadata?.billingCycle || data?.billing_cycle || 'monthly';
      const amount = data?.amount || data?.amount_total || 0;
      const transactionId = data?.id || data?.payment_intent || data?.transaction_id;

      if (recruiterId) {
        const durationDays = PLAN_DURATIONS[billingCycle] || 30;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + durationDays);
        const expiryStr = expiry.toISOString().split('T')[0];

        const recruitersSnap = await db.collection('recruiters').where('uid', '==', recruiterId).limit(1).get();
        if (!recruitersSnap.empty) {
          const batch = db.batch();
          batch.update(recruitersSnap.docs[0].ref, {
            plan: 'pro', planStatus: 'active', planExpiry: expiryStr,
            planBillingCycle: billingCycle, planActivatedAt: new Date().toISOString(),
          });
          const paymentRef = db.collection('payments').doc();
          batch.set(paymentRef, {
            recruiterId, transactionId, amount: amount / 100,
            plan, billingCycle, method: 'card', status: 'success',
            planExpiry: expiryStr, webhookEvent: event,
            createdAt: FieldValue.serverTimestamp(),
          });
          await batch.commit();
          console.log(`[Webhook] Plan Pro activé pour ${recruiterId} jusqu'au ${expiryStr}`);
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error('[Card Webhook] Erreur:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}