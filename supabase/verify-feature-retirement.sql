SELECT
 EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261013130626') AS retirement_applied,
 to_regclass('public.memberships') IS NULL AND to_regclass('public.membership_plans') IS NULL AND to_regclass('public.promotions') IS NULL AND to_regclass('public.match_disputes') IS NULL AND to_regclass('public.admin_audit') IS NULL AS features_removed,
 NOT has_schema_privilege('service_role','arena_retired_features','USAGE') AND NOT has_schema_privilege('anon','arena_retired_features','USAGE') AND NOT has_schema_privilege('authenticated','arena_retired_features','USAGE') AS archive_private,
 to_regprocedure('public.membership_action(uuid,text,jsonb)') IS NULL AND to_regprocedure('public.dispute_action(uuid,text,jsonb)') IS NULL AND to_regprocedure('public.redeem_promotion(uuid,text,numeric)') IS NULL AS rpcs_removed,
 NOT (public.arena_analytics() ? 'membership_revenue') AS analytics_updated;
