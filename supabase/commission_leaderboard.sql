-- Commission Leaderboard
-- Run in the Supabase SQL editor.

-- Per-rep commission rate override on team_members.
-- NULL = use the business default (businesses.commission_rate).
alter table public.team_members
  add column if not exists commission_rate numeric(5, 2);
