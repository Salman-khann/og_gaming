'use client';
import { useState } from 'react';
import Link from 'next/link';
import { OperationsPanel } from './OperationsPanel';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import styles from './AdminDashboard.module.css';
import type { Registration, Tournament, TournamentStatus } from '@/types';
type Props = { registrations: Registration[]; tournaments: Tournament[]; onDataRefresh: () => void };
type Form = { bracket_type: 'single' | 'double'; checkin_open: string; checkin_close: string; title: string; slug: string; description: string; game: string; format: string; min_level: number; max_level: number; max_teams: number; start_date: string; registration_deadline: string; status: TournamentStatus; prize_pool: string; rules: string; entry_fee: number; payment_instructions: string };
const blank: Form = { bracket_type:'double',checkin_open:'',checkin_close:'', title: '', slug: '', description: '', game: 'Counter-Strike 2', format: '5v5 BO3 Double Elimination', min_level: 1, max_level: 10, max_teams: 8, start_date: '', registration_deadline: '', status: 'draft', prize_pool: '', rules: '', entry_fee: 0, payment_instructions: '' };
function localDate(iso: string) { const date = new Date(iso); return new Date(date.getTime() + 5 * 3600000).toISOString().slice(0, 16); }
export function TournamentAdminPanel({ registrations, tournaments, onDataRefresh }: Props) {
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<Tournament | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function mutate(url: string, method: string, body: unknown) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save changes.');
      setMessage('Changes saved.'); onDataRefresh(); return true;
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to connect.'); return false; }
    finally { setBusy(false); }
  }
  function edit(t: Tournament) {
    setEditing(t.id);
    setForm({ ...t, bracket_type:t.bracket_type||'single',checkin_open:t.checkin_open?localDate(t.checkin_open):'',checkin_close:t.checkin_close?localDate(t.checkin_close):'', start_date: localDate(t.start_date), registration_deadline: localDate(t.registration_deadline), description: t.description || '', rules: t.rules || '', prize_pool: t.prize_pool || '', entry_fee: Number(t.entry_fee || 0), payment_instructions: t.payment_instructions || '' });
    setError(''); setEditorOpen(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const success = await mutate('/api/tournaments', editing ? 'PATCH' : 'POST', { ...form, action: 'create', tournament_id: editing, start_date: new Date(form.start_date+'+05:00').toISOString(), registration_deadline: new Date(form.registration_deadline+'+05:00').toISOString(),checkin_open:form.checkin_open?new Date(form.checkin_open+'+05:00').toISOString():null,checkin_close:form.checkin_close?new Date(form.checkin_close+'+05:00').toISOString():null });
    if (success) { setEditing(null); setForm(blank); setEditorOpen(false); }
  }
  const change = (key: keyof Form, value: string | number) => setForm(previous => ({ ...previous, [key]: value }));
  return <div className="space-y-6">

    {error && <p role="alert" className="error-message">{error}</p>}{message && <p role="status" className="success-message">{message}</p>}
    <div className={styles.sectionHeading}><div><h2>Tournament control</h2><p>Launch competitions, review entries and set the matchups.</p></div><button className="button" disabled={busy} onClick={()=>{setEditing(null);setForm(blank);setError('');setEditorOpen(true);}}>+ Create tournament</button></div>
    <Dialog open={editorOpen} onOpenChange={open=>{if(!busy)setEditorOpen(open);}}><DialogContent className={styles.dialog} showCloseButton={!busy}><DialogTitle>{editing ? 'Edit tournament' : 'Create tournament'}</DialogTitle><DialogDescription>Set the competition details. All dates and times use Pakistan time (PKT).</DialogDescription>{error&&<p role="alert" className="error-message">{error}</p>}<form onSubmit={save} className="field-grid">
      <label className="field wide">Title<input required maxLength={120} value={form.title} onChange={e => change('title', e.target.value)} /></label>
      <label className="field wide">URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="og-community-cup" value={form.slug} onChange={e => change('slug', e.target.value)} /></label>
      <label className="field">Game<input required value={form.game} onChange={e => change('game', e.target.value)} /></label>
      <label className="field">Format<input required value={form.format} onChange={e => change('format', e.target.value)} /></label>
      <label className="field">Bracket type<select value={form.bracket_type} onChange={e => { const bracket_type = e.target.value as 'single' | 'double'; setForm(previous => ({ ...previous, bracket_type, format: /^5v5 (BO3 )?(Single|Double) Elimination$/.test(previous.format) ? `5v5 BO3 ${bracket_type === 'double' ? 'Double' : 'Single'} Elimination` : previous.format })); }}><option value="single">Single elimination</option><option value="double">Double elimination</option></select></label><label className="field">Check-in opens (PKT, optional)<input type="datetime-local" value={form.checkin_open} onChange={e=>change('checkin_open',e.target.value)}/></label><label className="field">Check-in closes (PKT, optional)<input type="datetime-local" value={form.checkin_close} onChange={e=>change('checkin_close',e.target.value)}/></label><label className="field">Start date &amp; time (PKT)<input type="datetime-local" required value={form.start_date} onChange={e => change('start_date', e.target.value)} /></label>
      <label className="field">Registration deadline<input type="datetime-local" required value={form.registration_deadline} onChange={e => change('registration_deadline', e.target.value)} /></label>
      <label className="field">Team capacity<input type="number" min={2} max={128} required value={form.max_teams} onChange={e => change('max_teams', Number(e.target.value))} /></label>
      <label className="field">Status<select value={form.status} onChange={e => change('status', e.target.value)}>{(['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'] as const).map(status => <option key={status}>{status}</option>)}</select></label>
      <label className="field">Entry fee per team (PKR)<input type="number" min={0} max={99999999} step="0.01" required disabled={!!editing && registrations.some(r => r.tournament_id === editing)} value={form.entry_fee} onChange={e => change('entry_fee', Number(e.target.value))} /><span className="muted text-sm">The fee is fixed once a team registers.</span></label>
      <label className="field wide">Payment instructions<textarea rows={3} placeholder="Payment account details and instructions for teams" value={form.payment_instructions} onChange={e => change('payment_instructions', e.target.value)} /></label>
      <label className="field wide">Prize pool<input value={form.prize_pool} onChange={e => change('prize_pool', e.target.value)} /></label>
      <label className="field wide">Description<textarea rows={3} value={form.description} onChange={e => change('description', e.target.value)} /></label>
      <label className="field wide">Rules<textarea rows={4} value={form.rules} onChange={e => change('rules', e.target.value)} /></label>
      <div className="actions field wide"><button className="button secondary" disabled={busy} type="button" onClick={()=>setEditorOpen(false)}>Cancel</button><button className="button" disabled={busy}>{busy?'Saving…':editing ? 'Save tournament' : 'Create tournament'}</button></div>
    </form></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open=>{if(!open&&!busy)setDeleting(null);}}><DialogContent className={`${styles.dialog} ${styles.deleteDialog}`} showCloseButton={!busy}><DialogTitle>Delete tournament?</DialogTitle><DialogDescription>This permanently removes <strong>{deleting?.title}</strong>, its registrations, private application contacts, stored payment verification records and bracket results. This cannot be undone. It does not issue refunds.</DialogDescription><form onSubmit={async e=>{e.preventDefault();if(!deleting||confirmation!==deleting.title||busy)return;const success=await mutate('/api/tournaments','DELETE',{tournament_id:deleting.id,confirmation_title:confirmation});if(success){setDeleting(null);setConfirmation('');setMessage('Tournament deleted.');}}}><label>Type the tournament title to confirm<input autoComplete="off" required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>{error&&<p role="alert" className="error-message">{error}</p>}<div className="actions"><button className="button secondary" type="button" disabled={busy} onClick={()=>setDeleting(null)}>Keep tournament</button><button className={`button ${styles.danger}`} disabled={busy||confirmation!==deleting?.title}>{busy?'Deleting…':'Delete tournament'}</button></div></form></DialogContent></Dialog>
    <div className={styles.tournamentCards}>{tournaments.map(t => <article key={t.id} className="admin-item"><div className={styles.tournamentMeta}><span className={styles.kicker}>{t.game}</span><span className={styles.badge} data-status={t.status}>{t.status}</span></div><h3>{t.title}</h3><p className="muted">{t.format}</p><div className={styles.capacity}><span style={{width:`${Math.min(100,(t.registrations_count||0)/t.max_teams*100)}%`}}/></div><p className="muted">{t.registrations_count || 0} / {t.max_teams} approved teams</p><p className={styles.tournamentDate}>{new Date(t.start_date).toLocaleString('en-PK', { timeZone: 'Asia/Karachi',dateStyle:'medium',timeStyle:'short' })} PKT</p><div className="actions"><button className="button secondary" disabled={busy} onClick={() => edit(t)}>Edit tournament</button><Link className="button secondary" href={'/tournaments/'+t.slug+'/bracket'} target="_blank" rel="noopener noreferrer">Manage bracket</Link><button className={`button ${styles.danger}`} disabled={busy} onClick={()=>{setDeleting(t);setConfirmation('');setError('');}}>Delete tournament</button></div></article>)}</div>{!tournaments.length&&<div className={styles.empty}><strong>Your next competition starts here</strong><p>Create a tournament to open team registrations and build the bracket.</p></div>}
    <section className="admin-section"><h2>Team registrations ({registrations.length})</h2>{!registrations.length && <p className="muted">No registrations yet.</p>}{registrations.map(r => <article key={r.id} className="admin-item"><h3>{r.team_name}</h3><p className="muted">{r.tournament?.title || tournaments.find(t => t.id === r.tournament_id)?.title} · {r.status} · {r.checked_in ? 'Checked in' : 'Not checked in'}</p>{r.contact&&<div className="registration-contact"><strong>Captain: {r.contact.captain_name}</strong><span>{r.contact.phone} · {r.contact.email}</span>{r.contact.city&&<span>{r.contact.city}</span>}{r.contact.notes&&<p>{r.contact.notes}</p>}</div>}<p className="muted">Payment: {r.payment_status === 'verified' ? 'Verified' : r.payment_status === 'pending' ? 'Awaiting screenshot / verification' : 'Free entry'}</p><p className="muted">{r.roster_details.map(p => p.nickname + (p.game_id?" — "+p.game_id:"")).join(', ')}</p><div className="actions">{r.payment_status === 'pending' && <button className="button" disabled={busy} onClick={() => void mutate('/api/tournaments', 'PATCH', { action: 'verify_payment', registration_id: r.id })}>Verify payment screenshot</button>}{r.status !== 'approved' && <button className="button" disabled={busy || r.payment_status === 'pending'} onClick={() => void mutate('/api/tournaments', 'PATCH', { registration_id: r.id, status: 'approved' })}>Approve</button>}{r.status !== 'rejected' && <button className="button secondary" disabled={busy} onClick={() => void mutate('/api/tournaments', 'PATCH', { registration_id: r.id, status: 'rejected' })}>Reject</button>}{r.status === 'approved' && <button className="button secondary" disabled={busy} onClick={() => void mutate('/api/tournaments', 'PATCH', { registration_id: r.id, action: 'toggle_checkin' })}>{r.checked_in ? 'Undo check-in' : 'Check in'}</button>}</div></article>)}</section>
  </div>;
}

export function AdminPanel(props:Props){return <OperationsPanel tournamentContent={<TournamentAdminPanel {...props}/>}/>;}
