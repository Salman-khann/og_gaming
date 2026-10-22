import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const files = readdirSync('supabase/migrations').filter(name => /^20261013\d{6}_.*\.sql$/.test(name) && name.slice(0,14)<='20261013111506').sort();
if (files.length !== 5) throw new Error('Expected the five reviewed pending migrations.');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
let sql = "BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '120s';\n";
for (const file of files) {
  const [version, ...parts] = file.replace(/\.sql$/, '').split('_');
  const source = readFileSync('supabase/migrations/' + file, 'utf8');
  sql += `\n-- ${file}\n${source}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES (${quote(version)},${quote(parts.join('_'))},ARRAY[${quote(source)}]);\n`;
}
sql += "NOTIFY pgrst, 'reload schema';\nCOMMIT;\nSELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;\n";
writeFileSync('supabase/pending-upgrade.sql', sql);
console.log(`Prepared ${files.length} pending migrations in one transaction.`);
