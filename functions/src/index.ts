import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Cloud Function : createUser
 * 1. Crée le compte Firebase Auth
 * 2. Crée le profil Firestore selon le rôle
 * 3. Envoie un email "Définir votre mot de passe" à l'utilisateur
 */
export const createUser = onCall(async (request) => {
  // 1. Vérifier que l'appelant est connecté
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vous devez être connecté.");
  }

  // 2. Vérifier que l'appelant est bien admin
  const callerDoc = await admin.firestore().doc(`admins/${request.auth.uid}`).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "Accès réservé aux administrateurs.");
  }

  const data = request.data;
  const {
    email, displayName, role, phone, createdBy,
    adminLevel,
    companyName, contactName, rcNumber, website, sector,
    fullName, whatsapp, nationality, education, experience,
    availability, gender, candidateSector, address, languages,
  } = data;

  if (!email || !role) {
    throw new HttpsError("invalid-argument", "Email et rôle sont obligatoires.");
  }

  // 3. Créer le compte Firebase Auth avec mot de passe aléatoire
  const tempPassword = Math.random().toString(36).slice(-10) + "Aa1!";

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName: displayName || email,
    });
  } catch (err: any) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Un compte avec cet email existe déjà.");
    }
    throw new HttpsError("internal", `Erreur Auth : ${err.message}`);
  }

  const uid = userRecord.uid;
  const db = admin.firestore();

  const base = {
    uid,
    email,
    displayName: displayName || email,
    role,
    phone: phone || "",
    status: "active",
    createdBy: createdBy || "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // 4. Créer le profil Firestore selon le rôle
  if (role === "admin") {
    await db.doc(`admins/${uid}`).set({ ...base, adminLevel: adminLevel || "admin" });
  } else if (role === "recruiter") {
    await db.collection("recruiters").doc(uid).set({
      ...base,
      companyName: companyName || "",
      contactName: contactName || "",
      rcNumber: rcNumber || "",
      website: website || "",
      sector: sector || "btp",
    });
  } else {
    await db.collection("candidates").doc(uid).set({
      ...base,
      fullName: fullName || displayName || "",
      whatsapp: whatsapp || "",
      nationality: nationality || "",
      education: education || "",
      experience: experience || "",
      availability: availability || "immediate",
      gender: gender || "M",
      sector: candidateSector || "btp",
      address: address || "",
      languages: languages || "",
    });
  }

  // 5. Entrée unifiée dans "users"
  await db.collection("users").doc(uid).set({
    ...base,
    ...(role === "admin"     && { adminLevel: adminLevel || "admin" }),
    ...(role === "recruiter" && { companyName, contactName, sector }),
    ...(role === "candidate" && { fullName, sector: candidateSector }),
  });

  // 6. Envoyer l'email "Définir votre mot de passe"
  try {
    await admin.auth().generatePasswordResetLink(email, {
      url: "https://vediorgm.firebaseapp.com",
      handleCodeInApp: false,
    });
  } catch (emailErr: any) {
    console.error(`Erreur envoi email à ${email}:`, emailErr.message);
  }

  return { uid, success: true, message: `Compte créé. Email envoyé à ${email}.` };
});


/**
 * Cloud Function : sendPasswordResetEmail
 * Permet à l'admin de renvoyer un email de réinitialisation à tout moment.
 */
export const sendPasswordResetEmail = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Non autorisé.");
  }

  const callerDoc = await admin.firestore().doc(`admins/${request.auth.uid}`).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "Accès réservé aux administrateurs.");
  }

  const { email } = request.data;
  if (!email) throw new HttpsError("invalid-argument", "Email manquant.");

  try {
    await admin.auth().generatePasswordResetLink(email, {
      url: "https://vediorgm.firebaseapp.com",
      handleCodeInApp: false,
    });
    return { success: true, message: `Email envoyé à ${email}` };
  } catch (err: any) {
    throw new HttpsError("internal", `Erreur : ${err.message}`);
  }
});