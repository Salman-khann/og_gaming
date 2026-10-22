import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/Navbar';
import { TournamentBracketPage } from '@/components/TournamentBracketPage';

export default function BracketPage({ params }: { params: Promise<{ slug: string }> }) {
  return <><Navbar /><Suspense fallback={<main className="wrap arena-main"><p role="status">Loading bracket...</p></main>}><BracketContent params={params} /></Suspense></>;
}

async function BracketContent({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const db = await createClient();
  const { data, error } = await db.from('tournaments').select('id,title,slug,format').eq('slug', slug).maybeSingle();
  if (error) throw new Error('Unable to load the tournament bracket.');
  if (!data) notFound();
  return <main className="wrap arena-main"><Link className="text-link" href={'/tournaments/' + data.slug}>← Tournament details</Link><p className="eyebrow">OG GAMING / BRACKET</p><h1>{data.title}</h1><p className="muted">{data.format}</p><TournamentBracketPage tournamentId={data.id} /></main>;
}
