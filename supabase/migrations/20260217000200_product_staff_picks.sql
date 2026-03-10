-- Migration: Product staff picks and zone assignment
-- Phase 1: Add fallback recommendations and zone-first filtering support

ALTER TABLE public.products
ADD COLUMN is_staff_pick BOOLEAN DEFAULT false,
ADD COLUMN zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;

-- Partial index for quick staff pick queries (only index where true)
CREATE INDEX idx_products_staff_pick ON public.products(store_id, is_staff_pick) WHERE is_staff_pick = true;

-- Index for zone-based filtering
CREATE INDEX idx_products_zone ON public.products(zone_id);

-- Comments for documentation
COMMENT ON COLUMN public.products.is_staff_pick IS 'True for products to show when no tag matches found (fallback recommendations). Should be 2-3 per zone or 4-6 globally per store.';
COMMENT ON COLUMN public.products.zone_id IS 'Optional zone assignment for zone-first filtering. When customer scans zone QR, products from this zone are prioritized.';
