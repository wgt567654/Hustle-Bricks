-- HustleBricks: Booking flow settings (quote gate + intro text)
-- Run this in the Supabase SQL editor.
-- Referenced by:
--   /src/app/book/[slug]/page.tsx
--   /src/app/(dashboard)/settings/SettingsClient.tsx

-- When true (default), the public booking widget asks customers whether they
-- already have a quote before letting them pick a time; "no" routes them into
-- the Get a Quote flow instead.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS require_quote_before_scheduling boolean NOT NULL DEFAULT true;

-- Optional intro/instructions text shown at the top of the public quote form.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS booking_intro text;
