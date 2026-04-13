-- Add business_type column to businesses table
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_type text;
