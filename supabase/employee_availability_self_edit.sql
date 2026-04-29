-- HustleBricks: Allow employees to manage their own availability
-- Run this in the Supabase SQL editor.

-- Employees can now insert/update/delete their own availability rows
-- (SELECT is already covered by "public read employee_availability")
CREATE POLICY "employees manage own availability"
  ON public.employee_availability FOR ALL
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
  );
