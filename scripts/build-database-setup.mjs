import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const root = new URL('../supabase/', import.meta.url);
const migrations = readdirSync(new URL('migrations/', root)).filter(name => name.endsWith('.sql')).sort();
const sql = migrations.map(name => '-- Migration: ' + name + '\n' + readFileSync(new URL('migrations/' + name, root), 'utf8').trim()).join('\n\n');
writeFileSync(new URL('setup.sql', root), 'BEGIN;\n\n' + sql + '\n\nCOMMIT;\n');
console.log('Generated supabase/setup.sql from ' + migrations.length + ' migrations.');
