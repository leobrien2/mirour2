-- ============================================================
-- Analytics Functions — Touchpoint & Location Metrics
-- Safe: CREATE OR REPLACE won't drop anything
-- Called by new dashboard hooks only (not existing app code)
-- ============================================================

-- ── 1. Per-touchpoint (per-form) analytics ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_touchpoint_metrics(p_form_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(

    -- Scan volume
    'total_scans',
    (SELECT COUNT(*) FROM public.form_visits WHERE form_id = p_form_id),

    'unique_visitors',
    (SELECT COUNT(DISTINCT visitor_id) FROM public.form_visits WHERE form_id = p_form_id),

    'return_visitors',
    (SELECT COUNT(*) FROM public.form_visits WHERE form_id = p_form_id AND is_return_visitor = true),

    -- Completion funnel
    'completion_rate',
    (
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'completed') /
        NULLIF(COUNT(*), 0), 1
      )
      FROM public.flow_sessions WHERE form_id = p_form_id
    ),

    'abandonment_rate',
    (
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'abandoned') /
        NULLIF(COUNT(*), 0), 1
      )
      FROM public.flow_sessions WHERE form_id = p_form_id
    ),

    -- Time in flow
    'avg_time_seconds',
    (
      SELECT ROUND(AVG(total_time_seconds))
      FROM public.flow_sessions
      WHERE form_id = p_form_id AND status = 'completed' AND total_time_seconds IS NOT NULL
    ),

    -- Identity capture rate (% of scanners who gave phone/email)
    'profile_capture_rate',
    (
      SELECT ROUND(
        100.0 * COUNT(DISTINCT COALESCE(customer_phone, customer_email)) /
        NULLIF((SELECT COUNT(DISTINCT visitor_id) FROM public.form_visits WHERE form_id = p_form_id), 0),
        1
      )
      FROM public.responses
      WHERE form_id = p_form_id
        AND (customer_phone IS NOT NULL OR customer_email IS NOT NULL)
    ),

    -- Where people dropped off
    'drop_off_by_node',
    (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.drop_offs DESC), '[]'::json)
      FROM (
        SELECT drop_off_node_id, COUNT(*) AS drop_offs
        FROM public.flow_sessions
        WHERE form_id = p_form_id
          AND status = 'abandoned'
          AND drop_off_node_id IS NOT NULL
        GROUP BY 1
        ORDER BY 2 DESC
      ) t
    ),

    -- Which products were saved most
    'most_saved_products',
    (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.saves DESC), '[]'::json)
      FROM (
        SELECT p.id AS product_id, p.name, COUNT(*) AS saves
        FROM public.saved_items si
        JOIN public.products p ON p.id = si.product_id
        JOIN public.flow_sessions fs ON fs.id::text = si.session_id
        WHERE fs.form_id = p_form_id
        GROUP BY p.id, p.name
        ORDER BY saves DESC
        LIMIT 10
      ) t
    ),

    -- Peak scan hours
    'peak_hours',
    (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.scans DESC), '[]'::json)
      FROM (
        SELECT EXTRACT(HOUR FROM visited_at)::int AS hour, COUNT(*) AS scans
        FROM public.form_visits
        WHERE form_id = p_form_id
        GROUP BY 1
        ORDER BY scans DESC
      ) t
    ),

    -- Response distribution per question
    'response_distribution',
    (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.count DESC), '[]'::json)
      FROM (
        SELECT
          kv.key   AS question_id,
          kv.value::text AS answer,
          COUNT(*) AS count
        FROM public.responses r,
          LATERAL jsonb_each(r.answers) AS kv
        WHERE r.form_id = p_form_id
        GROUP BY 1, 2
        ORDER BY count DESC
      ) t
    ),

    -- Flow versions (A/B breakdown)
    'flow_versions',
    (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT flow_version, COUNT(*) AS sessions
        FROM public.flow_sessions
        WHERE form_id = p_form_id AND flow_version IS NOT NULL
        GROUP BY 1
      ) t
    )

  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ── 2. Per-store (location) rollup analytics ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_location_metrics(p_store_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(

    -- Total scan volume across all touchpoints in this store
    'total_scans',
    (
      SELECT COUNT(*) FROM public.form_visits fv
      JOIN public.forms f ON f.id = fv.form_id
      WHERE f.store_id = p_store_id
    ),

    'unique_visitors',
    (
      SELECT COUNT(DISTINCT fv.visitor_id) FROM public.form_visits fv
      JOIN public.forms f ON f.id = fv.form_id
      WHERE f.store_id = p_store_id
    ),

    -- New vs returning
    'new_vs_returning',
    (
      SELECT json_build_object(
        'new',       COUNT(*) FILTER (WHERE NOT fv.is_return_visitor),
        'returning', COUNT(*) FILTER (WHERE fv.is_return_visitor)
      )
      FROM public.form_visits fv
      JOIN public.forms f ON f.id = fv.form_id
      WHERE f.store_id = p_store_id
    ),

    -- Identified customers (gave phone or email)
    'total_customers_identified',
    (
      SELECT COUNT(*) FROM public.customers
      WHERE store_id = p_store_id
        AND (phone IS NOT NULL OR email IS NOT NULL)
    ),

    -- Cross-location: unique visitors seen at multiple stores
    'cross_location_visitors',
    (
      SELECT COUNT(DISTINCT visitor_id) FROM public.visitor_location_journeys
      WHERE store_id = p_store_id
        AND visitor_id IN (
          SELECT visitor_id FROM public.visitor_location_journeys
          GROUP BY visitor_id HAVING COUNT(DISTINCT store_id) > 1
        )
    ),

    -- Top performing touchpoints
    'top_touchpoints',
    (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.scans DESC), '[]'::json)
      FROM (
        SELECT f.id AS form_id, f.name, z.name AS zone_name, COUNT(fv.id) AS scans
        FROM public.form_visits fv
        JOIN public.forms f ON f.id = fv.form_id
        LEFT JOIN public.zones z ON z.id = f.zone_id
        WHERE f.store_id = p_store_id
        GROUP BY f.id, f.name, z.name
        ORDER BY scans DESC
        LIMIT 10
      ) t
    ),

    -- Items saved but not purchased (remarketing pool)
    'saves_without_purchase',
    (
      SELECT COUNT(*) FROM public.saved_items
      WHERE store_id = p_store_id
        AND customer_id IS NOT NULL
        AND purchased_at IS NULL
    ),

    -- VIP customers (visit_count >= 3)
    'vip_customer_count',
    (
      SELECT COUNT(*) FROM public.customers
      WHERE store_id = p_store_id AND visit_count >= 3
    ),

    -- Lapsed visitors (last_active > 7 days ago, but have phone/email)
    'lapsed_count',
    (
      SELECT COUNT(*) FROM public.customers
      WHERE store_id = p_store_id
        AND last_active < now() - INTERVAL '7 days'
        AND (phone IS NOT NULL OR email IS NOT NULL)
    )

  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ── 3. Cross-session return visit query helper ────────────────────────────────
-- Returns all sessions for a given visitor_id across all forms in a store.
-- Used in the customer profile page to show "Return visits" timeline.

CREATE OR REPLACE FUNCTION public.get_visitor_sessions(
  p_store_id  UUID,
  p_visitor_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.started_at DESC), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      fs.id            AS session_id,
      fs.form_id,
      f.name           AS flow_name,
      fs.status,
      fs.flow_version,
      fs.visited_nodes,
      fs.partial_answers,
      fs.drop_off_node_id,
      fs.total_time_seconds,
      fs.started_at,
      fs.completed_at,
      fs.last_activity_at
    FROM public.flow_sessions fs
    JOIN public.forms f ON f.id = fs.form_id
    WHERE f.store_id  = p_store_id
      AND fs.visitor_id = p_visitor_id
    ORDER BY fs.started_at DESC
    LIMIT 50
  ) t;

  RETURN v_result;
END;
$$;
