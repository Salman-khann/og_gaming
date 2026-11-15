ALTER TABLE public.profiles ADD COLUMN public_slug text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_public_slug_unique UNIQUE(public_slug);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_public_slug_format CHECK(public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

CREATE FUNCTION arena_private.assign_player_slug() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE base text; candidate text; suffix integer:=1;
BEGIN
 IF TG_OP='UPDATE' AND OLD.public_slug IS NOT NULL THEN NEW.public_slug:=OLD.public_slug; RETURN NEW; END IF;
 -- Serialize allocation, including collisions between a base and another base's suffix.
 PERFORM pg_advisory_xact_lock(136447215);
 base:=trim(both '-' from regexp_replace(lower(left(NEW.faceit_nickname,60)),'[^a-z0-9]+','-','g'));
 IF base='' THEN base:='player'; END IF;
 candidate:=base;
 WHILE EXISTS(SELECT 1 FROM public.profiles WHERE public_slug=candidate) LOOP
  suffix:=suffix+1; candidate:=base||'-'||suffix;
 END LOOP;
 NEW.public_slug:=candidate; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION arena_private.assign_player_slug() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER assign_player_slug BEFORE INSERT OR UPDATE OF public_slug ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION arena_private.assign_player_slug();
DO $$ DECLARE player record; BEGIN
 FOR player IN SELECT id FROM public.profiles ORDER BY created_at,id LOOP
  UPDATE public.profiles SET public_slug=NULL WHERE id=player.id;
 END LOOP;
END $$;
ALTER TABLE public.profiles ALTER COLUMN public_slug SET NOT NULL;
GRANT SELECT(public_slug) ON public.profiles TO anon,authenticated;
NOTIFY pgrst,'reload schema';
