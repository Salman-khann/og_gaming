import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export const productionProjects = new Set(['aupshyillqikzudabvjg.supabase.co']);
export function assertTestDatabase(url) {
  let target;
  try {
    target = new URL(url);
  } catch {
    throw new Error('Configure a dedicated test database in .env.test.local.');
  }
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash
  )
    throw new Error('Configure a plain HTTP(S) test project origin.');
  if (
    productionProjects.has(target.hostname) ||
    (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname) &&
      process.env.OG_TEST_PROJECT_HOST !== target.hostname)
  ) {
    throw new Error(
      'Live test blocked: use local Supabase or an explicitly named non-production test project.',
    );
  }
  if (productionProjects.has(process.env.OG_TEST_PROJECT_HOST))
    throw new Error('Production cannot be designated as a test project.');
}
export function loadTestEnvironment() {
  const file = process.env.OG_TEST_ENV_FILE || '.env.test.local';
  if (existsSync(file)) Object.assign(process.env, parseEnv(readFileSync(file, 'utf8')));
  assertTestDatabase(process.env.NEXT_PUBLIC_SUPABASE_URL);
}
