BEGIN;
DO $$
DECLARE actors uuid[]:='{}'; player uuid; i integer; squad jsonb; invitation jsonb; denied boolean;
BEGIN
 FOR i IN 1..7 LOOP
  player:=gen_random_uuid(); actors:=array_append(actors,player);
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(player,player::text||'@test.invalid','{}');
  UPDATE public.profiles SET faceit_id=player::text,faceit_level=10,faceit_elo=2500 WHERE id=player;
 END LOOP;
 SET LOCAL ROLE service_role;
 FOR i IN 2..7 LOOP
  squad:=public.community_action(actors[i],'create_team',jsonb_build_object('name','Membership limit fixture '||i));
  invitation:=public.community_action(actors[i],'invite',jsonb_build_object('team_id',squad->>'id','faceit_id',actors[1],'nickname','Consenting player'));
  IF i<7 THEN PERFORM public.community_action(actors[1],'accept',jsonb_build_object('invitation_id',invitation->>'id')); END IF;
 END LOOP;
 denied:=false;BEGIN PERFORM public.community_action(actors[1],'accept',jsonb_build_object('invitation_id',invitation->>'id'));EXCEPTION WHEN raise_exception THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Sixth accepted team bypassed limit';END IF;
 denied:=false;BEGIN PERFORM public.community_action(actors[1],'create_team','{"name":"Sixth via captain"}');EXCEPTION WHEN raise_exception THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Team creation bypassed accepted-team limit';END IF;
 denied:=false;BEGIN PERFORM public.post_arena_match(jsonb_build_object('creator_id',actors[1],'title','Wrong level host','type','gather_5v5','scheduled_time',now()+interval '1 day','min_faceit_level',1,'max_faceit_level',3,'target_players_count',10),'+923000000033');EXCEPTION WHEN raise_exception THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Restricted host bypassed verified level';END IF;
 RESET ROLE;UPDATE public.profiles SET faceit_id=NULL WHERE id=actors[1];SET LOCAL ROLE service_role;
 denied:=false;BEGIN PERFORM public.post_arena_match(jsonb_build_object('creator_id',actors[1],'title','Unlinked host','type','gather_5v5','scheduled_time',now()+interval '1 day','min_faceit_level',1,'max_faceit_level',3,'target_players_count',10),'+923000000034');EXCEPTION WHEN raise_exception THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Restricted host bypassed linked account requirement';END IF;
 IF (SELECT count(*) FROM public.faceit_refresh_candidates(100))>8 THEN RAISE EXCEPTION 'Refresh candidates are unbounded';END IF;
 RESET ROLE;
 IF has_function_privilege('anon','public.faceit_refresh_candidates(integer)','EXECUTE') THEN RAISE EXCEPTION 'Refresh candidates exposed publicly';END IF;
END $$;
ROLLBACK;
