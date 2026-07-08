// src/app/api/groq/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY manquante' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: body.max_tokens || 1500,
        temperature: body.temperature || 0.2,
        messages: body.messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err.error?.message || 'Erreur Groq' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}