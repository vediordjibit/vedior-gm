import admin from 'firebase-admin';

// Initialise Firebase Admin une seule fois (évite les doubles inits en dev/hot-reload)
if (!admin.apps.length) {
  if (!process.env.ADMIN_SDK_KEY) {
    throw new Error('ADMIN_SDK_KEY manquant dans les variables d\'environnement');
  }

  const serviceAccount = JSON.parse(process.env.ADMIN_SDK_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const adminAuth = admin.auth();
