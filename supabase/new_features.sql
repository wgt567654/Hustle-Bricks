-- ─── New Features Migration ───────────────────────────────────────────────────
-- Run this in the Supabase SQL editor after employee_feature.sql

-- ─── Feature 1: Expense Tracking ─────────────────────────────────────────────

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  business_id   uuid not null references public.businesses(id) on delete cascade,
  description   text not null,
  amount        numeric(10,2) not null,
  category      text not null default 'other', -- materials | labor | fuel | subcontractor | other
  created_at    timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "Owner manages expenses"
  on public.expenses for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = expenses.business_id
        and b.owner_id = auth.uid()
    )
  );

create policy "Employees can log expenses for assigned jobs"
  on public.expenses for insert
  with check (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.id = expenses.job_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

create policy "Employees can view expenses for assigned jobs"
  on public.expenses for select
  using (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.id = expenses.job_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- ─── Feature 2: GPS Check-in ─────────────────────────────────────────────────

alter table public.time_entries
  add column if not exists check_in_lat  double precision,
  add column if not exists check_in_lng  double precision;

-- ─── Feature 3: Digital Signature ────────────────────────────────────────────

alter table public.jobs
  add column if not exists signature_url text;

-- ─── Feature 4: Mileage Log ──────────────────────────────────────────────────

alter table public.time_entries
  add column if not exists odometer_start integer,
  add column if not exists odometer_end   integer;
