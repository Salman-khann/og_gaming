SELECT
 (SELECT coalesce(jsonb_agg(row_to_json(m)),'[]') FROM (SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version) m) AS migrations,
 (SELECT jsonb_agg(extname) FROM pg_extension WHERE extname IN ('pg_cron','pgcrypto')) AS extensions,
 (SELECT jsonb_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='tournament_matches') AS bracket_columns,
 (SELECT jsonb_agg(row_to_json(j)) FROM (SELECT jobname,schedule,active FROM cron.job ORDER BY jobname) j) AS jobs;
