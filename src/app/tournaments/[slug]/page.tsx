import {Suspense} from 'react';
import Link from 'next/link';
import {connection} from 'next/server';
import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {Navbar} from '@/components/Navbar';
import {TournamentDetail} from '@/components/TournamentDetail';
import type {Tournament,Registration} from '@/types';
import {guestApplications} from '@/lib/team-applications';
export default function EventPage({params}:{params:Promise<{slug:string}>}){return <><Navbar/><Suspense fallback={<main className="wrap arena-main"><p role="status">Loading event...</p></main>}><EventContent params={params}/></Suspense></>;}
async function EventContent({params}:{params:Promise<{slug:string}>}){
 await connection();
 const {slug}=await params,db=await createClient();const {data,error}=await db.from('tournaments').select('*,approved:registrations(count)').eq('slug',slug).eq('approved.status','approved').single();
 if(error||!data)notFound();const {data:registrations,error:registrationError}=await db.from('registrations').select('*').eq('tournament_id',data.id).limit(500);if(registrationError)throw new Error('Unable to load event entries.');
 const tournament={...data,registrations_count:data.approved?.[0]?.count||0} as Tournament;
 const entries=(registrations||[]) as Registration[];for(const own of await guestApplications([data.id])){const at=entries.findIndex(r=>r.id===own.id);if(at>=0)entries[at]=own;else entries.push(own);}
 return <main className="wrap arena-main"><Link className="text-link" href="/tournaments">← All tournaments</Link><p className="eyebrow">OG GAMING / EVENT</p><h1>{tournament.title}</h1><TournamentDetail tournament={tournament} registrations={entries}/></main>;
}
