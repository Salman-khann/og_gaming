import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { clientNetwork, trustedClientAddress } from '../../src/lib/request-address';
import {
  decodeApplications,
  encodeApplications,
  applicationTokens,
} from '../../src/lib/application-cookie';
import { FaceitError, normalizeFaceitNickname, verifyFaceitPlayer } from '../../src/lib/faceit';

it('groups IPv6 privacy addresses without changing the real provider address', () => {
  expect(clientNetwork('2001:db8:1:2::1')).toBe(clientNetwork('2001:db8:1:2:ffff::abcd'));
  expect(clientNetwork('2001:db8:1:3::1')).not.toBe(clientNetwork('2001:db8:1:2::1'));
  expect(clientNetwork('::1')).toBe('0000:0000:0000:0000::/64');
  vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'x-og-client-ip');
  expect(
    trustedClientAddress(
      new Request('https://og.test', { headers: { 'x-og-client-ip': '2001:db8::abc' } }),
    ),
  ).toBe('2001:db8::abc');
  expect(
    trustedClientAddress(
      new Request('https://og.test', { headers: { 'x-og-client-ip': '0:0:0:0:0:ffff:c000:201' } }),
    ),
  ).toBe('192.0.2.1');
});

it('bounds and signs guest ownership cookies while accepting legacy credentials', () => {
  vi.stubEnv('RATE_LIMIT_SECRET', 'a'.repeat(64));
  const expiry = Date.now() + 10000;
  const entries: [string, string, number][] = Array.from({ length: 30 }, () => [
    randomUUID(),
    'b'.repeat(64),
    expiry,
  ]);
  const encoded = encodeApplications(entries);
  expect(encoded.length).toBeLessThan(3600);
  expect(decodeApplications(encoded)).toEqual(entries.slice(-20));
  expect(decodeApplications(encoded, expiry + 1)).toEqual([]);
  expect(decodeApplications((encoded[0] === 'A' ? 'B' : 'A') + encoded.slice(1))).toEqual([]);
  const legacy = randomUUID();
  const tokens = applicationTokens({
    getAll: () => [
      { name: 'og_entries', value: encoded },
      { name: 'og_entry_' + legacy, value: 'c'.repeat(64) },
    ],
  });
  expect(tokens.get(legacy)).toBe('c'.repeat(64));
  expect(tokens.size).toBe(21);
});

it('returns defined 400/404/422 FACEIT errors for user-facing failures', async () => {
  expect(() => normalizeFaceitNickname('https://faceit.com/en/players/%E0%A4')).toThrow(
    FaceitError,
  );
  try {
    normalizeFaceitNickname('bad nickname');
  } catch (error) {
    expect((error as FaceitError).status).toBe(400);
  }
  vi.stubEnv('FACEIT_API_KEY', 'test-only-provider-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  await expect(verifyFaceitPlayer('MissingReviewPlayer')).rejects.toMatchObject({ status: 404 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ player_id: randomUUID(), nickname: 'NoCS2Review', games: {} }),
    ),
  );
  await expect(verifyFaceitPlayer('NoCS2Review')).rejects.toMatchObject({ status: 422 });
});
