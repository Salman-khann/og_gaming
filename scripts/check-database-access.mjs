import {spawnSync} from 'node:child_process';
process.loadEnvFile('.env.local');
const host=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const match=/^([a-z0-9]+)\.supabase\.co$/.exec(host);
if(!match)throw new Error('Use the configured Supabase project origin.');
const result=spawnSync('powershell.exe',['-NoProfile','-Command',"npx.cmd --yes supabase db query --linked --project-ref '"+match[1]+"' --file 'supabase/inspect-access.sql'"],{encoding:'utf8'});
if(result.stdout)process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
process.exitCode=result.status||0;
