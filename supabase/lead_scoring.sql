-- HustleBricks: AI Lead Scoring columns
-- Run in Supabase SQL editor.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ai_score           integer,
  ADD COLUMN IF NOT EXISTS ai_score_label     text CHECK (ai_score_label IN ('hot','warm','cool','cold')),
  ADD COLUMN IF NOT EXISTS ai_score_reason    text,
  ADD COLUMN IF NOT EXISTS ai_score_actions   text[],
  ADD COLUMN IF NOT EXISTS ai_score_updated_at timestamptz;
