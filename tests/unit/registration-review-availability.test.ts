import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ error: null as null | { code: string } }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: { entry: ['Possible overlap'] }, error: state.error }),
  }),
}));
import { registrationReviewFlags } from '../../src/lib/registration-review';

it('keeps local admin reads available with an explicit missing-migration warning', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  state.error = { code: 'PGRST202' };
  const result = await registrationReviewFlags('admin', ['entry']);
  expect(result.entry).toHaveLength(1);
  expect(result.entry[0]).toMatch(/checks unavailable.*pending review migrations/);
});

it('does not hide missing migrations in production or permission failures in development', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  state.error = { code: 'PGRST202' };
  await expect(registrationReviewFlags('admin', ['entry'])).rejects.toThrow();
  vi.stubEnv('NODE_ENV', 'development');
  state.error = { code: '42501' };
  await expect(registrationReviewFlags('admin', ['entry'])).rejects.toThrow();
});

it('preserves computed review signals when the migration is installed', async () => {
  state.error = null;
  expect(await registrationReviewFlags('admin', ['entry'])).toEqual({
    entry: ['Possible overlap'],
  });
});
