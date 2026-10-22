import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/bracket-engine.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {buildBracket,balanceTeams}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
for(const size of Array.from({length:127},(_,i)=>i+2))for(const type of ['single','double']){
 const teams=Array.from({length:size},(_,i)=>'team-'+i),nodes=buildBracket(teams,type),keys=new Set(nodes.map(n=>n.key));
 assert.equal(keys.size,nodes.length);
 assert.equal(new Set(nodes.flatMap(n=>[n.team_a,n.team_b]).filter(Boolean)).size,size);
 for(const node of nodes)for(const source of [node.source_a,node.source_b])if(source)assert.ok(keys.has(source),'Every source must exist');
 assert.equal(nodes.filter(n=>n.bracket==='final').length,type==='double'?1:0);
 assert.equal(nodes.filter(n=>n.bracket==='reset').length,type==='double'?1:0);
 assert.ok(nodes.length<=256);
 const opening=nodes.filter(n=>n.bracket==='winners'&&n.round===1);
 assert.equal(opening.length,Math.ceil(size/2));
 assert.equal(opening.filter(n=>n.team_a&&n.team_b).length,Math.floor(size/2));
 assert.equal(opening.filter(n=>!n.team_a||!n.team_b).length,size%2);
 assert.equal(nodes.filter(n=>n.bracket==='winners').length,size-1+size%2);
 if(type==='double') assert.equal(nodes.filter(n=>n.bracket==='losers').length,size-2);
 // Exercise different winners, including both outcomes of the grand final.
 for(const reset of [false,true]){
  const results=new Map(), losses=new Map(teams.map(id=>[id,0]));let played=0;
  for(const node of nodes){
   const get=(source,outcome,direct)=>source?results.get(source)[outcome]:direct;
   const a=get(node.source_a,node.outcome_a,node.team_a),b=get(node.source_b,node.outcome_b,node.team_b);
   if(node.bracket==='reset'&&!reset){results.set(node.key,{winner:a,loser:null});continue;}
   if(a&&b){assert.notEqual(a,b);assert.ok(losses.get(a)<(type==='double'?2:1));assert.ok(losses.get(b)<(type==='double'?2:1));}
   const bWins=node.bracket==='final'?reset:node.bracket==='reset'?false:(node.round+node.position+size)%2===0;
   const winner=!a?b:!b?a:bWins?b:a,loser=a&&b?(winner===a?b:a):null;
   results.set(node.key,{winner,loser});if(loser){losses.set(loser,losses.get(loser)+1);played++;}
  }
  const champion=results.get(nodes[nodes.length-1].key).winner;
  for(const [id,loss] of losses)if(id!==champion)assert.equal(loss,type==='double'?2:1);
  assert.equal(played,type==='double'?2*size-2+(reset?1:0):size-1);
 }
}
const players=Array.from({length:10},(_,i)=>({id:String(i),elo:1000+i*100})),balanced=balanceTeams(players);
assert.equal(balanced.a.length,5);assert.equal(balanced.b.length,5);assert.equal(balanced.difference,100);
assert.equal(new Set([...balanced.a,...balanced.b].map(p=>p.id)).size,10);
assert.throws(()=>balanceTeams(players.map(p=>({...p,elo:null}))));
console.log('Bracket graph references, seeding bounds and exact ELO partitions passed.');
