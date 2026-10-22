import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/components/useResource.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const slots = [], pendingEffects = [], timers = new Map(), intervals = new Map();
const listeners = { window: new Map(), document: new Map() };
const requests = [];
let cursor = 0, nextTimer = 0;
const changed = (a, b) => !a || a.length !== b.length || a.some((value, i) => value !== b[i]);
const hooks = {
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
  },
  useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
  useCallback(fn, deps) { const i = cursor++; if (changed(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
  useEffect(fn, deps) {
    const i = cursor++;
    if (changed(slots[i]?.deps, deps)) pendingEffects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
  },
};
const events = name => ({ addEventListener: (key, fn) => listeners[name].set(key, fn), removeEventListener: key => listeners[name].delete(key) });
const document = { visibilityState: 'visible', ...events('document') };
const exports = {};
vm.runInNewContext(compiled, {
  exports, AbortController, document, window: events('window'), require: () => hooks,
  setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id),
  setInterval: fn => { intervals.set(++nextTimer, fn); return nextTimer; }, clearInterval: id => intervals.delete(id),
  fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })),
});
function render(url) { cursor = 0; const result = exports.useResource(url); pendingEffects.splice(0).forEach(fn => fn()); return result; }
function start() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); }
async function settle() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
let result = render('/first');
assert.equal(result.loading, true, 'first render never flashes an empty state');
start();
requests[0].resolve(Response.json({ items: ['first'] }));
await settle();
result = render('/first');
assert.equal(result.loading, false);
assert.equal(result.data.items[0], 'first');
const oldReload = result.reload();
const old = requests.at(-1);
result = render('/second');
assert.equal(result.data, null, 'URL changes never display the previous account/resource');
assert.equal(result.loading, true);
assert.equal(old.options.signal.aborted, true);
start();
requests.at(-1).resolve(Response.json({ items: ['second'] }));
await settle();
old.resolve(Response.json({ items: ['stale'] }));
await oldReload;
result = render('/second');
assert.equal(result.data.items[0], 'second', 'late responses cannot overwrite current data');
const failed = result.reload();
requests.at(-1).resolve(new Response('<html>Unavailable</html>', { status: 503 }));
await failed;
result = render('/second');
assert.match(result.error, /Unable to load/);
assert.equal(result.data.items[0], 'second', 'refresh failures retain the visible data');
result = render(null);
assert.equal(result.loading, false);
assert.equal(result.error, '');
assert.equal(result.data, null);
assert.equal(intervals.size, 0, 'disabled resources stop polling');
assert.equal(listeners.window.size + listeners.document.size, 0);
render('/resumed'); start();
const count = requests.length;
document.visibilityState = 'hidden'; listeners.document.get('visibilitychange')();
assert.equal(requests.length, count);
document.visibilityState = 'visible'; listeners.document.get('visibilitychange')();
assert.equal(requests.length, count + 1, 'mobile tab return refreshes the resource');
const action = exports.sendAction('/action', {});
requests.at(-1).resolve(new Response('Proxy unavailable', { status: 502 }));
await assert.rejects(action, /Unable to save/);
render(null);
console.log('Resource loading passed: initial state, account changes, abort races, non-JSON errors, disabled polling and mobile resume.');
