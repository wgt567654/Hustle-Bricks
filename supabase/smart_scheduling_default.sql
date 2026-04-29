-- Smart Scheduling default ON
-- Changes smart_scheduling_enabled default to true and opts all existing businesses in.
-- Run in Supabase SQL Editor.

ALTER TABLE businesses ALTER COLUMN smart_scheduling_enabled SET DEFAULT true;
UPDATE businesses SET smart_scheduling_enabled = true WHERE smart_scheduling_enabled = false OR smart_scheduling_enabled IS NULL;
