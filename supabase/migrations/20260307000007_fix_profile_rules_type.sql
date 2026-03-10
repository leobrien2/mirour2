-- ============================================================
-- Fix: profile_rules.profile_id type mismatch with profiles.id
-- ============================================================
-- profiles.id      = VARCHAR
-- profile_rules.profile_id = UUID (references profiles.id)
--
-- A UUID FK referencing a VARCHAR PK causes implicit casts on every join,
-- has implicit cast overhead, and is semantically incorrect.
--
-- This migration aligns profile_rules.profile_id to VARCHAR.
--
-- Safe: the values are valid UUID strings in both columns;
-- USING profile_id::text simply re-formats the storage without data loss.
-- ============================================================

-- Drop the FK constraint first (required before changing column type)
ALTER TABLE public.profile_rules
  DROP CONSTRAINT IF EXISTS profile_rules_profile_id_fkey;

-- Change the column type from UUID → VARCHAR
ALTER TABLE public.profile_rules
  ALTER COLUMN profile_id TYPE VARCHAR USING profile_id::text;

-- Re-add the FK constraint now that types match
ALTER TABLE public.profile_rules
  ADD CONSTRAINT profile_rules_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
