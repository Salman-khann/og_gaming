'use client';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileChallenge({ action }: { action: 'match-post' | 'registration' }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!ready || !siteKey || !container.current || !window.turnstile) return;
    const api = window.turnstile;
    const widget = api.render(container.current, {
      sitekey: siteKey,
      action,
      theme: 'dark',
      size: 'flexible',
      'response-field': false,
      callback: (value: string) => {
        setToken(value);
        setError('');
      },
      'expired-callback': () => setToken(''),
      'error-callback': () => {
        setToken('');
        setError('Security check failed. Reload this form to try again.');
      },
    });
    return () => api.remove(widget);
  }, [ready, siteKey, action]);
  if (!siteKey)
    return process.env.NODE_ENV === 'production' ? (
      <p role="alert">Form protection is temporarily unavailable.</p>
    ) : null;
  return (
    <div className="field wide">
      <Script
        id="og-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() =>
          setError('Unable to load the security check. Reload this form to try again.')
        }
      />
      <div ref={container} />
      <input type="hidden" name="captcha_token" value={token} />
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </div>
  );
}
