import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const marker = fileURLToPath(new URL('../.next/oggaming-build-origin.json', import.meta.url));
if (existsSync(marker)) unlinkSync(marker);
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'build'], {
  stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_SITE_URL: 'https://oggaming.pk' },
});
if (result.status !== 0) process.exitCode = result.status || 1;
else writeFileSync(marker, JSON.stringify({ origin: 'https://oggaming.pk' }));
