import type { CSSProperties } from 'react';
import { Check, Pencil, Shield } from 'lucide-react';
import type { TournamentMatch } from '@/types';
import { matchDateLabel, matchClockLabel } from '@/lib/bracket-schedule';
import styles from './TournamentBracket.module.css';

type Props = {
  match: TournamentMatch;
  admin: boolean;
  busy: boolean;
  selected: boolean;
  locked: boolean;
  style: CSSProperties;
  name: (id: string | null) => string;
  placeholder: (match: TournamentMatch, side: 'a' | 'b') => string;
  onScorecard: () => void;
  onEdit: () => void;
  onClear: () => void;
  onScore: (a: number, b: number) => Promise<void>;
};
export function BracketMatchCard({
  match: m,
  admin,
  busy,
  selected,
  locked,
  style,
  name,
  placeholder,
  onScorecard,
  onEdit,
  onClear,
  onScore,
}: Props) {
  return (
    <article
      className={styles.match + (selected ? ' ' + styles.selectedMatch : '')}
      id={'bracket-match-' + m.id}
      style={style}
      aria-label={
        'Round ' +
        m.round +
        ', match ' +
        m.position +
        ': ' +
        name(m.team_a) +
        ' versus ' +
        name(m.team_b)
      }
    >
      {m.status === 'completed' && (
        <button
          type="button"
          className={styles.matchOpen}
          aria-label={'View scorecard: ' + name(m.team_a) + ' versus ' + name(m.team_b)}
          onClick={onScorecard}
        />
      )}
      <div className={styles.matchMeta}>
        <span>
          {m.bracket === 'reset'
            ? 'GF2'
            : m.bracket === 'final'
              ? 'GF1'
              : `${m.bracket === 'losers' ? 'L' : 'W'}${m.round}-${m.position}`}
        </span>
        <span className={m.status === 'completed' ? styles.completeStatus : undefined}>
          {m.status === 'completed'
            ? 'Completed'
            : m.status === 'bye'
              ? m.bracket === 'reset'
                ? 'Not required'
                : 'Bye'
              : m.team_a && m.team_b
                ? 'Ready to play'
                : 'Awaiting teams'}
        </span>
        {admin && m.team_a && m.team_b && m.status !== 'bye' && (
          <button
            type="button"
            aria-label={'Edit result for round ' + m.round + ' match ' + m.position}
            disabled={busy || locked}
            title={locked ? 'Locked: a later match has finished' : 'Record BO3 result'}
            onClick={onEdit}
          >
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
      {(['a', 'b'] as const).map((side) => {
        const id = side === 'a' ? m.team_a : m.team_b,
          score = side === 'a' ? m.score_a : m.score_b;
        const winner = !!id && m.winner_id === id,
          lost = !!m.winner_id && !!id && !winner,
          label = id ? name(id) : placeholder(m, side);
        return (
          <div
            key={side}
            className={
              styles.team +
              (winner ? ' ' + styles.winner : '') +
              (lost ? ' ' + styles.lost : '') +
              (!id ? ' ' + styles.pending : '')
            }
          >
            <span className={styles.emblem} aria-hidden="true">
              {id ? (
                label
                  .replace(/[^a-z0-9]/gi, '')
                  .slice(0, 2)
                  .toUpperCase() || 'OG'
              ) : (
                <Shield size={16} />
              )}
            </span>
            <span className={styles.teamName} title={label}>
              {label}
            </span>
            {winner && <Check className={styles.winnerCheck} size={12} aria-label="Winner" />}
            <span className={styles.score}>{score ?? '—'}</span>
          </div>
        );
      })}
      <div className={styles.matchSchedule}>
        {m.scheduled_at ? (
          <time dateTime={m.scheduled_at}>
            <span>{matchDateLabel(m.scheduled_at)}</span>
            <strong>
              {matchClockLabel(m.scheduled_at)}
              {m.bracket === 'reset' ? ' · If needed' : ''}
            </strong>
          </time>
        ) : m.status === 'bye' ? null : (
          'Schedule to be announced'
        )}
      </div>
      {admin && m.team_a && m.team_b && m.status !== 'bye' && (
        <div className={styles.inlineScores}>
          {locked ? (
            <span>Result locked</span>
          ) : m.status !== 'completed' || selected ? (
            <>
              {[
                [2, 0],
                [2, 1],
                [1, 2],
                [0, 2],
              ].map(([a, b]) => (
                <button
                  type="button"
                  key={`${a}-${b}`}
                  disabled={busy}
                  aria-label={`${name(m.team_a)} ${a}, ${name(m.team_b)} ${b}`}
                  onClick={() => void onScore(a, b)}
                >
                  {a}&ndash;{b}
                </button>
              ))}
              {m.status === 'completed' && (
                <button type="button" disabled={busy} onClick={onClear}>
                  Clear
                </button>
              )}
            </>
          ) : (
            <span>BO3 complete</span>
          )}
        </div>
      )}
    </article>
  );
}
