import {readFileSync,writeFileSync} from 'node:fs';
const read=name=>readFileSync('supabase/migrations/'+name,'utf8');
function extract(source,name){const start=source.indexOf('CREATE OR REPLACE FUNCTION '+name+'(')>=0?source.indexOf('CREATE OR REPLACE FUNCTION '+name+'('):source.indexOf('CREATE FUNCTION '+name+'(');const end=source.indexOf('$$;',start);if(start<0||end<0)throw new Error('Missing '+name);return source.slice(start,end+3).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');}
let community=extract(read('20261013120944_audit_reliability_and_refresh.sql'),'public.community_action').split('\n').filter(line=>!line.includes('INSERT INTO public.admin_audit')).join('\n').replace(" OR length(trim(coalesce(payload->>'reason','')))=0",'').replace('A player, role and reason are required.','A player and role are required.');
const result=extract(read('20261013104726_matchmaking_and_brackets.sql'),'public.record_competition_result').split('\n').filter(line=>!line.includes('public.match_disputes')).join('\n');
const analytics=extract(read('20261013104927_memberships_promotions_growth.sql'),'public.arena_analytics').split('\n').filter(line=>!line.includes("'membership_revenue'")).join('\n');
const sql=`-- Retire optional product features without erasing historical records.
${community}
${result}
${analytics}
DROP TRIGGER membership_admin_notice ON public.memberships;
DROP TRIGGER dispute_admin_notice ON public.match_disputes;
DROP FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text);
DROP FUNCTION public.membership_action(uuid,text,jsonb);
DROP FUNCTION public.redeem_promotion(uuid,text,numeric);
DROP FUNCTION public.dispute_action(uuid,text,jsonb);
CREATE SCHEMA arena_retired_features;
REVOKE ALL ON SCHEMA arena_retired_features FROM PUBLIC,anon,authenticated,service_role;
${['membership_usage','memberships','membership_plans','promotion_redemptions','promotions','match_disputes','admin_audit'].map(table=>`ALTER TABLE public.${table} SET SCHEMA arena_retired_features;\nREVOKE ALL ON arena_retired_features.${table} FROM PUBLIC,anon,authenticated,service_role;`).join('\n')}
CREATE TABLE arena_retired_features.notifications_log AS SELECT * FROM public.notifications_log WHERE event_type LIKE 'memberships:%' OR event_type LIKE 'match_disputes:%';
ALTER TABLE arena_retired_features.notifications_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arena_retired_features.notifications_log FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM public.notifications_log WHERE event_type LIKE 'memberships:%' OR event_type LIKE 'match_disputes:%';
NOTIFY pgrst,'reload schema';
`;
const version='20261013130626',name='remove_memberships_promotions_disputes_audit';
writeFileSync('supabase/migrations/'+version+'_'+name+'.sql',sql);
const quote=s=>"'"+s.replaceAll("'","''")+"'";
writeFileSync('supabase/retire-features.sql',"BEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='120s';\n"+sql+`\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES (${quote(version)},${quote(name)},ARRAY[${quote(sql)}]);\nCOMMIT;\nSELECT version FROM supabase_migrations.schema_migrations WHERE version=${quote(version)};\n`);
