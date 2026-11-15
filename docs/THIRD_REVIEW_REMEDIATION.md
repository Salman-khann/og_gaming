# Third review fixes — 25 October 2026

Deployment update: these application changes were subsequently deployed in build `eNFF3I_Gs23swAiJ8Aiqu`. See [the release record](ACCOUNT_AND_PROFILE_UPDATE.md) for account recovery, readable player URLs, backups, worker scheduling and live verification. The statements below describing local-only status record the earlier review stage.

These application changes are local and **not deployed**. The previous deployed build remains `TfTMsWnviCxAMvBflNZZO`. Both database migrations were applied on 25 October 2026 at the user's subsequent request; see the database rollout record below. The user declined SSH rotation and approved restoring `vitest.config.mts`. Unrelated home-page edits and the removal of `repomix.config.json` were preserved.

## Security and correctness

- Rate-limit network keys normalize IPv6 to /64, including equivalent textual forms and IPv4-mapped addresses. Coarser shared-network caps supplement the existing account, phone, email and CAPTCHA checks. Turnstile still receives the actual client address.
- Expected FACEIT input, missing-player and unsupported-profile errors retain explicit 400/404/422 responses. Unexpected failures remain generic, with server-side diagnostics. Team invitations preserve these distinctions too.
- Player-profile reads are throttled and exclude draft tournament titles through an inner join/filter. Contact reveal requires an account at least 24 hours old or a FACEIT link, except for administrators.
- Registration approval reports duplicate approved team names as 409. Tournament create/edit reports duplicate slugs separately and preserves deliberate database fee-lock errors. Steam callbacks no longer expose unexpected internal error messages.
- Administrators see review warnings for overlapping roster names, supplied game IDs, shared phone/email and possible banned-account associations. Warnings are scoped to the requested registration page and do not expose another application's contact values. Free-text matches are review signals, not identity proof or automatic bans.
- Guest application credentials use one signed, bounded cookie containing the 20 most recent applications, with per-entry expiry. Legacy cookies remain readable and are cleared when the new cookie is written. The form explains the limit.
- A bounded, rate-limited CSP report receiver logs only selected origins and directives. CSP remains report-only; the bundled Next guide warns that nonce CSP is incompatible with the app's Partial Prerendering setup. Enforcement requires a separate rendering-policy decision and browser validation.

## Worker, storage and queries

Worker maintenance stages fail independently. Profile refresh checks its remaining budget and propagates abort signals; notifications retain their own bounded window. Cleanup acknowledgment failures leave durable retries rather than aborting the entire run. Completed/retained cleanup jobs expire after 30 days; pending work is preserved.

Changing or clearing match results removes stale scorecard rows transactionally, allowing the existing durable cleanup triggers to queue their objects. Scorecard URLs are signed in a batch. Team membership retrieval uses indexed ID unions, and bracket creation materializes eligible registrations once. Owned-roster refresh reuses the existing provider cache and updates profiles concurrently.

Anonymous match/tournament responses have short shared-cache lifetimes only when both Cookie and Authorization are absent; responses vary on both headers. Personalized/admin responses remain `no-store`. Tournament detail queries run independent reads concurrently and distinguish missing events from database outages.

## UI and maintenance

Arena lists retain visible cards while another page loads. Mutations and background refresh return to page 1 and replace the earlier cached pages, avoiding stale join controls. Identity changes cannot display a prior account's cached list. Mutation notices remain visible during refresh.

Removed unused startup-loader/client fallback code and obsolete helpers. Replaced `cn` with `clsx` and `tailwind-merge`. CI actions are pinned, Dependabot is configured, and CI includes a production dependency audit, build and complete-history secret scan. Vitest configuration was restored at the user's request. Migration counts are derived from the versioned migration directory rather than maintained in prose.

## Verification and remaining work

Validation covers the complete regression/isolated SQL suite, brackets through 128 entrants, administrator warning privacy, stale-scorecard cleanup, retention, worker isolation, IPv6 normalization, signed-cookie bounds, contextual errors, outage handling and public-cache boundaries. There are 36 passing Vitest tests and five passing mocked Playwright browser tests. TypeScript, lint, formatting, setup consistency, source secret checks and the production build were checked. The production dependency audit reported no vulnerabilities; development dependency findings remain.

The complete-history Gitleaks scan intentionally remains failing: it found the previously committed SSH private key and two generic API-key-like strings in historical scratch HTML. The two HTML findings still need classification. Findings were redacted; no secrets were printed. No history rewrite, force-push, key rotation or host access-log review was performed. A pass of the current-source scanner does not clear historical exposure. Account paths and Supabase project references are identifiers rather than authentication credentials; possession of an encrypted private key alone does not establish successful host access.

Authenticated users can still query the existing readable profile role column. Moving authorization data to an own-row-only structure needs a separate database/API compatibility change. Phone OTP, reliable guest identity proof, historical orphan-object inventory, broad component decomposition and migration of the remaining VM-based tests are follow-ups. Historical migrations and retired data columns were preserved.

The following migrations were applied in order after a verified backup:

Localhost may use this newer source against the shared database before rollout. In development only, a missing review RPC (`PGRST202`) produces a visible per-application warning that roster checks are unavailable and manual review is required. It does not prevent the admin lists from loading. Production, permission errors and other database failures remain strict. This compatibility path does not install migrations or calculate overlap signals.

1. `20261025095522_durable_scorecard_cleanup_and_team_pages.sql`
2. `20261025103629_review_integrity_and_worker_hardening.sql`

The packaged authenticated worker runner needs the private five-minute schedule described in [the second review notes](UPDATED_REVIEW_REMEDIATION.md) when the matching application is deployed. No cron was installed in this pass. Real Storage retries, provider linking and human CAPTCHA completion remain deployment/provider verification. The user's instruction to skip staging was preserved; no paid resources were created.

## Database rollout — 25 October 2026

At the user's explicit request, both migrations above were applied to the shared database. Before applying them, an encrypted backup was created and authenticated, and its PostgreSQL archive directory was verified to include application tables, Auth users and Storage metadata. The user explicitly approved reopening the temporary backup tunnel after automatic review initially rejected it. The tunnel was closed immediately after verification. The backup record is stored privately in `.deployment/security-backup.json`; no credentials are recorded here.

Verification confirmed both migration history entries, cleanup RLS, all three cleanup triggers, restricted review/cleanup access and authenticated team paging. The review function succeeded against actual registrations both through SQL and the Supabase Data API, returning only verification booleans to diagnostic output. Counts remained one tournament, 20 registrations, 39 bracket matches and zero scorecards. The existing live match/tournament APIs returned HTTP 200. Hosted security advisors reported only the existing `auth_leaked_password_protection` warning.

The database migration does not deploy the local application or install its worker cron. Refreshing localhost now uses the real review function instead of the development compatibility notice. The archive verification did not perform a restore drill or back up Storage object bytes.
