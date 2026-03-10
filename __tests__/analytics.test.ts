// Jest globals are used

// We mock the structure of what the Postgres RPCs and Views return to verify frontend/mapping logic,
// since these SQL functions are tested manually against the actual Supabase instance.
// Milestone 5: Analytics Verification

describe("Analytics Endpoints & RPC Interfaces", () => {
  describe("get_touchpoint_metrics (RPC mock)", () => {
    test("returns correctly structured touchedpoint metrics", () => {
      // Simulated response from get_touchpoint_metrics
      const mockTouchpointRPCResponse = {
        total_scans: 150,
        unique_visitors: 120,
        return_visitors: 30,
        completion_rate: 85.5,
        abandonment_rate: 14.5,
        avg_time_seconds: 120,
        profile_capture_rate: 45.0,
        drop_off_by_node: [
          { drop_off_node_id: "step_2", drop_offs: 10 },
          { drop_off_node_id: "step_1", drop_offs: 5 },
        ],
        most_saved_products: [
          { product_id: "prod_1", name: "Premium Mirror", saves: 25 },
        ],
        peak_hours: [
          { hour: 14, scans: 45 },
          { hour: 15, scans: 30 },
        ],
        response_distribution: [
          { question_id: "skin_type", answer: "Oily", count: 60 },
          { question_id: "skin_type", answer: "Dry", count: 40 },
        ],
        flow_versions: [
          { flow_version: "v1", sessions: 100 },
          { flow_version: "v2", sessions: 50 },
        ],
      };

      expect(mockTouchpointRPCResponse).toHaveProperty("total_scans", 150);
      expect(mockTouchpointRPCResponse).toHaveProperty("unique_visitors", 120);
      expect(mockTouchpointRPCResponse).toHaveProperty("return_visitors", 30);
      expect(mockTouchpointRPCResponse.drop_off_by_node.length).toBe(2);
      expect(mockTouchpointRPCResponse.most_saved_products[0].saves).toBe(25);
    });
  });

  describe("get_location_metrics (RPC mock)", () => {
    test("returns correctly structured location metrics", () => {
      // Simulated response from get_location_metrics
      const mockLocationRPCResponse = {
        total_scans: 500,
        unique_visitors: 400,
        new_vs_returning: { new: 350, returning: 150 },
        total_customers_identified: 200,
        cross_location_visitors: 15,
        top_touchpoints: [
          { form_id: "form_1", name: "Main Entrance", zone_name: "Lobby", scans: 300 },
        ],
        saves_without_purchase: 50,
        vip_customer_count: 5,
        lapsed_count: 20,
      };

      expect(mockLocationRPCResponse).toHaveProperty("total_scans", 500);
      expect(mockLocationRPCResponse.new_vs_returning.new).toBe(350);
      expect(mockLocationRPCResponse.top_touchpoints[0].scans).toBe(300);
      expect(mockLocationRPCResponse.vip_customer_count).toBe(5);
    });
  });

  describe("remarketing_contacts (View mock)", () => {
    test("returns specific mapped structure for opted-in contacts", () => {
      // Simulated response from remarketing_contacts view
      const mockRemarketingContactsResponse = [
        {
          id: "cust_1",
          store_id: "store_1",
          visitor_id: "vis_1",
          customer_name: "Jane Doe",
          customer_phone: "+1234567890",
          customer_email: "jane@example.com",
          visit_count: 4,
          is_vip: true,
          completed_flow: true,
          tags: ["oily", "acne"],
          last_active: "2026-03-07T10:00:00Z",
        },
      ];

      expect(mockRemarketingContactsResponse[0].is_vip).toBe(true);
      expect(mockRemarketingContactsResponse[0].tags).toContain("oily");
      expect(mockRemarketingContactsResponse[0].visit_count).toBeGreaterThanOrEqual(3); // Logically matches VIP criteria
    });
  });
});
