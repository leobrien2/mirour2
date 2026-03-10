-- 1. Create customer_tags table
CREATE TABLE IF NOT EXISTS public.customer_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE, -- Nullable for purely anonymous that never sign up
    session_id TEXT NOT NULL, -- Ties anonymous interactions together
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    source TEXT, -- e.g., 'quiz', 'question-1', 'session-question'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_tags_store_id ON public.customer_tags(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer_id ON public.customer_tags(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_session_id ON public.customer_tags(session_id);

-- Enable RLS for customer_tags
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for anon/authenticated users" ON public.customer_tags FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Enable select for anon/authenticated users" ON public.customer_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can CRUD their own store customer tags" ON public.customer_tags FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = customer_tags.store_id
        AND stores.owner_id = auth.uid()
    )
);

-- 2. Create interactions table
CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE, -- Nullable
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'qr_scan', 'quiz_answer', 'product_shown', 'item_saved', 'identity_captured'
    metadata JSONB DEFAULT '{}'::jsonb, -- e.g., { "question_id": "q1", "answer": "yes", "product_id": "123" }
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interactions_store_id ON public.interactions(store_id);
CREATE INDEX IF NOT EXISTS idx_interactions_customer_id ON public.interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_interactions_session_id ON public.interactions(session_id);

-- Enable RLS for interactions
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for anon/authenticated users" ON public.interactions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Enable select for anon/authenticated users" ON public.interactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can CRUD their own store interactions" ON public.interactions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = interactions.store_id
        AND stores.owner_id = auth.uid()
    )
);

-- 3. Create saved_items table
CREATE TABLE IF NOT EXISTS public.saved_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE, -- Usually set, but could be null initially and backfilled
    session_id TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    -- NOTE: Intentionally not making unique (customer_id, product_id) at DB level to allow guest session saves before linking, 
    -- will manage duplication at application/linking level. Or we can just use a unique constraint if customer_id IS NOT NULL.
);

-- Partial unique index to enforce unique saves for known customers
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_items_unique_customer_product 
ON public.saved_items (customer_id, product_id) 
WHERE customer_id IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_items_store_id ON public.saved_items(store_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_customer_id ON public.saved_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_session_id ON public.saved_items(session_id);

-- Enable RLS for saved_items
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for anon/authenticated users" ON public.saved_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Enable select for anon/authenticated users" ON public.saved_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Enable delete for anon/authenticated users" ON public.saved_items FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Users can CRUD their own store saved items" ON public.saved_items FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = saved_items.store_id
        AND stores.owner_id = auth.uid()
    )
);

-- 4. Function to backfill customer_id on identity capture
CREATE OR REPLACE FUNCTION public.link_anonymous_session(
    p_store_id UUID,
    p_session_id TEXT,
    p_customer_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update customer_tags
    UPDATE public.customer_tags
    SET customer_id = p_customer_id
    WHERE session_id = p_session_id AND store_id = p_store_id AND customer_id IS NULL;

    -- Update interactions
    UPDATE public.interactions
    SET customer_id = p_customer_id
    WHERE session_id = p_session_id AND store_id = p_store_id AND customer_id IS NULL;

    -- Update saved_items
    -- Handle potential conflicts where the customer might have already saved the item in a previous session
    -- We'll safely update where not exists, and copy over
    
    -- 1. Insert any saved items from this session that the customer DOES NOT already have
    INSERT INTO public.saved_items (store_id, customer_id, session_id, product_id)
    SELECT p_store_id, p_customer_id, p_session_id, si.product_id
    FROM public.saved_items si
    WHERE si.session_id = p_session_id 
      AND si.store_id = p_store_id 
      AND si.customer_id IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.saved_items existing
          WHERE existing.customer_id = p_customer_id
            AND existing.product_id = si.product_id
      );

    -- 2. Delete the anonymous ones since they are either moved or duplicated
    DELETE FROM public.saved_items
    WHERE session_id = p_session_id AND store_id = p_store_id AND customer_id IS NULL;

END;
$$;
