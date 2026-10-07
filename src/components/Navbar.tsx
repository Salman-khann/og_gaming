'use client';

import React, { useState } from 'react';
import { Profile } from '@/types';
import { Shield, User, ChevronDown, Check, Zap, LogIn, Swords, Trophy, Calendar, Bell } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

interface NavbarProps {
  currentProfile: Profile;
  availableProfiles: Profile[];
  onSelectProfile: (profile: Profile) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingApprovalsCount: number;
}

export function Navbar({
  currentProfile,
  availableProfiles,
  onSelectProfile,
  activeTab,
  onTabChange,
  pendingApprovalsCount,
}: NavbarProps) {
  const [customNickname, setCustomNickname] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [customError, setCustomError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const getLevelClass = (level: number) => {
    return `badge-lvl-${level}`;
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNickname.trim()) return;

    setIsVerifying(true);
    setCustomError('');

    try {
      const res = await fetch(`/api/faceit/lookup?nickname=${encodeURIComponent(customNickname.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setCustomError(data.error || 'Failed to find FACEIT player');
        setIsVerifying(false);
        return;
      }

      const p = data.player;
      const newProf: Profile = {
        id: `usr-${Date.now()}`,
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

      onSelectProfile(newProf);
      setDialogOpen(false);
      setCustomNickname('');
    } catch (err) {
      setCustomError('Network error checking FACEIT profile');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('calendar')}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center font-black text-black text-xl tracking-tighter shadow-lg shadow-primary/30">
              OG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-wider text-foreground">OG GAMING</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/40 uppercase tracking-widest">
                  Arena LAN
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">CS2 Venue & Tournament Center</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onTabChange('calendar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'calendar'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Cabin Booking
            </button>
            <button
              onClick={() => onTabChange('matches')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'matches'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Swords className="w-4 h-4" />
              5v5 Board
            </button>
            <button
              onClick={() => onTabChange('tournaments')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'tournaments'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Tournaments
            </button>
            <button
              onClick={() => onTabChange('admin')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 relative ${
                activeTab === 'admin'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
              {pendingApprovalsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-black text-[11px] font-bold flex items-center justify-center animate-pulse">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* User Profile & Demo Switcher */}
        <div className="flex items-center gap-3">
          {/* Active Player Card / Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border transition-colors text-left cursor-pointer outline-none">
              {/* FACEIT Level Badge */}
              <span
                className={`w-6 h-6 rounded flex items-center justify-center font-black text-xs shadow-sm ${getLevelClass(
                  currentProfile.faceit_level
                )}`}
              >
                {currentProfile.faceit_level}
              </span>

              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground">{currentProfile.faceit_nickname}</span>
                  {currentProfile.role === 'admin' && (
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1 py-0.2 rounded font-bold uppercase">
                      Admin
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">{currentProfile.faceit_elo} Elo • CS2</span>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 bg-card border-border shadow-xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Switch Test Account (Demo Mode)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {availableProfiles.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => onSelectProfile(p)}
                  className="flex items-center justify-between cursor-pointer py-2 focus:bg-secondary"
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
                      <div className="text-[11px] text-muted-foreground">{p.faceit_elo} Elo</div>
                    </div>
                  </div>
                  {currentProfile.id === p.id && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger className="px-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded cursor-pointer flex items-center gap-2 w-full text-left outline-none">
                  <LogIn className="w-3.5 h-3.5" />
                  Enter Custom FACEIT Nickname...
                </DialogTrigger>
                <DialogContent className="bg-card border-border sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      Connect FACEIT Account
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-xs text-muted-foreground">
                    Day 0 Fallback: Enter any registered FACEIT CS2 nickname. The system automatically fetches your live
                    skill level and Elo.
                  </p>

                  <form onSubmit={handleCustomLogin} className="space-y-4 pt-2">
                    <div>
                      <Input
                        placeholder="e.g. s1mple, m0NESY, or your nickname"
                        value={customNickname}
                        onChange={(e) => setCustomNickname(e.target.value)}
                        className="bg-secondary border-border"
                      />
                      {customError && <p className="text-xs text-destructive mt-1.5">{customError}</p>}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isVerifying} className="bg-primary text-black font-bold">
                        {isVerifying ? 'Verifying with FACEIT...' : 'Lookup & Switch'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t border-border/50 bg-secondary/50">
        <button
          onClick={() => onTabChange('calendar')}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1 ${
            activeTab === 'calendar' ? 'text-primary border-b-2 border-primary bg-primary/10' : 'text-muted-foreground'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Cabins
        </button>
        <button
          onClick={() => onTabChange('matches')}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1 ${
            activeTab === 'matches' ? 'text-primary border-b-2 border-primary bg-primary/10' : 'text-muted-foreground'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          5v5 Board
        </button>
        <button
          onClick={() => onTabChange('tournaments')}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1 ${
            activeTab === 'tournaments' ? 'text-primary border-b-2 border-primary bg-primary/10' : 'text-muted-foreground'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Tournaments
        </button>
        <button
          onClick={() => onTabChange('admin')}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1 relative ${
            activeTab === 'admin' ? 'text-primary border-b-2 border-primary bg-primary/10' : 'text-muted-foreground'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Admin
          {pendingApprovalsCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-primary text-black text-[10px] font-bold inline-flex items-center justify-center ml-0.5">
              {pendingApprovalsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
