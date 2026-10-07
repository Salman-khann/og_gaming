import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';

export async function GET() {
  const bookings = await DataService.getBookings();
  const cabins = await DataService.getCabins();
  return NextResponse.json({ bookings, cabins });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cabin_id, user_id, start_time, end_time, player_count, notes } = body;

    if (!cabin_id || !user_id || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }

    const result = await DataService.createSlotRequest({
      cabin_id,
      user_id,
      start_time,
      end_time,
      player_count: Number(player_count) || 5,
      notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, booking: result.booking });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process booking' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking_id, status, admin_notes } = body;

    if (!booking_id || !status) {
      return NextResponse.json({ error: 'Missing booking_id or status' }, { status: 400 });
    }

    const result = await DataService.updateBookingStatus(booking_id, status, admin_notes);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}
