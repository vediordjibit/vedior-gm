import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminAuth } from '../../../lib/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

// URL vers laquelle l'utilisateur est renvoyé après avoir défini son mot de passe
const ACTION_URL = 'https://vedior-gm--vediorgm.us-central1.hosted.app/login';

// Email template for recruiter
function recruiterEmailHTML(data: { companyName: string; contactName: string; email: string; resetLink: string }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bienvenue sur Vedior GM</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:#0A192F;padding:36px 48px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">VEDIOR GM</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Recrutement · Djibouti</div>
              <div style="width:40px;height:3px;background:#00A3E0;border-radius:2px;margin:16px auto 0;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px;">
              <p style="font-size:13px;color:#64748B;margin:0 0 8px;">Bonjour <strong style="color:#0A192F;">${data.contactName}</strong>,</p>
              <h1 style="font-size:24px;font-weight:800;color:#0A192F;margin:0 0 16px;letter-spacing:-0.5px;">
                Votre compte recruteur est créé 🎉
              </h1>
              <p style="font-size:14px;color:#64748B;line-height:1.7;margin:0 0 24px;">
                L'équipe Vedior GM a créé votre espace recruteur pour <strong style="color:#0A192F;">${data.companyName}</strong>.<br>
                Pour activer votre compte, définissez votre mot de passe en cliquant sur le bouton ci-dessous.
              </p>

              <!-- Info box -->
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid #00A3E0;border-radius:10px;padding:20px 24px;margin-bottom:32px;">
                <div style="font-size:11px;font-weight:700;color:#00A3E0;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Vos identifiants de connexion</div>
                <div style="font-size:14px;color:#0A192F;line-height:1.8;">
                  <span style="color:#64748B;">Email :</span> <strong>${data.email}</strong><br>
                  <span style="color:#64748B;">Mot de passe :</span> <strong>À définir via le lien ci-dessous</strong>
                </div>
              </div>

              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${data.resetLink}" style="display:inline-block;background:#00A3E0;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:800;font-size:14px;letter-spacing:0.5px;">
                  Définir mon mot de passe →
                </a>
              </div>

              <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">
                Ce lien est valable 24 heures. Si vous n'avez pas demandé ce compte, ignorez cet email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:24px 48px;border-top:1px solid #E2E8F0;">
              <p style="font-size:12px;color:#94A3B8;margin:0;text-align:center;">
                © 2025 Vedior GM · Recrutement à Djibouti<br>
                <a href="https://vediorgm.web.app" style="color:#00A3E0;text-decoration:none;">vediorgm.web.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Email template for candidate VGM
function candidateEmailHTML(data: { fullName: string; email: string; vgmId: string; tempPassword: string }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Votre dossier Vedior GM</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:#0A192F;padding:36px 48px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">VEDIOR GM</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Recrutement · Djibouti</div>
              <div style="width:40px;height:3px;background:#00A3E0;border-radius:2px;margin:16px auto 0;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px;">
              <p style="font-size:13px;color:#64748B;margin:0 0 8px;">Bonjour <strong style="color:#0A192F;">${data.fullName}</strong>,</p>
              <h1 style="font-size:24px;font-weight:800;color:#0A192F;margin:0 0 16px;letter-spacing:-0.5px;">
                Votre dossier candidat est prêt ✅
              </h1>
              <p style="font-size:14px;color:#64748B;line-height:1.7;margin:0 0 32px;">
                Votre dossier a été créé par l'agence Vedior GM. Voici vos identifiants pour accéder à votre espace personnel.
              </p>

              <!-- Credentials box -->
              <div style="background:#0A192F;border-radius:14px;padding:28px 32px;margin-bottom:32px;">
                <div style="font-size:11px;font-weight:700;color:#00A3E0;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:20px;">Vos identifiants de connexion</div>
                
                <div style="margin-bottom:16px;">
                  <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Identifiant VGM</div>
                  <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:2px;font-family:monospace;">${data.vgmId}</div>
                </div>

                <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
                  <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Mot de passe temporaire</div>
                  <div style="font-size:18px;font-weight:700;color:#00A3E0;font-family:monospace;">${data.tempPassword}</div>
                </div>
              </div>

              <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:16px 20px;margin-bottom:32px;">
                <div style="font-size:12px;font-weight:700;color:#EA580C;margin-bottom:6px;">⚠️ Important</div>
                <div style="font-size:13px;color:#9A3412;line-height:1.6;">
                  Changez votre mot de passe dès votre première connexion. Conservez votre identifiant VGM en lieu sûr.
                </div>
              </div>

              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="https://vediorgm.web.app" style="display:inline-block;background:#00A3E0;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:800;font-size:14px;letter-spacing:0.5px;">
                  Accéder à mon espace →
                </a>
              </div>

              <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">
                Pour toute assistance, contactez Vedior GM.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:24px 48px;border-top:1px solid #E2E8F0;">
              <p style="font-size:12px;color:#94A3B8;margin:0;text-align:center;">
                © 2025 Vedior GM · Recrutement à Djibouti<br>
                <a href="https://vediorgm.web.app" style="color:#00A3E0;text-decoration:none;">vediorgm.web.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, ...data } = body;

    if (type === 'recruiter') {
      const { companyName, contactName, email } = data;

      // Génère le lien "définir mot de passe" via Admin SDK.
      // Ceci NE déclenche PAS l'email natif de Firebase — seul un lien est retourné,
      // qu'on insère ensuite dans notre propre template envoyé via Resend.
      let resetLink: string;
      try {
        resetLink = await adminAuth.generatePasswordResetLink(email, {
          url: ACTION_URL,
          handleCodeInApp: false,
        });
      } catch (linkErr: any) {
        return NextResponse.json({ error: `Génération du lien échouée: ${linkErr.message}` }, { status: 400 });
      }

      const { error } = await resend.emails.send({
        from: 'Vedior GM <noreply@vediorgm.com>',
        replyTo: 'vediordjib.it@gmail.com',
        to: email,
        subject: `Votre compte recruteur Vedior GM est prêt`,
        html: recruiterEmailHTML({ companyName, contactName, email, resetLink }),
      });

      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ success: true });

    } else if (type === 'candidate') {
      const { fullName, email, vgmId, tempPassword } = data;

      const { error } = await resend.emails.send({
        from: 'Vedior GM <noreply@vediorgm.com>',
        replyTo: 'vediordjib.it@gmail.com',
        to: email,
        subject: `Votre dossier candidat Vedior GM — Identifiant : ${vgmId}`,
        html: candidateEmailHTML({ fullName, email, vgmId, tempPassword }),
      });

      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ success: true });

    } else {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}