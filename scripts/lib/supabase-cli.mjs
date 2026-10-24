import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url));
export function runSupabase(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
}
