-- HustleBricks: Booking & Scheduling Tables
-- Run this in the Supabase SQL editor.
-- These tables are already referenced in:
--   /src/app/portal/[clientId]/page.tsx
--   /src/app/portal/[clientId]/BookingForm.tsx
--   /src/app/api/booking/route.ts

-- ─── Scheduling Settings ─────────────────────────────────────────────────────
-- Stores the business owner's available days and hours per day.
-- unavailable_days: array of ints 0-6 (0=Sun, 1=Mon, ..., 6=Sat)
-- day_hours: jsonb map like {"1": {"from": "08:00", "until": "17:00"}, "2": {...}}

CREATE TABLE IF NOT EXISTS public.scheduling_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  unavailable_days int[]  DEFAULT '{}',
  day_hours        jsonb  DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage scheduling_settings"
  ON public.scheduling_settings FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Portal (public) needs to read settings to show correct available slots
CREATE POLICY "public read scheduling_settings"
  ON public.scheduling_settings FOR SELECT
  USING (true);


-- ─── Blocked Dates ───────────────────────────────────────────────────────────
-- Specific dates the business is unavailable (holidays, vacations, etc.)

CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  blocked_date  date NOT NULL,
  UNIQUE(business_id, blocked_date)
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage blocked_dates"
  ON public.blocked_dates FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Portal needs to read blocked dates to grey them out on the calendar
CREATE POLICY "public read blocked_dates"
  ON public.blocked_dates FOR SELECT
  USING (true);


-- ─── Booking Requests ────────────────────────────────────────────────────────
-- Created when a client picks a time in the client portal.
-- Owner approves (creates a job) or declines (client can re-request).

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_date  date NOT NULL,
  requested_time  text NOT NULL,
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage booking_requests"
  ON public.booking_requests FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Portal submits requests without auth
CREATE POLICY "public insert booking_requests"
  ON public.booking_requests FOR INSERT
  WITH CHECK (true);

-- Portal needs to read its own pending/declined requests to show status
CREATE POLICY "public read booking_requests"
  ON public.booking_requests FOR SELECT
  USING (true);
