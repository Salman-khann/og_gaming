import { randomUUID } from 'node:crypto';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ApiError,
  apiError,
  limitedFormData,
  integer,
  jsonObject,
  requireProfile,
  sameOrigin,
  uuidField,
  dbError,
} from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { SCORECARD_LIMIT } from '@/lib/scorecard-slots';
import { SCORECARD_BUCKET, SCORECARD_MAX_BYTES, scorecardImage } from '@/lib/scorecard-image';

const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  await connection();
  try {
    const id = uuidField(new URL(request.url).searchParams.get('match_id'), 'match');
    await rateLimit(request, 'scorecard-read', 60, 60);
    const db = await createClient();
    const { data: match, error } = await db
      .from('tournament_matches')
      .select('id,status,score_a,score_b,team_a,team_b')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ApiError('Unable to load this scorecard.', 503);
    if (!match || match.status !== 'completed')
      throw new ApiError('A scorecard is available after the match finishes.', 404);
    const admin = createAdminClient();
    const result = await admin
      .from('match_scorecards')
      .select('map_number,storage_path')
      .eq('match_id', id)
      .eq('score_a', match.score_a)
      .eq('score_b', match.score_b)
      .eq('team_a', match.team_a)
      .eq('team_b', match.team_b)
      .order('map_number');
    if (result.error) throw new ApiError('Unable to load match screenshots.', 503);
    const images = await Promise.all(
      (result.data || []).map(async (row) => {
        const signed = await admin.storage
          .from(SCORECARD_BUCKET)
          .createSignedUrl(row.storage_path, 300);
        if (signed.error || !signed.data)
          throw new ApiError('Unable to open a match screenshot.', 503);
        return { map_number: row.map_number, url: signed.data.signedUrl };
      }),
    );
    return Response.json({ images }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { profile } = await requireProfile(true);
    if (Number(request.headers.get('content-length')) > SCORECARD_MAX_BYTES + 65536)
      throw new ApiError('Choose an image smaller than 5 MB.', 413);
    const form = await limitedFormData(request, SCORECARD_MAX_BYTES + 65536);
    const id = uuidField(form.get('match_id'), 'match'),
      map = integer(form.get('map_number'), 1, SCORECARD_LIMIT),
      file = form.get('file');
    if (!(file instanceof File) || file.size > SCORECARD_MAX_BYTES)
      throw new ApiError('Choose an image smaller than 5 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let image;
    try {
      image = scorecardImage(bytes);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'Invalid screenshot.');
    }
    const admin = createAdminClient();
    const { data: match, error } = await admin
      .from('tournament_matches')
      .select('id,tournament_id,status,score_a,score_b')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ApiError('Unable to load this match.', 503);
    if (!match || match.status !== 'completed')
      throw new ApiError('Record the series result before uploading screenshots.', 409);
    const path = `${match.tournament_id}/${id}/${randomUUID()}.${image.extension}`;
    const uploaded = await admin.storage
      .from(SCORECARD_BUCKET)
      .upload(path, bytes, { contentType: image.type, upsert: false, cacheControl: '300' });
    if (uploaded.error)
      throw new ApiError('Unable to upload the screenshot. Please try again.', 503);
    const saved = await admin.rpc('save_match_scorecard', {
      game_id: id,
      map_no: map,
      object_path: path,
      expected_a: match.score_a,
      expected_b: match.score_b,
      actor_id: profile.id,
    });
    if (saved.error) {
      await admin.storage.from(SCORECARD_BUCKET).remove([path]);
      throw dbError(saved.error);
    }
    if (saved.data) await admin.storage.from(SCORECARD_BUCKET).remove([saved.data]);
    return Response.json({ success: true }, { headers });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const { profile } = await requireProfile(true);
    const body = await jsonObject(request),
      id = uuidField(body.match_id, 'match'),
      map = integer(body.map_number, 1, SCORECARD_LIMIT);
    const admin = createAdminClient();
    const { data: match, error } = await admin
      .from('tournament_matches')
      .select('score_a,score_b')
      .eq('id', id)
      .maybeSingle();
    if (error || !match) throw new ApiError('Match not found.', 404);
    const result = await admin.rpc('save_match_scorecard', {
      game_id: id,
      map_no: map,
      object_path: null,
      expected_a: match.score_a,
      expected_b: match.score_b,
      actor_id: profile.id,
    });
    if (result.error) throw dbError(result.error);
    if (result.data) await admin.storage.from(SCORECARD_BUCKET).remove([result.data]);
    return Response.json({ success: true }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
