-- Sprint 3: Worker Earnings & Payouts.
-- Grilled decisions: batch settlement per person; labor + commission both mature
-- to 'owed' only on customer payment; workers see amounts + basis, not job price.
-- Run in the Supabase SQL editor; ends with a PostgREST schema reload.

-- Labor payouts now have an 'owed' stage (mature on payment like commissions).
alter table public.job_payouts drop constraint if exists job_payouts_status_check;
alter table public.job_payouts
  add constraint job_payouts_status_check check (status in ('pending', 'owed', 'paid'));

-- Batch settlement: one record per "pay this person everything owed" action.
create table if not exists public.payout_batches (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  member_id         uuid not null references public.team_members (id) on delete cascade,
  labor_total       numeric(10, 2) not null default 0,
  commission_total  numeric(10, 2) not null default 0,
  total_amount      numeric(10, 2) not null default 0,
  method            text,
  notes             text,
  created_at        timestamptz default now()
);
create index if not exists idx_payout_batches_business on public.payout_batches (business_id);
create index if not exists idx_payout_batches_member on public.payout_batches (member_id);

alter table public.job_payouts add column if not exists payout_batch_id uuid
  references public.payout_batches (id) on delete set null;
alter table public.commission_entries add column if not exists payout_batch_id uuid
  references public.payout_batches (id) on delete set null;

alter table public.payout_batches enable row level security;

drop policy if exists "Owner manages payout batches" on public.payout_batches;
create policy "Owner manages payout batches"
  on public.payout_batches for all
  using (
    exists (select 1 from public.businesses b
            where b.id = payout_batches.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "Members view their own payout batches" on public.payout_batches;
create policy "Members view their own payout batches"
  on public.payout_batches for select
  using (
    exists (select 1 from public.team_members tm
            where tm.id = payout_batches.member_id and tm.user_id = auth.uid())
  );

-- Payment recorded → labor payouts pending → owed (mirrors commission accrual).
create or replace function public.accrue_labor_on_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.job_payouts
  set status = 'owed'
  where job_id = new.job_id and status = 'pending';
  return new;
end;
$$;

drop trigger if exists on_payment_accrue_labor on public.payments;
create trigger on_payment_accrue_labor
  after insert on public.payments
  for each row execute function public.accrue_labor_on_payment();

-- Batch payout: settle everything a member is owed (labor + commission) in one
-- record and flip those entries to 'paid'. Owner-authorized (SECURITY DEFINER;
-- validates the caller owns the business).
create or replace function public.settle_member_payout(
  p_business_id uuid,
  p_member_id   uuid,
  p_method      text,
  p_notes       text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_labor      numeric(10, 2);
  v_commission numeric(10, 2);
  v_batch_id   uuid;
begin
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  ) then
    return jsonb_build_object('error', 'Not authorized');
  end if;

  select coalesce(sum(amount), 0) into v_labor
  from public.job_payouts
  where business_id = p_business_id and team_member_id = p_member_id and status = 'owed';

  select coalesce(sum(amount), 0) into v_commission
  from public.commission_entries
  where business_id = p_business_id and member_id = p_member_id and status = 'owed';

  if (v_labor + v_commission) <= 0 then
    return jsonb_build_object('error', 'Nothing owed');
  end if;

  insert into public.payout_batches
    (business_id, member_id, labor_total, commission_total, total_amount, method, notes)
  values
    (p_business_id, p_member_id, v_labor, v_commission, v_labor + v_commission, p_method, p_notes)
  returning id into v_batch_id;

  update public.job_payouts
  set status = 'paid', paid_at = now(), method = p_method, payout_batch_id = v_batch_id
  where business_id = p_business_id and team_member_id = p_member_id and status = 'owed';

  update public.commission_entries
  set status = 'paid', paid_at = now(), payout_batch_id = v_batch_id
  where business_id = p_business_id and member_id = p_member_id and status = 'owed';

  return jsonb_build_object('success', true, 'batch_id', v_batch_id,
    'labor', v_labor, 'commission', v_commission, 'total', v_labor + v_commission);
end;
$$;

revoke all on function public.settle_member_payout(uuid, uuid, text, text) from public;
grant execute on function public.settle_member_payout(uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
