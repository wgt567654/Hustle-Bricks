-- Multi-team membership support (Sprint 1.1)
-- Run this in the Supabase SQL editor.
--
-- Employees can belong to multiple businesses (team_members has one row per
-- membership), but employee RLS blocks reading businesses directly. This
-- SECURITY DEFINER function returns the caller's own memberships with the
-- business name, for the employee app's business switcher.

create or replace function public.get_my_memberships()
returns table (
  member_id     uuid,
  member_name   text,
  business_id   uuid,
  business_name text,
  is_active     boolean,
  is_pending    boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select tm.id, tm.name, tm.business_id, b.name, tm.is_active, tm.is_pending
  from public.team_members tm
  join public.businesses b on b.id = tm.business_id
  where tm.user_id = auth.uid()
  order by tm.created_at asc;
$$;

revoke all on function public.get_my_memberships() from public;
grant execute on function public.get_my_memberships() to authenticated;
