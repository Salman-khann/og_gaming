'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Profile } from '@/types';
import { useRouter } from 'next/navigation';
const AuthContext = createContext<{
  profile: Profile | null;
  loading: boolean;
  error: string;
  loginError: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  profile: null,
  loading: true,
  error: '',
  loginError: '',
  refresh: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    lastRefresh.current = Date.now();
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    refreshing.current = true;
    try {
      const response = await fetch('/api/auth', {
        cache: 'no-store',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
      });
      const data = await response.json();
      if (request.signal.aborted) return;
      if (response.status === 401 || response.status === 403) setProfile(null);
      if (!response.ok) throw new Error(data.error);
      setProfile(data.profile);
      setError('');
      setLoginError((previous) => data.loginError || (data.profile ? '' : previous));
    } catch (error) {
      if (!request.signal.aborted) {
        // Keep the last verified display during network/provider failures.
        // Server authorization never relies on this client-side state.
        setError(error instanceof Error ? error.message : 'Unable to load account.');
      }
    } finally {
      if (controller.current === request) refreshing.current = false;
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => {
      if (
        !refreshing.current &&
        document.visibilityState === 'visible' &&
        Date.now() - lastRefresh.current >= 15000
      )
        void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onFocus);
    const interval = window.setInterval(onFocus, 60000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onFocus);
      window.clearInterval(interval);
      controller.current?.abort();
    };
  }, [refresh]);
  const logout = async () => {
    controller.current?.abort();
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      if (!response.ok) throw new Error('Unable to sign out. Try again.');
      controller.current?.abort();
      setProfile(null);
      setError('');
      setLoginError('');
      router.push('/');
      router.refresh();
    } catch {
      setError('Unable to sign out. Try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthContext.Provider value={{ profile, loading, error, loginError, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
