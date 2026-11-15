import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  failDelete: false,
  referenced: false,
  failAck: false,
  calls: [] as { name: string; args: Record<string, unknown> }[],
}));
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.calls.push({ name, args });
      return name === 'claim_scorecard_cleanup'
        ? { data: [{ id: 'job', bucket: 'match-scorecards', object_path: 'old.png' }], error: null }
        : { data: null, error: state.failAck ? {} : null };
    },
    from: () => ({
      select: (columns: string) => {
        expect(columns).toBe('match_id');
        return {
          eq: () => ({
            limit: async () => ({ data: state.referenced ? [{ id: 'active' }] : [], error: null }),
          }),
        };
      },
    }),
    storage: {
      from: () => ({
        remove: async () => {
          state.calls.push({ name: 'delete', args: {} });
          return { error: state.failDelete ? {} : null };
        },
      }),
    },
  }),
}));
import { drainScorecardCleanup } from '../../src/lib/storage-cleanup';

it('retries Storage failures and refuses to delete active references', async () => {
  state.failDelete = true;
  await drainScorecardCleanup();
  expect(state.calls.at(-1)?.args.succeeded).toBe(false);
  state.calls = [];
  state.failDelete = false;
  state.referenced = true;
  await drainScorecardCleanup();
  expect(state.calls.some((call) => call.name === 'delete')).toBe(false);
  expect(state.calls.at(-1)?.args.succeeded).toBe(false);
  state.calls = [];
  state.referenced = false;
  expect(await drainScorecardCleanup()).toEqual({ attempted: 1, completed: 1, deferred: 0 });
  expect(state.calls.at(-1)?.args.succeeded).toBe(true);
  state.failAck = true;
  expect(await drainScorecardCleanup()).toMatchObject({ deferred: 1 });
});
