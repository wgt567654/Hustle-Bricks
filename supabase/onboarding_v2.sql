-- Onboarding v2: multi-step flow with contact info, country/currency, and Stripe subscriptions

-- profiles: add first_name, last_name, phone (keep full_name for backward compat)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text,
  ADD COLUMN IF NOT EXISTS phone      text;

-- businesses: add country, currency, plan, and Stripe subscription fields
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS country               text,
  ADD COLUMN IF NOT EXISTS currency              text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS plan                  text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status   text;
