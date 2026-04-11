-- HustleBricks: Leads Table
-- Run this in the Supabase SQL editor.
-- This adds the leads table referenced by the /leads dashboard page,
-- plus extra columns for public quote-request form submissions.

CREATE TABLE IF NOT EXISTS public.leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name             text NOT NULL,
  email            text,
  phone            text,
  address          text,
  stage            text NOT NULL DEFAULT 'new'
                     CHECK (stage IN ('new', 'contacted', 'quoted', 'won', 'lost')),
  source           text,
  notes            text,
  estimated_value  numeric(10, 2),
  -- Extra fields populated by public quote-request form
  property_type    text,       -- 'residential' | 'commercial'
  services         text[],     -- e.g. ['Exterior Window Cleaning', 'Gutter Cleaning']
  frequency        text,       -- 'monthly' | 'quarterly' | 'biannual' | 'one-time'
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Business owners can read/update/delete their own leads
CREATE POLICY "Business owners manage leads"
  ON public.leads FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Anonymous users can insert (used by the public quote-request form via service role key in API)
-- Note: The API route uses the service role key, so no anonymous RLS policy is needed.
-- If you ever want direct anon inserts (e.g. from an embedded widget without the API), add:
-- CREATE POLICY "Public can submit leads"
--   ON public.leads FOR INSERT WITH CHECK (true);
