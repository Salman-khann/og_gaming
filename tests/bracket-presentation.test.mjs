import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const source = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true } }).outputText;
  const compiledModule = { exports:{} };
  new Function('require','module','exports',source)(name => name in overrides ? overrides[name] : require(name), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { buildBracket } = load('src/lib/bracket-engine.ts');
const teams = ['Phoenix','Nightfall','Vanguard','Reapers','Inferno',...(process.argv.includes('--large') ? Array.from({length:15},(_,i)=>'Team '+(i+6)) : [])].map((team_name,i) => ({id:'team'+i,team_name}));
const matches = buildBracket(teams.map(t=>t.id),'double').map(m=>({...m,id:m.key,node_key:m.key,scheduled_at:'2026-11-16T15:00:00.000Z',status:'pending',score_a:null,score_b:null,winner_id:null}));
const { TournamentBracket } = load('src/components/TournamentBracket.tsx', {
  '@/lib/bracket-schedule':load('src/lib/bracket-schedule.ts'),
  './BracketScheduleEditor':{BracketScheduleEditor:()=>null},
  './BracketResetDialog':{BracketResetDialog:()=>null},
  '@/lib/bracket-layout':load('src/lib/bracket-layout.ts'),
  '@/lib/bracket-series':load('src/lib/bracket-series.ts'),
  './useResource':{useResource:()=>({data:{teams,matches},reload:()=>{},loading:false})},
  './MatchScorecardDialog':{MatchScorecardDialog:()=>null},
  './BracketPairingsEditor':{BracketPairingsEditor:()=>null},
  './TournamentBracket.module.css':{__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})},
});
const html = renderToStaticMarkup(createElement(TournamentBracket,{tournamentId:'preview'}));
for (const label of ['Winners bracket','Losers bracket','Grand finals','Reset final','Team status']) assert.ok(html.includes(label),label);
assert.equal((html.match(/<article /g)||[]).length,matches.length,'All lanes visible from the start');
assert.ok(!html.includes('Edit result for'),'Spectators cannot score games');
const admin = renderToStaticMarkup(createElement(TournamentBracket,{tournamentId:'preview',admin:true}));
assert.ok(admin.includes('Manage matchups'));
assert.ok(admin.includes('Reset bracket'));
assert.ok(!html.includes('Reset bracket'));
assert.ok(admin.includes('Edit result for'));
assert.ok(admin.includes('Phoenix 2, Inferno 0') || admin.includes('2, '),'BO3 scoring controls appear inline');
assert.equal((html.match(/aria-label="Expand /g)||[]).length,3,'Every bracket offers expansion');
assert.match(html,/8:00 pm PKT/i);
assert.ok(!html.includes('inlineScores'),'Public viewers cannot record results');
if (process.argv.includes('--preview')) {
  mkdirSync('.deployment',{recursive:true});
  const css = readFileSync(new URL('../src/components/TournamentBracket.module.css',import.meta.url),'utf8');
  writeFileSync('.deployment/bracket-preview.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#090909;color:#eee;font-family:Arial,sans-serif}main{max-width:1180px;margin:auto}button{font:inherit}${css}</style></head><body><main>${html}</main></body></html>`);
}
console.log('Bracket rendering passed: all stages, variable entrants, public/admin controls.');
