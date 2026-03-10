import { createClient } from "@supabase/supabase-js";

// Mock Supabase client for unit testing logic
// In a real unit test we might just test the logic if we extracted it to a pure function.
// Since the logic is in a DB function, "unit" testing it actually requires a DB connection (Integration)
// OR we replicate the logic in JS to verify expected behavior.
//
// For this test suite, we will define expected inputs/outputs for the logic
// that is implemented in Postgres `merge_customer_traits`.

describe("merge_customer_traits logic", () => {
  // Helper to simulate the Postgres jsonb logic in JS for verification
  const simulateMerge = (currentTraits: any, newTraits: any) => {
    const merged = { ...currentTraits, ...newTraits };

    // Handle tags specially (union)
    const oldTags = currentTraits?.tags || [];
    const newTags = newTraits?.tags || [];
    const combinedTags = [...new Set([...oldTags, ...newTags])];

    merged.tags = combinedTags;
    return merged;
  };

  test("merges new tags with existing tags (Set Union)", () => {
    const current = { tags: ["calm"] };
    const incoming = { tags: ["energize"], last_visit: "2023-01-01" };

    const result = simulateMerge(current, incoming);

    expect(result.tags).toContain("calm");
    expect(result.tags).toContain("energize");
    expect(result.tags).toHaveLength(2);
    expect(result.last_visit).toBe("2023-01-01");
  });

  test("preserves existing tags if no new tags added", () => {
    const current = { tags: ["calm"] };
    const incoming = { last_visit: "2023-01-02" };

    const result = simulateMerge(current, incoming);

    expect(result.tags).toContain("calm");
    expect(result.tags).toHaveLength(1);
  });

  test("removes duplicates", () => {
    const current = { tags: ["calm", "focus"] };
    const incoming = { tags: ["calm", "sleep"] };

    const result = simulateMerge(current, incoming);

    expect(result.tags).toHaveLength(3); // calm, focus, sleep
    expect(result.tags).toContain("calm");
    expect(result.tags.filter((t: string) => t === "calm")).toHaveLength(1);
  });
});
