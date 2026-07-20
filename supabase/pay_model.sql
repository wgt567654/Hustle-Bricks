-- Pay model (Sprint 1.2): per-member per-service pay rules + per-job payouts.
-- Run this in the Supabase SQL editor.
--
-- Pay "varies wildly" by design: each member can have a default rule and
-- per-service overrides (hourly $, percent of job, or flat $ per job).
-- When a job completes, a trigger computes a payout row per crew member,
-- which the owner can then override per job (splits, ad-hoc deals).

-- ─── Pay rules ───────────────────────────────────────────────────────────────
create table if not exists public.member_pay_rules (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  team_member_id  uuid not null references public.team_members (id) on delete cascade,
  service_id      uuid references public.services (id) on delete cascade, -- null = member default
  pay_type        text not null check (pay_type in ('hourly', 'percent', 'flat')),
  rate            numeric(10, 2) not null default 0,
  created_at      timestamptz default now(),
  unique nulls not distinct (team_member_id, service_id)
);

alter table public.member_pay_rules enable row level security;

drop policy if exists "Owner manages pay rules" on public.member_pay_rules;
create policy "Owner manages pay rules"
  on public.member_pay_rules for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = member_pay_rules.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Members can view their own pay rules" on public.member_pay_rules;
create policy "Members can view their own pay rules"
  on public.member_pay_rules for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.id = member_pay_rules.team_member_id and tm.user_id = auth.uid()
    )
  );

-- ─── Job payouts (per-job computed pay, owner-overridable) ───────────────────
create table if not exists public.job_payouts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  team_member_id  uuid not null references public.team_members (id) on delete cascade,
  pay_type        text not null check (pay_type in ('hourly', 'percent', 'flat', 'custom')),
  rate            numeric(10, 2),
  minutes         int,
  job_total       numeric(10, 2),
  amount          numeric(10, 2) not null default 0,
  status          text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at         timestamptz,
  method          text,
  notes           text,
  created_at      timestamptz default now(),
  unique (job_id, team_member_id)
);

create index if not exists idx_job_payouts_business on public.job_payouts (business_id);
create index if not exists idx_job_payouts_member on public.job_payouts (team_member_id);

alter table public.job_payouts enable row level security;

drop policy if exists "Owner manages job payouts" on public.job_payouts;
create policy "Owner manages job payouts"
  on public.job_payouts for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = job_payouts.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Members can view their own payouts" on public.job_payouts;
create policy "Members can view their own payouts"
  on public.job_payouts for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.id = job_payouts.team_member_id and tm.user_id = auth.uid()
    )
  );

-- ─── Auto-compute payouts when a job completes ───────────────────────────────
-- Rule resolution per crew member, most specific wins:
--   1. member_pay_rules matching a service on the job's line items
--   2. member_pay_rules default (service_id is null)
--   3. legacy fallback: team_members.hourly_rate if set, else percent from
--      coalesce(team_members.commission_rate, businesses.commission_rate)
-- Existing payout rows are never overwritten (owner overrides survive
-- re-completion).
create or replace function public.generate_job_payouts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
  rule record;
  v_minutes int;
  v_amount numeric(10, 2);
  v_pay_type text;
  v_rate numeric(10, 2);
begin
  for member in
    select distinct tm.id, tm.hourly_rate, tm.commission_rate
    from public.team_members tm
    where tm.id = new.assigned_member_id
       or tm.id in (select jc.team_member_id from public.job_crew jc where jc.job_id = new.id)
  loop
    -- 1) service-specific rule (SELECT INTO nulls the record when no row matches)
    select r.pay_type, r.rate into rule
    from public.member_pay_rules r
    where r.team_member_id = member.id
      and r.service_id in (
        select jli.service_id from public.job_line_items jli
        where jli.job_id = new.id and jli.service_id is not null
      )
    limit 1;

    -- 2) member default rule
    if rule.pay_type is null then
      select r.pay_type, r.rate into rule
      from public.member_pay_rules r
      where r.team_member_id = member.id and r.service_id is null
      limit 1;
    end if;

    -- 3) legacy fallback
    if rule.pay_type is not null then
      v_pay_type := rule.pay_type;
      v_rate := rule.rate;
    elsif member.hourly_rate is not null then
      v_pay_type := 'hourly';
      v_rate := member.hourly_rate;
    else
      v_pay_type := 'percent';
      select coalesce(member.commission_rate, b.commission_rate, 0) into v_rate
      from public.businesses b where b.id = new.business_id;
    end if;

    -- time_entries keys workers by employee_id and stores raw timestamps
    select coalesce(sum(extract(epoch from (te.clocked_out_at - te.clocked_in_at)) / 60), 0)::int
      into v_minutes
    from public.time_entries te
    where te.job_id = new.id
      and te.employee_id = member.id
      and te.clocked_out_at is not null;

    v_amount := case v_pay_type
      when 'hourly'  then round(v_rate * v_minutes / 60.0, 2)
      when 'percent' then round(coalesce(new.total, 0) * v_rate / 100.0, 2)
      when 'flat'    then v_rate
      else 0
    end;

    insert into public.job_payouts
      (business_id, job_id, team_member_id, pay_type, rate, minutes, job_total, amount)
    values
      (new.business_id, new.id, member.id, v_pay_type, v_rate, v_minutes, new.total, v_amount)
    on conflict (job_id, team_member_id) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_job_completed_generate_payouts on public.jobs;
create trigger on_job_completed_generate_payouts
  after update of status on public.jobs
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.generate_job_payouts();
