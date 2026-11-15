BEGIN;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); unverified uuid:=gen_random_uuid(); event uuid:=gen_random_uuid(); guest uuid:=gen_random_uuid(); owned uuid:=gen_random_uuid(); claimed integer; first_slug text;
BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
 (a,'slug-owner@test.invalid',now(),'{}'),(b,'other-owner@test.invalid',now(),'{}'),(unverified,'unverified@test.invalid',NULL,'{}');
 UPDATE public.profiles SET faceit_nickname='Ali' WHERE id IN(a,b);
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(gen_random_uuid(),'another-ali@test.invalid','{"nickname":"Ali"}');
 SELECT public_slug INTO first_slug FROM public.profiles WHERE id=a;
 IF first_slug IS NULL OR (SELECT count(*) FROM public.profiles WHERE public_slug IS NULL)>0 THEN RAISE EXCEPTION 'Missing player slug'; END IF;
 UPDATE public.profiles SET public_slug='steal-a-slug' WHERE id=a;
 IF (SELECT public_slug FROM public.profiles WHERE id=a)<>first_slug THEN RAISE EXCEPTION 'Slug was mutable'; END IF;
 IF NOT has_column_privilege('anon','public.profiles','public_slug','SELECT') THEN RAISE EXCEPTION 'Public slug unreadable'; END IF;
 IF has_function_privilege('anon','public.claim_my_guest_applications()','EXECUTE') THEN RAISE EXCEPTION 'Guest claims publicly callable'; END IF;
 INSERT INTO public.tournaments(id,title,slug,game,format,min_level,max_level,max_teams,start_date,registration_deadline,status)
 VALUES(event,'Account fixture','account-fixture','CS2','5v5',1,10,16,now()+interval '20 days',now()+interval '10 days','upcoming');
 INSERT INTO public.registrations(id,tournament_id,captain_id,team_name,roster_details) VALUES
 (guest,event,NULL,'Guest team','[{},{},{},{},{}]'),(owned,event,b,'Already owned','[{},{},{},{},{}]');
 INSERT INTO public.registration_contacts(registration_id,captain_name,email,phone,delete_token_hash) VALUES
 (guest,'Captain','SLUG-OWNER@test.invalid','+923001234567',repeat('a',64)),
 (owned,'Captain','slug-owner@test.invalid','+923001234568',repeat('b',64));
 PERFORM set_config('request.jwt.claim.sub',unverified::text,true);
 IF public.claim_my_guest_applications()<>0 THEN RAISE EXCEPTION 'Unverified account claimed guest entry'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 claimed:=public.claim_my_guest_applications();
 IF claimed<>1 OR (SELECT captain_id FROM public.registrations WHERE id=guest)<>a THEN RAISE EXCEPTION 'Verified guest claim failed'; END IF;
 IF (SELECT captain_id FROM public.registrations WHERE id=owned)<>b THEN RAISE EXCEPTION 'Existing ownership stolen'; END IF;
 IF public.claim_my_guest_applications()<>0 THEN RAISE EXCEPTION 'Claim not idempotent'; END IF;
END $$;
ROLLBACK;
