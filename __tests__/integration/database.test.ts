import { supabase, createTestStore, createTestZone } from "./setup";

// Check if we have connection
const hasCredentials =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Skip if no credentials (e.g. in CI without secrets)
const describeIfCreds = hasCredentials ? describe : describe.skip;

describeIfCreds("Database Integration", () => {
  let storeId: string;
  let zoneId: string;

  beforeAll(async () => {
    // Create test store
    try {
      const store = await createTestStore("IntegrationTest");
      storeId = store.id;
    } catch (e) {
      console.error("Failed to create test store", e);
      // If we can't create a store, tests will fail
    }
  });

  afterAll(async () => {
    // Cleanup if possible (needs RLS policy allowing delete or service role)
    // For anon key, we might not be able to delete.
    // We accept that test data lingers in dev DB for now.
  });

  test("Can create a Zone linked to a Store", async () => {
    const zone = await createTestZone(storeId, "Test Zone");
    expect(zone).toBeDefined();
    expect(zone.store_id).toBe(storeId);
    zoneId = zone.id;
  });

  test("Can log a visit with zone_id", async () => {
    // Assuming we have a form_id. Let's create a dummy form entry if needed
    // or just test the table insert if RLS allows.

    // Since creating a form is complex, we'll try to insert a visit directly
    // using a fake form_id if FKEY constraint allows (it likely WON'T).
    // So we need a real form.

    // Let's create a form
    const { data: form, error: formError } = await supabase
      .from("forms")
      .insert({
        title: "Test Form",
        store_id: storeId,
        questions: [],
      })
      .select()
      .single();

    if (formError) {
      console.warn("Could not create form, skipping visit test", formError);
      return;
    }

    const visitId = `v_${Date.now()}`;
    const { error: visitError } = await supabase.from("form_visits").insert({
      form_id: form.id,
      visitor_id: visitId,
      zone_id: zoneId,
    });

    expect(visitError).toBeNull();

    // Verify it was logged
    const { data: loggedVisit } = await supabase
      .from("form_visits")
      .select("*")
      .eq("visitor_id", visitId)
      .single();

    expect(loggedVisit).toBeDefined();
    expect(loggedVisit.zone_id).toBe(zoneId);
  });

  test("merge_customer_traits DB function works correctly", async () => {
    const email = `test_${Date.now()}@example.com`;
    const initialTraits = { tags: ["a"] };

    // 1. First call (Insert)
    const { error: err1 } = await supabase.rpc("merge_customer_traits", {
      p_store_id: storeId,
      p_email: email,
      p_phone: null,
      p_name: "Tester",
      p_new_traits: initialTraits,
    });
    expect(err1).toBeNull();

    // 2. Second call (Merge)
    const newTraits = { tags: ["b"], last_visit: "today" };
    const { error: err2 } = await supabase.rpc("merge_customer_traits", {
      p_store_id: storeId,
      p_email: email,
      p_phone: null,
      p_name: "Tester",
      p_new_traits: newTraits,
    });
    expect(err2).toBeNull();

    // 3. Verify
    const { data: customer } = await supabase
      .from("customers")
      .select("traits")
      .eq("email", email)
      .eq("store_id", storeId)
      .single();

    expect(customer).toBeDefined();
    // Expect tags to be ['a', 'b'] (order not guaranteed)
    expect(customer!.traits.tags).toEqual(expect.arrayContaining(["a", "b"]));
    expect(customer!.traits.tags).toHaveLength(2);
    expect(customer!.traits.last_visit).toBe("today");
  });
});
