'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CyberBackground } from '@/components/CyberBackground';
import { BookingCalendar } from '@/components/BookingCalendar';
import { MatchBoard } from '@/components/MatchBoard';
import { TournamentsView } from '@/components/TournamentsView';
import { AdminPanel } from '@/components/AdminPanel';
import { Profile, Cabin, SlotRequest, MatchRequest, Tournament, Registration } from '@/types';
import {
  Menu,
  X,
  ArrowRight,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  Monitor,
  Gamepad2,
  Users,
  Sparkles,
  Trophy,
  Swords,
  ChevronRight,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Flame,
  Calendar,
  Shield,
  User,
  ChevronDown,
  Check,
  LogIn,
  LogOut,
  RefreshCw,
  Bell,
  Wifi,
  Cpu,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function SteamIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.979 0C5.669 0 .506 4.908.031 11.121l6.634 2.742c.563-.393 1.248-.627 1.99-.627.129 0 .256.008.381.022l3.053-4.423V8.8a4.992 4.992 0 0 1 4.985-4.985 4.992 4.992 0 0 1 4.985 4.985 4.992 4.992 0 0 1-4.985 4.985c-.068 0-.135-.004-.202-.008l-4.364 3.098c.01.109.018.22.018.332 0 2.298-1.865 4.163-4.163 4.163-2.046 0-3.743-1.479-4.093-3.428L.47 16.273C1.968 20.764 6.586 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zm-3.324 15.289a2.502 2.502 0 0 0-2.38 1.728l-1.92-.793c.273-1.076 1.056-1.947 2.089-2.315.347-.124.717-.193 1.102-.193 1.841 0 3.333 1.492 3.333 3.333s-1.492 3.333-3.333 3.333c-1.841 0-3.333-1.492-3.333-3.333 0-.158.016-.312.042-.464l1.966.812a2.497 2.497 0 0 0 2.434-.099 2.501 2.501 0 0 0 1.076-2.054 2.5 2.5 0 0 0-1.076-1.955zM17.075 6.315a2.492 2.492 0 1 0 0 4.985 2.492 2.492 0 0 0 0-4.985z" />
    </svg>
  );
}

function FaceitIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#ff5500">
      <path d="M23.999 2.204c-.115-.494-.6-.79-1.094-.672L1.134 6.812c-.521.127-.852.65-.733 1.17l3.659 15.932c.119.52.645.845 1.166.72l21.771-5.281c.494-.117.791-.606.673-1.1L23.999 2.204zm-4.708 6.574-5.918 8.04-2.82-5.59 8.738-2.45z" />
    </svg>
  );
}

interface BayDetails {
  tag: string;
  name: string;
  type: 'pc' | 'ps5';
  desc: string;
  specs: string[];
  games: string[];
  status: 'live' | 'soon';
}

const BAYS_DATA: BayDetails[] = [
  {
    tag: 'CABIN 01',
    name: 'Esports PC Cabin 01',
    type: 'pc',
    desc: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors.',
    specs: ['240Hz MSI Rapid IPS Monitors', 'GeForce RTX 40-Series GPUs', 'Japanese Aqua Ergonomic Chairs', 'Chilled Sub-Zero Air Conditioning', 'Mechanical Keyboards & High-DPI Mice'],
    games: ['Counter-Strike 2', 'Valorant', 'Apex Legends', 'GTA V / FiveM', 'Call of Duty: Warzone'],
    status: 'live',
  },
  {
    tag: 'CABIN 02',
    name: 'Esports PC Cabin 02',
    type: 'pc',
    desc: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors.',
    specs: ['240Hz MSI Rapid IPS Monitors', 'GeForce RTX 40-Series GPUs', 'Japanese Aqua Ergonomic Chairs', 'Chilled Sub-Zero Air Conditioning', 'Mechanical Keyboards & High-DPI Mice'],
    games: ['Counter-Strike 2', 'Valorant', 'Apex Legends', 'GTA V / FiveM', 'Dota 2'],
    status: 'live',
  },
  {
    tag: 'CABIN 03',
    name: 'Esports PC Cabin 03',
    type: 'pc',
    desc: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors.',
    specs: ['240Hz MSI Rapid IPS Monitors', 'GeForce RTX 40-Series GPUs', 'Japanese Aqua Ergonomic Chairs', 'Chilled Sub-Zero Air Conditioning', 'Mechanical Keyboards & High-DPI Mice'],
    games: ['Counter-Strike 2', 'Valorant', 'Apex Legends', 'Fortnite', 'Overwatch 2'],
    status: 'live',
  },
  {
    tag: 'CABIN 04',
    name: 'Esports PC Cabin 04',
    type: 'pc',
    desc: 'A fourth 5-seat PC cabin, currently being built out.',
    specs: ['240Hz Ultra-fast Displays', 'Next-Gen Battle Station Rigs', 'Private Team Sound Dampening', 'Dedicated Coach & Analyst Screen'],
    games: ['CS2 Premier Ready', 'Bootcamp Optimized'],
    status: 'soon',
  },
  {
    tag: 'LOUNGE',
    name: 'VIP PS5 Slim Lounge',
    type: 'ps5',
    desc: '4 PS5 Slim Digital Edition consoles, bean bags, chilled AC.',
    specs: ['4 × Sony PS5 Slim Digital Edition', '4K 120Hz Ultra HD HDR Gaming Displays', 'DualSense Wireless Controllers', 'Plush Ultra-Comfort Bean Bags', 'Chilled High-Output AC'],
    games: ['EA Sports FC 25 / FIFA', 'Tekken 8', 'Mortal Kombat 1', 'NBA 2K25', 'Spider-Man 2'],
    status: 'live',
  },
];

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [selectedBay, setSelectedBay] = useState<BayDetails | null>(null);

  // Arena Engine State
  const [arenaTab, setArenaTab] = useState<string>('calendar');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [bookings, setBookings] = useState<SlotRequest[]>([]);
  const [matches, setMatches] = useState<MatchRequest[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isArenaLoading, setIsArenaLoading] = useState(true);

  // Login Modal State (Google, Steam, FACEIT)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeLoginProvider, setActiveLoginProvider] = useState<'google' | 'steam' | 'faceit'>('google');
  const [googleEmail, setGoogleEmail] = useState('');
  const [steamUsername, setSteamUsername] = useState('');
  const [faceitNickname, setFaceitNickname] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Faceit lookup dialog state
  const [customNickname, setCustomNickname] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customError, setCustomError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const whatsappBaseUrl = 'https://wa.me/923062779481';
  const whatsappUrl = `${whatsappBaseUrl}?text=Hi%20OG%20Gaming%2C%20I%27d%20like%20to%20book%20a%20bay`;

  // Fetch all initial Arena Engine data
  const loadArenaData = async () => {
    try {
      const [bookingsRes, matchesRes, tourneysRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/matches'),
        fetch('/api/tournaments'),
      ]);

      const bookingsData = await bookingsRes.json();
      const matchesData = await matchesRes.json();
      const tourneysData = await tourneysRes.json();

      if (bookingsData.cabins) setCabins(bookingsData.cabins);
      if (bookingsData.bookings) setBookings(bookingsData.bookings);
      if (matchesData.matches) setMatches(matchesData.matches);
      if (tourneysData.tournaments) setTournaments(tourneysData.tournaments);
      if (tourneysData.registrations) setRegistrations(tourneysData.registrations);

      // Default demo profiles
      const defaultProfiles: Profile[] = [
        {
          id: 'usr-s1mple',
          faceit_id: 'faceit-s1mple',
          faceit_nickname: 's1mple',
          faceit_avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          faceit_elo: 3650,
          faceit_level: 10,
          faceit_game_id: 'cs2',
          phone: '+92 301 9876543',
          role: 'player',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'usr-casual',
          faceit_id: 'faceit-casual',
          faceit_nickname: 'CasualFragger',
          faceit_avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
          faceit_elo: 1120,
          faceit_level: 4,
          faceit_game_id: 'cs2',
          role: 'player',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'usr-noob',
          faceit_id: 'faceit-noob',
          faceit_nickname: 'NoobMaster69',
          faceit_avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          faceit_elo: 750,
          faceit_level: 2,
          faceit_game_id: 'cs2',
          role: 'player',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'usr-admin',
          faceit_id: 'faceit-admin',
          faceit_nickname: 'OG_Admin',
          faceit_avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          faceit_elo: 2200,
          faceit_level: 8,
          faceit_game_id: 'cs2',
          phone: '+92 300 1234567',
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      setProfiles(defaultProfiles);
      // Keep initial currentProfile null so visitors see "Log In" in the header!
    } catch (err) {
      console.error('Error loading Arena data:', err);
    } finally {
      setIsArenaLoading(false);
    }
  };

  useEffect(() => {
    loadArenaData();
    const interval = setInterval(loadArenaData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Track scroll progress for neon progress bar
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(progress);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver for staggered scroll reveals
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const elements = document.querySelectorAll('.reveal-init');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Google Login Handler
  const handleGoogleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    const rawNick = googleEmail.trim() ? googleEmail.split('@')[0] : 'Salman_Gamer';
    const cleanNick = rawNick.replace(/[^a-zA-Z0-9_]/g, '');
    const newProf: Profile = {
      id: `usr-google-${Date.now()}`,
      faceit_id: `google-${Date.now()}`,
      faceit_nickname: `${cleanNick || 'OG_Gamer'} [Google]`,
      faceit_avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      faceit_elo: 1680,
      faceit_level: 6,
      faceit_game_id: 'cs2',
      role: 'player',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCurrentProfile(newProf);
    setIsLoginModalOpen(false);
    setIsLoggingIn(false);
  };

  // Steam Login Handler
  const handleSteamLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    const nick = steamUsername.trim() || 'Steam_Striker';
    const newProf: Profile = {
      id: `usr-steam-${Date.now()}`,
      faceit_id: `steam-${Date.now()}`,
      faceit_nickname: `${nick} [Steam]`,
      faceit_avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
      faceit_elo: 1950,
      faceit_level: 8,
      faceit_game_id: 'cs2',
      role: 'player',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCurrentProfile(newProf);
    setIsLoginModalOpen(false);
    setIsLoggingIn(false);
  };

  // FACEIT Login Handler
  const handleFaceitLogin = async (e?: React.FormEvent, directNick?: string) => {
    if (e) e.preventDefault();
    const nickToUse = directNick || faceitNickname.trim() || customNickname.trim();
    if (!nickToUse) {
      setLoginError('Please enter a FACEIT nickname');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch(`/api/faceit/lookup?nickname=${encodeURIComponent(nickToUse)}`);
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Failed to verify FACEIT profile');
        setIsLoggingIn(false);
        return;
      }

      const p = data.player;
      const newProf: Profile = {
        id: `usr-faceit-${Date.now()}`,
        faceit_id: p.id,
        faceit_nickname: p.nickname,
        faceit_avatar_url: p.avatar,
        faceit_elo: p.elo,
        faceit_level: p.level,
        faceit_game_id: 'cs2',
        role: 'player',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setCurrentProfile(newProf);
      setIsLoginModalOpen(false);
      setDialogOpen(false);
      setFaceitNickname('');
      setCustomNickname('');
    } catch (err) {
      setLoginError('Network error checking FACEIT profile');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    await handleFaceitLogin(e);
  };

  const getLevelClass = (level: number) => {
    return `badge-lvl-${level}`;
  };

  const pendingApprovalsCount =
    bookings.filter((b) => b.status === 'pending').length +
    registrations.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--orange)] selection:text-black relative">
      {/* TOP NEON SCROLL PROGRESS BAR */}
      <div
        className="fixed top-0 left-0 h-[3.5px] z-[100] bg-gradient-to-r from-[#ff6a12] via-[#ffb27a] to-[#ff6a12] transition-all duration-75 ease-out shadow-[0_0_12px_#ff6a12]"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* DYNAMIC MOVING BACKGROUND */}
      <CyberBackground />

      {/* HEADER / NAVIGATION */}
      <header className="site-header">
        <nav className="wrap">
          {/* LARGER OG GAMING LOGO */}
          <Link href="/" className="brand group flex items-center gap-3 py-1">
            <div className="relative flex items-center">
              <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-[#ff6a12]/25 via-[#ffb27a]/20 to-transparent blur-lg opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
              <Image
                src="/site_assets/logo_0.png"
                alt="OG Gaming logo"
                width={260}
                height={135}
                priority
                className="brand-logo-img relative z-10"
              />
            </div>
          </Link>

          {/* Desktop Navlinks - Just Home and Arena Engine */}
          <div className="navlinks">
            <a
              href="#"
              className="font-heading tracking-wide uppercase text-sm font-semibold hover:text-[var(--orange)] transition-colors"
            >
              Home
            </a>
            <a
              href="#arena"
              className="font-heading tracking-wide uppercase text-sm font-semibold text-[#ff6a12] hover:text-[#ffb27a] flex items-center gap-1.5 transition-colors"
            >
              <Trophy className="w-4 h-4 text-[#ff6a12]" />
              <span>Arena Engine</span>
            </a>
          </div>

          <div className="flex items-center gap-3">
            {currentProfile ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#151109] border border-[var(--line)] hover:border-[var(--orange)] transition-all cursor-pointer outline-none shadow-md">
                  <span
                    className={`w-6 h-6 rounded flex items-center justify-center font-black text-xs shadow-sm ${getLevelClass(
                      currentProfile.faceit_level
                    )}`}
                  >
                    {currentProfile.faceit_level}
                  </span>
                  <div className="flex flex-col text-left leading-tight hidden sm:flex">
                    <span className="text-xs font-heading font-bold text-[var(--ink)]">
                      {currentProfile.faceit_nickname}
                    </span>
                    <span className="text-[10px] text-[var(--ink-dim)]">
                      {currentProfile.faceit_elo} ELO
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-dim)]" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-[#151109] border-[var(--line)] text-[var(--ink)] shadow-2xl p-2">
                  <div className="p-3 rounded-lg bg-[#0b0a08] border border-[var(--line)] mb-2">
                    <div className="text-[10px] uppercase font-heading font-bold text-[var(--ink-dim)] tracking-wider">
                      Logged in Player
                    </div>
                    <div className="text-sm font-heading font-bold text-[var(--orange)] flex items-center gap-1.5 mt-0.5">
                      <span className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${getLevelClass(currentProfile.faceit_level)}`}>
                        {currentProfile.faceit_level}
                      </span>
                      <span>{currentProfile.faceit_nickname}</span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-dim)] font-heading mt-1">
                      {currentProfile.faceit_elo} CS2 ELO • {currentProfile.role.toUpperCase()}
                    </div>
                  </div>
                  <DropdownMenuItem
                    onClick={() => {
                      setLoginError('');
                      setIsLoginModalOpen(true);
                    }}
                    className="cursor-pointer font-heading text-xs py-2 hover:bg-[#1d170f] rounded flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[var(--orange)]" />
                    <span>Switch Login (Google / Steam / FACEIT)</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[var(--line)] my-1" />
                  <DropdownMenuItem
                    onClick={() => setCurrentProfile(null)}
                    className="cursor-pointer font-heading text-xs text-rose-400 py-2 hover:bg-[#1d170f] rounded flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => {
                  setLoginError('');
                  setIsLoginModalOpen(true);
                }}
                className="navcta cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Log In</span>
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[var(--ink-dim)] hover:text-[var(--orange)] border border-[var(--line)] rounded-[var(--radius)] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--line)] bg-[#0b0a08]/98 backdrop-blur-xl px-6 py-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <a
              href="#"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-heading font-bold text-[var(--ink-dim)] hover:text-[var(--orange)] py-1"
            >
              Home
            </a>
            <a
              href="#arena"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-heading font-bold text-[var(--orange)] py-1 flex items-center justify-between"
            >
              <span>Arena Engine</span>
              <Trophy className="w-4 h-4" />
            </a>
            <div className="pt-2 border-t border-[var(--line)]">
              {currentProfile ? (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${getLevelClass(currentProfile.faceit_level)}`}>
                      {currentProfile.faceit_level}
                    </span>
                    <span className="text-sm font-heading font-bold text-[var(--ink)]">{currentProfile.faceit_nickname}</span>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentProfile(null);
                      setMobileMenuOpen(false);
                    }}
                    className="text-xs font-heading font-bold text-rose-400 hover:underline"
                  >
                    Log Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setLoginError('');
                    setIsLoginModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black text-sm font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-[var(--orange)]/25"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="hero">
          <div className="glow"></div>
          <div className="wrap">
            <div className="reveal-init">
              <span className="status-pill">
                <span className="dot"></span>
                <span className="font-medium">Open 24 hours &middot; Main Bahadurabad, Karachi</span>
              </span>
            </div>

            <h1 className="reveal-init reveal-delay-1">
              Bahadurabad&rsquo;s <em className="shimmer-text">high-end</em> gaming zone
            </h1>

            <p className="lead reveal-init reveal-delay-2">
              Esports-grade PC cabins on 240Hz MSI monitors and a PS5 Slim lounge with bean bags and chilled AC. Walk in, or lock a bay ahead on WhatsApp.
            </p>

            <div className="actions reveal-init reveal-delay-3">
              <a className="btn-primary" href="#arena">
                <Trophy className="w-4 h-4 text-black" />
                <span>Explore Arena Engine</span>
              </a>

              <a
                className="btn-ghost"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Book on WhatsApp</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a className="btn-ghost" href="#pricing">
                <span>See pricing</span>
              </a>
            </div>

            {/* Statline */}
            <div className="statline reveal-init reveal-delay-4">
              <div className="group">
                <div className="num group-hover:scale-105 transition-transform duration-200">15+</div>
                <div className="lbl">eSports PCs across 3 live cabins</div>
              </div>
              <div className="group">
                <div className="num group-hover:scale-105 transition-transform duration-200">240Hz</div>
                <div className="lbl">MSI gaming monitors</div>
              </div>
              <div className="group">
                <div className="num group-hover:scale-105 transition-transform duration-200">4</div>
                <div className="lbl">PS5 Slim Digital Edition units</div>
              </div>
              <div className="group">
                <div className="num group-hover:scale-105 transition-transform duration-200">24/7</div>
                <div className="lbl">Open every day</div>
              </div>
            </div>
          </div>
        </section>

        {/* INTEGRATED ARENA ENGINE SECTION (Positioned right after Intro) */}
        <section id="arena" className="py-10 border-b border-[var(--line)] bg-[#110d08]/85 relative">
          <div className="wrap">
            {/* Arena Header */}
            <div className="sec-head reveal-init" style={{ paddingTop: 0, paddingBottom: 16 }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="eyebrow flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[var(--orange)]" />
                    <span>Arena Engine</span>
                  </div>
                  <h2>Live LAN &amp; Booking Center</h2>
                  <p>
                    Check real-time CS2 cabin schedules, reserve slots, join clan matchmaking, and inspect FACEIT profiles directly on the floor.
                  </p>
                </div>

                {/* Quick LAN Stats */}
                <div className="flex items-center gap-2.5">
                  <div className="px-3 py-1.5 rounded-lg bg-[#151109] border border-[var(--line)] flex items-center gap-2 text-xs">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span>1ms LAN Ping</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-[#151109] border border-[var(--line)] flex items-center gap-2 text-xs">
                    <Cpu className="w-3.5 h-3.5 text-[var(--orange)]" />
                    <span>4 VIP Cabins</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Arena Interactive Controls Bar: Tab navigation + Profile Switcher */}
            <div className="p-3 sm:p-4 rounded-xl bg-[#16120b] border border-[var(--line)] mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3 reveal-init shadow-xl">
              {/* Tab navigation buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setArenaTab('calendar')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    arenaTab === 'calendar'
                      ? 'bg-[var(--orange)] text-black shadow-lg shadow-[var(--orange)]/25'
                      : 'text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[#1f170f]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Cabin Booking</span>
                </button>

                <button
                  onClick={() => setArenaTab('matches')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    arenaTab === 'matches'
                      ? 'bg-[var(--orange)] text-black shadow-lg shadow-[var(--orange)]/25'
                      : 'text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[#1f170f]'
                  }`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>5v5 Match Board</span>
                </button>

                <button
                  onClick={() => setArenaTab('tournaments')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    arenaTab === 'tournaments'
                      ? 'bg-[var(--orange)] text-black shadow-lg shadow-[var(--orange)]/25'
                      : 'text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[#1f170f]'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>LAN Cups</span>
                </button>

                <button
                  onClick={() => setArenaTab('admin')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-2 relative cursor-pointer ${
                    arenaTab === 'admin'
                      ? 'bg-[var(--orange)] text-black shadow-lg shadow-[var(--orange)]/25'
                      : 'text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[#1f170f]'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Panel</span>
                  {pendingApprovalsCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Profile & FACEIT Switcher */}
              {currentProfile && (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b0a08] hover:bg-[#151109] border border-[var(--line)] transition-colors text-left cursor-pointer outline-none">
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center font-black text-[11px] shadow-sm ${getLevelClass(
                          currentProfile.faceit_level
                        )}`}
                      >
                        {currentProfile.faceit_level}
                      </span>

                      <div className="flex flex-col leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground font-heading">{currentProfile.faceit_nickname}</span>
                          {currentProfile.role === 'admin' && (
                            <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.2 rounded font-bold uppercase">
                              Admin
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--ink-dim)]">{currentProfile.faceit_elo} Elo • CS2</span>
                      </div>

                      <ChevronDown className="w-3 h-3 text-[var(--ink-dim)] ml-1" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-64 bg-[#151109] border-[var(--line)] shadow-2xl text-[var(--ink)]">
                      <DropdownMenuLabel className="text-xs text-[var(--ink-dim)] uppercase font-bold tracking-wider font-heading">
                        Switch Player Account (Demo Mode)
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-[var(--line)]" />

                      {profiles.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => setCurrentProfile(p)}
                          className="flex items-center justify-between cursor-pointer py-2 focus:bg-[#1d170f]"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-5 h-5 rounded text-[11px] font-black flex items-center justify-center ${getLevelClass(
                                p.faceit_level
                              )}`}
                            >
                              {p.faceit_level}
                            </span>
                            <div>
                              <div className="text-sm font-semibold flex items-center gap-1.5">
                                {p.faceit_nickname}
                                {p.role === 'admin' && (
                                  <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded">Admin</span>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--ink-dim)]">{p.faceit_elo} Elo</div>
                            </div>
                          </div>
                          {currentProfile.id === p.id && <Check className="w-4 h-4 text-[var(--orange)]" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Switch Login Button */}
                  <button
                    onClick={() => {
                      setLoginError('');
                      setIsLoginModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--line)] hover:border-[var(--orange)] text-xs text-[var(--ink-dim)] hover:text-[var(--orange)] transition-colors flex items-center gap-1 font-heading cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Switch</span>
                  </button>
                </div>
              )}
            </div>

            {/* Arena Engine Live Content Area */}
            {isArenaLoading ? (
              <div className="p-12 rounded-xl bg-[#151109] border border-[var(--line)] flex flex-col items-center justify-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--orange)] to-orange-400 flex items-center justify-center font-black text-black text-lg animate-pulse font-heading">
                  OG
                </div>
                <span className="text-xs font-semibold tracking-wider text-[var(--ink-dim)] font-heading">
                  LOADING ARENA LAN SESSIONS...
                </span>
              </div>
            ) : !currentProfile ? (
              <div className="p-8 sm:p-12 rounded-xl bg-[#151109] border border-[var(--line)] text-center flex flex-col items-center justify-center max-w-xl mx-auto space-y-3.5 shadow-2xl">
                <div className="w-12 h-12 rounded-xl bg-[var(--orange)]/15 border border-[var(--orange)]/30 flex items-center justify-center text-[var(--orange)] shadow-lg shadow-[var(--orange)]/20">
                  <LogIn className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-xl text-[var(--ink)]">Log In to Access Arena Engine</h3>
                  <p className="text-xs text-[var(--ink-dim)] mt-1 max-w-md mx-auto leading-relaxed">
                    Sign in with Google, Steam, or FACEIT to reserve 240Hz PC bays, join 5v5 gathers, and enter Karachi LAN championships.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    onClick={() => {
                      setActiveLoginProvider('google');
                      setLoginError('');
                      setIsLoginModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#0b0a08] border border-[var(--line)] hover:border-[var(--orange)] text-xs font-heading font-bold text-[var(--ink)] flex items-center gap-2 transition-all hover:bg-[#1a140b] cursor-pointer"
                  >
                    <GoogleIcon className="w-3.5 h-3.5" />
                    <span>Google</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveLoginProvider('steam');
                      setLoginError('');
                      setIsLoginModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#0b0a08] border border-[var(--line)] hover:border-[var(--orange)] text-xs font-heading font-bold text-[var(--ink)] flex items-center gap-2 transition-all hover:bg-[#1a140b] cursor-pointer"
                  >
                    <SteamIcon className="w-3.5 h-3.5" />
                    <span>Steam</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveLoginProvider('faceit');
                      setLoginError('');
                      setIsLoginModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#0b0a08] border border-[var(--line)] hover:border-[var(--orange)] text-xs font-heading font-bold text-[var(--ink)] flex items-center gap-2 transition-all hover:bg-[#1a140b] cursor-pointer"
                  >
                    <FaceitIcon className="w-3.5 h-3.5" />
                    <span>FACEIT</span>
                  </button>
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      if (profiles.length > 0) setCurrentProfile(profiles[0]);
                    }}
                    className="text-[11px] font-heading font-bold text-[var(--orange)] hover:underline cursor-pointer"
                  >
                    or Continue as Guest (s1mple demo profile) &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#141009]/90 border border-[var(--line)] p-4 sm:p-5 shadow-2xl">
                {arenaTab === 'calendar' && (
                  <BookingCalendar
                    cabins={cabins}
                    bookings={bookings}
                    currentProfile={currentProfile}
                    onBookingCreated={(newB) => setBookings((prev) => [newB, ...prev])}
                  />
                )}

                {arenaTab === 'matches' && (
                  <MatchBoard
                    matches={matches}
                    cabins={cabins}
                    currentProfile={currentProfile}
                    onMatchUpdated={loadArenaData}
                  />
                )}

                {arenaTab === 'tournaments' && (
                  <TournamentsView
                    tournaments={tournaments}
                    registrations={registrations}
                    currentProfile={currentProfile}
                    onRegistrationCreated={loadArenaData}
                  />
                )}

                {arenaTab === 'admin' && (
                  <AdminPanel
                    bookings={bookings}
                    registrations={registrations}
                    tournaments={tournaments}
                    cabins={cabins}
                    profiles={profiles}
                    onDataRefresh={loadArenaData}
                  />
                )}
              </div>
            )}
          </div>
        </section>

        {/* BAY DIRECTORY ("The floor") */}
        <section id="bays" className="bays">
          <div className="wrap">
            <div className="sec-head reveal-init" style={{ paddingBottom: 0 }}>
              <div className="eyebrow flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                <span>The floor</span>
              </div>
              <h2>Five bays, one hall</h2>
              <p>
                Our Bahadurabad hall is split into four PC cabins and a dedicated PS5 lounge, so you can walk straight to the setup you booked.
              </p>
            </div>

            <div className="bay-grid" style={{ marginTop: '20px' }}>
              {BAYS_DATA.map((bay, idx) => (
                <div
                  key={bay.tag}
                  onClick={() => setSelectedBay(bay)}
                  className={`bay cursor-pointer group reveal-init reveal-delay-${idx + 1} ${
                    bay.type === 'ps5' ? 'ps5' : bay.status === 'live' ? 'live' : 'soon'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="tag">{bay.tag}</span>
                    <span className="text-[10px] text-[var(--ink-dim)] opacity-0 group-hover:opacity-100 transition-opacity font-heading uppercase tracking-widest text-[#ff6a12]">
                      View Rig &rarr;
                    </span>
                  </div>

                  <div className="name flex items-center justify-between">
                    <span>{bay.name.replace('Esports ', '').replace('VIP ', '')}</span>
                    {bay.type === 'pc' ? (
                      <Monitor className="w-4 h-4 text-emerald-400/80 group-hover:text-emerald-400 group-hover:scale-110 transition-all" />
                    ) : (
                      <Gamepad2 className="w-4 h-4 text-[var(--orange)] group-hover:scale-110 transition-all" />
                    )}
                  </div>

                  <div className="desc line-clamp-2 min-h-[36px]">{bay.desc}</div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="badge">
                      {bay.status === 'live' ? 'Live' : 'Coming soon'}
                    </span>

                    {bay.status === 'live' && (
                      <span className="text-xs text-[var(--orange)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-heading font-bold">
                        <span>Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SPECS SECTION ("What's inside") */}
        <section id="specs" className="specs">
          <div className="wrap">
            <div className="sec-head reveal-init" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <div className="eyebrow flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>What&apos;s inside</span>
              </div>
              <h2>Built for serious play</h2>
            </div>

            <div className="spec-cols" style={{ marginTop: '20px' }}>
              <div className="spec-col reveal-init reveal-delay-1 group">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-5 h-5 text-[var(--orange)] group-hover:scale-110 transition-transform" />
                  <h3>PC Cabins</h3>
                </div>
                <ul>
                  <li>
                    <span>Displays</span>
                    <span className="text-[var(--orange)] font-semibold">240Hz MSI gaming monitors</span>
                  </li>
                  <li>
                    <span>Seating</span>
                    <span>Japanese Aqua custom gaming chairs</span>
                  </li>
                  <li>
                    <span>Climate</span>
                    <span>Air-conditioned throughout</span>
                  </li>
                  <li>
                    <span>Style</span>
                    <span>eSports-styled, high-end builds</span>
                  </li>
                  <li>
                    <span>Capacity</span>
                    <span className="font-bold text-[var(--ink)]">5 PCs per cabin</span>
                  </li>
                </ul>
              </div>

              <div className="spec-col reveal-init reveal-delay-2 group">
                <div className="flex items-center gap-2 mb-2">
                  <Gamepad2 className="w-5 h-5 text-[var(--orange)] group-hover:scale-110 transition-transform" />
                  <h3>PS5 Lounge</h3>
                </div>
                <ul>
                  <li>
                    <span>Consoles</span>
                    <span className="text-[var(--orange)] font-semibold">4 &times; PS5 Slim Digital Edition</span>
                  </li>
                  <li>
                    <span>Seating</span>
                    <span>Bean bags</span>
                  </li>
                  <li>
                    <span>Climate</span>
                    <span>Chilled AC</span>
                  </li>
                  <li>
                    <span>Controllers</span>
                    <span>2 included, extra on request</span>
                  </li>
                  <li>
                    <span>Staff</span>
                    <span>Friendly, always on hand</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" className="pricing">
          <div className="wrap">
            <div className="sec-head reveal-init" style={{ paddingTop: 0 }}>
              <div className="eyebrow flex items-center gap-2">
                <Flame className="w-3.5 h-3.5" />
                <span>Pricing</span>
              </div>
              <h2>Simple, per-bay pricing</h2>
              <p>Pay by the hour, or lock in a package and save. All prices in PKR.</p>
            </div>

            <div className="price-cols" style={{ marginTop: '20px' }}>
              <div className="price-col reveal-init reveal-delay-1 neon-border-pulse flex flex-col justify-between">
                <div>
                  <h3>PC Gaming</h3>
                  <div className="rate">
                    200<sup>/ PC per hour</sup>
                  </div>
                  <div className="pkg-grid">
                    <div className="pkg group">
                      <div className="h">3 hours</div>
                      <div className="v group-hover:text-[var(--orange)] transition-colors">500 PKR</div>
                    </div>
                    <div className="pkg group">
                      <div className="h">5 hours</div>
                      <div className="v group-hover:text-[var(--orange)] transition-colors">800 PKR</div>
                    </div>
                    <div className="pkg group">
                      <div className="h">10 hours</div>
                      <div className="v group-hover:text-[var(--orange)] transition-colors">1,500 PKR</div>
                    </div>
                    <div className="pkg group">
                      <div className="h">20 hours</div>
                      <div className="v group-hover:text-[var(--orange)] transition-colors">2,500 PKR</div>
                    </div>
                  </div>
                  <div className="price-note">Packages are per user. 240Hz MSI monitors &amp; RTX builds.</div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--line)]">
                  <a
                    className="btn-ghost w-full justify-center py-2.5 text-xs font-heading font-bold"
                    href="#arena"
                  >
                    <span>Reserve PC Bay in Arena</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="price-col reveal-init reveal-delay-2 neon-border-pulse flex flex-col justify-between">
                <div>
                  <h3>PS5 Lounge</h3>
                  <div className="rate">
                    500<sup>/ hour</sup>
                  </div>
                  <div className="pkg-grid">
                    <div className="pkg group">
                      <div className="h">1 hour</div>
                      <div className="v group-hover:text-[var(--orange)] transition-colors">500 PKR</div>
                    </div>
                    <div className="pkg group">
                      <div className="h">2 hours (Duo)</div>
                      <div className="v group-hover:text-[var(--orange)] transition-colors">950 PKR</div>
                    </div>
                    <div className="pkg group">
                      <div className="h">3 hours (Squad)</div>
                      <div className="v group-hover:text-[var(--orange)] transition-colors">1,400 PKR</div>
                    </div>
                    <div className="pkg group">
                      <div className="h">Extra Controller</div>
                      <div className="v group-hover:text-[var(--orange)] transition-colors">+300 PKR</div>
                    </div>
                  </div>
                  <div className="price-note">PS5 with 2 controllers included. Bean bags &amp; chilled AC.</div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--line)]">
                  <a
                    className="btn-primary w-full justify-center shadow-md shadow-[var(--orange)]/20 py-2.5 text-xs font-heading font-bold"
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Reserve via WhatsApp</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="trust">
          <div className="wrap trust-grid">
            <div className="trust-item reveal-init reveal-delay-1">
              <div className="t">100% satisfaction</div>
              <div className="d">From every player who&apos;s booked a bay with us</div>
            </div>
            <div className="trust-item reveal-init reveal-delay-2">
              <div className="t">Chilled AC</div>
              <div className="d">Across every cabin and the PS5 lounge</div>
            </div>
            <div className="trust-item reveal-init reveal-delay-3">
              <div className="t">Aqua gaming chairs</div>
              <div className="d">Japanese-made, built for long sessions</div>
            </div>
            <div className="trust-item reveal-init reveal-delay-4">
              <div className="t">Friendly staff</div>
              <div className="d">On hand for setup, snacks and support</div>
            </div>
          </div>
        </section>

        {/* LOCATION SECTION */}
        <section id="location" className="location">
          <div className="wrap">
            <div className="sec-head reveal-init" style={{ padding: '0 0 18px' }}>
              <div className="eyebrow flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                <span>Find us</span>
              </div>
              <h2>Main Bahadurabad, Karachi</h2>
            </div>

            <div className="loc-grid">
              <div className="loc-col reveal-init reveal-delay-1">
                <h3>Address &amp; contact</h3>
                <p className="addr">
                  Suite # 201, 2nd Floor, Meriums Complex,
                  <br />
                  Near Charr Minar, Beside Alkaram Studio,
                  <br />
                  Main Bahadurabad, Karachi
                </p>

                <p>
                  Bookings:{' '}
                  <a
                    href="https://wa.me/923062779481"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--orange)' }}
                    className="hover:underline font-bold"
                  >
                    +92 306 2779481
                  </a>{' '}
                  (WhatsApp)
                </p>

                <p>
                  Email:{' '}
                  <a
                    href="mailto:Oggamingkhi@gmail.com"
                    style={{ color: 'var(--orange)' }}
                    className="hover:underline font-medium"
                  >
                    Oggamingkhi@gmail.com
                  </a>
                </p>

                <div className="landmarks">
                  <span>Near Charr Minar</span>
                  <span>Beside Alkaram Studio</span>
                  <span>2nd Floor, Meriums Complex</span>
                </div>
              </div>

              <div className="loc-map reveal-init reveal-delay-2">
                <iframe
                  title="OG Gaming location map"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.google.com/maps?q=Meriums+Complex+Bahadurabad+Karachi&output=embed"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CTA BAND */}
        <section className="cta-band">
          <div className="wrap">
            <h2 className="reveal-init">Bays fill up fast on weekends. Lock yours in.</h2>
            <a
              className="btn-primary reveal-init reveal-delay-1"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Message us on WhatsApp</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <Image
                src="/site_assets/img_1.png"
                alt="OG Gaming logo"
                width={160}
                height={75}
                className="h-[65px] sm:h-[75px] w-auto object-contain"
              />
            </div>
            <div className="foot-links">
              <a href="#bays">Cabins &amp; Lounge</a>
              <a href="#specs">Specs</a>
              <a href="#pricing">Pricing</a>
              <a href="#arena">Arena Engine</a>
              <a href="#location">Location</a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a href="mailto:Oggamingkhi@gmail.com">Email</a>
            </div>
          </div>

          <div className="foot-bottom">
            OG Gaming &middot; Suite 201, 2nd Floor, Meriums Complex, Main Bahadurabad, Karachi &middot; +92 306 2779481 &middot;{' '}
            <a href="mailto:Oggamingkhi@gmail.com" className="hover:text-[var(--orange)]">
              Oggamingkhi@gmail.com
            </a>
          </div>
        </div>
      </footer>

      {/* INTERACTIVE BAY HARDWARE & GAME MODAL */}
      {selectedBay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-xl bg-[#151109] border border-[#ff6a12]/40 p-6 sm:p-8 shadow-[0_0_50px_rgba(255,106,18,0.25)]">
            <button
              onClick={() => setSelectedBay(null)}
              className="absolute top-4 right-4 p-2 text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-black font-heading px-2 py-0.5 rounded bg-[var(--orange)]/20 text-[var(--orange)] border border-[var(--orange)]/40 uppercase tracking-widest">
                {selectedBay.tag}
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {selectedBay.status === 'live' ? '● Online & Operational' : '○ Under Construction'}
              </span>
            </div>

            <h3 className="text-2xl font-black font-heading text-[var(--ink)] tracking-tight">
              {selectedBay.name}
            </h3>
            <p className="text-sm text-[var(--ink-dim)] mt-1.5">{selectedBay.desc}</p>

            {/* Hardware Specs */}
            <div className="mt-5">
              <div className="text-xs font-bold font-heading text-[var(--orange)] uppercase tracking-wider mb-2">
                Hardware Specifications
              </div>
              <ul className="space-y-1.5 text-xs text-[var(--ink-dim)]">
                {selectedBay.specs.map((spec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Preloaded Games */}
            <div className="mt-5">
              <div className="text-xs font-bold font-heading text-[var(--orange)] uppercase tracking-wider mb-2">
                Popular Titles Preloaded
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedBay.games.map((g, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#0b0a08] border border-[var(--line)] text-[var(--ink)] font-heading"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 pt-5 border-t border-[var(--line)] flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/923062779481?text=Hi%20OG%20Gaming%2C%20I%20would%20like%20to%20book%20${encodeURIComponent(
                  selectedBay.tag
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary justify-center text-sm py-3 flex-1"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Book on WhatsApp</span>
              </a>

              <a
                href="#arena"
                onClick={() => setSelectedBay(null)}
                className="btn-ghost justify-center text-sm py-3"
              >
                <span>View Arena Calendar</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* AUTHENTICATION MODAL: GOOGLE, STEAM, FACEIT */}
      <Dialog open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen}>
        <DialogContent className="bg-[#151109] border-[var(--line)] text-[var(--ink)] sm:max-w-lg shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 font-heading text-2xl text-[var(--ink)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--orange)]/15 border border-[var(--orange)]/30 flex items-center justify-center text-[var(--orange)] shadow-md shadow-[var(--orange)]/20">
                <LogIn className="w-4 h-4" />
              </div>
              <span>OG Arena Login</span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-[var(--ink-dim)] -mt-2">
            Select your platform to log in. Unlock PC bay reservations, 5v5 scrim matchmaking, and Karachi LAN cups.
          </p>

          {/* Provider Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1 rounded-lg bg-[#0b0a08] border border-[var(--line)] mt-1">
            <button
              type="button"
              onClick={() => {
                setActiveLoginProvider('google');
                setLoginError('');
              }}
              className={`py-2 px-3 rounded-md text-xs font-heading font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeLoginProvider === 'google'
                  ? 'bg-[var(--orange)] text-black shadow-md shadow-[var(--orange)]/25'
                  : 'text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[#151109]'
              }`}
            >
              <GoogleIcon className="w-4 h-4" />
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveLoginProvider('steam');
                setLoginError('');
              }}
              className={`py-2 px-3 rounded-md text-xs font-heading font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeLoginProvider === 'steam'
                  ? 'bg-[var(--orange)] text-black shadow-md shadow-[var(--orange)]/25'
                  : 'text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[#151109]'
              }`}
            >
              <SteamIcon className="w-4 h-4" />
              <span>Steam</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveLoginProvider('faceit');
                setLoginError('');
              }}
              className={`py-2 px-3 rounded-md text-xs font-heading font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeLoginProvider === 'faceit'
                  ? 'bg-[var(--orange)] text-black shadow-md shadow-[var(--orange)]/25'
                  : 'text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[#151109]'
              }`}
            >
              <FaceitIcon className="w-4 h-4" />
              <span>FACEIT</span>
            </button>
          </div>

          {/* Provider 1: Google */}
          {activeLoginProvider === 'google' && (
            <form onSubmit={handleGoogleLogin} className="space-y-4 pt-1">
              <div className="p-3.5 rounded-lg bg-[#0b0a08] border border-[var(--line)] space-y-1.5">
                <div className="flex items-center gap-2">
                  <GoogleIcon className="w-4 h-4" />
                  <span className="font-heading font-bold text-sm text-[var(--ink)]">Google Sign In</span>
                </div>
                <p className="text-[11px] text-[var(--ink-dim)] leading-relaxed">
                  Fast 1-click authentication. Synchronizes your bay reservations, notifications, and WhatsApp contact details.
                </p>
              </div>

              <div>
                <label className="text-xs font-heading text-[var(--ink-dim)] uppercase block mb-1">
                  Google Email or Gamer Tag (Optional)
                </label>
                <Input
                  placeholder="e.g. salman.gaming@gmail.com"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="bg-[#0b0a08] border-[var(--line)] font-heading text-[var(--ink)] text-sm"
                />
              </div>

              {loginError && <p className="text-xs text-rose-400 font-heading">{loginError}</p>}

              <div className="pt-2 flex gap-3">
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex-1 bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[var(--orange)]/20"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Connecting...' : 'Continue with Google'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="border-[var(--line)] text-[var(--ink)] hover:bg-[#1a140b] font-heading cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Provider 2: Steam */}
          {activeLoginProvider === 'steam' && (
            <form onSubmit={handleSteamLogin} className="space-y-4 pt-1">
              <div className="p-3.5 rounded-lg bg-[#0b0a08] border border-[var(--line)] space-y-1.5">
                <div className="flex items-center gap-2">
                  <SteamIcon className="w-4 h-4 text-white" />
                  <span className="font-heading font-bold text-sm text-[var(--ink)]">Steam Community &amp; CS2 OpenID</span>
                </div>
                <p className="text-[11px] text-[var(--ink-dim)] leading-relaxed">
                  Link your Counter-Strike 2 Steam profile to display verified VAC standing, custom Steam avatar, and inventory badges.
                </p>
              </div>

              <div>
                <label className="text-xs font-heading text-[var(--ink-dim)] uppercase block mb-1">
                  Steam Persona / Nickname / SteamID64
                </label>
                <Input
                  placeholder="e.g. SteamGamer_99 or Karachi_Sniper"
                  value={steamUsername}
                  onChange={(e) => setSteamUsername(e.target.value)}
                  className="bg-[#0b0a08] border-[var(--line)] font-heading text-[var(--ink)] text-sm"
                />
              </div>

              {loginError && <p className="text-xs text-rose-400 font-heading">{loginError}</p>}

              <div className="pt-2 flex gap-3">
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex-1 bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[var(--orange)]/20"
                >
                  <SteamIcon className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Connecting...' : 'Sign in through Steam'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="border-[var(--line)] text-[var(--ink)] hover:bg-[#1a140b] font-heading cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Provider 3: FACEIT */}
          {activeLoginProvider === 'faceit' && (
            <form onSubmit={(e) => handleFaceitLogin(e)} className="space-y-4 pt-1">
              <div className="p-3.5 rounded-lg bg-[#0b0a08] border border-[var(--line)] space-y-1.5">
                <div className="flex items-center gap-2">
                  <FaceitIcon className="w-4 h-4" />
                  <span className="font-heading font-bold text-sm text-[var(--ink)]">FACEIT Competitive CS2 Data API</span>
                </div>
                <p className="text-[11px] text-[var(--ink-dim)] leading-relaxed">
                  Pulls official FACEIT CS2 Level (1–10) badge and live Elo rating for LAN seeding and 5v5 gather restrictions.
                </p>
              </div>

              <div>
                <label className="text-xs font-heading text-[var(--ink-dim)] uppercase block mb-1">
                  FACEIT Nickname
                </label>
                <Input
                  placeholder="e.g. s1mple, m0NESY, or your exact tag"
                  value={faceitNickname}
                  onChange={(e) => setFaceitNickname(e.target.value)}
                  className="bg-[#0b0a08] border-[var(--line)] font-heading text-[var(--ink)] text-sm"
                />
              </div>

              {/* Quick Picks */}
              <div>
                <div className="text-[10px] font-heading uppercase text-[var(--ink-dim)] tracking-wider mb-1.5">
                  Or Test with Community Legends:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['s1mple', 'm0NESY', 'NiKo', 'donk'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleFaceitLogin(undefined, tag)}
                      className="px-2.5 py-1 rounded bg-[#0b0a08] hover:bg-[#1d170f] border border-[var(--line)] hover:border-[var(--orange)] text-xs font-heading font-bold text-[var(--ink)] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span className="badge-lvl-10 w-3.5 h-3.5 rounded text-[9px] font-black flex items-center justify-center">10</span>
                      <span>{tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {loginError && <p className="text-xs text-rose-400 font-heading">{loginError}</p>}

              <div className="pt-2 flex gap-3">
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex-1 bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[var(--orange)]/20"
                >
                  <FaceitIcon className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Verifying with FACEIT API...' : 'Connect FACEIT Profile'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="border-[var(--line)] text-[var(--ink)] hover:bg-[#1a140b] font-heading cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
