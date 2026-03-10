-- ============================================================
-- Remarketing & Segmentation Views
-- Safe: CREATE OR REPLACE VIEW, no existing tables modified
-- ============================================================

-- ── 1. All opted-in contacts with segmentation flags ─────────────────────────
-- "Opted in" = gave phone or email through a flow.
-- This is the master remarketing list.

CREATE OR REPLACE VIEW public.remarketing_contacts AS
SELECT
  c.id              AS customer_id,
  c.store_id,
  c.name,
  c.email,
  c.phone,
  c.traits,
  c.created_at      AS opted_in_at,
  c.last_active,
  COALESCE(c.visit_count, 1)  AS visit_count,

  -- VIP: visited 3+ times
  (COALESCE(c.visit_count, 1) >= 3)   AS is_vip,

  -- Cross-location: has visited more than one store
  (
    SELECT COUNT(DISTINCT store_id) > 1
    FROM public.visitor_location_journeys vlj
    WHERE vlj.customer_id = c.id
  )                                     AS is_cross_location,

  -- Engagement: did they complete at least one flow?
  EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.customer_phone = c.phone
       OR r.customer_email = c.email
  )                                     AS completed_flow,

  -- Saved item count
  (
    SELECT COUNT(*)
    FROM public.saved_items si
    WHERE si.customer_id = c.id
  )                                     AS saved_item_count,

  -- Saves without purchase (remarketing gold)
  (
    SELECT COUNT(*)
    FROM public.saved_items si
    WHERE si.customer_id = c.id AND si.purchased_at IS NULL
  )                                     AS saves_without_purchase

FROM public.customers c
WHERE c.phone IS NOT NULL OR c.email IS NOT NULL;


-- ── 2. Lapsed visitors — engaged but gone quiet ───────────────────────────────
-- Definition: has contact info but last_active > 7 days ago.

CREATE OR REPLACE VIEW public.lapsed_visitors AS
SELECT
  c.id                  AS customer_id,
  c.store_id,
  c.name,
  c.email,
  c.phone,
  c.last_active,
  EXTRACT(EPOCH FROM (now() - c.last_active)) / 86400  AS days_since_visit,
  c.traits,
  COALESCE(c.visit_count, 1)                           AS visit_count
FROM public.customers c
WHERE c.last_active IS NOT NULL
  AND c.last_active < now() - INTERVAL '7 days'
  AND (c.phone IS NOT NULL OR c.email IS NOT NULL);


-- ── 3. Saves without purchase — hottest remarketing list ─────────────────────
-- Every product a known customer saved but hasn't purchased yet.

CREATE OR REPLACE VIEW public.saves_without_purchase AS
SELECT
  si.id           AS save_id,
  si.store_id,
  si.customer_id,
  c.name          AS customer_name,
  c.phone         AS customer_phone,
  c.email         AS customer_email,
  p.id            AS product_id,
  p.name          AS product_name,
  p.price,
  p.image_url,
  p.sku,
  si.created_at   AS saved_at,
  si.purchased_at,
  -- How many days since they saved it
  EXTRACT(EPOCH FROM (now() - si.created_at)) / 86400   AS days_since_saved
FROM public.saved_items si
JOIN public.products p  ON p.id  = si.product_id
LEFT JOIN public.customers c ON c.id = si.customer_id
WHERE si.customer_id IS NOT NULL
  AND si.purchased_at IS NULL
ORDER BY si.created_at DESC;


-- ── 4. Cross-location visitor journeys — same person, multiple stores ─────────

CREATE OR REPLACE VIEW public.cross_location_visitors AS
SELECT
  vlj.visitor_id,
  vlj.customer_id,
  c.name      AS customer_name,
  c.phone,
  c.email,
  COUNT(DISTINCT vlj.store_id)   AS stores_visited,
  json_agg(
    json_build_object(
      'store_id',   vlj.store_id,
      'visited_at', vlj.visited_at,
      'session_id', vlj.session_id
    )
    ORDER BY vlj.visited_at
  )                              AS journey
FROM public.visitor_location_journeys vlj
LEFT JOIN public.customers c ON c.id = vlj.customer_id
GROUP BY vlj.visitor_id, vlj.customer_id, c.name, c.phone, c.email
HAVING COUNT(DISTINCT vlj.store_id) > 1;


-- ── 5. Flow re-entries — same visitor returning to the same flow ──────────────

CREATE OR REPLACE VIEW public.flow_reentries AS
SELECT
  fs.visitor_id,
  fs.form_id,
  f.name             AS flow_name,
  f.store_id,
  COUNT(*)           AS total_sessions,
  COUNT(*) FILTER (WHERE status = 'completed')  AS completions,
  COUNT(*) FILTER (WHERE status = 'abandoned')  AS abandonments,
  MIN(fs.started_at)                             AS first_visit,
  MAX(fs.started_at)                             AS last_visit
FROM public.flow_sessions fs
JOIN public.forms f ON f.id = fs.form_id
GROUP BY fs.visitor_id, fs.form_id, f.name, f.store_id
HAVING COUNT(*) > 1
ORDER BY total_sessions DESC;
