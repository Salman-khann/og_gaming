'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Gamepad2,
  Trophy,
  Target,
  Swords,
  Clock3,
  Crosshair,
  Activity,
  Check,
  Users,
} from 'lucide-react';
import styles from './PlayerProfile.module.css';
import type { LeaderboardPlayer } from '@/lib/leaderboard';
import { useAuth } from './AuthProvider';
import { useResource } from './useResource';

export type PlayerProfileData = {
  player: {
    id: string | null;
    faceit_id: string | null;
    faceit_nickname: string;
    faceit_avatar_url?: string | null;
    faceit_level: number;
    faceit_elo: number;
  };
  stats: LeaderboardPlayer | null;
  history: { id: string; title: string; scheduled_time: string }[];
  tournaments: { id: string; team_name: string; tournament: { title: string; slug: string } }[];
};

export function PlayerProfile({ playerId }: { playerId: string }) {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useResource<PlayerProfileData>(
    '/api/players?player_id=' + encodeURIComponent(playerId),
  );
  const player = data?.player,
    stats = data?.stats;
  const value = (number: number | null | undefined, suffix = '') =>
    number == null ? '—' : number.toLocaleString('en-PK') + suffix;
  const level = player?.faceit_id ? (stats?.level ?? player.faceit_level) : null;
  const metrics = [
    {
      label: 'Matches played',
      number: value(stats?.matches),
      detail: 'CS2 lifetime',
      icon: Gamepad2,
    },
    { label: 'Total wins', number: value(stats?.wins), detail: 'Matches won', icon: Trophy },
    {
      label: 'Win rate',
      number: value(stats?.win_rate, '%'),
      detail: 'Of all matches',
      icon: Target,
    },
    {
      label: 'Average K/D',
      number: value(stats?.kd_ratio),
      detail: 'Kills per death',
      icon: Activity,
    },
    {
      label: 'Headshots',
      number: value(stats?.headshot_rate, '%'),
      detail: 'Average headshot rate',
      icon: Crosshair,
    },
  ];
  return (
    <main className={'wrap ' + styles.page}>
      <div className={styles.toolbar}>
        <Link className={styles.back} href="/leaderboard">
          <ArrowLeft size={16} /> Back to leaderboard
        </Link>
        <span className={styles.toolbarLabel}>
          OG GAMING <span>/</span> PLAYER PROFILE
        </span>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!data && !error && (
        <div className={styles.loading} role="status">
          <RefreshCw size={20} className={styles.spinning} /> Loading player statistics…
        </div>
      )}
      {player && (
        <>
          <section className={styles.hero} aria-label="Player overview">
            <div className={styles.heroMain}>
              <div className={styles.gameLabel}>
                <span /> COUNTER-STRIKE 2 <span className={styles.labelDivider}>/</span> FACEIT
              </div>
              <div className={styles.identity}>
                <div className={styles.avatarWrap}>
                  <Avatar
                    key={player.faceit_avatar_url}
                    src={player.faceit_avatar_url}
                    name={player.faceit_nickname}
                  />
                  {player.faceit_id && (
                    <span className={styles.avatarCheck} aria-label="Verified FACEIT account">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className={styles.identityText}>
                  <p className={styles.kicker}>THE PLAYER</p>
                  <h1>{player.faceit_nickname}</h1>
                  <p className={styles.connected}>
                    <ShieldCheck size={14} />{' '}
                    {player.faceit_id ? 'Verified FACEIT account' : 'OG Gaming player'}
                  </p>
                </div>
              </div>
              <div className={styles.heroActions}>
                {player.faceit_id && (
                  <a
                    className={styles.primaryButton}
                    href={
                      'https://www.faceit.com/en/players/' +
                      encodeURIComponent(player.faceit_nickname)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    FACEIT profile <ArrowUpRight size={16} />
                  </a>
                )}
                <button
                  className={styles.secondaryButton}
                  disabled={loading}
                  onClick={() => void reload()}
                >
                  <RefreshCw size={14} className={loading ? styles.spinning : undefined} />
                  {loading ? 'Refreshing…' : 'Refresh stats'}
                </button>
              </div>
            </div>
            <div className={styles.rating}>
              <div className={styles.ratingHeading}>
                <span>COMPETITIVE RATING</span>
                <Swords size={17} />
              </div>
              <div className={styles.elo}>
                {player.faceit_id ? value(stats?.elo ?? player.faceit_elo) : '—'}
                <span>ELO</span>
              </div>
              <div className={styles.levelRow}>
                <span className={styles.levelBadge}>{level ?? '—'}</span>
                <div>
                  <strong>FACEIT {level ? 'level ' + level : 'unranked'}</strong>
                  <span>Counter-Strike 2</span>
                </div>
              </div>
              <div
                className={styles.levelTrack}
                aria-label={level ? 'FACEIT level ' + level + ' out of 10' : 'FACEIT not connected'}
              >
                {Array.from({ length: 10 }, (_, index) => (
                  <span
                    key={index}
                    className={level && index < level ? styles.levelActive : undefined}
                  />
                ))}
              </div>
              <div className={styles.trackLabels}>
                <span>LEVEL 1</span>
                <span>LEVEL 10</span>
              </div>
            </div>
          </section>

          {!player.faceit_id && (
            <div className={styles.notice}>
              <ShieldCheck size={20} />
              <div>
                <strong>Connect your competitive profile</strong>
                <p>FACEIT statistics will appear once a verified CS2 account is connected.</p>
              </div>
              {profile?.id === player.id && (
                <a className={styles.primaryButton} href="/api/auth/faceit">
                  Sign in with FACEIT <ArrowUpRight size={15} />
                </a>
              )}
            </div>
          )}

          <section className={styles.performance} aria-labelledby="performance-title">
            <div className={styles.sectionHeading}>
              <h2 id="performance-title">Performance overview</h2>
              <span>LIFETIME STATS</span>
            </div>
            <dl className={styles.metrics}>
              {metrics.map(({ label, number, detail, icon: Icon }) => (
                <div className={styles.metric} key={label}>
                  <dt>
                    <span>{label}</span>
                    <Icon size={17} strokeWidth={1.5} />
                  </dt>
                  <dd>
                    {number}
                    <span className={styles.metricDetail}>{detail}</span>
                    {label === 'Win rate' && stats?.win_rate != null && (
                      <span className={styles.winTrack} aria-hidden="true">
                        <span style={{ width: Math.max(0, Math.min(100, stats.win_rate)) + '%' }} />
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className={styles.updated}>
              <Clock3 size={13} />
              <p>
                {stats?.stats_updated_at ? (
                  <>
                    Updated{' '}
                    {new Date(stats.stats_updated_at).toLocaleString('en-PK', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'Asia/Karachi',
                    })}{' '}
                    PKT
                    <span className={styles.updateDetail}>
                      {' '}
                      · Refreshes every 15 minutes when viewed
                    </span>
                  </>
                ) : player.faceit_id ? (
                  'Lifetime statistics are temporarily unavailable. Try refreshing shortly.'
                ) : (
                  'Connect FACEIT to see your lifetime statistics.'
                )}
              </p>
            </div>
          </section>

          <div className={styles.historyGrid}>
            <section className={styles.historyPanel} aria-labelledby="matches-title">
              <div className={styles.panelHeading}>
                <div>
                  <Swords size={18} />
                  <h2 id="matches-title">OG Gaming matches</h2>
                </div>
                <span>{data.history.length}</span>
              </div>
              {data.history.length ? (
                <div className={styles.records}>
                  {data.history.map((match) => (
                    <article key={match.id}>
                      <h3>{match.title}</h3>
                      <p>
                        {new Date(match.scheduled_time).toLocaleString('en-PK', {
                          timeZone: 'Asia/Karachi',
                        })}{' '}
                        PKT
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}>
                    <Swords size={25} strokeWidth={1.3} />
                  </span>
                  <h3>The next match is yours.</h3>
                  <p>Completed OG Gaming matches will appear here.</p>
                  <Link href="/matches">
                    Find a match <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </section>
            <section className={styles.historyPanel} aria-labelledby="teams-title">
              <div className={styles.panelHeading}>
                <div>
                  <Trophy size={18} />
                  <h2 id="teams-title">Tournament teams</h2>
                </div>
                <span>{data.tournaments.length}</span>
              </div>
              {data.tournaments.length ? (
                <div className={styles.records}>
                  {data.tournaments.map((entry) => (
                    <article key={entry.id}>
                      <Link href={'/tournaments/' + entry.tournament.slug}>
                        {entry.tournament.title} <ArrowUpRight size={14} />
                      </Link>
                      <p>
                        <Users size={13} />
                        {entry.team_name}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}>
                    <Trophy size={25} strokeWidth={1.3} />
                  </span>
                  <h3>Make your tournament debut.</h3>
                  <p>Your approved tournament teams will appear here.</p>
                  <Link href="/tournaments">
                    Explore tournaments <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </section>
          </div>
          <p className={styles.footer}>
            <ShieldCheck size={13} /> Player statistics provided by FACEIT{' '}
            <span>OG GAMING / PLAY. COMPETE. CONNECT.</span>
          </p>
        </>
      )}
    </main>
  );
}

function Avatar({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image
      className={styles.avatarImage}
      src={src}
      alt={name + ' avatar'}
      width={96}
      height={96}
      unoptimized
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={styles.avatarInitials} aria-hidden="true">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
