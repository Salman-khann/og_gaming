'use client';

import React, { useState } from 'react';
import { MatchRequest, Profile, Cabin } from '@/types';
import { Swords, Users, Plus, Shield, CheckCircle, AlertCircle, Clock, MapPin, Sparkles, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MatchBoardProps {
  matches: MatchRequest[];
  cabins: Cabin[];
  currentProfile: Profile;
  onMatchUpdated: () => void;
}

export function MatchBoard({ matches, cabins, currentProfile, onMatchUpdated }: MatchBoardProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedMatchForRoster, setSelectedMatchForRoster] = useState<MatchRequest | null>(null);
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MatchRequest['type']>('gather_5v5');
  const [description, setDescription] = useState('');
  const [preferredCabinId, setPreferredCabinId] = useState(cabins[0]?.id || '');
  const [minLevel, setMinLevel] = useState(3);
  const [maxLevel, setMaxLevel] = useState(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Joining state
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<{ matchId: string; msg: string } | null>(null);

  const filteredMatches = matches.filter((m) => {
    if (filterType === 'all') return true;
    return m.type === filterType;
  });

  const getLevelBadgeClass = (lvl: number) => `badge-lvl-${lvl}`;

  const handleJoin = async (match: MatchRequest) => {
    setJoinError(null);
    setJoiningMatchId(match.id);

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          match_id: match.id,
          user_id: currentProfile.id,
          role: 'Rifler',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setJoinError({ matchId: match.id, msg: data.error || 'Failed to join match' });
        setJoiningMatchId(null);
        return;
      }

      onMatchUpdated();
    } catch (err) {
      setJoinError({ matchId: match.id, msg: 'Network error joining match' });
    } finally {
      setJoiningMatchId(null);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please provide a match title');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const scheduledDate = new Date();
      scheduledDate.setHours(scheduledDate.getHours() + 2);

      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: currentProfile.id,
          title,
          type,
          description,
          preferred_cabin_id: preferredCabinId,
          scheduled_time: scheduledDate.toISOString(),
          min_faceit_level: minLevel,
          max_faceit_level: maxLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create match request');
        setIsSubmitting(false);
        return;
      }

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      onMatchUpdated();
    } catch (err) {
      setFormError('Network error creating match request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Filter & Create button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-bold transition-all ${
              filterType === 'all'
                ? 'bg-[var(--orange)] text-black shadow-md shadow-[var(--orange)]/25'
                : 'bg-[#151109] border border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--ink)] hover:border-[var(--orange)]/40'
            }`}
          >
            All Requests ({matches.length})
          </button>
          <button
            onClick={() => setFilterType('gather_5v5')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-bold transition-all ${
              filterType === 'gather_5v5'
                ? 'bg-[var(--orange)] text-black shadow-md shadow-[var(--orange)]/25'
                : 'bg-[#151109] border border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--ink)] hover:border-[var(--orange)]/40'
            }`}
          >
            5v5 Gathers
          </button>
          <button
            onClick={() => setFilterType('team_vs_team')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-bold transition-all ${
              filterType === 'team_vs_team'
                ? 'bg-[var(--orange)] text-black shadow-md shadow-[var(--orange)]/25'
                : 'bg-[#151109] border border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--ink)] hover:border-[var(--orange)]/40'
            }`}
          >
            Team vs Team Scrims
          </button>
          <button
            onClick={() => setFilterType('solo_lfg')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-bold transition-all ${
              filterType === 'solo_lfg'
                ? 'bg-[var(--orange)] text-black shadow-md shadow-[var(--orange)]/25'
                : 'bg-[#151109] border border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--ink)] hover:border-[var(--orange)]/40'
            }`}
          >
            Looking For Players (LFP)
          </button>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-lg text-sm font-heading font-bold h-9 px-4 py-2 bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black shadow-md shadow-[var(--orange)]/25 cursor-pointer outline-none">
            <Plus className="w-4 h-4 mr-1.5" />
            Post 5v5 Match Request
          </DialogTrigger>
          <DialogContent className="bg-[#151109] border-[var(--line)] text-[var(--ink)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading text-xl text-[var(--ink)]">
                <Swords className="w-5 h-5 text-[var(--orange)]" />
                <span>Create 5v5 LAN Match Request</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateMatch} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Match Title</Label>
                <Input
                  placeholder="e.g. Inferno BO3 Scrim (Level 7-10)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-[#0b0a08] border-[var(--line)] text-[var(--ink)] mt-1 font-heading"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Match Format</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as MatchRequest['type'])}
                    className="w-full h-9 rounded-md border border-[var(--line)] bg-[#0b0a08] text-sm text-[var(--ink)] px-3 mt-1 font-heading"
                  >
                    <option value="gather_5v5">Gather 5v5 (Mix teams on stage)</option>
                    <option value="team_vs_team">Team vs Team (5-Stack Scrim)</option>
                    <option value="solo_lfg">Looking For Players (LFP)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Preferred Cabin</Label>
                  <select
                    value={preferredCabinId}
                    onChange={(e) => setPreferredCabinId(e.target.value)}
                    className="w-full h-9 rounded-md border border-[var(--line)] bg-[#0b0a08] text-sm text-[var(--ink)] px-3 mt-1 font-heading"
                  >
                    {cabins.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.split(' - ')[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Min FACEIT Level</Label>
                  <select
                    value={minLevel}
                    onChange={(e) => setMinLevel(parseInt(e.target.value))}
                    className="w-full h-9 rounded-md border border-[var(--line)] bg-[#0b0a08] text-sm text-[var(--ink)] px-3 mt-1 font-heading"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => (
                      <option key={l} value={l}>
                        Level {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Max FACEIT Level</Label>
                  <select
                    value={maxLevel}
                    onChange={(e) => setMaxLevel(parseInt(e.target.value))}
                    className="w-full h-9 rounded-md border border-[var(--line)] bg-[#0b0a08] text-sm text-[var(--ink)] px-3 mt-1 font-heading"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => (
                      <option key={l} value={l}>
                        Level {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Description / Server Notes</Label>
                <Input
                  placeholder="e.g. 128-tick warmup, knife round for sides, BO3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-[#0b0a08] border-[var(--line)] text-[var(--ink)] mt-1 font-heading"
                />
              </div>

              {formError && <p className="text-xs text-rose-400">{formError}</p>}

              <div className="pt-2 flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black font-heading font-bold"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Match Request'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="border-[var(--line)] text-[var(--ink)] hover:bg-[#1a140b] font-heading"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Match Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMatches.map((match) => {
          const cabin = cabins.find((c) => c.id === match.preferred_cabin_id);
          const isUserInRoster = match.roster?.some(
            (r) => r.id === currentProfile.id || r.nickname.toLowerCase() === currentProfile.faceit_nickname.toLowerCase()
          );
          const isFull = (match.roster?.length || 0) >= 10;
          const isJoining = joiningMatchId === match.id;
          const err = joinError?.matchId === match.id ? joinError.msg : null;

          return (
            <div
              key={match.id}
              className="p-4 rounded-xl bg-[#151109] border border-[var(--line)] hover:border-[var(--orange)]/40 hover:shadow-[0_0_16px_rgba(255,106,18,0.12)] transition-all flex flex-col justify-between h-full group"
            >
              <div>
                {/* Header info */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded bg-[var(--orange)]/15 text-[var(--orange)] border border-[var(--orange)]/30 uppercase tracking-widest">
                    {match.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-[var(--ink-dim)] flex items-center gap-1 font-heading">
                    <Clock className="w-3.5 h-3.5 text-[var(--orange)]" />
                    Today 18:00
                  </span>
                </div>

                <h4 className="font-heading font-bold text-base text-[var(--ink)] tracking-tight line-clamp-1 group-hover:text-[var(--orange)] transition-colors">
                  {match.title}
                </h4>
                <p className="text-xs text-[var(--ink-dim)] mt-0.5 h-8 line-clamp-2 leading-relaxed">
                  {match.description || 'Competitive community 5v5 CS2 match hosted at OG Gaming.'}
                </p>

                {/* Level Criteria */}
                <div className="mt-3 p-2 rounded-lg bg-[#0b0a08] border border-[var(--line)] flex items-center justify-between text-xs font-heading">
                  <span className="text-[var(--ink-dim)] uppercase tracking-wider text-[10px]">ELO Restriction:</span>
                  <div className="flex items-center gap-1">
                    <span className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${getLevelBadgeClass(match.min_faceit_level)}`}>
                      {match.min_faceit_level}
                    </span>
                    <span className="text-[var(--ink-dim)] font-bold text-[10px]">to</span>
                    <span className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${getLevelBadgeClass(match.max_faceit_level)}`}>
                      {match.max_faceit_level}
                    </span>
                  </div>
                </div>

                {/* Roster preview list with uniform height */}
                <div className="mt-2.5 min-h-[26px]">
                  {match.roster && match.roster.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-h-[26px] overflow-hidden">
                      {match.roster.slice(0, 4).map((player) => (
                        <span
                          key={player.id || player.nickname}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0b0a08] border border-[var(--line)] text-[10px] font-heading text-[var(--ink)]"
                        >
                          <span className={`w-3 h-3 rounded text-[8px] font-black flex items-center justify-center ${getLevelBadgeClass(player.level)}`}>
                            {player.level}
                          </span>
                          <span className="font-semibold truncate max-w-[70px]">{player.nickname}</span>
                        </span>
                      ))}
                      {match.roster.length > 4 && (
                        <span className="text-[10px] text-[var(--orange)] font-heading font-bold self-center">
                          +{match.roster.length - 4} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--ink-dim)] font-heading flex items-center h-[26px]">
                      Open registration • 0/10 slots secured
                    </div>
                  )}
                </div>

                {/* Location / Cabin */}
                <div className="mt-2.5 pt-2 border-t border-[var(--line)]/60 flex items-center justify-between text-xs text-[var(--ink-dim)] font-heading">
                  <span className="flex items-center gap-1 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-[var(--orange)]" />
                    {cabin ? cabin.name.split(' - ')[0] : 'Bahadurabad Hall'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-[var(--ink)]">
                    <Users className="w-3.5 h-3.5 text-[var(--orange)]" />
                    {match.roster?.length || 0}/10 Players
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 pt-2.5 border-t border-[var(--line)] flex flex-col gap-1.5">
                {err && <p className="text-[10px] text-rose-400 font-heading">{err}</p>}

                <div className="flex items-center gap-2">
                  {isUserInRoster ? (
                    <span className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-heading font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Slot Confirmed
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoin(match)}
                      disabled={isFull || isJoining}
                      className="flex-1 py-2 px-3 rounded-lg bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black text-xs font-heading font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[var(--orange)]/20"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{isFull ? 'Roster Full' : isJoining ? 'Securing...' : 'Join 5v5 Roster'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
