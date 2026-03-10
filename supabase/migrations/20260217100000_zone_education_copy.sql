-- Migration: Add zone education fields
-- Purpose: Support zone content injection with What/When/Who format

ALTER TABLE public.zones
ADD COLUMN zone_what TEXT DEFAULT '',
ADD COLUMN zone_when TEXT DEFAULT '',
ADD COLUMN zone_who TEXT DEFAULT '';

-- Backfill existing zones with placeholder copy
UPDATE public.zones 
SET 
  zone_what = 'Explore this curated selection.',
  zone_when = 'Browse anytime.',
  zone_who = 'Everyone is welcome.'
WHERE zone_what IS NULL OR zone_what = '';

-- Add comments for documentation
COMMENT ON COLUMN zones.zone_what IS 'What is this zone about? (1 sentence)';
COMMENT ON COLUMN zones.zone_when IS 'When to explore this zone? (1 sentence)';
COMMENT ON COLUMN zones.zone_who IS 'Who is this for? (1 sentence)';
