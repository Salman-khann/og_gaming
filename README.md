Tournament entries are open team applications: FACEIT verification and sign-in are optional. Admin operations, neutral card styling and event-link copying were updated on 13 October 2026. See docs/COMMUNITY_SETUP.md for the current workflow.

Memberships/plans, promotions/referrals, disputes and application audit logging have been removed. Historical records are retained in a private database archive.

# OG Gaming

Next.js app for 5v5 matchmaking and tournaments. The original homepage design is retained.

## Setup

Fill in `.env.local` using `.env.example`. Supabase public credentials and the server-only service role key are required. Set `NEXT_PUBLIC_SITE_URL` to the app's origin. Allow `<app-origin>/auth/callback` in Supabase Auth redirect URLs.

For a new project, run `supabase/setup.sql` in the Supabase SQL Editor. It applies sixteen migrations in a transaction. For existing installations, apply only pending migrations in order. Install all pending migrations, including the optional-feature retirement migration, before deploying the current app. See `docs/COMMUNITY_SETUP.md` for the exact list and operator workflow. The provider migration retires historical booking data in a private schema; booking routes, forms, and APIs remain removed. Regenerate the new-project setup after adding migrations with `node scripts/build-database-setup.mjs`.

Enable email/password authentication and configure email delivery/confirmation. Signup confirmation exchanges the authorization code for a real session.

## Steam and FACEIT login

Steam uses [Steam OpenID](https://partner.steamgames.com/doc/features/auth) and verifies signed assertions directly with Steam. It binds each callback to a short-lived, single-use browser state cookie, then establishes a Supabase session for the verified Steam ID. No Steam API key is required. Steam account mappings are server-only. The database setup must be applied first.

FACEIT uses a [Supabase custom OIDC provider](https://supabase.com/docs/guides/auth/custom-oauth-providers). Add `FACEIT_CLIENT_ID` and `FACEIT_CLIENT_SECRET` from your FACEIT developer app to `.env.local`, set its callback to `https://<project-ref>.supabase.co/auth/v1/callback`, then run `node scripts/configure-faceit.mjs`. This registers or updates `custom:faceit`. Keep secrets server-only. `FACEIT_API_KEY` is a separate Data API key used to verify tournament rosters.

## Administration

Sign up, then promote the chosen user's UUID in the SQL Editor:

```sql
update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
```

Administrators use `/admin` to create/edit tournaments, publish events, review registrations, and manage check-ins. Draft tournaments stay hidden from players. Role assignments are protected against client updates. Match joins and tournament approvals lock database rows to prevent concurrent overfilling.

## Run and verify

Run `npm install` and `npm run dev`. Use `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for verification. `npm test` runs API validation, mocked provider tests, and all migrations plus rollback-only SQL fixtures in an in-memory PGlite Postgres database; it uses no hosted credentials. Cron scheduling is excluded from the local runtime; the expiry deletion query is tested. `node tests/http-smoke.test.mjs http://localhost:3108` checks a running local server without creating records. Live matchmaking and tournament checks require the database setup; full provider login requires signing into the real external accounts.

Panels load on demand; only the selected section is queried. Requests are cancelled when superseded and refresh once a minute while visible or when the window regains focus. Query results are bounded. Guests can browse matches and tournaments.

See `docs/PROJECT_REVIEW.md` for the completed scope, fixes, verification results, and hosted activation status. See `docs/COMMUNITY_SETUP.md` for team invitations, administration, notification configuration, worker scheduling and the retired features.

## Tournament fees and brackets

Admins can set a PKR entry fee per team and payment instructions when creating a tournament. The fee becomes fixed after the first registration. After registering and paying, teams use the WhatsApp button to send their payment screenshot to the existing zone number. An administrator checks the screenshot and marks payment verified before approving the team. The app does not process payments or automatically verify screenshots.

Manage bracket on `/admin` generates seeded single or double elimination from approved, checked-in, paid and eligible teams, closes registration, and handles byes. Admins enter scores to advance winners and losers; the final result records the champion and completes the event. Double elimination includes a reset final when necessary. Earlier scores can be corrected until dependent games finish. Teams and payment eligibility become fixed once the bracket starts. Public brackets refresh while visible.

Verified squad invitations remain available for team scrims. Tournament registration uses a separate open team application form: captain contact details, team name and five player names are required. FACEIT verification and sign-in are optional. Guest applications are managed from the browser that submitted them.

Match hosts can delete their posts on `/matches`. Guest deletion works in the browser that created the post using a private HttpOnly credential. Signed-in creators and admins can also delete posts. Deletion removes the post and its private phone number together. Run `node tests/match-delete-live.mjs http://localhost:3101` against a local production server for the ownership/API check; SQL verification files use rollback-only fixtures.

## Guest match posts and expiry

Anyone can post at /matches with a phone number and future match date/time; an account is not required. Pakistani local numbers normalize to +92; international numbers use their country prefix. Contact numbers stay in a server-only table and are revealed only to administrators and players on that match's roster. Up to three upcoming posts may use the same phone number.

Posts disappear at the selected time. Supabase Cron removes new expired posts and their contact details once per minute. Posts that existed before the retention migration are preserved. The clock uses Karachi time in match forms.

## Leaderboard and account names

/leaderboard ranks connected FACEIT players and approved tournament rosters by CS2 ELO, then win rate and K/D. Lifetime match counts, wins, headshot rates and unavailable-stat placeholders come from the FACEIT Data API. Stats cache for 15 minutes. No fabricated ranks or stats are shown.

Steam names are read from Steam's public profile, with an optional STEAM_WEB_API_KEY lookup. Existing Steam account names refresh when the account loads. Admin login redirects to /admin, and the homepage and navigation contain Manage tournaments links.

FACEIT Connect uses the confidential authorization-code flow; provider-side PKCE is disabled because FACEIT's discovery document does not advertise it. App-to-Supabase PKCE remains enabled. A 401 from FACEIT's token endpoint means the configured OAuth client credentials must be corrected in .env.local, then node scripts/configure-faceit.mjs rerun. These are separate from the FACEIT Data API key.
