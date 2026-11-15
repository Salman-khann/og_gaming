# Namecheap inode cleanup — 27 October 2026

Executed after explicit user approval. Account: `oggafoor`; authenticated server: `premium912.web-hosting.com`; website: `oggaming.pk`.

## Result

| Measure | Before | After |
|---|---:|---:|
| Account-owned unique inodes under the home directory | 139,962 | 78,014 |
| Percentage of 200,000 backup threshold | 69.981% | 39.007% |

Exactly **61,948 inodes** recovered. Counts include hidden objects and the home directory, deduplicate hard links, and do not follow symlinks. cPanel's displayed usage may refresh later.

Only these historical dependency trees were removed:

- `/home/oggafoor/og_deploy/bracket-layout-niylXjChoCwj_C2MFm6mU/runtime/node_modules` — 20,655 entries.
- `/home/oggafoor/og_deploy/security-review-TfTMsWnviCxAMvBflNZZO/runtime/node_modules` — 20,655 entries.
- `/home/oggafoor/og_deploy/security-review-eNFF3I_Gs23swAiJ8Aiqu/runtime/node_modules` — 20,638 entries.

Historical application copies and their lockfiles remain. Using those older rollbacks now requires restoring the corresponding dependency trees from backup.

## Protection and checks

Live root: `/home/oggafoor/og_gaming`. Live build: `Mdnicb833NyezSQO2PAmw`.

The live dependency symlink still resolves to `og_deploy/security-review-Mdnicb833NyezSQO2PAmw/runtime/node_modules`. The immediate rollback dependencies in `security-review-E0HgZziAHu1EpYztugx7z/runtime/node_modules` remain intact. cPanel's `nodevenv` remains intact.

Before deletion, every candidate was restored from the authenticated off-server archive into an isolated Linux directory, one tree at a time. All file contents were SHA-256 compared to the originals; permissions, symlink targets, and full entry inventories matched. Each recovered Next.js package manifest loaded through the configured Node executable. The temporary restore directories were removed after testing. This was a dependency filesystem recovery test, not a complete application or database restore drill.

Immediately before deletion, the original trees were hashed again and matched the restore proofs. Live and immediate rollback symlinks, current build, cron references, and visible account-owned process descriptors and memory mappings were checked. No referenced candidate runtime was found. Process visibility is limited to the shared-hosting environment.

After deletion, hashes for the active environment file, Apache configuration, startup file, manifest, and build identifier were unchanged. The worker crontab was unchanged. `/`, `/matches`, `/tournaments`, `/players`, and `/api/tournaments` returned HTTP 200.

No application restart, DNS change, Apache/Passenger configuration change, database change, or new scheduled cleanup was performed.

## Recovery artifacts

Private off-server location on the user's computer:

`C:\Users\salman\.og-gaming-recovery\inode-cleanup-20261027`

- `hosting.tar.gz.aesgcm`: AES-256-GCM encrypted archive of `og_gaming`, `og_deploy`, `nodevenv`, `public_html`, and `.cl.selector`, including actual dependency targets.
- `crontab.txt.aesgcm`: encrypted worker schedule.
- `storage.jsonl.aesgcm`: encrypted Storage bucket metadata and object bytes; one object, 1,149,095 bytes. Decryption and object SHA-256 verification passed.
- `hosting-verification.json`, `restore-proof-0.json` through `restore-proof-2.json`, `cleanup-result.json`: verification receipts.
- Recovery helper scripts and `RECOVERY.md`.

Filesystem plaintext archive SHA-256: `874d1110d60d086cb7313015a410f76a7c0ec0bf040aec051639aed28f7b150d`; compressed plaintext bytes: 670,748,491. Encryption authentication passed and the source tar command completed with exit status zero.

Fresh encrypted database backup:

`C:\Users\salman\.og-gaming-recovery\before-security-review-2026-10-27T13-23-50-152Z.ogbackup`

Database encryption and archive-directory checks passed: 68 data tables, including registrations, Auth users, and Storage metadata. The temporary loopback-only backup tunnel was closed. A full isolated database restore was not performed.

The existing encryption key remains in the private parent recovery directory. No key or credential values are included in this report. These are off-server copies on this computer, not an independent off-device/cloud copy.

## Rollback

Use `RECOVERY.md` in the private directory to authenticate and decrypt the filesystem archive. Extract only the required dependency subtree into an isolated directory first. Upload it back to its exact original `runtime/node_modules` path with Linux permissions and symlinks preserved. Confirm the historical application's symlink resolves. Do not overwrite the active application or restore the database for this dependency-only retirement.

## Recurrence prevention

The root cause was a fresh ~20,000–22,000-entry production dependency installation retained for each release. Keep the live release and one immediate rollback dependency set on the host; archive and retire older sets with explicit dependency-reference checks. Continue local/CI builds and production-only dependency installation. Do not delete `og_deploy` wholesale because it contains the live runtime.

No automated retention policy was installed during this cleanup. Suggested follow-up: daily inode monitoring with alerts at 90,000 and 100,000; complete encrypted off-device backups with restore drills; bounded worker log retention. Standalone Next.js requires separate testing because the installed framework documentation says its generated server is incompatible with the current custom-server approach.
