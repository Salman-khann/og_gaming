SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '20261015122425';
SELECT p.proname, p.prosecdef AS security_definer, p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anonymous_can_edit,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS members_can_edit,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS server_can_edit
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'set_competition_pairings';
