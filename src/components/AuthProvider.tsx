'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Profile } from '@/types';
import { useRouter } from 'next/navigation';
const AuthContext = createContext<{ profile: Profile | null; loading: boolean; error: string; loginError: string; refresh: () => Promise<void>; logout: () => Promise<void> }>({ profile: null, loading: true, error: '', loginError: '', refresh: async () => {}, logout: async () => {} });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    try {
      const response = await fetch('/api/auth', { cache: 'no-store', signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (request.signal.aborted) return;
      setProfile(data.profile); setError('');
      setLoginError(previous => data.loginError || (data.profile ? '' : previous));
    } catch (error) { if (!request.signal.aborted) { setProfile(null); setError(error instanceof Error ? error.message : 'Unable to load account.'); } }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', onFocus); controller.current?.abort(); };
  }, [refresh]);
  const logout = async () => {
    controller.current?.abort();
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
      if (!response.ok) throw new Error('Unable to sign out. Try again.');
      controller.current?.abort();
      setProfile(null); setError(''); setLoginError('');
      router.push('/'); router.refresh();
    } catch { setError('Unable to sign out. Try again.'); }
    finally { setLoading(false); }
  };
  return <AuthContext.Provider value={{ profile, loading, error, loginError, refresh, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
