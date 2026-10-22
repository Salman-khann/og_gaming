SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_history_present,
       to_regclass('public.team_members') IS NOT NULL AS community_schema_present,
       to_regclass('public.memberships') IS NOT NULL AS memberships_schema_present,
       to_regprocedure('public.post_arena_match(jsonb,text)') IS NOT NULL AS arena_schema_present,
       to_regprocedure('public.delete_arena_post(uuid)') IS NOT NULL AS final_feature_schema_present,
       EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='registrations' AND policyname='Visible tournament registrations') AS previous_security_fix_present;
