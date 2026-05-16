-- SMS Automation: Review Requests + Lead Speed-to-Contact
-- Run in the Supabase SQL editor.

-- ─── New columns on businesses ───────────────────────────────────────────────
alter table public.businesses
  add column if not exists review_requests_enabled boolean default false,
  add column if not exists lead_notify_enabled      boolean default false,
  add column if not exists google_review_url        text;

-- ─── New column on jobs ───────────────────────────────────────────────────────
-- Tracks when we last sent a review-request SMS for this job.
alter table public.jobs
  add column if not exists review_request_sent_at timestamptz;

-- ─── New column on leads ──────────────────────────────────────────────────────
-- Tracks when the speed-to-contact SMS was sent to this lead.
alter table public.leads
  add column if not exists notified_at timestamptz;

-- ─── SMS Queue ────────────────────────────────────────────────────────────────
-- Every outbound SMS is logged here regardless of whether a provider is configured.
-- Status: pending → sent | failed | skipped
create table if not exists public.sms_queue (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  to_phone     text not null,
  body         text not null,
  status       text not null default 'pending',
  sent_at      timestamptz,
  error        text,
  metadata     jsonb,
  created_at   timestamptz default now()
);

alter table public.sms_queue enable row level security;

-- Owners can read their own queue (for a future "SMS sent" log UI).
create policy "Business owner can read their sms_queue"
  on public.sms_queue for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = sms_queue.business_id and b.owner_id = auth.uid()
    )
  );
