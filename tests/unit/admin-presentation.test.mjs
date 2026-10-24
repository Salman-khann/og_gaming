import assert from 'node:assert/strict';
import { it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
vi.mock('react', async (original) => {
  const actual = await original();
  return {
    ...actual,
    useState: (initial) => actual.useState(initial === 'tournaments' ? 'players' : initial),
  };
});
vi.mock('@/components/useAppendPages', () => ({
  useAppendPages: (_scope, _page, items) => items || [],
}));
vi.mock('@/components/useResource', () => ({
  useResource: () => ({
    data: {
      items: [
        {
          id: 'fixture',
          faceit_nickname: 'IPHONE',
          faceit_id: null,
          faceit_level: 1,
          faceit_elo: 1000,
          role: 'player',
          created_at: '2026-10-08T11:48:23Z',
          last_active_at: '2026-10-13T13:16:01Z',
        },
      ],
      total: 1,
    },
    error: '',
    loading: false,
    reload: async () => {},
  }),
  sendAction: vi.fn(),
}));
import { OperationsPanel } from '../../src/components/OperationsPanel';
it('keeps administration player summaries readable and hides unverified default stats', () => {
  const originalNow = Date.now;
  try {
    Date.now = () => {
      throw new Error('Current time read during admin render');
    };
    const html = renderToString(createElement(OperationsPanel, { tournamentContent: null }));
    assert.match(html, /Tournaments/);
    assert.match(html, /IPHONE/);
    assert.match(html, /Not connected/);
    assert.match(html, /Joined/);
    assert.match(html, /Last active/);
    assert.match(html, /PKT/);
    assert.doesNotMatch(
      html,
      /faceit_id:|created_at:|last_active_at:|1000|Previous|>Next<|2026-10-08T/,
    );
    console.log(
      'Admin player presentation hides raw fields and unverified default stats, includes tournaments, and prerenders without current time.',
    );
  } finally {
    Date.now = originalNow;
  }
});
