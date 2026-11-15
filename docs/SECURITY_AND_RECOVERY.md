# Spam protection, secrets and recovery

## Active application controls

- Public forms reject a filled `company_website` bot-trap field. The real field is hidden, excluded from keyboard navigation and has autocomplete disabled. This is an extra filter, not proof of a human; a bot can omit it.
- Match posting: 5 per hour per account (or guest IP), plus 5 per hour per normalized phone number. Signed-in accounts also share a network cap of 20 per hour.
- Tournament applications: 5 per five minutes per account (or guest IP), plus 5 per hour per normalized phone and captain email. Signed-in accounts also share a network cap of 20 per five minutes.
- Password login: 30 per minute per trusted IP and 10 per fifteen minutes per email and trusted source address, including failed attempts. Signup: 10 per hour per trusted IP and 3 per fifteen minutes per email and trusted source address. These limits sit alongside Supabase Auth's own protections.
- Match joins and team actions have account and network limits. The existing atomic Postgres rate-limit function enforces shared limits across application instances; database failure rejects the protected action rather than bypassing the limit.
- Rate-limit buckets use an HMAC with a private key, so database records do not contain raw phone numbers, email addresses, account IDs or IPs. Rejections use HTTP 429 with `Retry-After` and `Cache-Control: no-store`. The retry time is a conservative full-window estimate.

Limits deliberately allow multiple people behind a gaming-zone network, but a busy shared network may still reach the guest limit. Adjust the named limits after measuring real usage. Contact-based limits reduce abuse across rotating accounts/IPs; they do not verify ownership of a phone or email. If bot traffic persists, add a server-validated challenge and edge/WAF limits; application limits cannot absorb a large denial-of-service attack.

## Before production

1. Put a random `RATE_LIMIT_SECRET` in the hosting secret manager. Use at least 32 random bytes encoded as hex. A dedicated local key was generated in ignored `.env.local`; copy it only through a secure credential manager, never chat or source control. Keep `CRON_SECRET` random and separate.
2. On Vercel, the app trusts only its platform-provided `x-vercel-forwarded-for` address (`VERCEL=1`). On another host, configure `TRUSTED_CLIENT_IP_HEADER` and have the ingress **overwrite** that header with one validated client IP. Block direct access to the app that bypasses the ingress. Arbitrary incoming `x-forwarded-for` values and address chains are rejected. Production requests with missing/invalid trusted addresses or a missing rate-limit secret fail closed with 503; local development uses a shared development bucket.
3. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin. Run `npm run security:production` with the deployment environment loaded. This checks secret placement, origin, worker-secret length and rate-limit configuration, but cannot prove the reverse proxy overwrites headers.
4. Run `npm test`, `npm run lint`, and `npm run build`. The build automatically runs the secret check first. The scan checks tracked private files and source against recognizable credentials and currently configured secrets. It is a guard, not a guarantee that Git history or every possible credential format is safe. Use repository-host secret scanning and push protection too.

Privileged Supabase, FACEIT, Steam and notification modules are marked `server-only`; Next.js rejects importing them into browser components. The public Supabase URL and anon/publishable key are expected in browser code. Service-role keys, OAuth client secrets, database passwords, access tokens and encryption keys must never use `NEXT_PUBLIC_`.

## Account and key protection

- Enable MFA on the Supabase, hosting, DNS, source-control and backup-storage owner accounts. Keep recovery codes in a separate password manager and limit who can retrieve production credentials.
- Use project-scoped management tokens with the minimum permissions needed. Backup credentials belong in the backup runner, not the website runtime.
- If a secret is exposed, revoke/rotate the affected key with its provider, update the hosting secret, redeploy and verify dependent flows. Deleting a value from Git does not invalidate it. Inspect history and access logs without copying tokens into logs or tickets.
- Changing `RATE_LIMIT_SECRET` resets existing limits because bucket hashes change. Rotate during an incident or planned maintenance, not on every deployment. Changing the backup key does not re-encrypt older archives; retain the correct older key until its backups expire.
- Server error logging intentionally avoids raw exception objects, which may contain URLs, tokens or private request data. Do not add full request-body, cookie or authorization-header logging.

## Encrypted database backups

**A backup schedule and a verified production recovery copy are not configured by this code change.** This machine currently lacks PostgreSQL client tools and a configured backup database connection/key/destination. The commands below are ready for a dedicated backup runner; they never restore or change the live database.

Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) describes plan-dependent managed backups and PITR. Check the actual project's latest successful backup and retention in the dashboard. Keep an independent encrypted copy outside the project too: deleting a Supabase project also deletes its managed backups. Do not enable a paid add-on without reviewing its cost.

The read-only check on 16 October 2026 reported `pitr_enabled: false` and no listed backups. `walg_enabled: true` is not proof of a usable recovery point. Run `npm run backup:status` to check again with the authenticated Supabase CLI; it does not enable features or restore data.

Install PostgreSQL client tools compatible with the database server (a newer server requires a compatible `pg_dump`). Create the ignored `.env.backup.local` file with these settings, or inject them into a dedicated runner:

```dotenv
# Database connection from Supabase Connect. Prefer direct or session-mode pooler, not transaction mode.
BACKUP_DATABASE_URL=postgresql://DATABASE_USER:URL_ENCODED_PASSWORD@DATABASE_HOST:5432/postgres
# A different random 32-byte key encoded as base64; store a second copy in your password manager.
BACKUP_ENCRYPTION_KEY=
# Absolute private destination OUTSIDE the website checkout. Use encrypted off-device storage.
BACKUP_DIRECTORY=
# Optional absolute pg_dump executable path if it is not on PATH.
PG_DUMP_PATH=
# CA certificate from your database provider; TLS always verifies the hostname and certificate.
PGSSLROOTCERT=
```

Create and authenticate a backup:

```text
npm run backup:create
npm run backup:verify -- <absolute-path-to-archive.ogbackup>
```

The export uses PostgreSQL custom format, AES-256-GCM with a new random IV per archive, exclusive file creation and restrictive file modes. Plaintext streams directly from `pg_dump` into encryption; it is not saved during creation or verification. Credentials go to the child process through its environment, not command-line arguments or console output. An export/verification failure removes only the incomplete file created by that run. Existing files are never overwritten. The backup key is not included in the archive; losing it makes recovery impossible. On Windows, file modes alone do not replace private NTFS permissions and disk encryption.

Choose a backup cadence and retention that match how much tournament/payment data you can lose. A reasonable starting target is daily independent copies, retaining 7 daily and 4 weekly copies, with a monthly restore drill. Configure the backup runner's failure alerts and verify its destination is actually off-device. These are operational targets, not a schedule installed by this change. Avoid automatic deletion until the latest copy and key recovery have been tested.

## Restore drill and incident recovery

1. Pick a recent backup and retrieve its key independently of the website computer. Run `backup:verify`. This verifies authentication and the PostgreSQL archive header; it does **not** prove that a database restore will succeed.
2. Prepare a new isolated recovery database/project with compatible extensions and Supabase-managed roles. Never point a drill at production. Follow the provider's [backup and restore guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) for managed Auth/Storage schemas, ownership and grants.
3. Export a private plaintext archive only for the drill:

   ```text
   npm run backup:export -- <absolute-encrypted-archive> <new-absolute-private-output.dump>
   pg_restore --list <private-output.dump>
   ```

   Export authenticates the whole encrypted archive before creating plaintext. It refuses files in the website checkout and existing outputs. Restrict access to the recovery directory; the dump contains personal data and authentication information. Remove the private plaintext file after the drill.
4. Restore according to the provider-specific process into the isolated target. Check row counts, RLS/permissions, login configuration, registrations, private contacts, match history, payment status, bracket results and scheduled database jobs. Keep notification delivery and workers disabled in the drill so old jobs do not send messages.
5. Record the archive date, recovery duration, checks and failures without including secrets or private rows. Fix the procedure before relying on it for production.
6. In an incident, preserve logs, choose a known-good recovery point, and take a fresh encrypted copy of the current state before any destructive restore. Confirm the exact target and expected data loss before switching production.

Database dumps do not contain Supabase Storage object bytes, website assets, provider settings, DNS or hosting secrets. Back up Storage objects separately if used; keep source/migrations in a protected remote Git repository and provider/secret recovery information in the password manager. A recovery copy kept only beside its encryption key on the same laptop is insufficient.
