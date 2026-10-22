SELECT
 (SELECT count(*) FROM supabase_migrations.schema_migrations) AS migration_count,
 (SELECT jsonb_agg(c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) AS tables_without_rls,
 has_column_privilege('anon','public.profiles','phone','SELECT') AS anonymous_phone_access,
 has_function_privilege('anon','public.community_action(uuid,text,jsonb)','EXECUTE') AS anonymous_team_mutations,
 has_function_privilege('authenticated','public.delete_arena_post(uuid)','EXECUTE') AS direct_player_delete,
 has_function_privilege('service_role','public.community_action(uuid,text,jsonb)','EXECUTE') AS server_team_mutations,
 (SELECT jsonb_agg(row_to_json(j)) FROM (SELECT jobname,schedule,active FROM cron.job ORDER BY jobname) j) AS jobs,
 (SELECT jsonb_agg(row_to_json(p)) FROM (SELECT schemaname,tablename,policyname FROM pg_policies WHERE tablename IN('team_members','memberships','match_history','match_disputes') ORDER BY tablename,policyname) p) AS feature_policies,
 (SELECT jsonb_agg(row_to_json(r)) FROM (SELECT DISTINCT ON (j.jobname) j.jobname,d.status,d.return_message FROM cron.job_run_details d JOIN cron.job j USING(jobid) WHERE j.jobname IN ('release-tournament-no-shows','purge-expired-rate-limits') ORDER BY j.jobname,d.start_time DESC) r) AS recent_job_results;
