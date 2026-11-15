import { beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/lib/api-input';
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  password: vi.fn(),
  limit: vi.fn(),
  profile: vi.fn(),
}));
vi.mock('next/server', () => ({ connection: async () => {} }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/api')>()),
  requireProfile: mocks.profile,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/bracket-reset-password', () => ({ verifyAdminPassword: mocks.password }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.limit }));
import { POST } from '../../src/app/api/admin/operations/route';
const actor = '11111111-1111-4111-8111-111111111111',
  entry = '22222222-2222-4222-8222-222222222222',
  session = { auth: {} };
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.test');
  mocks.rpc.mockReset().mockResolvedValue({ error: null });
  mocks.password.mockReset().mockResolvedValue(undefined);
  mocks.limit.mockReset().mockResolvedValue(undefined);
  mocks.profile
    .mockReset()
    .mockResolvedValue({ profile: { id: actor, role: 'admin' }, db: session });
});
function request(origin = 'https://site.test') {
  return new Request('https://site.test/api/admin/operations', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'cancel_registration',
      registration_id: entry,
      password: 'fixture password',
      actor_id: entry,
    }),
  });
}
it('requires matching origin, admin authorization, rate limit and password before writing', async () => {
  expect((await POST(request('https://foreign.test'))).status).toBe(403);
  expect(mocks.password).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.profile.mockRejectedValueOnce(new ApiError('Access denied.', 403));
  expect((await POST(request())).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.password.mockRejectedValueOnce(new ApiError('Incorrect account password.', 403));
  expect((await POST(request())).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect((await POST(request())).status).toBe(200);
  expect(mocks.limit).toHaveBeenCalledWith(
    expect.any(Request),
    'registration-cancel',
    5,
    300,
    actor,
  );
  expect(mocks.password).toHaveBeenCalledWith(session, actor, 'fixture password');
  expect(mocks.rpc).toHaveBeenCalledWith('cancel_team_registration', {
    actor_id: actor,
    entry_id: entry,
  });
});
