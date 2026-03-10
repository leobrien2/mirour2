-- ========================================
-- CONSOLIDATED DATABASE MIGRATION SCRIPT
-- ========================================
-- This script consolidates all 22 migration files into a single executable script
-- Run this in your Supabase SQL Editor to set up the complete database schema
-- 
-- Project: pifsphcrofbvabifrdok.supabase.co
-- Date: 2026-02-17
--
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard (https://pifsphcrofbvabifrdok.supabase.co)
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Copy and paste this entire script
-- 5. Click "Run" to execute
-- ========================================

-- Migration 1: Base schema (profiles, forms, responses)
-- From: 20251230191046_57c8574d-bd64-4a89-96b1-69c7dcc11e93.sql

-- Create profiles table for user business information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT 'My Business',
  business_logo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create forms table
CREATE TABLE IF NOT EXISTS public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  perk TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  capture_name BOOLEAN NOT NULL DEFAULT true,
  capture_email BOOLEAN NOT NULL DEFAULT false,
  capture_phone BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on forms
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

-- Forms policies
CREATE POLICY "Users can CRUD their own forms"
ON public.forms FOR ALL
USING (auth.uid() = owner_id);

-- Create responses table
CREATE TABLE IF NOT EXISTS public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  redemption_code TEXT UNIQUE NOT NULL,
  perk_redeemed BOOLEAN NOT NULL DEFAULT false,
  additional_feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on responses
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Responses policies
CREATE POLICY "Form owners can view responses"
ON public.responses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.forms
    WHERE forms.id = responses.form_id
    AND forms.owner_id = auth.uid()
  )
);

CREATE POLICY "Form owners can update responses"
ON public.responses FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.forms
    WHERE forms.id = responses.form_id
    AND forms.owner_id = auth.uid()
  )
);

CREATE POLICY "Form owners can delete responses"
ON public.responses FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.forms
    WHERE forms.id = responses.form_id
    AND forms.owner_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forms_updated_at
BEFORE UPDATE ON public.forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup - creates profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, business_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'My Business'));
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for logos
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated users can upload their own logo" ON storage.objects;
CREATE POLICY "Authenticated users can upload their own logo"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own logo" ON storage.objects;
CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own logo" ON storage.objects;
CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Migration 2: Rename description to internal_goal
-- From: 20251231013117_b1d5c669-909b-43cf-8a4d-6e2ab4a7d60b.sql
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forms' AND column_name='description') THEN
        ALTER TABLE public.forms RENAME COLUMN description TO internal_goal;
    END IF;
END $$;

-- Migration 3: Allow anyone to view profiles
-- From: 20251231021645_9de3a8a8-76c6-474e-be44-58aa9bbeeab8.sql
DROP POLICY IF EXISTS "Anyone can view profiles for public display" ON public.profiles;
CREATE POLICY "Anyone can view profiles for public display"
ON public.profiles
FOR SELECT
USING (true);

-- Migration 4: Create public_forms view
-- From: 20251231025647_7fc3ab32-4254-4da4-9d53-b995f2b6c324.sql
CREATE OR REPLACE VIEW public.public_forms AS
SELECT 
  id,
  name,
  perk,
  questions,
  capture_name,
  capture_email,
  capture_phone,
  active,
  created_at,
  updated_at
FROM public.forms
WHERE active = true;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_forms TO anon;
GRANT SELECT ON public.public_forms TO authenticated;

-- Migration 5: Add notes to profiles
-- From: 20260108031843_d531eea6-f3be-4c08-a40e-55e751fca352.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='notes') THEN
        ALTER TABLE public.profiles ADD COLUMN notes TEXT DEFAULT NULL;
    END IF;
END $$;

-- Migration 6: Add notes to responses
-- From: 20260108032110_c49d066f-80f6-4b8a-9959-b83b48fb3070.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='responses' AND column_name='notes') THEN
        ALTER TABLE public.responses ADD COLUMN notes TEXT DEFAULT NULL;
    END IF;
END $$;

-- Migration 7: Create get_form_profile function
-- From: 20260108052446_8b46bee0-6d86-47a5-98f2-049d3f6baec5.sql
CREATE OR REPLACE FUNCTION public.get_form_profile(form_id_param UUID)
RETURNS TABLE (
  business_name TEXT,
  business_logo TEXT
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.business_name,
    p.business_logo
  FROM profiles p
  INNER JOIN forms f ON f.owner_id = p.id
  WHERE f.id = form_id_param
  AND f.active = true;
$$;

-- Migration 8: Create analytics tables (form_visits, flow_sessions)
-- From: 20260114194317_8f08c481-e6d7-4d48-a6bf-afc1bfeda8a1.sql
CREATE TABLE IF NOT EXISTS public.form_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    visitor_id text NOT NULL,
    referrer text,
    user_agent text,
    visited_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_form_visits_form_id ON public.form_visits(form_id);
CREATE INDEX IF NOT EXISTS idx_form_visits_visitor_id ON public.form_visits(visitor_id);

-- Enable RLS
ALTER TABLE public.form_visits ENABLE ROW LEVEL SECURITY;

-- Form owners can view visits for their forms
DROP POLICY IF EXISTS "Form owners can view visits" ON public.form_visits;
CREATE POLICY "Form owners can view visits"
ON public.form_visits
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.forms
    WHERE forms.id = form_visits.form_id
    AND forms.owner_id = auth.uid()
));

-- Create flow_sessions table to track journey through forms
CREATE TABLE IF NOT EXISTS public.flow_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    visitor_id text NOT NULL,
    current_node_id text,
    visited_nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
    partial_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    response_id uuid REFERENCES public.responses(id) ON DELETE SET NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_flow_sessions_form_id ON public.flow_sessions(form_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_visitor_id ON public.flow_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_status ON public.flow_sessions(status);

-- Enable RLS
ALTER TABLE public.flow_sessions ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for form uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-uploads', 'form-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for form-uploads bucket
DROP POLICY IF EXISTS "Anyone can upload response images" ON storage.objects;
CREATE POLICY "Anyone can upload response images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'form-uploads' AND (storage.foldername(name))[1] = 'responses');

DROP POLICY IF EXISTS "Anyone can view form uploads" ON storage.objects;
CREATE POLICY "Anyone can view form uploads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'form-uploads');

DROP POLICY IF EXISTS "Authenticated users can upload form section images" ON storage.objects;
CREATE POLICY "Authenticated users can upload form section images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'form-uploads' AND (storage.foldername(name))[1] = 'forms' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update form uploads" ON storage.objects;
CREATE POLICY "Authenticated users can update form uploads"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'form-uploads' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete form uploads" ON storage.objects;
CREATE POLICY "Authenticated users can delete form uploads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'form-uploads' AND auth.role() = 'authenticated');

-- Migration 9: Re-add public read access to forms
-- From: 20260204192537_78725d14-e92f-4910-ab07-7bf4a1cfdca0.sql
DROP POLICY IF EXISTS "Anyone can read active forms" ON public.forms;
CREATE POLICY "Anyone can read active forms"
ON public.forms
FOR SELECT
USING (active = true);

-- Migration 10: Fix RLS policies for anonymous insert
-- From: 20260204193236_282295a4-dcb1-4619-bede-21eb7fa611f5.sql
DROP POLICY IF EXISTS "Anyone can create responses" ON public.responses;
CREATE POLICY "Anyone can create responses" ON public.responses 
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create flow sessions" ON public.flow_sessions;
CREATE POLICY "Anyone can create flow sessions" ON public.flow_sessions 
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create form visits" ON public.form_visits;
CREATE POLICY "Anyone can create form visits" ON public.form_visits 
  FOR INSERT TO public WITH CHECK (true);

-- Migration 11: Allow anonymous users to read responses
-- From: 20260204194734_aae0c263-1216-4373-a1ba-3dc5efa582c2.sql
DROP POLICY IF EXISTS "Anyone can read responses for active forms" ON public.responses;
CREATE POLICY "Anyone can read responses for active forms"
ON public.responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = responses.form_id 
    AND forms.active = true
  )
);

-- Migration 12: Fix flow_sessions RLS policies
-- From: 20260207021502_5ed0be5c-4980-4846-a802-25167056f316.sql
DROP POLICY IF EXISTS "Form owners can view sessions" ON public.flow_sessions;
CREATE POLICY "Form owners can view sessions"
  ON public.flow_sessions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = flow_sessions.form_id
    AND forms.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Visitors can update their own sessions" ON public.flow_sessions;
CREATE POLICY "Visitors can update their own sessions"
  ON public.flow_sessions
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Migration 13: Phase 1 - Stores, Zones, Products, Tags
-- From: 20260214012000_phase1_schema.sql

-- 1. Create Stores Table
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own stores" ON public.stores;
CREATE POLICY "Users can CRUD their own stores"
ON public.stores FOR ALL
USING (auth.uid() = owner_id);

-- 2. Create Zones Table
CREATE TABLE IF NOT EXISTS public.zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for zones
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own zones" ON public.zones;
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
CREATE TABLE IF NOT EXISTS public.products (
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

DROP POLICY IF EXISTS "Users can CRUD their own products" ON public.products;
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
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT, -- e.g., 'Mood', 'Flavor', 'Strength'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own tags" ON public.tags;
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
CREATE TABLE IF NOT EXISTS public.product_tags (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- Enable RLS for product_tags
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own product tags" ON public.product_tags;
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
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forms' AND column_name='store_id') THEN
        ALTER TABLE public.forms ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forms' AND column_name='zone_id') THEN
        ALTER TABLE public.forms ADD COLUMN zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forms' AND column_name='flow_type') THEN
        ALTER TABLE public.forms ADD COLUMN flow_type TEXT DEFAULT 'standard';
    END IF;
END $$;

-- 7. Add Triggers for updated_at
DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_zones_updated_at ON public.zones;
CREATE TRIGGER update_zones_updated_at
BEFORE UPDATE ON public.zones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migration 14: Customer profiles
-- From: 20260214013500_customer_profiles.sql
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_email ON public.customers(store_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_phone ON public.customers(store_id, phone) WHERE phone IS NOT NULL;

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Policies for anon/auth access
DROP POLICY IF EXISTS "Enable insert for anon/authenticated users" ON public.customers;
CREATE POLICY "Enable insert for anon/authenticated users" ON public.customers for INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable select for anon/authenticated users" ON public.customers;
CREATE POLICY "Enable select for anon/authenticated users" ON public.customers for SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Enable update for anon/authenticated users" ON public.customers;
CREATE POLICY "Enable update for anon/authenticated users" ON public.customers for UPDATE TO anon, authenticated USING (true);

-- Migration 15: Merge customer traits function
-- From: 20260215000000_merge_traits.sql
CREATE OR REPLACE FUNCTION public.merge_customer_traits(
    p_store_id UUID,
    p_email TEXT,
    p_phone TEXT,
    p_name TEXT,
    p_new_traits JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_current_traits JSONB;
    v_merged_traits JSONB;
BEGIN
    -- 1. Try to find existing customer by email OR phone within this store
    SELECT id, traits INTO v_customer_id, v_current_traits
    FROM public.customers
    WHERE store_id = p_store_id
    AND (
        (p_email IS NOT NULL AND email = p_email)
        OR 
        (p_phone IS NOT NULL AND phone = p_phone)
    )
    LIMIT 1;

    -- 2. If customer exists, merge traits
    IF v_customer_id IS NOT NULL THEN
        SELECT 
            jsonb_set(
                COALESCE(v_current_traits, '{}'::jsonb) || p_new_traits,
                '{tags}',
                (
                    SELECT jsonb_agg(DISTINCT elem)
                    FROM (
                        SELECT jsonb_array_elements(COALESCE(v_current_traits->'tags', '[]'::jsonb)) AS elem
                        UNION
                        SELECT jsonb_array_elements(COALESCE(p_new_traits->'tags', '[]'::jsonb)) AS elem
                    ) t
                )
            )
        INTO v_merged_traits;

        -- Update the customer
        UPDATE public.customers
        SET 
            traits = v_merged_traits,
            name = COALESCE(p_name, name),
            email = COALESCE(p_email, email),
            phone = COALESCE(p_phone, phone),
            updated_at = now()
        WHERE id = v_customer_id;
        
        RETURN v_customer_id;
    
    ELSE
        -- 3. If new customer, insert
        INSERT INTO public.customers (store_id, email, phone, name, traits)
        VALUES (p_store_id, p_email, p_phone, p_name, p_new_traits)
        RETURNING id INTO v_customer_id;
        
        RETURN v_customer_id;
    END IF;
END;
$$;

-- Migration 16: Add zone_id to form_visits
-- From: 20260215000500_analytics_schema.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_visits' AND column_name='zone_id') THEN
        ALTER TABLE public.form_visits ADD COLUMN zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_form_visits_zone_id ON public.form_visits(zone_id);

-- Migration 17: Zone tags junction table
-- From: 20260217000000_zone_tags.sql
CREATE TABLE IF NOT EXISTS public.zone_tags (
    zone_id UUID REFERENCES public.zones(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (zone_id, tag_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.zone_tags ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage zone_tags for zones they own
DROP POLICY IF EXISTS "Users can CRUD their own zone tags" ON public.zone_tags;
CREATE POLICY "Users can CRUD their own zone tags"
ON public.zone_tags FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.zones
        JOIN public.stores ON zones.store_id = stores.id
        WHERE zones.id = zone_tags.zone_id
        AND stores.owner_id = auth.uid()
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_zone_tags_zone_id ON public.zone_tags(zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_tags_tag_id ON public.zone_tags(tag_id);

-- Migration 18: Add tag constraint type
-- From: 20260217000100_tag_constraint_type.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tags' AND column_name='is_hard_constraint') THEN
        ALTER TABLE public.tags ADD COLUMN is_hard_constraint BOOLEAN DEFAULT false;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tags_constraint_type ON public.tags(store_id, is_hard_constraint);

-- Migration 19: Add staff picks and zone assignment to products
-- From: 20260217000200_product_staff_picks.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_staff_pick') THEN
        ALTER TABLE public.products ADD COLUMN is_staff_pick BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='zone_id') THEN
        ALTER TABLE public.products ADD COLUMN zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_staff_pick ON public.products(store_id, is_staff_pick) WHERE is_staff_pick = true;
CREATE INDEX IF NOT EXISTS idx_products_zone ON public.products(zone_id);

-- Migration 20: Add zone education fields
-- From: 20260217100000_zone_education_copy.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zones' AND column_name='zone_what') THEN
        ALTER TABLE public.zones ADD COLUMN zone_what TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zones' AND column_name='zone_when') THEN
        ALTER TABLE public.zones ADD COLUMN zone_when TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zones' AND column_name='zone_who') THEN
        ALTER TABLE public.zones ADD COLUMN zone_who TEXT DEFAULT '';
    END IF;
END $$;

-- Backfill existing zones with placeholder copy
UPDATE public.zones 
SET 
  zone_what = COALESCE(NULLIF(zone_what, ''), 'Explore this curated selection.'),
  zone_when = COALESCE(NULLIF(zone_when, ''), 'Browse anytime.'),
  zone_who = COALESCE(NULLIF(zone_who, ''), 'Everyone is welcome.')
WHERE zone_what IS NULL OR zone_what = '' OR zone_when IS NULL OR zone_when = '' OR zone_who IS NULL OR zone_who = '';

-- ========================================
-- MIGRATION COMPLETE!
-- ========================================
-- All tables, policies, functions, and indexes have been created.
-- You can now use the application with this database.
-- ========================================
