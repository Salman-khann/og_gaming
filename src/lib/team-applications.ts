import {cookies} from 'next/headers';
import {createAdminClient} from './supabase/admin';
import {ownsPost} from './match-ownership';
import {ApiError,textField} from './api-input';
import {normalizePhone} from './match-input';
import type {Registration} from '@/types';
export function applicationInput(body:Record<string,unknown>){
 const players=body.players;
 if(!Array.isArray(players)||players.length!==5)throw new ApiError('Enter all five players.');
 const roster=players.map(player=>{
  if(!player||typeof player!=='object'||Array.isArray(player))throw new ApiError('Invalid player details.');
  return {nickname:textField(player.nickname,'player name',40),game_id:typeof player.game_id==='string'?player.game_id.trim().slice(0,160):'',level:null,elo:null};
 });
 if(new Set(roster.map(p=>p.nickname.toLowerCase())).size!==5)throw new ApiError('Enter five different player names.');
 const email=textField(body.email,'email',254);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError('Enter a valid captain email.');
 let phone:string;try{phone=normalizePhone(body.phone);}catch{throw new ApiError('Enter a valid captain phone number.');}
 if(body.accepted_rules!==true)throw new ApiError('Accept the tournament rules.');
 return {event:body.tournament_id,application:{team_name:textField(body.team_name,'team name',80),captain_name:textField(body.captain_name,'captain name',80),email,phone,city:typeof body.city==='string'?body.city.trim().slice(0,80):'',notes:typeof body.notes==='string'?body.notes.trim().slice(0,1000):'',accepted_rules:true,players:roster}};
}
export async function guestApplications(eventIds:string[]){
 const jar=await cookies();const ids=jar.getAll().map(c=>c.name).filter(name=>/^og_entry_[a-f0-9-]{36}$/.test(name)).slice(0,50).map(name=>name.slice(9));
 if(!ids.length||!eventIds.length)return [];
 const db=createAdminClient();const contacts=await db.from('registration_contacts').select('registration_id,delete_token_hash').in('registration_id',ids);
 if(contacts.error)throw new ApiError('Unable to load your team applications.',503);
 const owned=(contacts.data||[]).filter(c=>ownsPost(jar.get('og_entry_'+c.registration_id)?.value,c.delete_token_hash)).map(c=>c.registration_id);
 if(!owned.length)return [];
 const rows=await db.from('registrations').select('*').in('id',owned).in('tournament_id',eventIds);
 if(rows.error)throw new ApiError('Unable to load your team applications.',503);
 return (rows.data||[]).map(row=>({...row,can_manage:true})) as Registration[];
}
export async function ownsApplication(id:string,actorId?:string){
 const db=createAdminClient(),entry=await db.from('registrations').select('captain_id').eq('id',id).single();
 if(entry.error)return false;if(actorId&&entry.data.captain_id===actorId)return true;
 const contact=await db.from('registration_contacts').select('delete_token_hash').eq('registration_id',id).single();
 return ownsPost((await cookies()).get('og_entry_'+id)?.value,contact.data?.delete_token_hash||null);
}
