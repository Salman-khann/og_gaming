import { readFileSync, writeFileSync } from 'node:fs';
const read = name => readFileSync('supabase/migrations/' + name, 'utf8');
const functionSql = (source, name) => {
  const start = source.indexOf('CREATE FUNCTION ' + name + '(');
  const end = source.indexOf('END $$;', start);
  if (start < 0 || end < 0) throw new Error('Function source missing: ' + name);
  return source.slice(start, end + 7).replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
};
let community = functionSql(read('20261013104139_community_and_operations.sql'), 'public.community_action');
community = community.replace("  IF actor.faceit_id IS NULL", "  IF (SELECT count(*) FROM public.team_members WHERE user_id=actor.id AND status='accepted')>=5 THEN RAISE EXCEPTION 'You already belong to five teams.'; END IF;\n  IF actor.faceit_id IS NULL");
community = community.replace("  IF action_name='accept' THEN", "  IF action_name='accept' THEN\n   -- Serialize the per-player limit across invitations to different teams.\n   PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;");
const guest = read('20261008120957_guest_matches_leaderboard.sql');
const start = guest.indexOf('CREATE OR REPLACE FUNCTION public.initialize_arena_match()');
let initialize = guest.slice(start, guest.indexOf('$$;', start) + 3);
initialize = initialize.replace('    NEW.host_name = p.faceit_nickname;', "    IF NEW.type<>'team_vs_team' AND ((p.faceit_id IS NULL AND (NEW.min_faceit_level>1 OR NEW.max_faceit_level<10)) OR (p.faceit_id IS NOT NULL AND (p.faceit_level IS NULL OR p.faceit_level NOT BETWEEN NEW.min_faceit_level AND NEW.max_faceit_level))) THEN RAISE EXCEPTION 'Connect FACEIT and meet the level range before hosting a restricted match.'; END IF;\n    NEW.host_name = p.faceit_nickname;");
const sql = `-- Audit follow-up: preserve existing grants on replaced functions.\n${community}\n\n${initialize}\n
ALTER TABLE public.profiles ADD COLUMN faceit_refresh_attempted_at timestamptz;
CREATE INDEX profiles_faceit_refresh_idx ON public.profiles(faceit_refresh_attempted_at NULLS FIRST,id) WHERE faceit_id IS NOT NULL AND role<>'banned';

CREATE FUNCTION public.faceit_refresh_candidates(batch_size integer) RETURNS TABLE(faceit_id text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH ids AS (
  SELECT p.faceit_id FROM public.profiles p WHERE p.faceit_id IS NOT NULL AND p.role<>'banned'
  UNION
  SELECT entry->>'faceit_id' FROM public.registrations r JOIN public.tournaments t ON t.id=r.tournament_id CROSS JOIN LATERAL jsonb_array_elements(r.roster_details) entry WHERE r.status='approved' AND t.status<>'draft' AND entry->>'faceit_id' IS NOT NULL
 ) SELECT ids.faceit_id FROM ids LEFT JOIN public.faceit_leaderboard b ON b.faceit_id=ids.faceit_id
 WHERE NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.faceit_id=ids.faceit_id AND p.role='banned') AND (b.updated_at IS NULL OR b.updated_at<=now()-interval '15 minutes')
 ORDER BY b.updated_at NULLS FIRST,ids.faceit_id LIMIT greatest(1,least(batch_size,8));
$$;
REVOKE ALL ON FUNCTION public.faceit_refresh_candidates(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.faceit_refresh_candidates(integer) TO service_role;
NOTIFY pgrst,'reload schema';
`;
writeFileSync('supabase/migrations/20261013120944_audit_reliability_and_refresh.sql',sql);
const quote=value=>"'"+value.replaceAll("'","''")+"'";
writeFileSync('supabase/audit-upgrade.sql',"BEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='120s';\nDO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261013111506') OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261013120944') THEN RAISE EXCEPTION 'Audit upgrade prerequisites do not match; inspect migration history.'; END IF; END $$;\n"+sql+"\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261013120944','audit_reliability_and_refresh',ARRAY["+quote(sql)+"]);\nCOMMIT;\nSELECT version,name FROM supabase_migrations.schema_migrations WHERE version='20261013120944';\n");
