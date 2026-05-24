ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS address              text,
  ADD COLUMN IF NOT EXISTS website_url          text,
  ADD COLUMN IF NOT EXISTS invoice_message      text,
  ADD COLUMN IF NOT EXISTS terms_and_conditions text;
