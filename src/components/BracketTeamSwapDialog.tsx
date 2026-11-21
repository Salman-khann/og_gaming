'use client';
import { useState } from 'react';
import { ArrowLeftRight, Check, UserX, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import type { TournamentMatch } from '@/types';
import styles from './TournamentBracket.module.css';

type Props = {
  match: TournamentMatch;
  matches: TournamentMatch[];
  teams: { id: string; team_name: string }[];
  name: (id: string | null) => string;
  busy: boolean;
  onClose: () => void;
  onSwap: (
    payload:
      | { action: 'swap_teams'; tournament_id: string; team_a_id: string; team_b_id: string }
      | {
          action: 'replace_team';
          tournament_id: string;
          match_id: string;
          old_team_id: string;
          new_team_id: string;
        },
  ) => Promise<void>;
};

export function BracketTeamSwapDialog({
  match,
  matches,
  teams,
  name,
  busy,
  onClose,
  onSwap,
}: Props) {
  const initialSide = match.team_a ? 'a' : match.team_b ? 'b' : 'a';
  const [selectedSide, setSelectedSide] = useState<'a' | 'b'>(initialSide);
  const [error, setError] = useState('');

  const currentTeamId = selectedSide === 'a' ? match.team_a : match.team_b;
  const opponentId = selectedSide === 'a' ? match.team_b : match.team_a;

  // Find all teams currently in active unplayed matches
  const activeBracketTeamIds = new Set<string>();
  const otherMatchTeams: { id: string; label: string }[] = [];

  for (const m of matches) {
    if (m.status === 'completed') continue;
    if (m.team_a) activeBracketTeamIds.add(m.team_a);
    if (m.team_b) activeBracketTeamIds.add(m.team_b);

    if (
      m.id !== match.id &&
      m.bracket === match.bracket &&
      m.round === match.round &&
      m.score_a == null &&
      m.score_b == null
    ) {
      if (m.team_a && m.team_a !== currentTeamId) {
        otherMatchTeams.push({
          id: m.team_a,
          label: `${name(m.team_a)} (${m.bracket === 'losers' ? 'L' : 'W'}${m.round}-${m.position})`,
        });
      }
      if (m.team_b && m.team_b !== currentTeamId) {
        otherMatchTeams.push({
          id: m.team_b,
          label: `${name(m.team_b)} (${m.bracket === 'losers' ? 'L' : 'W'}${m.round}-${m.position})`,
        });
      }
    }
  }

  // Standby teams can only replace teams in opening round matches
  const isOpeningMatch =
    match.round === 1 &&
    match.bracket === 'winners' &&
    !match.source_a &&
    !match.source_b;
  const standbyTeams = isOpeningMatch
    ? teams.filter((t) => !activeBracketTeamIds.has(t.id))
    : [];

  // Default target selection
  const defaultTarget = opponentId
    ? `swap:${opponentId}`
    : otherMatchTeams.length > 0
      ? `swap:${otherMatchTeams[0].id}`
      : standbyTeams.length > 0
        ? `replace:${standbyTeams[0].id}`
        : '';

  const [selectedTarget, setSelectedTarget] = useState<string>(defaultTarget);

  function handleSideChange(side: 'a' | 'b') {
    setSelectedSide(side);
    setError('');
    const newCurrent = side === 'a' ? match.team_a : match.team_b;
    const newOpponent = side === 'a' ? match.team_b : match.team_a;
    if (newOpponent) {
      setSelectedTarget(`swap:${newOpponent}`);
    } else {
      const other = otherMatchTeams.find((t) => t.id !== newCurrent);
      if (other) {
        setSelectedTarget(`swap:${other.id}`);
      } else if (standbyTeams.length > 0) {
        setSelectedTarget(`replace:${standbyTeams[0].id}`);
      } else {
        setSelectedTarget('');
      }
    }
  }

  const targetMode = selectedTarget.startsWith('swap:') ? 'swap' : 'replace';
  const targetId = selectedTarget.replace(/^(swap|replace):/, '');
  const targetName =
    name(targetId) || teams.find((t) => t.id === targetId)?.team_name || 'Selected team';
  const currentTeamName = name(currentTeamId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentTeamId || !targetId || busy) return;
    setError('');

    try {
      if (targetMode === 'swap') {
        await onSwap({
          action: 'swap_teams',
          tournament_id: match.tournament_id,
          team_a_id: currentTeamId,
          team_b_id: targetId,
        });
      } else {
        await onSwap({
          action: 'replace_team',
          tournament_id: match.tournament_id,
          match_id: match.id,
          old_team_id: currentTeamId,
          new_team_id: targetId,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to change team.');
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className={styles.swapDialog}
        overlayClassName={styles.scorecardBackdrop}
        showCloseButton={!busy}
      >
        <div className={styles.swapDialogHeader}>
          <div className={styles.swapIconContainer}>
            <ArrowLeftRight size={20} />
          </div>
          <div>
            <DialogTitle>Change or Swap Team</DialogTitle>
            <DialogDescription>
              {match.bracket === 'losers' ? 'Losers' : 'Winners'} Round {match.round} · Match{' '}
              {match.position}
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.swapForm}>
          {/* Step 1: Select which team in this match couldn't show up / needs changing */}
          <div className={styles.swapFieldGroup}>
            <label className={styles.swapFieldLabel}>Which team needs to be changed?</label>
            <div className={styles.swapSideSelector}>
              {match.team_a && (
                <button
                  type="button"
                  className={
                    styles.swapSideBtn +
                    (selectedSide === 'a' ? ' ' + styles.swapSideBtnActive : '')
                  }
                  onClick={() => handleSideChange('a')}
                  disabled={busy}
                >
                  <span className={styles.swapSideBadge}>Team A</span>
                  <strong>{name(match.team_a)}</strong>
                </button>
              )}
              {match.team_b && (
                <button
                  type="button"
                  className={
                    styles.swapSideBtn +
                    (selectedSide === 'b' ? ' ' + styles.swapSideBtnActive : '')
                  }
                  onClick={() => handleSideChange('b')}
                  disabled={busy}
                >
                  <span className={styles.swapSideBadge}>Team B</span>
                  <strong>{name(match.team_b)}</strong>
                </button>
              )}
            </div>
          </div>

          {/* Step 2: Choose target replacement or swap */}
          <div className={styles.swapFieldGroup}>
            <label htmlFor="target-team-select" className={styles.swapFieldLabel}>
              Select Swap or Replacement Team
            </label>
            <select
              id="target-team-select"
              value={selectedTarget}
              onChange={(e) => {
                setSelectedTarget(e.target.value);
                setError('');
              }}
              disabled={busy}
              className={styles.swapSelect}
            >
              {opponentId && (
                <optgroup label="Current Match">
                  <option value={`swap:${opponentId}`}>
                    Swap sides with opponent ({name(opponentId)})
                  </option>
                </optgroup>
              )}

              {otherMatchTeams.length > 0 && (
                <optgroup label="Swap with team in another match">
                  {otherMatchTeams.map((t) => (
                    <option key={`swap:${t.id}`} value={`swap:${t.id}`}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              )}

              {standbyTeams.length > 0 && (
                <optgroup label="Replace with standby team (No-show substitute)">
                  {standbyTeams.map((t) => (
                    <option key={`replace:${t.id}`} value={`replace:${t.id}`}>
                      {t.team_name} (Standby / Reserve)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Step 3: Explanation / Preview */}
          <div className={styles.swapPreviewBox}>
            <div className={styles.swapPreviewTitle}>Action Summary:</div>
            {targetMode === 'swap' && targetId === opponentId ? (
              <p>
                <strong>{currentTeamName}</strong> and <strong>{targetName}</strong> will switch
                sides (Team A ↔ Team B) in this match.
              </p>
            ) : targetMode === 'swap' ? (
              <p>
                <strong>{currentTeamName}</strong> and <strong>{targetName}</strong> will exchange
                places in the tournament bracket.
              </p>
            ) : (
              <p>
                <strong>{targetName}</strong> will replace <strong>{currentTeamName}</strong> in
                this match as a no-show substitute.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className={styles.swapError}>
              <UserX size={14} /> {error}
            </p>
          )}

          {/* Action buttons */}
          <div className={styles.swapActionsRow}>
            <button
              type="button"
              className={styles.swapCancelBtn}
              onClick={onClose}
              disabled={busy}
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="submit"
              className={styles.swapConfirmBtn}
              disabled={busy || !currentTeamId || !targetId}
            >
              {busy ? (
                'Updating…'
              ) : (
                <>
                  <Check size={14} /> Confirm Team Change
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
