import { expect, it, vi } from 'vitest';
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { verifiedUser } from '../../src/lib/auth-session';
import { publicCacheHeaders } from '../../src/lib/public-cache';

function client(user: unknown, error: unknown) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error })) },
  } as unknown as SupabaseClient;
}
it('distinguishes a verified sign-out from a temporary auth outage', async () => {
  expect(await verifiedUser(client(null, new AuthSessionMissingError()))).toBeNull();
  expect(
    await verifiedUser(client(null, new AuthApiError('expired', 400, 'session_expired'))),
  ).toBeNull();
  await expect(
    verifiedUser(client(null, new AuthRetryableFetchError('network', 503))),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    verifiedUser(client(null, new AuthApiError('provider unavailable', 500, 'unexpected_failure'))),
  ).rejects.toMatchObject({ status: 503 });
  expect(await verifiedUser(client({ id: 'verified' }, null))).toEqual({ id: 'verified' });
});
it('never shares responses that can carry refreshed auth cookies', () => {
  expect(
    publicCacheHeaders(new Request('https://site.test/api/players'))['Cache-Control'],
  ).toContain('s-maxage');
  expect(
    publicCacheHeaders(
      new Request('https://site.test/api/players', {
        headers: { Cookie: 'sb-test-auth-token=fixture' },
      }),
    )['Cache-Control'],
  ).toContain('no-store');
  expect(
    publicCacheHeaders(
      new Request('https://site.test/api/players', {
        headers: { Authorization: 'Bearer fixture' },
      }),
    )['Cache-Control'],
  ).toContain('no-store');
});
