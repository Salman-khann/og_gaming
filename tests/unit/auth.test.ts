import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signOut: vi.fn(),
  rateLimit: vi.fn(),
  subject: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signUp: mocks.signUp, signOut: mocks.signOut } }),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  rateLimitSubject: mocks.subject,
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/server', () => ({ connection: vi.fn() }));
import { POST } from '../../src/app/api/auth/route';
const request = (address: string) =>
  new Request('https://site.test/api/auth', {
    method: 'POST',
    headers: {
      Origin: 'https://site.test',
      'Content-Type': 'application/json',
      'x-vercel-forwarded-for': address,
    },
    body: JSON.stringify({
      action: 'signup',
      email: 'captain@example.test',
      password: 'test password',
      nickname: 'Captain',
    }),
  });
beforeEach(() => {
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.test');
  mocks.subject.mockClear();
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
it('does not let one address consume another address/email throttle', async () => {
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  await POST(request('192.0.2.1'));
  await POST(request('192.0.2.2'));
  expect(mocks.subject.mock.calls[0][0]).toBe('signup-email-ip');
  expect(mocks.subject.mock.calls[0][1]).not.toBe(mocks.subject.mock.calls[1][1]);
});
it('returns identical signup responses for existing and new accounts', async () => {
  mocks.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
  const created = await POST(request('192.0.2.1'));
  mocks.signUp.mockResolvedValueOnce({
    data: { session: null },
    error: { code: 'user_already_exists', message: 'User already registered' },
  });
  const existing = await POST(request('192.0.2.1'));
  expect(existing.status).toBe(created.status);
  expect(await existing.json()).toEqual(await created.json());
});
