/**
 * Cloud Functions — Vedior GM
 *
 * 1) expireSubscriptions   : cron quotidien, repasse en 'expired' tout abonnement
 *                             Pro dont planExpiry est dépassé.
 * 2) syncRecruiterLimits   : à chaque écriture sur recruiters/{id}, met à jour le
 *                             doc miroir recruiterLimits/{uid} utilisé par les
 *                             règles Firestore pour bloquer la création d'offres
 *                             au-delà de la limite du plan.
 * 3) syncActiveJobsCount   : à chaque écriture sur needs/{id}, recompte les offres
 *                             actives du recruteur concerné et met à jour le miroir.
 * 4) onPaymentConfirmed    : trigger auto — dès qu'un `payments/{id}` passe à
 *                             status='confirmed', génère la facture PDF + l'envoie
 *                             par email (pièce jointe) via Resend.
 * 5) downloadInvoice       : callable — génère (ou régénère) le PDF d'une facture
 *                             à la demande et le renvoie en base64 au client.
 * 6) requestPasswordReset  : callable PUBLIQUE — génère un lien de reset via
 *                             Admin SDK et l'envoie via Resend (remplace l'email
 *                             natif Firebase). Anti-énumération + rate-limit.
 * 7) sendVerificationEmail : callable authentifiée — génère un lien de
 *                             vérification d'email via Admin SDK et l'envoie
 *                             via Resend (remplace sendEmailVerification natif).
 *
 * Déploiement :
 *   cd functions && npm install
 *   firebase deploy --only functions,firestore:rules
 */

const functions = require("firebase-functions/v1");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const { Resend } = require("resend");
admin.initializeApp();
const db = admin.firestore();

// Logo bundlé avec la fonction (functions/assets/logo.png). Chargé une seule
// fois au cold start ; si le fichier est absent, le nom légal sera affiché
// en texte à la place (voir renderInvoicePdfBuffer).
const path = require("path");
const fs = require("fs");
let LOGO_BUFFER = null;
try {
  LOGO_BUFFER = fs.readFileSync(path.join(__dirname, "assets", "logo.png"));
} catch (e) {
  console.warn("Logo introuvable (functions/assets/logo.png) — la facture utilisera le texte à la place.");
}

const STATUSES_NOT_ACTIVE = ["archived", "expired", "draft"];

// ─────────────────────────────────────────────────────────────
// Utilitaire : (re)construit le doc recruiterLimits/{uid} à partir
// du recruteur (plan/planStatus/planExpiry), de settings_pricing/config
// (freeJobsLimit/proJobsLimit) et d'un recomptage des offres actives.
// ─────────────────────────────────────────────────────────────
async function rebuildRecruiterLimits(uid, recruiterId) {
  if (!uid) return;

  const [recSnap, pricingSnap, needsSnap] = await Promise.all([
    recruiterId
      ? db.collection("recruiters").doc(recruiterId).get()
      : db.collection("recruiters").where("uid", "==", uid).limit(1).get()
          .then((s) => (s.empty ? null : s.docs[0])),
    db.collection("settings_pricing").doc("config").get(),
    db.collection("needs").where("userId", "==", uid).get(),
  ]);

  const rec = recSnap && recSnap.exists !== undefined
    ? recSnap
    : (recSnap && recSnap.docs ? recSnap.docs[0] : recSnap);

  const recData = rec && rec.exists ? rec.data() : {};
  const pricing = pricingSnap.exists ? pricingSnap.data() : {};

  const activeJobsCount = needsSnap.docs.filter(
    (d) => !STATUSES_NOT_ACTIVE.includes(d.data().status)
  ).length;

  // Compteur mensuel : nb de demandes (needs) CRÉÉES dans le mois calendaire en
  // cours, indépendamment de leur statut actuel (contrairement à activeJobsCount).
  // Sert à plafonner "freeRequestsLimit" (ex: 1 demande/mois pour le Free), une
  // limite distincte du nombre d'offres actives simultanées (freeJobsLimit).
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const requestsThisMonth = needsSnap.docs.filter((d) => {
    const created = d.data().createdAt;
    if (!created || typeof created.toDate !== "function") return false;
    const cd = created.toDate();
    const cKey = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, "0")}`;
    return cKey === monthKey;
  }).length;

  await db.collection("recruiterLimits").doc(uid).set(
    {
      plan: recData.plan || "free",
      planStatus: recData.planStatus || "free",
      planExpiry: recData.planExpiry || null,
      freeJobsLimit: pricing.freeJobsLimit ?? 1,
      proJobsLimit: pricing.proJobsLimit ?? -1,
      freeApplicationsLimit: pricing.freeApplicationsLimit ?? 5,
      freeRequestsLimit: pricing.freeRequestsLimit ?? 1,
      activeJobsCount,
      requestsThisMonth,
      requestsMonthKey: monthKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// Résout le uid d'un recruteur : champ direct (uid, ou userId — présent même
// pour les recruteurs créés par l'admin via addDoc, contrairement à `uid`),
// ou en dernier recours lookup Auth par email.
async function resolveUid(recruiterData) {
  if (recruiterData.uid) return recruiterData.uid;
  if (recruiterData.userId) return recruiterData.userId;
  if (recruiterData.email) {
    try {
      const user = await admin.auth().getUserByEmail(recruiterData.email);
      return user.uid;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 1) Expiration automatique — cron quotidien à 01h00 (heure de Djibouti, UTC+3)
// ─────────────────────────────────────────────────────────────
exports.expireSubscriptions = functions
  .region("europe-west1")
  .pubsub.schedule("0 1 * * *")
  .timeZone("Africa/Djibouti")
  .onRun(async () => {
    const today = new Date().toISOString().split("T")[0];

    const snap = await db
      .collection("recruiters")
      .where("planStatus", "==", "active")
      .where("plan", "==", "pro")
      .get();

    const expired = snap.docs.filter((d) => {
      const exp = d.data().planExpiry;
      return exp && exp < today;
    });

    if (expired.length === 0) {
      console.log("expireSubscriptions: aucun abonnement à expirer.");
      return null;
    }

    const batch = db.batch();
    expired.forEach((d) => {
      batch.update(d.ref, {
        plan: "free",
        planStatus: "expired",
        planNote: "Expiration automatique (Cloud Function)",
        planUpdatedAt: new Date().toISOString(),
      });
    });
    await batch.commit();

    console.log(`expireSubscriptions: ${expired.length} abonnement(s) expiré(s).`);
    return null;
  });

// ─────────────────────────────────────────────────────────────
// 2) Synchro du miroir recruiterLimits quand un recruteur change
//    (activation, révocation, changement de plan, etc.)
// ─────────────────────────────────────────────────────────────
exports.syncRecruiterLimits = onDocumentWritten(
  { document: "recruiters/{recruiterId}", region: "europe-west1" },
  async (event) => {
    const change = event.data;
    const data = change.after.exists ? change.after.data() : null;
    if (!data) return null; // suppression du recruteur : on laisse le miroir tel quel

    const uid = await resolveUid(data);
    if (!uid) {
      console.warn(`syncRecruiterLimits: uid introuvable pour recruteur ${event.params.recruiterId}`);
      return null;
    }
    await rebuildRecruiterLimits(uid, event.params.recruiterId);
    return null;
  }
);

// ─────────────────────────────────────────────────────────────
// 3) Synchro du compteur d'offres actives quand une offre est créée,
//    modifiée (changement de statut) ou supprimée.
// ─────────────────────────────────────────────────────────────
exports.syncActiveJobsCount = onDocumentWritten(
  { document: "needs/{needId}", region: "europe-west1" },
  async (event) => {
    const change = event.data;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const uid = (after && after.userId) || (before && before.userId);
    if (!uid) return null;

    await rebuildRecruiterLimits(uid, null);
    return null;
  }
);

// ─────────────────────────────────────────────────────────────
// 4) Backfill manuel (à lancer une fois après le déploiement, ou via
//    l'émulateur / un script), pour initialiser recruiterLimits pour
//    tous les recruteurs déjà existants. Callable, réservé à un admin.
// ─────────────────────────────────────────────────────────────
exports.backfillRecruiterLimits = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Connexion requise.");
    }
    const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError("permission-denied", "Réservé aux admins.");
    }

    const recruiters = await db.collection("recruiters").get();
    let count = 0;
    for (const rec of recruiters.docs) {
      const uid = await resolveUid(rec.data());
      if (uid) {
        await rebuildRecruiterLimits(uid, rec.id);
        count++;
      }
    }
    return { synced: count, total: recruiters.size };
  });

// ═════════════════════════════════════════════════════════════
// FACTURATION — génération de factures PDF pour les paiements
// confirmés (activation/renouvellement Pro).
// ═════════════════════════════════════════════════════════════

const BILLING_LABEL = { monthly: "Abonnement mensuel", quarterly: "Abonnement trimestriel", yearly: "Abonnement annuel" };

// Attribue le prochain numéro séquentiel pour l'année donnée, via une
// transaction sur invoiceCounters/{year} (jamais deux factures avec le
// même numéro, même en cas d'appels concurrents).
async function getNextInvoiceNumber(year) {
  const counterRef = db.collection("invoiceCounters").doc(String(year));
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const last = snap.exists ? snap.data().lastNumber || 0 : 0;
    const next = last + 1;
    tx.set(counterRef, { lastNumber: next, year }, { merge: true });
    return next;
  });
  return `FACT-${year}-${String(seq).padStart(4, "0")}`;
}

// Formate un montant en FDJ avec un espace normal comme séparateur de
// milliers (toLocaleString('fr-FR') utilise un espace insécable étroit
// que la police Helvetica de PDFKit n'affiche pas correctement).
function fmtAmount(n) {
  const s = Math.round(Number(n) || 0).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Génère le buffer PDF de la facture à partir des données stockées dans
// invoices/{id}. Régénérable à l'identique à tout moment (pas de fichier
// persistant sur Storage — tout repart des données Firestore).
function renderInvoicePdfBuffer(inv) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const c = inv.companySnapshot || {};
    const NAVY = "#0A192F";
    const BLUE = "#00A3E0";
    const GRAY = "#64748B";
    const LIGHT = "#94A3B8";
    const BORDER = "#E2E8F0";
    const BG = "#F8FAFC";
    const PAGE_W = 595.28;
    const ML = 50;
    const MR = 545;

    // ── Bandeau supérieur ──
    doc.rect(0, 0, PAGE_W, 8).fill(BLUE);

    let cursorY = 45;

    // ── Logo (fichier bundlé : functions/assets/logo.png) ──
    let logoBottomY = cursorY;
    if (LOGO_BUFFER) {
      try {
        doc.image(LOGO_BUFFER, ML, cursorY, { fit: [150, 55] });
        logoBottomY = cursorY + 58;
      } catch (e) {
        doc.fontSize(19).fillColor(NAVY).font("Helvetica-Bold").text(c.legalName || c.name || "Vedior GM", ML, cursorY, { width: 260 });
        logoBottomY = doc.y + 4;
      }
    } else {
      doc.fontSize(19).fillColor(NAVY).font("Helvetica-Bold").text(c.legalName || c.name || "Vedior GM", ML, cursorY, { width: 260 });
      logoBottomY = doc.y + 4;
    }

    // ── En-tête société ──
    doc.fontSize(10).fillColor(NAVY).font("Helvetica-Bold")
      .text(c.legalName || c.name || "Vedior GM SARL", ML, logoBottomY, { width: 260 });
    doc.fontSize(9).fillColor(GRAY).font("Helvetica")
      .text(c.address || "", ML, doc.y + 3, { width: 260 })
      .text([c.phone, c.email].filter(Boolean).join("  ·  "), ML, doc.y + 2, { width: 260 });
    if (c.rccm || c.nif) {
      doc.fontSize(8).fillColor(LIGHT)
        .text([c.rccm ? `RCCM ${c.rccm}` : "", c.nif ? `NIF ${c.nif}` : ""].filter(Boolean).join("   ·   "), ML, doc.y + 2, { width: 260 });
    }

    // ── Bloc FACTURE (droite) ──
    doc.fontSize(24).fillColor(NAVY).font("Helvetica-Bold")
      .text("FACTURE", ML, cursorY, { width: MR - ML, align: "right" });
    doc.fontSize(10).fillColor(BLUE).font("Helvetica-Bold")
      .text(inv.invoiceNumber, ML, doc.y + 4, { width: MR - ML, align: "right" });
    doc.fontSize(9).fillColor(GRAY).font("Helvetica")
      .text(`Date d'émission : ${inv.issueDate}`, ML, doc.y + 6, { width: MR - ML, align: "right" });
    if (inv.periodEnd) {
      doc.text(`Échéance abonnement : ${inv.periodEnd}`, ML, doc.y + 2, { width: MR - ML, align: "right" });
    }

    // ── Statut payé ──
    const badgeY = doc.y + 10;
    const badgeText = "PAYÉE";
    doc.fontSize(9).font("Helvetica-Bold");
    const badgeW = doc.widthOfString(badgeText) + 20;
    doc.roundedRect(MR - badgeW, badgeY, badgeW, 20, 10).fill("#E7F8EF");
    doc.fillColor("#0F9D58").text(badgeText, MR - badgeW, badgeY + 5, { width: badgeW, align: "center" });

    cursorY = Math.max(cursorY + 130, badgeY + 40);

    // ── Séparateur ──
    doc.moveTo(ML, cursorY).lineTo(MR, cursorY).strokeColor(BORDER).lineWidth(1).stroke();
    cursorY += 25;

    // ── Facturé à ──
    doc.fontSize(8).fillColor(LIGHT).font("Helvetica-Bold").text("FACTURÉ À", ML, cursorY, { characterSpacing: 0.5 });
    doc.fontSize(12).fillColor(NAVY).font("Helvetica-Bold")
      .text(inv.companyNameClient || inv.recruiterName || "Client", ML, doc.y + 4);
    doc.fontSize(9).fillColor(GRAY).font("Helvetica").text(inv.recruiterEmail || "", ML, doc.y + 2);

    cursorY = doc.y + 30;

    // ── Tableau ──
    const tableTop = cursorY;
    doc.rect(ML, tableTop, MR - ML, 26).fill(NAVY);
    doc.fontSize(9).fillColor("#FFFFFF").font("Helvetica-Bold");
    doc.text("DESCRIPTION", ML + 15, tableTop + 8);
    doc.text("MONTANT", ML, tableTop + 8, { width: MR - ML - 15, align: "right" });

    const rowY = tableTop + 26;
    const rowH = 40;
    doc.rect(ML, rowY, MR - ML, rowH).fill(BG);
    doc.fontSize(10).fillColor(NAVY).font("Helvetica")
      .text(BILLING_LABEL[inv.billing] || "Abonnement Pro", ML + 15, rowY + 14, { width: 320 });
    doc.font("Helvetica-Bold").fontSize(11)
      .text(`${fmtAmount(inv.amount)} FDJ`, ML, rowY + 13, { width: MR - ML - 15, align: "right" });

    doc.rect(ML, tableTop, MR - ML, rowY + rowH - tableTop).strokeColor(BORDER).lineWidth(1).stroke();

    // ── Total ──
    const totalY = rowY + rowH + 20;
    doc.moveTo(ML + 280, totalY).lineTo(MR, totalY).strokeColor(BORDER).stroke();
    doc.fontSize(11).fillColor(GRAY).font("Helvetica-Bold")
      .text("TOTAL PAYÉ", ML + 280, totalY + 12, { width: 120 });
    doc.fontSize(18).fillColor(BLUE).font("Helvetica-Bold")
      .text(`${fmtAmount(inv.amount)} FDJ`, ML, totalY + 10, { width: MR - ML - 15, align: "right" });

    // ── Pied de page ──
    doc.moveTo(ML, 740).lineTo(MR, 740).strokeColor(BORDER).stroke();
    doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold")
      .text("Merci de votre confiance.", ML, 752, { align: "center", width: MR - ML });
    doc.fontSize(8).fillColor(LIGHT).font("Helvetica")
      .text([c.website, c.email].filter(Boolean).join("   ·   "), ML, 767, { align: "center", width: MR - ML });

    doc.end();
  });
}

// Crée (ou renvoie, si déjà générée) la facture Firestore associée à un
// paiement confirmé. sendEmail=true déclenche l'envoi automatique par
// Resend (utilisé uniquement par le trigger onPaymentConfirmed).
async function createInvoiceForPayment(paymentId, { sendEmail } = { sendEmail: false }) {
  // Déjà générée ? On ne duplique jamais un numéro de facture pour le même paiement.
  const existing = await db.collection("invoices").where("paymentId", "==", paymentId).limit(1).get();
  if (!existing.empty) return existing.docs[0];

  const paySnap = await db.collection("payments").doc(paymentId).get();
  if (!paySnap.exists) throw new Error(`Paiement introuvable: ${paymentId}`);
  const pay = paySnap.data();

  const [recSnap, companySnap] = await Promise.all([
    pay.recruiterId ? db.collection("recruiters").doc(pay.recruiterId).get() : null,
    db.collection("settings_company").doc("info").get(),
  ]);
  const recData = recSnap && recSnap.exists ? recSnap.data() : {};
  const recruiterUid = await resolveUid({ uid: recData.uid, email: recData.email || pay.recruiterEmail });
  const company = companySnap.exists ? companySnap.data() : {};

  const issueDate = new Date().toISOString().split("T")[0];
  const year = new Date().getFullYear();
  const invoiceNumber = await getNextInvoiceNumber(year);

  const invoiceData = {
    invoiceNumber,
    year,
    paymentId,
    recruiterId: pay.recruiterId || null,
    recruiterUid: recruiterUid || null,
    recruiterEmail: pay.recruiterEmail || recData.email || null,
    recruiterName: pay.recruiterName || recData.contactName || null,
    companyNameClient: recData.companyName || pay.recruiterName || "",
    billing: pay.billing || "monthly",
    amount: pay.amount || 0,
    currency: "FDJ",
    issueDate,
    periodEnd: pay.expiryDate || null,
    companySnapshot: {
      name: company.name || "Vedior GM",
      legalName: company.legalName || "Vedior GM SARL",
      address: company.address || "",
      phone: company.phone || "",
      email: company.email || "",
      website: company.website || "",
      rccm: company.rccm || "",
      nif: company.nif || "",
    },
    status: "issued",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("invoices").add(invoiceData);
  const savedSnap = await ref.get();

  if (sendEmail && invoiceData.recruiterEmail) {
    try {
      const buffer = await renderInvoicePdfBuffer(invoiceData);
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Vedior GM <noreply@vediorgm.com>",
        replyTo: "vediordjib.it@gmail.com",
        to: invoiceData.recruiterEmail,
        subject: `Facture ${invoiceNumber} — Vedior GM`,
        html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint votre facture <strong>${invoiceNumber}</strong> pour votre abonnement Vedior GM.</p><p>Merci de votre confiance.</p>`,
        attachments: [{ filename: `${invoiceNumber}.pdf`, content: buffer.toString("base64") }],
      });
    } catch (emailErr) {
      console.error("Invoice email failed:", emailErr);
    }
  }

  return savedSnap;
}

// ─────────────────────────────────────────────────────────────
// 4) Trigger auto — génère + envoie la facture dès qu'un paiement
//    passe au statut 'confirmed' (première confirmation uniquement).
// ─────────────────────────────────────────────────────────────
exports.onPaymentConfirmed = onDocumentWritten(
  { document: "payments/{paymentId}", region: "europe-west1", secrets: ["RESEND_API_KEY"] },
  async (event) => {
    const change = event.data;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    if (!after || after.status !== "confirmed") return null;
    if (before && before.status === "confirmed") return null; // déjà facturé, pas de doublon

    try {
      await createInvoiceForPayment(event.params.paymentId, { sendEmail: true });
    } catch (err) {
      console.error("onPaymentConfirmed: génération facture échouée:", err);
    }
    return null;
  }
);

// ─────────────────────────────────────────────────────────────
// 5) Téléchargement à la demande — génère (si besoin) puis renvoie le
//    PDF en base64. Autorisé : admin, ou le recruteur propriétaire du paiement.
// ─────────────────────────────────────────────────────────────
exports.downloadInvoice = functions
  .region("europe-west1")
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Connexion requise.");
    }
    const { paymentId } = data || {};
    if (!paymentId) {
      throw new functions.https.HttpsError("invalid-argument", "paymentId requis.");
    }

    const paySnap = await db.collection("payments").doc(paymentId).get();
    if (!paySnap.exists) {
      throw new functions.https.HttpsError("not-found", "Paiement introuvable.");
    }
    const pay = paySnap.data();

    const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
    const isAdmin = adminDoc.exists;

    if (!isAdmin) {
      const recSnap = pay.recruiterId ? await db.collection("recruiters").doc(pay.recruiterId).get() : null;
      const recruiterUid = recSnap && recSnap.exists ? await resolveUid(recSnap.data()) : null;
      if (recruiterUid !== context.auth.uid) {
        throw new functions.https.HttpsError("permission-denied", "Cette facture ne vous appartient pas.");
      }
    }

    const invSnap = await createInvoiceForPayment(paymentId, { sendEmail: false });
    const invoiceData = invSnap.data();
    const buffer = await renderInvoicePdfBuffer(invoiceData);

    return {
      invoiceNumber: invoiceData.invoiceNumber,
      filename: `${invoiceData.invoiceNumber}.pdf`,
      pdfBase64: buffer.toString("base64"),
    };
  });

// ─────────────────────────────────────────────────────────────
// Template email — mot de passe oublié / vérification d'email.
// Même charte que les templates de bienvenue (route.ts) : navy #0A192F,
// accent #00A3E0.
// ─────────────────────────────────────────────────────────────
function actionEmailHTML({ title, intro, buttonLabel, actionLink, footerNote }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#0A192F;padding:36px 48px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">VEDIOR GM</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Recrutement · Djibouti</div>
          <div style="width:40px;height:3px;background:#00A3E0;border-radius:2px;margin:16px auto 0;"></div>
        </td></tr>
        <tr><td style="padding:48px;">
          <h1 style="font-size:22px;font-weight:800;color:#0A192F;margin:0 0 16px;letter-spacing:-0.5px;">${title}</h1>
          <p style="font-size:14px;color:#64748B;line-height:1.7;margin:0 0 32px;">${intro}</p>
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${actionLink}" style="display:inline-block;background:#00A3E0;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:800;font-size:14px;letter-spacing:0.5px;">
              ${buttonLabel} →
            </a>
          </div>
          <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">${footerNote}</p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:24px 48px;border-top:1px solid #E2E8F0;">
          <p style="font-size:12px;color:#94A3B8;margin:0;text-align:center;">© 2026 Vedior GM · Recrutement à Djibouti</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────
// Anti-abus simple : max 3 demandes / 15 min par clé (email ou uid).
// Évite le spam sans infra supplémentaire (App Check).
// ─────────────────────────────────────────────────────────────
async function checkRateLimit(key, maxAttempts, windowMs) {
  const ref = db.collection("rateLimits").doc(key);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : { attempts: [] };
    const recent = (data.attempts || []).filter((t) => now - t < windowMs);
    if (recent.length >= maxAttempts) return false;
    recent.push(now);
    tx.set(ref, { attempts: recent, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// 6) Mot de passe oublié — callable PUBLIQUE (pas de context.auth requis,
//    l'utilisateur n'est par définition pas connecté à ce stade). Génère le
//    lien via Admin SDK (ne déclenche PAS l'email natif Firebase) et l'envoie
//    via Resend. Ne révèle JAMAIS si l'email existe ou non (anti-énumération) :
//    retourne toujours { success: true }, sauf en cas de rate-limit.
// ─────────────────────────────────────────────────────────────
exports.requestPasswordReset = functions
  .region("europe-west1")
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .https.onCall(async (data) => {
    const email = (data && data.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new functions.https.HttpsError("invalid-argument", "Email invalide.");
    }

    const ok = await checkRateLimit(`pwreset_${email}`, 3, 15 * 60 * 1000);
    if (!ok) {
      throw new functions.https.HttpsError("resource-exhausted", "Trop de tentatives. Réessayez dans 15 minutes.");
    }

    try {
      const link = await admin.auth().generatePasswordResetLink(email, {
        url: "https://vediorgm.com/login",
        handleCodeInApp: false,
      });
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Vedior GM <noreply@vediorgm.com>",
        replyTo: "vediordjib.it@gmail.com",
        to: email,
        subject: "Réinitialisation de votre mot de passe — Vedior GM",
        html: actionEmailHTML({
          title: "Réinitialisez votre mot de passe",
          intro: "Vous avez demandé à réinitialiser votre mot de passe Vedior GM. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.",
          buttonLabel: "Réinitialiser mon mot de passe",
          actionLink: link,
          footerNote: "Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.",
        }),
      });
    } catch (err) {
      // auth/user-not-found ou autre : on ne le révèle jamais au client.
      console.warn("requestPasswordReset: échec silencieux pour", email, err.code || err.message);
    }

    return { success: true };
  });

// ─────────────────────────────────────────────────────────────
// 7) Vérification d'email — callable AUTHENTIFIÉE (appelée par le candidat
//    juste après son inscription). Génère le lien via Admin SDK et l'envoie
//    via Resend (au lieu de l'email natif Firebase).
// ─────────────────────────────────────────────────────────────
exports.sendVerificationEmail = functions
  .region("europe-west1")
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Connexion requise.");
    }
    const userRecord = await admin.auth().getUser(context.auth.uid);
    if (!userRecord.email) {
      throw new functions.https.HttpsError("failed-precondition", "Aucun email associé à ce compte.");
    }
    if (userRecord.emailVerified) {
      return { success: true, alreadyVerified: true };
    }

    const ok = await checkRateLimit(`verify_${context.auth.uid}`, 3, 15 * 60 * 1000);
    if (!ok) {
      throw new functions.https.HttpsError("resource-exhausted", "Trop de tentatives. Réessayez dans 15 minutes.");
    }

    const link = await admin.auth().generateEmailVerificationLink(userRecord.email, {
      url: "https://vediorgm.com/candidate",
      handleCodeInApp: false,
    });
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Vedior GM <noreply@vediorgm.com>",
      replyTo: "vediordjib.it@gmail.com",
      to: userRecord.email,
      subject: "Vérifiez votre adresse email — Vedior GM",
      html: actionEmailHTML({
        title: "Vérifiez votre adresse email",
        intro: "Bienvenue sur Vedior GM ! Confirmez votre adresse email pour activer pleinement votre compte candidat.",
        buttonLabel: "Vérifier mon email",
        actionLink: link,
        footerNote: "Ce lien est valable 24 heures. Si vous n'avez pas créé ce compte, ignorez cet email.",
      }),
    });

    return { success: true };
  });
