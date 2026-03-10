-- Migration: Tag constraint type
-- Phase 1: Distinguish hard constraints (No-sugar, THC-free) from soft preferences (Social, Calm)

ALTER TABLE public.tags
ADD COLUMN is_hard_constraint BOOLEAN DEFAULT false;

-- Add index for efficient filtering by constraint type
CREATE INDEX idx_tags_constraint_type ON public.tags(store_id, is_hard_constraint);

-- Comments for documentation
COMMENT ON COLUMN public.tags.is_hard_constraint IS 'True for strict requirements (No-sugar, THC-free, Vegan), false for preferences (Social, Calm, Focus). Hard constraints filter products with AND logic, soft preferences use ANY logic.';
