'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { BookingCalendar } from '@/components/BookingCalendar';
import { MatchBoard } from '@/components/MatchBoard';
import { TournamentsView } from '@/components/TournamentsView';
import { AdminPanel } from '@/components/AdminPanel';
import { Profile, Cabin, SlotRequest, MatchRequest, Tournament, Registration } from '@/types';
import { Shield, Sparkles, Trophy, Calendar, Swords, Wifi, Cpu, Flame, MapPin, ArrowLeft } from 'lucide-react';

export default function ArenaPage() {
  const [activeTab, setActiveTab] = useState<string>('calendar');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [bookings, setBookings] = useState<SlotRequest[]>([]);
  const [matches, setMatches] = useState<MatchRequest[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all initial data
  const loadData = async () => {
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
      if (!currentProfile) {
        setCurrentProfile(defaultProfiles[0]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const pendingApprovalsCount =
    bookings.filter((b) => b.status === 'pending').length +
    registrations.filter((r) => r.status === 'pending').length;

  if (isLoading || !currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center font-black text-black text-2xl animate-pulse">
            OG
          </div>
          <span className="text-sm font-semibold tracking-wider text-muted-foreground font-heading">
            INITIALIZING OG ARENA ENGINE...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-black">
      {/* Top Navigation */}
      <Navbar
        currentProfile={currentProfile}
        availableProfiles={profiles}
        onSelectProfile={(p) => setCurrentProfile(p)}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t)}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Return to Landing Bar */}
      <div className="bg-[#151109] border-b border-border/40 py-2 px-4">
        <div className="container mx-auto flex items-center justify-between text-xs">
          <Link href="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to OG Gaming Homepage (oggaming.pk)</span>
          </Link>
          <div className="hidden sm:flex items-center gap-3 text-muted-foreground">
            <span>Main Bahadurabad, Karachi</span>
            <span>•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Live LAN System Active
            </span>
          </div>
        </div>
      </div>

      {/* Hero Esports Header */}
      <section className="relative border-b border-border/60 bg-gradient-to-b from-secondary/50 via-background to-background py-8 sm:py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-black px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40 uppercase tracking-widest flex items-center gap-1.5 font-heading">
                  <Flame className="w-3.5 h-3.5" />
                  Phase 1 MVP Platform
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  LAN Ping: 1ms
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Sector 4 Arena • Meriums Complex
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground uppercase font-heading">
                OG GAMING <span className="text-primary">ARENA PLATFORM</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-2xl">
                High-performance CS2 bootcamp cabins, 240Hz competitive LAN stage, automated FACEIT level validation, and
                instant slot bookings.
              </p>
            </div>

            {/* Quick Status Stats Card */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-3 rounded-xl bg-secondary/80 border border-border flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground font-heading">4 VIP Cabins</div>
                  <div className="text-[11px] text-muted-foreground">RTX 4080 • 240Hz MSI</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/80 border border-border flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground font-heading">$2,000 In LAN Prizes</div>
                  <div className="text-[11px] text-muted-foreground">2 Active Cups</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-8 flex-1">
        {activeTab === 'calendar' && (
          <BookingCalendar
            cabins={cabins}
            bookings={bookings}
            currentProfile={currentProfile}
            onBookingCreated={(newB) => setBookings((prev) => [newB, ...prev])}
          />
        )}

        {activeTab === 'matches' && (
          <MatchBoard
            matches={matches}
            cabins={cabins}
            currentProfile={currentProfile}
            onMatchUpdated={loadData}
          />
        )}

        {activeTab === 'tournaments' && (
          <TournamentsView
            tournaments={tournaments}
            registrations={registrations}
            currentProfile={currentProfile}
            onRegistrationCreated={loadData}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            bookings={bookings}
            registrations={registrations}
            tournaments={tournaments}
            cabins={cabins}
            profiles={profiles}
            onDataRefresh={loadData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-secondary/30 py-6 text-xs text-muted-foreground">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground font-heading">OG Gaming Arena Platform</span>
            <span>•</span>
            <span>Suite 201, Meriums Complex, Main Bahadurabad, Karachi</span>
          </div>
          <div>
            <span>PostgreSQL Exclusion Constraint Active • 15s Polling Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
