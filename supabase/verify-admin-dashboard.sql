SELECT
 (public.admin_dashboard_report(30,NULL)->>'registrations')::integer AS entries_30d,
 jsonb_array_length(public.admin_dashboard_report(30,NULL)->'series') AS daily_points,
 NOT has_function_privilege('anon','public.admin_dashboard_report(integer,uuid)','EXECUTE') AS anonymous_reporting_blocked,
 NOT has_function_privilege('authenticated','public.admin_delete_tournament(uuid,uuid,text)','EXECUTE') AS direct_player_deletion_blocked,
 has_function_privilege('service_role','public.admin_dashboard_report(integer,uuid)','EXECUTE') AS reporting_enabled;
