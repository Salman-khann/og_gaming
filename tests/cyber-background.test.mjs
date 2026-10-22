import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/components/CyberBackground.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

function mount(reduced) {
  const frames = new Map();
  const listeners = { window: new Map(), document: new Map(), motion: new Map() };
  const events = (name) => ({
    addEventListener: (event, callback) => listeners[name].set(event, callback),
    removeEventListener: (event) => listeners[name].delete(event),
  });
  let cleanup;
  let id = 0;
  let draws = 0;
  let centers = [];
  const ctx = {
    clearRect: () => { centers = []; }, setTransform() {}, save() {}, restore() {}, beginPath() {},
    arc: (x, y) => centers.push([x, y]), fill: () => draws++, stroke() {}, moveTo() {}, lineTo() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  const canvas = { getContext: () => ctx };
  const motion = { matches: reduced, ...events('motion') };
  const window = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, matchMedia: () => motion, ...events('window') };
  const document = { visibilityState: 'visible', ...events('document') };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, window, document,
    requestAnimationFrame: (fn) => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: (key) => frames.delete(key),
    require: (name) => {
      if (name === 'react') return { useRef: () => ({ current: canvas }), useEffect: (fn) => { cleanup = fn(); } };
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      throw new Error(name);
    },
  });
  exports.CyberBackground();
  return {
    frames, listeners, window, document, motion, canvas,
    get draws() { return draws; }, get centers() { return centers; },
    frame(time) { const [key, fn] = frames.entries().next().value; frames.delete(key); fn(time); },
    cleanup: () => cleanup(),
  };
}

const active = mount(false);
assert.equal(active.frames.size, 1);
assert.equal(active.canvas.width, 780, 'canvas uses device pixel ratio');
assert.ok(active.draws >= 40, 'mobile has at least twenty visible embers');
active.frame(100);
const before = JSON.stringify(active.centers);
active.frame(117);
assert.notEqual(JSON.stringify(active.centers), before, 'embers move between frames');
active.document.visibilityState = 'hidden';
active.listeners.document.get('visibilitychange')();
assert.equal(active.frames.size, 0);
active.document.visibilityState = 'visible';
active.listeners.document.get('visibilitychange')();
active.listeners.window.get('resize')();
assert.equal(active.frames.size, 1, 'resume and resize never create duplicate loops');
active.motion.matches = true;
active.frame(200);
const reducedBefore = JSON.stringify(active.centers);
active.frame(217);
assert.equal(active.frames.size, 1);
assert.notEqual(JSON.stringify(active.centers), reducedBefore, 'motion preference changes retain gentle drift');
active.cleanup();
assert.ok(Object.values(active.listeners).every((map) => map.size === 0));

const gentle = mount(true);
assert.equal(gentle.frames.size, 1);
assert.ok(gentle.draws > 0, 'initial reduced motion keeps dots visible');
gentle.frame(100);
const startY = gentle.centers[0][1];
gentle.frame(100 + 1000 / 60);
const gentleDistance = startY - gentle.centers[0][1];
assert.ok(gentleDistance >= 0.35 * 0.35 && gentleDistance <= 1.05 * 0.35, 'reduced motion uses a slower upward drift');
const previousDraws = gentle.draws;
gentle.window.innerWidth = 600;
gentle.listeners.window.get('resize')();
assert.ok(gentle.draws > previousDraws, 'resize redraws particles');
assert.equal(gentle.canvas.width, 1200);
gentle.document.visibilityState = 'hidden';
gentle.listeners.document.get('visibilitychange')();
assert.equal(gentle.frames.size, 0);
gentle.document.visibilityState = 'visible';
gentle.listeners.window.get('pageshow')();
gentle.listeners.window.get('pageshow')();
assert.equal(gentle.frames.size, 1, 'mobile page restoration restarts exactly one loop');
gentle.cleanup();
assert.equal(gentle.frames.size, 0);
console.log('Background motion, reduced motion, resize and cleanup passed.');
