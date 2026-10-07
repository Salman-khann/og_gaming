'use client';

import React, { useState } from 'react';
import { SlotRequest, Registration, Profile, Cabin, Tournament } from '@/types';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  UserX,
  Send,
  Calendar,
  Trophy,
  Users,
  Bell,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AdminPanelProps {
  bookings: SlotRequest[];
  registrations: Registration[];
  tournaments: Tournament[];
  cabins: Cabin[];
  profiles: Profile[];
  onDataRefresh: () => void;
}

export function AdminPanel({
  bookings,
  registrations,
  tournaments,
  cabins,
  profiles,
  onDataRefresh,
}: AdminPanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<string>('');

  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const pendingRegs = registrations.filter((r) => r.status === 'pending');

  const getLevelBadgeClass = (lvl: number) => `badge-lvl-${lvl}`;

  const handleBookingAction = async (bookingId: string, status: 'approved' | 'rejected') => {
    setProcessingId(bookingId);
    setActionMessage(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, status }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: 'error', text: data.error || 'Failed to update slot status' });
        setProcessingId(null);
        return;
      }

      setActionMessage({
        type: 'success',
        text: `Slot #${bookingId.slice(0, 6)} has been ${status.toUpperCase()}!`,
      });
      onDataRefresh();
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error updating slot' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRegistrationAction = async (regId: string, status: 'approved' | 'rejected') => {
    setProcessingId(regId);
    setActionMessage(null);

    try {
      const res = await fetch('/api/tournaments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: regId, status }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: 'error', text: data.error || 'Failed to update registration' });
        setProcessingId(null);
        return;
      }

      setActionMessage({
        type: 'success',
        text: `Team registration #${regId.slice(0, 6)} has been ${status.toUpperCase()}!`,
      });
      onDataRefresh();
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error updating registration' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Controls Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#151109] border border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--orange)]" />
            <h3 className="text-xl font-heading font-bold text-[var(--ink)]">OG Arena Admin Center</h3>
          </div>
          <p className="text-xs text-[var(--ink-dim)] mt-1">
            Manage stage slots, approve team rosters, and broadcast tournament alerts for Bahadurabad Hall.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDataRefresh}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--line)] hover:border-[var(--orange)] text-xs text-[var(--ink)] font-heading flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--orange)]" />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-heading font-bold flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-950/30 text-rose-400 border border-rose-500/30'
          }`}
        >
          {actionMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="bookings" className="w-full space-y-4">
        <TabsList className="bg-[#151109] border border-[var(--line)] p-1 rounded-lg">
          <TabsTrigger
            value="bookings"
            className="text-xs font-heading font-bold data-[state=active]:bg-[var(--orange)] data-[state=active]:text-black text-[var(--ink-dim)]"
          >
            Pending Slots ({pendingBookings.length})
          </TabsTrigger>
          <TabsTrigger
            value="registrations"
            className="text-xs font-heading font-bold data-[state=active]:bg-[var(--orange)] data-[state=active]:text-black text-[var(--ink-dim)]"
          >
            Tournament Teams ({pendingRegs.length})
          </TabsTrigger>
          <TabsTrigger
            value="all_bookings"
            className="text-xs font-heading font-bold data-[state=active]:bg-[var(--orange)] data-[state=active]:text-black text-[var(--ink-dim)]"
          >
            All Bookings ({bookings.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Bookings */}
        <TabsContent value="bookings" className="space-y-3">
          {pendingBookings.length === 0 ? (
            <div className="p-12 rounded-xl bg-[#151109] border border-[var(--line)] text-center text-xs text-[var(--ink-dim)] font-heading">
              No pending slot reservations at this moment.
            </div>
          ) : (
            pendingBookings.map((b) => {
              const cabin = cabins.find((c) => c.id === b.cabin_id);
              const user = profiles.find((p) => p.id === b.user_id);
              const startH = new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const endH = new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={b.id}
                  className="p-5 rounded-xl bg-[#151109] border border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-heading font-bold text-[var(--orange)]">
                        {cabin?.name || 'Cabin Slot'}
                      </span>
                      <span className="text-xs text-[var(--ink-dim)] font-heading">
                        • {startH} - {endH}
                      </span>
                    </div>

                    <div className="text-sm font-heading font-bold text-[var(--ink)]">
                      Requester: {user?.faceit_nickname || b.user_id} ({b.player_count} Players)
                    </div>
                    {b.notes && <p className="text-xs text-[var(--ink-dim)] mt-0.5">Notes: {b.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBookingAction(b.id, 'approved')}
                      disabled={processingId === b.id}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-heading font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleBookingAction(b.id, 'rejected')}
                      disabled={processingId === b.id}
                      className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-heading font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Tab 2: Tournament Registrations */}
        <TabsContent value="registrations" className="space-y-3">
          {pendingRegs.length === 0 ? (
            <div className="p-12 rounded-xl bg-[#151109] border border-[var(--line)] text-center text-xs text-[var(--ink-dim)] font-heading">
              No pending team tournament registrations.
            </div>
          ) : (
            pendingRegs.map((r) => {
              const tourney = tournaments.find((t) => t.id === r.tournament_id);
              const captain = profiles.find((p) => p.id === r.captain_id);

              return (
                <div
                  key={r.id}
                  className="p-5 rounded-xl bg-[#151109] border border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-heading font-bold text-[var(--orange)]">
                        {tourney?.title || 'Tournament'}
                      </span>
                      <span className="text-xs text-amber-400 font-heading">Pending Review</span>
                    </div>

                    <div className="text-base font-heading font-bold text-[var(--ink)]">
                      Team: {r.team_name}
                    </div>
                    <div className="text-xs text-[var(--ink-dim)] font-heading mt-1">
                      Captain: {captain?.faceit_nickname || r.captain_id} • 5-Player Verified Roster
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRegistrationAction(r.id, 'approved')}
                      disabled={processingId === r.id}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-heading font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve Roster</span>
                    </button>
                    <button
                      onClick={() => handleRegistrationAction(r.id, 'rejected')}
                      disabled={processingId === r.id}
                      className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-heading font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Tab 3: All Bookings History */}
        <TabsContent value="all_bookings" className="space-y-2">
          {bookings.map((b) => {
            const cabin = cabins.find((c) => c.id === b.cabin_id);
            const startH = new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endH = new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={b.id}
                className="p-3.5 rounded-lg bg-[#0b0a08] border border-[var(--line)] flex items-center justify-between text-xs font-heading"
              >
                <div>
                  <span className="font-bold text-[var(--ink)]">{cabin?.name.split(' - ')[0] || 'Cabin'}</span>
                  <span className="text-[var(--ink-dim)] ml-2">
                    {startH} - {endH}
                  </span>
                  {b.notes && <span className="text-[var(--ink-dim)] ml-2">({b.notes})</span>}
                </div>

                <div>
                  {b.status === 'approved' && <span className="text-emerald-400 font-bold">Approved</span>}
                  {b.status === 'pending' && <span className="text-amber-400 font-bold">Pending</span>}
                  {b.status === 'rejected' && <span className="text-rose-400 font-bold">Rejected</span>}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
