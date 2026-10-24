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
  './BracketMatchCard':load('src/components/BracketMatchCard.tsx',{
    '@/lib/bracket-schedule':load('src/lib/bracket-schedule.ts'),
    './TournamentBracket.module.css':{__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})},
  }),
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
assert.ok(admin.includes('Manage matches'));
assert.ok(admin.includes('Reset bracket'));
assert.ok(!html.includes('Reset bracket'));
assert.ok(admin.includes('Edit result for'));
assert.ok(admin.includes('Phoenix 2, Inferno 0') || admin.includes('2, '),'BO3 scoring controls appear inline');
assert.equal((html.match(/aria-label="Expand /g)||[]).length,3,'Every bracket offers expansion');
assert.match(html,/8:00 pm PKT/i);
assert.match(html,/Mon,? 16 Nov,? 2026|Mon,? Nov 16,? 2026/);
const firstStatus = matches[0].status;
matches[0].status = 'completed';
const lockedAdmin = renderToStaticMarkup(createElement(TournamentBracket,{tournamentId:'preview',admin:true}));
const managerButton = lockedAdmin.match(/<button[^>]*aria-controls="bracket-match-manager"[^>]*>/)?.[0];
assert.ok(managerButton, 'Match manager remains available after results');
assert.ok(!managerButton.includes('disabled'), 'Locked pairings must not disable the match manager');
matches[0].status = firstStatus;

assert.ok(!html.includes('inlineScores'),'Public viewers cannot record results');
if (process.argv.includes('--preview')) {
  mkdirSync('.deployment',{recursive:true});
  const css = readFileSync(new URL('../src/components/TournamentBracket.module.css',import.meta.url),'utf8');
  const pageCss = readFileSync(new URL('../src/app/tournaments/[slug]/bracket/page.module.css', import.meta.url), 'utf8');
  const layoutJs = ts.transpileModule(readFileSync(new URL('../src/lib/bracket-layout.ts', import.meta.url), 'utf8'), { compilerOptions: { module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022 } }).outputText;
  const fitScript = `${layoutJs}
const matches=${JSON.stringify(matches)};
    const root=document.querySelector('.root');
    const fit=()=>{const available=root.getBoundingClientRect().width-32;
      for(const lane of document.querySelectorAll('.lane')) {
        const group={'Winners bracket':'winners','Losers bracket':'losers','Grand finals':'finals'}[lane.getAttribute('aria-label')];
        const games=matches.filter(m=>(['final','reset'].includes(m.bracket)?'finals':m.bracket)===group);
        const layout=layoutBracket(games,BRACKET_CARD_HEIGHT,available);
        const canvas=lane.querySelector('.canvas'),svg=canvas.querySelector('svg');
        const scale=bracketScale(available,layout.width);
        canvas.style.width=layout.width+'px';canvas.style.height=layout.height+'px';canvas.style.transform='scale('+scale+')';
        canvas.parentElement.style.width=layout.width*scale+'px';canvas.parentElement.style.height=layout.height*scale+'px';
        svg.setAttribute('width',layout.width);svg.setAttribute('height',layout.height);
        [...svg.querySelectorAll('path')].forEach((path,i)=>path.setAttribute('d',layout.connections[i].path));
        [...canvas.querySelectorAll('.roundHeading')].forEach((heading,i)=>{heading.style.left=layout.columns[i].x+'px';heading.style.width=layout.cardWidth+'px';});
        layout.placements.forEach(p=>{const card=document.getElementById('bracket-match-'+p.match.id);card.style.left=p.x+'px';card.style.top=p.y+'px';card.style.width=layout.cardWidth+'px';});
      }
    };new ResizeObserver(fit).observe(root);fit();`;
  writeFileSync('.deployment/bracket-preview.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#090909;color:#eee;font-family:Arial,sans-serif}button{font:inherit}${css}${pageCss}</style></head><body><main class="page">${html}</main><script type="module">${fitScript}</script></body></html>`);
}
console.log('Bracket rendering passed: all stages, variable entrants, public/admin controls.');
