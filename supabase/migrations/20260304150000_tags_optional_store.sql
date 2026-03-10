-- Migration: Allow tags to be created without a store (global/owner-level tags)
-- Previously store_id was NOT NULL, blocking tag creation from the Tag Manager
-- when no specific store is selected.

-- 1. Make store_id nullable (remove NOT NULL constraint)
ALTER TABLE public.tags
  ALTER COLUMN store_id DROP NOT NULL;

-- 2. Drop the existing RLS policy which requires a valid store match
DROP POLICY IF EXISTS "Users can CRUD their own tags" ON public.tags;

-- 3. Recreate the policy to allow:
--    a) Tags tied to a store the user owns (existing behavior)
--    b) Tags with no store (store_id IS NULL) where the auth user is authenticated
--       These act as global/owner-level tags.
CREATE POLICY "Users can CRUD their own tags"
ON public.tags FOR ALL
USING (
  (
    store_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = tags.store_id
        AND stores.owner_id = auth.uid()
    )
  )
  OR
  (
    store_id IS NULL AND auth.uid() IS NOT NULL
  )
)
WITH CHECK (
  (
    store_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = tags.store_id
        AND stores.owner_id = auth.uid()
    )
  )
  OR
  (
    store_id IS NULL AND auth.uid() IS NOT NULL
  )
);
