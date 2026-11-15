# Tournament early-bird pricing

Apply `supabase/migrations/20261028192434_tournament_early_bird.sql` before deploying the application update. `supabase/setup.sql` includes the same migration for fresh installations. No hosted database has been changed as part of this implementation.

In Admin → Create/Edit tournament, set the regular entry fee, enable **Early-bird pricing**, and enter the discounted team fee and offer deadline in Pakistan time. The offer must cost less than the regular entry fee and finish no later than registration closes. A zero-price early-bird offer is supported.

Upcoming tournaments show a warm amber offer panel with savings, the crossed-out regular fee, and an explicit PKT deadline. The registration form shows the same offer. The database selects the price when the application is inserted; later changes or expiry do not alter an existing team's amount due. Disable the offer to return new applications to the regular fee immediately. The browser refreshes offer visibility with the existing 30-second tournament clock; database time is authoritative.

## Proposed homepage CTA

Place a compact **Next at OG** tournament spotlight immediately below the homepage hero, above the current arena section. Feature the nearest upcoming tournament with open registration, its name, date, prize pool and entry price. Show the same amber early-bird treatment while eligible, with **Register your team →** linking to the event and a quieter **All tournaments** link. When no event is open, use **Your next competition starts here** with **Explore tournaments →**, without an expired offer or invented countdown.

This homepage change is a proposal only.
