-- ─── Employee Feature Migration ──────────────────────────────────────────────
-- Run this in the Supabase SQL editor after the initial schema.sql

-- ─── Schema Additions ─────────────────────────────────────────────────────────

-- Employee access code on businesses (6-char uppercase, e.g. "HB7X2K")
alter table public.businesses
  add column if not exists employee_access_code text;

-- Pending flag on team_members (true = joined via code, awaiting owner approval)
alter table public.team_members
  add column if not exists is_pending boolean default false;


-- ─── Time Entries ─────────────────────────────────────────────────────────────

drop table if exists public.time_entries cascade;

create table public.time_entries (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.team_members (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  business_id     uuid not null references public.businesses (id) on delete cascade,
  clocked_in_at   timestamptz not null default now(),
  clocked_out_at  timestamptz,
  created_at      timestamptz default now()
);

alter table public.time_entries enable row level security;

create policy "Owner can manage time entries"
  on public.time_entries for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = time_entries.business_id
        and b.owner_id = auth.uid()
    )
  );

create policy "Employees can manage their time entries"
  on public.time_entries for all
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.id = time_entries.employee_id
    )
  );


-- ─── Employee RLS Policies ────────────────────────────────────────────────────

-- Employees can read their own team_member row
create policy "Team members can view their own record"
  on public.team_members for select
  using (user_id = auth.uid());

-- NOTE: No direct businesses SELECT policy for team members.
-- The lookup_business_by_code and join_business_as_employee functions use
-- SECURITY DEFINER which bypasses RLS, so no policy is needed here.
-- Adding one causes infinite recursion with the team_members policy.

-- Employees can read jobs assigned to them
create policy "Employees can view assigned jobs"
  on public.jobs for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.id = jobs.assigned_member_id
        and tm.is_active = true
    )
  );

-- Employees can update status and photos on their assigned jobs
create policy "Employees can update assigned jobs"
  on public.jobs for update
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.id = jobs.assigned_member_id
        and tm.is_active = true
    )
  );

-- Employees can read line items for their assigned jobs
create policy "Employees can view job line items for assigned jobs"
  on public.job_line_items for select
  using (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.id = job_line_items.job_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- Employees can read client info for their assigned jobs
create policy "Employees can view clients for assigned jobs"
  on public.clients for select
  using (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.client_id = clients.id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- Employees can insert payments for their assigned jobs
create policy "Employees can record payments for assigned jobs"
  on public.payments for insert
  with check (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.id = payments.job_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );


-- ─── RPC Helper Functions ─────────────────────────────────────────────────────

-- Look up a business by access code — callable before signup to preview the business name.
create or replace function public.lookup_business_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select name into v_name
  from public.businesses
  where employee_access_code = upper(trim(p_code))
  limit 1;

  if v_name is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object('found', true, 'name', v_name);
end;
$$;

-- Create a pending team_member record after the employee has signed up.
-- Uses security definer to bypass RLS (the new employee cannot INSERT into team_members directly).
create or replace function public.join_business_as_employee(
  p_code text,
  p_name text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id   uuid;
  v_business_name text;
  v_user_id       uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select id, name into v_business_id, v_business_name
  from public.businesses
  where employee_access_code = upper(trim(p_code))
  limit 1;

  if v_business_id is null then
    return jsonb_build_object('error', 'Invalid access code');
  end if;

  -- Prevent duplicate joins
  if exists (
    select 1 from public.team_members
    where business_id = v_business_id and user_id = v_user_id
  ) then
    return jsonb_build_object('error', 'You have already joined this business');
  end if;

  insert into public.team_members (business_id, user_id, name, is_active, is_pending, role)
  values (v_business_id, v_user_id, trim(p_name), false, true, 'member');

  return jsonb_build_object('success', true, 'business_name', v_business_name);
end;
$$;
