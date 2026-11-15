import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ error: null as unknown, data: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.data, error: state.error }) }),
      }),
    }),
  }),
}));
vi.mock('@/lib/team-applications', () => ({ guestApplications: async () => [] }));
import { readTournamentDetail } from '../../src/lib/tournament-detail';
it('distinguishes an absent event from a database outage', async () => {
  state.data = null;
  state.error = null;
  expect(await readTournamentDetail('missing')).toBeNull();
  state.error = { message: 'database timeout' };
  await expect(readTournamentDetail('existing')).rejects.toThrow('Unable to load the event.');
});
