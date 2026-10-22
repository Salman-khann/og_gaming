BEGIN;
DO $$
DECLARE feature text;
BEGIN
 FOREACH feature IN ARRAY ARRAY['membership_plans','memberships','membership_usage','promotions','promotion_redemptions','match_disputes','admin_audit'] LOOP
  IF to_regclass('public.'||feature) IS NOT NULL OR to_regclass('arena_retired_features.'||feature) IS NULL THEN RAISE EXCEPTION 'Feature remains active or archive missing: %',feature;END IF;
  IF has_table_privilege('anon','arena_retired_features.'||feature,'SELECT') OR has_table_privilege('authenticated','arena_retired_features.'||feature,'SELECT') OR has_table_privilege('service_role','arena_retired_features.'||feature,'SELECT') THEN RAISE EXCEPTION 'Retired data is still accessible: %',feature;END IF;
 END LOOP;
 IF has_schema_privilege('service_role','arena_retired_features','USAGE') THEN RAISE EXCEPTION 'App service can reach retired schema';END IF;
 IF to_regprocedure('public.membership_action(uuid,text,jsonb)') IS NOT NULL OR to_regprocedure('public.dispute_action(uuid,text,jsonb)') IS NOT NULL OR to_regprocedure('public.redeem_promotion(uuid,text,numeric)') IS NOT NULL OR to_regprocedure('public.register_team_entry(uuid,uuid,uuid,jsonb,text)') IS NOT NULL THEN RAISE EXCEPTION 'Retired RPC remains exposed';END IF;
 SET LOCAL ROLE service_role;
 IF public.arena_analytics() ? 'membership_revenue' THEN RAISE EXCEPTION 'Retired metric remains';END IF;
 RESET ROLE;
END $$;
ROLLBACK;
