'use client';
import { useState } from 'react';
import { ArrowLeftRight, Check, RotateCcw, Shuffle, X } from 'lucide-react';
import type { TournamentMatch } from '@/types';
import { automaticPairings, randomPairings, currentPairings, validatePairings, type OpeningPairing } from '@/lib/bracket-pairings';
import styles from './TournamentBracket.module.css';

export function BracketPairingsEditor({ matches, teams, busy, onSave, onClose }: {
  matches: TournamentMatch[]; teams: { id: string; team_name: string }[]; busy: boolean;
  onSave: (pairings: OpeningPairing[]) => Promise<void>; onClose: () => void;
}) {
  const opening = currentPairings(matches);
  const entrantIds = opening.length ? opening.flatMap(pair => [pair.team_a, pair.team_b]).filter((id): id is string => !!id) : teams.map(team => team.id);
  const entrants = teams.filter(team => entrantIds.includes(team.id));
  const [pairings, setPairings] = useState<OpeningPairing[]>(() => opening.length ? opening : entrants.length >= 2 ? automaticPairings(entrantIds) : []);
  let problem = '';
  try {
    if (entrants.length !== entrantIds.length) throw new Error('An entrant is no longer eligible. Restore their approval and payment before changing matchups.');
    validatePairings(pairings, entrantIds, opening.length || undefined);
  } catch (error) { problem = error instanceof Error ? error.message : 'Check your matchups.'; }
  function choose(index: number, side: 'team_a' | 'team_b', selected: string) {
    const id = selected || null;
    setPairings(previous => {
      const next = previous.map(pair => ({ ...pair })), displaced = next[index][side];
      if (id) for (let at = 0; at < next.length; at++) for (const key of ['team_a', 'team_b'] as const) {
        if ((at !== index || key !== side) && next[at][key] === id) next[at][key] = displaced;
      }
      next[index][side] = id;
      return next;
    });
  }
  return <section className={styles.pairingEditor} aria-label="Manage opening matchups">
    <div className={styles.editorHeading}><div><h4>Choose who plays whom</h4><p>Each team appears once. Selecting an assigned team swaps its position. An odd team advances automatically.</p></div><button type="button" disabled={busy} aria-label="Close matchup manager" onClick={onClose}><X size={18}/></button></div>
    {entrants.length < 2 && <p className={styles.pairingWarning}>At least two teams must be approved, checked in and paid before you can create matchups.</p>}
    <div className={styles.pairingActions}><button type="button" className={styles.resetPairings} disabled={busy || entrants.length < 2 || entrants.length !== entrantIds.length} onClick={() => setPairings(randomPairings(entrantIds))}><Shuffle size={15}/> Randomise matchups</button><span>Shuffles Team A and Team B. Review the draw, then save it.</span></div>
    <form onSubmit={event => { event.preventDefault(); if (!problem) void onSave(pairings); }}>
      <div className={styles.pairingList}>{pairings.map((pair, index) => <fieldset className={styles.pairingRow} key={index} disabled={busy}><legend>Match {String(index + 1).padStart(2, '0')}</legend>
        <label>Team A{pair.team_a ? <select value={pair.team_a} onChange={event => choose(index, 'team_a', event.target.value)}>{entrants.map(team => <option key={team.id} value={team.id}>{team.team_name}</option>)}</select> : <span className={styles.automaticAdvance}>Automatic advance</span>}</label>
        <ArrowLeftRight size={17} aria-label="versus"/>
        <label>Team B{pair.team_b ? <select value={pair.team_b} onChange={event => choose(index, 'team_b', event.target.value)}>{entrants.map(team => <option key={team.id} value={team.id}>{team.team_name}</option>)}</select> : <span className={styles.automaticAdvance}>Automatic advance</span>}</label>
      </fieldset>)}</div>
      {problem && entrants.length >= 2 && <p role="alert" className={styles.pairingWarning}>{problem}</p>}
      <div className={styles.pairingActions}><button type="button" className={styles.resetPairings} disabled={busy || entrants.length < 2 || entrants.length !== entrantIds.length} onClick={() => setPairings(automaticPairings(entrantIds))}><RotateCcw size={13}/> Reset to automatic</button><span>Later rounds follow match winners automatically.</span><button className={styles.primaryButton} disabled={busy || !!problem}>{busy ? 'Saving…' : matches.length ? 'Save matchups' : 'Generate bracket'} <Check size={15}/></button></div>
    </form>
  </section>;
}
