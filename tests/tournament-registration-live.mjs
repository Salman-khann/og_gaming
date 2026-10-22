// Isolated live guest-entry check. Cleans up its event, entries, contacts and notices.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const base=process.argv[2]||'http://localhost:3110';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Use a local server.');
if(process.env.TELEGRAM_BOT_TOKEN||process.env.RESEND_API_KEY)throw new Error('Use SQL fixtures when real notification delivery is configured.');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let event,entry;
try{
 const created=await db.from('tournaments').insert({title:'Temporary open team application check',slug:randomUUID(),status:'upcoming',entry_fee:500,min_level:8,max_level:10,max_teams:2,start_date:new Date(Date.now()+172800000).toISOString(),registration_deadline:new Date(Date.now()+86400000).toISOString(),checkin_open:new Date(Date.now()-60000).toISOString(),checkin_close:new Date(Date.now()+3600000).toISOString()}).select('id,slug').single();assert.ifError(created.error);event=created.data.id;
 const body={tournament_id:event,team_name:'Temporary guest squad',captain_name:'Temporary captain',email:'captain@test.invalid',phone:'+923000000099',city:'Karachi',accepted_rules:true,players:Array.from({length:5},(_,i)=>({nickname:'Fixture player '+i,game_id:''}))};
 const headers={'Content-Type':'application/json',Origin:base};
 const response=await fetch(base+'/api/tournaments',{method:'POST',headers,body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,201,data.error);entry=data.registration.id;
 const cookie=response.headers.getSetCookie().find(value=>value.startsWith('og_entry_'));assert.ok(cookie);const ownership=cookie.split(';')[0];
 const own=await (await fetch(base+'/api/tournaments',{headers:{Cookie:ownership}})).json();assert.ok(own.registrations.some(row=>row.id===entry&&row.can_manage));
 const publicRows=await (await fetch(base+'/api/tournaments')).json();assert.ok(!publicRows.registrations.some(row=>row.id===entry),'Pending guest entry must remain private');
 assert.ok((await anon.from('registration_contacts').select('phone').limit(1)).error);
 const wrong=await fetch(base+'/api/tournaments',{method:'POST',headers,body:JSON.stringify({action:'checkin',registration_id:entry})});assert.equal(wrong.status,403);
 const payment=await db.rpc('set_registration_payment',{registration_id:entry,next_payment:'verified'});assert.ifError(payment.error);
 const approved=await db.from('registrations').update({status:'approved'}).eq('id',entry);assert.ifError(approved.error);
 const checkin=await fetch(base+'/api/tournaments',{method:'POST',headers:{...headers,Cookie:ownership},body:JSON.stringify({action:'checkin',registration_id:entry})});assert.equal(checkin.status,200,await checkin.text());
 const detail=await fetch(base+'/tournaments/'+created.data.slug,{headers:{Cookie:ownership}});assert.equal(detail.status,200);assert.match(await detail.text(),/Temporary open team application check/);
 console.log('Live guest registration, private contacts, ownership, manual fees, guest check-in and event URL passed without FACEIT.');
}finally{
 if(entry){const cleanup=await db.from('notifications_log').delete().eq('payload->>id',entry);assert.ifError(cleanup.error);}
 if(event){const cleanup=await db.from('tournaments').delete().eq('id',event);assert.ifError(cleanup.error);}
}
