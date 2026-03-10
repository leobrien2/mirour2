-- Migration: Add description to tags
-- Phase 1: Support explanatory text for tags

ALTER TABLE public.tags
ADD COLUMN description TEXT;

-- Comments for documentation
COMMENT ON COLUMN public.tags.description IS 'An explanatory description of the tag.';
