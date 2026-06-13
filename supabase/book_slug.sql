-- Run this once in the Supabase SQL editor
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS slug text UNIQUE;
CREATE INDEX IF NOT EXISTS businesses_slug_idx ON public.businesses (slug);
