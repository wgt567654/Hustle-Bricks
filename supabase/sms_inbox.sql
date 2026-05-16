-- Two-Way SMS Inbox
-- Run in the Supabase SQL editor.

-- Twilio number per business (the number customers reply to)
alter table public.businesses
  add column if not exists twilio_number text;

-- Central message log — outbound (via sendSMS) + inbound (via Twilio webhook)
create table if not exists public.sms_messages (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  direction    text not null check (direction in ('inbound', 'outbound')),
  from_phone   text not null,
  to_phone     text not null,
  body         text not null,
  read_at      timestamptz,       -- null for inbound = unread; set immediately for outbound
  twilio_sid   text,              -- Twilio message SID (inbound only)
  metadata     jsonb,
  created_at   timestamptz default now()
);

alter table public.sms_messages enable row level security;

create index if not exists sms_messages_thread_idx
  on public.sms_messages (business_id, client_id, created_at desc);

create index if not exists sms_messages_unread_idx
  on public.sms_messages (business_id, read_at)
  where direction = 'inbound';

-- Owner can read all messages for their business
create policy "owner_read_sms_messages" on public.sms_messages
  for select using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Owner can insert (for sending via UI)
create policy "owner_insert_sms_messages" on public.sms_messages
  for insert with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Owner can update (mark as read)
create policy "owner_update_sms_messages" on public.sms_messages
  for update using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );
