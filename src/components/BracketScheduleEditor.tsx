'use client';
import { useState } from 'react';
import type { TournamentMatch } from '@/types';
import { PLAY_DAYS, scheduleMatches, validateSchedule, matchTimeLabel, type BracketSchedule } from '@/lib/bracket-schedule';
import styles from './TournamentBracket.module.css';

export function BracketScheduleEditor({ schedule, startDate, matches, busy, locked, onSave }: { schedule: BracketSchedule | null; startDate: string; matches: TournamentMatch[]; busy: boolean; locked: boolean; onSave: (value: BracketSchedule | null) => Promise<boolean> }) {
  const [date, setDate] = useState(schedule?.start_date || new Date(Date.parse(startDate) + 5 * 3600000).toISOString().slice(0, 10));
  const [days, setDays] = useState(schedule?.days || [0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState(''), [saved, setSaved] = useState(false);
  let preview: [string, string][] = [];
  let problem = '';
  try { preview = Object.entries(scheduleMatches(matches, validateSchedule({ start_date: date, days }))); }
  catch (error) { problem = error instanceof Error ? error.message : 'Invalid schedule.'; }
  return <details className={styles.scheduleEditor}>
    <summary>Match schedule <span>{schedule ? '8:00 PM & 11:30 PM PKT' : 'Set automatic slots'}</span></summary>
    <p>Two matches per play day, at 8:00 PM and 11:30 PM PKT. Dates are assigned automatically in bracket order. The reset final is reserved only if needed.</p>
    <form onSubmit={async event => { event.preventDefault(); setError(''); setSaved(false); try { const value = validateSchedule({ start_date: date, days }); if (await onSave(value)) setSaved(true); } catch (error) { setError(error instanceof Error ? error.message : 'Invalid schedule.'); } }}>
      <fieldset disabled={busy || locked}>
        <label className={styles.scheduleDate}>First play date (PKT)<input type="date" required max="9998-12-31" value={date} onChange={event => { setDate(event.target.value); setSaved(false); }}/></label>
        <div className={styles.playDays} role="group" aria-label="Play days">{PLAY_DAYS.map((label, day) => <label key={day}><input type="checkbox" checked={days.includes(day)} onChange={() => { setDays(days.includes(day) ? days.filter(value => value !== day) : [...days, day]); setSaved(false); }}/>{label}</label>)}</div>
        {preview.length > 0 && <p className={styles.schedulePreview}>{preview.length} reserved slots · {matchTimeLabel(preview[0][1])} → {matchTimeLabel(preview[preview.length - 1][1])}</p>}
        {!matches.length && <p>Save now; match dates will appear when you generate the bracket.</p>}
        {(error || problem) && <p role="alert" className={styles.error}>{error || problem}</p>}
        <div className={styles.scheduleActions}><button type="submit" className={styles.manageButton} disabled={!!problem}>{busy ? 'Saving…' : 'Save schedule'}</button>{schedule && <button type="button" className={styles.manageButton} onClick={async () => { setSaved(false); if (await onSave(null)) setSaved(true); }}>Remove schedule</button>}</div>
      </fieldset>
      {locked && <p>The schedule is locked after the first result to preserve match dates.</p>}
      {saved && <p role="status">Schedule saved.</p>}
    </form>
  </details>;
}
