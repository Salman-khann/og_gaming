# Tournament match schedules

Apply `supabase/migrations/20261024110000_tournament_scheduling_without_checkin.sql` and then `supabase/migrations/20261024120000_password_protected_bracket_reset.sql` once to the existing database before deploying this update. New database installations should apply all migrations in filename order. Do not rerun the full setup script on an existing database.

Open a tournament's **Manage bracket → Match schedule**, choose the first play date and save. Every day, including weekends, is selected initially. The two fixed daily slots are **8:00 PM and 11:30 PM Pakistan time (Asia/Karachi)**. Play days can be changed for future events. Each tournament stores its own settings; no code edits or HTML uploads are needed.

For the supplied CS2 HTML schedule, choose **16 November 2026** and all seven days. A 20-team double-elimination bracket has 38 required matches: the grand final is scheduled for **4 December at 11:30 PM**, with an optional reset final reserved for **5 December at 8:00 PM**. The website uses its existing bracket progression; individual match IDs and opponents can differ from the supplied HTML.

Matches receive slots automatically in dependency order, with winners-bracket matches first when matches share a stage. Byes take no slots. Dates appear for later rounds before opponents are known. Results do not reassign dates; an unnecessary reset final loses its reservation. The schedule can be saved before generating the bracket and is locked while recorded results exist. A schedule is a planned start time; delays do not automatically push later matches.

Teams need organiser approval and verified payment where applicable. Check-in controls, time windows, attendance requirements and automatic rejection for missing check-in have been retired. Historical database fields remain for compatibility, and the old no-show cron target safely returns zero. Existing rejected applications stay rejected; organisers can review those individually.

## Password-protected reset

In the admin bracket view, **Reset bracket** prompts for the signed-in administrator's account password. The server verifies it with Supabase Auth and checks that the verified user is the same administrator. Attempts are rate limited. An email/password account is required; accounts using only an external login need an account password before using this action. Passwords are not persisted in browser storage. No separate reset-password environment variable is needed.

Reset permanently deletes this tournament's match graph, results and scorecard records, and attempts to remove their private image files. It keeps applications, approval/payment state and the saved schedule, returns the tournament to upcoming status, and allows choosing matchups and generating a fresh bracket. Registration still follows the existing registration deadline. Other tournaments are unaffected.
