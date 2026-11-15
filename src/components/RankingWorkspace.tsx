'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAppendPages } from './useAppendPages';
import type { LeaderboardPlayer } from '@/lib/leaderboard';
import { useResource } from './useResource';
export function Leaderboard() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useResource<{
    players: LeaderboardPlayer[];
    total: number;
  }>('/api/leaderboard?page=' + page);
  const players = useAppendPages('rankings', page, data?.players);
  const value = (number: number | null, suffix = '') => (number == null ? '—' : number + suffix);
  return (
    <main className="wrap arena-main">
      <div className="arena-heading">
        <div>
          <p className="eyebrow">OG GAMING / LEADERBOARD</p>
          <h1>Top FACEIT players.</h1>
          <p className="muted">
            Ranked by verified CS2 ELO, then win rate and K/D. Stats refresh in the background.
          </p>
        </div>
        <button className="button secondary" disabled={loading} onClick={() => void reload()}>
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading verified stats...</p>}
      {!loading && !error && !players.length && (
        <div className="empty-state">
          <h2>No cached rankings on this page.</h2>
          <p className="muted">
            Connect FACEIT or join an approved roster. Newly added statistics may take a moment to
            refresh.
          </p>
        </div>
      )}
      {!!players.length && (
        <div className="leaderboard-scroll">
          <table className="leaderboard-table">
            <caption>Verified FACEIT CS2 statistics</caption>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Level</th>
                <th>ELO</th>
                <th>Matches</th>
                <th>Wins</th>
                <th>Win rate</th>
                <th>K/D</th>
                <th>Headshots</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, index) => (
                <tr key={p.faceit_id}>
                  <td>{index + 1}</td>
                  <th scope="row">
                    <Link className="text-link" href={'/players/' + p.faceit_id}>
                      {p.nickname}
                    </Link>
                  </th>
                  <td>{p.level}</td>
                  <td>{p.elo}</td>
                  <td>{value(p.matches)}</td>
                  <td>{value(p.wins)}</td>
                  <td>{value(p.win_rate, '%')}</td>
                  <td>{value(p.kd_ratio)}</td>
                  <td>{value(p.headshot_rate, '%')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page * 25 < (data?.total || 0) && (
        <button
          className="button secondary list-more"
          disabled={loading}
          onClick={() => setPage(page + 1)}
        >
          Load more players
        </button>
      )}
    </main>
  );
}
