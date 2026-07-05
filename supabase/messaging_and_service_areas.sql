-- Fixes the schema drift behind the employee-portal console errors (launch-plan task 1.4).
-- Run in the Supabase SQL editor. Idempotent — safe to run more than once.
--
-- 1. businesses.service_areas       → /employee 400 (also defined in weather_alerts_v2.sql)
-- 2. team_messages new columns      → /employee/messages + /messages 400s
-- 3. team_messages UPDATE policies  → is_read PATCH was blocked (no update policy existed)
-- 4. team_groups / team_group_members / team_group_messages / team_broadcasts
--                                   → group chat + announcements tables (no SQL existed)

-- ── 1. businesses.service_areas ─────────────────────────────────────────────
alter table public.businesses
  add column if not exists service_areas text[] not null default '{}';

-- ── 2. team_messages: richer message columns ────────────────────────────────
alter table public.team_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists metadata     jsonb,
  add column if not exists media_url    text,
  add column if not exists is_read      boolean not null default false;

-- ── 3. team_messages: allow marking the other side's messages read ──────────
drop policy if exists "Owners can mark employee messages read" on public.team_messages;
create policy "Owners can mark employee messages read"
  on public.team_messages for update
  using (
    exists (
      select 1 from businesses b
      where b.id = team_messages.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from businesses b
      where b.id = team_messages.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Employees can mark owner messages read" on public.team_messages;
create policy "Employees can mark owner messages read"
  on public.team_messages for update
  using (
    exists (
      select 1 from team_members tm
      where tm.id = team_messages.team_member_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  )
  with check (
    exists (
      select 1 from team_members tm
      where tm.id = team_messages.team_member_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- ── 4. Group messaging + broadcasts ─────────────────────────────────────────
create table if not exists public.team_groups (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  type        text not null default 'custom',
  created_at  timestamptz not null default now()
);

create table if not exists public.team_group_members (
  group_id       uuid not null references team_groups(id) on delete cascade,
  team_member_id uuid not null references team_members(id) on delete cascade,
  primary key (group_id, team_member_id)
);

create table if not exists public.team_group_messages (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references team_groups(id) on delete cascade,
  business_id      uuid not null references businesses(id) on delete cascade,
  sender_role      text not null check (sender_role in ('owner', 'employee')),
  sender_member_id uuid references team_members(id) on delete set null,
  content          text not null,
  message_type     text not null default 'text',
  media_url        text,
  created_at       timestamptz not null default now()
);

create table if not exists public.team_broadcasts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists team_group_messages_group_idx
  on public.team_group_messages (group_id, created_at);
create index if not exists team_broadcasts_business_idx
  on public.team_broadcasts (business_id, created_at desc);

alter table public.team_groups          enable row level security;
alter table public.team_group_members   enable row level security;
alter table public.team_group_messages  enable row level security;
alter table public.team_broadcasts      enable row level security;

-- Membership check as security definer to avoid recursive RLS on
-- team_group_members referencing itself.
create or replace function public.is_team_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from team_group_members tgm
    join team_members tm on tm.id = tgm.team_member_id
    where tgm.group_id = gid
      and tm.user_id = auth.uid()
      and tm.is_active = true
  );
$$;

-- team_groups
drop policy if exists "Owners manage groups" on public.team_groups;
create policy "Owners manage groups"
  on public.team_groups for all
  using (
    exists (select 1 from businesses b where b.id = team_groups.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from businesses b where b.id = team_groups.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "Members can view their groups" on public.team_groups;
create policy "Members can view their groups"
  on public.team_groups for select
  using (public.is_team_group_member(id));

-- team_group_members
drop policy if exists "Owners manage group members" on public.team_group_members;
create policy "Owners manage group members"
  on public.team_group_members for all
  using (
    exists (
      select 1 from team_groups g
      join businesses b on b.id = g.business_id
      where g.id = team_group_members.group_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from team_groups g
      join businesses b on b.id = g.business_id
      where g.id = team_group_members.group_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Members can view group rosters" on public.team_group_members;
create policy "Members can view group rosters"
  on public.team_group_members for select
  using (public.is_team_group_member(group_id));

-- team_group_messages
drop policy if exists "Owners manage group messages" on public.team_group_messages;
create policy "Owners manage group messages"
  on public.team_group_messages for all
  using (
    exists (select 1 from businesses b where b.id = team_group_messages.business_id and b.owner_id = auth.uid())
  )
  with check (
    sender_role = 'owner'
    and exists (select 1 from businesses b where b.id = team_group_messages.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "Members can view group messages" on public.team_group_messages;
create policy "Members can view group messages"
  on public.team_group_messages for select
  using (public.is_team_group_member(group_id));

drop policy if exists "Members can send group messages" on public.team_group_messages;
create policy "Members can send group messages"
  on public.team_group_messages for insert
  with check (
    sender_role = 'employee'
    and public.is_team_group_member(group_id)
    and exists (
      select 1 from team_members tm
      where tm.id = team_group_messages.sender_member_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- team_broadcasts
drop policy if exists "Owners manage broadcasts" on public.team_broadcasts;
create policy "Owners manage broadcasts"
  on public.team_broadcasts for all
  using (
    exists (select 1 from businesses b where b.id = team_broadcasts.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from businesses b where b.id = team_broadcasts.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "Employees can view broadcasts" on public.team_broadcasts;
create policy "Employees can view broadcasts"
  on public.team_broadcasts for select
  using (
    exists (
      select 1 from team_members tm
      where tm.business_id = team_broadcasts.business_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- ── Realtime for the chat tables (ignore if already added) ──────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.team_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.team_group_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.team_broadcasts;
  exception when duplicate_object then null;
  end;
end $$;
