-- Service qualifications (Sprint 1.4): which workers are certified for which
-- services. Two sources coexist: 'owner' (owner marks an already-trained worker
-- qualified directly) and 'training' (future NotebookLM proof-of-completion flow).
-- Dispatch reads this to propose only qualified workers.
-- Run in the Supabase SQL editor, then: notify pgrst, 'reload schema';

create table if not exists public.member_service_capabilities (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  team_member_id  uuid not null references public.team_members (id) on delete cascade,
  service_id      uuid not null references public.services (id) on delete cascade,
  source          text not null default 'owner' check (source in ('owner', 'training')),
  certified_at    timestamptz default now(),
  certified_by    uuid references auth.users (id) on delete set null,
  unique (team_member_id, service_id)
);

create index if not exists idx_msc_business on public.member_service_capabilities (business_id);
create index if not exists idx_msc_service on public.member_service_capabilities (service_id);

alter table public.member_service_capabilities enable row level security;

drop policy if exists "Owner manages capabilities" on public.member_service_capabilities;
create policy "Owner manages capabilities"
  on public.member_service_capabilities for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = member_service_capabilities.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Members view their own capabilities" on public.member_service_capabilities;
create policy "Members view their own capabilities"
  on public.member_service_capabilities for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.id = member_service_capabilities.team_member_id and tm.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
