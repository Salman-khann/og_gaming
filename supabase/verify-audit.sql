SELECT
 EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261013120944') AS audit_migration_applied,
 to_regclass('public.profiles_faceit_refresh_idx') IS NOT NULL AS refresh_index_present,
 NOT has_function_privilege('anon','public.faceit_refresh_candidates(integer)','EXECUTE') AS refresh_candidates_private,
 position('Serialize the per-player limit' IN pg_get_functiondef('public.community_action(uuid,text,jsonb)'::regprocedure))>0 AS invitation_lock_present,
 position('meet the level range' IN pg_get_functiondef('public.initialize_arena_match()'::regprocedure))>0 AS host_eligibility_present;
