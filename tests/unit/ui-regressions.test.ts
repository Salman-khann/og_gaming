import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { Profile } from '../../src/types';
const state = vi.hoisted(() => ({
  auth: { profile: null as Profile | null, loading: false },
  query: '',
  resources: 0,
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => state.auth }));
vi.mock('@/components/useAppendPages', () => ({
  useAppendPages: (_scope: string, _page: number, items: unknown[]) => items || [],
}));
vi.mock('@/components/useResource', () => ({
  useResource: () => {
    state.resources++;
    return { data: null, loading: true, error: '' };
  },
}));
vi.mock('@/components/PlayerProfile', async () => {
  const { createElement } = await import('react');
  return {
    PlayerProfile: ({ playerId }: { playerId: string }) =>
      createElement('p', null, 'Profile: ' + playerId),
  };
});
vi.mock('@/components/TurnstileChallenge', () => ({ TurnstileChallenge: () => null }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
  DialogDescription: () => null,
}));
import { ArenaWorkspace } from '../../src/components/ArenaWorkspace';
import { PlayersWorkspace } from '../../src/components/PlayersWorkspace';
import { MatchBoard } from '../../src/components/MatchBoard';

afterEach(() => {
  state.auth = { profile: null, loading: false };
  state.query = '';
  vi.restoreAllMocks();
});
it('keeps administration protected in guest, player, and loading states', () => {
  expect(renderToString(createElement(ArenaWorkspace, { admin: true }))).toContain(
    'Administrator access required',
  );
  state.auth.profile = { id: 'player', role: 'player' } as Profile;
  expect(renderToString(createElement(ArenaWorkspace, { admin: true }))).toContain(
    'Administrator access required',
  );
  state.auth = { profile: null, loading: true };
  expect(renderToString(createElement(ArenaWorkspace, { admin: true }))).toContain(
    'Loading account',
  );
});
it('does not fetch the directory for legacy player profile links', () => {
  state.query = 'player_id=legacy-player';
  state.resources = 0;
  expect(renderToString(createElement(PlayersWorkspace))).toContain('Profile: legacy-player');
  expect(state.resources).toBe(0);
  state.query = '';
  expect(renderToString(createElement(PlayersWorkspace))).toContain('Meet the players');
  expect(state.resources).toBe(1);
});
it('prerenders match cards without reading the current time', () => {
  vi.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('Time read during SSR');
  });
  const matches = [
    {
      id: 'match',
      creator_id: null,
      status: 'open',
      created_at: '2029-01-01',
      updated_at: '2029-01-01',
      title: 'Hydration fixture',
      type: 'gather_5v5',
      roster: [],
      min_faceit_level: 1,
      max_faceit_level: 10,
      current_players_count: 0,
      target_players_count: 10,
      scheduled_time: '2030-01-01T12:00:00Z',
    },
  ] as Parameters<typeof MatchBoard>[0]['matches'];
  expect(
    renderToString(
      createElement(MatchBoard, { matches, currentProfile: null, onMatchUpdated() {} }),
    ),
  ).toContain('Hydration fixture');
});
