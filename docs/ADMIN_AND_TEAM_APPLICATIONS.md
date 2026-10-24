# Admin and tournament entry update

## Admin dashboard refresh — 18 October 2026

Deployed to https://oggaming.pk with build `kxEaUY2w8M9ysoRCst4Xk`. Production build, lint, existing regression suite, new UI interaction tests and isolated Postgres checks passed. Separate headless previews verified desktop and 390px mobile layouts without navigating the user’s browser; no horizontal page overflow was found. Live public pages/styles returned 200, anonymous analytics/deletion returned 401, foreign-origin deletion returned 403, and FACEIT/Steam login starts returned their expected provider redirects. No live tournament was deleted during verification.

- Tournament creation and editing use an accessible popup. Tournament cards provide Edit, Manage bracket and Delete. Deletion requires the exact current title, checks administrator access on the server, and atomically removes the bracket, entries and private application contacts. It does not issue refunds. Historical activity logs remain.
- Analytics uses actual registration records aggregated across all pages in Postgres, with 7/30/90-day and tournament filters. Daily figures include zero-activity days; approval distribution and verified/unverified entry fees reflect the entries submitted in the selected period. They are not payment processor balances. Dates use Pakistan time. No estimated traffic or growth data is shown.
- The Teams tab defaults to tournament applications, including guest entries, with roster, payment, approval and check-in states. A separate FACEIT squads directory shows teams created on the public Teams page and their accepted/invited members. Search is available in both directories.
- Notifications is now Activity, with readable event descriptions, event-type and delivery-status filters, compact rows and retry for failed deliveries. An explicit message explains when external delivery is not configured.
- Migration `20261017193133_admin_dashboard_reporting.sql` adds restricted reporting/deletion RPCs and reporting indexes. It does not remove existing tournaments. `tests/admin-dashboard.sql` exercises filtering, sums, permissions, exact-title confirmation, cascading deletion and isolation from other events in an in-memory Postgres database. `tests/admin-dashboard.test.mjs` covers UI interactions and supports private fixture previews with `--preview`.

## Manual bracket matchups — 15 October 2026

In Administration → Tournaments, choose **Manage bracket**, then **Manage matchups**. Select Team A and Team B for each opening match. Choosing an already assigned team swaps it with the team in that slot. Empty slots receive byes, but every match must contain at least one team and each entrant must appear exactly once.

Before generation, the choices include approved, eligible teams with required payment verified. **Generate bracket** saves the chosen matchups and closes registration. An existing, unplayed bracket can be rearranged using **Save matchups**; its match IDs and progression links remain intact, and automatic byes are recalculated. Once any scores are recorded, opening matchups lock. Later rounds always follow the recorded winners and losers.

Migration `20261015122425_admin_bracket_pairings.sql` installs the server-only function for atomic pairing edits. Public and ordinary authenticated clients cannot execute it directly. The server routes check administrator access. New installations include this function in `supabase/setup.sql`.

## Earlier updates

13 October 2026.

- Tournaments is a tab in the same operations menu as Players, Teams, Analytics, Notifications and Community content. Its editor, registration review and bracket management appear only in that tab.
- Admin cards use light neutral surfaces, dark readable text and OG Gaming orange accents. The site's remaining brown panel colours were replaced with neutral blue-grey surfaces.
- Next/Previous and page-number controls are removed. Lists show a single Load more action only when more records exist; previously loaded records stay visible.
- Player details show account role, FACEIT connection status, joined date and last-active date in Pakistan time. Unlinked accounts do not display their database's default FACEIT level/ELO. Raw column names and ISO timestamps are hidden.
- Tournament registration opens a five-player team application form. Guest, email and Steam accounts can apply; FACEIT verification, linked teams and invitations are not required. Captain name, phone, email, team name, five distinct player names and rules agreement are required. City, game/profile IDs and notes are optional.
- Contact fields and guest ownership hashes are held in a separate server-only table. Public application rosters do not expose captain contact details. Guests use a private browser cookie to see pending entries and check in; signed-in entries also belong to their account. Keep that browser if applying as a guest.
- Manual fees and staff approval remain. Entry prices are snapshotted; paid entries must be verified before approval. Guest and unlinked teams can check in and enter single/double elimination.
- Copy event link copies the public event URL for sharing. Open event opens that URL in a new tab; event detail pages include All tournaments and hide the redundant self-link.
- Publish to Community adds sponsor links, gallery images or YouTube streams to `/community`. It does not create an event. The form explains the destination and links to the public page; gallery publishing requires an image URL.

Migration `20261013131956_open_team_tournament_applications.sql` is applied to the configured project. New installations can use the regenerated `supabase/setup.sql`; existing installations apply only missing migrations.

Verification covers the production build, type checking, lint, server-render regression checks, all migrations and Postgres workflows. A temporary hosted event was created and cleaned up to verify guest registration, contact privacy, ownership, fee approval, check-in and its public URL. No provider verification or external notification delivery was used. Browser visual inspection was blocked by declined browser permission, so layout has not been visually verified in this turn.
