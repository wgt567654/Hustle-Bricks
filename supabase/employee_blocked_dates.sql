-- HustleBricks: Employee Blocked Dates
-- Lets employees mark specific dates as unavailable (vacations, sick days, etc.)
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.employee_blocked_dates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  blocked_date    date NOT NULL,
  UNIQUE(team_member_id, blocked_date)
);

ALTER TABLE public.employee_blocked_dates ENABLE ROW LEVEL SECURITY;

-- Owners can manage blocked dates for all employees in their business
CREATE POLICY "owners manage employee_blocked_dates"
  ON public.employee_blocked_dates FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Employees can manage their own blocked dates
CREATE POLICY "employees manage own blocked_dates"
  ON public.employee_blocked_dates FOR ALL
  USING (
    team_member_id IN (SELECT id FROM public.team_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    team_member_id IN (SELECT id FROM public.team_members WHERE user_id = auth.uid())
  );

-- Portal reads blocked dates to grey out unavailable days
CREATE POLICY "public read employee_blocked_dates"
  ON public.employee_blocked_dates FOR SELECT
  USING (true);
