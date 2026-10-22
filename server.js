/* cPanel/Passenger startup file. Next.js does not compile this CommonJS entry. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('node:http');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

async function startServer() {
  process.env.NODE_ENV = 'production';
  const infoFile = join(__dirname, 'deployment-info.json');
  const info = existsSync(infoFile) ? JSON.parse(readFileSync(infoFile, 'utf8')) : null;
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || info?.origin || 'https://oggaming.pk');
  if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Configure the HTTPS site origin.');
  if (info && info.origin !== origin.origin) throw new Error('The configured domain differs from the build. Rebuild for the new domain.');
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid application port.');
  const passenger = globalThis.PhusionPassenger;
  if (passenger) passenger.configure({ autoInstall: false });
  const next = require('next');
  // Public host/port keep Next's request origin correct behind HTTPS Passenger.
  const app = next({ dev: false, dir: __dirname, hostname: origin.hostname, port: Number(origin.port || (origin.protocol === 'https:' ? 443 : 80)) });
  const handle = app.getRequestHandler();
  await app.prepare();
  const server = createServer(async (req, res) => {
    if ((req.headers.host || '').toLowerCase() !== origin.host.toLowerCase()) {
      res.writeHead(421, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      res.end('Use the configured website domain.'); return;
    }
    // The canonical origin is server configuration, never an incoming header.
    req.headers['x-forwarded-proto'] = origin.protocol.slice(0, -1);
    try { await handle(req, res); }
    catch {
      console.error('Application request failed.');
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      res.end('Unable to complete this request.');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', resolve);
    if (passenger) server.listen('passenger');
    else server.listen(port, process.env.OG_BIND_HOST || '127.0.0.1');
  });
  console.log('OG Gaming ready.');
  const stop = () => {
    server.close(() => { Promise.resolve(app.close()).finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  return server;
}

// LiteSpeed and Passenger load the startup file with require(), rather than
// executing it as the main module. Start in both hosting loaders as well.
if (require.main === module || process.env.LSNODE_ROOT || globalThis.PhusionPassenger) startServer().catch(() => { console.error('Application startup failed. Check domain, dependencies and production build.'); process.exitCode = 1; });
module.exports = { startServer };
