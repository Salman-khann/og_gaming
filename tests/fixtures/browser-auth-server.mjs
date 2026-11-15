import { createServer } from 'node:http';
import { fixtureAccount,fixtureSignature,fixtureUser } from './browser-session.mjs';
createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1:54321');
  const send=(status,value)=>{response.writeHead(status,{'Content-Type':'application/json'});response.end(JSON.stringify(value));};
  if(url.pathname==='/health')return send(200,{testFixture:true});
  const token=(request.headers.authorization||'').replace(/^Bearer /,'');
  let authorized=false;
  try { const parts=token.split('.');authorized=parts[2]===fixtureSignature&&JSON.parse(Buffer.from(parts[1],'base64url').toString()).sub===fixtureAccount; } catch { /* Reject non-fixture tokens. */ }
  if(!authorized)return send(401,{code:'bad_jwt',message:'Fixture session required'});
  if(url.pathname==='/auth/v1/user')return send(200,fixtureUser);
  if(url.pathname==='/rest/v1/profiles')return send(200,{id:fixtureAccount,role:'admin',faceit_nickname:'Admin'});
  return send(404,{message:'No fixture for this endpoint'});
}).listen(54321,'127.0.0.1');
