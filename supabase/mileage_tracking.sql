-- Mileage tracking for employee gas reimbursement
-- Run this in the Supabase SQL editor

-- 1. Employee home address (used as route origin)
alter table team_members
  add column if not exists home_address text;

-- 2. Owner-configurable mileage reimbursement rate ($/mile)
alter table businesses
  add column if not exists mileage_rate_per_mile numeric(6,4) not null default 0.70;

-- 3. Calculated daily mileage records
create table if not exists daily_mileage (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  employee_id     uuid not null references team_members(id) on delete cascade,
  date            date not null,
  total_miles     numeric(8,2) not null,
  rate_per_mile   numeric(6,4) not null,
  reimbursement   numeric(10,2) generated always as (total_miles * rate_per_mile) stored,
  route_snapshot  jsonb,
  calculated_at   timestamptz not null default now(),
  unique (employee_id, date)
);

alter table daily_mileage enable row level security;

-- Owner can see all mileage for their business
create policy "owner_read_mileage" on daily_mileage
  for select using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- Owner can insert/update mileage records
create policy "owner_write_mileage" on daily_mileage
  for all using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- Employee can read their own mileage
create policy "employee_read_own_mileage" on daily_mileage
  for select using (
    employee_id in (
      select id from team_members where user_id = auth.uid()
    )
  );
