SELECT
 EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261013131956') AS migration_applied,
 NOT has_table_privilege('anon','public.registration_contacts','SELECT') AND NOT has_table_privilege('authenticated','public.registration_contacts','SELECT') AS contacts_private,
 NOT has_function_privilege('anon','public.submit_team_application(uuid,uuid,jsonb,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.checkin_team_application(uuid)','EXECUTE') AS mutations_private,
 (SELECT relrowsecurity FROM pg_class WHERE oid='public.registration_contacts'::regclass) AS contacts_rls_enabled;
