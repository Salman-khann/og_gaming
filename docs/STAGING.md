# Isolated development and staging

Automated SQL tests run in memory using PGlite and never load hosted credentials. Browser tests start a separate Next.js build directory on `127.0.0.1:3119`, inject local placeholder credentials, and mock API/Turnstile traffic. Neither replaces integration tests against full Supabase Auth and Storage.

## Full local environment

Install Docker Desktop (or another supported Docker runtime) and start it. Docker is currently unavailable on this workstation. From the app directory, inspect the installed CLI's help, then start the local stack:

```text
npx supabase --help
npx supabase start --help
npx supabase start
npx supabase status
```

Copy `.env.test.example` to the ignored `.env.test.local`, enter the **local** URL/keys shown by status, and set a random RATE_LIMIT_SECRET. Never copy production service credentials. Apply migrations only to the local stack using the command/flags documented by `npx supabase migration up --help`. Review reset commands carefully: resets erase the selected local database.

Run the relevant test/seed scripts from the app directory. They read `.env.test.local`, or the path in `OG_TEST_ENV_FILE`. Hosted staging requires an explicit `OG_TEST_PROJECT_HOST` matching a separately provisioned project. The known production hostname is always denied. Provisioning a paid project is not part of this change.

Do not run notification delivery or import production personal information into staging. Use provider test accounts and separate CAPTCHA credentials. Keep FACEIT/OAuth redirect URLs scoped to the staging origin.

## Automated checks

```text
npm ci
npm run database:check
npm run security:check
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:ui
npm run build
```

Playwright uses installed Edge on Windows and managed Chromium on Linux. On Linux, first run `npx playwright install --with-deps chromium`; CI does this automatically. The browser server owns `.next-browser-test` and refuses to reuse an existing server. Windows must permit the test runner to stop its child process at teardown. Do not stop an unrelated development server.

## Integration checklist

Verify two independent users plus an admin and a guest browser: public nicknames only, private application ownership, contacts restricted to eligible roster members/admin, throttling and audit records, pending queue limits, concurrent approvals, duplicate `(phone,email)` rejection, real CAPTCHA missing/forged/expired/replayed tokens, and Storage cleanup after tournament deletion.

Before changing FACEIT account-linking policy, test an existing verified email, a matching unverified provider email, missing email and a distinct FACEIT subject. Confirm that identity subject and ownership remain correct. No production accounts should be created or linked for these tests.

After a migration is applied to full staging, run the installed CLI's database advisors and inspect function privileges, RLS and query plans. The in-memory suite cannot exercise hosted extensions, platform configuration, network gateways or the provider's actual identity-linking implementation.
