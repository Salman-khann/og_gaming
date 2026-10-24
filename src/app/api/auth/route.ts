import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError, ApiError, sameOrigin, textField, jsonObject, profileColumns } from '@/lib/api';
import { cookies } from 'next/headers';
import { getSteamName } from '@/lib/steam-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, rateLimitSubject } from '@/lib/rate-limit';
import { rejectBotField } from '@/lib/api-input';
import { trustedClientAddress } from '@/lib/request-address';
export async function GET() {
  await connection();
  try {
    const jar = await cookies();
    const loginError = jar.get('og_login_error')?.value || '';
    jar.delete('og_login_error');
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return Response.json(
        { profile: null, loginError },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    const { data: profile, error } = await db
      .from('profiles')
      .select(profileColumns)
      .eq('id', user.id)
      .single();
    if (error) throw error;
    if (profile?.role !== 'banned')
      await createAdminClient()
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', user.id)
        .or(
          'last_active_at.is.null,last_active_at.lt.' + new Date(Date.now() - 900000).toISOString(),
        );
    if (profile && !profile.faceit_id && typeof user.app_metadata.steam_id === 'string') {
      const name = await getSteamName(user.app_metadata.steam_id);
      if (name && name !== profile.faceit_nickname) {
        const { error: updateError } = await createAdminClient()
          .from('profiles')
          .update({ faceit_nickname: name })
          .eq('id', user.id)
          .is('faceit_id', null);
        if (!updateError) profile.faceit_nickname = name;
      }
    }
    return Response.json(
      { profile: profile?.role === 'banned' ? null : profile },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await jsonObject(request);
    const db = await createClient();
    if (body.action === 'logout') {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      return Response.json({ success: true });
    }
    if (!['login', 'signup'].includes(String(body.action)))
      throw new ApiError('Invalid authentication action.');
    rejectBotField(body);
    const email = textField(body.email, 'email', 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ApiError('Enter a valid email address.');
    const password = body.password;
    if (typeof password !== 'string' || password.length < 8 || password.length > 128)
      throw new ApiError('Use a password with 8–128 characters.');
    await rateLimit(
      request,
      body.action === 'signup' ? 'signup' : 'password-login',
      body.action === 'signup' ? 10 : 30,
      body.action === 'signup' ? 3600 : 60,
    );
    const address = trustedClientAddress(request) || 'local-development';
    await rateLimitSubject(
      body.action === 'signup' ? 'signup-email-ip' : 'login-email-ip',
      JSON.stringify([address, email.toLowerCase()]),
      body.action === 'signup' ? 3 : 10,
      900,
    );
    if (body.action === 'signup') {
      const nickname = textField(body.nickname, 'player name', 40);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: { nickname },
          emailRedirectTo: new URL('/auth/callback', siteUrl).toString(),
        },
      });
      if (error && !['user_already_exists', 'email_exists'].includes(error.code || ''))
        throw new ApiError('Unable to create an account. Check the details and try again.');
      // Give the same response for existing and new email addresses.
      if (data.session) await db.auth.signOut({ scope: 'local' });
      return Response.json({ success: true, confirmationRequired: true });
    }
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error)
      throw new ApiError('Unable to log in. Check your credentials and confirm your email.', 401);
    const {
      data: { user },
    } = await db.auth.getUser();
    const { data: profile } = user
      ? await db.from('profiles').select('role').eq('id', user.id).single()
      : { data: null };
    if (!profile || profile.role === 'banned') {
      await db.auth.signOut();
      throw new ApiError('This account cannot log in.', 403);
    }
    return Response.json({
      success: true,
      redirectTo: profile?.role === 'admin' ? '/admin' : '/matches',
    });
  } catch (error) {
    return apiError(error);
  }
}
