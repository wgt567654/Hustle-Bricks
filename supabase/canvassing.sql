-- Canvassing / Door-Knocking System
-- Run this in the Supabase SQL editor after schema.sql and employee_feature.sql.

create table public.canvassing_properties (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  lat              decimal(10, 7) not null,
  lng              decimal(10, 7) not null,
  address          text,
  status           text not null default 'not_visited'
                     check (status in ('not_visited', 'no_answer', 'no', 'interested', 'booked')),
  last_visited_at  timestamptz,
  visited_by       uuid references public.team_members (id) on delete set null,
  notes            text,
  follow_up_needed boolean default false,
  follow_up_date   date,
  follow_up_notes  text,
  job_id           uuid references public.jobs (id) on delete set null,
  created_at       timestamptz default now()
);

alter table public.canvassing_properties enable row level security;

-- Owners can manage all properties for their business
create policy "Owner can manage canvassing properties"
  on public.canvassing_properties for all
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Active employees can read and write properties for their business
create policy "Employees can manage canvassing properties"
  on public.canvassing_properties for all
  using (
    business_id in (
      select business_id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

-- Index for fast lookups by business
create index on public.canvassing_properties (business_id, created_at desc);
create index on public.canvassing_properties (business_id, lat, lng);
create index on public.canvassing_properties (business_id, follow_up_date) where follow_up_needed = true;
