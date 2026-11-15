import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from 'next/experimental/testing/server';
const state = vi.hoisted(() => ({ calls: 0, fail: false }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          values: { name: string; value: string; options: object }[],
          headers: Record<string, string>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      getClaims: async () => {
        state.calls++;
        if (state.fail) throw new Error('Provider offline');
        options.cookies.setAll(
          [
            {
              name: 'sb-fixture-auth-token',
              value: 'refreshed-fixture',
              options: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' },
            },
            { name: 'sb-fixture-auth-token.0', value: '', options: { path: '/', maxAge: 0 } },
          ],
          { 'Cache-Control': 'private, no-store' },
        );
        return { data: { claims: { sub: 'account' } }, error: null };
      },
    },
  }),
}));
import { updateSession } from '../../src/lib/supabase/proxy';
import { config } from '../../src/proxy';
afterEach(() => {
  state.calls = 0;
  state.fail = false;
});
it('forwards refreshed tokens to the browser and the downstream request', async () => {
  const request = new NextRequest('https://site.test/tournaments', {
    headers: { Cookie: 'sb-fixture-auth-token.0=old-fixture' },
  });
  const response = await updateSession(request);
  expect(state.calls).toBe(1);
  expect(request.cookies.get('sb-fixture-auth-token')?.value).toBe('refreshed-fixture');
  expect(response.headers.get('x-middleware-request-cookie')).toContain('refreshed-fixture');
  expect(response.cookies.get('sb-fixture-auth-token')).toMatchObject({
    httpOnly: true,
    secure: true,
  });
  expect(response.cookies.get('sb-fixture-auth-token.0')?.maxAge).toBe(0);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('skips anonymous requests and preserves cookies when Auth is temporarily offline', async () => {
  await updateSession(new NextRequest('https://site.test/'));
  expect(state.calls).toBe(0);
  state.fail = true;
  const request = new NextRequest('https://site.test/admin', {
    headers: { Cookie: 'sb-fixture-auth-token=old-fixture' },
  });
  const response = await updateSession(request);
  expect(request.cookies.get('sb-fixture-auth-token')?.value).toBe('old-fixture');
  expect(response.cookies.getAll()).toEqual([]);
  expect(response.headers.get('location')).toBeNull();
});
it('runs for protected pages and APIs, excluding build and image assets', () => {
  for (const url of ['/admin', '/api/auth', '/tournaments/cup'])
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
  for (const url of [
    '/_next/static/chunk.js',
    '/_next/image?url=x',
    '/site_assets/logo_0.png',
    '/favicon.ico',
  ])
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
});
