-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    name TEXT,
    email TEXT,
    phone TEXT,
    traits JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- Add unique constraints (careful with nullable fields)
-- Ensure unique email per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_email ON public.customers(store_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_phone ON public.customers(store_id, phone) WHERE phone IS NOT NULL;

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Policies for anon/auth access (similar to responses)
CREATE POLICY "Enable insert for anon/authenticated users" ON public.customers for INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Enable select for anon/authenticated users" ON public.customers for SELECT TO anon, authenticated USING (true);
CREATE POLICY "Enable update for anon/authenticated users" ON public.customers for UPDATE TO anon, authenticated USING (true);
