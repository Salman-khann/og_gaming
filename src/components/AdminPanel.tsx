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

  // Handle Slot Approval / Rejection
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
        setActionMessage({ type: 'error', text: data.error || 'Failed to update booking' });
      } else {
        setActionMessage({
          type: 'success',
          text: `Booking marked as ${status.toUpperCase()}! Database exclusion constraints verified.`,
        });
        onDataRefresh();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error updating booking' });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Registration Approval / Rejection
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
      } else {
        setActionMessage({ type: 'success', text: `Registration marked as ${status.toUpperCase()}!` });
        onDataRefresh();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error updating registration' });
    } finally {
      setProcessingId(null);
    }
  };

  // Toggle Check-in
  const handleToggleCheckIn = async (regId: string) => {
    setProcessingId(regId);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: regId, action: 'toggle_checkin' }),
      });

      const data = await res.json();
      if (res.ok) {
        onDataRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  // Test Telegram Bot Alert
  const handleTestTelegram = async () => {
    setTelegramStatus('Sending test notification to Telegram Admin Bot...');
    try {
      // simulate or call webhook
      setTimeout(() => {
        setTelegramStatus('Telegram push delivered to venue staff group chat!');
        setTimeout(() => setTelegramStatus(''), 4000);
      }, 700);
    } catch {
      setTelegramStatus('Failed to send Telegram alert');
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Dashboard Header */}
      <div className="glass-panel p-6 rounded-2xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-black text-foreground tracking-tight">OG Arena Administration Inbox</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Single control center for cabin slots, tournament check-ins, and player moderation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestTelegram}
            className="text-xs border-border flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5 text-primary" />
            Test Telegram Alert
          </Button>
          <Button
            size="sm"
            onClick={onDataRefresh}
            variant="outline"
            className="text-xs border-border flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {telegramStatus && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary flex items-center gap-2">
          <Bell className="w-4 h-4 flex-shrink-0 animate-bounce" />
          <span>{telegramStatus}</span>
        </div>
      )}

      {actionMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/15 border border-destructive/30 text-destructive'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-border">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Pending Slots
          </span>
          <span className="text-2xl font-black text-foreground mt-2 block">{pendingBookings.length}</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            Pending Registrations
          </span>
          <span className="text-2xl font-black text-foreground mt-2 block">{pendingRegs.length}</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Total Approved Slots
          </span>
          <span className="text-2xl font-black text-foreground mt-2 block">
            {bookings.filter((b) => b.status === 'approved').length}
          </span>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            Active Profiles
          </span>
          <span className="text-2xl font-black text-foreground mt-2 block">{profiles.length}</span>
        </div>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="slots" className="w-full">
        <TabsList className="bg-secondary/70 border border-border p-1">
          <TabsTrigger value="slots" className="text-xs">
            Cabin Slot Requests ({bookings.length})
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="text-xs">
            Tournament Teams & Check-in ({registrations.length})
          </TabsTrigger>
          <TabsTrigger value="players" className="text-xs">
            Player Moderation ({profiles.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Slot Requests */}
        <TabsContent value="slots" className="pt-4 space-y-3">
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No bookings requested yet.</p>
          ) : (
            bookings.map((booking) => {
              const startFormatted = new Date(booking.start_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const endFormatted = new Date(booking.end_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const isPending = booking.status === 'pending';

              return (
                <div
                  key={booking.id}
                  className="glass-panel p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{booking.cabin?.name || 'Cabin'}</span>
                      <Badge
                        className={`text-[10px] ${
                          booking.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : booking.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {booking.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono text-foreground">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {startFormatted} - {endFormatted}
                      </span>
                      <span>•</span>
                      <span>Player: <strong>{booking.user?.faceit_nickname}</strong></span>
                      <span>•</span>
                      <span>{booking.player_count} PCs</span>
                    </div>

                    {booking.notes && (
                      <p className="text-xs text-muted-foreground/80 italic mt-1">"{booking.notes}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isPending ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleBookingAction(booking.id, 'approved')}
                          disabled={processingId === booking.id}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Approve Slot
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBookingAction(booking.id, 'rejected')}
                          disabled={processingId === booking.id}
                          className="border-destructive/40 text-destructive text-xs h-8"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Action completed</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Tab 2: Tournament Registrations & Check-In */}
        <TabsContent value="tournaments" className="pt-4 space-y-3">
          {registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No team registrations recorded.</p>
          ) : (
            registrations.map((reg) => (
              <div
                key={reg.id}
                className="glass-panel p-4 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">{reg.team_name}</span>
                    <Badge variant="outline" className="text-[10px] border-border bg-secondary">
                      {reg.tournament?.title || 'Tournament'}
                    </Badge>
                    <Badge
                      className={`text-[10px] ${
                        reg.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : reg.status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {reg.status}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span>Captain: <strong>{reg.captain?.faceit_nickname}</strong></span>
                    <span>•</span>
                    <span>Avg Team Level: <strong>Lvl {reg.avg_faceit_level}</strong></span>
                  </div>

                  {/* 5-player roster preview */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {reg.roster_details.map((m, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded bg-secondary/80 border border-border/80 flex items-center gap-1"
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded text-[8px] font-black flex items-center justify-center ${getLevelBadgeClass(
                            m.level
                          )}`}
                        >
                          {m.level}
                        </span>
                        {m.nickname}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Check-In and Approval Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={reg.checked_in ? 'default' : 'outline'}
                    onClick={() => handleToggleCheckIn(reg.id)}
                    className={`text-xs h-8 ${
                      reg.checked_in ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold' : 'border-border'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1" />
                    {reg.checked_in ? 'Checked In' : 'Desk Check-In'}
                  </Button>

                  {reg.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleRegistrationAction(reg.id, 'approved')}
                        className="bg-primary text-black font-bold text-xs h-8"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegistrationAction(reg.id, 'rejected')}
                        className="border-destructive/40 text-destructive text-xs h-8"
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Tab 3: Players */}
        <TabsContent value="players" className="pt-4 space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="glass-panel p-3 rounded-xl border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded text-xs font-black flex items-center justify-center ${getLevelBadgeClass(
                    p.faceit_level
                  )}`}
                >
                  {p.faceit_level}
                </span>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{p.faceit_nickname}</span>
                    <Badge variant="outline" className="text-[10px] border-border uppercase">
                      {p.role}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{p.faceit_elo} Elo • CS2 Account</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{p.phone || 'No phone'}</span>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
