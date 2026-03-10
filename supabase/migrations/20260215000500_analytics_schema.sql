-- Add zone_id to form_visits to track where scans mimic
-- This allows us to see "Red Wine Zone" vs "Entrance" performance

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_visits' AND column_name='zone_id') THEN
        ALTER TABLE public.form_visits ADD COLUMN zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Index for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_form_visits_zone_id ON public.form_visits(zone_id);

-- Update RLS if needed (usually public insert is already allowed for anon)
-- existing policies on form_visits should cover this if they allow INSERT for anon.
