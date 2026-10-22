import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/bracket-engine.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {buildBracket,balanceTeams}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
for(const size of [2,3,5,8,13,16,31,64,127,128])for(const type of ['single','double']){
 const teams=Array.from({length:size},(_,i)=>'team-'+i),nodes=buildBracket(teams,type),keys=new Set(nodes.map(n=>n.key));
 assert.equal(keys.size,nodes.length);
 assert.equal(new Set(nodes.flatMap(n=>[n.team_a,n.team_b]).filter(Boolean)).size,size);
 for(const node of nodes)for(const source of [node.source_a,node.source_b])if(source)assert.ok(keys.has(source),'Every source must exist');
 assert.equal(nodes.filter(n=>n.bracket==='final').length,type==='double'?1:0);
 assert.equal(nodes.filter(n=>n.bracket==='reset').length,type==='double'?1:0);
 assert.ok(nodes.length<=256);
}
const players=Array.from({length:10},(_,i)=>({id:String(i),elo:1000+i*100})),balanced=balanceTeams(players);
assert.equal(balanced.a.length,5);assert.equal(balanced.b.length,5);assert.equal(balanced.difference,100);
assert.equal(new Set([...balanced.a,...balanced.b].map(p=>p.id)).size,10);
assert.throws(()=>balanceTeams(players.map(p=>({...p,elo:null}))));
console.log('Bracket graph references, seeding bounds and exact ELO partitions passed.');
