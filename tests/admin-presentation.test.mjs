import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
let source=readFileSync(new URL('../src/components/OperationsPanel.tsx',import.meta.url),'utf8').split('\n').filter(line=>!line.startsWith('import ')||line.includes("from 'react'")).join('\n');
source=source.replace("useState('tournaments')","useState('players')");
source+=`
function Link({children}) {return children;}
function useResource(){return {data:{items:[{id:'fixture',faceit_nickname:'IPHONE',faceit_id:null,faceit_level:1,faceit_elo:1000,role:'player',created_at:'2026-10-08T11:48:23Z',last_active_at:'2026-10-13T13:16:01Z'}],total:1},error:'',loading:false,reload:async()=>{}};}
async function sendAction(){}
`;
let compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const name of ['react','react/jsx-runtime'])compiled=compiled.replaceAll('"'+name+'"','"'+pathToFileURL(require.resolve(name)).href+'"').replaceAll("'"+name+"'",'"'+pathToFileURL(require.resolve(name)).href+'"');
const {OperationsPanel}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const originalNow=Date.now;
try{
 Date.now=()=>{throw new Error('Current time read during admin render');};
 const html=renderToString(createElement(OperationsPanel,{tournamentContent:null}));
 assert.match(html,/Tournaments/);assert.match(html,/IPHONE/);assert.match(html,/Not connected/);assert.match(html,/Joined/);assert.match(html,/Last active/);assert.match(html,/PKT/);
 assert.doesNotMatch(html,/faceit_id:|created_at:|last_active_at:|1000|Previous|>Next<|2026-10-08T/);
 console.log('Admin player presentation hides raw fields and unverified default stats, includes tournaments, and prerenders without current time.');
}finally{Date.now=originalNow;}
