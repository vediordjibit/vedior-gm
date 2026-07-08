/**
 * useCompanyInfo.ts
 * Hook React pour lire les infos de la société depuis Firestore (settings_company/info)
 * 
 * Usage :
 *   const { company, loading } = useCompanyInfo(db);
 *   // company.phone, company.email, company.whatsapp, company.address, etc.
 */

import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export interface CompanyInfo {
  name: string;           // "Vedior GM"
  legalName: string;      // "Vedior GM SARL"
  tagline: string;        // "Plateforme de recrutement à Djibouti"
  phone: string;          // "+253 21 35 XX XX"
  whatsapp: string;       // "+253 77 XX XX XX" (numéro WhatsApp flottant)
  email: string;          // "contact@vedior-gm.dj"
  supportEmail: string;   // "support@vedior-gm.dj"
  address: string;        // "Djibouti Ville, République de Djibouti"
  website: string;        // "https://vediorgm.web.app"
  copyright: string;      // "© 2026 VEDIOR GM"
  foundedYear: string;    // "2024"
  // Réseaux sociaux
  linkedinUrl: string;
  facebookUrl: string;
  twitterUrl: string;
  instagramUrl: string;
}

export const DEFAULT_COMPANY: CompanyInfo = {
  name: 'Vedior GM',
  legalName: 'Vedior GM SARL',
  tagline: 'Plateforme de recrutement à Djibouti',
  phone: '+253 21 35 XX XX',
  whatsapp: '+253 77 XX XX XX',
  email: 'contact@vedior-gm.dj',
  supportEmail: 'support@vedior-gm.dj',
  address: 'Djibouti Ville, République de Djibouti',
  website: 'https://vediorgm.web.app',
  copyright: '© 2026 VEDIOR GM',
  foundedYear: '2024',
  linkedinUrl: '',
  facebookUrl: '',
  twitterUrl: '',
  instagramUrl: '',
};

/**
 * Hook lecture seule — pour les composants qui affichent les infos
 * Utilise onSnapshot pour mises à jour en temps réel
 */
export function useCompanyInfo(db: any) {
  const [company, setCompany] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    if (!db) return;
    const ref = doc(db, 'settings_company', 'info');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setCompany({ ...DEFAULT_COMPANY, ...snap.data() as CompanyInfo });
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [db]);

  return { company, loading };
}

/**
 * Lecture ponctuelle (getDoc) — pour les composants qui n'ont pas besoin de temps réel
 */
export async function fetchCompanyInfo(db: any): Promise<CompanyInfo> {
  try {
    const snap = await getDoc(doc(db, 'settings_company', 'info'));
    if (snap.exists()) return { ...DEFAULT_COMPANY, ...snap.data() as CompanyInfo };
  } catch {}
  return DEFAULT_COMPANY;
}
