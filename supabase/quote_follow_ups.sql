-- Quote Follow-Up Sequence Automation
-- Run in the Supabase SQL editor.

-- ─── New column on businesses ─────────────────────────────────────────────────
alter table public.businesses
  add column if not exists follow_up_enabled boolean default false;

-- ─── sent_at on quotes ────────────────────────────────────────────────────────
-- Records exactly when a quote first became 'sent'.
-- The cron uses this as the clock start for the 24h / 72h / 7-day sequence.
alter table public.quotes
  add column if not exists sent_at timestamptz;

-- Trigger: auto-set sent_at the first time status becomes 'sent' (on UPDATE).
create or replace function public.set_quote_sent_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'sent' and (old.status is distinct from 'sent') and new.sent_at is null then
    new.sent_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists quote_sent_at_trigger on public.quotes;
create trigger quote_sent_at_trigger
  before update on public.quotes
  for each row execute function public.set_quote_sent_at();

-- Trigger: also set sent_at when a quote is created directly with status='sent'.
create or replace function public.set_quote_sent_at_on_insert()
returns trigger language plpgsql as $$
begin
  if new.status = 'sent' and new.sent_at is null then
    new.sent_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists quote_sent_at_insert_trigger on public.quotes;
create trigger quote_sent_at_insert_trigger
  before insert on public.quotes
  for each row execute function public.set_quote_sent_at_on_insert();

-- ─── Follow-up sends log ──────────────────────────────────────────────────────
-- Tracks which steps have been sent for each quote.
-- step: 1 = 24h, 2 = 72h, 3 = 7 days
create table if not exists public.quote_follow_up_sends (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  step         int not null check (step in (1, 2, 3)),
  sent_at      timestamptz default now(),
  sms_queue_id uuid references public.sms_queue (id)
);

-- One send per quote per step — prevents duplicates even if the cron runs twice.
create unique index if not exists quote_follow_up_sends_quote_step
  on public.quote_follow_up_sends (quote_id, step);

alter table public.quote_follow_up_sends enable row level security;

create policy "Business owner can read their follow_up_sends"
  on public.quote_follow_up_sends for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = quote_follow_up_sends.business_id and b.owner_id = auth.uid()
    )
  );
