# Admin and tournament entry update

## Manual bracket matchups — 15 October 2026

In Administration → Tournaments, choose **Manage bracket**, then **Manage matchups**. Select Team A and Team B for each opening match. Choosing an already assigned team swaps it with the team in that slot. Empty slots receive byes, but every match must contain at least one team and each entrant must appear exactly once.

Before generation, the choices include approved, checked-in, paid and eligible teams. **Generate bracket** saves the chosen matchups and closes registration. An existing, unplayed bracket can be rearranged using **Save matchups**; its match IDs and progression links remain intact, and automatic byes are recalculated. Once any scores are recorded, opening matchups lock. Later rounds always follow the recorded winners and losers.

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

Migration `20261013131956_open_team_tournament_applications.sql` is applied to the configured project. It is the sixteenth migration. New installations can use the regenerated `supabase/setup.sql`; existing installations apply only missing migrations.

Verification covers the production build, type checking, lint, server-render regression checks, all migrations and Postgres workflows. A temporary hosted event was created and cleaned up to verify guest registration, contact privacy, ownership, fee approval, check-in and its public URL. No provider verification or external notification delivery was used. Browser visual inspection was blocked by declined browser permission, so layout has not been visually verified in this turn.
