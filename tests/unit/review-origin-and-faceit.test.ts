import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sameOrigin } from '../../src/lib/api-input';
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/api')>()),
  requireProfile: async () => ({ profile: { id: 'caller' } }),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));
vi.mock('@/lib/faceit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/faceit')>()),
  verifyFaceitPlayer: vi.fn(),
}));
import { FaceitError, verifyFaceitPlayer } from '../../src/lib/faceit';
import { GET } from '../../src/app/api/faceit/lookup/route';
afterEach(() => vi.unstubAllEnvs());

it('requires an explicit matching origin, including behind the production proxy', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://oggaming.pk');
  const request = (headers: Record<string, string>) =>
    new Request('http://127.0.0.1:3000/api/teams', { method: 'POST', headers });
  expect(() => sameOrigin(request({ Origin: 'https://oggaming.pk' }))).not.toThrow();
  const invalidHeaders: Record<string, string>[] = [
    {},
    { 'Sec-Fetch-Site': 'same-origin' },
    { Origin: 'null' },
    { Origin: 'https://evil.test' },
    { Origin: 'https://oggaming.pk', 'Sec-Fetch-Site': 'cross-site' },
    { Origin: 'http://127.0.0.1:3000', 'X-Forwarded-Host': 'oggaming.pk' },
  ];
  for (const headers of invalidHeaders) {
    expect(() => sameOrigin(request(headers))).toThrow('Invalid request origin');
  }
});

it('allows only explicit mobile development origins and ignores them in production', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('DEV_ALLOWED_ORIGINS', 'http://192.168.18.125:3000,http://127.0.0.1:3000');
  vi.stubEnv('NODE_ENV', 'development');
  const request = (origin?: string, extra: Record<string, string> = {}) =>
    new Request('http://localhost:3000/api/auth', {
      headers: { ...(origin ? { Origin: origin } : {}), ...extra },
    });
  expect(() => sameOrigin(request('http://192.168.18.125:3000'))).not.toThrow();
  expect(() => sameOrigin(request('http://127.0.0.1:3000'))).not.toThrow();
  for (const origin of [undefined, 'null', 'https://evil.test', 'http://192.168.18.125:4000'])
    expect(() => sameOrigin(request(origin))).toThrow('Invalid request origin');
  expect(() =>
    sameOrigin(request('http://192.168.18.125:3000', { 'Sec-Fetch-Site': 'cross-site' })),
  ).toThrow('Invalid request origin');
  vi.stubEnv('NODE_ENV', 'production');
  expect(() => sameOrigin(request('http://192.168.18.125:3000'))).toThrow('Invalid request origin');
  expect(() => sameOrigin(request('http://localhost:3000'))).not.toThrow();
});

it('exposes only deliberate FACEIT errors and returns 503 for unexpected failures', async () => {
  const request = () => new NextRequest('https://oggaming.pk/api/faceit/lookup?nickname=player');
  vi.mocked(verifyFaceitPlayer).mockRejectedValueOnce(new FaceitError('Player not found.', 404));
  const expected = await GET(request());
  expect(expected.status).toBe(404);
  expect(await expected.json()).toEqual({ error: 'Player not found.' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(verifyFaceitPlayer).mockRejectedValueOnce(
    new Error('private-schema secret-provider-details'),
  );
  const unexpected = await GET(request());
  expect(unexpected.status).toBe(503);
  const result = await unexpected.json();
  expect(result.error).not.toMatch(/private-schema|secret-provider/);
  expect(result.requestId).toBeTruthy();
});
