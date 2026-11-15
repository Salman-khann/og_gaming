import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('runs the actual scheduled entrypoint with the credential only in its request header', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', './tests/fixtures/worker-fetch.mjs', './scripts/run-worker.mjs'],
    {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_SITE_URL: 'https://worker.test',
        CRON_SECRET: 'test-cron-secret-for-worker-check',
      },
    },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('Application worker completed.');
  expect(result.stdout + result.stderr).not.toContain('test-cron-secret-for-worker-check');
});
