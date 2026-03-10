-- Add show_start_page to forms table
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS show_start_page BOOLEAN NOT NULL DEFAULT true;
