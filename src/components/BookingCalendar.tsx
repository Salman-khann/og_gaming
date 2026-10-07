'use client';

import React, { useState } from 'react';
import { Cabin, SlotRequest, Profile } from '@/types';
import { Calendar as CalendarIcon, Clock, Users, ShieldAlert, CheckCircle2, AlertTriangle, Monitor, Sparkles, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

  const cabinBookings = bookings.filter((b) => b.cabin_id === selectedCabinId);

  const getSlotState = (hour: number) => {
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
          user_id: currentProfile.id,
          cabin_id: selectedCabin.id,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          player_count: playerCount,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to request slot');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Slot requested successfully! Awaiting admin confirmation.');
      onBookingCreated(data.booking);

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
    <div className="space-y-4">
      {/* Cabin Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cabins.map((cabin) => {
          const isSelected = cabin.id === selectedCabinId;
          const displayRate = cabin.name.toLowerCase().includes('ps5') ? '500 PKR' : '200 PKR';
          return (
            <div
              key={cabin.id}
              onClick={() => setSelectedCabinId(cabin.id)}
              className={`p-3.5 rounded-xl cursor-pointer transition-all border flex flex-col justify-between h-full min-h-[136px] ${
                isSelected
                  ? 'bg-[#1b140b] border-[var(--orange)] shadow-[0_0_16px_rgba(255,106,18,0.2)]'
                  : 'bg-[#151109] hover:bg-[#1a140b] border-[var(--line)] hover:border-[var(--orange)]/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-heading font-bold text-xs text-[var(--ink)] flex items-center gap-1.5 truncate">
                    <Monitor className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--orange)]' : 'text-[var(--ink-dim)]'}`} />
                    <span>{cabin.name.split(' - ')[0]}</span>
                  </span>
                  <span className="text-[10px] font-heading font-bold px-1.5 py-0.5 rounded bg-[#0b0a08] border border-[var(--line)] text-[var(--orange)] shrink-0">
                    {displayRate}/hr
                  </span>
                </div>

                <h4 className="font-heading font-semibold text-xs text-[var(--ink)] truncate">
                  {cabin.name.split(' - ')[1] || cabin.name}
                </h4>
                <p className="text-[11px] text-[var(--ink-dim)] mt-0.5 h-8 line-clamp-2 leading-tight">
                  {cabin.specs}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[var(--line)]/70 flex items-center justify-between text-[11px] text-[var(--ink-dim)]">
                <span className="flex items-center gap-1 font-heading text-[10px]">
                  <Users className="w-3 h-3 text-[var(--orange)]" />
                  {cabin.pc_count} Rigs
                </span>
                <span className={`text-[10px] font-heading font-bold ${isSelected ? 'text-[var(--orange)]' : 'text-[var(--ink-dim)]'}`}>
                  {isSelected ? 'Active' : 'Select'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Cabin Detail & Action Banner */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#151109] border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-heading font-black text-[var(--ink)] tracking-tight">{selectedCabin.name}</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-heading font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              LAN Ready
            </span>
          </div>
          <p className="text-xs text-[var(--ink-dim)] mt-0.5">
            Hardware: 240Hz MSI Rapid IPS, RTX 40-Series, Japanese Aqua Chairs &amp; Chilled AC
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2.5 text-xs bg-[#0b0a08] px-2.5 py-1 rounded-lg border border-[var(--line)] font-heading">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_#4ade80]"></span>
              <span className="text-[var(--ink-dim)] text-[11px]">Open</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
              <span className="text-[var(--ink-dim)] text-[11px]">Pending</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              <span className="text-[var(--ink-dim)] text-[11px]">Booked</span>
            </div>
          </div>

          <Button
            onClick={() => handleOpenBookingForHour(14)}
            className="bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black font-heading font-bold text-xs h-8 px-3.5 shadow-md shadow-[var(--orange)]/20 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 mr-1" />
            Request Slot
          </Button>
        </div>
      </div>

      {/* Interactive Visual Timeline Grid */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#151109] border border-[var(--line)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[var(--orange)]" />
            <span className="font-heading font-bold text-sm text-[var(--ink)]">Daily Availability Schedule (Bahadurabad Hall)</span>
          </div>
          <span className="text-[11px] text-[var(--ink-dim)] font-heading">Click open slot to book</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
          {HOURS.map((hour) => {
            const slot = getSlotState(hour);
            const isApproved = slot.status === 'approved';
            const isPending = slot.status === 'pending';
            const isFree = slot.status === 'free';

            let bgClass = 'bg-[#0b0a08] border-[var(--line)] hover:border-[var(--orange)] text-emerald-400 hover:bg-[#1a140b]';
            if (isApproved) {
              bgClass = 'bg-rose-950/20 border-rose-500/30 text-rose-300 cursor-not-allowed';
            } else if (isPending) {
              bgClass = 'bg-amber-950/20 border-amber-500/30 text-amber-300';
            }

            return (
              <div
                key={hour}
                onClick={() => isFree && handleOpenBookingForHour(hour)}
                className={`p-2 rounded-lg border transition-all text-center flex flex-col justify-between min-h-[58px] cursor-pointer ${bgClass}`}
              >
                <div className="text-xs font-heading font-bold text-[var(--ink)] tracking-wider">
                  {formatHour(hour)}
                </div>

                <div className="text-[10px] font-heading font-bold leading-none my-0.5">
                  {isFree && <span className="text-emerald-400">Open</span>}
                  {isPending && <span className="text-amber-400">Pending</span>}
                  {isApproved && <span className="text-rose-400">Booked</span>}
                </div>

                <div className="text-[9px] text-[var(--ink-dim)] font-heading truncate max-w-full">
                  {slot.booking ? `Team: ${slot.booking.notes || 'Reserved'}` : 'Available'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#151109] border-[var(--line)] text-[var(--ink)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-[var(--ink)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--orange)]" />
              <span>Reserve {selectedCabin.name}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitBooking} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Start Hour</Label>
                <select
                  value={formStartHour}
                  onChange={(e) => setFormStartHour(parseInt(e.target.value))}
                  className="w-full h-9 rounded-md border border-[var(--line)] bg-[#0b0a08] text-sm text-[var(--ink)] px-3 mt-1 font-heading"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">End Hour</Label>
                <select
                  value={formEndHour}
                  onChange={(e) => setFormEndHour(parseInt(e.target.value))}
                  className="w-full h-9 rounded-md border border-[var(--line)] bg-[#0b0a08] text-sm text-[var(--ink)] px-3 mt-1 font-heading"
                >
                  {HOURS.filter((h) => h > formStartHour).map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                  <option value={24}>24:00 (Midnight)</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Team / Player Count</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={playerCount}
                onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                className="bg-[#0b0a08] border-[var(--line)] mt-1 font-heading text-[var(--ink)]"
              />
            </div>

            <div>
              <Label className="text-xs font-heading text-[var(--ink-dim)] uppercase">Booking Notes / Team Tag</Label>
              <Input
                placeholder="e.g. Clan Practice, 5-Stack CS2 Premier"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-[#0b0a08] border-[var(--line)] mt-1 font-heading text-[var(--ink)]"
              />
            </div>

            {hasConflict && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Selected hours collide with an already confirmed booking.</span>
              </div>
            )}

            {errorMessage && <p className="text-xs text-rose-400">{errorMessage}</p>}
            {successMessage && <p className="text-xs text-emerald-400">{successMessage}</p>}

            <div className="pt-2 flex gap-3">
              <Button
                type="submit"
                disabled={isSubmitting || hasConflict}
                className="flex-1 bg-[var(--orange)] hover:bg-[var(--orange-soft)] text-black font-heading font-bold"
              >
                {isSubmitting ? 'Requesting...' : 'Confirm Slot Request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
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
