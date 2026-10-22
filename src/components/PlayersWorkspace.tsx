'use client';
import Link from 'next/link';
import {useAppendPages} from './useAppendPages';
import {useEffect,useState} from 'react';
import {useResource} from './useResource';
import {PlayerProfile} from './PlayerProfile';
type Player={id:string;faceit_id:string|null;faceit_nickname:string;faceit_level:number;faceit_elo:number};
type Data={players?:Player[];player?:Player;total?:number;history?:{id:string;title:string;scheduled_time:string}[];tournaments?:{id:string;team_name:string;tournament:{title:string;slug:string}}[]};
export function PlayersWorkspace(){
 const [playerId,setPlayerId]=useState(''),[page,setPage]=useState(1),[search,setSearch]=useState('');
 useEffect(()=>{const timer=setTimeout(()=>setPlayerId(new URLSearchParams(window.location.search).get('player_id')||''),0);return()=>clearTimeout(timer);},[]);
 const {data,error,loading}=useResource<Data>('/api/players?'+(playerId?'player_id='+encodeURIComponent(playerId):'page='+page+'&search='+encodeURIComponent(search)));
 const visiblePlayers=useAppendPages(search,page,data?.players);
 if(playerId)return <PlayerProfile playerId={playerId}/>;
 return <main className="wrap arena-main"><p className="eyebrow">OG GAMING / PLAYERS</p><h1>{data?.player?.faceit_nickname||'Meet the players.'}</h1>{error&&<p role="alert" className="error-message">{error}</p>}{loading&&<p role="status">Loading players...</p>}
 {playerId?<><button className="button secondary" onClick={()=>setPlayerId('')}>All players</button>{data?.player&&<p>{data.player.faceit_id?'FACEIT level '+data.player.faceit_level+' · '+data.player.faceit_elo+' ELO':'Unranked — FACEIT not connected'}</p>}<section className="admin-section mt-6"><h2>Match history</h2>{data?.history?.map(match=><article className="admin-item" key={match.id}><h3>{match.title}</h3><p>{new Date(match.scheduled_time).toLocaleString('en-PK',{timeZone:'Asia/Karachi'})} PKT · roster participant</p></article>)}{!data?.history?.length&&<p className="muted">No completed rosters recorded yet.</p>}</section><section className="admin-section mt-6"><h2>Tournament teams</h2>{data?.tournaments?.map(entry=><p key={entry.id}><Link href={'/tournaments/'+entry.tournament.slug}>{entry.tournament.title}</Link> · {entry.team_name}</p>)}</section></>:<><form className="form-stack" onSubmit={e=>{e.preventDefault();setSearch(String(new FormData(e.currentTarget).get('search')||''));setPage(1);}}><label>Find player<input name="search" maxLength={40}/></label><button className="button secondary">Search</button></form><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{visiblePlayers.map(player=><article key={player.id} className="admin-section"><button className="text-link" onClick={()=>setPlayerId(player.id)}>{player.faceit_nickname}</button><p className="muted">{player.faceit_id?'Level '+player.faceit_level+' · '+player.faceit_elo+' ELO':'Unranked'}</p></article>)}</div>{page*25<(data?.total||0)&&<button className="button secondary list-more" disabled={loading} onClick={()=>setPage(page+1)}>Load more players</button>}</>}
 </main>;
}
