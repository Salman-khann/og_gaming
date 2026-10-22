import { createClient } from './supabase/server';
import { ApiError } from './api';
import { FaceitError, normalizeFaceitNickname, verifyFaceitPlayer } from './faceit';
import type { MatchRequest, Tournament, Registration } from '@/types';
import {guestApplications} from './team-applications';
import {createAdminClient} from './supabase/admin';

function queryError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === 'PGRST205' || error.code === '42P01') throw new ApiError('The competition database has not been set up yet. Please contact OG Gaming.', 503);
  throw error;
}
export async function readArena(kind: 'matches' | 'tournaments',page=1,registrationPage=1,adminView=false) {
  const db = await createClient();
  if (kind === 'matches') {
    const { data: matches, error,count } = await db.from('match_requests').select('*, creator:profiles!match_requests_creator_id_fkey(id,faceit_nickname,faceit_level,faceit_elo)',{count:'exact'}).in('status', ['open', 'matched']).gt('scheduled_time', new Date().toISOString()).order('created_at', { ascending: false }).order('id').range((page-1)*25,page*25-1);
    queryError(error);
    return { matches: matches as MatchRequest[],has_more:page*25<(count||0) };
  }
  const [t, r] = await Promise.all([
    db.from('tournaments').select('*, approved:registrations(count)',{count:'exact'}).eq('approved.status', 'approved').order('start_date').order('id').range((page-1)*25,page*25-1),
    db.from('registrations').select('*, tournament:tournaments(title),captain:profiles!registrations_captain_id_fkey(id,faceit_nickname,faceit_level,faceit_elo)',{count:'exact'}).order('created_at', { ascending: false }).order('id').range((registrationPage-1)*50,registrationPage*50-1),
  ]);
  queryError(t.error); queryError(r.error);
  const registrations = (r.data || []) as Registration[];
  if(!adminView){for(const entry of await guestApplications((t.data||[]).map(e=>e.id))){const existing=registrations.findIndex(r=>r.id===entry.id);if(existing>=0)registrations[existing]=entry;else registrations.push(entry);}}
  if(adminView&&registrations.length){const contacts=await createAdminClient().from('registration_contacts').select('registration_id,captain_name,email,phone,city,notes').in('registration_id',registrations.map(r=>r.id));queryError(contacts.error);for(const entry of registrations)entry.contact=contacts.data?.find(c=>c.registration_id===entry.id)||null;}
  if(!adminView&&t.data?.length){
    const {data:{user}}=await db.auth.getUser();
    if(user){const own=await db.from('registrations').select('*').eq('captain_id',user.id).in('tournament_id',t.data.map(event=>event.id)).limit(25);queryError(own.error);for(const registration of own.data||[])if(!registrations.some(row=>row.id===registration.id))registrations.push(registration as Registration);}
  }
  return { tournaments: (t.data || []).map(t => ({ ...t, registrations_count: t.approved?.[0]?.count || 0 })) as Tournament[], registrations,has_more:page*25<(t.count||0),registrations_has_more:registrationPage*50<(r.count||0) };
}
export async function verifyRoster(nicknames: string[], min: number, max: number) {
  if (nicknames.length !== 5 || nicknames.some(n => typeof n !== 'string' || !n.trim() || n.length > 200)) throw new ApiError('Enter five different FACEIT nicknames or profile URLs.');
  let names: string[];
  try { names = nicknames.map(normalizeFaceitNickname); } catch (error) { throw new ApiError(error instanceof Error ? error.message : 'Invalid FACEIT profile.'); }
  if (new Set(names.map(n => n.toLowerCase())).size !== 5) throw new ApiError('Enter five different FACEIT players.');
  if (!process.env.FACEIT_API_KEY || process.env.FACEIT_API_KEY.startsWith('your-')) throw new ApiError('FACEIT verification is not configured.', 503);
  let players;
  try { players = await Promise.all(names.map(verifyFaceitPlayer)); } catch (error) { throw new ApiError(error instanceof Error ? error.message : 'FACEIT verification is temporarily unavailable.', error instanceof FaceitError ? error.status : 400); }
  const roster = players.map(p => {
    if (p.level < min || p.level > max) throw new ApiError(`${p.nickname} is FACEIT level ${p.level}. This tournament requires levels ${min}–${max}.`);
    return { nickname: p.nickname, faceit_id: p.id, level: p.level, elo: p.elo };
  });
  if (new Set(roster.map(p => p.faceit_id)).size !== 5) throw new ApiError('The roster must contain five different players.');
  return roster;
}
