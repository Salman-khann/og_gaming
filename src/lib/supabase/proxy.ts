import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  if (!request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name)))
    return response;

  const privateResponse = () => {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  };
  privateResponse();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, cacheHeaders) {
          const previous = response.cookies.getAll();
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          previous.forEach((cookie) => response.cookies.set(cookie));
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(cacheHeaders).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
          privateResponse();
        },
      },
    },
  );
  try {
    // Refresh before Server Components run, so a rotated token reaches both
    // their request and the browser. Routes still verify the user/permissions.
    await db.auth.getClaims();
  } catch {
    // A temporary Auth outage must not redirect or sign out a valid session.
    // Protected routes independently verify access and return an error if needed.
  }
  return response;
}
