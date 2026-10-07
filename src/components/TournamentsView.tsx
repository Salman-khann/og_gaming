'use client';

import React, { useState } from 'react';
import { Tournament, Registration, Profile } from '@/types';
import { Trophy, Calendar, Users, Award, ShieldCheck, AlertTriangle, CheckCircle2, Search, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface TournamentsViewProps {
  tournaments: Tournament[];
  registrations: Registration[];
  currentProfile: Profile;
  onRegistrationCreated: () => void;
}

export function TournamentsView({
  tournaments,
  registrations,
  currentProfile,
  onRegistrationCreated,
}: TournamentsViewProps) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  
  // 5 player nicknames
  const [rosterNicks, setRosterNicks] = useState<string[]>([
    currentProfile.faceit_nickname,
    '',
    '',
    '',
    '',
  ]);

  const [isVerifyingRoster, setIsVerifyingRoster] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const getLevelBadgeClass = (lvl: number) => `badge-lvl-${lvl}`;

  const openRegistration = (tourney: Tournament) => {
    setSelectedTournament(tourney);
    setTeamName('');
    setRosterNicks([currentProfile.faceit_nickname, '', '', '', '']);
    setRegError('');
    setRegSuccess('');
    setIsRegisterOpen(true);
  };

  const handleRosterNickChange = (index: number, val: string) => {
    const updated = [...rosterNicks];
    updated[index] = val;
    setRosterNicks(updated);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament) return;

    if (!teamName.trim()) {
      setRegError('Please provide a team name');
      return;
    }

    const filledNicks = rosterNicks.map((n) => n.trim()).filter(Boolean);
    if (filledNicks.length !== 5) {
      setRegError('All 5 player nicknames are strictly required for LAN registration');
      return;
    }

    setIsVerifyingRoster(true);
    setRegError('');

    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: selectedTournament.id,
          captain_id: currentProfile.id,
          team_name: teamName.trim(),
          roster_nicknames: filledNicks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || 'Registration failed');
        setIsVerifyingRoster(false);
        return;
      }

      setRegSuccess('Team registered successfully! Pending admin approval.');
      onRegistrationCreated();
      setTimeout(() => {
        setIsRegisterOpen(false);
        setRegSuccess('');
      }, 1500);
    } catch (err) {
      setRegError('Network error during registration');
    } finally {
      setIsVerifyingRoster(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Tournaments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tournaments.map((tourney) => {
          const tourneyRegs = registrations.filter((r) => r.tournament_id === tourney.id);
          const approvedCount = tourneyRegs.filter((r) => r.status === 'approved').length;
          const isEligible =
            currentProfile.faceit_level >= tourney.min_level &&
            currentProfile.faceit_level <= tourney.max_level;

          const isCaptainRegistered = tourneyRegs.some((r) => r.captain_id === currentProfile.id);

          return (
            <div
              key={tourney.id}
              className="glass-panel p-6 rounded-2xl border border-border flex flex-col justify-between space-y-6 relative overflow-hidden"
            >
              {/* Subtle accent glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <span className="font-bold text-xs uppercase tracking-widest text-primary">Official LAN Cup</span>
                  </div>
                  <Badge variant="outline" className="border-border bg-secondary/80 text-xs">
                    {tourney.format}
                  </Badge>
                </div>

                <h3 className="text-2xl font-black text-foreground mt-3 tracking-tight">{tourney.title}</h3>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{tourney.description}</p>

                {/* Key Tournament Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
                  <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/80">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Prize Pool</span>
                    <span className="text-sm font-black text-orange-400 mt-0.5 flex items-center gap-1">
                      <Award className="w-4 h-4" />
                      {tourney.prize_pool}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/80">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Level Restriction</span>
                    <span className="text-sm font-black text-foreground mt-0.5">
                      FACEIT Lvl {tourney.min_level} - {tourney.max_level}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/80 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Slots</span>
                    <span className="text-sm font-black text-foreground mt-0.5">
                      {approvedCount} / {tourney.max_teams} Teams
                    </span>
                  </div>
                </div>

                {/* Eligibility Notice */}
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    {isEligible ? (
                      <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        You meet Level Requirements (Lvl {currentProfile.faceit_level})
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-4 h-4" />
                        Requires Lvl {tourney.min_level}-{tourney.max_level} (Your Lvl is {currentProfile.faceit_level})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Registered Teams Snippet */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>Registered Teams ({tourneyRegs.length})</span>
                  <span className="text-[11px] text-muted-foreground">Check-in at arena</span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {tourneyRegs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center italic">No teams registered yet. Be the first!</p>
                  ) : (
                    tourneyRegs.map((reg) => (
                      <div
                        key={reg.id}
                        className="px-3 py-2 rounded-lg bg-secondary/70 border border-border flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{reg.team_name}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            (Avg Lvl {reg.avg_faceit_level})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {reg.checked_in ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] py-0">
                              Checked In
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] py-0 border-border">
                              Registered
                            </Badge>
                          )}
                          <Badge
                            className={`text-[10px] py-0 ${
                              reg.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : reg.status === 'rejected'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {reg.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Action button */}
                <div className="pt-2">
                  {isCaptainRegistered ? (
                    <Button disabled className="w-full bg-secondary text-muted-foreground text-xs font-semibold">
                      Your Team is Registered
                    </Button>
                  ) : approvedCount >= tourney.max_teams ? (
                    <Button disabled className="w-full bg-secondary text-muted-foreground text-xs font-semibold">
                      Tournament Full
                    </Button>
                  ) : (
                    <Button
                      onClick={() => openRegistration(tourney)}
                      className="w-full bg-primary text-black font-bold hover:bg-orange-500 shadow-md shadow-primary/20"
                    >
                      Register Team
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Team Registration Modal */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Register for {selectedTournament?.title}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegister} className="space-y-4 pt-1">
            <div className="p-3 rounded-lg bg-secondary/80 border border-border text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Required Level Range:{' '}
                <strong className="text-foreground">
                  FACEIT Level {selectedTournament?.min_level} to {selectedTournament?.max_level}
                </strong>
              </span>
              <span>LAN 5v5</span>
            </div>

            <div>
              <Label className="text-xs">Team Name</Label>
              <Input
                placeholder="e.g. NAVI Junior / Team Nemesis"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="bg-secondary border-border mt-1 text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">5 Roster Player Nicknames (FACEIT)</Label>
                <span className="text-[11px] text-muted-foreground">Automated Level Check</span>
              </div>

              <div className="space-y-2">
                {rosterNicks.map((nick, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-6 text-center">#{idx + 1}</span>
                    <Input
                      placeholder={idx === 0 ? 'Captain Nickname' : `Player ${idx + 1} Nickname`}
                      value={nick}
                      onChange={(e) => handleRosterNickChange(idx, e.target.value)}
                      className="bg-secondary border-border text-xs h-8"
                    />
                    {idx === 0 && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                        Captain
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Tip: Try demo players like <code>s1mple</code>, <code>ZywOo</code>, <code>CasualFragger</code>,{' '}
                <code>NoobMaster69</code>, <code>donk</code>, <code>m0NESY</code>.
              </p>
            </div>

            {regError && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{regSuccess}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isVerifyingRoster} className="bg-primary text-black font-bold">
                {isVerifyingRoster ? 'Verifying with FACEIT...' : 'Submit Registration'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
