# Session reliability, registration cancellation and formatting — 26 October 2026

Deployed build: `E0HgZziAHu1EpYztugx7z`. Private deployment/rollback records are in `.deployment/live-deployment.json`. This release preserves the existing production environment and worker schedule.

## Sessions

The Next.js Proxy refreshes Supabase tokens before rendering, forwards rotated cookies to the downstream request and browser, and makes cookie-bearing responses private. Anonymous requests skip the Auth refresh path. Static assets are excluded. Both the Proxy and server client retain HttpOnly, SameSite=Lax and production Secure cookies.

The account UI retains its last verified display through transient network/provider failures, retries while visible and on focus/network recovery, and clears the account when the server confirms sign-out or revoked access. Protected routes continue to verify identity and permissions server-side; retained UI state does not authorize requests. Opportunistic guest-application recovery no longer makes an otherwise valid account response fail.

Ordinary logout now ends only the current device's session. A temporary profile lookup outage after login no longer triggers a global sign-out. Server authentication helpers distinguish an ended session from temporary unavailability; the administrator page shows an availability error rather than redirecting a user to login during an Auth outage.

## Cancel registration

Each tournament registration in the admin Teams view and tournament registration list has a cancellation button. Its dialog requires the currently signed-in administrator's account password. Verification is isolated from the browser session, checks the verified identity, revokes only the temporary verification session, and is rate limited before any cancellation write. Passwords are not persisted or logged.

The service-only cancellation RPC checks administrator role and locks the tournament/entry. It refuses cancellation after bracket generation. Successful cancellation marks the entry rejected with `cancelled_at`, removes it from active lists and retains team/payment history. Repeated cancellation is idempotent; a cancelled entry cannot be re-approved. The account may submit a new application because the captain uniqueness index applies only to uncancelled rows. Existing payment records remain unchanged; no payment transaction is performed.

Migration `20261025194651_registration_cancellation.sql` is applied. It also excludes cancelled guests from account recovery. The migration does not cancel existing registrations. No real registration was cancelled during verification.

## Description and rules formatting

The editor has selection-aware controls for bold, italic, strikethrough, headings, bullets, numbered lists, quotes, links, inline code and tables, plus a preview. The existing 4,000/8,000-character limits remain. Descriptions and rules render Markdown/GFM on public tournament cards and event pages. Existing plain text continues to display.

Rendering uses pinned `react-markdown` and `remark-gfm`, with raw HTML skipped and the renderer's safe URL handling retained. Formatting tests cover lists/tables/emphasis and rejection of scripts/JavaScript links. The same renderer powers previews and public content.

## Validation and recovery

Passed: 52 unit tests, the full regression/isolated SQL suite including brackets through 128 entrants, ten browser tests, TypeScript, lint, formatting, source secret checks and the production build. The production dependency audit reports no vulnerabilities. The token-rotation integration test uses the actual Supabase SSR client with a mocked Auth HTTP boundary. Browser admin tests use a loopback-only synthetic Auth fixture and exercise the real server-side page guard; no production authentication bypass was added.

A verified encrypted database backup was created before migration; the temporary approved tunnel was closed. The server deployment also created an application rollback archive and passed private runtime/environment checks before activation. Live checks confirm the new build, public pages/assets/APIs, privacy boundaries, protected-route denial, origin enforcement, invalid CAPTCHA rejection and private cache headers for session-cookie requests. Hosted advisors report only the existing leaked-password protection warning. Historical secret-scan findings and declined SSH rotation remain documented separately.

Actual user passwords and an hour-long live session were not used for automated testing. If an earlier session was already invalidated, the user must sign in once again; the release cannot recover a revoked refresh token.
