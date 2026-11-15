import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ failReserve: false, failSave: false, calls: [] as string[] }));
vi.mock('next/server', () => ({ after: vi.fn(), connection: async () => {} }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/api')>()),
  requireProfile: async () => ({ profile: { id: 'admin' } }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: '11111111-1111-4111-8111-111111111111',
              tournament_id: '22222222-2222-4222-8222-222222222222',
              status: 'completed',
              score_a: 2,
              score_b: 0,
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.calls.push(
        name === 'queue_scorecard_cleanup' ? 'reserve:' + args.delay_seconds : 'save',
      );
      return {
        data: null,
        error: (name === 'queue_scorecard_cleanup' ? state.failReserve : state.failSave)
          ? { code: 'P0001', message: 'Result changed.' }
          : null,
      };
    },
    storage: {
      from: () => ({
        upload: async () => {
          state.calls.push('upload');
          return { error: null };
        },
      }),
    },
  }),
}));
import { POST } from '../../src/app/api/tournaments/scorecards/route';
beforeEach(() => {
  state.calls = [];
  state.failReserve = false;
  state.failSave = false;
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://oggaming.pk');
});
function request() {
  const form = new FormData();
  form.set('match_id', '11111111-1111-4111-8111-111111111111');
  form.set('map_number', '1');
  form.set(
    'file',
    new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }),
    'fixture.png',
  );
  return new Request('https://oggaming.pk/api/tournaments/scorecards', {
    method: 'POST',
    headers: { Origin: 'https://oggaming.pk' },
    body: form,
  });
}
it('persists the cleanup reservation before uploading and fails closed if it cannot', async () => {
  state.failReserve = true;
  expect((await POST(request())).status).toBe(503);
  expect(state.calls).toEqual(['reserve:900']);
});
it('retains durable cleanup work if saving the uploaded image fails', async () => {
  state.failSave = true;
  expect((await POST(request())).status).toBe(409);
  expect(state.calls).toEqual(['reserve:900', 'upload', 'save', 'reserve:0']);
});
