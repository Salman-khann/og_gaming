import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, stat, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const magic = Buffer.from('OGGAMING-BACKUP1\n');
const headerLength = magic.length + 12;

export function backupKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new Error('Set BACKUP_ENCRYPTION_KEY to a separately stored random 32-byte base64 key.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('Invalid backup encryption key.');
  return key;
}

export async function encryptBackup(source, file, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(magic);
  const destination = createWriteStream(file, { flags: 'wx', mode: 0o600 });
  let created = false;
  destination.once('open', () => {
    created = true;
  });
  try {
    await pipeline(
      source,
      cipher,
      async function* (chunks) {
        yield magic;
        yield iv;
        for await (const chunk of chunks) yield chunk;
        yield cipher.getAuthTag();
      },
      destination,
    );
  } catch (error) {
    if (created) await unlink(file).catch(() => {});
    throw error;
  }
}

async function decryptionSettings(file, key) {
  const size = (await stat(file)).size;
  if (size <= headerLength + 16) throw new Error('Invalid backup archive.');
  const handle = await open(file, 'r');
  const header = Buffer.alloc(headerLength),
    tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, magic.length).equals(magic))
    throw new Error('Unrecognized backup archive.');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(magic.length));
  decipher.setAAD(magic);
  decipher.setAuthTag(tag);
  return { decipher, readOptions: { start: headerLength, end: size - 17 } };
}

export async function verifyBackup(file, key) {
  let bytes = 0,
    prefix = Buffer.alloc(0);
  const { decipher, readOptions } = await decryptionSettings(file, key);
  await pipeline(createReadStream(file, readOptions), decipher, async (chunks) => {
    for await (const chunk of chunks) {
      bytes += chunk.length;
      if (prefix.length < 5) prefix = Buffer.concat([prefix, chunk]).subarray(0, 5);
    }
  });
  if (prefix.toString('ascii') !== 'PGDMP')
    throw new Error('The decrypted file is not a PostgreSQL custom archive.');
  return { bytes };
}

export async function exportBackup(file, output, key) {
  // Authenticate the entire archive before releasing any plaintext to disk.
  await verifyBackup(file, key);
  const { decipher, readOptions } = await decryptionSettings(file, key);
  let created = false;
  const destination = createWriteStream(output, { flags: 'wx', mode: 0o600 });
  destination.once('open', () => {
    created = true;
  });
  try {
    await pipeline(createReadStream(file, readOptions), decipher, destination);
  } catch (error) {
    if (created) await unlink(output).catch(() => {});
    throw error;
  }
}
