# Upload OG Gaming to oggaming.pk

This archive is a prebuilt Node.js application, not a static website. Its public origin is https://oggaming.pk. It contains no private environment file or database backup. Keep the ZIP and application directory outside public_html.

## 1. Upload and extract

1. Namecheap > Hosting List > Go to cPanel > File Manager.
2. In the account home directory, create `og_gaming` alongside `public_html`, not inside it.
3. Open `og_gaming`, upload the ZIP, and extract it there.
4. Confirm `server.js`, `package.json`, `next.config.js`, `public/` and `.next/` are directly inside `og_gaming`. Enable Show Hidden Files to see `.next`.
5. Delete the uploaded ZIP after extraction. Preserve the local original.

## 2. Create the Node application

In cPanel > Setup Node.js App > Create Application:

| Setting | Value |
| --- | --- |
| Node version | 24.x |
| Mode | Production |
| Application root | og_gaming |
| Application URL | oggaming.pk, path `/` |
| Startup file | server.js |

Create the app and use **Run NPM Install** to install runtime packages on Linux. If using the cPanel terminal, activate the Node environment using the exact command shown by cPanel, change to the app root, then run `npm ci --omit=dev`. Do not upload Windows node_modules. This runtime package is already built; do not run `npm run build` on shared hosting. Configure the canonical domain as oggaming.pk and redirect www to it through cPanel.

## 3. Enter private runtime variables

Use cPanel's application Environment Variables fields. Copy the real values from your private local configuration or credential manager; do not paste them into chat or public files.

```text
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://oggaming.pk
NEXT_PUBLIC_SUPABASE_URL=<same project URL used for this build>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same anon/publishable key used for this build>
SUPABASE_SERVICE_ROLE_KEY=<server credential>
FACEIT_API_KEY=<FACEIT data API key>
RATE_LIMIT_SECRET=<private existing random rate-limit key>
CRON_SECRET=<strong separate worker secret>
TRUSTED_CLIENT_IP_HEADER=x-og-client-ip
```

Add STEAM_WEB_API_KEY and complete notification-channel settings only if you use them. FACEIT Connect's client secret stays configured in Supabase, and is not needed in the website runtime.

The live oggaming.pk account uses LiteSpeed. Its public_html/.htaccess establishes the trusted address from the actual connection and overwrites any visitor-supplied value:

```apache
RewriteEngine On
RewriteRule ^ - [E=OG_CLIENT_IP:%{REMOTE_ADDR}]
RequestHeader unset X-OG-Client-IP
RequestHeader set X-OG-Client-IP "%{OG_CLIENT_IP}e"
SetEnv TRUSTED_CLIENT_IP_HEADER x-og-client-ip
```

These directives belong outside cPanel's managed configuration blocks. They are already installed on the live account, and a controlled six-request test with changing spoofed headers confirmed the limiter used the real connection address. On a different hosting account, verify equivalent behavior before trusting the header. Without a trusted address and RATE_LIMIT_SECRET, protected submissions fail closed with 503.

## 4. Domain, SSL and login

Point the domain to the Namecheap hosting account and enable SSL in cPanel. The application expects the HTTPS origin https://oggaming.pk. The startup file reconstructs Next's public origin from this setting so Passenger's internal port does not cause form-origin errors.

In Supabase Authentication > URL Configuration:

- Site URL: https://oggaming.pk
- Additional redirect URL: https://oggaming.pk/auth/callback

Keep FACEIT's registered callback at your existing Supabase Auth callback, ending `/auth/v1/callback`. Do not rerun database setup or change provider secrets just to deploy the website. The database remains hosted in Supabase.

## 5. Start and verify

Save the variables, then use Start/Restart App. Verify the homepage and static images/styles, FACEIT and Steam/email login, guest match posting, tournament applications, administrator access and contact privacy. A 503 on protected submissions often means the trusted IP or rate-limit settings are incomplete; a startup error should be checked in the cPanel application log. Native packages such as sharp must be installed on the Linux host.

The startup file supports command-line startup and module loading by LiteSpeed or Passenger. It was verified on the live Namecheap LiteSpeed account on 16 October 2026. Hosting memory/process restrictions still apply, and Linux runtime dependencies must be installed before starting.

Background workers and independent encrypted backups require separate configuration; uploading this ZIP does not schedule them. Keep backup credentials and archives off the web host. See the source project's SECURITY_AND_RECOVERY.md for the recovery procedure.

For later updates, run `npm run build:namecheap` and `npm run package:namecheap` from the source checkout. Never edit the compiled bundle or mix .next files from different builds. Back up the working deployment before replacing it.
