-- Pipeline Velocity Alerts
-- Run in the Supabase SQL editor.

-- Configurable threshold: how many days a sent quote can sit before it's flagged as stalled.
alter table public.businesses
  add column if not exists stale_quote_days int not null default 7;
