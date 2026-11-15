import { apiError, ApiError, jsonObject } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
function origin(value: unknown) {
  if (typeof value !== 'string') return 'unknown';
  if (value === 'inline' || value === 'eval') return value;
  try {
    return new URL(value).origin;
  } catch {
    return 'unknown';
  }
}
export async function POST(request: Request) {
  try {
    // Browser-generated reports are untrusted telemetry, not cookie-authenticated
    // mutations. Bound their size and frequency without requiring an Origin.
    await rateLimit(request, 'csp-report', 60, 60);
    const body = await jsonObject(request, 8192);
    const report = body['csp-report'];
    if (!report || typeof report !== 'object' || Array.isArray(report))
      throw new ApiError('Invalid CSP report.');
    const data = report as Record<string, unknown>;
    const documentOrigin = origin(data['document-uri']);
    if (documentOrigin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin)
      throw new ApiError('Invalid CSP report.');
    const directive = String(data['effective-directive'] || data['violated-directive'] || '').split(
      /[\s;]/,
    )[0];
    if (!/^[a-z-]{1,80}$/.test(directive)) throw new ApiError('Invalid CSP report.');
    console.warn(
      'CSP violation:',
      JSON.stringify({ documentOrigin, directive, blockedOrigin: origin(data['blocked-uri']) }),
    );
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
