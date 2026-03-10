-- 1. Create Touchpoint Analytics View
CREATE OR REPLACE VIEW public.vw_touchpoint_analytics AS
SELECT 
    fs.form_id,
    COUNT(fs.id) as total_scans,
    COUNT(DISTINCT fs.visitor_id) as unique_scanners,
    (COUNT(fs.id) - COUNT(DISTINCT fs.visitor_id)) as repeat_scanners,
    
    -- Completion Rate
    SUM(CASE WHEN fs.status = 'completed' THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(fs.id), 0) as completion_rate,
    
    -- Average time in flow (ignoring extremely long abandoned sessions)
    AVG(fs.total_time_seconds) FILTER (WHERE fs.status = 'completed' OR fs.total_time_seconds < 3600) as avg_time_in_flow_seconds

FROM public.flow_sessions fs
GROUP BY fs.form_id;

-- Ensure standard RLS applies (views run as invoker normally, but we can grant select)
GRANT SELECT ON public.vw_touchpoint_analytics TO anon, authenticated;


-- 2. Create Customer 360 View
CREATE OR REPLACE VIEW public.vw_customer_360 AS
WITH customer_activity AS (
    SELECT 
        c.id as customer_id,
        c.email,
        c.phone,
        c.name,
        c.store_id,
        s.owner_id as owner_profile_id,
        
        -- Aggregate Flow Sessions mapped to this customer
        COUNT(fs.id) as total_scans,
        MAX(fs.started_at) as last_scan,
        MIN(fs.started_at) as first_scan,
        SUM(fs.total_time_seconds) as total_time_in_flows,
        
        -- Distinct Stores Visited under the same owner Profile
        (SELECT COUNT(DISTINCT c2.store_id) 
         FROM public.customers c2 
         JOIN public.stores s2 ON c2.store_id = s2.id 
         WHERE c2.email = c.email AND s2.owner_id = s.owner_id AND c2.email IS NOT NULL) as stores_visited_count
        
    FROM public.customers c
    JOIN public.stores s ON c.store_id = s.id
    LEFT JOIN public.visitor_location_journeys vlj ON vlj.customer_id = c.id
    LEFT JOIN public.flow_sessions fs ON fs.id::text = vlj.session_id
    GROUP BY c.id, c.email, c.phone, c.name, c.store_id, s.owner_id
)
SELECT 
    ca.customer_id,
    ca.name,
    ca.email,
    ca.phone,
    
    -- Identity Metrics
    (ca.total_scans = 1) as is_new_visitor,
    ca.total_scans,
    ca.last_scan,
    ca.first_scan,
    
    -- Behavior & Cross-Session
    ca.total_time_in_flows,
    (ca.stores_visited_count > 1) as cross_location_visitor,
    
    -- Related Counts (Subqueries for quick summary)
    (SELECT COUNT(*) FROM public.saved_items si WHERE si.customer_id = ca.customer_id) as items_saved,
    (SELECT COUNT(*) FROM public.submission_answers sa WHERE sa.customer_id = ca.customer_id) as questions_answered
FROM customer_activity ca;

GRANT SELECT ON public.vw_customer_360 TO anon, authenticated;
