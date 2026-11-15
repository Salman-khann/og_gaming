// Run with the application's Node runtime from a private cron job. Never pass
// the Bearer credential through shell arguments or print it in cron output.
import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';
nextEnv.loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)), false, { info() {}, error() {} });
try {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  if (origin.protocol !== 'https:' || origin.username || origin.password || !process.env.CRON_SECRET) throw new Error();
  const response = await fetch(new URL('/api/worker', origin), {
    headers: { Authorization: 'Bearer ' + process.env.CRON_SECRET },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error();
  console.log('Application worker completed.');
} catch {
  console.error('Application worker failed; check private server logs.');
  process.exitCode = 1;
}
