// src/app/api/scan-cv/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileBase64, mimeType } = body;

    if (!fileBase64 || !mimeType) {
      return NextResponse.json({ error: 'fileBase64 et mimeType requis' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY non configurée' }, { status: 500 });
    }

    const isPDF = mimeType === 'application/pdf';
    const isImage = mimeType.startsWith('image/');

    const prompt = `Tu es un expert RH spécialisé dans le marché de l'emploi de Djibouti.

Contexte local important :
- Universités : Université de Djibouti (UoD), IUT Djibouti, ISERH, Institut Supérieur de Gestion
- Entreprises locales : Port de Djibouti, PAID, DMP, Doraleh Container Terminal (DCT), Djibouti Telecom, ONEAD, EDD, CDE, Banque de Djibouti, BCIMR, SGTD, SIDEM, Gulf of Aden Security, Kempinski, Sheraton, Djibouti Palace, CHN
- Secteurs dominants : BTP & infrastructure portuaire, Logistique & maritime, Hôtellerie & tourisme, Sécurité, Santé, Administration & finance
- Nationalités courantes : Djiboutienne, Éthiopienne, Somalienne, Française, Yéménite, Érythréenne
- Langues locales : Français, Arabe, Somali, Afar, Anglais
- Quartiers de Djibouti : Balbala, Arhiba, Plateau du Serpent, Ali Sabieh, Tadjoura, Obock, Dikhil

Analyse ce CV et extrais toutes les informations disponibles.

Réponds UNIQUEMENT avec un objet JSON valide (sans backticks, sans commentaires) :
{
  "fullName": "Prénom Nom ou null",
  "email": "email@exemple.com ou null",
  "phone": "+253... ou null",
  "whatsapp": "+253... ou null",
  "nationality": "ex: Djiboutienne, Éthiopienne, Française ou null",
  "gender": "M ou F ou null",
  "address": "ville ou quartier ou null",
  "education": "dernier diplôme ou null",
  "experience": "5 (entier, années uniquement) ou 0",
  "jobTitle": "poste actuel ou recherché ou null",
  "sector": "btp ou logistics ou hospitality ou security ou catering ou commerce ou healthcare ou admin",
  "languages": "Français, Arabe, Somali, Afar, Anglais... ou null",
  "skills": "compétences clés séparées virgule ou null",
  "availability": "immediate ou 1_week ou 1_month ou 3_months",
  "summary": "résumé professionnel 2-3 phrases ou null"
}

Si une information est absente du CV, mets null.
Réponds UNIQUEMENT avec le JSON, rien d'autre.`;

    let messages: any[];

    if (isImage) {
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${fileBase64}` },
          },
        ],
      }];
    } else {
      const decoded = Buffer.from(fileBase64, 'base64').toString('utf-8')
        .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 6000);

      const textContent = decoded.length > 30
        ? `Contenu extrait du CV (PDF) :\n${decoded}`
        : `Note: Ce PDF semble être un scan image. Contenu brut : ${decoded.slice(0, 500)}`;

      messages = [{
        role: 'user',
        content: `${prompt}\n\n${textContent}`,
      }];
    }

    const model = isImage ? 'llama-3.2-90b-vision-preview' : 'llama-3.3-70b-versatile';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 1000, temperature: 0.1 }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err.error?.message || 'Erreur Groq' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    const clean = rawText.replace(/```json|```/g, '').trim();

    let profile;
    try {
      profile = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try { profile = JSON.parse(match[0]); }
        catch { return NextResponse.json({ error: 'Impossible de parser la réponse', raw: rawText }, { status: 422 }); }
      } else {
        return NextResponse.json({ error: 'Impossible de parser la réponse', raw: rawText }, { status: 422 });
      }
    }

    return NextResponse.json({ profile });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}