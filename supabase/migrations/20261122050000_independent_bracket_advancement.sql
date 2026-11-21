-- Migration: 20261122050000_independent_bracket_advancement.sql
-- Advance teams independently as soon as each feeder match completes, without waiting for the adjacent match.
CREATE OR REPLACE FUNCTION public.advance_competition(event_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  m public.tournament_matches;
  parent public.tournament_matches;
  grand_final public.tournament_matches;
  a uuid;
  b uuid;
  a_ready boolean;
  b_ready boolean;
  new_status text;
  new_winner uuid;
  changed boolean;
  champion uuid;
  kind text;
BEGIN
 SELECT bracket_type INTO kind FROM public.tournaments WHERE id=event_id FOR UPDATE;
 LOOP
  changed:=false;
  FOR m IN SELECT * FROM public.tournament_matches WHERE tournament_id=event_id AND node_key IS NOT NULL AND status='pending' ORDER BY round,position LOOP
   a:=m.team_a;
   b:=m.team_b;
   a_ready:=(m.source_a IS NULL);
   b_ready:=(m.source_b IS NULL);

   IF m.bracket='reset' THEN
    SELECT * INTO grand_final FROM public.tournament_matches WHERE tournament_id=event_id AND bracket='final';
    IF grand_final.status<>'completed' THEN CONTINUE; END IF;
    IF grand_final.winner_id=grand_final.team_a THEN
     UPDATE public.tournament_matches SET status='bye',winner_id=grand_final.winner_id WHERE id=m.id;
     changed:=true;
     CONTINUE;
    END IF;
   END IF;

   IF m.source_a IS NOT NULL THEN
    SELECT * INTO parent FROM public.tournament_matches WHERE tournament_id=event_id AND node_key=m.source_a;
    IF parent.id IS NOT NULL AND parent.status IN ('completed', 'bye') THEN
     a_ready:=true;
     a:=CASE
       WHEN m.outcome_a='winner' THEN parent.winner_id
       WHEN parent.team_a IS NULL OR parent.team_b IS NULL THEN NULL
       WHEN parent.winner_id=parent.team_a THEN parent.team_b
       ELSE parent.team_a
     END;
    END IF;
   END IF;

   IF m.source_b IS NOT NULL THEN
    SELECT * INTO parent FROM public.tournament_matches WHERE tournament_id=event_id AND node_key=m.source_b;
    IF parent.id IS NOT NULL AND parent.status IN ('completed', 'bye') THEN
     b_ready:=true;
     b:=CASE
       WHEN m.outcome_b='winner' THEN parent.winner_id
       WHEN parent.team_a IS NULL OR parent.team_b IS NULL THEN NULL
       WHEN parent.winner_id=parent.team_a THEN parent.team_b
       ELSE parent.team_a
     END;
    END IF;
   END IF;

   IF a_ready AND b_ready THEN
    new_status:=CASE WHEN a IS NULL OR b IS NULL THEN 'bye' ELSE 'pending' END;
    new_winner:=CASE WHEN a IS NULL OR b IS NULL THEN coalesce(a,b) ELSE NULL END;
   ELSE
    new_status:='pending';
    new_winner:=NULL;
   END IF;

   IF a IS DISTINCT FROM m.team_a OR b IS DISTINCT FROM m.team_b OR new_status IS DISTINCT FROM m.status OR new_winner IS DISTINCT FROM m.winner_id THEN
    UPDATE public.tournament_matches
    SET team_a=a, team_b=b, status=new_status, winner_id=new_winner
    WHERE id=m.id;
    changed:=true;
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

 IF champion IS NOT NULL THEN
  UPDATE public.tournaments SET status='completed',updated_at=now() WHERE id=event_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.advance_competition(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_competition(uuid) TO service_role;
