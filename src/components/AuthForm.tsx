'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { BotTrap } from './BotTrap';
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const { refresh, loginError } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          email: fields.get('email'),
          password: fields.get('password'),
          nickname: fields.get('nickname'),
          company_website: fields.get('company_website'),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.confirmationRequired) {
        setMessage('Check your email to confirm your account, then log in.');
        return;
      }
      await refresh();
      router.push(data.redirectTo || '/matches');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to connect. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="wrap auth-page">
      <div className="form-panel">
        <p className="eyebrow">OG GAMING / ACCOUNT</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p className="muted">Find a 5v5 match and register your team.</p>
        <div className="form-stack my-6">
          <a className="button secondary" href="/api/auth/faceit">
            Continue with FACEIT
          </a>
          <a className="button secondary" href="/api/auth/steam">
            Continue with Steam
          </a>
        </div>
        {loginError && (
          <p role="alert" className="error-message">
            {loginError}
          </p>
        )}
        <form onSubmit={submit} className="form-stack">
          <BotTrap />
          {mode === 'signup' && (
            <label>
              Player name
              <input name="nickname" autoComplete="nickname" required maxLength={40} />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          {mode === 'signup' && <p className="muted">Use at least 8 characters.</p>}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success-message">
              {message}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              New here? <Link href="/signup">Sign up</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Log in</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
