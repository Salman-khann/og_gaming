'use client';
import type { Profile, Tournament } from '@/types';
import { TurnstileChallenge } from './TurnstileChallenge';
import { BotTrap } from './BotTrap';
export function TeamApplicationForm({
  event,
  profile,
  busy,
  error,
  onSubmit,
}: {
  event: Tournament;
  profile: Profile | null;
  busy: boolean;
  error: string;
  onSubmit: (body: unknown) => Promise<void>;
}) {
  return (
    <form
      className="form-stack team-application"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        void onSubmit({
          captcha_token: form.get('captcha_token'),
          company_website: form.get('company_website'),
          tournament_id: event.id,
          team_name: form.get('team_name'),
          captain_name: form.get('captain_name'),
          email: form.get('email'),
          phone: form.get('phone'),
          city: form.get('city'),
          notes: form.get('notes'),
          accepted_rules: form.get('accepted_rules') === 'on',
          players: Array.from({ length: 5 }, (_, i) => ({
            nickname: form.get('player_' + i),
            game_id: form.get('game_' + i),
          })),
        });
      }}
    >
      <BotTrap />
      <TurnstileChallenge key={busy ? 'submitting' : 'ready'} action="registration" />
      <fieldset className="field-grid">
        <legend>Team &amp; captain</legend>
        <label className="field wide">
          Team name
          <input name="team_name" required maxLength={80} autoComplete="organization" />
        </label>
        <label className="field">
          Captain name
          <input
            name="captain_name"
            required
            maxLength={80}
            defaultValue={profile?.faceit_nickname || ''}
            autoComplete="name"
          />
        </label>
        <label className="field">
          WhatsApp / phone
          <input name="phone" required type="tel" placeholder="0300 1234567" autoComplete="tel" />
        </label>
        <label className="field">
          Captain email
          <input name="email" required type="email" maxLength={254} autoComplete="email" />
        </label>
        <label className="field">
          City (optional)
          <input name="city" maxLength={80} autoComplete="address-level2" />
        </label>
      </fieldset>
      <fieldset className="form-stack">
        <legend>Five-player roster</legend>
        <p className="muted">
          Use each player’s in-game name. Steam / game profile links are optional. FACEIT
          verification is not required.
        </p>
        {Array.from({ length: 5 }, (_, i) => (
          <div className="application-player" key={i}>
            <span className="player-number">{i + 1}</span>
            <label>
              Player {i + 1} name
              <input name={'player_' + i} required maxLength={40} />
            </label>
            <label>
              Game ID / profile link (optional)
              <input name={'game_' + i} maxLength={160} />
            </label>
          </div>
        ))}
      </fieldset>
      <label>
        Notes for organisers (optional)
        <textarea name="notes" rows={2} maxLength={1000} />
      </label>
      <label className="checkbox-field">
        <input type="checkbox" name="accepted_rules" required />I am authorised to register this
        team and agree to the tournament rules.
      </label>
      <p className="muted">
        {Number(event.entry_fee) > 0
          ? `Entry fee: PKR ${Number(event.entry_fee).toLocaleString('en-PK')} per team. Staff verify payment before approval.`
          : 'Free team entry.'}{' '}
        Contact details are visible only to organisers.
      </p>
      {!profile && (
        <p className="muted">
          Keep this browser to view your application, or sign in before submitting to link it to
          your account.
        </p>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? 'Submitting application…' : 'Submit team application'}
      </button>
    </form>
  );
}
