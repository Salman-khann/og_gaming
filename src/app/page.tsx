'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CyberBackground } from '@/components/CyberBackground';
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
  Volume2,
} from 'lucide-react';

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

  const whatsappBaseUrl = 'https://wa.me/923062779481';
  const whatsappUrl = `${whatsappBaseUrl}?text=Hi%20OG%20Gaming%2C%20I%27d%20like%20to%20book%20a%20bay`;

  // Track scroll progress for astonishing top neon indicator
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

  // IntersectionObserver for staggered scroll reveals across all elements
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
        threshold: 0.12,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    const elements = document.querySelectorAll('.reveal-init');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--orange)] selection:text-black relative">
      {/* ASTONISHING TOP NEON SCROLL PROGRESS BAR */}
      <div
        className="fixed top-0 left-0 h-[3.5px] z-[100] bg-gradient-to-r from-[#ff6a12] via-[#ffb27a] to-[#ff6a12] transition-all duration-75 ease-out shadow-[0_0_12px_#ff6a12]"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* DYNAMIC MOVING BACKGROUND (CYBER GRID, FLOATING EMBERS & NEBULA ORBS) */}
      <CyberBackground />

      {/* HEADER / NAVIGATION */}
      <header className="site-header">
        <nav className="wrap">
          {/* MUCH LARGER OG GAMING LOGO */}
          <Link href="/" className="brand group flex items-center gap-3 py-1">
            <div className="relative flex items-center">
              {/* Backlight halo on hover */}
              <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-[#ff6a12]/20 via-[#ffb27a]/15 to-transparent blur-lg opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
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

          {/* Desktop Navlinks */}
          <div className="navlinks">
            <a href="#bays" className="font-heading tracking-wide uppercase text-sm font-semibold">
              Cabins &amp; Lounge
            </a>
            <a href="#specs" className="font-heading tracking-wide uppercase text-sm font-semibold">
              Specs
            </a>
            <a href="#pricing" className="font-heading tracking-wide uppercase text-sm font-semibold">
              Pricing
            </a>
            <a href="#location" className="font-heading tracking-wide uppercase text-sm font-semibold">
              Location
            </a>
            <Link
              href="/arena"
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold px-3 py-1.5 rounded bg-[#ff6a12]/15 text-[#ff6a12] border border-[#ff6a12]/35 hover:bg-[#ff6a12]/30 hover:border-[#ff6a12] transition-all shadow-[0_0_15px_rgba(255,106,18,0.15)] font-heading"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Arena Portal</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <a
              className="navcta"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Book on WhatsApp</span>
            </a>

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
              href="#bays"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-heading font-bold text-[var(--ink-dim)] hover:text-[var(--orange)] py-1"
            >
              Cabins &amp; Lounge
            </a>
            <a
              href="#specs"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-heading font-bold text-[var(--ink-dim)] hover:text-[var(--orange)] py-1"
            >
              Specs
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-heading font-bold text-[var(--ink-dim)] hover:text-[var(--orange)] py-1"
            >
              Pricing
            </a>
            <a
              href="#location"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-heading font-bold text-[var(--ink-dim)] hover:text-[var(--orange)] py-1"
            >
              Location
            </a>
            <Link
              href="/arena"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between text-sm font-bold text-[#ff6a12] py-2 border-t border-[var(--line)] font-heading"
            >
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                <span>CS2 Arena LAN Portal</span>
              </span>
              <ChevronRight className="w-4 h-4" />
            </Link>
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
              <a
                className="btn-primary"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Book a bay on WhatsApp</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a className="btn-ghost" href="#pricing">
                <span>See pricing</span>
              </a>

              <Link className="btn-ghost" href="/arena">
                <Trophy className="w-4 h-4 text-[var(--orange)]" />
                <span>Arena Schedule &amp; System</span>
              </Link>
            </div>

            {/* Statline with Astonishing Numbers */}
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

            <div className="bay-grid" style={{ marginTop: '34px' }}>
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

                  <div className="desc">{bay.desc}</div>

                  <div className="mt-4 flex items-center justify-between">
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

            <div className="spec-cols" style={{ marginTop: '34px' }}>
              {/* PC Cabins Specs */}
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

              {/* PS5 Lounge Specs */}
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

            <div className="price-cols">
              {/* PC Gaming Pricing Card */}
              <div className="price-col reveal-init reveal-delay-1 neon-border-pulse">
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
                <div className="price-note">Packages are per user.</div>
              </div>

              {/* PS5 Lounge Pricing Card */}
              <div className="price-col reveal-init reveal-delay-2 neon-border-pulse flex flex-col justify-between">
                <div>
                  <h3>PS5 Lounge</h3>
                  <div className="rate">
                    500<sup>/ hour</sup>
                  </div>
                  <div className="price-note" style={{ marginTop: '22px' }}>
                    PS5 with 2 controllers included.
                    <br />
                    +300 PKR for an extra controller, subject to availability.
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--line)]">
                  <a
                    className="btn-primary w-full justify-center shadow-lg shadow-[var(--orange)]/25"
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

        {/* ARENA PLATFORM SPOTLIGHT */}
        <section className="py-16 border-b border-[var(--line)] bg-[#120e08]/70 relative overflow-hidden">
          <div className="wrap">
            <div className="p-8 sm:p-10 rounded-xl bg-gradient-to-r from-[#17120a] to-[#1f170d] border border-[var(--line)] relative reveal-init shadow-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff6a12]/15 text-[#ff6a12] border border-[#ff6a12]/30 text-xs font-bold font-heading mb-4 tracking-wider uppercase">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Competitive Arena Platform</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-heading font-black text-[var(--ink)] tracking-tight">
                    CS2 Bootcamp Cabins &amp; Online Slot Reservations
                  </h3>
                  <p className="text-[var(--ink-dim)] text-sm sm:text-base mt-3 leading-relaxed">
                    Check real-time cabin schedules, connect your FACEIT profile to verify ELO levels, join LAN tournaments, or challenge other clans in Bahadurabad.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-[var(--ink-dim)]">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Instant Conflict-Free Scheduling
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[var(--orange)]" />
                      FACEIT Level Sync
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[var(--orange)]" />
                      LAN Tournaments
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                  <Link
                    href="/arena"
                    className="btn-primary justify-center text-center shadow-lg shadow-[var(--orange)]/30"
                  >
                    <span>Launch Arena Platform</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <a
                    href="https://wa.me/923062779481?text=Hi%20OG%20Gaming%2C%20I%20want%20to%20inquire%20about%20LAN%20tournaments"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost justify-center text-center text-xs"
                  >
                    <span>Inquire Tournament Rules</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LOCATION SECTION */}
        <section id="location" className="location">
          <div className="wrap">
            <div className="sec-head reveal-init" style={{ padding: '0 0 30px' }}>
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
              <a href="#location">Location</a>
              <Link href="/arena">Arena Portal</Link>
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
            <div className="mt-6 pt-5 border-t border-[var(--line)] flex gap-3">
              <a
                href={`https://wa.me/923062779481?text=Hi%20OG%20Gaming%2C%20I%20would%20like%20to%20book%20${encodeURIComponent(
                  selectedBay.tag
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 justify-center text-sm py-3"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Book This Bay on WhatsApp</span>
              </a>
              <button
                onClick={() => setSelectedBay(null)}
                className="btn-ghost text-sm py-3 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
