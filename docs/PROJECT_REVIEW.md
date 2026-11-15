# OG Gaming project review and completion status

**Current scope update (13 October 2026):** memberships/plans, promotions/referrals, disputes and application audit logging have since been removed at the user's request. The review below records the earlier implementation. See [COMMUNITY_SETUP.md](COMMUNITY_SETUP.md) for the current versioned migration setup and operator workflow.

Reviewed on 13 October 2026 against the five-page proposal and implementation plan. Existing uncommitted work was preserved. The follow-up implements the remaining scope except cabin booking/availability and online payment gateways, which the user excluded. Manual payment verification remains available.

## Completed application work

| Area | Implemented behavior |
| --- | --- |
| Teams and identity | Captains create persistent teams and invite linked FACEIT identities. Players accept their own invitations. Entries and team scrims require five accepted, eligible players with freshly verified skill; active registration locks roster changes. |
| Match board | Solo participation, atomic five-player team scrims, exact ELO balancing for ten verified players, private contact access and historical public participation summaries. Expiry removes contacts; explicit deletion also removes the summary. |
| Tournaments | Shareable event pages, verified team registration, manual fees, promo discounts, captain check-in windows and automatic no-show release. Brackets require approved, eligible teams with required payment verified. |
| Competition | Seeded single and double elimination, automatic byes, loser advancement, grand-final resets, scores and champion completion. Participant captains report disputes; unresolved disputes block result updates. |
| Administration | Paginated player/team/registration management, bans and role changes with reasons and audit records, last-admin protection, disputes, delivery retries and venue content publishing. |
| Memberships and growth | Plans, manually verified passes, activation terms, remaining minutes and recorded usage, bounded promo redemptions, referral codes, sponsor/gallery/stream publishing. Membership use does not reserve cabins or time slots. |
| Community | Public profiles, tournament participation, retained match summaries and paginated FACEIT rankings excluding banned/ineligible candidates. |
| Analytics | Actual player/team counts, recent activity, verified revenue, check-in/no-show rates and peak match-posting hours in Pakistan time. |
| Notifications | Transactional event queue, Telegram/email fanout, bounded leased batches, receipts, retries and email idempotency. Provider credentials and scheduling are deployment prerequisites. |
| Scale and abuse controls | Database-backed request limits, bounded body parsing, indexed/paginated lists, cached provider reads, bounded background refresh, cancelled superseded UI requests and account-scoped loaded data. |

## Bugs and security fixes

- Public profile grants exclude private phone numbers; draft tournament registrations no longer leak through their own read policy.
- Restricted joins require verified FACEIT identity. No fabricated rank or ELO is used to qualify a player.
- Guest creation and deletion credentials are committed together; team posting and joins are atomic.
- Invalid JSON, arrays, oversized bodies, invalid IDs and boolean/null scores return validation errors. Cross-origin writes are rejected.
- Banned accounts cannot retain successful login state or enter new verified rosters. Authorization reads stored roles rather than editable user metadata.
- Account, bracket and resource refreshes cancel stale requests and isolate data by account and page.
- Bracket loading failures have explicit retry states. Score corrections cannot overwrite played dependent games.
- Notification event keys tolerate repeated status updates; claims use leases and row locks. Private trigger helpers are outside the exposed API schema.
- Mobile navigation stays within the viewport. Canvas animation pauses when hidden, honors reduced motion and avoids zero-distance division.
- Tournament eligibility and bracket settings cannot silently change after approved entries; membership prices and discounts are snapshotted and usage cannot overdraw a pass.

## Verification

- `npm test` passes provider, input, notification, balancing and bracket tests, all fourteen migrations and rollback-only Postgres workflow fixtures.
- SQL checks cover RLS, ownership/consent, private contacts, team scrims, fees/promos, passes, role protection, no-shows, disputes, notification leases, history and ranking eligibility. Actual SQL bracket simulations cover 2–128 entrants, single/double elimination and reset finals.
- Type checking, linting, production compilation and local read-only HTTP smoke checks pass. Phone-width navigation was inspected in the browser.
- Production dependency audit reports zero vulnerabilities. The full audit reports nine high-severity package reports from one unpatched development-tooling braces advisory; forced tool/framework downgrades were not applied. See the [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- PGlite validates real Postgres SQL and permissions but does not implement hosted Auth/PostgREST, pg_cron scheduling or concurrent database connections. Full provider login and real notification delivery require configured services and accounts. Automated delivery tests use mocks and send no external messages.

## Hosted activation

The follow-up security/performance audit applied a fourteenth migration and additional application fixes. See [SECURITY_PERFORMANCE_AUDIT.md](SECURITY_PERFORMANCE_AUDIT.md) for findings, measured API samples, verification and remaining limits.

The configured hosted database was upgraded on 13 October 2026 after CLI authentication. Its eight existing migrations were inspected; only the five missing security/feature migrations were applied together in a transaction and recorded in migration history. All thirteen migrations are now installed. RLS is enabled on every public table, anonymous phone reads and privileged mutations are denied, and the expiry/no-show/rate-limit cleanup Cron jobs are active. Read-only hosted Data API checks passed for the new tables, ranking and analytics. Never rerun the combined setup over an existing installation.

Supabase security/performance advisors returned one warning: leaked-password protection is disabled. Supabase documents this feature as available on Pro and above; no billing upgrade was made. See [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Real Telegram/email delivery and the app worker still require provider credentials and deployment scheduling.

The generated supabase/setup.sql is for a new installation. See [COMMUNITY_SETUP.md](COMMUNITY_SETUP.md) for feature operation, notification credentials and worker scheduling.
