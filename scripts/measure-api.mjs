import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3110',phase=process.argv[3]||'after';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)||!['before','after'].includes(phase))throw new Error('Use a local server and before/after phase.');
const results=[];
for(const path of ['/api/leaderboard','/api/matches','/api/players']){
 const samples=[];let bytes=0;
 for(let index=0;index<9;index++){
  const start=performance.now(),response=await fetch(base+path);const body=await response.text();assert.equal(response.status,200,path);
  if(index){samples.push(performance.now()-start);bytes=Buffer.byteLength(body);}
 }
 samples.sort((a,b)=>a-b);
 results.push({path,samples:samples.length,median_ms:Math.round((samples[3]+samples[4])/2),p95_ms:Math.round(samples[7]),response_bytes:bytes});
}
writeFileSync('docs/API_METRICS_'+phase.toUpperCase()+'.json',JSON.stringify({scope:'Local production preview with hosted database, eight sequential warm reads per route; not a production load test.',results},null,2)+'\n');
console.log(JSON.stringify(results));
