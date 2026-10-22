import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const secretName = /(?:SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|ACCESS_TOKEN|API_KEY|BOT_TOKEN|DATABASE_URL|DB_URL|ENCRYPTION_KEY)/i;
const isSecret = name => !name.startsWith('NEXT_PUBLIC_') && secretName.test(name);
const placeholder = value => /^(?:your[-_]|placeholder|example|test[-_]|change[-_]|\*+$)/i.test(value);

export function inspectText(text, knownSecrets = []) {
  const problems = new Set();
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) problems.add('private key');
  if (/\bsb_secret_[A-Za-z0-9_-]{20,}/.test(text)) problems.add('Supabase secret key');
  if (/\bsbp_[A-Za-z0-9]{30,}/.test(text)) problems.add('Supabase access token');
  for (const token of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(token[0].split('.')[1], 'base64url')).role === 'service_role') problems.add('Supabase service-role JWT'); } catch { /* Not a JWT. */ }
  }
  for (const secret of knownSecrets) if (secret.length >= 16 && !placeholder(secret) && text.includes(secret)) problems.add('configured secret value');
  return [...problems];
}

export function inspectEnvironment(env, production = false) {
  const problems = [];
  for (const [name, value] of Object.entries(env)) {
    if (!value || placeholder(value) || !name.startsWith('NEXT_PUBLIC_')) continue;
    if (secretName.test(name)) problems.push(name + ': secret must not use NEXT_PUBLIC_');
    if (inspectText(value).length) problems.push(name + ': contains a privileged credential');
  }
  if (production) {
    if (!/^[a-f0-9]{64,}$/i.test(env.RATE_LIMIT_SECRET || '')) problems.push('RATE_LIMIT_SECRET: use at least 32 random bytes encoded as hex');
    if ((env.CRON_SECRET || '').length < 32 || placeholder(env.CRON_SECRET || '')) problems.push('CRON_SECRET: use at least 32 random characters');
    try { const url = new URL(env.NEXT_PUBLIC_SITE_URL); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); } catch { problems.push('NEXT_PUBLIC_SITE_URL: set the production HTTPS origin'); }
    if (env.VERCEL !== '1' && !/^[a-z0-9-]+$/i.test(env.TRUSTED_CLIENT_IP_HEADER || '')) problems.push('TRUSTED_CLIENT_IP_HEADER: configure a header overwritten by your reverse proxy');
    if (!env.SUPABASE_SERVICE_ROLE_KEY || placeholder(env.SUPABASE_SERVICE_ROLE_KEY)) problems.push('SUPABASE_SERVICE_ROLE_KEY: configure the server credential');
  }
  return problems;
}

export function forbiddenTrackedPath(path) {
  return /(?:^|\/)\.env(?:$|\.)/.test(path) && path !== '.env.example'
    || /(?:^|\/)(?:backups|recovery-private)(?:\/|$)/i.test(path)
    || /(?:\.dump|\.backup|\.sql\.gz|\.pgpass|\.p12|\.pfx|\.pem|\.ogbackup)$/i.test(path);
}

export function checkSecurity({ production = false } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const env = {};
  for (const file of ['.env', '.env.production', '.env.local', '.env.production.local']) {
    const path = resolve(root, file);
    if (existsSync(path)) Object.assign(env, parseEnv(readFileSync(path, 'utf8')));
  }
  Object.assign(env, process.env);
  const issues = inspectEnvironment(env, production);
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of tracked) if (forbiddenTrackedPath(path)) issues.push(path + ': private file must not be tracked');
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const known = Object.entries(env).filter(([name]) => isSecret(name)).map(([, value]) => value).filter(Boolean);
  for (const path of new Set(files)) {
    if (!/\.(?:[cm]?js|tsx?|json|ya?ml|md|sql|toml|txt|ps1|sh|css|html)$/.test(path) && path !== '.env.example') continue;
    if (!existsSync(resolve(root, path))) continue;
    const contents = readFileSync(resolve(root, path));
    if (contents.includes(0)) continue;
    for (const reason of inspectText(contents.toString('utf8'), known)) issues.push(path + ': ' + reason);
  }
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const issues = checkSecurity({ production: process.argv.includes('--production') });
    if (issues.length) { console.error('Security check failed (values are never printed):\n' + issues.join('\n')); process.exitCode = 1; }
    else console.log('Security check passed: public environment, tracked private files and source secret scan.');
  } catch { console.error('Security check could not complete. Run from the Git checkout with readable configuration.'); process.exitCode = 1; }
}
