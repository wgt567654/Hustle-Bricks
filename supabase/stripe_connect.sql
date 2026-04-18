-- HustleBricks: Stripe Connect + Recurring Client Billing
-- Run this in the Supabase SQL editor.

-- ─── Stripe Connect columns on businesses ────────────────────────────────────
-- stripe_connect_account_id: the connected Stripe account ID (acct_xxx)
-- stripe_connect_status: 'not_connected' | 'pending' | 'active'
-- stripe_connect_type: 'express' | 'standard'

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id  text,
  ADD COLUMN IF NOT EXISTS stripe_connect_status      text NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS stripe_connect_type        text;

-- ─── Client Recurring Billing Subscriptions ──────────────────────────────────
-- Tracks Stripe Subscriptions created on behalf of a business for their clients.
-- Each row = one live recurring billing relationship.
-- Individual payment records are written to the payments table via webhook.

CREATE TABLE IF NOT EXISTS public.client_billing_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id               uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_subscription_id  text NOT NULL,          -- Stripe sub ID on connected account
  stripe_customer_id      text NOT NULL,          -- Stripe customer ID on connected account
  status                  text NOT NULL DEFAULT 'active',
  -- mirrors Stripe sub status: 'active' | 'past_due' | 'canceled' | 'incomplete'
  amount                  numeric(10, 2) NOT NULL, -- per-cycle amount in dollars
  currency                text NOT NULL DEFAULT 'usd',
  interval                text NOT NULL,           -- 'month' | 'week' | 'year'
  interval_count          int NOT NULL DEFAULT 1,
  description             text,                    -- e.g. "Monthly lawn care"
  next_billing_date       timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(business_id, stripe_subscription_id)
);

ALTER TABLE public.client_billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages client billing subscriptions"
  ON public.client_billing_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = client_billing_subscriptions.business_id
        AND b.owner_id = auth.uid()
    )
  );
