-- Phase 1 Schema Changes for Soberish Pilot

-- 1. Create Stores Table
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own stores"
ON public.stores FOR ALL
USING (auth.uid() = owner_id);

-- 2. Create Zones Table
CREATE TABLE public.zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for zones
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own zones"
ON public.zones FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = zones.store_id
        AND stores.owner_id = auth.uid()
    )
);

-- 3. Create Products Table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    sku TEXT,
    price DECIMAL(10, 2),
    in_stock BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own products"
ON public.products FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = products.store_id
        AND stores.owner_id = auth.uid()
    )
);

-- 4. Create Tags Table (for product matching)
CREATE TABLE public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT, -- e.g., 'Mood', 'Flavor', 'Strength'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own tags"
ON public.tags FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = tags.store_id
        AND stores.owner_id = auth.uid()
    )
);

-- 5. Product Tags Junction
CREATE TABLE public.product_tags (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- Enable RLS for product_tags
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own product tags"
ON public.product_tags FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products
        JOIN public.stores ON products.store_id = stores.id
        WHERE products.id = product_tags.product_id
        AND stores.owner_id = auth.uid()
    )
);

-- 6. Add optional store_id and zone_id to forms
ALTER TABLE public.forms
ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
ADD COLUMN zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
ADD COLUMN flow_type TEXT DEFAULT 'standard'; -- 'standard', 'entrance', 'zone'

-- 7. Add Triggers for updated_at
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zones_updated_at
BEFORE UPDATE ON public.zones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
