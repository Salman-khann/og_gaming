// Read-only smoke checks; never creates users, posts, tournaments or payments.
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:3107';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local test server.');
for (const path of ['/', '/matches', '/tournaments', '/leaderboard', '/login', '/signup','/teams','/community','/players']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('x-powered-by'),null);
  assert.match(await response.text(), /OG Gaming/);
}
for (const path of ['/api/auth', '/api/matches', '/api/tournaments']) {
  for (const body of ['null', '[]', '{']) {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body });
    assert.equal(response.status, 400, path + ' must reject malformed JSON before accessing services');
  }
  const crossSite = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' }, body: '{}' });
  assert.equal(crossSite.status, 403, path + ' must reject cross-site mutations');
}
// A successful build can still export empty CSS-module class maps when a
// loader renames .module.css. Check the actual HTML against the served CSS.
const profilePage = await fetch(base + '/players/00000000-0000-4000-8000-000000000000');
assert.equal(profilePage.status, 200);
const profileHtml = await profilePage.text();
const mainClasses = [...profileHtml.matchAll(/<main class="wrap ([^"]+)"/g)].map(match => match[1]);
const profileClass = mainClasses.find(name => name !== 'arena-main');
assert.ok(profileClass && profileClass !== 'undefined', 'Player profile must receive a CSS Module class');
const stylesheets = [...profileHtml.matchAll(/<link[^>]*href="([^"]+\.css[^\"]*)"[^>]*>/g)].map(match => match[1]);
const css = (await Promise.all(stylesheets.map(async href => {
  const response = await fetch(new URL(href.replaceAll('&amp;', '&'), base));
  assert.equal(response.status, 200);
  return response.text();
}))).join('\n');
assert.ok(css.includes('.' + profileClass), 'Profile class must match a compiled stylesheet selector');
assert.ok(css.includes('--profile-orange'), 'Player dashboard stylesheet must be served');
const invalidBracket = await fetch(base + '/api/tournaments/bracket?tournament_id=invalid');
for(const path of ['/memberships','/api/memberships','/api/disputes']) assert.equal((await fetch(base+path)).status,404,path+' must be removed');
assert.equal(invalidBracket.status, 400);
assert.equal((await fetch(base+'/api/worker')).status,401);
assert.equal((await fetch(base+'/api/admin/operations')).status,401);
assert.equal((await fetch(base+'/api/teams')).status,401);
console.log('HTTP smoke passed: nine public pages, malformed API bodies, cross-site requests, worker/admin/team authorization and invalid bracket IDs.');
