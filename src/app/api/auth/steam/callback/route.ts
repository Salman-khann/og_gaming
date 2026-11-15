import {
  consumeSteamState,
  siteOrigin,
  signInSteamIdentity,
  loginFailure,
  LoginError,
} from '@/lib/provider-auth';
import { STEAM_ENDPOINT, steamAssertion, steamVerificationIsValid } from '@/lib/steam-openid';
import { createClient } from '@/lib/supabase/server';
import { reportServerError } from '@/lib/diagnostics';
import { connection } from 'next/server';
export async function GET(request: Request) {
  await connection();
  try {
    const params = new URL(request.url).searchParams;
    const state = params.get('state');
    await consumeSteamState(state);
    const callback = new URL('/api/auth/steam/callback', siteOrigin(request));
    callback.searchParams.set('state', state!);
    let assertion;
    try {
      assertion = steamAssertion(params, callback.toString());
    } catch {
      throw new LoginError('Steam login could not be verified. Please try again.');
    }
    const verified = await fetch(STEAM_ENDPOINT, {
      method: 'POST',
      body: assertion.body,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!verified.ok || !steamVerificationIsValid(await verified.text()))
      throw new LoginError('Steam login could not be verified.');
    await signInSteamIdentity(assertion.steamId);
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    const { data: profile } = user
      ? await db.from('profiles').select('role').eq('id', user.id).single()
      : { data: null };
    return Response.redirect(
      new URL(profile?.role === 'admin' ? '/admin' : '/matches', siteOrigin(request)),
      303,
    );
  } catch (error) {
    if (!(error instanceof LoginError)) reportServerError(error);
    return loginFailure(
      request,
      error instanceof LoginError ? error.message : 'Steam login failed. Please try again.',
    );
  }
}
