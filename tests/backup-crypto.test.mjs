import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { backupKey, encryptBackup, verifyBackup, exportBackup } from '../scripts/lib/backup-crypto.mjs';
const directory = await mkdtemp(join(tmpdir(), 'og-recovery-test-'));
try {
  const key = backupKey(randomBytes(32).toString('base64'));
  assert.throws(() => backupKey('short'));
  const dump = Buffer.concat([Buffer.from('PGDMP'), randomBytes(100000)]);
  const file = join(directory, 'valid.ogbackup');
  await encryptBackup(Readable.from([dump.subarray(0, 2), dump.subarray(2)]), file, key);
  assert.deepEqual(await verifyBackup(file, key), { bytes: dump.length });
  const encrypted = await readFile(file);
  assert.equal(encrypted.includes(dump.subarray(100, 150)), false, 'disk archive is encrypted');
  await assert.rejects(verifyBackup(file, randomBytes(32)), 'wrong keys cannot authenticate');
  for (const index of [1, 40, encrypted.length - 1]) {
    const damaged = Buffer.from(encrypted); damaged[index] ^= 1;
    const path = join(directory, 'tampered-' + index + '.ogbackup');
    await writeFile(path, damaged);
    await assert.rejects(verifyBackup(path, key));
    await assert.rejects(exportBackup(path, join(directory, 'must-not-exist.dump'), key));
  }
  assert.ok(!(await readdir(directory)).includes('must-not-exist.dump'));
  await assert.rejects(encryptBackup(Readable.from([dump]), file, key), 'existing archives are never overwritten');
  assert.deepEqual(await readFile(file), encrypted, 'existing archives are never deleted on failure');
  const output = join(directory, 'recovered.dump');
  await exportBackup(file, output, key);
  assert.deepEqual(await readFile(output), dump);
  await assert.rejects(exportBackup(file, output, key));
  assert.deepEqual(await readFile(output), dump, 'existing recovery output is preserved');
  const invalid = join(directory, 'not-postgres.ogbackup');
  await encryptBackup(Readable.from([Buffer.from('not a database')]), invalid, key);
  await assert.rejects(verifyBackup(invalid, key), /not a PostgreSQL/);
  console.log('Encrypted backup tests passed: round trip, wrong keys, tampering, private export and no overwrite.');
} finally {
  // Only individual files in our newly created test directory are removed.
  for (const name of await readdir(directory)) await unlink(join(directory, name));
  await rmdir(directory);
}
