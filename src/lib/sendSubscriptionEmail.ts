/**
 * sendSubscriptionEmail.ts
 * Envoi d'emails d'activation/rejet d'abonnement via EmailJS
 */

const EMAILJS_SERVICE_ID  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID  || 'service_abc123';
const EMAILJS_PUBLIC_KEY  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY  || 'Qd8_jg0ZOGxFimKMO';
const TEMPLATE_ACTIVATION = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ACTIVATION_ID || 'template_r9pem1p';
const TEMPLATE_REJECTION  = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_REJECTION_ID  || 'template_ndb3jfh';

// Debug — à supprimer après confirmation que les emails partent
if (typeof window !== 'undefined') {
  console.log('📧 EmailJS config:', { EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, TEMPLATE_ACTIVATION, TEMPLATE_REJECTION });
}

// Charge EmailJS dynamiquement (évite les erreurs SSR Next.js)
async function getEmailJS() {
  const emailjs = await import('@emailjs/browser');
  return emailjs;
}

export interface ActivationEmailParams {
  toEmail: string;
  toName: string;
  companyName: string;
  planBilling: 'monthly' | 'quarterly' | 'yearly';
  planPrice: number;
  activatedDate: string;
  expiryDate: string;
  supportEmail: string;
  platformUrl: string;
  note?: string;
}

export interface RejectionEmailParams {
  toEmail: string;
  toName: string;
  companyName: string;
  reason?: string;
  supportEmail: string;
}

const BILLING_LABELS: Record<string, string> = {
  monthly:   'Mensuel (1 mois)',
  quarterly: 'Trimestriel (3 mois)',
  yearly:    'Annuel (12 mois)',
};

export async function sendActivationEmail(params: ActivationEmailParams): Promise<boolean> {
  try {
    const emailjs = await getEmailJS();
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      TEMPLATE_ACTIVATION,
      {
        to_email:       params.toEmail,
        to_name:        params.toName,
        company_name:   params.companyName,
        plan_billing:   BILLING_LABELS[params.planBilling] || params.planBilling,
        plan_price:     params.planPrice.toLocaleString('fr-FR') + ' FDJ',
        activated_date: params.activatedDate,
        expiry_date:    params.expiryDate,
        next_payment:   params.expiryDate,
        support_email:  params.supportEmail,
        platform_url:   params.platformUrl,
        note:           params.note || '',
      },
      EMAILJS_PUBLIC_KEY
    );
    console.log('✅ Email activation envoyé à', params.toEmail);
    return true;
  } catch (err) {
    console.error('❌ Erreur envoi email activation:', err);
    return false;
  }
}

export async function sendRejectionEmail(params: RejectionEmailParams): Promise<boolean> {
  try {
    const emailjs = await getEmailJS();
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      TEMPLATE_REJECTION,
      {
        to_email:      params.toEmail,
        to_name:       params.toName,
        company_name:  params.companyName,
        reason:        params.reason || 'Paiement non confirmé',
        support_email: params.supportEmail,
      },
      EMAILJS_PUBLIC_KEY
    );
    console.log('✅ Email rejet envoyé à', params.toEmail);
    return true;
  } catch (err) {
    console.error('❌ Erreur envoi email rejet:', err);
    return false;
  }
}

export function computeExpiryDate(billing: string, fromDate = new Date()): Date {
  const d = new Date(fromDate);
  if (billing === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (billing === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}