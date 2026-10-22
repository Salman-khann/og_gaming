import assert from 'node:assert/strict';
import { readFileSync, existsSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';
import { request as httpRequest } from 'node:http';
const info = JSON.parse(readFileSync(new URL('../.deployment/latest.json', import.meta.url), 'utf8'));
const modules = join(info.stage, 'node_modules');
if (!existsSync(modules)) symlinkSync(join(process.cwd(), 'node_modules'), modules, process.platform === 'win32' ? 'junction' : 'dir');
const env = parseEnv(readFileSync('.env.local', 'utf8'));
const child = spawn(process.execPath, ['server.js'], {
  cwd: info.stage, env: { ...process.env, ...env, NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://oggaming.pk', PORT: '3112' },
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = new Promise(resolve => child.once('exit', resolve));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Packaged startup timed out.')), 30000);
    child.stdout.on('data', chunk => { if (chunk.toString().includes('OG Gaming ready.')) { clearTimeout(timer); resolve(); } });
    child.once('error', () => { clearTimeout(timer); reject(new Error('Packaged startup failed.')); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Packaged process exited: ' + code)); });
  });
  const base = 'http://127.0.0.1:3112';
  const request = (path, options = {}) => new Promise((resolve, reject) => {
    const req = httpRequest(base + path, { method: options.method || 'GET', headers: { Host: 'oggaming.pk', ...options.headers }, agent: false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })));
    });
    req.on('error', reject); req.end(options.body);
  });
  const home = await request('/');
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-frame-options'), 'DENY');
  const html = await home.text();
  assert.match(html, /OG Gaming/);
  const css = /href="([^\"]+\.css[^\"]*)"/.exec(html)?.[1];
  assert.ok(css);
  assert.equal((await request(css.replaceAll('&amp;', '&'))).status, 200);
  for (const path of ['/matches', '/tournaments', '/leaderboard', '/players', '/login']) assert.equal((await request(path)).status, 200, path);
  assert.equal((await request('/api/teams')).status, 401);
  for (const path of ['/api/auth', '/api/matches', '/api/tournaments']) {
    const response = await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://oggaming.pk' }, body: 'null' });
    assert.equal(response.status, 400, 'public HTTPS origin must work behind the internal port: ' + path);
  }
  assert.equal((await request('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' }, body: '{}' })).status, 403);
  assert.equal((await request('/', { headers: { Host: 'evil.test' } })).status, 421);
  const callback = await request('/auth/callback?error=access_denied');
  assert.equal(callback.status, 303);
  assert.equal(new URL(callback.headers.get('location')).origin, 'https://oggaming.pk');
  console.log('Packaged cPanel startup passed: relocated build, public pages, stylesheet, API origin checks, host validation and login redirect.');
} finally { child.kill(); await exited; }
