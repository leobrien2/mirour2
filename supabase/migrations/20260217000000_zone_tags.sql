-- Migration: zone_tags junction table
-- Phase 1: Critical schema gap - zones need many-to-many relationship with tags

CREATE TABLE public.zone_tags (
    zone_id UUID REFERENCES public.zones(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (zone_id, tag_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.zone_tags ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage zone_tags for zones they own
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
CREATE INDEX idx_zone_tags_zone_id ON public.zone_tags(zone_id);
CREATE INDEX idx_zone_tags_tag_id ON public.zone_tags(tag_id);

-- Comments for documentation
COMMENT ON TABLE public.zone_tags IS 'Junction table linking zones to tags for recommendation filtering';
COMMENT ON COLUMN public.zone_tags.zone_id IS 'Reference to zone';
COMMENT ON COLUMN public.zone_tags.tag_id IS 'Reference to tag';
