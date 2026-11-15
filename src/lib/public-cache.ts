export function publicCacheHeaders(request: Request) {
  return {
    'Cache-Control':
      request.headers.has('cookie') || request.headers.has('authorization')
        ? 'private, no-store'
        : 'public, s-maxage=30, stale-while-revalidate=120',
    Vary: 'Cookie, Authorization',
  };
}
