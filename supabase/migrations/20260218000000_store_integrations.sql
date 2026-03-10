-- Migration: Store Integrations
-- Stores API keys for third-party integrations (Squarespace, Lightspeed, Shopify)

CREATE TABLE public.store_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('squarespace', 'lightspeed', 'shopify')),
    api_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (store_id, platform)
);

-- Enable RLS
ALTER TABLE public.store_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own integrations"
ON public.store_integrations FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = store_integrations.store_id
        AND stores.owner_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_store_integrations_updated_at
BEFORE UPDATE ON public.store_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.store_integrations IS 'Stores third-party platform API keys per store. One row per platform per store.';
