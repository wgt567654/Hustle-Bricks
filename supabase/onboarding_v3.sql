-- Onboarding v3: guided setup flow — progress tracking, business profile,
-- goals, and AI-personalization answers.
-- Run in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- Backfill note: existing businesses are stamped as onboarded (completed_at =
-- created_at) so current users are never redirected into the new flow.

ALTER TABLE public.businesses
  -- progress / resume
  ADD COLUMN IF NOT EXISTS onboarding_step         text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  -- business profile (segmented answers, stored as stable keys)
  ADD COLUMN IF NOT EXISTS team_size               text,  -- solo | 2_5 | 6_15 | 16_plus
  ADD COLUMN IF NOT EXISTS business_stage          text,  -- new | growing | established | veteran
  ADD COLUMN IF NOT EXISTS avg_job_value_range     text,  -- under_150 | 150_500 | 500_2000 | over_2000
  -- goals (DB-backed; analytics previously used localStorage only)
  ADD COLUMN IF NOT EXISTS monthly_revenue_goal    numeric(12,2),
  -- AI personalization
  ADD COLUMN IF NOT EXISTS growth_priorities       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS biggest_challenge       text,
  -- money setup
  ADD COLUMN IF NOT EXISTS payment_methods         text[] DEFAULT '{}';

-- Existing businesses predate the guided setup — mark them complete so the
-- dashboard gate never locks out a live user.
UPDATE public.businesses
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, now())
WHERE onboarding_completed_at IS NULL;
