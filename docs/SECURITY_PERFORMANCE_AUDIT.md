# Follow-up security and performance audit

**Subsequent scope change:** memberships/plans, promotions/referrals, disputes and application audit logging were removed at the user's request. This report records the earlier audit; the security fixes for remaining features are retained. See [COMMUNITY_SETUP.md](COMMUNITY_SETUP.md) for the current feature set.

13 October 2026. Reviewed authentication, provider calls, write authorization, database grants/RLS, team and match eligibility, background jobs, request validation, pagination and notification delivery. Cabin booking and gateway payments remain outside the requested scope. Existing uncommitted work was preserved.

## Confirmed findings and fixes

| Finding | Impact | Fix |
| --- | --- | --- |
| Invitation acceptance locked the destination team but not the player. Simultaneous invitations to different teams could each observe fewer than five memberships. Creating a team also ignored memberships accepted in other teams. | Inconsistent roster limits and more background/provider work than intended. | Lock the player before the team during acceptance; enforce the combined five-team limit during creation. |
| Signed-in solo/gather hosts were added to restricted matches without applying the eligibility check used for joining. | An unlinked or out-of-range host could occupy a restricted roster slot. | The insert trigger now checks the linked identity and level for signed-in hosts. Verified five-player scrims retain their separate full-roster check. |
| Public leaderboard reads loaded up to 100 profiles, 100 registration rosters and 1,000 bans, then another cache list, before returning a page. | Excess payload, round trips and incomplete candidate warming as the population grows. | Return the paginated ranking RPC immediately. A server-only SQL candidate query warms up to eight stale eligible players; a persisted global one-minute gate prevents provider amplification across app instances. |
| Failed FACEIT refreshes left profiles at the beginning of the worker's oldest-first list. | An unavailable account could repeatedly occupy a refresh slot while later accounts remained stale. | Record attempt time before calling the provider, rotate by that timestamp with deterministic ordering, and add a matching partial index. |
| Notification delivery could spend ten seconds per provider call across multiple batches/passes, in addition to worker statistics refresh. | Timeouts, unfinished batches and later duplicate attempts after lease expiry. | A shared 20-second delivery budget, five-second provider limits and release of unprocessed claims without consuming retry attempts. |
| Login/signup and fresh team-join verification lacked dedicated application throttles. | Avoidable brute-force/provider traffic and database load. | Persisted limits: 30 password attempts/minute, 10 signups/hour per trusted address, and 10 team joins/minute per player. Self-hosted proxy configuration remains required for distinct client-address buckets. |
| Account reads wrote activity timestamps on every request. | Unnecessary row updates, index/WAL work and misleading precision. | Update only when the last recorded activity is older than fifteen minutes. Analytics now has approximately fifteen-minute activity precision. |
| Tournament fee parsing coerced booleans/null into currency amounts. | Invalid request types could create unintended charges or free events. | Shared money validation rejects these types, non-finite amounts, negative values, excessive amounts and fractions smaller than a paisa. |
| Search patterns retained backslashes; pagination sorted nonunique names/timestamps without a tie-breaker. | Incorrect search matching and unstable page boundaries for equal values. | Remove wildcard/escape characters and add stable ID ordering. |
| No explicit frame/response security headers were configured. | The app could be embedded in an attacker-controlled frame. | Deny framing; add nosniff, restrictive camera/microphone/location permissions and a referrer policy; disable the framework identification header. |

The previously suspected check-in lock-order issue was ruled out: the latest functions already lock the tournament before its registration. No speculative fix was applied there.

## Measured checks

Eight sequential warm reads per route were measured against a local production preview connected to the hosted database. The current dataset is small and its leaderboard is empty; these are latency samples, not capacity benchmarks or production load tests.

| Route | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Leaderboard API | 147 / 177 ms | 146 / 173 ms |
| Matches API | 141 / 145 ms | 144 / 151 ms |
| Players API | 138 / 140 ms | 134 / 144 ms |

The changes are within ordinary network variation. No meaningful latency percentage improvement is claimed. The concrete leaderboard improvement is less synchronous database work: one ranking RPC instead of up to five queries on a populated leaderboard. Before/after samples and payload sizes are saved in `API_METRICS_BEFORE.json` and `API_METRICS_AFTER.json`.

A hosted read-only EXPLAIN sample for the ranking RPC completed in 4.434 ms, with no temporary reads/writes or shared-block writes. This is also a small-data sample and does not establish peak throughput.

## Verification and hosted status

- Fourteen migrations and seven rollback-only SQL fixtures pass in isolated Postgres, including the new host/team-cap regressions and full single/double bracket simulations up to 128 entrants.
- Provider/input tests and mocked notification tests pass; deadline expiry leaves notices pending and preserves their retry budget. These tests send no external messages.
- Type checking, lint, production build, ten-page HTTP smoke tests, response-header assertions and six feature API checks pass.
- Read-only hosted tests confirm public/server API access, ranking and analytics, private phone denial and anonymous privileged-RPC denial.
- The new migration `20261013120944_audit_reliability_and_refresh.sql` was applied transactionally and recorded in the configured project's history. Hosted checks confirm its eligibility guard, invitation lock, refresh index and private candidate RPC.
- No application hosting deployment was performed. The source and local production build are updated; the database migration is active.

## Remaining limits

- Production dependency scan: zero reported vulnerabilities. Full scan: nine high-severity reports stemming from the unpatched development-tooling [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Forced framework/tool downgrades were not applied.
- Hosted security/performance advisors returned one warning: leaked-password protection is disabled. This requires a supported Supabase plan; no billing change was made. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Real notification credentials and the app worker schedule still need deployment configuration. The database's cleanup/no-show Cron jobs are active.
- PGlite does not prove behavior under multiple real database connections. The invitation locking change was reviewed for consistent ordering, but no concurrent hosted mutation load test was performed.
- No claim is made that the project is vulnerability-free. Browser Core Web Vitals, large-population load capacity and full authenticated provider workflows need representative traffic/accounts; the measured sample cannot establish them.
