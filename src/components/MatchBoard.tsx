'use client';

import React, { useState } from 'react';
import { MatchRequest, Profile, Cabin } from '@/types';
import { Swords, Users, Plus, Shield, CheckCircle, AlertCircle, Clock, MapPin, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface MatchBoardProps {
  matches: MatchRequest[];
  cabins: Cabin[];
  currentProfile: Profile;
  onMatchUpdated: () => void;
}

export function MatchBoard({ matches, cabins, currentProfile, onMatchUpdated }: MatchBoardProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedMatchForRoster, setSelectedMatchForRoster] = useState<MatchRequest | null>(null);
  
  // Create Modal
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
          target_players_count: type === 'solo_lfg' ? 5 : 10,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create match');
        setIsSubmitting(false);
        return;
      }

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      onMatchUpdated();
    } catch (err) {
      setFormError('Network error creating match');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Filter & Create button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={filterType === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterType('all')}
            className={filterType === 'all' ? 'bg-primary text-black font-bold' : ''}
          >
            All Requests ({matches.length})
          </Button>
          <Button
            size="sm"
            variant={filterType === 'gather_5v5' ? 'default' : 'outline'}
            onClick={() => setFilterType('gather_5v5')}
            className={filterType === 'gather_5v5' ? 'bg-primary text-black font-bold' : ''}
          >
            5v5 Gathers
          </Button>
          <Button
            size="sm"
            variant={filterType === 'team_vs_team' ? 'default' : 'outline'}
            onClick={() => setFilterType('team_vs_team')}
            className={filterType === 'team_vs_team' ? 'bg-primary text-black font-bold' : ''}
          >
            Team vs Team Scrims
          </Button>
          <Button
            size="sm"
            variant={filterType === 'solo_lfg' ? 'default' : 'outline'}
            onClick={() => setFilterType('solo_lfg')}
            className={filterType === 'solo_lfg' ? 'bg-primary text-black font-bold' : ''}
          >
            Looking For Players (LFP)
          </Button>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-bold h-9 px-4 py-2 bg-primary text-black hover:bg-orange-500 shadow-md shadow-primary/20 cursor-pointer outline-none">
            <Plus className="w-4 h-4 mr-1.5" />
            Post 5v5 Match Request
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-primary" />
                Create 5v5 LAN Match Request
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateMatch} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs">Match Title</Label>
                <Input
                  placeholder="e.g. Inferno BO3 Scrim (Level 7-10)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-secondary border-border mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Match Format</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as MatchRequest['type'])}
                    className="w-full h-9 rounded-md border border-border bg-secondary text-sm px-3 mt-1"
                  >
                    <option value="gather_5v5">Gather 5v5 (Mix teams on stage)</option>
                    <option value="team_vs_team">Team vs Team (5-Stack Scrim)</option>
                    <option value="solo_lfg">Looking For Players (LFP)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Preferred Cabin</Label>
                  <select
                    value={preferredCabinId}
                    onChange={(e) => setPreferredCabinId(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-secondary text-sm px-3 mt-1"
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
                  <Label className="text-xs">Min FACEIT Level</Label>
                  <select
                    value={minLevel}
                    onChange={(e) => setMinLevel(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-border bg-secondary text-sm px-3 mt-1"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => (
                      <option key={l} value={l}>
                        Level {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Max FACEIT Level</Label>
                  <select
                    value={maxLevel}
                    onChange={(e) => setMaxLevel(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-border bg-secondary text-sm px-3 mt-1"
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
                <Label className="text-xs">Description / Rules</Label>
                <Input
                  placeholder="e.g. Warmup 15 mins then BO1 on Mirage. 128 tick LAN server."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-secondary border-border mt-1"
                />
              </div>

              {formError && <p className="text-xs text-destructive">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary text-black font-bold">
                  {isSubmitting ? 'Posting...' : 'Post Match'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Match Request Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMatches.map((match) => {
          const isFull = match.current_players_count >= match.target_players_count;
          const isCreator = match.creator_id === currentProfile.id;
          const alreadyJoined = match.roster.some(
            (p) => p.nickname.toLowerCase() === currentProfile.faceit_nickname.toLowerCase()
          );

          const isEligible =
            currentProfile.faceit_level >= match.min_faceit_level &&
            currentProfile.faceit_level <= match.max_faceit_level;

          return (
            <div
              key={match.id}
              className="glass-panel p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4 glass-panel-hover"
            >
              <div>
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 uppercase tracking-wider">
                      {match.type.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      LAN Match
                    </span>
                  </div>

                  <Badge
                    variant="outline"
                    className="text-xs font-semibold flex items-center gap-1 border-border bg-secondary/60"
                  >
                    FACEIT Lvl {match.min_faceit_level} - {match.max_faceit_level}
                  </Badge>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-black text-foreground mt-3 tracking-tight">{match.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{match.description || 'No extra notes provided.'}</p>

                {/* Creator & Cabin info */}
                <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Host:</span>
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span
                        className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${getLevelBadgeClass(
                          match.creator?.faceit_level || 3
                        )}`}
                      >
                        {match.creator?.faceit_level || 3}
                      </span>
                      {match.creator?.faceit_nickname || 'Player'}
                    </span>
                  </div>

                  {match.preferred_cabin && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary" />
                      {match.preferred_cabin.name.split(' - ')[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Player Count & Join Action */}
              <div className="pt-2 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden w-28">
                      <div
                        className="bg-primary h-full transition-all"
                        style={{
                          width: `${Math.min(100, (match.current_players_count / match.target_players_count) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {match.current_players_count}/{match.target_players_count} Players
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedMatchForRoster(match)}
                    className="text-xs text-muted-foreground hover:text-foreground h-7"
                  >
                    View Roster ({match.roster.length})
                  </Button>
                </div>

                {/* Join Feedback message */}
                {joinError && joinError.matchId === match.id && (
                  <div className="p-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{joinError.msg}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-1 flex gap-2">
                  {alreadyJoined ? (
                    <Button disabled size="sm" className="w-full bg-secondary text-muted-foreground text-xs">
                      <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Already in Roster
                    </Button>
                  ) : isFull ? (
                    <Button disabled size="sm" className="w-full bg-secondary text-muted-foreground text-xs">
                      Match Full
                    </Button>
                  ) : !isEligible ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      className="w-full border-destructive/40 text-destructive/80 text-xs"
                    >
                      Ineligible (Your Lvl {currentProfile.faceit_level} vs Req Lvl {match.min_faceit_level}-
                      {match.max_faceit_level})
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleJoin(match)}
                      disabled={joiningMatchId === match.id}
                      className="w-full bg-primary text-black font-bold hover:bg-orange-500 shadow-sm"
                    >
                      {joiningMatchId === match.id ? 'Joining...' : 'Join 5v5 Stack'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Roster Modal */}
      <Dialog open={!!selectedMatchForRoster} onOpenChange={(open) => !open && setSelectedMatchForRoster(null)}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {selectedMatchForRoster?.title} Roster
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Player Nickname</span>
              <span>FACEIT Rating</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedMatchForRoster?.roster.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-secondary/80 border border-border/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${getLevelBadgeClass(
                        p.level
                      )}`}
                    >
                      {p.level}
                    </span>
                    <div>
                      <span className="text-sm font-bold text-foreground">{p.nickname}</span>
                      {p.role && <span className="text-[10px] text-muted-foreground ml-2">({p.role})</span>}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{p.elo} Elo</span>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              {selectedMatchForRoster &&
                `${selectedMatchForRoster.roster.length} of ${selectedMatchForRoster.target_players_count} slots taken`}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
