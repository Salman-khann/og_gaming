import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToString } from 'react-dom/server';
const require = createRequire(import.meta.url);
let auth = { profile: null, loading: false }, query = '', resourceCalls = 0;
const Link = ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children);
const mocks = {
  'next/link': Link,
  'next/dynamic': () => () => null,
  'next/navigation': { useSearchParams: () => new URLSearchParams(query) },
  './AuthProvider': { useAuth: () => auth },
  './useAppendPages': { useAppendPages: (_scope, _page, items) => items || [] },
  './useResource': { useResource: () => { resourceCalls++; return { data: null, loading: true, error: '' }; } },
  './PlayerProfile': { PlayerProfile: ({ playerId }) => React.createElement('p', null, 'Profile: ' + playerId) },
  './BotTrap': { BotTrap: () => null },
  '@/components/ui/dialog': { Dialog: () => null, DialogContent: () => null, DialogHeader: () => null, DialogTitle: () => null, DialogDescription: () => null },
};
function load(file) {
  const compiled = ts.transpileModule(readFileSync(new URL('../src/components/' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Date,
    require: name => {
      if (name in mocks) return mocks[name];
      if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  return exports;
}
const { ArenaWorkspace } = load('ArenaWorkspace.tsx');
let html = renderToString(React.createElement(ArenaWorkspace, { admin: true }));
assert.match(html, /Administrator access required/);
assert.match(html, /href="\/login"/);
assert.doesNotMatch(html, /Loading…/);
auth = { profile: { id: 'player', role: 'player' }, loading: false };
html = renderToString(React.createElement(ArenaWorkspace, { admin: true }));
assert.match(html, /Administrator access required/);
assert.doesNotMatch(html, /Load more/);
auth = { profile: null, loading: true };
assert.match(renderToString(React.createElement(ArenaWorkspace, { admin: true })), /Loading account/);

const { PlayersWorkspace } = load('PlayersWorkspace.tsx');
query = 'player_id=legacy-player'; resourceCalls = 0;
html = renderToString(React.createElement(PlayersWorkspace));
assert.match(html, /Profile: legacy-player/);
assert.equal(resourceCalls, 0, 'legacy profile URLs do not also fetch the directory or a second profile');
query = ''; resourceCalls = 0;
assert.match(renderToString(React.createElement(PlayersWorkspace)), /Meet the players/);
assert.equal(resourceCalls, 1);

const { MatchBoard } = load('MatchBoard.tsx');
const now = Date.now;
try {
  Date.now = () => { throw new Error('Current time must not be read during SSR'); };
  html = renderToString(React.createElement(MatchBoard, {
    matches: [{ id: 'match', title: 'Hydration fixture', type: 'gather_5v5', roster: [], min_faceit_level: 1, max_faceit_level: 10, current_players_count: 0, target_players_count: 10, scheduled_time: '2030-01-01T12:00:00Z' }],
    currentProfile: null, onMatchUpdated() {},
  }));
  assert.match(html, /Hydration fixture/);
} finally { Date.now = now; }
console.log('UI regressions passed: admin access states, legacy profile requests and deterministic match prerendering.');
