# Code review remediation — 25 October 2026

The fixes below are implemented in the working tree. The new application and migration have **not** been deployed. CAPTCHA keys and an isolated full Supabase staging run are deployment prerequisites. Phone OTP was explicitly deferred in favour of CAPTCHA and abuse controls.

The review's claim that no secrets were committed should not be relied on: a root `id_rsa` was tracked. Its removal from Git is staged, it is ignored, and the protected deployment copy is outside the checkout. The scanner now rejects conventional extensionless SSH private-key filenames too. This does not erase history or rotate the key; revoke/replace any key that was shared through Git history.

## Security

| Review | Result |
| --- | --- |
| S1 | Contact reveal requires membership/admin authorization, account and IP throttles, and a private audit record. Audit failure prevents disclosure. |
| S2 | Both guest forms use Turnstile with server-side success, hostname and action checks. Missing production keys fail closed. Duplicate applications use phone **and** email; pending applications cannot reserve team names. Phone ownership is still unverified; OTP is deferred. A WhatsApp link would expose the same digits and is not a privacy fix. |
| S3 | Pending applications have a separate bounded queue. Only approved applications consume tournament capacity. Tournament locking serializes submissions and approvals. |
| S4 | Only deliberate SQL `P0001` business messages reach clients; unexpected database failures return a generic error. |
| S5 | Production HSTS and a report-only CSP were added. CSP enforcement remains a separate change requiring nonce/hash work and browser report review. |
| S6–S7 | Login/signup subject buckets combine email with the trusted client address. Existing and new signup emails receive the same confirmation response. |
| S8 | Tournament deletion returns private scorecard object paths for batched Storage removal. A provider cleanup failure is logged for operational retry; database and Storage deletion cannot be one atomic transaction. |
| S9 | Scorecard reads are throttled and privately cached for 60 seconds. |
| S10–S12 | Anonymous profile role access is revoked; generated nicknames no longer use email local-parts. Trigger functions use an empty search path and reside in the private schema. Existing explicit nicknames are preserved. |
| S13 | FACEIT lookup now requires an account and account/IP throttles. |
| S14 | Multipart uploads are streamed with a byte limit, including requests without Content-Length. |
| S15 | **Pending provider integration verification.** `email_optional` permits missing email; it does not by itself prove unsafe account linking. Existing OIDC issuer discovery, PKCE and identity-subject checks remain. Test collision/linking cases in isolated Supabase before changing the working provider or enabling/disabling linking globally. |
| S16 | Public registration projections contain team names and player nicknames only. Raw registrations are owner/admin-only; private game IDs, captain IDs, payment fields and contacts stay private. Owner and guest-cookie views merge separately. Ranking RPC execution is restricted to the server. |
| S17 | Local minimum password length is 8. Hosted Auth was updated from 6 to 8 using an isolated config declaring only password length and email confirmation; a subsequent diff verified both settings match. Hosted email confirmation was already enabled. Leaked-password protection still requires dashboard verification/activation; it is a separate hosted setting available on Pro and above. No billing change was made. |
| B1–B2 | Invalid FACEIT names/profile URLs return useful validation/provider errors. Unexpected API errors log a correlation ID, scrubbed message and short stack; clients receive only the ID and a generic message. |

## Architecture and tooling

| Review | Result |
| --- | --- |
| A1 | Setup is regenerated from all 24 migrations; `database:check` detects drift and runs in CI. |
| A2 | Standalone duplicate upgrade SQL, generators and the retired-feature wrapper were removed. Use migration history through Supabase CLI. |
| A3 | Test scripts use `.env.test.local` and reject the known production project even when explicitly designated as staging. Local Supabase is the default; no paid hosted project was created. Docker is not installed on this workstation, so a complete Auth/Storage staging run remains pending. |
| A4 | Bracket generation, pairings and API entrants share service-only `eligible_registrations`. Historical migrations remain append-only. This project uses imperative migrations (`schema_paths = []`); converting schema management is a separate migration project. |
| A5 | Stale check-in UI copy and no-show scheduling were removed. Historical attendance columns and `team_id` are preserved because existing records and roster logic still use them. Dropping them would require a separate data/consumer migration. |
| A6 | Prettier and ESLint formatting are configured; source was formatted. Match cards and homepage client islands were extracted. Further bracket/controller separation can be done independently. |
| A7 | Auth, FACEIT, player queries, notifications, presentation and privacy tests use Vitest module mocks. Three Playwright browser smoke flows were added. Some legacy standalone source-loading tests remain; wholesale migration is not claimed. |
| A8 | Supabase scripts invoke the installed Node CLI portably; deployment ZIPs use archiver. The obsolete PowerShell ZIP script was removed. Linux CI covers the portable commands. |
| A9 | lightningcss is explicit, Node types align with Node 24, and the lockfile is updated. Existing `cn` was retained after tests confirmed Tailwind conflict merging. |

## Performance

| Review | Result |
| --- | --- |
| P1–P3 | Removed the blocking startup overlay; homepage is server-rendered with small client islands and viewport-lazy arena loading. Internal navigation uses Link. Grid animation uses transforms; mobile/reduced-motion effects are reduced. |
| P4 | Reused the validated auth context to remove duplicate getUser calls. A getClaims conversion is deferred until the project's signing-key compatibility is verified. |
| P5 | Public leaderboard, community and player-list responses allow short shared caching. Tournament responses remain private because they contain account/cookie-owned applications. Hosting must honour response cache headers for shared caching to take effect. |
| P6 | Player detail serves cached stats and schedules provider refresh after the response, with a global provider gate. |
| P7–P9 | Focus refreshes have a 15-second guard; bracket layouts/name lookup are memoized and resize updates coalesced. SQL eligibility avoids the oversized FACEIT `.in()` URL. |
| P10 | Banned entrants are materialized once within eligibility queries, with separate captain/roster predicates. A ranking materialized view is deferred until profiling justifies its refresh/invalidation complexity. |
| P11 | Worker and optional cron purge notification/contact-audit history older than 30 days, excluding active leases. Undelivered rows are never falsely marked sent. |
| P12–P13 | Appended lists retain at most 20 pages and memoize deduplication. Registration reads are scoped to the tournaments on the current page. |

## Verification and remaining rollout

Passed: full `npm test` (including all migration fixtures, RLS, ownership, capacity, payment, scorecards and 2–128 entrant bracket progression); 20 Vitest tests; 3 Playwright smoke tests; ESLint; Prettier; TypeScript; source secret scan; optimized Next.js production build.

Browser smoke tests mock the API and Turnstile script; server verification is tested independently. They do not prove real Cloudflare, hosted Auth, Storage or provider integrations. Development font downloads failed and fell back during the browser run; the optimized build succeeded. Windows sandbox restrictions required explicit cleanup of the isolated browser-test server; the existing development server was left running.

Before deployment:

1. Configure a real Turnstile widget for the production hostname. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` **before building** and `TURNSTILE_SECRET_KEY` on the server. Never expose the secret in a public variable. Use separate staging keys.
2. Complete the isolated workflow in [STAGING.md](STAGING.md), including hosted FACEIT linking and real CAPTCHA expiry/replay checks.
3. Back up production and plan a maintenance window. Review/apply `20261024210738_security_privacy_and_capacity.sql` and release the matching app together: the old app's public registration/ranking reads are incompatible with the tightened grants. Do not apply the migration alone while serving the old app.
4. Verify `npm run security:production` with the **production** environment. The current local development environment fails this gate for missing Turnstile keys and production-only cron/origin/proxy settings; do not replace server secrets with placeholders.
5. Verify hosted leaked-password protection and provider linking, run database advisors, and smoke-test admin/owner/guest visibility, contact throttling, approval/capacity and scorecard deletion. Monitor scrubbed server logs and CSP reports.

The old release remains live until these prerequisites are met. Keep a database-aware rollback plan: reverting the app alone does not restore the previous registration permissions.

References: [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [custom OAuth providers](https://supabase.com/docs/guides/auth/custom-oauth-providers).
