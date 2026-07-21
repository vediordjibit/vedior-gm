'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getAuth,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';

type Status = 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'verify-success' | 'verify-error';

export default function AuthActionPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!oobCode || !mode) {
      setStatus('error');
      setErrorMsg("Lien invalide ou incomplet.");
      return;
    }

    if (mode === 'resetPassword') {
      verifyPasswordResetCode(auth, oobCode)
        .then((userEmail) => {
          setEmail(userEmail);
          setStatus('ready');
        })
        .catch(() => {
          setStatus('error');
          setErrorMsg("Ce lien a expiré ou a déjà été utilisé. Redemandez une réinitialisation.");
        });
    } else if (mode === 'verifyEmail') {
      applyActionCode(auth, oobCode)
        .then(() => setStatus('verify-success'))
        .catch(() => {
          setStatus('verify-error');
          setErrorMsg("Ce lien a expiré ou a déjà été utilisé.");
        });
    } else {
      setStatus('error');
      setErrorMsg("Type d'action non reconnu.");
    }
  }, [mode, oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, oobCode as string, password);
      setStatus('success');
    } catch (err: any) {
      setStatus('ready');
      setErrorMsg(
        err.code === 'auth/expired-action-code'
          ? "Ce lien a expiré. Redemandez une réinitialisation."
          : err.code === 'auth/weak-password'
          ? 'Mot de passe trop faible (min. 6 caractères).'
          : "Une erreur est survenue. Réessayez."
      );
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>VEDIOR GM</div>
          <div style={styles.tagline}>RECRUTEMENT · DJIBOUTI</div>
          <div style={styles.accentBar} />
        </div>

        <div style={styles.body}>
          {status === 'loading' && (
            <p style={styles.text}>Vérification du lien en cours...</p>
          )}

          {status === 'error' && (
            <>
              <h1 style={styles.title}>Lien invalide</h1>
              <p style={styles.text}>{errorMsg}</p>
              <a href="/login" style={styles.button}>Retour à la connexion</a>
            </>
          )}

          {status === 'verify-success' && (
            <>
              <h1 style={styles.title}>Email vérifié ✅</h1>
              <p style={styles.text}>Votre adresse email a été confirmée avec succès.</p>
              <a href="/candidate" style={styles.button}>Accéder à mon espace →</a>
            </>
          )}

          {status === 'verify-error' && (
            <>
              <h1 style={styles.title}>Lien invalide</h1>
              <p style={styles.text}>{errorMsg}</p>
              <a href="/candidate" style={styles.button}>Accéder à mon espace</a>
            </>
          )}

          {(status === 'ready' || status === 'submitting') && (
            <>
              <h1 style={styles.title}>Nouveau mot de passe</h1>
              <p style={styles.text}>
                Pour <strong style={{ color: '#0A192F' }}>{email}</strong>
              </p>
              <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
                <label style={styles.label}>Nouveau mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  placeholder="••••••••"
                  disabled={status === 'submitting'}
                  autoFocus
                />
                <label style={styles.label}>Confirm