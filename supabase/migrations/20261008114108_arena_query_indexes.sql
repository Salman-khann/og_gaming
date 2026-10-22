CREATE INDEX registrations_team_idx ON public.registrations (team_id);
CREATE INDEX teams_captain_idx ON public.teams (captain_id);
DROP POLICY "Authenticated users can create match requests" ON public.match_requests;
CREATE POLICY "Players create their own matches" ON public.match_requests FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = creator_id);

-- One select policy per table; cache request-scoped identity/role lookups.
DROP POLICY "Admins can manage tournaments" ON public.tournaments;
DROP POLICY "Published tournaments or admin" ON public.tournaments;
CREATE POLICY "Published tournaments or admin" ON public.tournaments FOR SELECT TO anon, authenticated USING (status <> 'draft' OR (SELECT public.is_admin()));
CREATE POLICY "Admins insert tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admins update tournaments" ON public.tournaments FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admins delete tournaments" ON public.tournaments FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY "Admins can manage all registrations" ON public.registrations;
DROP POLICY "Anyone can view approved registrations" ON public.registrations;
CREATE POLICY "Approved registrations, own teams or admin" ON public.registrations FOR SELECT TO anon, authenticated USING (status = 'approved' OR (SELECT auth.uid()) = captain_id OR (SELECT public.is_admin()));
-- Registration mutations go through the verified server/RPC operations only.
REVOKE INSERT, UPDATE, DELETE ON public.registrations FROM anon, authenticated;
NOTIFY pgrst, 'reload schema';
