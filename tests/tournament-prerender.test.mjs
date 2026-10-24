import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/TournamentsView.tsx', import.meta.url), 'utf8')
  .split('\n').filter(line => !line.startsWith('import ') || line.includes("from 'react'")).join('\n');
const mocks = `
function Link({children}) { return children; }
function useResource() { return {data:null,error:'',loading:false}; }
function Dialog({open,children}) { return open ? children : null; }
const DialogContent=Dialog,DialogHeader=Dialog,DialogTitle=Dialog,DialogDescription=Dialog;
function TournamentBracket() { return null; }
function paymentWhatsApp() { return '#'; }
async function sendAction() {}
`;
let compiled = ts.transpileModule(source+'\n'+mocks, { compilerOptions: { module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX } }).outputText;
for(const name of ['react','react/jsx-runtime']) compiled=compiled.replaceAll('"'+name+'"','"'+pathToFileURL(require.resolve(name)).href+'"').replaceAll("'"+name+"'",'"'+pathToFileURL(require.resolve(name)).href+'"');
const {TournamentsView}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const tournament={id:'fixture',slug:'fixture',title:'Prerender fixture',status:'upcoming',game:'CS2',start_date:'2030-01-01T12:00:00Z',registration_deadline:'2030-01-01T11:00:00Z',min_level:1,max_level:10,max_teams:8,entry_fee:0};
const originalNow=Date.now;
try {
 Date.now=()=>{throw new Error('Current time must not be read during prerender');};
 const guest=renderToString(createElement(TournamentsView,{tournaments:[tournament],registrations:[],currentProfile:null,onRegistrationCreated:()=>{}}));
 assert.match(guest,/Checking registration time/);
 assert.doesNotMatch(guest,/Registration closed or full/);
 const member=renderToString(createElement(TournamentsView,{tournaments:[tournament],registrations:[{id:'entry',tournament_id:'fixture',captain_id:'captain',status:'approved',checked_in:false,amount_due:0}],currentProfile:{id:'captain'},onRegistrationCreated:()=>{}}));
 assert.match(member,/Your team:.*?approved/);assert.doesNotMatch(member,/check.in/i);
 console.log('Tournament SSR passes without Date.now; registration stays guarded before hydration and approved teams need no check-in.');
} finally { Date.now=originalNow; }
