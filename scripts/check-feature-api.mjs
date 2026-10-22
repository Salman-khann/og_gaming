import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:3110';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local server.');
for (const path of ['/api/community','/api/players','/api/leaderboard','/api/tournaments','/api/matches']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  const data = await response.json();
  assert.equal(data.error, undefined, path);
  console.log('Activated feature API passed: ' + path);
}
