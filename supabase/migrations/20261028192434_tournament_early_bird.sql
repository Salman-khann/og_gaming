-- A registration snapshots its fee; later offer edits never reprice existing teams.
ALTER TABLE public.tournaments
  ADD COLUMN early_bird_fee numeric(10,2),
  ADD COLUMN early_bird_deadline timestamptz,
  ADD CONSTRAINT tournament_early_bird_valid CHECK (
    (early_bird_fee IS NULL AND early_bird_deadline IS NULL)
    OR (early_bird_fee IS NOT NULL AND early_bird_deadline IS NOT NULL
      AND early_bird_fee >= 0 AND early_bird_fee < entry_fee
      AND early_bird_deadline <= registration_deadline)
  );

CREATE OR REPLACE FUNCTION public.guard_tournament_registration() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE t public.tournaments;
BEGIN
 SELECT * INTO t FROM public.tournaments WHERE id=NEW.tournament_id FOR UPDATE;
 IF TG_OP='INSERT' THEN
  IF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) THEN RAISE EXCEPTION 'The bracket has started; registration is closed.'; END IF;
  NEW.amount_due := CASE
    WHEN t.status = 'upcoming' AND t.early_bird_fee IS NOT NULL
      AND t.early_bird_deadline > clock_timestamp()
      AND t.registration_deadline > clock_timestamp()
    THEN t.early_bird_fee ELSE t.entry_fee END;
  NEW.payment_status:=CASE WHEN NEW.amount_due>0 THEN 'pending' ELSE 'not_required' END;
 ELSIF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) AND (
  NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.amount_due IS DISTINCT FROM OLD.amount_due OR NEW.roster_details IS DISTINCT FROM OLD.roster_details OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.captain_id IS DISTINCT FROM OLD.captain_id) THEN RAISE EXCEPTION 'Team eligibility and roster are locked after bracket generation.';
 END IF;
 IF NEW.status='approved' AND NEW.amount_due>0 AND NEW.payment_status<>'verified' THEN RAISE EXCEPTION 'Verify payment before approving this team.'; END IF;
 RETURN NEW;
END $$;
