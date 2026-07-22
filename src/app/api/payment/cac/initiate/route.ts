// src/app/api/payment/cac/initiate/route.ts
// Démarre un paiement CAC Pay — mode mock jusqu'à intégration réelle
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const MOCK_MODE = process.env.PAYMENT_MOCK_MODE === 'true' || process.env.NODE_ENV !== 'production';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency = 'DJF', recruiterId, plan, phoneNumber } = body;

    if (!amount || !recruiterId || !plan) {
      return NextResponse.json(
        { error: 'amount, recruiterId et plan sont requis' },
        { status: 400 }
      );
    }

    // ── MODE MOCK ──────────────────────────────────────────────────────────
    if (MOCK_MODE) {
      const mockTransactionId = `MOCK-CAC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      console.log(`[CAC Mock] Initiation paiement ${amount} ${currency} pour ${recruiterId}`);
      return NextResponse.json({
        success: true,
        transactionId: mockTransactionId,
        message: 'Paiement initié (mode mock). Entrez le code OTP : 123456',
        mock: true,
        otpHint: '123456',
      });
    }

    // ── MODE RÉEL (à compléter quand CAC Bank fournit l'API) ───────────────
    const CAC_API_URL = process.env.CAC_PAY_API_URL;
    const CAC_API_KEY = process.env.CAC_PAY_API_KEY;
    const CAC_MERCHANT_ID = process.env.CAC_PAY_MERCHANT_ID;

    if (!CAC_API_URL || !CAC_API_KEY || !CAC_MERCHANT_ID) {
      return NextResponse.json(
        { error: 'CAC Pay non configuré — variables d\'environnement manquantes' },
        { status: 500 }
      );
    }

    const response = await fetch(`${CAC_API_URL}/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CAC_API_KEY}`,
        'X-Merchant-ID': CAC_MERCHANT_ID,
      },
      body: JSON.stringify({
        amount,
        currency,
        phone: phoneNumber,
        reference: `VGM-${recruiterId}-${Date.now()}`,
        description: `Abonnement Vedior GM — Plan ${plan}`,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/cac/confirm`,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || 'Erreur CAC Pay' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      transactionId: data.transaction_id || data.transactionId,
      message: data.message || 'OTP envoyé sur votre téléphone',
    });

  } catch (err: any) {
    console.error('[CAC Initiate] Erreur:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
