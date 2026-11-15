SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tournaments' AND column_name LIKE 'early_bird%';
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3;
