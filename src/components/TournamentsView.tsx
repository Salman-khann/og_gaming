'use client';

import React, { useState } from 'react';
import { Tournament, Registration, Profile } from '@/types';
import { Trophy, Calendar, Users, Award, ShieldCheck, AlertTriangle, CheckCircle2, Search, ArrowRight, Flame } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      setRegError('Please provide a team or clan name');
      return;
    }

    const filledRoster = rosterNicks.filter((n) => n.trim().length > 0);
    if (filledRoster.length < 5) {
      setRegError('All 5 player FACEIT tags are required for LAN bracket seeding');
      return;
    }

    setIsVerifyingRoster(true);
    setRegError('');
    setRegSuccess('');

    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: selectedTournament.id,
          captain_id: currentProfile.id,
          team_name: teamName,
          roster_nicknames: filledRoster,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || 'Failed to submit team registration');
        setIsVerifyingRoster(false);
        return;
      }

      setRegSuccess('Team roster submitted successfully! Pending admin approval.');
      onRegistrationCreated();

      setTimeout(() => {
        setIsRegisterOpen(false);
        setRegSuccess('');
      }, 1400);
    } catch (err) {
      setRegError('Network error registering team');
    } finally {
      setIsVerifyingRoster(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {tournaments.map((t) => {
          const tourneyRegs = registrations.filter((r) => r.tournament_id === t.id);
          const isUserRegistered = tourneyRegs.some((r) => r.captain_id === currentProfile.id);

          return (
            <div
              key={t.id}
              className="p-4 sm:p-5 rounded-xl bg-[#151109] border border-[var(--line)] hover:border-[var(--orange)]/40 hover:shadow-[0_0_16px_rgba(255,106,18,0.12)] transition-all flex flex-col justify-between h-full group"
            >
              <div>
                {/* Header tag & status */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded bg-[var(--orange)]/15 text-[var(--orange)] border border-[var(--orange)]/30 uppercase tracking-widest flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>LAN Championship</span>
                  </span>
                  <span className="text-xs font-heading font-bold text-emerald-400">
                    Registration Open
                  </span>
                </div>

                <h3 className="font-heading font-bold text-xl text-[var(--ink)] tracking-tight group-hover:text-[var(--orange)] transition-colors truncate">
                  {t.title}
                </h3>
                <p className="text-xs text-[var(--ink-dim)] mt-1 h-8 line-clamp-2 leading-relaxed">
                  {t.description || '5v5 competitive bracket hosted live at OG Gaming, Bahadurabad, Karachi.'}
                </p>

                {/* Prize pool callout */}
                <div className="mt-3 p-3 rounded-lg bg-[#0b0a08] border border-[var(--line)] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-heading uppercase text-[var(--ink-dim)] tracking-wider">Total Prize Pool</div>
                    <div className="font-heading font-black text-xl text-[var(--orange)] leading-tight">
                      {t.prize_pool || '50,000 PKR'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-heading uppercase text-[var(--ink-dim)] tracking-wider">Entry Fee</div>
                    <div className="font-heading font-bold text-sm text-[var(--ink)]">
                      1,500 PKR / Team
                    </div>
                  </div>
                </div>

                {/* Tournament details info */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-heading text-[var(--ink-dim)]">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-[var(--orange)]" />
                    <span>Starting This Saturday</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Users className="w-3.5 h-3.5 text-[var(--orange)]" />
                    <span>{tourneyRegs.length} / 16 Teams Registered</span>
                  </div>
                </div>

                {/* Registered teams preview */}
                <div className="mt-2.5 pt-2 border-t border-[var(--line)]/60 min-h-[26px]">
                  {tourneyRegs.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-h-[26px] overflow-hidden">
                      {tourneyRegs.slice(0, 3).map((reg) => (
                        <span
                          key={reg.id}
                          className="px-1.5 py-0.5 rounded bg-[#0b0a08] border border-[var(--line)] text-[10px] font-heading font-semibold text-[var(--ink)] truncate max-w-[90px]"
                        >
                          {reg.team_name}
                        </span>
                      ))}
                      {tourneyRegs.length > 3 && (
                        <span className="text-[10px] text-[var(--orange)] font-heading font-bold self-center">
                          +{tourneyRegs.length - 3} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--ink-dim)] font-heading flex items-center h-[26px]">
                      Open bracket • Register your 5-stack roster
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between gap-3">
                {isUserRegistered ? (
                  <span className="w-full py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-heading font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Team Registered &amp; Verified
                  </span>
                ) : (
                  <button
                    onClick={() => openRegistration(t)}
                    className="w-full py-2 px-3 rounded-lg bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[var(--orange)]/25"
                  >
                    <span>Register 5-Stack Roster</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Team Registration Modal */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="bg-[#151109] border-[var(--line)] text-[var(--ink)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-[var(--ink)] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[var(--orange)]" />
              <span>Register Team: {selectedTournament?.title}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegister} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Team / Clan Name</Label>
              <Input
                placeholder="e.g. Karachi Titans, Team OverKill"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="bg-[#0b0a08] border-[var(--line)] text-[var(--ink)] mt-1 font-heading"
              />
            </div>

            <div>
              <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase mb-2 block">
                5-Player FACEIT Nicknames (Required for ELO Validation)
              </Label>
              <div className="space-y-2">
                {rosterNicks.map((nick, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-heading font-bold w-16 text-[var(--ink-dim)]">
                      {idx === 0 ? 'Captain' : `Player ${idx + 1}`}
                    </span>
                    <Input
                      placeholder={idx === 0 ? currentProfile.faceit_nickname : `Player ${idx + 1} FACEIT Tag`}
                      value={nick}
                      onChange={(e) => handleRosterNickChange(idx, e.target.value)}
                      className="bg-[#0b0a08] border-[var(--line)] text-[var(--ink)] font-heading text-sm h-8"
                    />
                  </div>
                ))}
              </div>
            </div>

            {regError && <p className="text-xs text-rose-400 font-heading">{regError}</p>}
            {regSuccess && <p className="text-xs text-emerald-400 font-heading">{regSuccess}</p>}

            <div className="pt-2 flex gap-3">
              <Button
                type="submit"
                disabled={isVerifyingRoster}
                className="flex-1 bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black font-heading font-bold"
              >
                {isVerifyingRoster ? 'Verifying Rosters...' : 'Submit Team Registration'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRegisterOpen(false)}
                className="border-[var(--line)] text-[var(--ink)] hover:bg-[#1a140b] font-heading"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
