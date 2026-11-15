import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  fail: true,
  profiles: [] as { id: string; faceit_id: string }[],
}));
vi.mock('next/server', () => ({ connection: async () => {}, after: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async () => ({ error: state.fail ? {} : null, data: 0 }),
    from: () => {
      const query = {
        select: () => query,
        not: () => query,
        neq: () => query,
        order: () => query,
        limit: async () => ({ data: state.profiles, error: state.fail ? {} : null }),
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/storage-cleanup', () => ({
  drainScorecardCleanup: vi.fn(async () => {
    if (state.fail) throw new Error('cleanup unavailable');
    return { attempted: 0, completed: 0, deferred: 0 };
  }),
}));
vi.mock('@/lib/notifications', () => ({
  dispatchNotifications: vi.fn(async () => ({ configured: true, delivered: 1 })),
}));
vi.mock('@/lib/faceit', () => ({ getFaceitPlayerById: vi.fn() }));
vi.mock('@/lib/leaderboard', () => ({ refreshLeaderboardPlayer: vi.fn() }));
import { GET } from '../../src/app/api/worker/route';
import { dispatchNotifications } from '../../src/lib/notifications';
import { getFaceitPlayerById } from '../../src/lib/faceit';
function request() {
  return new Request('https://oggaming.pk/api/worker', {
    headers: { Authorization: 'Bearer test-worker-credential' },
  });
}
it('continues notification delivery when independent maintenance stages fail', async () => {
  vi.stubEnv('CRON_SECRET', 'test-worker-credential');
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    delivered: 1,
    cleanup: { failed: true },
    maintenanceFailed: true,
    profileRefreshFailed: true,
  });
  expect(dispatchNotifications).toHaveBeenCalled();
});
it('does not begin provider batches once the profile budget is exhausted', async () => {
  state.fail = false;
  state.profiles = [{ id: 'profile', faceit_id: 'faceit' }];
  vi.stubEnv('CRON_SECRET', 'test-worker-credential');
  let tick = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => (++tick === 1 ? 0 : 40000));
  expect((await GET(request())).status).toBe(200);
  expect(getFaceitPlayerById).not.toHaveBeenCalled();
});
