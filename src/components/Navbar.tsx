'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from './AuthProvider';
export function Navbar() {
  const { profile, loading, logout } = useAuth();
  return <header className="site-header"><div className="wrap header-row">
    <Link href="/" aria-label="OG Gaming home"><Image src="/site_assets/logo_0.png" alt="OG Gaming" width={150} height={78} priority className="brand-logo" /></Link>
    <nav aria-label="Main navigation"><Link href="/matches">5v5 Matching</Link><Link href="/tournaments">Tournaments</Link><Link href="/teams">Teams</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/community">Community</Link>{profile?.role === 'admin' && <Link href="/admin">Administration</Link>}</nav>
    <div className="account-links">{loading ? <span className="muted">Loading account…</span> : profile ? <><Link className="account-name" href={'/players/'+profile.id}>{profile.faceit_nickname}</Link><button className="button secondary" onClick={() => void logout()}>Log out</button></> : <><Link href="/login">Log in</Link><Link href="/signup" className="button">Sign up</Link></>}</div>
  </div></header>;
}
