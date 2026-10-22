'use client';
import Link from 'next/link';
import {useAppendPages} from './useAppendPages';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import type { MatchRequest, Tournament, Registration } from '@/types';

const MatchBoard = dynamic(() => import('./MatchBoard').then(m => m.MatchBoard), { loading: () => <p role="status">Loading matches…</p> });
const TournamentsView = dynamic(() => import('./TournamentsView').then(m => m.TournamentsView), { loading: () => <p role="status">Loading tournaments…</p> });
const AdminPanel = dynamic(() => import('./AdminPanel').then(m => m.AdminPanel), { loading: () => <p role="status">Loading administration…</p> });
type Tab = 'matches' | 'tournaments';
type ArenaData = { matches: MatchRequest[]; tournaments: Tournament[]; registrations: Registration[];has_more:boolean;registrations_has_more:boolean };
const empty: ArenaData = { matches: [], tournaments: [], registrations: [],has_more:false,registrations_has_more:false };

export function ArenaWorkspace({ admin = false, embedded = false, section }: { admin?: boolean; embedded?: boolean; section?: Tab }) {
  const Container = embedded ? 'div' : 'main';
  const { profile, loading: authLoading } = useAuth();
  const [selectedTab, setSelectedTab] = useState<Tab>('matches');
  const tab = section || selectedTab;
  const [page,setPage]=useState(1),[registrationPage,setRegistrationPage]=useState(1);
  const dataScope = `${admin ? 'admin' : tab}:${profile?.id || 'guest'}:${page}:${registrationPage}`;
  const [data, setData] = useState<ArenaData>(empty);
  const [loading, setLoading] = useState(true);
  const [loadedSection, setLoadedSection] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true); setError('');
    try {
      const endpoint=(admin||tab==='tournaments'?'/api/tournaments':'/api/matches')+'?page='+page+'&registration_page='+registrationPage+(admin?'&admin=1':'');
      const response = await fetch(endpoint, { signal: request.signal, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load this section.');
      if (!request.signal.aborted) {
        setData(previous => ({ ...previous, ...result }));
        setLoadedSection(dataScope);
      }
    } catch (error) {
      if (!request.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to connect.');
    } finally { if (!request.signal.aborted) setLoading(false); }
  }, [admin, tab, dataScope,page,registrationPage]);
  useEffect(() => {
    if (admin && (authLoading || profile?.role !== 'admin')) return;
    const initial = window.setTimeout(() => void load(), 0);
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 60000);
    return () => { window.clearTimeout(initial); controller.current?.abort(); window.removeEventListener('focus', refresh); window.clearInterval(interval); };
  }, [load, authLoading, admin, profile?.id, profile?.role]);
  const ready = loadedSection === dataScope;
  const scope=(admin?'admin':tab)+':'+(profile?.id||'guest');
  const visibleMatches=useAppendPages(scope+':matches',page,ready?data.matches:undefined);
  const visibleTournaments=useAppendPages(scope+':tournaments',page,ready?data.tournaments:undefined);
  const visibleRegistrations=useAppendPages(scope+':registrations',registrationPage,ready?data.registrations:undefined);
  return <Container className={"wrap arena-main "+(admin?"admin-workspace":"")}>
    <div className="arena-heading"><div><p className="eyebrow">OG GAMING / {admin ? 'ADMINISTRATION' : tab === 'matches' ? '5V5 MATCHING' : 'TOURNAMENTS'}</p><h1>{admin ? 'Administration.' : tab === 'matches' ? 'Find your next 5v5.' : 'Play for the title.'}</h1><p className="muted">{admin ? 'Tournaments, players and teams — all in one place.' : tab === 'matches' ? 'Find players, form your squad, and join a match.' : 'Browse events and register your team.'}</p></div><button className="button secondary" onClick={() => void load()} disabled={loading}>Refresh</button></div>
    {!admin && <div className="arena-tabs" role={section ? undefined : 'tablist'} aria-label="Competition sections">{(['matches', 'tournaments'] as Tab[]).map(key => section ? <Link key={key} href={'/' + key} className={'arena-tab-link ' + (tab === key ? 'active' : '')}>{key === 'matches' ? '5v5 Matching' : 'Tournaments'}</Link> : <button key={key} role="tab" aria-selected={tab === key} aria-controls="arena-content" id={'tab-' + key} onClick={() => { setSelectedTab(key); setPage(1); setRegistrationPage(1); }}>{key === 'matches' ? '5v5 Matching' : 'Tournaments'}</button>)}</div>}
    <div className="arena-content" id="arena-content" role={!admin && !section ? 'tabpanel' : undefined} aria-labelledby={!admin && !section ? 'tab-' + tab : undefined}>
      {error && <div className="error-message mb-6" role="alert"><p>{error}</p><button className="button secondary mt-4" onClick={() => void load()}>Try again</button></div>}
      {loading && !ready ? <p role="status">Loading…</p> : !ready ? null : admin ? profile?.role === 'admin' ? <AdminPanel registrations={visibleRegistrations} tournaments={visibleTournaments} onDataRefresh={load} /> : <p>Administrator access required.</p> : tab === 'tournaments' ? <TournamentsView tournaments={visibleTournaments} registrations={visibleRegistrations} currentProfile={profile} onRegistrationCreated={load} /> : <MatchBoard matches={visibleMatches} currentProfile={profile} onMatchUpdated={load} />}
    </div>
    {data.has_more&&<button className="button secondary list-more" disabled={loading} onClick={()=>setPage(page+1)}>Load more {admin?'tournaments':tab}</button>}
    {admin&&data.registrations_has_more&&<button className="button secondary list-more" disabled={loading} onClick={()=>setRegistrationPage(registrationPage+1)}>Load more registrations</button>}
  </Container>;
}
