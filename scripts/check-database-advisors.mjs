import { runSupabase } from './lib/supabase-cli.mjs';
process.loadEnvFile('.env.local');
const ref = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname)?.[1];
if (!ref) throw new Error('Use the configured Supabase project.');
const result = runSupabase(['db','advisors','--linked','--project-ref',ref,'--type','all','--level','warn','--fail-on','none']);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
