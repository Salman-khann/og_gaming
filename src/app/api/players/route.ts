import { connection } from 'next/server';
import {apiError,ApiError,integer,uuidField} from '@/lib/api';
import {createClient} from '@/lib/supabase/server';
import {refreshLeaderboardPlayer} from '@/lib/leaderboard';
export async function GET(request:Request) {
  await connection();
 try{
  const params=new URL(request.url).searchParams,db=await createClient(),id=params.get('player_id');
  if(!id){const page=integer(params.get('page')||1,1,10000);let query=db.from('profiles').select('id,faceit_id,faceit_nickname,faceit_level,faceit_elo',{count:'exact'}).neq('role','banned').order('faceit_nickname').order('id').range((page-1)*25,page*25-1);if(params.get('search'))query=query.ilike('faceit_nickname','%'+params.get('search')!.replace(/[\\%_]/g,'').slice(0,40)+'%');const {data,error,count}=await query;if(error)throw error;return Response.json({players:data,total:count,page},{headers:{'Cache-Control':'no-store'}});}
  const playerId=uuidField(id,'player');
  const columns='id,faceit_id,faceit_nickname,faceit_avatar_url,faceit_level,faceit_elo,role';
  const account=await db.from('profiles').select(columns).eq('id',playerId).maybeSingle();
  if(account.error)throw account.error;
  const linked=account.data?account:await db.from('profiles').select(columns).eq('faceit_id',playerId).maybeSingle();
  if(linked.error)throw linked.error;
  const profile=linked.data;
  if(profile?.role==='banned')throw new ApiError('Player not found.',404);
  const faceitId=profile?.faceit_id||(!profile?playerId:null);
  const statsColumns='faceit_id,nickname,level,elo,matches,wins,win_rate,kd_ratio,headshot_rate,stats_updated_at,updated_at';
  let stats=null;
  if(faceitId){
    const cached=await db.from('faceit_leaderboard').select(statsColumns).eq('faceit_id',faceitId).maybeSingle();
    if(cached.error)throw cached.error;
    stats=cached.data;
    if(!profile&&!stats)throw new ApiError('Player not found.',404);
    try{
      await refreshLeaderboardPlayer(faceitId);
      const refreshed=await db.from('faceit_leaderboard').select(statsColumns).eq('faceit_id',faceitId).maybeSingle();
      if(!refreshed.error)stats=refreshed.data||stats;
    }catch{console.error('Player statistics refresh deferred; serving cached statistics.');}
  }
  const player=profile?{id:profile.id,faceit_id:profile.faceit_id,faceit_nickname:stats?.nickname||profile.faceit_nickname,faceit_avatar_url:profile.faceit_avatar_url,faceit_level:stats?.level??profile.faceit_level,faceit_elo:stats?.elo??profile.faceit_elo}:stats?{id:null,faceit_id:stats.faceit_id,faceit_nickname:stats.nickname,faceit_level:stats.level,faceit_elo:stats.elo}:null;
  if(!player)throw new ApiError('Player not found.',404);
  // Serialize JSONB arrays explicitly: the client treats JS arrays as SQL arrays.
  const [history,entries]=await Promise.all([profile?db.from('match_history').select('id,title,scheduled_time').contains('roster',JSON.stringify([{id:profile.id}])).order('scheduled_time',{ascending:false}).limit(50):Promise.resolve({data:[],error:null}),faceitId?db.from('registrations').select('id,team_name,tournament:tournaments(title,slug)').contains('roster_details',JSON.stringify([{faceit_id:faceitId}])).eq('status','approved').order('created_at',{ascending:false}).limit(50):Promise.resolve({data:[],error:null})]);
  if(history.error||entries.error)throw new Error('Player history unavailable.');
  return Response.json({player,stats,history:history.data,tournaments:entries.data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
