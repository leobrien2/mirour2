-- Remove the NOT NULL constraint for global products.
ALTER TABLE public.products ALTER COLUMN store_id DROP NOT NULL;
