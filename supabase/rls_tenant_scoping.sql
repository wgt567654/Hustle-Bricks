-- HustleBricks: RLS Tenant Scoping Fix (launch-plan task 5.3)
-- Run this in the Supabase SQL editor. Idempotent (drop if exists + create).
--
-- WHAT THIS FIXES
-- Earlier migrations created `FOR SELECT USING (true)` policies on six tables,
-- which let ANY user with the anon key read EVERY business's rows:
--   * booking_requests        (booking_scheduling.sql)      <- WORST: leaked client ids,
--                                                              requested dates/times, notes
--                                                              across all businesses
--   * scheduling_settings     (booking_scheduling.sql)
--   * blocked_dates           (booking_scheduling.sql)
--   * employee_availability   (employee_availability.sql)
--   * business_crew_settings  (employee_availability.sql)
--   * employee_blocked_dates  (employee_blocked_dates.sql)
--
-- WHY THE PUBLIC BOOKING FLOW KEEPS WORKING
--   * /book/[slug] page, /api/booking/capacity, and /api/booking/public all use
--     the SERVICE ROLE key server-side, which bypasses RLS entirely.
--   * /api/booking (portal booking submit) only INSERTs into booking_requests;
--     the "public insert booking_requests" policy is untouched by this file.
--   * The client portal server component (/portal/[clientId]) reads
--     scheduling_settings + blocked_dates with the anon key; those two tables
--     contain no PII (weekday hours and greyed-out dates only), so they keep a
--     deliberate, documented public-read policy below.
--   * Employees keep reading their own rows via the pre-existing
--     "employees view own availability" and "employees manage own blocked_dates"
--     policies (untouched).
--
-- KNOWN BEHAVIOR CHANGE
--   The portal page also read booking_requests with the anon key to show the
--   client's latest pending/declined request banner. That read now returns 0
--   rows (banner simply won't render). Booking submission is unaffected.
--   Follow-up (code, not SQL): have /portal/[clientId]/page.tsx fetch that one
--   query with a service-role client, scoped to the clientId in the URL.
--
-- VERIFICATION (run after applying)
--   -- 1. As an authenticated user who owns Business A, in the SQL editor
--   --    impersonation or via the app: you still see only Business A's rows.
--   -- 2. Simulate a foreign/anon user (SQL editor):
--   --      set local role anon;                       -- or 'authenticated'
--   --      select set_config('request.jwt.claims',
--   --        '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
--   --      select count(*) from public.booking_requests;        -- expect 0
--   --      select count(*) from public.employee_availability;   -- expect 0
--   --      select count(*) from public.business_crew_settings;  -- expect 0
--   --      select count(*) from public.employee_blocked_dates;  -- expect 0
--   --      reset role;

-- ─── booking_requests: remove cross-tenant read entirely ─────────────────────
-- Owners already have full access via "owners manage booking_requests" (FOR ALL).
-- Anonymous inserts still work via "public insert booking_requests" (FOR INSERT).
-- No one but the owning business may SELECT.

DROP POLICY IF EXISTS "public read booking_requests" ON public.booking_requests;

-- ─── business_crew_settings: owner-only ──────────────────────────────────────
-- Only readers: /api/booking/capacity (service role, bypasses RLS) and the
-- owner dashboard settings/calendar pages (covered by the owners FOR ALL policy).

DROP POLICY IF EXISTS "public read business_crew_settings" ON public.business_crew_settings;

-- ─── employee_availability: owner + own-employee only ────────────────────────
-- Only readers: /api/booking/capacity and lib/dispatch.ts (both service role),
-- owner dashboard team/job pages (owners FOR ALL policy), and the employee
-- schedule page reading its OWN rows (existing "employees view own availability"
-- policy, which stays in place).

DROP POLICY IF EXISTS "public read employee_availability" ON public.employee_availability;

-- Tighten the employee self-read to active members and recreate it explicitly
-- so this file fully defines who can read the table.
DROP POLICY IF EXISTS "employees view own availability" ON public.employee_availability;
CREATE POLICY "employees view own availability"
  ON public.employee_availability FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- ─── employee_blocked_dates: owner + own-employee only ───────────────────────
-- Only readers: owner dashboard team page (owners FOR ALL policy) and the
-- employee schedule page reading its OWN rows (existing
-- "employees manage own blocked_dates" FOR ALL policy, which stays in place).

DROP POLICY IF EXISTS "public read employee_blocked_dates" ON public.employee_blocked_dates;

-- ─── scheduling_settings: intentionally public-readable (non-sensitive) ──────
-- The anonymous client portal (/portal/[clientId], anon key server component)
-- must read weekday hours to render the booking calendar. Rows contain only
-- unavailable_days + day_hours per business — no client or booking data.
-- Recreated (same effective grant) so the decision is documented here.

DROP POLICY IF EXISTS "public read scheduling_settings" ON public.scheduling_settings;
CREATE POLICY "public read scheduling_settings"
  ON public.scheduling_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─── blocked_dates: intentionally public-readable (non-sensitive) ────────────
-- Same reasoning: the anonymous portal greys out blocked calendar days.
-- Rows contain only (business_id, blocked_date).

DROP POLICY IF EXISTS "public read blocked_dates" ON public.blocked_dates;
CREATE POLICY "public read blocked_dates"
  ON public.blocked_dates FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Employee-safe business info (added with launch-plan 1.4/5.3 follow-up) ──
-- Employees have no SELECT on businesses (whole row would expose the access
-- code and Stripe fields). This security-definer RPC returns only the two
-- columns the employee home screen needs for weather alerts.
create or replace function public.get_business_service_areas()
returns table (service_areas text[], city text)
language sql
security definer
set search_path = public
as $$
  select b.service_areas, b.city
  from businesses b
  where b.owner_id = auth.uid()
     or exists (
       select 1 from team_members tm
       where tm.business_id = b.id
         and tm.user_id = auth.uid()
         and tm.is_active = true
     )
  limit 1;
$$;
