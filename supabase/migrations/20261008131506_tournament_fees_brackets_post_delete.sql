ALTER TABLE public.tournaments ADD COLUMN entry_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (entry_fee >= 0);
ALTER TABLE public.tournaments ADD COLUMN payment_instructions text NOT NULL DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN payment_status text NOT NULL DEFAULT 'not_required' CHECK (payment_status IN ('not_required','pending','verified'));
ALTER TABLE public.match_contacts ADD COLUMN delete_token_hash text;
GRANT UPDATE ON public.match_contacts TO service_role;

CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round integer NOT NULL CHECK (round BETWEEN 1 AND 7),
  position integer NOT NULL CHECK (position > 0),
  team_a uuid REFERENCES public.registrations(id),
  team_b uuid REFERENCES public.registrations(id),
  winner_id uuid REFERENCES public.registrations(id),
  score_a integer CHECK (score_a >= 0),
  score_b integer CHECK (score_b >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','bye')),
  UNIQUE (tournament_id,round,position)
);
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_matches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tournament_matches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_matches TO service_role;
CREATE POLICY "Published tournament brackets" ON public.tournament_matches FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id=tournament_id));
CREATE INDEX tournament_matches_team_a_idx ON public.tournament_matches (team_a);
CREATE INDEX tournament_matches_team_b_idx ON public.tournament_matches (team_b);
CREATE INDEX tournament_matches_winner_idx ON public.tournament_matches (winner_id);

CREATE FUNCTION public.guard_tournament_registration() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE t public.tournaments;
BEGIN
  SELECT * INTO t FROM public.tournaments WHERE id=NEW.tournament_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) THEN RAISE EXCEPTION 'The bracket has started; registration is closed.'; END IF;
    NEW.payment_status := CASE WHEN t.entry_fee > 0 THEN 'pending' ELSE 'not_required' END;
  ELSIF EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN
    RAISE EXCEPTION 'Team eligibility is locked after bracket generation.';
  END IF;
  IF NEW.status='approved' AND t.entry_fee>0 AND NEW.payment_status <> 'verified' THEN RAISE EXCEPTION 'Verify payment before approving this team.'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_tournament_registration() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER registration_payment_guard BEFORE INSERT OR UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_registration();

CREATE FUNCTION public.guard_tournament_fee() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.entry_fee IS DISTINCT FROM OLD.entry_fee AND EXISTS (SELECT 1 FROM public.registrations WHERE tournament_id=OLD.id) THEN RAISE EXCEPTION 'Entry fee is locked once teams register.'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_tournament_fee() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tournament_fee_guard BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_fee();

-- Server-only RPC: caller is authorized as an administrator by the route.
CREATE FUNCTION public.generate_tournament_bracket(event_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t public.tournaments; teams uuid[]; n integer; size integer:=2; rounds integer:=1; r integer; p integer; slots integer; a uuid; b uuid; seed_order integer[]:=ARRAY[1,2]; expanded integer[]; seed integer;
BEGIN
  SELECT * INTO t FROM public.tournaments WHERE id=event_id FOR UPDATE;
  IF t.id IS NULL OR t.status NOT IN ('upcoming','ongoing') THEN RAISE EXCEPTION 'This tournament cannot start a bracket.'; END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN RAISE EXCEPTION 'A bracket already exists.'; END IF;
  SELECT array_agg(id ORDER BY avg_faceit_level DESC NULLS LAST,created_at,id) INTO teams FROM public.registrations WHERE tournament_id=event_id AND status='approved' AND (t.entry_fee=0 OR payment_status='verified');
  n:=coalesce(array_length(teams,1),0);
  IF n<2 THEN RAISE EXCEPTION 'Approve at least two eligible teams first.'; END IF;
  WHILE size<n LOOP size:=size*2; rounds:=rounds+1; END LOOP;
  WHILE array_length(seed_order,1)<size LOOP
    expanded:=ARRAY[]::integer[];
    FOREACH seed IN ARRAY seed_order LOOP expanded:=expanded||ARRAY[seed,2*array_length(seed_order,1)+1-seed]; END LOOP;
    seed_order:=expanded;
  END LOOP;
  slots:=size/2;
  FOR r IN 1..rounds LOOP
    FOR p IN 1..slots LOOP
      a:=NULL; b:=NULL;
      IF r=1 THEN a:=teams[seed_order[2*p-1]]; b:=teams[seed_order[2*p]]; END IF;
      INSERT INTO public.tournament_matches(tournament_id,round,position,team_a,team_b,winner_id,status)
      VALUES(event_id,r,p,a,b,CASE WHEN r=1 AND b IS NULL THEN a ELSE NULL END,CASE WHEN r=1 AND b IS NULL THEN 'bye' ELSE 'pending' END);
    END LOOP;
    slots:=slots/2;
  END LOOP;
  -- Highest seeds receive byes; each advances into its next-round slot.
  FOR p IN 1..size/2 LOOP
    SELECT winner_id INTO a FROM public.tournament_matches WHERE tournament_id=event_id AND round=1 AND position=p AND status='bye';
    IF a IS NOT NULL THEN
      IF p%2=1 THEN UPDATE public.tournament_matches SET team_a=a WHERE tournament_id=event_id AND round=2 AND position=(p+1)/2;
      ELSE UPDATE public.tournament_matches SET team_b=a WHERE tournament_id=event_id AND round=2 AND position=(p+1)/2; END IF;
    END IF;
  END LOOP;
  UPDATE public.tournaments SET status='ongoing',updated_at=now() WHERE id=event_id;
END $$;
REVOKE ALL ON FUNCTION public.generate_tournament_bracket(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_tournament_bracket(uuid) TO service_role;

CREATE FUNCTION public.record_tournament_result(game_id uuid, a_score integer, b_score integer) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; winner uuid; next_game public.tournament_matches; event_status text;
BEGIN
  SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found.'; END IF;
  SELECT status INTO event_status FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
  IF event_status NOT IN ('ongoing','completed') THEN RAISE EXCEPTION 'Results can only be recorded for an active bracket.'; END IF;
  SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
  IF m.team_a IS NULL OR m.team_b IS NULL OR m.status='bye' THEN RAISE EXCEPTION 'Both teams must be known before recording a result.'; END IF;
  IF a_score IS NULL OR b_score IS NULL OR a_score<0 OR b_score<0 OR a_score=b_score THEN RAISE EXCEPTION 'Enter non-negative scores with a clear winner.'; END IF;
  SELECT * INTO next_game FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND round=m.round+1 AND position=(m.position+1)/2;
  IF next_game.id IS NOT NULL AND next_game.status <> 'pending' THEN RAISE EXCEPTION 'The next round has finished; earlier results are locked.'; END IF;
  winner:=CASE WHEN a_score>b_score THEN m.team_a ELSE m.team_b END;
  UPDATE public.tournament_matches SET score_a=a_score,score_b=b_score,winner_id=winner,status='completed' WHERE id=m.id;
  IF next_game.id IS NOT NULL THEN
    IF m.position%2=1 THEN UPDATE public.tournament_matches SET team_a=winner WHERE id=next_game.id;
    ELSE UPDATE public.tournament_matches SET team_b=winner WHERE id=next_game.id; END IF;
  ELSE UPDATE public.tournaments SET status='completed',updated_at=now() WHERE id=m.tournament_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_tournament_result(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_tournament_result(uuid,integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';

CREATE FUNCTION public.set_registration_payment(registration_id uuid,next_payment text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.registrations;
BEGIN
  SELECT * INTO r FROM public.registrations WHERE id=registration_id;
  IF r.id IS NULL OR next_payment NOT IN ('pending','verified') THEN RAISE EXCEPTION 'Invalid payment review.'; END IF;
  PERFORM 1 FROM public.tournaments WHERE id=r.tournament_id FOR UPDATE;
  UPDATE public.registrations SET payment_status=next_payment,updated_at=now() WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.set_registration_payment(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_registration_payment(uuid,text) TO service_role;

-- Acquire tournament and registration locks in the same order as bracket operations.
CREATE OR REPLACE FUNCTION arena_private.toggle_arena_checkin(registration_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.registrations;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
  SELECT * INTO r FROM public.registrations WHERE id=registration_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Only approved teams can check in.'; END IF;
  PERFORM 1 FROM public.tournaments WHERE id=r.tournament_id FOR UPDATE;
  SELECT * INTO r FROM public.registrations WHERE id=registration_id FOR UPDATE;
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'Only approved teams can check in.'; END IF;
  UPDATE public.registrations SET checked_in=NOT r.checked_in, checked_in_at=CASE WHEN r.checked_in THEN NULL ELSE now() END, updated_at=now() WHERE id=r.id;
END $$;
