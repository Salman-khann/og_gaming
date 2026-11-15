import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const root = new URL('../supabase/', import.meta.url);
const migrations = readdirSync(new URL('migrations/', root)).filter(name => name.endsWith('.sql')).sort();
const sql = migrations.map(name => '-- Migration: ' + name + '\n' + readFileSync(new URL('migrations/' + name, root), 'utf8').replaceAll('\r\n','\n').trim()).join('\n\n');
const expected = 'BEGIN;\n\n' + sql + '\n\nCOMMIT;\n';
const destination = new URL('setup.sql', root);
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== expected) throw new Error('supabase/setup.sql is stale. Run npm run database:setup.');
  console.log('Database setup matches all ' + migrations.length + ' migrations.');
} else {
  writeFileSync(destination, expected);
  console.log('Generated supabase/setup.sql from ' + migrations.length + ' migrations.');
}
