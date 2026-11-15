'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { sendAction } from './useResource';

export function RegistrationCancelButton({
  id,
  name,
  onCancelled,
}: {
  id: string;
  name: string;
  onCancelled: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <button
        className="button secondary"
        type="button"
        onClick={() => {
          setError('');
          setPassword('');
          setOpen(true);
        }}
      >
        Cancel registration
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            setPassword('');
          }
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogTitle>Cancel registration for {name}?</DialogTitle>
          <DialogDescription>
            This removes the team from active registrations and frees its place. The cancellation
            record is retained. Registrations are locked after bracket generation.
          </DialogDescription>
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                await sendAction('/api/admin/operations', {
                  action: 'cancel_registration',
                  registration_id: id,
                  password,
                });
                setOpen(false);
                await onCancelled();
              } catch (failure) {
                setError(
                  failure instanceof Error ? failure.message : 'Unable to cancel registration.',
                );
              } finally {
                setPassword('');
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Your admin account password
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                autoFocus
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <div className="actions">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setPassword('');
                }}
              >
                Keep registration
              </button>
              <button className="button" disabled={busy || !password}>
                {busy ? 'Cancelling…' : 'Confirm cancellation'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
