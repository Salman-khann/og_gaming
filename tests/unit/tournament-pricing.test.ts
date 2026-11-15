import { describe, expect, it } from 'vitest';
import { tournamentPrice } from '../../src/lib/tournament-pricing';

const deadline = Date.parse('2026-11-01T12:00:00+05:00');
const event = {
  entry_fee: 2000,
  early_bird_fee: 1500,
  early_bird_deadline: new Date(deadline).toISOString(),
  registration_deadline: new Date(deadline + 3600000).toISOString(),
  status: 'upcoming' as const,
};
describe('early-bird pricing', () => {
  it('uses the discounted fee only before the deadline', () => {
    expect(tournamentPrice(event, deadline - 1).amount).toBe(1500);
    expect(tournamentPrice(event, deadline).amount).toBe(2000);
    expect(tournamentPrice(event, deadline + 1).earlyBird).toBe(false);
  });
  it('does not advertise inactive or invalid offers', () => {
    for (const change of [
      { status: 'completed' as const },
      { early_bird_fee: null },
      { early_bird_fee: 2001 },
      { early_bird_deadline: 'invalid' },
      { registration_deadline: new Date(deadline - 2).toISOString() },
    ]) {
      expect(tournamentPrice({ ...event, ...change }, deadline - 1).earlyBird).toBe(false);
    }
    expect(tournamentPrice(event, null).earlyBird).toBe(false);
  });
  it('supports free early entry and tournaments without an offer', () => {
    expect(tournamentPrice({ ...event, early_bird_fee: 0 }, deadline - 1).amount).toBe(0);
    expect(
      tournamentPrice(
        { ...event, early_bird_fee: undefined, early_bird_deadline: undefined },
        deadline - 1,
      ).amount,
    ).toBe(2000);
  });
});
