import { expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from,
    auth: { getUser: async () => ({ data: { user: { id: 'captain' } } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/team-applications', () => ({ guestApplications: async () => [] }));
import { readArena } from '../../src/lib/data-service';

it('merges a captains private approved application over its public projection', async () => {
  const publicRow = { id: 'entry', tournament_id: 'event', team_name: 'Team', status: 'approved' };
  const privateRow = { ...publicRow, captain_id: 'captain', amount_due: 2000 };
  const queriedEvents: unknown[] = [];
  from.mockImplementation((table: string) => {
    const result = {
      data:
        table === 'tournaments'
          ? [{ id: 'event' }]
          : table === 'public_registrations'
            ? [publicRow]
            : table === 'registrations'
              ? [privateRow]
              : [],
      count: 1,
      error: null,
    };
    const query = {
      select: () => query,
      order: () => query,
      eq: () => query,
      in: (column: string, values: unknown) => {
        if (table === 'public_registrations' && column === 'tournament_id')
          queriedEvents.push(values);
        return query;
      },
      range: () => Promise.resolve(result),
      limit: () => Promise.resolve(result),
      then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    };
    return query;
  });
  const result = await readArena('tournaments');
  expect(result.registrations).toEqual([privateRow]);
  expect(queriedEvents).toEqual([['event']]);
});
