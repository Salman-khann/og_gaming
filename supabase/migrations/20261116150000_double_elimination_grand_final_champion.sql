-- Migration: 20261116150000_double_elimination_grand_final_champion.sql
-- When a double-elimination tournament has no reset match, the winner of the Grand Final is the champion.
CREATE OR REPLACE FUNCTION public.advance_competition(event_id uuid) RETURNS void
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
  IF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id AND bracket='reset') THEN
   SELECT winner_id INTO champion FROM public.tournament_matches WHERE tournament_id=event_id AND bracket='reset' AND status IN('completed','bye');
  ELSE
   SELECT winner_id INTO champion FROM public.tournament_matches WHERE tournament_id=event_id AND bracket='final' AND status='completed';
  END IF;
 END IF;
 IF champion IS NOT NULL THEN UPDATE public.tournaments SET status='completed',updated_at=now() WHERE id=event_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.advance_competition(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_competition(uuid) TO service_role;
