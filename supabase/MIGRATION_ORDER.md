# Migration Order — HustleBricks Supabase

`CONSOLIDATED_SETUP.sql` (generated 2026-07-19) is the one canonical file: paste it into
the Supabase SQL editor on a **fresh/empty project** and run it once. It contains every
migration below in dependency order, plus a reset preamble and a gap-fill section for
objects that were only ever created ad-hoc in the dashboard.

**Warning:** its Section 0 drops the entire `public` schema. Only run on a fresh project
or one you intend to wipe.

**Manual steps after running** (dashboard UI, cannot be done in SQL):

1. Storage bucket `lead-photos` (public read) — canvassing lead photos
2. Storage bucket `signatures` (public read) — job completion signatures

---

## Order used (with one-line purpose)

| # | File | Purpose |
|---|------|---------|
| 0 | *(reset preamble)* | Drop + recreate `public` schema, restore Supabase grants/default privileges |
| 1 | `schema.sql` | Base: profiles (+signup trigger on auth.users), businesses, clients, services, quotes, team_members, jobs, payments |
| 2 | `employee_feature.sql` | Access codes, pending flag, time_entries, employee RLS, join/lookup RPCs |
| 3 | `route_optimization.sql` | `jobs.route_order` + index |
| 4 | `canvassing.sql` | canvassing_properties (door-knocking map) |
| 5 | `google_calendar.sql` | google_calendar_tokens |
| 6 | `new_features.sql` | expenses, GPS check-in, signature_url, odometer columns |
| 7 | `booking_scheduling.sql` | scheduling_settings, blocked_dates, booking_requests |
| 8 | `leads_table.sql` | leads table |
| 9 | `add_business_type.sql` | `businesses.business_type` |
| 10 | `onboarding_v2.sql` | Profile names/phone; country/currency/plan/Stripe sub columns |
| 11 | `canvassing_visits.sql` | canvassing_visits history |
| 12 | `canvassing_enhancements.sql` | Lead extra columns, canvassing_custom_fields, lead_photos |
| 13 | `analytics_fields.sql` | `jobs.service_type`, `clients.lead_source` |
| 14 | `employee_availability.sql` | employee_availability, business_crew_settings |
| 15 | `stripe_connect.sql` | Stripe Connect columns, client_billing_subscriptions |
| 16 | `employee_availability_self_edit.sql` | Employees manage own availability policy |
| 17 | `employee_blocked_dates.sql` | employee_blocked_dates |
| 18 | `job_crew_and_duration.sql` | `jobs.duration_mins`, job_crew table |
| 19 | `per_job_crew_size.sql` | `jobs.crew_size` |
| 20 | `smart_scheduling_default.sql` | Smart scheduling default ON |
| 21 | `bnpl_financing.sql` | Financing config columns |
| 22 | `commission_leaderboard.sql` | `team_members.commission_rate` |
| 23 | `inventory.sql` | inventory_items / assignments / usage + trigger |
| 24 | `job_profitability.sql` | `team_members.hourly_rate` |
| 25 | `lead_scoring.sql` | AI score columns on leads |
| 26 | `mileage_tracking.sql` | home_address, mileage rate, daily_mileage |
| 27 | `pipeline_velocity.sql` | `businesses.stale_quote_days` |
| 28 | `preset_crews.sql` | preset_crews, preset_crew_members, checkout_group_id (needs #23) |
| 29 | `sms_automation.sql` | Review/lead-notify flags, sms_queue (**must precede #30**) |
| 30 | `quote_follow_ups.sql` | sent_at triggers, quote_follow_up_sends (FK → sms_queue) |
| 31 | `rebooking_campaign.sql` | Rebooking flags, `clients.last_rebooking_sent_at` |
| 32 | `sms_inbox.sql` | `businesses.twilio_number`, sms_messages |
| 33 | `territory_assignments.sql` | ZIP-to-rep territory table |
| 34 | `company_profile.sql` | address / website / invoice message / terms columns |
| 35 | `book_slug.sql` | `businesses.slug` + index |
| 36 | `canvassing_booking_rpc.sql` | create_canvassing_booking RPC (needs is_pending from #2) |
| 37 | **GAP-FILL (reconstructed)** | See below — must precede #38–#40 |
| 38 | `messaging_and_service_areas.sql` | service_areas, team_messages columns/policies, team_groups/messages/broadcasts, realtime publication |
| 39 | `rls_tenant_scoping.sql` | Drops cross-tenant `USING (true)` policies; get_business_service_areas RPC (needs service_areas from #38... actually #38 runs first; also needs `city` from #37) |
| 40 | `customization.sql` | Theme/nav/dashboards/custom fields/automations; extends message_templates (needs #37) |
| 41 | `onboarding_v3.sql` | Guided-setup progress/profile/goals columns |
| 42 | `RUN_ME_launch_migrations.sql` *(unique part only)* | `payments_stripe_payment_id_uidx` unique index |
| 43 | *(verification)* | Table count + table list |

## Superseded / skipped files

| File | Status |
|------|--------|
| `RUN_ME_launch_migrations.sql` | 95% duplicate of `stripe_connect.sql` + `rls_tenant_scoping.sql` + `book_slug.sql` + `canvassing_enhancements.sql` (content identical, just wrapped with `DROP POLICY IF EXISTS`). Those copies skipped; only its unique `payments_stripe_payment_id_uidx` index included (step 42). |

No statements had to be commented out — the objects that would have errored were
reconstructed instead (below).

## Gap-fill: reconstructed objects (step 37)

These are used by the app and/or ALTERed by later migrations, but **no .sql file in the
repo ever created them** — they were created ad-hoc in the Supabase dashboard and lost
when the project was reset. Reconstructed from app-code usage:

| Object | Why needed | Reconstructed from |
|--------|-----------|--------------------|
| `businesses.city` | `get_business_service_areas()` in `rls_tenant_scoping.sql` references it (SQL-language function → validated at creation) | `src/app/onboarding/save.ts` |
| `businesses.payment_reminders_enabled` (default true) | payment-reminders cron + settings toggle | `src/app/api/cron/payment-reminders/route.ts` |
| `businesses.auto_invoice_enabled` (default true) | invoice-notify API + settings toggle | `src/app/api/invoice/notify/route.ts` |
| `businesses.morning_briefing_enabled` (default false) | morning-briefing cron | `src/app/api/cron/morning-briefing/route.ts` |
| `businesses.ai_sms_enabled` (default false) | AI SMS auto-reply webhook | `src/app/api/sms/webhook/route.ts` |
| `team_messages` table | `messaging_and_service_areas.sql` ALTERs it and adds policies + realtime | `src/app/employee/messages/page.tsx`, `src/app/(dashboard)/messages/*` |
| `message_templates` table | `customization.sql` ALTERs it; `message_template_versions` FKs to it | `src/app/(dashboard)/settings/SettingsClient.tsx` (upsert on `business_id,service_type,message_type`), `src/lib/automated-messages.ts` |
| `worker_availability` table | Owner calendar availability | DDL copied **verbatim** from the in-app setup helper in `src/app/(dashboard)/calendar/CalendarClient.tsx` |
| `service_plans` table | /plans page + analytics MRR | `src/app/(dashboard)/plans/PlansClient.tsx` |
| `competitor_intel` table | /intel page + employee job intel capture | `src/app/employee/jobs/[id]/page.tsx`, `src/app/(dashboard)/intel/page.tsx` |
| `payment_reminder_sends` table | Payment-reminder cron dedupe log | `src/app/api/cron/payment-reminders/route.ts` (added `unique(job_id, step)` mirroring `quote_follow_up_sends`) |

RLS on reconstructed tables follows the same owner/employee patterns as the captured
migrations. The exact original policies are unknown; if a feature behaves differently
than before the reset, check these first.

## Other fixes baked into the consolidated file

1. **schema.sql reorder** — `jobs` has an FK to `team_members`, but schema.sql defines
   team_members *after* jobs; on an empty DB that errors. The Team Members block was
   moved ahead of Jobs (statement text unchanged).
2. **sms_automation before quote_follow_ups** — `quote_follow_up_sends.sms_queue_id`
   FKs to `sms_queue`.
3. **Gap-fill before messaging/rls/customization** — those three files ALTER or
   reference the reconstructed objects.
4. **Reset preamble drops the auth trigger first** — `on_auth_user_created` lives on
   `auth.users`, outside the schema being dropped.

## Known residual risks

- Reconstructed tables (step 37) match the columns the app reads/writes, but original
  ad-hoc defaults, indexes, or extra columns can't be recovered from the repo.
- `alter publication supabase_realtime add table ...` (step 38) assumes the default
  Supabase realtime publication exists (it does on every standard project). Any *other*
  tables previously added to the publication by hand are dropped with the schema and
  are not re-added.
- The verification query at the end should report **53** tables.
