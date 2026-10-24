import { runSupabase } from './lib/supabase-cli.mjs';
process.loadEnvFile('.env.local');
const host=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const match=/^([a-z0-9]+)\.supabase\.co$/.exec(host);
if(!match)throw new Error('Use the configured Supabase project origin.');
const result = runSupabase(['db','query','--linked','--project-ref',match[1],'--file','supabase/inspect-access.sql']);
if(result.stdout)process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
process.exitCode=result.status||0;
