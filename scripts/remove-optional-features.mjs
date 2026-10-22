import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const edit=(path,fn)=>writeFileSync(path,fn(readFileSync(path,'utf8')));
edit('src/components/Navbar.tsx',s=>s.replace('<Link href="/memberships">Memberships</Link>',''));
edit('src/components/CommunityWorkspace.tsx',s=>s.replace('<Link className="button secondary" href="/memberships">Memberships</Link>',''));
edit('src/components/OperationsPanel.tsx',s=>s.split('\n').filter(line=>!/[{]section==='(?:plans|promotions|memberships|disputes)'/.test(line)).join('\n')
 .replace("['players','teams','memberships','plans','promotions','analytics','disputes','notifications','content','audit']","['players','teams','analytics','notifications','content']")
 .replace('<label className="field">Reason<input name="reason" required maxLength={1000}/></label>',''));
edit('src/components/TournamentBracket.tsx',s=>s.split('\n').filter(line=>!line.includes("import {useAuth}")&&!line.includes('const captain=')&&!line.includes('{captain&&')&&!line.includes('{disputeId&&')).join('\n')
 .replace('const {profile}=useAuth();','').replace(",[disputeId,setDisputeId]=useState('')",'').replace("setDisputeId('');",''));
edit('src/components/TournamentsView.tsx',s=>s.replace(",promo_code:form.get('promo_code')",'').replace('<label>Promo / referral code (optional)<input name="promo_code" maxLength={30}/></label>',''));
edit('src/app/api/tournaments/route.ts',s=>s.replace("rpc('register_team_entry'","rpc('register_owned_team'").replace(",promo_code:typeof body.promo_code==='string'?body.promo_code.slice(0,30):''",'').replace('This team, captain or promo code is already registered.','This team or captain is already registered.'));
edit('src/app/api/admin/operations/route.ts',s=>{
 const from=s.indexOf("    else if (body.action === 'save_plan')"); const to=s.indexOf("    } else if (body.action === 'save_content')",from);
 if(from<0||to<0)throw new Error('Admin actions not found');
 s=s.slice(0,from)+"    else if (body.action === 'save_content')"+s.slice(to+"    } else if (body.action === 'save_content')".length);
 s=s.replace("players:'profiles', memberships:'memberships', plans:'membership_plans', promotions:'promotions', notifications:'notifications_log', content:'site_content', audit:'admin_audit', teams:'teams', disputes:'match_disputes'","players:'profiles', notifications:'notifications_log', content:'site_content', teams:'teams'")
 .replace("section==='memberships'?'*,player:profiles!memberships_user_id_fkey(faceit_nickname)':",'')
 .replace("section === 'promotions' ? 'code' : 'created_at'","'created_at'").replace("section === 'promotions' ? 'code' : 'id'","'id'")
 .replace("reason:textField(body.reason,'reason',1000)","reason:'Role management'");
 s=s.replace(/    const items=section==='memberships'[^\n]+\n/,'    const items=records;\n');return s;
});
for(const path of ['src/app/memberships/page.tsx','src/app/api/memberships/route.ts','src/app/api/disputes/route.ts','src/components/MembershipsWorkspace.tsx'])unlinkSync(path);
for(const path of ['tests/http-smoke.test.mjs','scripts/check-feature-api.mjs'])edit(path,s=>s.replace(",'/memberships'",'').replace(",'/api/memberships'",'').replace('ten public pages','nine public pages'));
edit('tests/deployment-readonly.mjs',s=>s.replace("'membership_plans', ",'').replace(", 'memberships', 'promotions'",'').replace(", 'match_disputes'",'').replace(", 'admin_audit'",'').replace("table === 'promotions' ? 'code' : 'id'","'id'"));
edit('tests/community.sql',s=>s.split('\n').filter(line=>!line.includes('INSERT INTO public.promotions')&&!line.includes('Role audit missing')).join('\n')
 .replace(/ plan uuid:=gen_random_uuid\(\); pass jsonb;/,'')
 .replace("public.register_team_entry(captain,event,(squad->>'id')::uuid,roster,'TEST50')","public.register_owned_team(captain,event,(squad->>'id')::uuid,roster)")
 .replace("<>500 THEN RAISE EXCEPTION 'Tournament discount incorrect'","<>1000 THEN RAISE EXCEPTION 'Tournament fee incorrect'")
 .replace(/ INSERT INTO public.membership_plans[\s\S]*?(?= denied:=false;BEGIN PERFORM public.community_action\(admin_id,'set_role')/,''));
edit('tests/operations.sql',s=>s.replace(' dispute uuid;','').replace(/ denied:=false;BEGIN PERFORM public.dispute_action[\s\S]*?(?= PERFORM public.record_competition_result\(game,13,7\);\r?\n FOR notice)/,'').replace(' denied boolean;',''));
