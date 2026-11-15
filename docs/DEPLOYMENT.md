# Hosting checklist

This application requires Next.js server hosting. Login, private contacts, tournament applications, administration and workers use server routes; a static-file upload cannot run those features.

## Build and run

- Install from the lockfile with `npm ci`.
- Build with `npm run build`.
- For a Node server, run `npm start` with the host's assigned `PORT`.
- Run `npm test`, `npm run lint` and `npm run typecheck` before deployment.
- Follow [Security and recovery](SECURITY_AND_RECOVERY.md), configure the production rate-limit secret and trusted ingress, and run `npm run security:production` with deployment settings loaded.

## Production environment

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and the final HTTPS origin in `NEXT_PUBLIC_SITE_URL`. Keep the service role key in server environment settings. Do not upload `.env.local` into public files.

`FACEIT_API_KEY` supports FACEIT login/profile data, verified team scrims and rankings. Open tournament applications do not require FACEIT verification. The configured FACEIT client is registered with Supabase; its provider callback stays at the Supabase Auth callback URL.

For background processing, set a generated `CRON_SECRET` and schedule an authenticated request to `/api/worker` at an interval supported by the selected hosting plan. Database expiry cleanup runs separately in Supabase Cron; tournament no-show rejection is retired. Optional email/Telegram alerts need the channel credentials listed in `.env.example`. Apply the latest [tournament schedule/reset migrations](TOURNAMENT_SCHEDULES.md) to enable admin bracket resets confirmed with the signed-in administrator's account password.

## Login URLs

Once the public origin is known, configure Supabase Auth's site URL and allow `<public-origin>/auth/callback`. Retain localhost callback access if local development continues. `NEXT_PUBLIC_SITE_URL` must use the deployed origin so Steam and other redirects return to the hosted site.

For FACEIT, open the app's OAuth2 client in the FACEIT Developer Portal and set its Redirect URL to `<supabase-project-url>/auth/v1/callback`. Use this URL for local development too. Set `FACEIT_REDIRECT_URI` to the same value, then run `node scripts/configure-faceit.mjs` to configure Supabase. The script cannot update the FACEIT portal. The login flow is FACEIT → Supabase `/auth/v1/callback` → application `/auth/callback`; `/api/auth/faceit/callback` is not an application route. If account selection stalls on `accounts.faceit.com`, verify the portal's registered Redirect URL and inspect the failed request in the browser's Network panel.

## Upload and verification

Include the application source, `public/` assets, package manifest/lockfile and build configuration. Exclude local secrets, Git metadata, generated build/cache files and private proposal documents. Keep database setup/migration scripts outside public assets; do not rerun setup on the existing database.

After deployment, verify public pages, HTTPS, team applications, login redirects, admin access controls, contact privacy and the worker's authorization. Real provider login needs the corresponding account. Add a custom domain only after the hosting project and DNS destination are confirmed.
