'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useResource,sendAction } from './useResource';
export type TeamSummary={id:string;name:string;captain_id:string};
export type TeamMember={id:string;team_id:string;user_id:string|null;faceit_id:string;nickname:string;status:'invited'|'accepted';expires_at:string};
export type TeamsData={teams:TeamSummary[];members:TeamMember[]};
export function TeamsWorkspace(){
  const {profile,loading:authLoading}=useAuth();
  const {data,error,loading,reload}=useResource<TeamsData>(profile?'/api/teams?account='+profile.id:null);
  const [message,setMessage]=useState(''),[failure,setFailure]=useState(''),[busy,setBusy]=useState(false);
  async function act(body:unknown){setBusy(true);setFailure('');setMessage('');try{await sendAction('/api/teams',body);setMessage('Team updated.');await reload();}catch(error){setFailure(error instanceof Error?error.message:'Unable to update team.');}finally{setBusy(false);}}
  if(authLoading)return <main className="wrap arena-main"><p role="status">Loading account...</p></main>;
  if(!profile)return <main className="wrap arena-main"><h1>Your squad starts here.</h1><p className="muted">Create a team and invite five verified FACEIT players.</p><Link className="button" href="/login">Sign in to manage teams</Link></main>;
  const teams=data?.teams||[];
  return <main className="wrap arena-main"><p className="eyebrow">OG GAMING / TEAMS</p><h1>Build your five.</h1><p className="muted">Each player accepts their invitation while signed into the matching FACEIT account. The captain enters the accepted roster in tournaments.</p>
    {!profile.faceit_id&&<p className="error-message">Sign in with FACEIT to prove account ownership before creating or accepting a team.</p>}
    {(error||failure)&&<p role="alert" className="error-message">{failure||error}</p>}{message&&<p role="status" className="success-message">{message}</p>}{loading&&<p role="status">Loading teams...</p>}
    <form className="admin-section form-stack" onSubmit={e=>{e.preventDefault();const fields=new FormData(e.currentTarget);void act({action:'create_team',name:fields.get('name')});}}><h2>Create a team</h2><label>Team name<input name="name" required maxLength={80}/></label><button className="button" disabled={busy||!profile.faceit_id}>Create team</button></form>
    {teams.map(team=><section key={team.id} className="admin-section mt-6"><h2>{team.name}</h2><p className="muted">{team.captain_id===profile.id?'You are the captain':'Team roster'}</p><ul className="form-stack">{data?.members.filter(m=>m.team_id===team.id).map(member=><li key={member.id}><strong>{member.nickname}</strong> · {member.status}{member.status==='invited'&&Date.parse(member.expires_at)<=Date.now()?' (expired)':''}
      {member.status==='invited'&&member.faceit_id===profile.faceit_id&&<button className="button secondary" disabled={busy} onClick={()=>void act({action:'accept',invitation_id:member.id})}>Accept invitation</button>}
      {team.captain_id===profile.id&&member.user_id!==profile.id&&<button className="button secondary" disabled={busy} onClick={()=>void act({action:'remove_member',team_id:team.id,member_id:member.id})}>Remove</button>}
      {member.status==='invited'&&team.captain_id===profile.id&&<p className="muted">Ask {member.nickname} to sign in with FACEIT and open the Teams page to accept.</p>}
    </li>)}</ul>{team.captain_id===profile.id&&<form className="form-stack mt-6" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void act({action:'invite',team_id:team.id,nickname:form.get('nickname')});}}><label>Invite a FACEIT player<input name="nickname" required maxLength={200} placeholder="Nickname or FACEIT profile URL"/></label><button className="button" disabled={busy}>Add invitation</button></form>}</section>)}
  </main>;
}
