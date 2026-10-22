'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MatchRequest, Profile } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {useResource} from './useResource';
import type {TeamsData} from './TeamsWorkspace';
function HostContact({ matchId }: { matchId: string }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  async function reveal() {
    try {
    const r = await fetch('/api/matches/contact?match_id=' + encodeURIComponent(matchId));
    const data = await r.json();
    if (r.ok) setPhone(data.phone); else setError(data.error || 'Contact unavailable.');
    } catch { setError('Unable to load the host contact. Try again.'); }
  }
  return phone ? <a className="contact-host" href={'tel:' + phone}>Contact host · {phone}</a> : <><button className="button secondary" onClick={() => void reveal()}>Contact host</button>{error && <p role="alert">{error}</p>}</>;
}
export function MatchBoard({ matches, currentProfile, onMatchUpdated }: { matches: MatchRequest[]; currentProfile: Profile | null; onMatchUpdated: () => void }) {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const [postType,setPostType]=useState('gather_5v5');
  const {data:teamsData}=useResource<TeamsData>(currentProfile?'/api/teams':null);
  const ownedTeams=(teamsData?.teams||[]).filter(team=>team.captain_id===currentProfile?.id);
  useEffect(() => {
    const future = matches.map(m => m.scheduled_time ? Date.parse(m.scheduled_time) : 0).filter(time => time > clock);
    if (!future.length) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.min(2147483647, Math.max(1, Math.min(...future) - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [matches, clock]);
  async function send(body: unknown, method = 'POST') {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/matches', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(method === 'DELETE' ? 'Post deleted.' : 'Match updated.'); setOpen(false); onMatchUpdated();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to update match.'); }
    finally { setBusy(false); }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const time = String(form.get('scheduled_time'));
    await send({ title: form.get('title'), type: form.get('type'), team_id:form.get('team_id'), description: form.get('description'), contact_phone: form.get('phone'), host_name: form.get('host_name'), scheduled_time: time ? new Date(time + '+05:00').toISOString() : null, min_faceit_level: Number(form.get('min')), max_faceit_level: Number(form.get('max')), target_players_count: 10 });
  }
  const visible = matches.filter(m => (!m.scheduled_time || new Date(m.scheduled_time).getTime() > clock) && (filter === 'all' || m.type === filter));
  return <div className="space-y-6"><div className="flex flex-wrap gap-4 items-end justify-between"><label className="field">Show matches<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All matches</option><option value="gather_5v5">5v5 gathers</option><option value="team_vs_team">Team scrims</option><option value="solo_lfg">Looking for players</option></select></label><button className="button" onClick={() => { setError(''); setOpen(true); }}>Post a match</button></div>{error && !open && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    {!visible.length && <div className="empty-state"><h2>No matches here yet.</h2><p className="muted">Post a request to find players for your next session.</p></div>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{visible.map(match => {
      const joined = match.roster.some(p => p.id === currentProfile?.id);
      const unrestricted = match.min_faceit_level === 1 && match.max_faceit_level === 10;
      const eligible = !currentProfile || (!currentProfile.faceit_id ? unrestricted : currentProfile.faceit_level >= match.min_faceit_level && currentProfile.faceit_level <= match.max_faceit_level);
      return <article className="admin-section" key={match.id}><p className="eyebrow">{match.type === 'gather_5v5' ? '5V5 GATHER' : match.type === 'team_vs_team' ? 'TEAM SCRIM' : 'LOOKING FOR PLAYERS'}</p><h2>{match.title}</h2><p className="muted text-sm">{match.description}</p>{(match.can_delete || (currentProfile && (currentProfile.id === match.creator_id || currentProfile.role === 'admin'))) && <button className="button secondary delete-post" disabled={busy} onClick={() => { if (window.confirm('Delete this match post?')) void send({ match_id: match.id }, 'DELETE'); }}>Delete post</button>}<p className="muted text-sm">Hosted by {match.host_name || match.creator?.faceit_nickname || 'Player'}</p><p className="text-sm mt-5">{match.current_players_count}/{match.target_players_count} players · FACEIT {match.min_faceit_level}–{match.max_faceit_level}</p>{match.scheduled_time && <p className="muted text-sm mt-2">{new Date(match.scheduled_time).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT</p>}{currentProfile && (joined || currentProfile.role === 'admin') && <HostContact matchId={match.id} />}{match.balanced_teams&&<details className="my-5 text-sm"><summary>ELO-balanced teams</summary><p>Team A: {match.balanced_teams.a.map(p=>p.nickname).join(', ')}</p><p>Team B: {match.balanced_teams.b.map(p=>p.nickname).join(', ')}</p><p className="muted">Total ELO difference: {match.balanced_teams.difference}</p></details>}<details className="my-5 text-sm"><summary className="cursor-pointer">Player roster</summary><ul className="mt-3 space-y-1">{match.roster.map(p => <li key={p.id}>{p.nickname} · {p.level ? 'Level ' + p.level : 'Unranked'}</li>)}</ul></details>{!currentProfile ? <Link className="button w-full" href="/login">Log in to join</Link> : match.type==='team_vs_team' ? <form className="form-stack" onSubmit={e=>{e.preventDefault();void send({action:'join_team',match_id:match.id,team_id:new FormData(e.currentTarget).get('team_id')});}}><label>Join with your team<select name="team_id" required defaultValue=""><option value="" disabled>Choose a verified roster</option>{ownedTeams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label><button className="button" disabled={busy||match.status!=='open'||!ownedTeams.length}>Join as five</button></form> : <button className="button w-full" disabled={busy || joined || match.status !== 'open' || !eligible} onClick={() => void send({ action: 'join', match_id: match.id })}>{joined ? 'You’re on the roster' : match.status !== 'open' ? 'Match full' : !eligible ? 'Outside your level range' : 'Join match'}</button>}</article>;
    })}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-[var(--panel)] sm:max-w-lg"><DialogHeader><DialogTitle>Post a match</DialogTitle><DialogDescription>Find players for a 5v5 at OG Gaming. No account needed to post. You can delete your post from this browser. Times are in Karachi time; posts expire at that time.</DialogDescription></DialogHeader><form onSubmit={create} className="field-grid"><label className="field wide">Phone number<input name="phone" type="tel" autoComplete="tel" required maxLength={24} placeholder="03001234567" /><span className="muted text-sm">Your number is shared with admins and players who join your match.</span></label>{!currentProfile && <label className="field wide">Display name (optional)<input name="host_name" maxLength={40} /></label>}<label className="field wide">Title<input name="title" required maxLength={100} /></label><label className="field wide">Format<select name="type" value={postType} onChange={e=>setPostType(e.target.value)}><option value="gather_5v5">5v5 gather</option><option value="team_vs_team">Team scrim</option><option value="solo_lfg">Looking for players</option></select></label>{postType==='team_vs_team'&&<label className="field wide">Your verified team<select name="team_id" required defaultValue=""><option value="" disabled>Choose your team</option>{ownedTeams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select><Link href="/teams">Manage your five-player roster</Link></label>}<label className="field wide">Match date and time (PKT)<input type="datetime-local" name="scheduled_time" required /></label><label className="field">Minimum level<input name="min" type="number" min={1} max={10} required defaultValue={1} /></label><label className="field">Maximum level<input name="max" type="number" min={1} max={10} required defaultValue={10} /></label><label className="field wide">Details<textarea name="description" rows={3} maxLength={2000} /></label>{error && <p role="alert" className="error-message field wide">{error}</p>}<button className="button field wide" disabled={busy}>{busy ? 'Posting…' : 'Post match'}</button></form></DialogContent></Dialog>
  </div>;
}
