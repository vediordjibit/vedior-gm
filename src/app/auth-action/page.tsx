'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';

type Status = 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'verify-success' | 'verify-error';

function AuthActionContent() {
  const searchParams = useSearchParams();
  const mode = searchParams?.get('mode') ?? null;
  const oobCode = searchParams?.get('oobCode') ?? null;

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
              <a href="/" style={styles.button}>Retour à la connexion</a>
            </>
          )}

          {status === 'verify-success' && (
            <>
              <h1 style={styles.title}>Email vérifié ✅</h1>
              <p style={styles.text}>Votre adresse email a été confirmée avec succès.</p>
              <a href="/" style={styles.button}>Accéder à mon espace →</a>
            </>
          )}

          {status === 'verify-error' && (
            <>
              <h1 style={styles.title}>Lien invalide</h1>
              <p style={styles.text}>{errorMsg}</p>
              <a href="/" style={styles.button}>Accéder à mon espace</a>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 style={styles.title}>Mot de passe défini ✅</h1>
              <p style={styles.text}>
                Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.
              </p>
              <a href="/" style={styles.button}>Se connecter →</a>
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
                {errorMsg && <p style={styles.error}>{errorMsg}</p>}
                <button
                  type="submit"
                  style={{
                    ...styles.button,
                    opacity: status === 'submitting' ? 0.7 : 1,
                    cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                    border: 'none',
                    width: '100%',
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Enregistrement...' : 'Définir mon mot de passe →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logo}>VEDIOR GM</div>
            <div style={styles.tagline}>RECRUTEMENT · DJIBOUTI</div>
            <div style={styles.accentBar} />
          </div>
          <div style={styles.body}>
            <p style={styles.text}>Chargement...</p>
          </div>
        </div>
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
  },
  card: {
    background: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: 480,
  },
  header: {
    background: '#0A192F',
    padding: '36px 48px',
    textAlign: 'center',
  },
  logo: {
    fontSize: 22,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.5px',
  },
  tagline: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  accentBar: {
    width: 40,
    height: 3,
    background: '#00A3E0',
    borderRadius: 2,
    margin: '16px auto 0',
  },
  body: {
    padding: '40px 48px',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0A192F',
    margin: '0 0 12px',
    letterSpacing: '-0.5px',
  },
  text: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 1.7,
    margin: '0 0 24px',
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    fontSize: 15,
    color: '#0A192F',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#F8FAFC',
  },
  button: {
    display: 'inline-block',
    background: '#00A3E0',
    color: '#ffffff',
    textDecoration: 'none',
    padding: '14px 32px',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: '0.5px',
    marginTop: 24,
  },
  error: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 12,
    padding: '10px 14px',
    background: '#FEF2F2',
    borderRadius: 8,
    border: '1px solid #FECACA',
  },
};