'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Menu } from 'lucide-react';

import React, { useState } from 'react';
import { X, ChevronDown, LogIn, LogOut, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function HomeHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { profile: currentProfile, logout } = useAuth();
  const router = useRouter();
  const getLevelClass = (level: number) =>
    level >= 10
      ? 'bg-red-600 text-white'
      : level >= 7
        ? 'bg-orange-500 text-black'
        : 'bg-yellow-400 text-black';
  return (
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
          <Link
            href="/matches"
            className="font-heading uppercase text-sm font-semibold text-[var(--orange)]"
            onClick={() => setMobileMenuOpen(false)}
          >
            5v5 Matching
          </Link>
          <Link
            href="/tournaments"
            className="font-heading uppercase text-sm font-semibold text-[var(--orange)]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Tournaments
          </Link>
          <Link
            href="/leaderboard"
            className="font-heading uppercase text-sm font-semibold"
            onClick={() => setMobileMenuOpen(false)}
          >
            Leaderboard
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {currentProfile?.role === 'admin' && (
            <Link className="navcta" href="/admin">
              Manage tournaments
            </Link>
          )}
          {currentProfile ? (
            <DropdownMenu>
              <Link
                href={'/players/' + currentProfile.id}
                className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#151109] border border-[var(--line)] hover:border-[var(--orange)] transition-all cursor-pointer outline-none shadow-md"
              >
                <span
                  className={`w-6 h-6 rounded flex items-center justify-center font-black text-xs shadow-sm ${getLevelClass(
                    currentProfile.faceit_level,
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
              <DropdownMenuTrigger aria-label="Account menu" className="p-2 text-[var(--ink-dim)]">
                <ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 bg-[#151109] border-[var(--line)] text-[var(--ink)] shadow-2xl p-2"
              >
                <div className="p-3 rounded-lg bg-[#0b0a08] border border-[var(--line)] mb-2">
                  <div className="text-[10px] uppercase font-heading font-bold text-[var(--ink-dim)] tracking-wider">
                    Logged in Player
                  </div>
                  <div className="text-sm font-heading font-bold text-[var(--orange)] flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${getLevelClass(currentProfile.faceit_level)}`}
                    >
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
          <Link
            href="/matches"
            className="font-heading uppercase text-sm font-semibold text-[var(--orange)]"
            onClick={() => setMobileMenuOpen(false)}
          >
            5v5 Matching
          </Link>
          <Link
            href="/tournaments"
            className="font-heading uppercase text-sm font-semibold text-[var(--orange)]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Tournaments
          </Link>
          <Link
            href="/leaderboard"
            className="font-heading uppercase text-sm font-semibold"
            onClick={() => setMobileMenuOpen(false)}
          >
            Leaderboard
          </Link>
          {currentProfile?.role === 'admin' && (
            <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
              Manage tournaments
            </Link>
          )}
          <div className="pt-2 border-t border-[var(--line)]">
            {currentProfile ? (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${getLevelClass(currentProfile.faceit_level)}`}
                  >
                    {currentProfile.faceit_level}
                  </span>
                  <Link
                    href={'/players/' + currentProfile.id}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-heading font-bold text-[var(--ink)]"
                  >
                    {currentProfile.faceit_nickname}
                  </Link>
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
  );
}
