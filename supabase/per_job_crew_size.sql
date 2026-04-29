-- Add per-job crew size. Defaults to 1 for existing jobs.
-- The business-level crew setting in business_crew_settings remains as
-- the fallback used by the public booking capacity API.
alter table public.jobs
  add column if not exists crew_size int not null default 1 check (crew_size >= 1);
