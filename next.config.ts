import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.OG_BROWSER_TEST === '1' ? '.next-browser-test' : '.next',
  experimental: {
    agentUpgrade: 'security',
  },
  allowedDevOrigins: [
    '192.168.18.125',
  ],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
      { key: 'Content-Security-Policy-Report-Only', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com; frame-src https://www.youtube-nocookie.com https://www.youtube.com https://www.google.com https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        // Preserve CSS Modules and their exported class names. The loader's
        // `as` rename would otherwise turn .module.css into global .css.css.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
