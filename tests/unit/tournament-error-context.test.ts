import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  error: { code: '23505', message: 'private constraint information' },
}));
vi.mock('next/server', () => ({ connection: async () => {}, after: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ dispatchAfterResponse: vi.fn() }));
vi.mock('@/lib/data-service', () => ({
  readArena: async () => ({ tournaments: [], registrations: [] }),
}));
const mocks = vi.hoisted(() => {
  const query = {
    update: () => query,
    eq: () => query,
    select: () => query,
    single: async () => ({ error: state.error }),
  };
  return { db: { from: () => query, rpc: async () => ({ error: state.error }) } };
});
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/api')>()),
  requireProfile: async () => ({ db: mocks.db, profile: { id: 'admin' } }),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mocks.db }));
import { GET, PATCH } from '../../src/app/api/tournaments/route';
function patch(body: unknown) {
  return PATCH(
    new Request('https://oggaming.pk/api/tournaments', {
      method: 'PATCH',
      headers: { Origin: 'https://oggaming.pk', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}
const id = '11111111-1111-4111-8111-111111111111';
it('maps approval duplicates only in the registration-review context', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://oggaming.pk');
  state.error = { code: '23505', message: 'private constraint information' };
  const approval = await patch({ registration_id: id, status: 'approved' });
  expect(approval.status).toBe(409);
  expect((await approval.json()).error).toBe('Another approved team already uses that name.');
  const payment = await patch({ action: 'verify_payment', registration_id: id });
  expect(payment.status).toBe(503);
  expect((await payment.json()).error).not.toMatch(/slug|private constraint/);
});
it('preserves deliberate tournament fee-lock messages instead of reporting slug errors', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://oggaming.pk');
  state.error = { code: 'P0001', message: 'The entry fee is fixed once a team registers.' };
  const response = await patch({
    tournament_id: id,
    title: 'Cup',
    slug: 'cup',
    status: 'upcoming',
    game: 'CS2',
    format: '5v5',
    min_level: 1,
    max_level: 10,
    max_teams: 16,
    start_date: '2099-11-02',
    registration_deadline: '2099-11-01',
  });
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe(state.error.message);
});
it('varies anonymous caching by cookies and Authorization so owned data stays private', async () => {
  const publicResponse = await GET(new Request('https://oggaming.pk/api/tournaments'));
  expect(publicResponse.headers.get('cache-control')).toContain('s-maxage=15');
  expect(publicResponse.headers.get('vary')).toContain('Cookie');
  const privateHeaders: Record<string, string>[] = [
    { Cookie: 'og_entries=invalid' },
    { Authorization: 'Bearer test-only' },
  ];
  for (const headers of privateHeaders) {
    const response = await GET(new Request('https://oggaming.pk/api/tournaments', { headers }));
    expect(response.headers.get('cache-control')).toBe('no-store');
  }
});
