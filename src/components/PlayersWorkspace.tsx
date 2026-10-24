'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAppendPages } from './useAppendPages';
import { useResource } from './useResource';
import { PlayerProfile } from './PlayerProfile';

type Player = {
  id: string;
  faceit_id: string | null;
  faceit_nickname: string;
  faceit_level: number;
  faceit_elo: number;
};

export function PlayersWorkspace() {
  const playerId = useSearchParams().get('player_id');
  return playerId ? <PlayerProfile playerId={playerId} /> : <PlayerDirectory />;
}

function PlayerDirectory() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState('');
  const { data, error, loading } = useResource<{ players: Player[]; total: number }>(
    '/api/players?page=' + page + '&search=' + encodeURIComponent(search),
  );
  const players = useAppendPages(search, page, data?.players);
  return (
    <main className="wrap arena-main">
      <p className="eyebrow">OG GAMING / PLAYERS</p>
      <h1>Meet the players.</h1>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading players...</p>}
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(String(new FormData(event.currentTarget).get('search') || '').trim());
          setPage(1);
        }}
      >
        <label>
          Find player
          <input name="search" maxLength={40} />
        </label>
        <button className="button secondary">Search</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {players.map((player) => (
          <article key={player.id} className="admin-section">
            <Link className="text-link" href={'/players/' + player.id}>
              {player.faceit_nickname}
            </Link>
            <p className="muted">
              {player.faceit_id
                ? 'Level ' + player.faceit_level + ' · ' + player.faceit_elo + ' ELO'
                : 'Unranked'}
            </p>
          </article>
        ))}
      </div>
      {!loading && !error && !players.length && <p className="muted">No players found.</p>}
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
