CREATE OR REPLACE FUNCTION get_form_metrics(p_form_ids varchar[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry_scans int;
  v_quiz_completions int;
  v_profiles_created int;
BEGIN
  -- 1. Entry scans: form_visits, deduplicated by visitor_id in 10-min windows
  WITH visit_windows AS (
    SELECT visitor_id, floor(extract(epoch from visited_at)/600) as window_id
    FROM form_visits
    WHERE form_id = ANY(p_form_ids)
    GROUP BY 1, 2
  )
  SELECT count(*) INTO v_entry_scans FROM visit_windows;

  -- 2. Quiz completions: Responses reaching profile result.
  SELECT count(id) INTO v_quiz_completions
  FROM responses
  WHERE form_id = ANY(p_form_ids);

  -- 3. Profiles created: responses with non-null phone
  SELECT count(DISTINCT customer_phone) INTO v_profiles_created
  FROM responses
  WHERE form_id = ANY(p_form_ids) AND customer_phone IS NOT NULL;

  RETURN json_build_object(
    'entry_scans', COALESCE(v_entry_scans, 0),
    'quiz_completions', COALESCE(v_quiz_completions, 0),
    'profiles_created', COALESCE(v_profiles_created, 0)
  );
END;
$$;
