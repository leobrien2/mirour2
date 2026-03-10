// ============================================================
// Analytics Types — Mirour Shopper Analytics
// ============================================================

/** Per-touchpoint (per-form) metrics returned by get_touchpoint_metrics() RPC */
export interface TouchpointMetrics {
  total_scans:           number;
  unique_visitors:       number;
  return_visitors:       number;
  completion_rate:       number | null; // 0–100
  abandonment_rate:      number | null;
  avg_time_seconds:      number | null;
  profile_capture_rate:  number | null;

  drop_off_by_node: Array<{
    drop_off_node_id: string;
    drop_offs:        number;
  }>;

  most_saved_products: Array<{
    product_id: string;
    name:       string;
    saves:      number;
  }>;

  peak_hours: Array<{
    hour:  number; // 0–23
    scans: number;
  }>;

  response_distribution: Array<{
    question_id: string;
    answer:      string;
    count:       number;
  }>;

  flow_versions: Array<{
    flow_version: string;
    sessions:     number;
  }>;
}

/** Per-store (location) rollup returned by get_location_metrics() RPC */
export interface LocationMetrics {
  total_scans:                 number;
  unique_visitors:             number;
  new_vs_returning: {
    new:       number;
    returning: number;
  };
  total_customers_identified:  number;
  cross_location_visitors:     number;
  saves_without_purchase:      number;
  vip_customer_count:          number;
  lapsed_count:                number;

  top_touchpoints: Array<{
    form_id:   string;
    name:      string;
    zone_name: string | null;
    scans:     number;
  }>;
}

/** A contact in the remarketing_contacts view */
export interface RemarketingContact {
  customer_id:            string;
  store_id:               string;
  name:                   string | null;
  email:                  string | null;
  phone:                  string | null;
  traits:                 Record<string, unknown> | null;
  opted_in_at:            string;
  last_active:            string | null;
  visit_count:            number;
  is_vip:                 boolean;
  is_cross_location:      boolean;
  completed_flow:         boolean;
  saved_item_count:       number;
  saves_without_purchase: number;
}

/** A row from the saves_without_purchase view */
export interface SaveWithoutPurchase {
  save_id:        string;
  store_id:       string;
  customer_id:    string;
  customer_name:  string | null;
  customer_phone: string | null;
  customer_email: string | null;
  product_id:     string;
  product_name:   string;
  price:          number | null;
  image_url:      string | null;
  sku:            string | null;
  saved_at:       string;
  purchased_at:   string | null;
  days_since_saved: number;
}

/** A session in the visitor timeline returned by get_visitor_sessions() */
export interface VisitorSession {
  session_id:         string;
  form_id:            string;
  flow_name:          string;
  status:             "in_progress" | "completed" | "abandoned";
  flow_version:       string | null;
  visited_nodes:      string[];
  partial_answers:    Record<string, unknown>;
  drop_off_node_id:   string | null;
  total_time_seconds: number | null;
  started_at:         string;
  completed_at:       string | null;
  last_activity_at:   string;
}

/** A row from the cross_location_visitors view */
export interface CrossLocationVisitor {
  visitor_id:    string;
  customer_id:   string | null;
  customer_name: string | null;
  phone:         string | null;
  email:         string | null;
  stores_visited: number;
  journey: Array<{
    store_id:   string;
    visited_at: string;
    session_id: string;
  }>;
}

/** A row from the flow_reentries view */
export interface FlowReentry {
  visitor_id:    string;
  form_id:       string;
  flow_name:     string;
  store_id:      string;
  total_sessions: number;
  completions:   number;
  abandonments:  number;
  first_visit:   string;
  last_visit:    string;
}
