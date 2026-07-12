import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialise Firebase Admin une seule fois (évite les doubles inits en dev/hot-reload)
if (!getApps().length) {
  const raw = process.env.ADMIN_SDK_KEY;

  if (!raw) {
    console.warn(
      '[firebaseAdmin] ADMIN_SDK_KEY manquant — generatePasswordResetLink() ne fonctionnera pas. ' +
      'Ajoutez le secret dans Firebase App Hosting ou dans .env.local pour le développement.'
    );
  } else {
    try {
      const serviceAccount = JSON.parse(raw);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (e) {
      console.error('[firebaseAdmin] Erreur parsing ADMIN_SDK_KEY:', e);
    }
  }
}

// Export sécurisé — null si Admin SDK non initialisé
export const adminAuth = getApps().length ? getAuth() : null;