'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { sendAction } from './useResource';
import styles from './TournamentBracket.module.css';

export function BracketResetDialog({
  tournamentId,
  onClose,
  onReset,
}: {
  tournamentId: string;
  onClose: () => void;
  onReset: () => Promise<void>;
}) {
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className={styles.resetDialog}
        overlayClassName={styles.scorecardBackdrop}
        showCloseButton={!busy}
      >
        <DialogTitle>Reset tournament bracket?</DialogTitle>
        <DialogDescription>
          This permanently clears the bracket, every match result and its scorecards. Team
          registrations and schedule settings are kept. You can then generate a fresh bracket.
        </DialogDescription>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              await sendAction(
                '/api/tournaments/bracket',
                { action: 'reset_bracket', tournament_id: tournamentId, password },
                'PATCH',
              );
              setPassword('');
              await onReset();
              onClose();
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Unable to reset bracket.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Your account password
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              maxLength={128}
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <p>Enter the password you use to sign in to your administrator account.</p>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.scheduleActions}>
            <button type="button" className={styles.manageButton} disabled={busy} onClick={onClose}>
              Keep bracket
            </button>
            <button type="submit" className={styles.dangerButton} disabled={busy || !password}>
              {busy ? 'Resetting…' : 'Reset bracket'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
