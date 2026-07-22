// src/app/api/payment/card/create/route.ts
// Crée une session de paiement par carte bancaire (mode mock + stub API réelle)
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const MOCK_MODE = process.env.PAYMENT_MOCK_MODE === 'true' || process.env.NODE_ENV !== 'production';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency = 'DJF', recruiterId, plan, billingCycle, email } = body;

    if (!amount || !recruiterId || !plan) {
      return NextResponse.json(
        { error: 'amount, recruiterId et plan sont requis' },
        { status: 400 }
      );
    }

    // ── MODE MOCK ──────────────────────────────────────────────────────────
    if (MOCK_MODE) {
      const mockSessionId = `MOCK-CARD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      return NextResponse.json({
        success: true,
        sessionId: mockSessionId,
        checkoutUrl: null,
        message: 'Session paiement carte créée (mode mock)',
        mock: true,
        // En mode mock, le paiement est automatiquement confirmé
        autoConfirm: true,
      });
    }

    // ── MODE RÉEL — à compléter selon le prestataire bancaire ─────────────
    // Exemple avec Stripe (remplacer par l'API de la banque locale)
    const PAYMENT_API_URL = process.env.CARD_PAYMENT_API_URL;
    const PAYMENT_API_KEY = process.env.CARD_PAYMENT_API_KEY;

    if (!PAYMENT_API_URL || !PAYMENT_API_KEY) {
      return NextResponse.json(
        { error: 'Paiement par carte non configuré' },
        { status: 500 }
      );
    }

    const response = await fetch(`${PAYMENT_API_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAYMENT_API_KEY}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        customer_email: email,
        reference: `VGM-${recruiterId}-${Date.now()}`,
        description: `Vedior GM — Plan ${plan} (${billingCycle})`,
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`,
        metadata: { recruiterId, plan, billingCycle },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || 'Erreur création session paiement' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      sessionId: data.id || data.session_id,
      checkoutUrl: data.url || data.checkout_url,
    });

  } catch (err: any) {
    console.error('[Card Create] Erreur:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
