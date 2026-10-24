'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type ResourceState<T> = { url: string; value: T | null; error: string; loading: boolean };

async function readResponse(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(typeof data?.error === 'string' ? data.error : fallback + ' Please try again.');
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('The server returned an unexpected response. Please try again.');
  return data;
}

export function useResource<T>(url: string | null) {
  const [state, setState] = useState<ResourceState<T> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);
  const reload = useCallback(async () => {
    lastRefresh.current = Date.now();
    controller.current?.abort();
    if (!url) return;
    const request = new AbortController();
    controller.current = request;
    setState((previous) => ({
      url,
      value: previous?.url === url ? previous.value : null,
      error: '',
      loading: true,
    }));
    try {
      const response = await fetch(url, { signal: request.signal, cache: 'no-store' });
      const value = await readResponse(response, 'Unable to load.');
      if (!request.signal.aborted) setState({ url, value, error: '', loading: false });
    } catch (error) {
      if (!request.signal.aborted)
        setState((previous) => ({
          url,
          value: previous?.url === url ? previous.value : null,
          error: error instanceof Error ? error.message : 'Unable to connect.',
          loading: false,
        }));
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const timer = setTimeout(() => void reload(), 0);
    const refresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh.current >= 15000)
        void reload();
    };
    const interval = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      controller.current?.abort();
    };
  }, [url, reload]);

  const current = url && state?.url === url ? state : null;
  return {
    data: current?.value ?? null,
    error: current?.error ?? '',
    loading: current?.loading ?? !!url,
    reload,
  };
}

export async function sendAction<T = { success: boolean }>(
  url: string,
  body: unknown,
  method = 'POST',
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse(response, 'Unable to save.');
}
