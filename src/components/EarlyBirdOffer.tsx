import type { Tournament } from '@/types';
import { formatEntryFee, tournamentPrice } from '@/lib/tournament-pricing';
import styles from './EarlyBird.module.css';

export function EarlyBirdOffer({
  tournament,
  now,
}: {
  tournament: Tournament;
  now: number | null;
}) {
  const price = tournamentPrice(tournament, now);
  if (!price.earlyBird) return null;
  return (
    <div className={styles.panel}>
      <p className={styles.label}>
        Early-bird access · Save {formatEntryFee(price.regular - price.amount)}
      </p>
      <p>
        <span className={styles.price}>{formatEntryFee(price.amount)}</span>
        <s className={styles.regular}>{formatEntryFee(price.regular)}</s>
        <span className={styles.note}> / team</span>
      </p>
      <p className={styles.note}>
        Register before{' '}
        {new Date(tournament.early_bird_deadline!).toLocaleString('en-PK', {
          timeZone: 'Asia/Karachi',
          dateStyle: 'medium',
          timeStyle: 'short',
        })}{' '}
        PKT to secure this fee.
      </p>
    </div>
  );
}
