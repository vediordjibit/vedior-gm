import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCjb-2sd5jgoUt7U-E3lWTQnuuX7xO0GPs",
  authDomain: "vediorgm.firebaseapp.com",
  projectId: "vediorgm",
  storageBucket: "vediorgm.firebasestorage.app",
  messagingSenderId: "790538302349",
  appId: "1:790538302349:web:a01881c1f0a155abd0c3c4",
  measurementId: "G-PG14QW7893"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const getAnalyticsInstance = async () => {
  if (typeof window !== "undefined") {
    const { getAnalytics } = await import("firebase/analytics");
    return getAnalytics(app);
  }
  return null;
};