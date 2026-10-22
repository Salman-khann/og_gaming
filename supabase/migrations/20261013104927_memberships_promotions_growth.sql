CREATE TABLE public.membership_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 price numeric(10,2) NOT NULL CHECK(price>=0), duration_days integer NOT NULL CHECK(duration_days BETWEEN 1 AND 366),
 gaming_minutes integer NOT NULL CHECK(gaming_minutes BETWEEN 0 AND 60000), perks text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.promotions (
 code text PRIMARY KEY CHECK(code ~ '^[A-Z0-9-]{3,30}$'), discount_percent integer NOT NULL CHECK(discount_percent BETWEEN 1 AND 100),
 max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 100000), uses integer NOT NULL DEFAULT 0,
 owner_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.promotion_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL REFERENCES public.promotions(code),
 user_id uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(code,user_id)
);
CREATE TABLE public.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
 name text NOT NULL, amount_due numeric(10,2) NOT NULL CHECK(amount_due>=0), duration_days integer NOT NULL,
 remaining_minutes integer NOT NULL CHECK(remaining_minutes>=0), status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','active','cancelled')),
 starts_at timestamptz, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), verified_by uuid REFERENCES public.profiles(id)
);
CREATE TABLE public.membership_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), membership_id uuid NOT NULL REFERENCES public.memberships(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 minutes integer NOT NULL CHECK(minutes>0), note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promotion_redemptions_user_idx ON public.promotion_redemptions(user_id);
CREATE INDEX memberships_user_idx ON public.memberships(user_id,created_at DESC);
CREATE INDEX memberships_plan_idx ON public.memberships(plan_id);
CREATE INDEX memberships_verifier_idx ON public.memberships(verified_by);
CREATE INDEX membership_usage_membership_idx ON public.membership_usage(membership_id);
CREATE INDEX membership_usage_actor_idx ON public.membership_usage(actor_id);
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_plans,public.promotions,public.promotion_redemptions,public.memberships,public.membership_usage FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.membership_plans,public.promotions,public.promotion_redemptions,public.memberships,public.membership_usage TO service_role;
GRANT SELECT ON public.membership_plans TO anon,authenticated;
GRANT SELECT ON public.memberships TO authenticated;
CREATE POLICY "Active membership plans" ON public.membership_plans FOR SELECT TO anon,authenticated USING(active OR (SELECT public.is_admin()));
CREATE POLICY "Own memberships or admin" ON public.memberships FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE FUNCTION public.redeem_promotion(actor_id uuid,promo_code text,price numeric) RETURNS numeric
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE promo public.promotions;
BEGIN
 IF coalesce(trim(promo_code),'')='' THEN RETURN price; END IF;
 SELECT * INTO promo FROM public.promotions WHERE code=upper(trim(promo_code)) FOR UPDATE;
 IF promo.code IS NULL OR NOT promo.active OR promo.expires_at<=now() OR promo.uses>=promo.max_uses OR promo.owner_id=actor_id THEN RAISE EXCEPTION 'This promo or referral code is unavailable.'; END IF;
 INSERT INTO public.promotion_redemptions(code,user_id) VALUES(promo.code,actor_id);
 UPDATE public.promotions SET uses=uses+1 WHERE code=promo.code;
 RETURN round(price*(100-promo.discount_percent)/100,2);
END $$;
REVOKE ALL ON FUNCTION public.redeem_promotion(uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promotion(uuid,text,numeric) TO service_role;

CREATE FUNCTION public.register_team_entry(actor_id uuid,event_id uuid,squad_id uuid,verified_roster jsonb,promo_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; reg public.registrations; price numeric;
BEGIN
 result:=public.register_owned_team(actor_id,event_id,squad_id,verified_roster);
 price:=public.redeem_promotion(actor_id,promo_code,(result->>'amount_due')::numeric);
 UPDATE public.registrations SET amount_due=price,payment_status=CASE WHEN price=0 THEN 'not_required' ELSE 'pending' END WHERE id=(result->>'id')::uuid RETURNING * INTO reg;
 RETURN to_jsonb(reg);
END $$;
REVOKE ALL ON FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_tournament_registration() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE t public.tournaments;
BEGIN
 SELECT * INTO t FROM public.tournaments WHERE id=NEW.tournament_id FOR UPDATE;
 IF TG_OP='INSERT' THEN
  IF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) THEN RAISE EXCEPTION 'The bracket has started; registration is closed.'; END IF;
  NEW.amount_due:=t.entry_fee;
  NEW.payment_status:=CASE WHEN NEW.amount_due>0 THEN 'pending' ELSE 'not_required' END;
 ELSIF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) AND (
  NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.amount_due IS DISTINCT FROM OLD.amount_due OR NEW.roster_details IS DISTINCT FROM OLD.roster_details OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.captain_id IS DISTINCT FROM OLD.captain_id) THEN RAISE EXCEPTION 'Team eligibility and roster are locked after bracket generation.';
 END IF;
 IF NEW.status='approved' AND NEW.amount_due>0 AND NEW.payment_status<>'verified' THEN RAISE EXCEPTION 'Verify payment before approving this team.'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.membership_action(actor_id uuid,action_name text,payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor public.profiles; plan public.membership_plans; member public.memberships; minutes integer; price numeric;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>'banned';
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Account access required.'; END IF;
 IF action_name='request' THEN
  PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
  IF (SELECT count(*) FROM public.memberships WHERE user_id=actor.id AND status='pending')>=3 THEN RAISE EXCEPTION 'You already have three pending membership requests.'; END IF;
  SELECT * INTO plan FROM public.membership_plans WHERE id=(payload->>'plan_id')::uuid AND active FOR SHARE;
  IF plan.id IS NULL THEN RAISE EXCEPTION 'This membership plan is unavailable.'; END IF;
  price:=public.redeem_promotion(actor.id,payload->>'promo_code',plan.price);
  INSERT INTO public.memberships(user_id,plan_id,name,amount_due,duration_days,remaining_minutes,status,starts_at,expires_at)
  VALUES(actor.id,plan.id,plan.name,price,plan.duration_days,plan.gaming_minutes,CASE WHEN price=0 THEN 'active' ELSE 'pending' END,CASE WHEN price=0 THEN now() END,CASE WHEN price=0 THEN now()+make_interval(days=>plan.duration_days) END) RETURNING * INTO member;
  RETURN to_jsonb(member);
 END IF;
 IF actor.role<>'admin' THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO member FROM public.memberships WHERE id=(payload->>'membership_id')::uuid FOR UPDATE;
 IF member.id IS NULL THEN RAISE EXCEPTION 'Membership not found.'; END IF;
 IF action_name='verify' THEN
  IF member.status<>'pending' THEN RAISE EXCEPTION 'Only pending memberships can be verified.'; END IF;
  UPDATE public.memberships SET status='active',starts_at=now(),expires_at=now()+make_interval(days=>duration_days),verified_by=actor.id WHERE id=member.id RETURNING * INTO member;
 ELSIF action_name='use_minutes' THEN
  minutes:=(payload->>'minutes')::integer;
  IF member.status<>'active' OR member.expires_at<=now() OR minutes IS NULL OR minutes<=0 OR minutes>member.remaining_minutes OR length(trim(coalesce(payload->>'note','')))=0 THEN RAISE EXCEPTION 'Enter valid minutes and a note for an active pass.'; END IF;
  UPDATE public.memberships SET remaining_minutes=remaining_minutes-minutes WHERE id=member.id RETURNING * INTO member;
  INSERT INTO public.membership_usage(membership_id,actor_id,minutes,note) VALUES(member.id,actor.id,minutes,left(payload->>'note',500));
 ELSIF action_name='cancel' THEN
  IF member.status<>'pending' THEN RAISE EXCEPTION 'Only pending requests can be cancelled.'; END IF;
  UPDATE public.memberships SET status='cancelled' WHERE id=member.id RETURNING * INTO member;
 ELSE RAISE EXCEPTION 'Unknown membership action.';
 END IF;
 RETURN to_jsonb(member);
END $$;
REVOKE ALL ON FUNCTION public.membership_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.membership_action(uuid,text,jsonb) TO service_role;
CREATE TRIGGER membership_admin_notice AFTER INSERT ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();

CREATE TABLE public.site_content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN('sponsor','gallery','stream')),
 title text NOT NULL, url text NOT NULL, image_url text, published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_content FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.site_content TO anon,authenticated;
GRANT ALL ON public.site_content TO service_role;
CREATE POLICY "Published growth content" ON public.site_content FOR SELECT TO anon,authenticated USING(published OR (SELECT public.is_admin()));
NOTIFY pgrst,'reload schema';

ALTER TABLE public.profiles ADD COLUMN last_active_at timestamptz;
CREATE INDEX profiles_active_idx ON public.profiles(last_active_at) WHERE last_active_at IS NOT NULL;
CREATE FUNCTION public.arena_analytics() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'players',(SELECT count(*) FROM public.profiles WHERE role<>'banned'),
  'active_players_30d',(SELECT count(*) FROM public.profiles WHERE role<>'banned' AND last_active_at>now()-interval '30 days'),
  'teams',(SELECT count(*) FROM public.teams),
  'tournaments',(SELECT count(*) FROM public.tournaments WHERE status<>'draft'),
  'registration_revenue',(SELECT coalesce(sum(amount_due),0) FROM public.registrations WHERE payment_status='verified'),
  'membership_revenue',(SELECT coalesce(sum(amount_due),0) FROM public.memberships WHERE status='active'),
  'approved_teams',(SELECT count(*) FROM public.registrations WHERE status='approved'),
  'checked_in_teams',(SELECT count(*) FROM public.registrations WHERE checked_in),
  'no_shows',(SELECT count(*) FROM public.registrations WHERE no_show),
  'peak_match_hours',(SELECT coalesce(jsonb_agg(row),'[]'::jsonb) FROM(SELECT extract(hour FROM scheduled_time AT TIME ZONE 'Asia/Karachi')::integer AS hour,count(*) AS matches FROM public.match_history GROUP BY hour ORDER BY matches DESC LIMIT 5) row)
 );
$$;
REVOKE ALL ON FUNCTION public.arena_analytics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arena_analytics() TO service_role;
