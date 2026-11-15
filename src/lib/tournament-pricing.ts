import type { Tournament } from '@/types';

export function tournamentPrice(
  t: Pick<
    Tournament,
    'entry_fee' | 'early_bird_fee' | 'early_bird_deadline' | 'status' | 'registration_deadline'
  >,
  now: number | null,
) {
  const regular = Number(t.entry_fee);
  const discounted = Number(t.early_bird_fee);
  const earlyBird =
    now !== null &&
    t.status === 'upcoming' &&
    t.early_bird_fee != null &&
    Number.isFinite(discounted) &&
    discounted >= 0 &&
    discounted < regular &&
    !!t.early_bird_deadline &&
    Date.parse(t.early_bird_deadline) > now &&
    Date.parse(t.registration_deadline) > now;
  return { regular, amount: earlyBird ? discounted : regular, earlyBird };
}

export function formatEntryFee(amount: number) {
  return amount === 0
    ? 'Free'
    : `PKR ${amount.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}
