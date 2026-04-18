-- HustleBricks: Employee Availability & Crew Settings
-- Run this in the Supabase SQL editor.
-- Enables employee-based booking capacity on the client portal calendar.

-- ─── Employee Availability ───────────────────────────────────────────────────
-- Each row = one employee's available hours on one day of the week.
-- Multiple rows per employee (one per available day).
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

CREATE TABLE IF NOT EXISTS public.employee_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week     int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  from_time       text NOT NULL,   -- e.g. "08:00"
  until_time      text NOT NULL,   -- e.g. "17:00"
  UNIQUE(team_member_id, day_of_week)
);

ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage employee_availability"
  ON public.employee_availability FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Employees can view their own availability
CREATE POLICY "employees view own availability"
  ON public.employee_availability FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Portal needs to read employee availability to compute slot capacity
CREATE POLICY "public read employee_availability"
  ON public.employee_availability FOR SELECT
  USING (true);


-- ─── Business Crew Settings ──────────────────────────────────────────────────
-- crew_size: how many employees are needed per job/booking.
-- Capacity per slot = floor(available_employees_at_hour / crew_size) - accepted_bookings_at_slot

CREATE TABLE IF NOT EXISTS public.business_crew_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  crew_size    int NOT NULL DEFAULT 1 CHECK (crew_size >= 1),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.business_crew_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage business_crew_settings"
  ON public.business_crew_settings FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Portal needs to read crew size to compute slot capacity
CREATE POLICY "public read business_crew_settings"
  ON public.business_crew_settings FOR SELECT
  USING (true);
