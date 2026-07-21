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
                <label style={styles.label}>Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  placeholder="••••••••"
                  disabled={status === 'submitting'}
                />
                <button
                  type="submit"
                  style={styles.submitButton}
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'En cours...' : 'Mettre à jour'}
                </button>
              </form>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 style={styles.title}>Mot de passe mis à jour ✅</h1>
              <p style={styles.text}>Votre mot de passe a été changé avec succès.</p>
              <a href="/candidate" style={styles.button}>Accéder à mon espace →</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F0F2F8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.10)',
    overflow: 'hidden',
  },
  header: {
    padding: '40px 32px 24px',
    backgroundColor: '#0A192F',
    color: 'white',
    textAlign: 'center',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 900,
    letterSpacing: '2px',
    color: '#f97316',
  },
  tagline: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '3px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '6px',
  },
  accentBar: {
    width: '60px',
    height: '4px',
    backgroundColor: '#f97316',
    margin: '16px auto 0',
    borderRadius: '2px',
  },
  body: {
    padding: '32px 32px 40px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 900,
    color: '#0A192F',
    margin: '0 0 12px',
  },
  text: {
    fontSize: '14px',
    color: '#4a5568',
    lineHeight: '1.6',
    margin: '0 0 8px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#4a5568',
    marginBottom: '6px',
    marginTop: '16px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    marginTop: '24px',
    backgroundColor: '#f97316',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  button: {
    display: 'inline-block',
    padding: '12px 24px',
    marginTop: '16px',
    backgroundColor: '#0A192F',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '14px',
    textAlign: 'center',
    border: 'none',
    cursor: 'pointer',
  },
};