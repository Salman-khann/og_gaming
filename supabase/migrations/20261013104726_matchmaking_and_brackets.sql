ALTER TABLE public.match_requests ADD COLUMN balanced_teams jsonb;
ALTER TABLE public.tournament_matches ADD COLUMN bracket text NOT NULL DEFAULT 'winners' CHECK(bracket IN('winners','losers','final','reset'));
ALTER TABLE public.tournament_matches ADD COLUMN node_key text;
ALTER TABLE public.tournament_matches ADD COLUMN source_a text;
ALTER TABLE public.tournament_matches ADD COLUMN source_b text;
ALTER TABLE public.tournament_matches ADD COLUMN outcome_a text NOT NULL DEFAULT 'winner' CHECK(outcome_a IN('winner','loser'));
ALTER TABLE public.tournament_matches ADD COLUMN outcome_b text NOT NULL DEFAULT 'winner' CHECK(outcome_b IN('winner','loser'));
ALTER TABLE public.tournament_matches DROP CONSTRAINT tournament_matches_round_check;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_round_check CHECK(round BETWEEN 1 AND 14);
ALTER TABLE public.tournament_matches DROP CONSTRAINT tournament_matches_tournament_id_round_position_key;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_slot_unique UNIQUE(tournament_id,bracket,round,position);
CREATE UNIQUE INDEX tournament_node_idx ON public.tournament_matches(tournament_id,node_key);

CREATE TABLE public.match_disputes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
 reporter_id uuid NOT NULL REFERENCES public.profiles(id), reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','resolved','dismissed')), resolution text,
 resolved_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE INDEX match_disputes_match_idx ON public.match_disputes(match_id);
CREATE INDEX match_disputes_reporter_idx ON public.match_disputes(reporter_id);
CREATE INDEX match_disputes_resolver_idx ON public.match_disputes(resolved_by);
CREATE UNIQUE INDEX match_disputes_open_idx ON public.match_disputes(match_id,reporter_id) WHERE status='open';
ALTER TABLE public.match_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_disputes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.match_disputes TO authenticated;
GRANT ALL ON public.match_disputes TO service_role;
CREATE POLICY "Own disputes or admin" ON public.match_disputes FOR SELECT TO authenticated USING(reporter_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE FUNCTION public.advance_competition(event_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; parent public.tournament_matches; grand_final public.tournament_matches; a uuid; b uuid; ready boolean; changed boolean; champion uuid; kind text;
BEGIN
 SELECT bracket_type INTO kind FROM public.tournaments WHERE id=event_id FOR UPDATE;
 LOOP
  changed:=false;
  FOR m IN SELECT * FROM public.tournament_matches WHERE tournament_id=event_id AND node_key IS NOT NULL AND status='pending' ORDER BY round,position LOOP
   a:=m.team_a; b:=m.team_b; ready:=true;
   IF m.bracket='reset' THEN
    SELECT * INTO grand_final FROM public.tournament_matches WHERE tournament_id=event_id AND bracket='final';
    IF grand_final.status<>'completed' THEN CONTINUE; END IF;
    IF grand_final.winner_id=grand_final.team_a THEN
     UPDATE public.tournament_matches SET status='bye',winner_id=grand_final.winner_id WHERE id=m.id; changed:=true; CONTINUE;
    END IF;
   END IF;
   IF m.source_a IS NOT NULL THEN
    SELECT * INTO parent FROM public.tournament_matches WHERE tournament_id=event_id AND node_key=m.source_a;
    IF parent.id IS NULL OR parent.status='pending' THEN ready:=false;
    ELSE a:=CASE WHEN m.outcome_a='winner' THEN parent.winner_id WHEN parent.team_a IS NULL OR parent.team_b IS NULL THEN NULL WHEN parent.winner_id=parent.team_a THEN parent.team_b ELSE parent.team_a END; END IF;
   END IF;
   IF m.source_b IS NOT NULL THEN
    SELECT * INTO parent FROM public.tournament_matches WHERE tournament_id=event_id AND node_key=m.source_b;
    IF parent.id IS NULL OR parent.status='pending' THEN ready:=false;
    ELSE b:=CASE WHEN m.outcome_b='winner' THEN parent.winner_id WHEN parent.team_a IS NULL OR parent.team_b IS NULL THEN NULL WHEN parent.winner_id=parent.team_a THEN parent.team_b ELSE parent.team_a END; END IF;
   END IF;
   IF ready THEN
    IF a IS DISTINCT FROM m.team_a OR b IS DISTINCT FROM m.team_b OR a IS NULL OR b IS NULL THEN
     UPDATE public.tournament_matches SET team_a=a,team_b=b,status=CASE WHEN a IS NULL OR b IS NULL THEN 'bye' ELSE 'pending' END,winner_id=CASE WHEN a IS NULL OR b IS NULL THEN coalesce(a,b) ELSE NULL END WHERE id=m.id; changed:=true;
    END IF;
   END IF;
  END LOOP;
  EXIT WHEN NOT changed;
 END LOOP;
 IF kind='single' THEN
  SELECT winner_id INTO champion FROM public.tournament_matches WHERE tournament_id=event_id AND node_key IS NOT NULL AND bracket='winners' ORDER BY round DESC LIMIT 1;
 ELSE
  SELECT winner_id INTO champion FROM public.tournament_matches WHERE tournament_id=event_id AND bracket='reset' AND status IN('completed','bye');
 END IF;
 IF champion IS NOT NULL THEN UPDATE public.tournaments SET status='completed',updated_at=now() WHERE id=event_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.advance_competition(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_competition(uuid) TO service_role;

CREATE FUNCTION public.create_competition_bracket(event_id uuid,graph jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; item jsonb; seed uuid; teams integer;
BEGIN
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status NOT IN('upcoming','ongoing') OR EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN RAISE EXCEPTION 'This tournament cannot generate another bracket.'; END IF;
 SELECT count(*) INTO teams FROM public.registrations r WHERE tournament_id=event_id AND status='approved' AND checked_in AND NOT no_show AND (amount_due=0 OR payment_status='verified') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role='banned' AND (p.id=r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id',p.faceit_id))));
 IF teams<2 THEN RAISE EXCEPTION 'At least two approved, paid and checked-in teams are required.'; END IF;
 IF jsonb_array_length(graph) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Invalid bracket graph.'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(graph) LOOP
  FOREACH seed IN ARRAY ARRAY[(item->>'team_a')::uuid,(item->>'team_b')::uuid] LOOP
   IF seed IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.registrations r WHERE id=seed AND tournament_id=event_id AND status='approved' AND checked_in AND NOT no_show AND (amount_due=0 OR payment_status='verified') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role='banned' AND (p.id=r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id',p.faceit_id))))) THEN RAISE EXCEPTION 'A bracket team is no longer eligible.'; END IF;
  END LOOP;
  INSERT INTO public.tournament_matches(tournament_id,bracket,node_key,round,position,team_a,team_b,source_a,source_b,outcome_a,outcome_b)
  VALUES(event_id,item->>'bracket',item->>'key',(item->>'round')::integer,(item->>'position')::integer,(item->>'team_a')::uuid,(item->>'team_b')::uuid,item->>'source_a',item->>'source_b',item->>'outcome_a',item->>'outcome_b');
 END LOOP;
 IF (SELECT count(DISTINCT seed_id) FROM public.tournament_matches m CROSS JOIN LATERAL unnest(ARRAY[m.team_a,m.team_b]) seed_id WHERE m.tournament_id=event_id AND seed_id IS NOT NULL)<>teams THEN RAISE EXCEPTION 'The entrant list changed; regenerate the bracket.'; END IF;
 UPDATE public.tournaments SET status='ongoing',updated_at=now() WHERE id=event_id;
 PERFORM public.advance_competition(event_id);
END $$;
REVOKE ALL ON FUNCTION public.create_competition_bracket(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_competition_bracket(uuid,jsonb) TO service_role;

CREATE FUNCTION public.record_competition_result(game_id uuid,a_score integer,b_score integer) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; event_status text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 SELECT status INTO event_status FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found.'; END IF;
 IF EXISTS(SELECT 1 FROM public.match_disputes WHERE match_id=game_id AND status='open') THEN RAISE EXCEPTION 'Resolve the open dispute before changing this result.'; END IF;
 IF m.node_key IS NULL THEN PERFORM public.record_tournament_result(game_id,a_score,b_score); RETURN; END IF;
 IF event_status NOT IN('ongoing','completed') OR m.team_a IS NULL OR m.team_b IS NULL OR m.status='bye' OR a_score IS NULL OR b_score IS NULL OR a_score NOT BETWEEN 0 AND 100 OR b_score NOT BETWEEN 0 AND 100 OR a_score=b_score THEN RAISE EXCEPTION 'Enter valid scores for two ready teams with a clear winner.'; END IF;
 IF EXISTS(WITH RECURSIVE downstream AS (
  SELECT * FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
  UNION SELECT n.* FROM public.tournament_matches n JOIN downstream d ON n.tournament_id=d.tournament_id AND (n.source_a=d.node_key OR n.source_b=d.node_key)
 ) SELECT 1 FROM downstream WHERE status='completed') THEN RAISE EXCEPTION 'A later match has finished; this result is locked.'; END IF;
 -- Reset automatic byes downstream so their derived winners can be recalculated.
 WITH RECURSIVE downstream AS (
  SELECT node_key FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
  UNION SELECT n.node_key FROM public.tournament_matches n JOIN downstream d ON n.source_a=d.node_key OR n.source_b=d.node_key WHERE n.tournament_id=m.tournament_id
 ) UPDATE public.tournament_matches SET status='pending',winner_id=NULL WHERE tournament_id=m.tournament_id AND node_key IN(SELECT node_key FROM downstream) AND status='bye';
 UPDATE public.tournament_matches SET score_a=a_score,score_b=b_score,winner_id=CASE WHEN a_score>b_score THEN team_a ELSE team_b END,status='completed' WHERE id=m.id;
 UPDATE public.tournaments SET status='ongoing' WHERE id=m.tournament_id;
 PERFORM public.advance_competition(m.tournament_id);
END $$;
REVOKE ALL ON FUNCTION public.record_competition_result(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_competition_result(uuid,integer,integer) TO service_role;

CREATE FUNCTION public.join_arena_team(actor_id uuid,match_id uuid,squad_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.match_requests; squad public.teams; squad_roster jsonb; other_roster jsonb;
BEGIN
 SELECT * INTO m FROM public.match_requests WHERE id=match_id FOR UPDATE;
 SELECT * INTO squad FROM public.teams WHERE id=squad_id FOR UPDATE;
 IF squad.id IS NULL OR squad.captain_id<>actor_id OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role<>'banned') THEN RAISE EXCEPTION 'Only the captain can join with this team.'; END IF;
 IF m.id IS NULL OR m.type<>'team_vs_team' OR m.status<>'open' OR m.scheduled_time<=now() THEN RAISE EXCEPTION 'This team match is closed.'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.faceit_nickname,'level',p.faceit_level,'elo',p.faceit_elo,'team_id',squad.id,'team_name',squad.name,'role',CASE WHEN p.id=actor_id THEN 'Captain' ELSE 'Player' END)) INTO squad_roster
 FROM public.team_members member JOIN public.profiles p ON p.id=member.user_id AND p.faceit_id=member.faceit_id AND p.role<>'banned'
 WHERE member.team_id=squad.id AND member.status='accepted' AND p.faceit_level BETWEEN m.min_faceit_level AND m.max_faceit_level;
 IF coalesce(jsonb_array_length(squad_roster),0)<>5 THEN RAISE EXCEPTION 'Five accepted, eligible FACEIT players are required.'; END IF;
 SELECT coalesce(jsonb_agg(entry),'[]'::jsonb) INTO other_roster FROM jsonb_array_elements(m.roster) entry WHERE NOT(entry->>'id'=actor_id::text AND NOT entry ? 'team_id');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(other_roster) a JOIN jsonb_array_elements(squad_roster) b ON a->>'id'=b->>'id') OR jsonb_array_length(other_roster)+5>10 THEN RAISE EXCEPTION 'A player is already in this match or the match is full.'; END IF;
 UPDATE public.match_requests SET roster=other_roster||squad_roster,current_players_count=jsonb_array_length(other_roster)+5,target_players_count=10,status=CASE WHEN jsonb_array_length(other_roster)+5=10 THEN 'matched' ELSE 'open' END,updated_at=now() WHERE id=m.id;
END $$;
REVOKE ALL ON FUNCTION public.join_arena_team(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.join_arena_team(uuid,uuid,uuid) TO service_role;
-- Solo joins cannot bypass a team scrim's five-player roster checks.
CREATE FUNCTION public.reject_solo_scrim_join() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.type='team_vs_team' AND NEW.roster IS DISTINCT FROM OLD.roster AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.roster) entry WHERE NOT entry ? 'team_id') THEN RAISE EXCEPTION 'Join a team scrim with a complete verified team.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reject_solo_scrim_join() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER scrim_roster_guard BEFORE UPDATE OF roster ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.reject_solo_scrim_join();
NOTIFY pgrst,'reload schema';

CREATE FUNCTION public.post_team_match(payload jsonb,host_phone text,squad_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF payload->>'type'<>'team_vs_team' THEN RAISE EXCEPTION 'A team scrim is required.'; END IF;
 result:=public.post_arena_match(payload,host_phone);
 PERFORM public.join_arena_team((payload->>'creator_id')::uuid,(result->>'id')::uuid,squad_id);
 SELECT to_jsonb(m) INTO result FROM public.match_requests m WHERE id=(result->>'id')::uuid;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.post_team_match(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.post_team_match(jsonb,text,uuid) TO service_role;

CREATE TABLE public.match_history (
 id uuid PRIMARY KEY, title text NOT NULL, scheduled_time timestamptz NOT NULL, roster jsonb NOT NULL,
 balanced_teams jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.match_history TO anon,authenticated;
GRANT ALL ON public.match_history TO service_role;
CREATE POLICY "Public match summaries" ON public.match_history FOR SELECT TO anon,authenticated USING(true);
CREATE FUNCTION public.capture_match_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='matched' THEN
  INSERT INTO public.match_history(id,title,scheduled_time,roster,balanced_teams) VALUES(NEW.id,NEW.title,NEW.scheduled_time,NEW.roster,NEW.balanced_teams)
  ON CONFLICT(id) DO UPDATE SET roster=excluded.roster,balanced_teams=excluded.balanced_teams,updated_at=now();
 END IF;
 RETURN NEW;
END $$;
-- Only the table trigger can execute this archival write; never an exposed RPC.
REVOKE ALL ON FUNCTION public.capture_match_history() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER match_history_archive AFTER UPDATE ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.capture_match_history();
ALTER FUNCTION public.capture_match_history() SET SCHEMA arena_private;

CREATE FUNCTION public.balance_full_gather() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE mask integer; best integer; difference numeric; smallest numeric:=NULL; total numeric; a jsonb; b jsonb;
BEGIN
 IF NEW.type='gather_5v5' AND NEW.status='matched' AND jsonb_array_length(NEW.roster)=10 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.roster) entry WHERE entry->>'elo' IS NULL) THEN
  SELECT sum((entry->>'elo')::numeric) INTO total FROM jsonb_array_elements(NEW.roster) entry;
  FOR mask IN 1..1023 BY 2 LOOP
   IF bit_count(mask::bit(10))=5 THEN
    SELECT abs(total-2*sum((entry->>'elo')::numeric)) INTO difference FROM jsonb_array_elements(NEW.roster) WITH ORDINALITY entries(entry,n) WHERE (mask & (1 << (n::integer-1)))<>0;
    IF smallest IS NULL OR difference<smallest THEN smallest:=difference;best:=mask; END IF;
   END IF;
  END LOOP;
  SELECT jsonb_agg(entry) FILTER(WHERE (best & (1 << (n::integer-1)))<>0),jsonb_agg(entry) FILTER(WHERE (best & (1 << (n::integer-1)))=0) INTO a,b FROM jsonb_array_elements(NEW.roster) WITH ORDINALITY entries(entry,n);
  NEW.balanced_teams:=jsonb_build_object('a',a,'b',b,'difference',smallest);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.balance_full_gather() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gather_balance BEFORE UPDATE OF roster ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.balance_full_gather();
