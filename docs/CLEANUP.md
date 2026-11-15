# Project cleanup — 25 October 2026

The user approved the proposed cleanup before files were moved or deleted.

Planning documents now live in `docs/planning/`. The development-plan filename no longer has the download suffix ` (1)`.

The private archive is `C:\Users\salman\og_gaming-review-archive\2026-10-25`. Its `manifest.json` records each original and destination path. It contains the legacy homepage extraction files, both Repomix exports, older deployment snapshots and historical ESLint/format reports. Archive access is restricted to the current Windows account. The current package and extracted release referenced by `.deployment/latest.json` remain in place, along with live deployment records, backup records and operational helpers.

Generated Next.js/build-test caches, browser logs, test results and TypeScript incremental metadata were deleted after stopping this project's development server. They are recreated when their commands run. Dependencies were retained. Approximately 1.42 GiB of generated files and unused assets were removed; moving archives outside the checkout does not reclaim disk space on the same drive.

The homepage now references `/site_assets/logo_0.png`. Its byte-identical duplicate `img_1.png` was removed, along with five unused starter SVGs. Application icons, root configuration, migrations, database setup, environment files and uncommitted source work were preserved.

The root `id_rsa` was preserved: it differs from the external deployment key. The external key passed a read-only SSH connectivity check, but this did not satisfy the approved identical-copy condition for deleting the root key. No key rotation or Git history rewrite occurred. This cleanup does not remove historical secret-scan findings.

Database backups remain outside the checkout in their existing recovery directory. No database or production deployment changes were made by this cleanup.

The requested additional pass archived 14 obsolete one-off deployment, repair, inspection and cleanup helper files under the private archive's `diagnostics/` folder. `additional-cleanup-manifest.json` records those moves. Disposable admin/bracket previews, the downloaded Gitleaks ZIP and the empty public-key export folder were removed. The installed scanner, current deployment/backup tooling and records remain available. The local development server was restarted after clearing its cache; running it recreates a fresh `.next/` directory.
