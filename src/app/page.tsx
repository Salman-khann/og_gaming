'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ArenaWorkspace } from '@/components/ArenaWorkspace';
import { CyberBackground } from '@/components/CyberBackground';
import { Menu } from 'lucide-react';
import { BayDetailsDialog } from '@/components/BayDetailsDialog';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, MapPin, Monitor, Gamepad2, Trophy, ChevronRight, Zap, ShieldCheck, Flame, ChevronDown, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
    specs: ['240Hz MSI Rapid IPS Monitors', 'NVIDIA GeForce GTX 1080 Ti', 'Japanese Aqua Ergonomic Chairs', 'Chilled Sub-Zero Air Conditioning', 'Mechanical Keyboards & High-DPI Mice'],
    games: ['Counter-Strike 2', 'Valorant', 'Apex Legends', 'GTA V / FiveM', 'Call of Duty: Warzone'],
    status: 'live',
  },
  {
    tag: 'CABIN 02',
    name: 'Esports PC Cabin 02',
    type: 'pc',
    desc: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors.',
    specs: ['240Hz MSI Rapid IPS Monitors', 'NVIDIA GeForce GTX 1080 Ti', 'Japanese Aqua Ergonomic Chairs', 'Chilled Sub-Zero Air Conditioning', 'Mechanical Keyboards & High-DPI Mice'],
    games: ['Counter-Strike 2', 'Valorant', 'Apex Legends', 'GTA V / FiveM', 'Dota 2'],
    status: 'live',
  },
  {
    tag: 'CABIN 03',
    name: 'Esports PC Cabin 03',
    type: 'pc',
    desc: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors.',
    specs: ['240Hz MSI Rapid IPS Monitors', 'NVIDIA GeForce GTX 1080 Ti', 'Japanese Aqua Ergonomic Chairs', 'Chilled Sub-Zero Air Conditioning', 'Mechanical Keyboards & High-DPI Mice'],
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

  const { profile: currentProfile, logout } = useAuth();
  const router = useRouter();
  const whatsappUrl = 'https://wa.me/923062779481?text=Hi%20OG%20Gaming%2C%20I%20have%20a%20question';

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

  const getLevelClass = (level: number) => level >= 10 ? 'bg-red-600 text-white' : level >= 7 ? 'bg-orange-500 text-black' : 'bg-yellow-400 text-black';

  return (
    <div className="legacy-home min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--orange)] selection:text-black relative">
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
            <Link href="/matches" className="font-heading uppercase text-sm font-semibold text-[var(--orange)]" onClick={() => setMobileMenuOpen(false)}>5v5 Matching</Link>
            <Link href="/tournaments" className="font-heading uppercase text-sm font-semibold text-[var(--orange)]" onClick={() => setMobileMenuOpen(false)}>Tournaments</Link><Link href="/leaderboard" className="font-heading uppercase text-sm font-semibold" onClick={() => setMobileMenuOpen(false)}>Leaderboard</Link>
          </div>

          <div className="flex items-center gap-3">
            {currentProfile?.role === 'admin' && <Link className="navcta" href="/admin">Manage tournaments</Link>}
            {currentProfile ? (
              <DropdownMenu>
                <Link href={'/players/'+currentProfile.id} className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#151109] border border-[var(--line)] hover:border-[var(--orange)] transition-all cursor-pointer outline-none shadow-md">
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
                </Link>
                <DropdownMenuTrigger aria-label="Account menu" className="p-2 text-[var(--ink-dim)]"><ChevronDown className="w-3.5 h-3.5" /></DropdownMenuTrigger>
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

                      router.push('/login');
                    }}
                    className="cursor-pointer font-heading text-xs py-2 hover:bg-[#1d170f] rounded flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[var(--orange)]" />
                    <span>Log in to another account</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[var(--line)] my-1" />
                  <DropdownMenuItem
                    onClick={() => void logout()}
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

                  router.push('/login');
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
            <Link href="/matches" className="font-heading uppercase text-sm font-semibold text-[var(--orange)]" onClick={() => setMobileMenuOpen(false)}>5v5 Matching</Link>
            <Link href="/tournaments" className="font-heading uppercase text-sm font-semibold text-[var(--orange)]" onClick={() => setMobileMenuOpen(false)}>Tournaments</Link><Link href="/leaderboard" className="font-heading uppercase text-sm font-semibold" onClick={() => setMobileMenuOpen(false)}>Leaderboard</Link>
            {currentProfile?.role === 'admin' && <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>Manage tournaments</Link>}
            <div className="pt-2 border-t border-[var(--line)]">
              {currentProfile ? (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${getLevelClass(currentProfile.faceit_level)}`}>
                      {currentProfile.faceit_level}
                    </span>
                    <Link href={'/players/'+currentProfile.id} onClick={() => setMobileMenuOpen(false)} className="text-sm font-heading font-bold text-[var(--ink)]">{currentProfile.faceit_nickname}</Link>
                  </div>
                  <button
                    onClick={() => {
                      void logout();
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

                    router.push('/login');
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
              Esports-grade PC cabins on 240Hz MSI monitors and a PS5 Slim lounge with bean bags and chilled AC. Come through with your squad and play together.
            </p>

            <div className="actions reveal-init reveal-delay-3">
              <a className="btn-primary" href="/matches">
                <Trophy className="w-4 h-4 text-black" />
                <span>Find a 5v5 Match</span>
              </a>

              <a
                className="btn-ghost"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Contact us</span>
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

        <section id="arena"><ArenaWorkspace embedded /></section>

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
                Our Bahadurabad hall is split into four PC cabins and a dedicated PS5 lounge, so you can walk straight to the space for your whole squad.
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
                  <div className="price-note">Packages are per user. 240Hz MSI monitors &amp; GTX 1080 Ti graphics.</div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--line)]">
                  <a
                    className="btn-ghost w-full justify-center py-2.5 text-xs font-heading font-bold"
                    href="/matches"
                  >
                    <span>Find a 5v5 Match</span>
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
                    <span>Ask about the lounge</span>
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
              <div className="d">From every player who visits with us</div>
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
                  Contact:{' '}
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
              <Link href="/matches">5v5 Matching</Link><Link href="/tournaments">Tournaments</Link>
              <a href="#location">Location</a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a href="mailto:Oggamingkhi@gmail.com">Email</a>
            </div>
          </div>

          <div className="foot-bottom">
            OG Gaming &middot; Suite 201, 2nd Floor, Meriums Complex, Main Bahadurabad, Karachi &middot;{' '}
            <a href="tel:+923062779481" className="hover:text-[var(--orange)]">+92 306 2779481</a> &middot;{' '}
            <a href="mailto:Oggamingkhi@gmail.com" className="hover:text-[var(--orange)]">
              Oggamingkhi@gmail.com
            </a>
          </div>
        </div>
      </footer>

      <BayDetailsDialog bay={selectedBay} onClose={() => setSelectedBay(null)} contactUrl={whatsappUrl} />
    </div>
  );
}
