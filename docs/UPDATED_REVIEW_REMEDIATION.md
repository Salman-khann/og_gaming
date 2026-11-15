# Second review fixes — 25 October 2026

Deployment update: this pass is included in deployed build `eNFF3I_Gs23swAiJ8Aiqu`; its private worker schedule is installed. See [the release record](ACCOUNT_AND_PROFILE_UPDATE.md). The local-only statements below describe the earlier review stage.

This pass implements findings A–D from the second review. The application changes remain local and **not deployed**. Migration `20261025095522_durable_scorecard_cleanup_and_team_pages.sql` and the subsequent third-review migration were applied on 25 October 2026 at the user's request after a verified backup; see [the database rollout record](THIRD_REVIEW_REMEDIATION.md). The previous security release, build `TfTMsWnviCxAMvBflNZZO`, remains live. The review's statement that the earlier security migration/application were still undeployed was based on an older export; see [the deployment record](REVIEW_REMEDIATION.md).

The user requested **code fixes only**. The deployment SSH key was not rotated.

## A — Team retrieval

`read_my_teams` derives identity from the authenticated database session. It returns selected team/member fields, an accurate count and pages of 25 teams. No caller-supplied account ID selects another user's data. Owned teams sort first so the match form's captain-team selector still receives all owned teams under the existing five-team creation limit.

Accepted memberships and unexpired invitations remain available; removing invitations would break the acceptance flow. Roster reads join only the current team page and continue to obey existing RLS. The Teams page has Previous/Next controls and returns to page 1 after a successful mutation. The former global 500-member read and separate ID-discovery query are gone.

## B — Durable screenshot cleanup

The restricted `storage_cleanup_jobs` table stores bucket, path, attempts, next attempt, status and a token/expiry for the current worker lease. Jobs have no FK to tournaments/matches, so deleting those records cannot erase the recovery path.

Database triggers capture old paths in the same transaction as scorecard replacement/deletion, including cascades from tournament deletion and bracket resets. New uploads reserve delayed cleanup **before** contacting Storage. A failed save accelerates that existing reservation, and a crash leaves it available for retry after 15 minutes.

The worker claims at most five deletions per call with 90-second leases and `SKIP LOCKED`. Referenced paths are retained. It rechecks active references before Storage deletion; a database guard prevents attaching a path once a deletion attempt has begun. Failed Storage calls remain pending with increasing retry delays capped at one hour. An expired lease recovers interrupted jobs; a stale worker cannot acknowledge a replacement lease. Storage requests have an eight-second timeout, and repeated deletion is safe if acknowledgment fails after the object was already removed.

Mutations wake the worker after responding. The authenticated `/api/worker` also drains jobs so retries do not depend on another user action. Its credential stays in the server environment. This protects new uploads/deletions; objects orphaned before this migration still require a separate Storage inventory audit because their deleted references cannot be reconstructed from the new queue.

At deployment, install a private hosting cron entry to invoke the packaged runner every five minutes (or verify an existing authenticated worker schedule):

```text
*/5 * * * * /home/oggafoor/nodevenv/og_gaming/24/bin/node /home/oggafoor/og_gaming/scripts/run-worker.mjs >> /home/oggafoor/og_deploy/worker.log 2>&1
```

The runner loads the application's production environment and sends the Bearer credential in memory; the credential is absent from cron command arguments and output. No cron job was installed during this code-only pass. Persistent retries require this schedule when the release is deployed. Monitor pending jobs and attempts, and investigate Storage permission/network failures rather than deleting queue rows.

## C — FACEIT errors

Only the explicitly defined `FaceitError` messages/statuses reach callers. Unexpected errors use `apiError`: HTTP 503 with a generic message and correlation ID, with scrubbed diagnostics kept server-side. Expected errors are also marked `no-store`.

## D — Browser mutation origin

Every existing browser-mutation call to `sameOrigin` now requires an explicit Origin matching the configured site origin. Missing Origin, `null`, foreign origins, and cross-site Fetch Metadata are rejected. The configured public HTTPS origin takes precedence over an internal proxy URL; forwarded-host input cannot override it.

The Bearer-authenticated worker GET and state/provider-validated OAuth callbacks remain separate documented protocols; they do not use the browser mutation helper. Non-browser clients of browser mutation APIs must send the canonical Origin as well as their normal credentials.

## E — CSP and deferred operational work

CSP remains report-only. The bundled Next.js 16.4.3 CSP guide explicitly states that nonce-based CSP is incompatible with Partial Prerendering because static shell scripts cannot receive a per-request nonce. This application enables Cache Components and Partial Prefetching. Switching to enforced nonce CSP therefore needs an explicit rendering/caching decision and browser integration tests; adding a header alone would not complete this finding safely. Hash-based alternatives also require validation for the actual build/runtime and third-party scripts. No claim of enforced script protection is made.

SSH rotation, real provider identity-linking collision tests, and a human CAPTCHA completion remain operational follow-ups. The prior explicit request to skip full staging was preserved; this pass used isolated SQL and mocked browser/API tests and did not create a paid resource or mutate production.

## Verification and rollout

Passed at this review stage: the full regression suite, the versioned migrations in isolated Postgres, a 515-membership pagination fixture, cleanup replacement/cascade retention, retry/backoff/lease/reference guards, brackets through 128 entrants, 26 Vitest tests, four Playwright browser tests, TypeScript and an optimized production build. Lint, formatting, database setup consistency and the source secret scan were also checked. The actual cron entrypoint was exercised with a mocked HTTP boundary to verify module loading and private Bearer-header handling. See [the third review notes](THIRD_REVIEW_REMEDIATION.md) for subsequent changes, expanded verification and historical secret-scan findings.

Deploy this migration with its matching application after a verified backup. The new teams API and upload reservation require the new RPCs. Configure/verify the worker schedule, run hosted advisors, and exercise real Storage retries after deployment. Do not copy local development credentials over the server's production environment. No production deployment, key rotation or historical Git rewrite was performed in this pass.
