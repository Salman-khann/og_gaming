import { connection } from 'next/server';
import { readArena } from '@/lib/data-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, ApiError, requireProfile, sameOrigin, integer, money, textField, jsonObject, uuidField } from '@/lib/api';
import {applicationInput,ownsApplication} from '@/lib/team-applications';
import {createClient} from '@/lib/supabase/server';
import {cookies} from 'next/headers';
import {newDeletionCredential} from '@/lib/match-ownership';
import { dispatchAfterResponse } from '@/lib/notifications';
import { rateLimit, rateLimitSubject } from '@/lib/rate-limit';
import { rejectBotField } from '@/lib/api-input';
const statuses = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];
function tournamentFields(body: Record<string, unknown>) {
  const min = integer(body.min_level, 1, 10), max = integer(body.max_level, min, 10);
  const start = new Date(String(body.start_date)).getTime(), deadline = new Date(String(body.registration_deadline)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(deadline) || deadline > start) throw new ApiError('Registration deadline must be on or before the start date.');
  if (!statuses.includes(String(body.status))) throw new ApiError('Invalid tournament status.');
  const title = textField(body.title, 'title', 120);
  const slug = textField(body.slug, 'slug', 140);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ApiError('Slug must contain lowercase letters, numbers, and hyphens.');
  const entryFee = money(body.entry_fee === undefined ? 0 : body.entry_fee);
  const bracketType = body.bracket_type || 'single';
  if (!['single','double'].includes(String(bracketType))) throw new ApiError('Invalid bracket type.');
  const checkinOpen = body.checkin_open ? new Date(String(body.checkin_open)).getTime() : start - 3600000;
  const checkinClose = body.checkin_close ? new Date(String(body.checkin_close)).getTime() : start;
  if (!Number.isFinite(checkinOpen) || !Number.isFinite(checkinClose) || checkinOpen >= checkinClose || checkinClose > start) throw new ApiError('Choose a check-in window that ends before the start.');
  return { title, slug, bracket_type:bracketType,checkin_open:new Date(checkinOpen).toISOString(),checkin_close:new Date(checkinClose).toISOString(), entry_fee: entryFee, payment_instructions: String(body.payment_instructions || '').slice(0, 2000), description: String(body.description || '').slice(0, 4000), game: textField(body.game, 'game', 80), format: textField(body.format, 'format', 100), min_level: min, max_level: max, max_teams: integer(body.max_teams, 2, 128), start_date: new Date(start).toISOString(), registration_deadline: new Date(deadline).toISOString(), status: body.status, prize_pool: String(body.prize_pool || '').slice(0, 200), rules: String(body.rules || '').slice(0, 8000) };
}
export async function GET(request:Request) {
  await connection();
  try { const params=new URL(request.url).searchParams,admin=params.get('admin')==='1';if(admin)await requireProfile(true);return Response.json(await readArena('tournaments',integer(params.get('page')||1,1,10000),integer(params.get('registration_page')||1,1,10000),admin), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await jsonObject(request);
    if(body.action==='checkin') {
      const session=await createClient();const {data:{user}}=await session.auth.getUser();if(user)await requireProfile();
      await rateLimit(request,'team-checkin',30,60,user?.id);
      const id=uuidField(body.registration_id,'registration');if(!await ownsApplication(id,user?.id))throw new ApiError('Only the team captain can check in.',403);
      const {error}=await createAdminClient().rpc('checkin_team_application',{entry_id:id});if(error)throw new ApiError(error.message,409);
      return Response.json({success:true});
    }
    if (body.action === 'create') {
      const {db}=await requireProfile(true);
      const { data: tournament, error } = await db.from('tournaments').insert(tournamentFields(body)).select().single();
      if (error) throw new ApiError('Unable to save tournament. Make sure the slug is unique.');
      return Response.json({ success: true, tournament }, { status: 201 });
    }
    rejectBotField(body);
    const {event,application}=applicationInput(body);
    const id=uuidField(event,'tournament'),session=await createClient();const {data:{user}}=await session.auth.getUser();if(user)await requireProfile();
    await rateLimit(request,'registration',5,300,user?.id);
    await rateLimitSubject('registration-phone',application.phone,5,3600);
    await rateLimitSubject('registration-email',application.email.toLowerCase(),5,3600);
    const credential=newDeletionCredential();
    const { data: registration, error } = await createAdminClient().rpc('submit_team_application',{actor_id:user?.id||null,event_id:id,application,credential_hash:credential.hash});
    if (error) throw new ApiError(error.code === '23505' ? 'This team or captain is already registered.' : error.message, 409);
    (await cookies()).set('og_entry_'+registration.id,credential.token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*90});
    dispatchAfterResponse();
    return Response.json({ success: true, registration }, { status: 201 });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireProfile(true);
    const body = await jsonObject(request);
    if (body.action === 'verify_payment') {
      const { error } = await createAdminClient().rpc('set_registration_payment', { registration_id: uuidField(body.registration_id, 'registration'), next_payment: body.verified === false ? 'pending' : 'verified' });
      if (error) throw new ApiError(error.message, 409);
    } else if (body.tournament_id) {
      const { error } = await db.from('tournaments').update({ ...tournamentFields(body), updated_at: new Date().toISOString() }).eq('id', uuidField(body.tournament_id, 'tournament')).select('id').single();
      if (error) throw new ApiError('Tournament could not be updated. Check its slug and team capacity.', 409);
    } else {
      const id = uuidField(body.registration_id, 'registration');
      if (body.action === 'toggle_checkin') {
        const { error } = await db.rpc('toggle_arena_checkin', { registration_id: id });
        if (error) throw new ApiError(error.message, 409);
      } else {
        if (!['approved', 'rejected'].includes(String(body.status))) throw new ApiError('Invalid registration status.');
        const { error } = await db.rpc('review_arena_registration', { registration_id: id, next_status: body.status });
        if (error) throw new ApiError(error.message, 409);
      }
    }
    dispatchAfterResponse();
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const { profile } = await requireProfile(true);
    const body = await jsonObject(request);
    const { error } = await createAdminClient().rpc('admin_delete_tournament', {
      actor_id: profile.id,
      event_id: uuidField(body.tournament_id, 'tournament'),
      confirmation_title: textField(body.confirmation_title, 'confirmation title', 120),
    });
    if (error) throw new ApiError(error.message, 409);
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
