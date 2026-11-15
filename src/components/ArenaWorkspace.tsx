'use client';
import { ArenaLoading } from './ui/arena-loading';
import { useLoadingVisibility } from './useLoadingVisibility';
import Link from 'next/link';
import { useAppendPages } from './useAppendPages';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import type { MatchRequest, Tournament, Registration } from '@/types';

const MatchBoard = dynamic(() => import('./MatchBoard').then((m) => m.MatchBoard), {
  loading: () => <ArenaLoading />,
});
const TournamentsView = dynamic(() => import('./TournamentsView').then((m) => m.TournamentsView), {
  loading: () => <ArenaLoading />,
});
const AdminPanel = dynamic(() => import('./AdminPanel').then((m) => m.AdminPanel), {
  loading: () => <ArenaLoading />,
});
type Tab = 'matches' | 'tournaments';
type ArenaData = {
  matches: MatchRequest[];
  tournaments: Tournament[];
  registrations: Registration[];
  has_more: boolean;
  registrations_has_more: boolean;
};
const empty: ArenaData = {
  matches: [],
  tournaments: [],
  registrations: [],
  has_more: false,
  registrations_has_more: false,
};

export function ArenaWorkspace({
  admin = false,
  embedded = false,
  section,
}: {
  admin?: boolean;
  embedded?: boolean;
  section?: Tab;
}) {
  const Container = embedded ? 'div' : 'main';
  const { profile, loading: authLoading } = useAuth();
  const [selectedTab, setSelectedTab] = useState<Tab>('tournaments');
  const tab = section || selectedTab;
  const [page, setPage] = useState(1),
    [registrationPage, setRegistrationPage] = useState(1);
  const [adminRevision, setAdminRevision] = useState(0);
  const refreshAdmin = useCallback(() => {
    setPage(1);
    setRegistrationPage(1);
    setAdminRevision((value) => value + 1);
  }, []);
  const identityScope = `${admin ? 'admin' : tab}:${profile?.id || 'guest'}`;
  const scope = `${identityScope}:${adminRevision}`;
  const dataScope = `${scope}:${page}:${registrationPage}`;
  const [data, setData] = useState<ArenaData>(empty);
  const [loading, setLoading] = useState(true);
  const [loadedSection, setLoadedSection] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const afterMutation = useCallback(
    (message = 'Changes saved.') => {
      setNotice(message);
      refreshAdmin();
    },
    [refreshAdmin],
  );
  const controller = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);
  const load = useCallback(async () => {
    lastRefresh.current = Date.now();
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError('');
    try {
      const endpoint =
        (admin || tab === 'tournaments' ? '/api/tournaments' : '/api/matches') +
        '?page=' +
        page +
        '&registration_page=' +
        registrationPage +
        (admin ? '&admin=1' : '');
      const response = await fetch(endpoint, { signal: request.signal, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load this section.');
      if (!request.signal.aborted) {
        setData((previous) => ({ ...previous, ...result }));
        setLoadedSection(dataScope);
      }
    } catch (error) {
      if (!request.signal.aborted)
        setError(error instanceof Error ? error.message : 'Unable to connect.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [admin, tab, dataScope, page, registrationPage]);
  useEffect(() => {
    if (authLoading || (admin && profile?.role !== 'admin')) return;
    const initial = window.setTimeout(() => void load(), 0);
    const refresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh.current >= 15000)
        refreshAdmin();
    };
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 60000);
    return () => {
      window.clearTimeout(initial);
      controller.current?.abort();
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [load, authLoading, admin, profile?.id, profile?.role, refreshAdmin]);
  const ready = loadedSection === dataScope;
  const sameIdentity = loadedSection.startsWith(identityScope + ':');
  const cacheScope = sameIdentity ? loadedSection.split(':').slice(0, -2).join(':') : scope;
  const visibleMatches = useAppendPages(
    cacheScope + ':matches',
    page,
    ready ? data.matches : undefined,
  );
  const visibleTournaments = useAppendPages(
    cacheScope + ':tournaments',
    page,
    ready ? data.tournaments : undefined,
  );
  const visibleRegistrations = useAppendPages(
    cacheScope + ':registrations',
    registrationPage,
    ready ? data.registrations : undefined,
  );
  const displayReady =
    ready ||
    (sameIdentity &&
      (tab === 'matches' && !admin ? visibleMatches.length > 0 : visibleTournaments.length > 0));
  const showLoading = useLoadingVisibility(authLoading || (loading && !displayReady));
  if (admin && authLoading)
    return (
      <Container className="wrap arena-main">
        <ArenaLoading />
      </Container>
    );
  if (admin && profile?.role !== 'admin')
    return (
      <Container className="wrap arena-main">
        <h1>Administration</h1>
        <p>Administrator access required.</p>
        {!profile && (
          <Link className="button" href="/login">
            Sign in
          </Link>
        )}
      </Container>
    );
  return (
    <Container className={'wrap arena-main ' + (admin ? 'admin-workspace' : '')}>
      <div className="arena-heading">
        <div>
          <p className="eyebrow">
            OG GAMING /{' '}
            {admin ? 'ADMINISTRATION' : tab === 'matches' ? '5V5 MATCHING' : 'TOURNAMENTS'}
          </p>
          <h1>
            {admin
              ? 'Administration.'
              : tab === 'matches'
                ? 'Find your next 5v5.'
                : 'Play for the title.'}
          </h1>
          <p className="muted">
            {admin
              ? 'Tournaments, players and teams — all in one place.'
              : tab === 'matches'
                ? 'Find players, form your squad, and join a match.'
                : 'Browse events and register your team.'}
          </p>
        </div>
        <button className="button secondary" onClick={refreshAdmin} disabled={loading}>
          Refresh
        </button>
      </div>
      {!admin && (
        <div
          className="arena-tabs"
          role={section ? undefined : 'tablist'}
          aria-label="Competition sections"
        >
          {(['tournaments', 'matches'] as Tab[]).map((key) =>
            section ? (
              <Link
                key={key}
                href={'/' + key}
                className={'arena-tab-link ' + (tab === key ? 'active' : '')}
              >
                {key === 'matches' ? '5v5 Matching' : 'Tournaments'}
              </Link>
            ) : (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                aria-controls="arena-content"
                id={'tab-' + key}
                onClick={() => {
                  setSelectedTab(key);
                  setPage(1);
                  setRegistrationPage(1);
                }}
              >
                {key === 'matches' ? '5v5 Matching' : 'Tournaments'}
              </button>
            ),
          )}
        </div>
      )}
      <div
        className="arena-content"
        id="arena-content"
        role={!admin && !section ? 'tabpanel' : undefined}
        aria-labelledby={!admin && !section ? 'tab-' + tab : undefined}
      >
        {notice && (
          <p className="success-message" role="status">
            {notice}
          </p>
        )}
        {error && (
          <div className="error-message mb-6" role="alert">
            <p>{error}</p>
            <button className="button secondary mt-4" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}
        {showLoading ? (
          <ArenaLoading />
        ) : !displayReady ? null : admin ? (
          profile?.role === 'admin' ? (
            <AdminPanel
              registrations={visibleRegistrations}
              tournaments={visibleTournaments}
              onDataRefresh={afterMutation}
            />
          ) : (
            <p>Administrator access required.</p>
          )
        ) : tab === 'tournaments' ? (
          <TournamentsView
            tournaments={visibleTournaments}
            registrations={visibleRegistrations}
            currentProfile={profile}
            onRegistrationCreated={afterMutation}
            externalNotice
          />
        ) : (
          <MatchBoard
            matches={visibleMatches}
            currentProfile={profile}
            onMatchUpdated={afterMutation}
            externalNotice
          />
        )}
      </div>
      {ready && data.has_more && (
        <button
          className="button secondary list-more"
          disabled={loading}
          onClick={() => setPage(page + 1)}
        >
          Load more {admin ? 'tournaments' : tab}
        </button>
      )}
      {ready && admin && data.registrations_has_more && (
        <button
          className="button secondary list-more"
          disabled={loading}
          onClick={() => setRegistrationPage(registrationPage + 1)}
        >
          Load more registrations
        </button>
      )}
    </Container>
  );
}
