import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
try {
  const ref = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname)?.[1];
  if (!ref) throw new Error('Set the configured Supabase project URL.');
  const windows = process.platform === 'win32';
  const executable = windows ? 'powershell.exe' : 'npx';
  const args = windows
    ? ['-NoProfile', '-Command', `npx.cmd --no-install supabase backups list --project-ref '${ref}' --output json`]
    : ['--no-install', 'supabase', 'backups', 'list', '--project-ref', ref, '--output', 'json'];
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error('Backup status unavailable. Configure Supabase CLI access with a scoped project token.');
  const data = JSON.parse(result.stdout);
  const count = Array.isArray(data.backups) ? data.backups.length : 0;
  console.log('PITR enabled:', data.pitr_enabled === true);
  console.log('Listed backups:', count);
  if (!count) console.log('No usable backup is confirmed by this listing. Check the dashboard and create an independent encrypted copy.');
} catch {
  console.error('Backup status could not be verified. Check project settings and scoped Supabase CLI access.');
  process.exitCode = 1;
}
