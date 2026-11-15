# Account applications and readable player URLs — 25 October 2026

Deployed build: `eNFF3I_Gs23swAiJ8Aiqu` at `https://oggaming.pk`. This release also includes the previously local second/third review fixes and shimmer/loading changes. Its private deployment, rollback and backup records are in `.deployment/live-deployment.json` and `.deployment/security-backup.json`.

## Account registration behavior

Signed-in applications are associated with the authenticated account, independently of browser cookies. Verified email/password accounts must use their account email as the captain email, preventing an application from silently belonging to a different login than its contact address. The form prefills that email and explains the account association.

On account/session refresh, verified, active accounts recover guest applications whose captain email matches their verified Auth email, ignoring case. The database derives identity from the session rather than a supplied account ID. Recovery affects only unowned applications before their bracket begins; it never reassigns an application already owned by someone else. Unverified and banned accounts cannot claim. Browser credentials continue to support guest submissions. Guest-only use without a verified account remains browser-specific.

An existing application had a different stored owner even though its contact email matched the account used on both devices. The user explicitly authorized correction of that one application. A guarded transaction required one matching application, a confirmed active target account and an unstarted bracket. Only its captain account changed; team and payment fields were preserved. Authenticated RLS subsequently confirmed that the target account can see it. No other previously owned application was reassigned.

Tournament lists wait for account resolution. Individual event pages refresh when the established account differs from their server-loaded viewer, avoiding stale anonymous application displays after login. Current account email is shown to its signed-in owner only.

## Player addresses

Registered players receive a stable unique `public_slug` derived from their initial player name, such as `/players/ali`. Duplicate names use a short suffix, such as `ali-2`. Names without usable ASCII letters/digits receive a `player` fallback. A private trigger allocates slugs under an advisory transaction lock; later name changes preserve existing links and users cannot replace their allocated slug. UUID profile links remain supported and redirect to the readable address. Legacy unlinked FACEIT records retain their existing identifier lookup until linked to a local account.

The player API accepts validated slug lookups, keeps the UUID lookup compatible, rejects unknown/banned profiles, and continues to restrict public history to approved entries in published events.

## Loading and operations

The initial Arena shimmer is centered, uses fixed character cells and remains visible for at least 600 ms. It animates throughout long loads. Existing cards remain visible during background refreshes. Very fast route fallbacks have a short reveal delay to prevent a flash.

The application retained its server environment and existing worker credential. The matching private worker runner is scheduled every five minutes; other cron entries were preserved. The release has a verified application rollback archive. The fresh encrypted database backup was authenticated and its archive directory checked for application tables, Auth users and Storage metadata. It is not a restore drill or a backup of Storage object bytes. The temporary backup tunnel was explicitly approved and closed after verification.

## Verification

- Full regression and isolated SQL suite, including brackets through 128 entrants.
- 42 passing unit tests; seven mocked browser tests, including mobile/desktop loading and payment status without guest cookies.
- TypeScript, lint, formatting, source security checks and optimized production build.
- Hosted checks for anonymous/service-role denial of the session-bound claim API, authenticated execution and unique public slugs.
- Live public pages, assets, APIs, origin enforcement, privacy boundaries and rejection of invalid CAPTCHA tokens.
- Real-browser verification at 1440 px and 390 px: UUID links resolve to `/players/ali`, profile data loads and there is no horizontal page overflow.

Migrations `20261025121410_readable_player_urls.sql` and `20261025121708_verified_account_applications.sql` are applied. Hosted security advisors report only the existing `auth_leaked_password_protection` warning. Historical secret-scan findings and deferred SSH rotation remain recorded in the earlier review notes. Production login with the user's password and human CAPTCHA completion were not automated.
