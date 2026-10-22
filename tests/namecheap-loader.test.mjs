import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import * as path from 'node:path';
const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
for (const mode of ['command', 'litespeed', 'passenger', 'library']) {
  let starts = 0, configured = 0, listening;
  const testModule = { exports: {} };
  const env = { NEXT_PUBLIC_SITE_URL: 'https://oggaming.pk', ...(mode === 'litespeed' ? { LSNODE_ROOT: '/home/test/app' } : {}) };
  const app = { getRequestHandler: () => () => {}, prepare: async () => {}, close: async () => {} };
  const server = new EventEmitter();
  server.listen = (...args) => { listening = args[0]; queueMicrotask(() => server.emit('listening')); };
  server.close = callback => callback();
  const require = name => {
    if (name === 'node:http') return { createServer: () => { starts++; return server; } };
    if (name === 'node:fs') return { existsSync: () => false };
    if (name === 'node:path') return path;
    if (name === 'next') return () => app;
    throw new Error(name);
  };
  require.main = mode === 'command' ? testModule : {};
  vm.runInNewContext(source, {
    module: testModule, require, __dirname: '/home/test/app', URL, queueMicrotask,
    console: { log() {}, error() { throw new Error('Startup failed'); } },
    process: { env, once() {} },
    ...(mode === 'passenger' ? { PhusionPassenger: { configure: () => configured++ } } : {}),
  });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(starts, mode === 'library' ? 0 : 1, mode);
  assert.equal(configured, mode === 'passenger' ? 1 : 0);
  if (mode === 'passenger') assert.equal(listening, 'passenger');
}
console.log('Startup loader tests passed: command, LiteSpeed, Passenger and library import.');
