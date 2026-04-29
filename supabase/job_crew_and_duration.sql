-- Add per-job duration in minutes (nullable — not all jobs have a set duration)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS duration_mins int;

-- Job crew: many-to-many between jobs and team_members
-- Tracks all employees assigned to a job (including secondary crew beyond assigned_member_id)
CREATE TABLE IF NOT EXISTS public.job_crew (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  team_member_id  uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  UNIQUE(job_id, team_member_id)
);

ALTER TABLE public.job_crew ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage job_crew"
  ON public.job_crew FOR ALL
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.businesses b ON b.id = j.business_id
      WHERE b.owner_id = auth.uid()
    )
  );

CREATE POLICY "employees view own job_crew"
  ON public.job_crew FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
  );
