'use client';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import AdminPanel from '@/components/AdminPanel';
import CandidatePanel from '@/components/CandidatePanel';
import RecruiterPanel from '@/components/RecruiterPanel';

const translations = {
  FR: {},
  EN: {},
  AR: {}
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'site' | 'admin' | 'candidate' | 'recruiter'>('site');
  const [lang, setLang] = useState<'FR' | 'EN' | 'AR'>('FR');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  const t = translations[lang];

  if (view === 'admin') return <AdminPanel onBack={() => setView('site')} lang={lang} setLang={setLang} t={t} />;
  if (view === 'candidate') return <CandidatePanel onBack={() => setView('site')} lang={lang} setLang={setLang} t={t} />;
  if (view === 'recruiter') return <RecruiterPanel onBack={() => setView('site')} lang={lang} setLang={setLang} t={t} />;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0F172A] text-white">
      <h1 className="text-4xl font-bold mb-8">Vedior GM</h1>
      <div className="flex gap-4">
        <button onClick={() => setView('admin')} className="bg-orange-600 px-6 py-3 rounded-xl font-bold">Admin</button>
        <button onClick={() => setView('candidate')} className="bg-blue-600 px-6 py-3 rounded-xl font-bold">Candidat</button>
        <button onClick={() => setView('recruiter')} className="bg-green-600 px-6 py-3 rounded-xl font-bold">Recruteur</button>
      </div>
      {user && (
        <div className="mt-8 text-center">
          <p className="mb-2">Connecté en tant que {user.email}</p>
          <button onClick={() => signOut(auth)} className="text-sm underline">Se déconnecter</button>
        </div>
      )}
    </main>
  );
}