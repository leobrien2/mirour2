-- 1. Add owner_id to products
ALTER TABLE public.products
ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Populate owner_id from the existing store_id relation
UPDATE public.products p
SET owner_id = s.owner_id
FROM public.stores s
WHERE p.store_id = s.id;

-- Make owner_id NOT NULL after populating
ALTER TABLE public.products
ALTER COLUMN owner_id SET NOT NULL;

-- 3. Create store_products junction table
CREATE TABLE public.store_products (
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (store_id, product_id)
);

-- Enable RLS for store_products
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own store products"
ON public.store_products FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = store_products.store_id
        AND stores.owner_id = auth.uid()
    )
);

-- 4. Migrate existing product-store relationships
INSERT INTO public.store_products (store_id, product_id)
SELECT store_id, id FROM public.products WHERE store_id IS NOT NULL;

-- 5. Update RLS on products to use owner_id directly instead of checking stores
DROP POLICY IF EXISTS "Users can CRUD their own products" ON public.products;

CREATE POLICY "Users can CRUD their own products"
ON public.products FOR ALL
USING (auth.uid() = owner_id);

-- 6. We will NOT drop store_id yet to avoid hard-breaking existing queries 
-- that might happen in the split-second before the frontend updates.
-- But we MUST remove the NOT NULL constraint for global products.
ALTER TABLE public.products ALTER COLUMN store_id DROP NOT NULL;
-- ALTER TABLE public.products DROP COLUMN store_id;
