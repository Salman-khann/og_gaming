'use client';
import { useEffect, useRef, useState } from 'react';
import { Trophy, GitBranch, ArrowRight, MoveHorizontal, RefreshCw, Shield, Check, Pencil, Maximize2, Minimize2, ZoomIn, ZoomOut, LockKeyhole, ArrowUpRight, ChevronDown } from 'lucide-react';
import type { TournamentMatch } from '@/types';
import { layoutBracket, bracketChampion, BRACKET_CARD_WIDTH, BRACKET_CARD_HEIGHT } from '@/lib/bracket-layout';
import { resultLocked, teamLosses } from '@/lib/bracket-series';
import { useResource, sendAction } from './useResource';
import styles from './TournamentBracket.module.css';
import { MatchScorecardDialog } from './MatchScorecardDialog';
import { BracketPairingsEditor } from './BracketPairingsEditor';
const laneOf = (m: TournamentMatch) => ['final', 'reset'].includes(m.bracket) ? 'finals' : m.bracket || 'winners';
const laneNames: Record<string, string> = { winners: 'Winners bracket', losers: 'Losers bracket', finals: 'Grand finals' };

export function TournamentBracket({ tournamentId, admin = false, onChanged }: { tournamentId: string; admin?: boolean; onChanged?: () => void }) {
  const { data, error, loading, reload } = useResource<{ matches: TournamentMatch[]; teams: { id: string; team_name: string; captain_id: string }[]; eligibleTeams?: {id:string;team_name:string}[] }>('/api/tournaments/bracket?tournament_id=' + tournamentId + (admin ? '&manage=1' : ''));
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [expandedLane, setExpandedLane] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [scorecardId, setScorecardId] = useState<string | null>(null);
  const expandedRef = useRef<HTMLElement>(null);
  const expandedViewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expandedLane || scorecardId) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    expandedRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedLane(null);
      if (event.key === 'Tab' && expandedRef.current) {
        const controls = expandedRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === expandedRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === expandedRef.current)) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [expandedLane, scorecardId]);
  const matches = data?.matches || [], teams = data?.teams || [];
  const name = (id: string | null) => id ? teams.find(t => t.id === id)?.team_name || 'Team' : 'To be decided';
  const lanes = ['winners', 'losers', 'finals'].filter(l => matches.some(m => laneOf(m) === l));
  const double = lanes.includes('finals');
  const entrants = teams.filter(t => matches.some(m => m.team_a === t.id || m.team_b === t.id));
  const ready = matches.filter(m => m.status === 'pending' && m.team_a && m.team_b);
  const played = matches.filter(m => m.status === 'completed').length;
  const champion = bracketChampion(matches);
  const next = ready[0];
  const grandFinal = matches.find(match => match.bracket === 'final');
  const resetRequired = grandFinal?.status === 'completed' && grandFinal.winner_id === grandFinal.team_b;
  const totalSeries = Math.max(1,double ? entrants.length * 2 - 2 + (resetRequired ? 1 : 0) : entrants.length - 1);
  const remaining = entrants.filter(team => teamLosses(team.id,matches) < (double ? 2 : 1)).length;
  const initials = (id: string | null) => name(id).replace(/^Test /,'').split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();
  const scorecard = matches.find(match => match.id === scorecardId && match.status === 'completed');
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
    <header className={styles.header}><div className={styles.title}><span className={styles.titleIcon}><GitBranch size={25}/></span><div><p>OG GAMING / COMPETITION</p><h3>{double ? 'Double elimination' : 'Event bracket'}</h3></div></div><div className={styles.summary}><span className={styles.headerBadge}>{champion ? 'FINAL RESULT' : 'LIVE BRACKET'}</span><button type="button" className={styles.refresh} aria-label="Refresh bracket" disabled={loading} onClick={() => void reload()}><RefreshCw size={16} className={loading ? styles.spinning : undefined}/></button></div></header>
    {admin && data && <div className={styles.managementBar}><div className={styles.drawStatus}>{pairingsLocked ? <LockKeyhole size={16}/> : <GitBranch size={16}/>}<p><strong>{pairingsLocked ? 'Opening draw locked' : 'Set the opening draw'}</strong><span>{pairingsLocked ? 'Matchups can only be arranged before play begins.' : 'Choose opponents or randomise teams before the first match.'}</span></p></div><button type="button" className={styles.manageButton} disabled={busy || loading || pairingsLocked} onClick={() => { setManaging(!managing); setEditingId(null); }}><Pencil size={14}/> {managing ? 'Close matchup manager' : 'Manage matchups'}</button></div>}
    {(error || failure) && <div role="alert" className={styles.error}><p>{failure || error}</p><button type="button" onClick={() => void reload()}>Retry loading</button></div>}
    {!data && !error && <div className={styles.empty} role="status"><RefreshCw size={24} className={styles.spinning}/><h4>Loading the bracket...</h4></div>}
    {managing && admin && data && !pairingsLocked && <BracketPairingsEditor matches={matches} teams={data.eligibleTeams || []} busy={busy} onClose={() => setManaging(false)} onSave={async pairings => { if (!matches.length && !window.confirm('Generate this bracket and close registration?')) return; if (await act(matches.length ? 'PATCH' : 'POST', { tournament_id: tournamentId, pairings, ...(matches.length ? { action: 'set_pairings' } : {}) })) setManaging(false); }}/>}
    {data && !error && !matches.length && !managing && <div className={styles.empty}><GitBranch size={36} strokeWidth={1.2}/><h4>The stage is being set.</h4><p>The tournament bracket will appear here once the teams are confirmed.</p>{admin && <><p>Approve and check in at least two eligible, paid teams. Generating the bracket closes registration.</p><button className={styles.primaryButton} disabled={busy} onClick={() => setManaging(true)}>Choose matchups <ArrowRight size={15}/></button></>}</div>}
    {matches.length > 0 && <>
      <div className={styles.overview} onPointerMove={event => { if (event.pointerType !== 'mouse') return; const rect=event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--glow-x',`${event.clientX-rect.left}px`); event.currentTarget.style.setProperty('--glow-y',`${event.clientY-rect.top}px`); }}>
        <div className={styles.overviewGrid}>
          <div className={styles.summaryPanel}>
            <p className={styles.heroEyebrow}><span className={styles.liveDot}/>{champion ? 'THE COMPETITION IS COMPLETE' : 'THE ROAD TO THE FINAL'}</p>
            <h4>{champion ? 'A champion is crowned.' : 'Every match matters.'}</h4>
            <dl className={styles.metrics}><div><dd>{entrants.length}</dd><dt>Teams entered</dt></div><div><dd>{played}<span>/{totalSeries}</span></dd><dt>Series played</dt></div><div><dd>{remaining}</dd><dt>{champion ? 'Champion' : 'Still in the game'}</dt></div></dl>
          </div>
          <div className={styles.nextMatch}>
            <p className={styles.heroEyebrow}>{champion ? 'TOURNAMENT CHAMPION' : next ? next.bracket === 'reset' ? 'UP NEXT / RESET FINAL' : next.bracket === 'final' ? 'UP NEXT / GRAND FINAL' : 'UP NEXT / READY TO PLAY' : 'NEXT MATCH'}</p>
            {champion ? <div className={styles.winnerPreview}><Trophy size={44} strokeWidth={1.2}/><strong>{name(champion)}</strong><span>GG. Well played.</span></div> : next ? <><div className={styles.matchupPreview}><div><span className={styles.teamMark}>{initials(next.team_a)}</span><strong>{name(next.team_a)}</strong></div><span className={styles.previewVersus}>VS</span><div><span className={styles.teamMark}>{initials(next.team_b)}</span><strong>{name(next.team_b)}</strong></div></div><div className={styles.nextMatchFooter}><span>{ready.length} {ready.length === 1 ? 'match' : 'matches'} ready</span><a href={'#bracket-match-'+next.id} className={styles.jumpToMatch}>View match <ArrowUpRight size={15}/></a></div></> : <div className={styles.waitingPreview}><GitBranch size={32} strokeWidth={1.2}/><strong>Waiting for the next matchup</strong><span>Teams advance as results are recorded.</span></div>}
          </div>
        </div>
        <div className={styles.overviewDetails}><details className={styles.formatDetails}><summary>How the format works <ChevronDown size={14}/></summary><p>First to two maps wins. Byes advance automatically.{double ? ' The winners finalist faces the losers finalist. If the losers finalist wins, a second BO3 decides the champion.' : ' Winners advance through each round to the final.'}</p></details>
        <details className={styles.standings}><summary>Team status &amp; losses <ChevronDown size={14}/></summary><ul>{entrants.map(team => { const losses = teamLosses(team.id, matches); return <li key={team.id}><strong>{team.team_name}</strong><span>{team.id === champion ? 'Champion' : losses >= (double ? 2 : 1) ? 'Eliminated' : losses ? 'Losers bracket' : 'Undefeated'} &middot; {losses} {losses === 1 ? 'loss' : 'losses'}</span></li>; })}</ul></details></div>
      </div>
      {lanes.map(lane => { const cardHeight = admin ? BRACKET_CARD_HEIGHT + 36 : BRACKET_CARD_HEIGHT; const layout = layoutBracket(matches.filter(m => laneOf(m) === lane), cardHeight); const expanded = expandedLane === lane; const scale = expanded ? zoom : 1; return <section key={lane} ref={expanded ? expandedRef : undefined} className={expanded ? styles.expandedLane : styles.lane} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={laneNames[lane]} tabIndex={expanded ? -1 : undefined}>
      <div className={styles.laneHeading}><h4>{lanes.length === 1 ? 'Bracket' : laneNames[lane]}</h4><div className={styles.laneTools}>{expanded && <><button type="button" disabled={zoom <= .15} aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.15,z-.1))}><ZoomOut size={16}/></button><span>{Math.round(zoom*100)}%</span><button type="button" disabled={zoom >= 1.5} aria-label="Zoom in" onClick={() => setZoom(z => Math.min(1.5,z+.1))}><ZoomIn size={16}/></button><button type="button" onClick={() => { const view = expandedViewport.current; if (view) setZoom(Math.max(.15,Math.min(1,(view.clientWidth-60)/layout.width,(view.clientHeight-60)/layout.height))); }}>Fit bracket</button></>}<button type="button" aria-label={(expanded ? 'Collapse ' : 'Expand ') + laneNames[lane]} aria-expanded={expanded} onClick={() => { setExpandedLane(expanded ? null : lane); setZoom(1); }}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>} {expanded ? 'Collapse' : 'Expand'}</button></div></div>
      {expanded && (failure || error) && <p role="alert" className={styles.error}>{failure || error}</p>}
      <div ref={expanded ? expandedViewport : undefined} className={styles.viewport} role="region" aria-label={laneNames[lane] || 'Event bracket'} tabIndex={0}><div style={{ width: layout.width * scale, height: layout.height * scale }}><div className={styles.canvas} style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <svg className={styles.connectors} width={layout.width} height={layout.height} aria-hidden="true">{layout.connections.map(c => <path key={c.key} d={c.path} className={c.completed ? styles.completedPath : undefined}/>)}</svg>
        {layout.columns.map((c, i) => <div className={styles.roundHeading} key={c.key} style={{ left: c.x, width: BRACKET_CARD_WIDTH }}><h4>{c.bracket === 'reset' ? 'Reset final' : c.bracket === 'final' ? 'Grand final' : lane === 'winners' && i === layout.columns.length - 1 ? lanes.length === 1 ? 'Final' : 'Upper final' : lane === 'winners' && i === layout.columns.length - 2 ? 'Semifinals' : 'Round ' + c.key}</h4><span>{c.bracket === 'reset' ? 'IF REQUIRED' : c.matchCount + (c.matchCount === 1 ? ' MATCH' : ' MATCHES')}</span></div>)}
        {layout.placements.map(({ match: m, x, y }) => <article className={styles.match + (editingId === m.id ? ' ' + styles.selectedMatch : '')} key={m.id} id={'bracket-match-'+m.id} style={{ left: x, top: y, width: BRACKET_CARD_WIDTH, height: cardHeight }} aria-label={'Round ' + m.round + ', match ' + m.position + ': ' + name(m.team_a) + ' versus ' + name(m.team_b)}>
          {m.status === 'completed' && <button type="button" className={styles.matchOpen} aria-label={'View scorecard: ' + name(m.team_a) + ' versus ' + name(m.team_b)} onClick={() => setScorecardId(m.id)}/>}
          <div className={styles.matchMeta}><span>{m.bracket === 'reset' ? 'GF2' : m.bracket === 'final' ? 'GF1' : `${m.bracket === 'losers' ? 'L' : 'W'}${m.round}-${m.position}`}</span><span className={m.status === 'completed' ? styles.completeStatus : undefined}>{m.status === 'completed' ? 'Completed' : m.status === 'bye' ? m.bracket === 'reset' ? 'Not required' : 'Bye' : m.team_a && m.team_b ? 'Ready to play' : 'Awaiting teams'}</span>{admin && m.team_a && m.team_b && m.status !== 'bye' && <button type="button" aria-label={'Edit result for round ' + m.round + ' match ' + m.position} disabled={busy || resultLocked(m, matches)} title={resultLocked(m, matches) ? 'Locked: a later match has finished' : 'Record BO3 result'} onClick={() => { setEditingId(editingId === m.id ? null : m.id); }}><Pencil size={12}/> Edit</button>}</div>
          {(['a', 'b'] as const).map(side => {
            const id = side === 'a' ? m.team_a : m.team_b, score = side === 'a' ? m.score_a : m.score_b;
            const winner = !!id && m.winner_id === id, lost = !!m.winner_id && !!id && !winner, label = id ? name(id) : placeholder(m, side);
            return <div key={side} className={styles.team + (winner ? ' ' + styles.winner : '') + (lost ? ' ' + styles.lost : '') + (!id ? ' ' + styles.pending : '')}><span className={styles.emblem} aria-hidden="true">{id ? label.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'OG' : <Shield size={16}/>}</span><span className={styles.teamName} title={label}>{label}</span>{winner && <Check className={styles.winnerCheck} size={12} aria-label="Winner"/>}<span className={styles.score}>{score ?? '—'}</span></div>;
          })}
          {admin && m.team_a && m.team_b && m.status !== 'bye' && <div className={styles.inlineScores}>{resultLocked(m, matches) ? <span>Result locked</span> : m.status !== 'completed' || editingId === m.id ? <>{[[2,0],[2,1],[1,2],[0,2]].map(([a,b]) => <button type="button" key={`${a}-${b}`} disabled={busy} aria-label={`${name(m.team_a)} ${a}, ${name(m.team_b)} ${b}`} onClick={async () => { if (await act('PATCH', {match_id:m.id,score_a:a,score_b:b})) setScorecardId(m.id); }}>{a}&ndash;{b}</button>)}{m.status === 'completed' && <button type="button" disabled={busy} onClick={() => void act('PATCH', {action:'clear_result',match_id:m.id})}>Clear</button>}</> : <span>BO3 complete</span>}</div>}
        </article>)}
      </div></div></div>
      <p className={styles.laneHint}><MoveHorizontal size={14}/> Scroll to explore rounds{admin ? '. Select a score to record maps won.' : '.'}</p>
      </section>; })}
      {scorecard && <MatchScorecardDialog key={scorecard.id + ':' + scorecard.score_a + ':' + scorecard.score_b} match={scorecard} teamA={name(scorecard.team_a)} teamB={name(scorecard.team_b)} admin={admin} onClose={() => setScorecardId(null)}/>}
      <footer className={styles.footer}><span><i/> Winner advances</span><span>Results managed by OG Gaming.</span></footer>

    </>}
  </section>;
}
