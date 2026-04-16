-- Canvassing Visit History
-- Run in the Supabase SQL editor after canvassing.sql

create table public.canvassing_visits (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.canvassing_properties (id) on delete cascade,
  business_id    uuid not null references public.businesses (id) on delete cascade,
  employee_id    uuid references public.team_members (id) on delete set null,
  status         text not null
                   check (status in ('not_visited', 'no_answer', 'no', 'interested', 'booked')),
  notes          text,
  follow_up_date date,
  visited_at     timestamptz default now()
);

alter table public.canvassing_visits enable row level security;

create policy "Owner can manage canvassing visits"
  on public.canvassing_visits for all
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "Employees can manage canvassing visits"
  on public.canvassing_visits for all
  using (
    business_id in (
      select business_id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

create index on public.canvassing_visits (property_id, visited_at desc);
create index on public.canvassing_visits (business_id, visited_at desc);
