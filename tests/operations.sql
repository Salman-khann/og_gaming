BEGIN;
DO $$
DECLARE users uuid[]:='{}'; player uuid; i integer; m jsonb; squad_a jsonb; squad_b jsonb; invite jsonb; event uuid:=gen_random_uuid(); absent_team uuid:=gen_random_uuid(); entry uuid:=gen_random_uuid(); game uuid:=gen_random_uuid(); other_entry uuid:=gen_random_uuid(); notice public.notifications_log;
BEGIN
 FOR i IN 1..10 LOOP
  player:=gen_random_uuid();users:=array_append(users,player);
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(player,player::text||'@test.invalid','{}');
  UPDATE public.profiles SET faceit_id=player::text,faceit_elo=900+i*100,faceit_level=5 WHERE id=player;
 END LOOP;
 UPDATE public.profiles SET role='admin' WHERE id=users[10];
 SET LOCAL ROLE service_role;
 m:=public.post_arena_match(jsonb_build_object('creator_id',users[1],'title','Balanced fixture','type','gather_5v5','scheduled_time',now()+interval '1 day','min_faceit_level',1,'max_faceit_level',10,'target_players_count',10),'+923000000011');
 RESET ROLE;
 FOR i IN 2..10 LOOP
  PERFORM set_config('request.jwt.claim.sub',users[i]::text,true);SET LOCAL ROLE authenticated;PERFORM public.join_arena_match((m->>'id')::uuid);RESET ROLE;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.match_requests WHERE id=(m->>'id')::uuid AND jsonb_array_length(balanced_teams->'a')=5 AND jsonb_array_length(balanced_teams->'b')=5 AND (balanced_teams->>'difference')::numeric=100) THEN RAISE EXCEPTION 'Gather balance incorrect';END IF;
 DELETE FROM public.match_requests WHERE id=(m->>'id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.match_history WHERE id=(m->>'id')::uuid) THEN RAISE EXCEPTION 'Public summary disappeared with private contact';END IF;
 SET LOCAL ROLE service_role;
 squad_a:=public.community_action(users[1],'create_team','{"name":"Scrim A"}');squad_b:=public.community_action(users[6],'create_team','{"name":"Scrim B"}');
 FOR i IN 2..5 LOOP
  invite:=public.community_action(users[1],'invite',jsonb_build_object('team_id',squad_a->>'id','faceit_id',users[i],'nickname','A '||i));PERFORM public.community_action(users[i],'accept',jsonb_build_object('invitation_id',invite->>'id'));
 END LOOP;
 FOR i IN 7..10 LOOP
  invite:=public.community_action(users[6],'invite',jsonb_build_object('team_id',squad_b->>'id','faceit_id',users[i],'nickname','B '||i));PERFORM public.community_action(users[i],'accept',jsonb_build_object('invitation_id',invite->>'id'));
 END LOOP;
 RESET ROLE;PERFORM set_config('request.jwt.claim.sub',users[2]::text,true);SET LOCAL ROLE authenticated;
 IF (SELECT count(*) FROM public.team_members WHERE team_id=(squad_a->>'id')::uuid)<>5 THEN RAISE EXCEPTION 'Accepted player cannot see full team roster';END IF;
 IF EXISTS(SELECT 1 FROM public.team_members WHERE team_id=(squad_b->>'id')::uuid) THEN RAISE EXCEPTION 'Another squad roster leaked';END IF;
 RESET ROLE;SET LOCAL ROLE service_role;
 m:=public.post_team_match(jsonb_build_object('creator_id',users[1],'title','Team fixture','type','team_vs_team','scheduled_time',now()+interval '1 day','min_faceit_level',1,'max_faceit_level',10,'target_players_count',10),'+923000000012',(squad_a->>'id')::uuid);
 IF (m->>'current_players_count')::integer<>5 THEN RAISE EXCEPTION 'Team host not inserted as five';END IF;
 PERFORM public.join_arena_team(users[6],(m->>'id')::uuid,(squad_b->>'id')::uuid);
 IF NOT EXISTS(SELECT 1 FROM public.match_requests WHERE id=(m->>'id')::uuid AND current_players_count=10 AND status='matched') THEN RAISE EXCEPTION 'Two teams did not fill scrim';END IF;
 PERFORM public.delete_arena_post((m->>'id')::uuid);
 IF EXISTS(SELECT 1 FROM public.match_history WHERE id=(m->>'id')::uuid) OR EXISTS(SELECT 1 FROM public.match_requests WHERE id=(m->>'id')::uuid) THEN RAISE EXCEPTION 'Explicit deletion retained a post or public summary';END IF;
 INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status) VALUES(event,'Operations fixture',event::text,now()+interval '2 hours',now()+interval '1 hour','upcoming');
 INSERT INTO public.registrations(id,tournament_id,captain_id,team_name,roster_details,status,checked_in) VALUES(absent_team,event,users[2],'No-show','[{},{},{},{},{}]','approved',false),(entry,event,users[1],'Checked','[{},{},{},{},{}]','approved',true),(other_entry,event,users[6],'Opponent','[{},{},{},{},{}]','approved',true);
 UPDATE public.tournaments SET start_date=now()-interval '1 minute',registration_deadline=now()-interval '1 hour' WHERE id=event;
 PERFORM public.release_tournament_no_shows();
 IF NOT EXISTS(SELECT 1 FROM public.registrations WHERE id=absent_team AND status='approved' AND NOT no_show) OR NOT EXISTS(SELECT 1 FROM public.registrations WHERE id=entry AND status='approved') THEN RAISE EXCEPTION 'Retired no-show job rejected an approved team';END IF;
 INSERT INTO public.tournament_matches(id,tournament_id,round,position,team_a,team_b) VALUES(game,event,1,1,entry,other_entry);
 UPDATE public.tournaments SET status='ongoing' WHERE id=event;
 PERFORM public.record_competition_result(game,13,7);
 FOR notice IN SELECT * FROM public.claim_notifications() LOOP
  IF notice.lease_until IS NULL OR notice.attempts<>1 THEN RAISE EXCEPTION 'Queue lease not acquired';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.claim_notifications()) THEN RAISE EXCEPTION 'Another worker claimed leased notices';END IF;
 IF (public.arena_analytics()->>'checked_in_teams')::integer<>2 THEN RAISE EXCEPTION 'Attendance analytics incorrect';END IF;
 INSERT INTO public.faceit_leaderboard(faceit_id,nickname,level,elo) VALUES(users[1]::text,'Ranked one',5,1500),(users[3]::text,'Banned fixture',5,2000),(gen_random_uuid()::text,'Unrelated cache',5,3000);
 UPDATE public.profiles SET role='banned' WHERE id=users[3];
 RESET ROLE;SET LOCAL ROLE anon;
 IF jsonb_array_length(public.read_faceit_ranking(1,25)->'players')<>1 THEN RAISE EXCEPTION 'Ranking exposed banned or unrelated cached profiles';END IF;
 RESET ROLE;
END $$;
ROLLBACK;
