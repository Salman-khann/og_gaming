import assert from 'node:assert/strict';
import { it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
vi.mock('@/components/TeamApplicationForm', () => ({ TeamApplicationForm: () => null }));
import { TournamentsView } from '../../src/components/TournamentsView';
it('prerenders registration guards without requiring check-in or reading current time', () => {
  const tournament = {
    id: 'fixture',
    slug: 'fixture',
    title: 'Prerender fixture',
    status: 'upcoming',
    game: 'CS2',
    start_date: '2030-01-01T12:00:00Z',
    registration_deadline: '2030-01-01T11:00:00Z',
    min_level: 1,
    max_level: 10,
    max_teams: 8,
    entry_fee: 0,
  };
  const originalNow = Date.now;
  try {
    Date.now = () => {
      throw new Error('Current time must not be read during prerender');
    };
    const guest = renderToString(
      createElement(TournamentsView, {
        tournaments: [tournament],
        registrations: [],
        currentProfile: null,
        onRegistrationCreated: () => {},
      }),
    );
    assert.match(guest, /Checking registration time/);
    assert.doesNotMatch(guest, /Registration closed or full/);
    const member = renderToString(
      createElement(TournamentsView, {
        tournaments: [tournament],
        registrations: [
          {
            id: 'entry',
            tournament_id: 'fixture',
            captain_id: 'captain',
            status: 'approved',
            checked_in: false,
            amount_due: 0,
          },
        ],
        currentProfile: { id: 'captain' },
        onRegistrationCreated: () => {},
      }),
    );
    assert.match(member, /Your team:.*?approved/);
    assert.doesNotMatch(member, /check.in/i);
    console.log(
      'Tournament SSR passes without Date.now; registration stays guarded before hydration and approved teams need no check-in.',
    );
  } finally {
    Date.now = originalNow;
  }
});
