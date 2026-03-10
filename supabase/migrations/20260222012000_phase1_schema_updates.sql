-- Products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS in_stock       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured_from  timestamptz,
  ADD COLUMN IF NOT EXISTS active         boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS lightspeed_sku_id varchar;
  
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_lightspeed_sku_id_key') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_lightspeed_sku_id_key UNIQUE (lightspeed_sku_id);
  END IF;
END $$;

-- Zones
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS last_active    timestamptz,
  ADD COLUMN IF NOT EXISTS visit_count    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skus_shown_all text[],
  ADD COLUMN IF NOT EXISTS last_seen      timestamptz,
  ADD COLUMN IF NOT EXISTS zones_saved    text[],
  ADD COLUMN IF NOT EXISTS location_id    varchar,
  ADD COLUMN IF NOT EXISTS anon_id        varchar,
  ADD COLUMN IF NOT EXISTS deleted_at     timestamptz;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_phone_key') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);
  END IF;
END $$;

-- Admin users
DO $$ 
BEGIN
  ALTER TABLE public.admin_users
    ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'staff';
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_role_check') THEN
    ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN ('owner', 'staff'));
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- New tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id           varchar PRIMARY KEY,
  display_name varchar NOT NULL,
  description  text,
  is_default   boolean DEFAULT false,
  zones        text[],
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_rules (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  question   varchar NOT NULL,
  answer     varchar NOT NULL,
  weight     int NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.locations (
  id             varchar PRIMARY KEY,
  display_name   varchar,
  timezone       varchar,
  address        varchar,
  qr_entry_code  varchar
);

CREATE TABLE IF NOT EXISTS public.customer_visits (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id      uuid REFERENCES public.customers(id),
  location_id      varchar REFERENCES public.locations(id),
  visited_at       timestamptz DEFAULT now(),
  profile_at_visit varchar,
  skus_shown       text[],
  zones_scanned    text[]
);

CREATE TABLE IF NOT EXISTS public.zone_store_config (
  zone_id              varchar,
  location_id          varchar,
  location_description varchar,
  PRIMARY KEY (zone_id, location_id)
);

CREATE TABLE IF NOT EXISTS public.sku_profile_copy (
  sku_id         varchar,
  profile_id     uuid,
  copy_override  text,
  PRIMARY KEY (sku_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  anon_id     varchar,
  customer_id uuid,
  event_type  varchar,
  payload     jsonb,
  location_id varchar,
  created_at  timestamptz DEFAULT now()
);
