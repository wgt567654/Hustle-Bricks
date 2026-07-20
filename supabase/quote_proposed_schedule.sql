-- Quote Proposed Schedule
-- Run in the Supabase SQL editor.
--
-- Lets the person who creates a quote (owner or employee) propose a service
-- time. When the customer accepts the quote, the proposed time becomes a
-- pending booking request in the owner's Bookings queue.
--
-- After running, refresh PostgREST's schema cache:
--   notify pgrst, 'reload schema';

alter table public.quotes
  add column if not exists proposed_date date;

alter table public.quotes
  add column if not exists proposed_time time;

notify pgrst, 'reload schema';
