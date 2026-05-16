-- Rebooking Campaign Automation
-- Run in the Supabase SQL editor.

-- Toggle and threshold on businesses
alter table public.businesses
  add column if not exists rebooking_enabled boolean not null default false;

alter table public.businesses
  add column if not exists rebooking_after_days int not null default 60;

-- Track when we last sent a rebooking SMS to each client (prevents re-sending too soon)
alter table public.clients
  add column if not exists last_rebooking_sent_at timestamptz;
