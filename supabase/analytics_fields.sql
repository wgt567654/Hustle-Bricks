-- Analytics Fields Migration
-- Run this in the Supabase SQL editor.

-- Add service type to jobs (used for revenue-by-service donut chart)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS service_type text;

-- Add lead source to clients (used for revenue-by-lead-source donut chart)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_source text;
