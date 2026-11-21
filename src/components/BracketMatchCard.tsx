'use client';
import { useState, type CSSProperties } from 'react';
import { Check, Pencil, Shield, CalendarClock, Clock, X, ArrowLeftRight } from 'lucide-react';
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
  onSetTiming?: (matchId: string, scheduledAt: string | null) => Promise<void>;
  onSwapTeam?: (matchId: string) => void;
  isEliminated?: (teamId: string) => boolean;
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
  onSetTiming,
  onSwapTeam,
  isEliminated,
}: Props) {
  const [editingTiming, setEditingTiming] = useState(false);
  const initialDate = m.scheduled_at
    ? new Date(Date.parse(m.scheduled_at) + 5 * 3600000).toISOString().slice(0, 10)
    : '';
  const initialTime = m.scheduled_at
    ? new Date(Date.parse(m.scheduled_at) + 5 * 3600000).toISOString().slice(11, 16)
    : '20:00';
  const [customDate, setCustomDate] = useState(initialDate);
  const [customTime, setCustomTime] = useState(initialTime);

  const cardClassName =
    styles.match +
    (selected ? ' ' + styles.selectedMatch : '') +
    (m.is_custom_schedule ? ' ' + styles.customScheduledMatch : '');

  return (
    <article
      className={cardClassName}
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
              ? 'GF'
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
        {m.is_custom_schedule && (
          <span className={styles.customTimingBadge} title="Custom timing configured by admin">
            <Clock size={9} /> Custom
          </span>
        )}
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
          eliminated =
            lost &&
            !!id &&
            (isEliminated ? isEliminated(id) : m.bracket === 'losers' || m.bracket === 'final'),
          label = id ? name(id) : placeholder(m, side);
        return (
          <div
            key={side}
            className={
              styles.team +
              (winner ? ' ' + styles.winner : '') +
              (lost ? ' ' + styles.lost : '') +
              (eliminated ? ' ' + styles.eliminated : '') +
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
            {eliminated && (
              <span className={styles.eliminatedBadge} title="Eliminated from tournament">
                OUT
              </span>
            )}
            {winner && <Check className={styles.winnerCheck} size={12} aria-label="Winner" />}
            <span className={styles.score}>{score ?? '—'}</span>
          </div>
        );
      })}
      <div className={styles.matchSchedule}>
        {!editingTiming ? (
          <div className="flex items-center justify-between w-full">
            <div>
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
            {admin && m.status !== 'bye' && (
              <div className="flex items-center gap-1">
                {m.status !== 'completed' &&
                  !locked &&
                  (m.team_a || m.team_b) &&
                  onSwapTeam && (
                  <button
                    type="button"
                    className={styles.timingEditButton}
                    onClick={() => onSwapTeam(m.id)}
                    title="Change or swap teams (no-show or reschedule)"
                  >
                    <ArrowLeftRight size={10} />
                    <span>Swap</span>
                  </button>
                )}
                {onSetTiming && (
                  <button
                    type="button"
                    className={styles.timingEditButton}
                    onClick={() => setEditingTiming(true)}
                    title="Change match timing"
                  >
                    <CalendarClock size={11} />
                    <span>{m.is_custom_schedule ? 'Edit' : 'Set Time'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.timingInlineEditor}>
            <div className={styles.timingInputsRow}>
              <input
                type="date"
                required
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className={styles.timingDateInput}
              />
              <input
                type="time"
                required
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className={styles.timingTimeInput}
              />
            </div>
            <div className={styles.timingActionsRow}>
              <button
                type="button"
                className={styles.timingSaveBtn}
                disabled={busy || !customDate || !customTime}
                onClick={async () => {
                  if (!customDate || !customTime || !onSetTiming) return;
                  const time =
                    customTime.length === 5 ? customTime : `${customTime}:00`.slice(0, 5);
                  const iso = new Date(`${customDate}T${time}:00+05:00`).toISOString();
                  await onSetTiming(m.id, iso);
                  setEditingTiming(false);
                }}
              >
                Save
              </button>
              {m.is_custom_schedule && (
                <button
                  type="button"
                  className={styles.timingResetBtn}
                  disabled={busy}
                  onClick={async () => {
                    if (onSetTiming) {
                      await onSetTiming(m.id, null);
                      setEditingTiming(false);
                    }
                  }}
                >
                  Auto
                </button>
              )}
              <button
                type="button"
                className={styles.timingCancelBtn}
                onClick={() => setEditingTiming(false)}
                title="Cancel"
              >
                <X size={12} />
              </button>
            </div>
          </div>
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
