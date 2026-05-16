-- Job Profitability Report
-- Run in the Supabase SQL editor.

-- Add hourly_rate to team_members for labor cost calculations
alter table public.team_members
  add column if not exists hourly_rate numeric(8, 2) default 0;
