# Community and competition setup

Memberships, plans, promotions/referral discounts, disputes and application audit logging were removed on 13 October 2026 at the user's request. Cabin booking and payment gateways remain excluded.

## Database

The complete migration history is in `supabase/migrations/`; `supabase/setup.sql` is generated and checked against it in CI. Existing installations must apply only their missing migrations, in order. Never rerun the combined setup over an existing database. A new project can use `supabase/setup.sql`; regenerate it with `node scripts/build-database-setup.mjs`.

Removed feature tables were moved to `arena_retired_features`. Existing records remain recoverable by the database owner, with no schema/table access for anonymous, authenticated or application service roles. Their public RPCs and notification triggers are removed. Existing tournament amounts and verified payments are preserved; new entries use the event fee without promotions. Historical migration files remain to support existing installations.

## Teams and tournaments

Players sign in with FACEIT, create squads at `/teams` and invite teammates. Each teammate signs in with the matching identity and accepts. These verified squads are used for team scrims. Each account can belong to at most five teams.

Staff publish tournaments, verify manual fee payments and approve teams in `/admin`. Tournament applications are separate from linked squads: anyone can submit a captain name, email, phone, team name and five player names, without FACEIT verification or sign-in. Optional game IDs, city and organiser notes are supported. Contact information is private to organisers. Signed-in entries are linked to the account; guests keep a private browser credential to view their own pending entries. Check-in and no-show rejection are retired. Single and double elimination use approved, eligible teams with any required payment verified, with automatic byes and reset finals. Staff enter scores; played dependent games prevent earlier corrections. All venue times are displayed in Pakistan time.

Verified teams post/join scrims as five players. Ten-player gathers are balanced by exact total ELO difference when every player has verified ELO. `/players` and `/leaderboard` show public profiles, retained participation summaries and verified rankings. `/community` shows published sponsors, gallery images and streams.

The administration panel retains players, teams, analytics, notifications and content. Role changes still preserve the last administrator and prohibit self-demotion; they no longer create application audit records.

## Notifications and worker

For Telegram, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID`. For email, set `RESEND_API_KEY`, `ADMIN_EMAIL` and a verified `NOTIFICATION_FROM_EMAIL`. Set `NEXT_PUBLIC_SITE_URL` to the app origin.

Set a strong `CRON_SECRET` and schedule `GET /api/worker` every five minutes with `Authorization: Bearer <CRON_SECRET>`. The worker refreshes bounded batches of linked FACEIT accounts and retries notifications. Database Cron runs expiry/no-show cleanup and rate-limit cleanup. Real provider delivery and app scheduling require deployment configuration.

On Vercel, rate limiting uses the trusted platform address header. On other hosts, configure `TRUSTED_CLIENT_IP_HEADER` only for a header overwritten by the reverse proxy. Without that setting, guest/password traffic uses a shared bucket.

## Verification

Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`. SQL fixtures validate all migrations, current permissions and feature retirement, team ownership/limits, manual payments, no-shows, history, balancing and single/double brackets up to 128 entrants. Notification delivery is mocked; no external messages are sent by tests.

For a running local production server, run `node tests/http-smoke.test.mjs http://localhost:3110` and `node scripts/check-feature-api.mjs http://localhost:3110`. Removed membership/dispute routes must return 404. `node tests/deployment-readonly.mjs` verifies the configured hosted project's retained APIs and privacy restrictions.

The operations menu now includes Tournaments, Players, Teams, Analytics, Notifications and Community content. The admin workspace uses neutral light cards and OG orange accents. Large lists use Load more instead of Next/Previous controls. Event sharing uses Copy event link; Open event opens its public details in a new tab. Publishing adds sponsors, gallery images or YouTube streams to /community.
