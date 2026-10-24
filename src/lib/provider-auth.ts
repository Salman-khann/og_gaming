import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { createAdminClient } from './supabase/admin';
import { createClient } from './supabase/server';
import { getSteamName } from './steam-profile';

export function siteOrigin(request: Request) {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
}

export async function loginFailure(request: Request, message: string) {
  const jar = await cookies();
  jar.set('og_login_error', message, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 120,
  });
  return Response.redirect(new URL('/login', siteOrigin(request)), 303);
}

export async function startSteamState() {
  const state = randomBytes(32).toString('hex');
  (await cookies()).set('og_steam_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/steam',
    maxAge: 300,
  });
  return state;
}

export async function consumeSteamState(state: string | null) {
  const jar = await cookies();
  const expected = jar.get('og_steam_state')?.value;
  jar.set('og_steam_state', '', { path: '/api/auth/steam', maxAge: 0 });
  if (
    !state ||
    !expected ||
    !/^[a-f0-9]{64}$/.test(state) ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(expected))
  )
    throw new Error('Steam login expired. Please try again.');
}

export async function signInSteamIdentity(steamId: string) {
  const steamName = await getSteamName(steamId);
  const admin = createAdminClient();
  const lookup = () =>
    admin.from('steam_identities').select('user_id').eq('steam_id', steamId).maybeSingle();
  const initial = await lookup();
  let identity = initial.data;
  const error = initial.error;
  if (error) throw new Error('Steam login needs the database setup.');
  if (!identity) {
    const { data, error: createError } = await admin.auth.admin.createUser({
      email: randomUUID() + '@steam.og-gaming.invalid',
      email_confirm: true,
      app_metadata: { steam_id: steamId },
      user_metadata: { nickname: steamName || 'Steam player' },
    });
    if (createError || !data.user) throw new Error('Unable to create your Steam account.');
    const inserted = await admin
      .from('steam_identities')
      .insert({ steam_id: steamId, user_id: data.user.id });
    if (inserted.error) {
      // A concurrent first login may have created the mapping already.
      await admin.auth.admin.deleteUser(data.user.id);
      const winner = await lookup();
      if (inserted.error.code !== '23505' || winner.error || !winner.data)
        throw new Error('Unable to link your Steam account.');
      identity = winner.data;
    } else identity = { user_id: data.user.id };
  }
  const {
    data: { user },
    error: userError,
  } = await admin.auth.admin.getUserById(identity.user_id);
  if (userError || !user?.email || user.app_metadata.steam_id !== steamId)
    throw new Error('Unable to verify your Steam account.');
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || profile.role === 'banned') throw new Error('This account cannot log in.');
  if (steamName)
    await admin
      .from('profiles')
      .update({ faceit_nickname: steamName })
      .eq('id', user.id)
      .is('faceit_id', null);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  if (linkError || !link.properties?.hashed_token) throw new Error('Unable to start your session.');
  const db = await createClient();
  const { error: sessionError } = await db.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (sessionError) throw new Error('Unable to start your session.');
}
