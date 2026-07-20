-- Sprint 2: Quoting & Money (2.1 duration-aware booking, 2.2 sold-by
-- commissions, 2.3 lead-source rates, 2.4 geo-aware dispatch).
-- Run in the Supabase SQL editor; ends with a PostgREST schema reload.
-- Grilled decisions: docs/REVISION-PLAN.md §9.

-- ─── 2.1 Duration-aware booking ──────────────────────────────────────────────
alter table public.booking_requests add column if not exists duration_mins int;
alter table public.booking_requests add column if not exists service_ids jsonb;

-- ─── 2.2 Sold-by attribution ─────────────────────────────────────────────────
alter table public.quotes add column if not exists created_by_member_id uuid
  references public.team_members (id) on delete set null;
alter table public.quotes add column if not exists lead_source text
  check (lead_source in ('self_generated', 'website', 'manual'));

alter table public.jobs add column if not exists sold_by_member_id uuid
  references public.team_members (id) on delete set null;
alter table public.jobs add column if not exists sold_by_owner boolean default false;
alter table public.jobs add column if not exists lead_source text
  check (lead_source in ('self_generated', 'website', 'manual'));

-- ─── 2.3 Lead-source commission rates (business defaults; member override =
--     existing team_members.commission_rate, which wins when set) ─────────────
alter table public.businesses add column if not exists commission_rate_self_gen numeric(5, 2) default 15.00;
alter table public.businesses add column if not exists commission_rate_house    numeric(5, 2) default 5.00;

-- Commission ledger: one entry per job, created at completion ('pending'),
-- flipped to 'owed' when a payment is recorded, 'paid' when the owner settles
-- up with the seller. Owner-sold jobs get flagged entries (unit economics
-- visibility; no payout expected).
create table if not exists public.commission_entries (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  job_id         uuid not null references public.jobs (id) on delete cascade,
  member_id      uuid references public.team_members (id) on delete set null,
  sold_by_owner  boolean not null default false,
  lead_source    text,
  rate           numeric(5, 2) not null default 0,
  job_total      numeric(10, 2),
  amount         numeric(10, 2) not null default 0,
  status         text not null default 'pending' check (status in ('pending', 'owed', 'paid')),
  owed_at        timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz default now(),
  unique (job_id)
);

create index if not exists idx_commission_business on public.commission_entries (business_id);
create index if not exists idx_commission_member on public.commission_entries (member_id);

alter table public.commission_entries enable row level security;

drop policy if exists "Owner manages commission entries" on public.commission_entries;
create policy "Owner manages commission entries"
  on public.commission_entries for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = commission_entries.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Members view their own commission entries" on public.commission_entries;
create policy "Members view their own commission entries"
  on public.commission_entries for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.id = commission_entries.member_id and tm.user_id = auth.uid()
    )
  );

-- Trigger 1: job completed → create the commission entry ('pending').
-- Rate: member override (team_members.commission_rate) when a member sold it
-- and has one; else the business rate for the job's lead_source
-- (self_generated → commission_rate_self_gen, else commission_rate_house).
-- Jobs with no sold_by info are treated as owner-sold (grilled: track anyway).
create or replace function public.generate_commission_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric(5, 2);
  v_member_override numeric(5, 2);
  v_self numeric(5, 2);
  v_house numeric(5, 2);
  v_owner_sold boolean;
begin
  select coalesce(b.commission_rate_self_gen, 15), coalesce(b.commission_rate_house, 5)
    into v_self, v_house
  from public.businesses b where b.id = new.business_id;

  v_owner_sold := coalesce(new.sold_by_owner, false) or new.sold_by_member_id is null;

  if new.sold_by_member_id is not null then
    select tm.commission_rate into v_member_override
    from public.team_members tm where tm.id = new.sold_by_member_id;
  end if;

  v_rate := coalesce(
    v_member_override,
    case when new.lead_source = 'self_generated' then v_self else v_house end
  );

  insert into public.commission_entries
    (business_id, job_id, member_id, sold_by_owner, lead_source, rate, job_total, amount)
  values
    (new.business_id, new.id, new.sold_by_member_id, v_owner_sold,
     new.lead_source, v_rate, new.total,
     round(coalesce(new.total, 0) * v_rate / 100.0, 2))
  on conflict (job_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_job_completed_commission on public.jobs;
create trigger on_job_completed_commission
  after update of status on public.jobs
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.generate_commission_entry();

-- Trigger 2: payment recorded → commission becomes 'owed' (accrual on payment).
create or replace function public.accrue_commission_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.commission_entries
  set status = 'owed', owed_at = now()
  where job_id = new.job_id and status = 'pending';
  return new;
end;
$$;

drop trigger if exists on_payment_accrue_commission on public.payments;
create trigger on_payment_accrue_commission
  after insert on public.payments
  for each row
  execute function public.accrue_commission_on_payment();

-- ─── 2.4 Geo-aware dispatch v1 ───────────────────────────────────────────────
alter table public.jobs add column if not exists geo_lat double precision;
alter table public.jobs add column if not exists geo_lng double precision;
alter table public.team_members add column if not exists home_lat double precision;
alter table public.team_members add column if not exists home_lng double precision;

notify pgrst, 'reload schema';
