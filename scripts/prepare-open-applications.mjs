import {readFileSync,writeFileSync} from 'node:fs';
const version='20261013131956',name='open_team_tournament_applications';
const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
writeFileSync('supabase/open-applications-upgrade.sql',"BEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='120s';\n"+sql+`\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES (${quote(version)},${quote(name)},ARRAY[${quote(sql)}]);\nCOMMIT;\nSELECT version FROM supabase_migrations.schema_migrations WHERE version=${quote(version)};\n`);
