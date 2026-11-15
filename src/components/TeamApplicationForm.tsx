'use client';
import type { Profile, Tournament } from '@/types';
import { TurnstileChallenge } from './TurnstileChallenge';
import { BotTrap } from './BotTrap';
import { EarlyBirdOffer } from './EarlyBirdOffer';
import { formatEntryFee, tournamentPrice } from '@/lib/tournament-pricing';
export function TeamApplicationForm({
  event,
  profile,
  busy,
  error,
  onSubmit,
  now = null,
}: {
  event: Tournament;
  profile: Profile | null;
  busy: boolean;
  error: string;
  onSubmit: (body: unknown) => Promise<void>;
  now?: number | null;
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
      <EarlyBirdOffer tournament={event} now={now} />
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
          <input
            name="email"
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            defaultValue={profile?.account_email || ''}
          />
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
        Entry fee: {formatEntryFee(tournamentPrice(event, now).amount)} per team. The fee is set
        when your application is submitted. Staff verify paid entries before approval. Contact
        details are visible only to organisers.
      </p>
      {!profile && (
        <p className="muted">
          This browser remembers your 20 most recent applications. Sign in before submitting to keep
          applications linked to your account.
        </p>
      )}
      {profile && (
        <p className="muted">
          This application will be saved to your signed-in account on every device. Use that account
          email for the captain.
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
