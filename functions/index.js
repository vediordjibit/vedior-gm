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
 *
 * Déploiement :
 *   cd functions && npm install
 *   firebase deploy --only functions,firestore:rules
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const { Resend } = require("resend");
admin.initializeApp();
const db = admin.firestore();

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
exports.syncRecruiterLimits = functions
  .region("europe-west1")
  .firestore.document("recruiters/{recruiterId}")
  .onWrite(async (change, context) => {
    const data = change.after.exists ? change.after.data() : null;
    if (!data) return null; // suppression du recruteur : on laisse le miroir tel quel

    const uid = await resolveUid(data);
    if (!uid) {
      console.warn(`syncRecruiterLimits: uid introuvable pour recruteur ${context.params.recruiterId}`);
      return null;
    }
    await rebuildRecruiterLimits(uid, context.params.recruiterId);
    return null;
  });

// ─────────────────────────────────────────────────────────────
// 3) Synchro du compteur d'offres actives quand une offre est créée,
//    modifiée (changement de statut) ou supprimée.
// ─────────────────────────────────────────────────────────────
exports.syncActiveJobsCount = functions
  .region("europe-west1")
  .firestore.document("needs/{needId}")
  .onWrite(async (change) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const uid = (after && after.userId) || (before && before.userId);
    if (!uid) return null;

    await rebuildRecruiterLimits(uid, null);
    return null;
  });

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

// Génère le buffer PDF de la facture à partir des données stockées dans
// invoices/{id}. Régénérable à l'identique à tout moment (pas de fichier
// persistant sur Storage — tout repart des données Firestore).
function renderInvoicePdfBuffer(inv) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const c = inv.companySnapshot || {};

    // ── En-tête société ──
    doc.fontSize(20).fillColor("#0A192F").font("Helvetica-Bold").text(c.legalName || c.name || "Vedior GM");
    doc.fontSize(9).fillColor("#64748B").font("Helvetica")
      .text(c.address || "")
      .text([c.phone, c.email].filter(Boolean).join(" · "))
      .text([c.rccm, c.nif].filter(Boolean).join("  ·  "));

    doc.moveDown(1.5);
    doc.fontSize(18).fillColor("#0A192F").font("Helvetica-Bold").text("FACTURE", { align: "right" });
    doc.fontSize(10).fillColor("#64748B").font("Helvetica")
      .text(inv.invoiceNumber, { align: "right" })
      .text(`Date d'émission : ${inv.issueDate}`, { align: "right" });
    if (inv.periodEnd) doc.text(`Échéance abonnement : ${inv.periodEnd}`, { align: "right" });

    doc.moveDown(1.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#E2E8F0").stroke();
    doc.moveDown(1);

    // ── Facturé à ──
    doc.fontSize(9).fillColor("#94A3B8").font("Helvetica-Bold").text("FACTURÉ À");
    doc.fontSize(11).fillColor("#0A192F").font("Helvetica-Bold").text(inv.companyNameClient || inv.recruiterName || "Client");
    doc.fontSize(9).fillColor("#64748B").font("Helvetica").text(inv.recruiterEmail || "");

    doc.moveDown(2);

    // ── Tableau ligne unique ──
    const tableTop = doc.y;
    doc.fontSize(9).fillColor("#94A3B8").font("Helvetica-Bold");
    doc.text("DESCRIPTION", 50, tableTop);
    doc.text("MONTANT", 450, tableTop, { width: 95, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#E2E8F0").stroke();

    const rowY = tableTop + 25;
    doc.fontSize(10).fillColor("#0A192F").font("Helvetica").text(BILLING_LABEL[inv.billing] || "Abonnement Pro", 50, rowY, { width: 380 });
    doc.font("Helvetica-Bold").text(`${Number(inv.amount).toLocaleString("fr-FR")} FDJ`, 450, rowY, { width: 95, align: "right" });

    doc.moveTo(50, rowY + 25).lineTo(545, rowY + 25).strokeColor("#E2E8F0").stroke();

    // ── Total ──
    const totalY = rowY + 40;
    doc.fontSize(11).fillColor("#0A192F").font("Helvetica-Bold").text("TOTAL", 350, totalY, { width: 100, align: "right" });
    doc.fontSize(14).fillColor("#00A3E0").text(`${Number(inv.amount).toLocaleString("fr-FR")} FDJ`, 450, totalY - 2, { width: 95, align: "right" });

    // ── Pied de page ──
    doc.fontSize(8).fillColor("#94A3B8").font("Helvetica")
      .text("Merci de votre confiance.", 50, 720, { align: "center", width: 495 })
      .text(c.website || "", 50, 733, { align: "center", width: 495 });

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
exports.onPaymentConfirmed = functions
  .region("europe-west1")
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .firestore.document("payments/{paymentId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    if (!after || after.status !== "confirmed") return null;
    if (before && before.status === "confirmed") return null; // déjà facturé, pas de doublon

    try {
      await createInvoiceForPayment(context.params.paymentId, { sendEmail: true });
    } catch (err) {
      console.error("onPaymentConfirmed: génération facture échouée:", err);
    }
    return null;
  });

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
