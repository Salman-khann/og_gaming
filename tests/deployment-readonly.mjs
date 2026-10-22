// Read-only checks against the configured hosted project. No records or messages are created.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const server = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
for (const table of ['site_content', 'match_history']) {
  const { error } = await anon.from(table).select('id').limit(1);
  assert.ifError(error); console.log('Public Data API available: ' + table);
}
for (const table of ['team_members', 'notifications_log']) {
  const { error } = await server.from(table).select('id').limit(1);
  assert.ifError(error); console.log('Server Data API available: ' + table);
}
const ranking = await anon.rpc('read_faceit_ranking', { page_number: 1, page_size: 25 });
assert.ifError(ranking.error); assert.ok(Array.isArray(ranking.data.players));
const analytics = await server.rpc('arena_analytics');
assert.ifError(analytics.error); assert.ok(analytics.data && typeof analytics.data === 'object');
const privatePhone = await anon.from('profiles').select('phone').limit(1);
assert.ok(privatePhone.error, 'Phone SELECT must fail for anonymous callers');
const privileged = await anon.rpc('community_action', { actor_id: '00000000-0000-4000-8000-000000000000', action_name: 'create_team', payload: { name: 'Forbidden' } });
assert.ok(privileged.error, 'Anonymous privileged RPC execution must fail');
console.log('Hosted ranking, analytics and privacy checks passed without mutations.');
