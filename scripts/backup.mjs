import { spawn, spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupKey, encryptBackup, verifyBackup, exportBackup } from './lib/backup-crypto.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of ['.env.local', '.env.backup.local']) if (existsSync(resolve(root, file))) process.loadEnvFile(resolve(root, file));

function externalPath(value) {
  if (!value || !isAbsolute(value)) throw new Error('Use an absolute path outside the website checkout.');
  const path = resolve(value), actual = existsSync(path) ? realpathSync(path) : path, rel = relative(realpathSync(root), actual);
  if (!rel || (!rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(rel))) throw new Error('Private backups must stay outside the website checkout.');
  return path;
}

const command = process.argv[2];
try {
  if (!command || command === '--help') {
    console.log('Commands: create | verify <archive> | export <archive> <private-output.dump>\nConfigure .env.backup.local using docs/SECURITY_AND_RECOVERY.md. Export never restores a database.');
  } else {
    const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
    if (command === 'create') {
      const directory = externalPath(process.env.BACKUP_DIRECTORY);
      let url;
      try { url = new URL(process.env.BACKUP_DATABASE_URL); } catch { throw new Error('Configure BACKUP_DATABASE_URL in private recovery settings.'); }
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password) throw new Error('Use a PostgreSQL database connection with credentials.');
      const pgDump = process.env.PG_DUMP_PATH || 'pg_dump';
      if (spawnSync(pgDump, ['--version'], { stdio: 'ignore', windowsHide: true }).status !== 0) throw new Error('Install a compatible PostgreSQL client and set PG_DUMP_PATH if it is not on PATH.');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      externalPath(realpathSync(directory));
      const file = resolve(directory, 'og-gaming-' + new Date().toISOString().replace(/[:.]/g, '-') + '.ogbackup');
      const child = spawn(pgDump, ['--format=custom', '--no-owner', '--no-password'], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'verify-full', PGCONNECT_TIMEOUT: '15' },
      });
      const exit = new Promise(resolveExit => { child.once('error', () => resolveExit(1)); child.once('close', code => resolveExit(code)); });
      let written = false;
      try {
        await encryptBackup(child.stdout, file, key);
        written = true;
        if (await exit !== 0) throw new Error('Database export failed. Check the backup connection, TLS root certificate and PostgreSQL client version.');
        const result = await verifyBackup(file, key);
        console.log('Encrypted backup created and authenticated:', file, '(' + result.bytes + ' database bytes)');
      } catch (error) { child.kill(); if (written) await unlink(file).catch(() => {}); throw error; }
    } else if (command === 'verify') {
      const result = await verifyBackup(externalPath(process.argv[3]), key);
      console.log('Backup authentication and PostgreSQL archive header passed:', result.bytes, 'bytes. A separate restore drill is still required.');
    } else if (command === 'export') {
      const file = externalPath(process.argv[3]), output = externalPath(process.argv[4]);
      if (!output.endsWith('.dump') || !existsSync(dirname(output))) throw new Error('Choose an existing private directory and a new .dump filename.');
      externalPath(realpathSync(dirname(output)));
      await exportBackup(file, output, key);
      console.log('Private recovery archive exported:', output, '\nThis plaintext file contains sensitive database data. Restore only to an isolated recovery database.');
    } else throw new Error('Unknown backup command. Use --help.');
  }
} catch (error) {
  // Never log database driver output or a connection string.
  const allowed = /^(Set BACKUP_|Invalid backup|Invalid backup encryption|Unrecognized backup|The decrypted|Use an absolute|Private backups|Configure BACKUP_|Install a compatible|Use a PostgreSQL|Database export failed|Choose an existing|Unknown backup)/;
  console.error(error instanceof Error && allowed.test(error.message) ? error.message : 'Backup operation failed. Check the file, encryption key and private recovery configuration.');
  process.exitCode = 1;
}
