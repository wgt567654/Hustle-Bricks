-- ─── Route Optimization Migration ────────────────────────────────────────────
-- Run this in the Supabase SQL editor after employee_feature.sql

-- Nullable route_order on jobs — set by the owner when planning a route.
-- null = no route set (falls back to scheduled_at order on employee portal).
-- 1-indexed integer scoped implicitly by assigned_member_id + scheduled_at date.
alter table public.jobs
  add column if not exists route_order integer;

create index if not exists jobs_assigned_route_idx
  on public.jobs (assigned_member_id, scheduled_at, route_order);
