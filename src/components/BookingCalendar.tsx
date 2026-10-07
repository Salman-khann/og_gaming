'use client';

import React, { useState } from 'react';
import { Cabin, SlotRequest, Profile } from '@/types';
import { Calendar as CalendarIcon, Clock, Users, ShieldAlert, CheckCircle2, AlertTriangle, Monitor, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface BookingCalendarProps {
  cabins: Cabin[];
  bookings: SlotRequest[];
  currentProfile: Profile;
  onBookingCreated: (booking: SlotRequest) => void;
}

const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

export function BookingCalendar({ cabins, bookings, currentProfile, onBookingCreated }: BookingCalendarProps) {
  const [selectedCabinId, setSelectedCabinId] = useState<string>(cabins[0]?.id || 'cabin-1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Booking Form State
  const [formStartHour, setFormStartHour] = useState(14);
  const [formEndHour, setFormEndHour] = useState(17);
  const [playerCount, setPlayerCount] = useState(5);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedCabin = cabins.find((c) => c.id === selectedCabinId) || cabins[0];

  // Helper to format hour string e.g. "14:00"
  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

  // Get bookings for the selected cabin
  const cabinBookings = bookings.filter((b) => b.cabin_id === selectedCabinId);

  // Check slot state for a specific hour
  const getSlotState = (hour: number) => {
    // Current date normalized
    const now = new Date();
    const slotTime = new Date();
    slotTime.setHours(hour, 0, 0, 0);

    for (const b of cabinBookings) {
      const start = new Date(b.start_time).getHours();
      const end = new Date(b.end_time).getHours();
      if (hour >= start && hour < end) {
        return {
          status: b.status,
          booking: b,
        };
      }
    }
    return { status: 'free', booking: null };
  };

  // Check if form hours have conflict with approved slots
  const checkFormConflict = (startH: number, endH: number) => {
    return cabinBookings.some((b) => {
      if (b.status !== 'approved') return false;
      const bStart = new Date(b.start_time).getHours();
      const bEnd = new Date(b.end_time).getHours();
      return startH < bEnd && endH > bStart;
    });
  };

  const hasConflict = checkFormConflict(formStartHour, formEndHour);

  const handleOpenBookingForHour = (hour: number) => {
    setFormStartHour(hour);
    setFormEndHour(Math.min(24, hour + 3));
    setErrorMessage('');
    setSuccessMessage('');
    setIsModalOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formEndHour <= formStartHour) {
      setErrorMessage('End time must be after start time');
      return;
    }

    if (hasConflict) {
      setErrorMessage('Collision: Another approved team is already booked for this slot!');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setHours(formStartHour, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setHours(formEndHour, 0, 0, 0);

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cabin_id: selectedCabin.id,
          user_id: currentProfile.id,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          player_count: playerCount,
          notes: notes || `CS2 Scrim by ${currentProfile.faceit_nickname}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to submit booking');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Booking request submitted! Admin has received an alert.');
      if (data.booking) {
        onBookingCreated(data.booking);
      }
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMessage('');
        setNotes('');
      }, 1200);
    } catch (err) {
      setErrorMessage('Network error during booking submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabin Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cabins.map((cabin) => {
          const isSelected = cabin.id === selectedCabinId;
          return (
            <div
              key={cabin.id}
              onClick={() => setSelectedCabinId(cabin.id)}
              className={`p-4 rounded-xl cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-secondary/90 border-primary shadow-lg shadow-primary/10 glow-orange'
                  : 'bg-card/60 hover:bg-card border-border hover:border-border/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Monitor className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  {cabin.name.split(' - ')[0]}
                </span>
                <Badge variant="outline" className="text-[10px] bg-background/50 border-border text-foreground">
                  ${cabin.hourly_rate}/hr
                </Badge>
              </div>

              <h4 className="font-semibold text-xs text-foreground/90 line-clamp-1">
                {cabin.name.split(' - ')[1] || cabin.name}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{cabin.specs}</p>

              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {cabin.pc_count} High-End Rigs
                </span>
                <span className={`text-[10px] font-bold ${isSelected ? 'text-primary' : ''}`}>
                  {isSelected ? 'Viewing' : 'Select'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Cabin Detail & Action Banner */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-foreground tracking-tight">{selectedCabin.name}</h3>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
              LAN Ready
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span>Hardware: {selectedCabin.specs}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs bg-secondary/80 px-3 py-1.5 rounded-lg border border-border">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-muted-foreground">Open</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span className="text-muted-foreground">Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              <span className="text-muted-foreground">Reserved</span>
            </div>
          </div>

          <Button
            onClick={() => handleOpenBookingForHour(14)}
            className="bg-primary text-black font-bold hover:bg-orange-500 shadow-md shadow-primary/20"
          >
            <Clock className="w-4 h-4 mr-1.5" />
            Request Slot
          </Button>
        </div>
      </div>

      {/* Interactive Visual Timeline (10:00 - 24:00) */}
      <div className="glass-panel p-6 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-foreground">Today's Schedule & Availability Grid</span>
          </div>
          <span className="text-xs text-muted-foreground">Click any free slot to reserve</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-2">
          {HOURS.map((hour) => {
            const slot = getSlotState(hour);
            const isApproved = slot.status === 'approved';
            const isPending = slot.status === 'pending';
            const isFree = slot.status === 'free';

            let bgClass = 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500 text-emerald-400';
            if (isApproved) {
              bgClass = 'bg-rose-950/30 border-rose-500/40 text-rose-300 cursor-not-allowed';
            } else if (isPending) {
              bgClass = 'bg-amber-950/30 border-amber-500/40 text-amber-300';
            }

            return (
              <div
                key={hour}
                onClick={() => {
                  if (isFree) handleOpenBookingForHour(hour);
                }}
                className={`p-3 rounded-xl border text-center transition-all ${bgClass} ${
                  isFree ? 'cursor-pointer hover:scale-[1.02]' : ''
                }`}
              >
                <div className="text-xs font-mono font-bold text-foreground">
                  {formatHour(hour)} - {formatHour(hour + 1)}
                </div>

                <div className="mt-2 text-[11px] font-semibold flex items-center justify-center gap-1">
                  {isFree && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Available
                    </span>
                  )}
                  {isPending && (
                    <span className="text-amber-400 flex items-center gap-1 truncate" title={slot.booking?.user?.faceit_nickname}>
                      <Clock className="w-3 h-3" />
                      Pending Review
                    </span>
                  )}
                  {isApproved && (
                    <span className="text-rose-400 flex items-center gap-1 truncate font-bold" title={slot.booking?.user?.faceit_nickname}>
                      <ShieldAlert className="w-3 h-3" />
                      Reserved
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Database Exclusion Constraint Guarantee Banner */}
        <div className="mt-4 p-3 rounded-xl bg-secondary/50 border border-border/80 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              <strong>Zero Double-Booking Guarantee:</strong> Protected at the database level by PostgreSQL{' '}
              <code className="text-orange-400 bg-black/40 px-1 py-0.5 rounded font-mono">
                EXCLUDE USING gist (cabin_id, tstzrange)
              </code>
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground hidden lg:inline">Instant Telegram admin alerts on booking</span>
        </div>
      </div>

      {/* Booking Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Book Slot: {selectedCabin.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitBooking} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Time (24h)</Label>
                <select
                  value={formStartHour}
                  onChange={(e) => setFormStartHour(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-border bg-secondary text-sm px-3 mt-1.5"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">End Time (24h)</Label>
                <select
                  value={formEndHour}
                  onChange={(e) => setFormEndHour(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-border bg-secondary text-sm px-3 mt-1.5"
                >
                  {HOURS.concat(24).map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Number of Players / PCs</Label>
              <select
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-border bg-secondary text-sm px-3 mt-1.5"
              >
                <option value={5}>Full 5-Stack (5 PCs)</option>
                <option value={4}>4 Players</option>
                <option value={3}>3 Players</option>
                <option value={2}>Duo (2 PCs)</option>
                <option value={1}>Solo Rig (1 PC)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs">Notes / Match Purpose</Label>
              <Input
                placeholder="e.g. Scrim vs Team Nemesis / Practice session"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-secondary border-border mt-1.5 text-sm"
              />
            </div>

            {/* Live Conflict Warning */}
            {hasConflict && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/40 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Overlapping Booking Conflict!</strong> Another approved team is already booked within this
                  window. Please adjust start or end hours.
                </span>
              </div>
            )}

            {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
            {successMessage && <p className="text-xs text-emerald-400 font-bold">{successMessage}</p>}

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Total Est: ${((formEndHour - formStartHour) * selectedCabin.hourly_rate).toFixed(2)}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || hasConflict || formEndHour <= formStartHour}
                  className="bg-primary text-black font-bold hover:bg-orange-500"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Request'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
