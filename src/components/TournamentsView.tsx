'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import type {Tournament,Registration,Profile} from '@/types';
import {paymentWhatsApp} from '@/lib/whatsapp';
import {sendAction} from './useResource';
import {TeamApplicationForm} from './TeamApplicationForm';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function TournamentsView({tournaments,registrations,currentProfile,onRegistrationCreated,detail=false}:{tournaments:Tournament[];registrations:Registration[];currentProfile:Profile|null;onRegistrationCreated:()=>void;detail?:boolean}){
 const [selected,setSelected]=useState<Tournament|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[clock,setClock]=useState<number|null>(null);

 useEffect(()=>{const initial=setTimeout(()=>setClock(Date.now()),0);const timer=setInterval(()=>setClock(Date.now()),30000);return()=>{clearTimeout(initial);clearInterval(timer);};},[]);
 async function submit(body:unknown){setBusy(true);setError('');try{await sendAction('/api/tournaments',body);setMessage('Team application saved. Organisers will review it.');setSelected(null);onRegistrationCreated();}catch(error){setError(error instanceof Error?error.message:'Unable to update team.');}finally{setBusy(false);}}
 async function copyEvent(event:Tournament){try{await navigator.clipboard.writeText(new URL('/tournaments/'+event.slug,window.location.origin).href);setMessage('Event link copied. Share it with your team.');}catch{setError('Unable to copy automatically. Use Open event, then copy its address.');}}
 return <div className="space-y-6">{(error&&!selected)&&<p className="error-message" role="alert">{error}</p>}{message&&<p role="status" className="success-message">{message}</p>}{!tournaments.length&&<div className="empty-state"><h2>No tournaments announced yet.</h2></div>}
 <div className={"grid grid-cols-1 gap-6 "+(detail?"":"md:grid-cols-2")}>{tournaments.map(t=>{
  const own=registrations.find(r=>r.tournament_id===t.id&&(r.can_manage||(currentProfile&&r.captain_id===currentProfile.id))),count=t.registrations_count||0;
  const canRegister=clock!==null&&t.status==='upcoming'&&Date.parse(t.registration_deadline)>clock&&count<t.max_teams;
  return <article className="admin-section flex flex-col" key={t.id}><p className="eyebrow">{t.game} / {t.status}</p><h2><Link href={'/tournaments/'+t.slug}>{t.title}</Link></h2><p className="muted">{t.description}</p>
   <dl className="grid grid-cols-2 gap-4 my-6 text-sm"><div><dt className="muted">Starts (PKT)</dt><dd>{new Date(t.start_date).toLocaleString('en-PK',{timeZone:'Asia/Karachi'})}</dd></div><div><dt className="muted">Entry closes (PKT)</dt><dd>{new Date(t.registration_deadline).toLocaleString('en-PK',{timeZone:'Asia/Karachi'})}</dd></div><div><dt className="muted">Bracket</dt><dd>{t.bracket_type==='double'?'Double elimination':'Single elimination'}</dd></div><div><dt className="muted">Teams</dt><dd>{count}/{t.max_teams} approved</dd></div><div><dt className="muted">Eligibility</dt><dd>Open team entry</dd></div><div><dt className="muted">Entry / team</dt><dd>{Number(t.entry_fee)>0?'PKR '+Number(t.entry_fee).toLocaleString('en-PK'):'Free'}</dd></div><div><dt className="muted">Prize</dt><dd>{t.prize_pool||'To be announced'}</dd></div></dl>
   {t.rules&&<details className="mb-6"><summary>Tournament rules</summary><p className="muted whitespace-pre-wrap">{t.rules}</p></details>}<div className="actions"><Link className="button secondary" href={'/tournaments/'+t.slug+'/bracket'} target="_blank" rel="noopener noreferrer">View bracket</Link><button className="button secondary" onClick={()=>void copyEvent(t)}>Copy event link</button>{!detail&&<Link className="text-link" href={'/tournaments/'+t.slug} target="_blank">Open event ↗</Link>}</div>
   <div className="mt-auto pt-5">{own?<><p>Your team: {own.status}</p>{Number(own.amount_due)>0&&own.payment_status!=='verified'&&<div className="payment-panel"><p>Amount due: PKR {Number(own.amount_due).toLocaleString('en-PK')}</p><p className="muted whitespace-pre-wrap">{t.payment_instructions}</p><a className="button" href={paymentWhatsApp(t.title,own.team_name,Number(own.amount_due))} target="_blank" rel="noopener noreferrer">Send paid screenshot</a></div>}</>:clock===null?<p className="muted" role="status">Checking registration time...</p>:!canRegister?<p className="muted">Registration closed or full.</p>:<button className="button" onClick={()=>{setSelected(t);setError('');}}>Register your team</button>}</div>
  </article>;
 })}</div>
 <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="registration-dialog sm:max-w-3xl"><DialogHeader><DialogTitle>Register for {selected?.title}</DialogTitle><DialogDescription>Submit your team and captain details. No FACEIT account or verification is needed.</DialogDescription></DialogHeader>
 {selected&&<TeamApplicationForm event={selected} profile={currentProfile} busy={busy} error={error} onSubmit={submit}/>}
 </DialogContent></Dialog></div>;
}
