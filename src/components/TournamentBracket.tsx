'use client';
import { useState } from 'react';
import { Trophy, GitBranch, ArrowRight, MoveHorizontal, RefreshCw, Shield, Check, Pencil, X } from 'lucide-react';
import type { TournamentMatch } from '@/types';
import { layoutBracket, bracketChampion, BRACKET_CARD_WIDTH, BRACKET_CARD_HEIGHT } from '@/lib/bracket-layout';
import { useResource, sendAction } from './useResource';
import styles from './TournamentBracket.module.css';
import { BracketPairingsEditor } from './BracketPairingsEditor';
const laneOf = (m: TournamentMatch) => ['final', 'reset'].includes(m.bracket) ? 'finals' : m.bracket || 'winners';
const laneNames: Record<string, string> = { winners: 'Upper bracket', losers: 'Lower bracket', finals: 'Grand finals' };

export function TournamentBracket({ tournamentId, admin = false, onChanged }: { tournamentId: string; admin?: boolean; onChanged?: () => void }) {
  const { data, error, loading, reload } = useResource<{ matches: TournamentMatch[]; teams: { id: string; team_name: string; captain_id: string }[]; eligibleTeams?: {id:string;team_name:string}[] }>('/api/tournaments/bracket?tournament_id=' + tournamentId + (admin ? '&manage=1' : ''));
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const [selectedLane, setSelectedLane] = useState('winners'), [editingId, setEditingId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const matches = data?.matches || [], teams = data?.teams || [];
  const name = (id: string | null) => id ? teams.find(t => t.id === id)?.team_name || 'Team' : 'To be decided';
  const lanes = ['winners', 'losers', 'finals'].filter(l => matches.some(m => laneOf(m) === l));
  const lane = lanes.includes(selectedLane) ? selectedLane : lanes[0];
  const layout = layoutBracket(matches.filter(m => laneOf(m) === lane));
  const champion = bracketChampion(matches), editing = matches.find(m => m.id === editingId);
  const pairingsLocked = matches.some(match => match.status === 'completed' || match.score_a != null || match.score_b != null || !match.node_key);
  async function act(method: 'POST' | 'PATCH', body: unknown) {
    setBusy(true); setFailure('');
    try { await sendAction('/api/tournaments/bracket', body, method); await reload(); onChanged?.(); setEditingId(null); return true; }
    catch (e) { setFailure(e instanceof Error ? e.message : 'Unable to save.'); return false; }
    finally { setBusy(false); }
  }
  function placeholder(m: TournamentMatch, side: 'a' | 'b') {
    if (m.status === 'bye') return m.bracket === 'reset' ? 'Not required' : 'Bye';
    const sourceKey = side === 'a' ? m.source_a : m.source_b;
    const source = sourceKey ? matches.find(p => p.node_key === sourceKey) : null;
    const outcome = (side === 'a' ? m.outcome_a : m.outcome_b) === 'loser' ? 'loser' : 'winner';
    return source ? (source.bracket === 'final' ? 'Grand final' : (source.bracket === 'losers' ? 'Lower' : 'Upper') + ' R' + source.round + '/M' + source.position) + ' ' + outcome : 'To be decided';
  }
  return <section className={styles.root} aria-label="Tournament bracket">
    <header className={styles.header}><div className={styles.title}><span className={styles.titleIcon}><GitBranch size={20}/></span><div><p>OG GAMING / COMPETITION</p><h3>Event bracket</h3></div></div><div className={styles.summary}>{teams.length > 0 && <span>{teams.length} TEAMS</span>}{matches.length > 0 && <span>{matches.filter(m => m.status === 'completed').length} MATCHES PLAYED</span>}<button type="button" className={styles.refresh} aria-label="Refresh bracket" disabled={loading} onClick={() => void reload()}><RefreshCw size={15} className={loading ? styles.spinning : undefined}/></button></div></header>
    {admin && data && <div className={styles.managementBar}><p>{pairingsLocked ? 'Opening matchups are locked after scores are recorded or for legacy brackets.' : 'Arrange the opening matchups before play starts.'}</p><button type="button" className={styles.primaryButton} disabled={busy || loading || pairingsLocked} onClick={() => { setManaging(!managing); setEditingId(null); }}><Pencil size={14}/> {managing ? 'Close matchup manager' : 'Manage matchups'}</button></div>}
    {(error || failure) && <div role="alert" className={styles.error}><p>{failure || error}</p><button type="button" onClick={() => void reload()}>Retry loading</button></div>}
    {!data && !error && <div className={styles.empty} role="status"><RefreshCw size={24} className={styles.spinning}/><h4>Loading the bracket...</h4></div>}
    {managing && admin && data && !pairingsLocked && <BracketPairingsEditor matches={matches} teams={data.eligibleTeams || []} busy={busy} onClose={() => setManaging(false)} onSave={async pairings => { if (!matches.length && !window.confirm('Generate this bracket and close registration?')) return; if (await act(matches.length ? 'PATCH' : 'POST', { tournament_id: tournamentId, pairings, ...(matches.length ? { action: 'set_pairings' } : {}) })) setManaging(false); }}/>}
    {data && !error && !matches.length && !managing && <div className={styles.empty}><GitBranch size={36} strokeWidth={1.2}/><h4>The stage is being set.</h4><p>The tournament bracket will appear here once the teams are confirmed.</p>{admin && <><p>Approve and check in at least two eligible, paid teams. Generating the bracket closes registration.</p><button className={styles.primaryButton} disabled={busy} onClick={() => setManaging(true)}>Choose matchups <ArrowRight size={15}/></button></>}</div>}
    {matches.length > 0 && <>
      {champion && <div className={styles.champion}><Trophy size={23}/><div><span>TOURNAMENT CHAMPION</span><strong>{name(champion)}</strong></div><span className={styles.championMark}>GG. WELL PLAYED.</span></div>}
      <div className={styles.navigation}><div className={styles.tabs} aria-label="Bracket stages">{lanes.map(l => <button key={l} type="button" aria-pressed={lane === l} className={lane === l ? styles.activeTab : undefined} onClick={() => { setSelectedLane(l); setEditingId(null); }}>{lanes.length === 1 ? 'Event bracket' : laneNames[l]}</button>)}</div><span className={styles.scrollHint}><MoveHorizontal size={14}/> Scroll to explore rounds</span></div>
      <div className={styles.viewport} role="region" aria-label={laneNames[lane] || 'Event bracket'} tabIndex={0}><div className={styles.canvas} style={{ width: layout.width, height: layout.height }}>
        <svg className={styles.connectors} width={layout.width} height={layout.height} aria-hidden="true">{layout.connections.map(c => <path key={c.key} d={c.path} className={c.completed ? styles.completedPath : undefined}/>)}</svg>
        {layout.columns.map((c, i) => <div className={styles.roundHeading} key={c.key} style={{ left: c.x, width: BRACKET_CARD_WIDTH }}><h4>{c.bracket === 'reset' ? 'Reset final' : c.bracket === 'final' ? 'Grand final' : lane === 'winners' && i === layout.columns.length - 1 ? lanes.length === 1 ? 'Final' : 'Upper final' : lane === 'winners' && i === layout.columns.length - 2 ? 'Semifinals' : 'Round ' + c.key}</h4><span>{c.bracket === 'reset' ? 'IF REQUIRED' : c.matchCount + (c.matchCount === 1 ? ' MATCH' : ' MATCHES')}</span></div>)}
        {layout.placements.map(({ match: m, x, y }) => <article className={styles.match + (editingId === m.id ? ' ' + styles.selectedMatch : '')} key={m.id} style={{ left: x, top: y, width: BRACKET_CARD_WIDTH, height: BRACKET_CARD_HEIGHT }} aria-label={'Round ' + m.round + ', match ' + m.position + ': ' + name(m.team_a) + ' versus ' + name(m.team_b)}>
          <div className={styles.matchMeta}><span>M{String(m.position).padStart(2, '0')}</span><span className={m.status === 'completed' ? styles.completeStatus : undefined}>{m.status === 'completed' ? 'Completed' : m.status === 'bye' ? 'Auto advance' : m.team_a && m.team_b ? 'Ready to play' : 'Awaiting teams'}</span>{admin && m.team_a && m.team_b && m.status !== 'bye' && <button type="button" aria-label={'Edit result for round ' + m.round + ' match ' + m.position} onClick={() => setEditingId(editingId === m.id ? null : m.id)}><Pencil size={12}/></button>}</div>
          {(['a', 'b'] as const).map(side => {
            const id = side === 'a' ? m.team_a : m.team_b, score = side === 'a' ? m.score_a : m.score_b;
            const winner = !!id && m.winner_id === id, lost = !!m.winner_id && !!id && !winner, label = id ? name(id) : placeholder(m, side);
            return <div key={side} className={styles.team + (winner ? ' ' + styles.winner : '') + (lost ? ' ' + styles.lost : '') + (!id ? ' ' + styles.pending : '')}><span className={styles.emblem} aria-hidden="true">{id ? label.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'OG' : <Shield size={16}/>}</span><span className={styles.teamName} title={label}>{label}</span>{winner && <Check className={styles.winnerCheck} size={12} aria-label="Winner"/>}<span className={styles.score}>{score ?? '—'}</span></div>;
          })}
        </article>)}
      </div></div>
      <footer className={styles.footer}><span><i/> Winner advances</span><span>Results managed by OG Gaming.</span></footer>
      {admin && editing && editing.team_a && editing.team_b && editing.status !== 'bye' && <section className={styles.editor} aria-label="Edit match result"><div className={styles.editorHeading}><h4>Record result / Round {editing.round}, match {editing.position}</h4><button type="button" aria-label="Close result editor" onClick={() => setEditingId(null)}><X size={17}/></button></div><form key={editing.id + ':' + editing.score_a + ':' + editing.score_b} onSubmit={e => { e.preventDefault(); const fields = new FormData(e.currentTarget); void act('PATCH', { match_id: editing.id, score_a: fields.get('a'), score_b: fields.get('b') }); }}><label>{name(editing.team_a)}<input name="a" type="number" required min={0} max={100} defaultValue={editing.score_a ?? 0}/></label><span className={styles.versus}>VS</span><label>{name(editing.team_b)}<input name="b" type="number" required min={0} max={100} defaultValue={editing.score_b ?? 0}/></label><button className={styles.primaryButton} disabled={busy}>{busy ? 'Saving...' : 'Save result'} <Check size={15}/></button></form></section>}
    </>}
  </section>;
}
