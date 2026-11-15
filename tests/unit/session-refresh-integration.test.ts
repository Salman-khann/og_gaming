import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { updateSession } from '../../src/lib/supabase/proxy';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('persists a rotated refresh token using the actual Supabase SSR client', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://session.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fixture-only-key');
  const id = '11111111-1111-4111-8111-111111111111';
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  };
  const jwt = (expiry: number) =>
    [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(
        JSON.stringify({
          sub: id,
          aud: 'authenticated',
          role: 'authenticated',
          iss: 'https://session.test/auth/v1',
          iat: now - 60,
          exp: expiry,
        }),
      ).toString('base64url'),
      Buffer.from('fixture-only-signature').toString('base64url'),
    ].join('.');
  const session = {
    access_token: jwt(now - 60),
    refresh_token: 'old-fixture-refresh',
    expires_at: now - 60,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
  const refreshed = {
    ...session,
    access_token: jwt(now + 3600),
    refresh_token: 'rotated-fixture-refresh',
    expires_at: now + 3600,
  };
  let refreshes = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      if (url.pathname === '/auth/v1/token') {
        expect(url.searchParams.get('grant_type')).toBe('refresh_token');
        expect(JSON.parse(String(init?.body)).refresh_token).toBe(session.refresh_token);
        refreshes++;
        return Response.json(refreshed);
      }
      if (url.pathname === '/auth/v1/user') return Response.json(user);
      throw new Error('Unexpected Auth endpoint');
    }),
  );
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  const request = new NextRequest('https://site.test/tournaments', {
    headers: { Cookie: 'sb-session-auth-token=' + value },
  });
  const response = await updateSession(request);
  expect(refreshes).toBe(1);
  const cookie = response.cookies.get('sb-session-auth-token');
  expect(cookie).toBeDefined();
  const saved = JSON.parse(Buffer.from(cookie!.value.slice(7), 'base64url').toString());
  expect(saved.refresh_token).toBe(refreshed.refresh_token);
  expect(request.cookies.get('sb-session-auth-token')?.value).toBe(cookie!.value);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
