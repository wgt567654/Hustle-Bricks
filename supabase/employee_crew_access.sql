-- Multi-worker access (Sprint 1.4): secondary crew members (in job_crew but not
-- the primary assigned_member_id) must also be able to open, respond to, and work
-- a job. The original employee RLS only granted access to the primary assignee.
-- time_entries already keys on employee_id, so no change needed there.
-- Run in the Supabase SQL editor, then: notify pgrst, 'reload schema';
--
-- NOTE: crew checks go through SECURITY DEFINER helpers. A plain policy that
-- subqueries job_crew would recurse — job_crew's owner policy subqueries jobs,
-- and the jobs crew policy subqueries job_crew (jobs -> job_crew -> jobs).
-- SECURITY DEFINER bypasses RLS inside the helper, breaking the cycle.

create or replace function public.is_job_crew_member(p_job_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.job_crew jc
    join public.team_members tm on tm.id = jc.team_member_id
    where jc.job_id = p_job_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
  );
$$;

create or replace function public.is_job_crew_client(p_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.jobs j
    join public.job_crew jc on jc.job_id = j.id
    join public.team_members tm on tm.id = jc.team_member_id
    where j.client_id = p_client_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
  );
$$;

revoke all on function public.is_job_crew_member(uuid) from public;
revoke all on function public.is_job_crew_client(uuid) from public;
grant execute on function public.is_job_crew_member(uuid) to authenticated;
grant execute on function public.is_job_crew_client(uuid) to authenticated;

-- Jobs: crew can view + update status/photos
drop policy if exists "Crew can view their jobs" on public.jobs;
create policy "Crew can view their jobs"
  on public.jobs for select
  using (public.is_job_crew_member(jobs.id));

drop policy if exists "Crew can update their jobs" on public.jobs;
create policy "Crew can update their jobs"
  on public.jobs for update
  using (public.is_job_crew_member(jobs.id));

-- Job line items: crew can view
drop policy if exists "Crew can view line items" on public.job_line_items;
create policy "Crew can view line items"
  on public.job_line_items for select
  using (public.is_job_crew_member(job_line_items.job_id));

-- Clients: crew can view the client of a job they're on
drop policy if exists "Crew can view job clients" on public.clients;
create policy "Crew can view job clients"
  on public.clients for select
  using (public.is_job_crew_client(clients.id));

-- Payments: crew can record payment for a job they're on
drop policy if exists "Crew can record payments" on public.payments;
create policy "Crew can record payments"
  on public.payments for insert
  with check (public.is_job_crew_member(payments.job_id));

notify pgrst, 'reload schema';
