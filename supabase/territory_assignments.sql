-- Territory assignment: each ZIP code belongs to at most one team member per business.

create table if not exists public.territory_assignments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  team_member_id  uuid not null references public.team_members(id) on delete cascade,
  zip_code        text not null,
  created_at      timestamptz default now(),
  constraint territory_assignments_biz_zip_unique unique (business_id, zip_code)
);

create index if not exists territory_assignments_business_idx  on public.territory_assignments(business_id);
create index if not exists territory_assignments_member_idx    on public.territory_assignments(team_member_id);

alter table public.territory_assignments enable row level security;

create policy "owner_manage_territory_assignments"
  on public.territory_assignments for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = territory_assignments.business_id
        and b.owner_id = auth.uid()
    )
  );
