import { FlowNode, Product } from "@/types/mirour";

// Replicating the logic from page.tsx for unit testing
// In a real app we would extract `getMatchingProducts` to a pure utility function.
const getMatchingProducts = (
  strategy: "any" | "all",
  limit: number,
  storeProducts: Product[],
  accumulatedTags: string[],
) => {
  const accumulatedTagIds = new Set(accumulatedTags);

  let matches = storeProducts.filter((product) => {
    const productTagIds = product.tags?.map((t: any) => t.id) || [];
    if (productTagIds.length === 0) return false;

    if (strategy === "any") {
      return productTagIds.some((id: string) => accumulatedTagIds.has(id));
    } else {
      // Strict match: "all"
      if (accumulatedTagIds.size === 0) return true;
      for (const userTag of accumulatedTags) {
        if (!productTagIds.includes(userTag)) return false;
      }
      return true;
    }
  });

  // Fallback Logic: If strict match returns 0, try "any"
  if (
    matches.length === 0 &&
    strategy === "all" &&
    accumulatedTagIds.size > 0
  ) {
    matches = storeProducts.filter((product) => {
      const productTagIds = product.tags?.map((t: any) => t.id) || [];
      return productTagIds.some((id: string) => accumulatedTagIds.has(id));
    });
  }

  return matches.slice(0, limit);
};

// MOCK DATA
const mockProduct = (id: string, tags: string[]) => ({
  id,
  owner_id: "test_owner",
  store_id: "store_1",
  name: `Product ${id}`,
  in_stock: true,
  created_at: "",
  updated_at: "",
  tags: tags.map((t) => ({
    id: t,
    store_id: "store_1",
    name: t,
    created_at: "",
  })),
});

describe("Recommendation Engine", () => {
  const products = [
    mockProduct("p1", ["calm"]),
    mockProduct("p2", ["energize"]),
    mockProduct("p3", ["calm", "focus"]),
    mockProduct("p4", ["sleep"]),
    mockProduct("p5", ["calm", "cbd"]),
    mockProduct("p6", ["thc"]),
    mockProduct("p7", ["cbd"]),
  ];

  test('"Match Any" returns products with at least one tag', () => {
    const result = getMatchingProducts("any", 6, products, ["calm"]);
    // Should match p1(calm), p3(calm,focus), p5(calm,cbd)
    expect(result.map((p) => p.id)).toEqual(
      expect.arrayContaining(["p1", "p3", "p5"]),
    );
    expect(result).toHaveLength(3);
  });

  test('"Match All" matches strict intersection', () => {
    const result = getMatchingProducts("all", 6, products, ["calm", "focus"]);
    // Should match only p3(calm,focus)
    // p1 has calm but not focus -> fail
    expect(result.map((p) => p.id)).toEqual(["p3"]);
  });

  test('"Match All" falls back to "Any" if 0 strict matches', () => {
    // User wants "sleep" AND "energize" (impossible combo in our dummy data)
    // p4 is sleep, p2 is energize. No product has both.
    // Fallback should trigger "Any" -> return both p2 and p4.

    const result = getMatchingProducts("all", 6, products, [
      "sleep",
      "energize",
    ]);

    expect(result.map((p) => p.id)).toEqual(
      expect.arrayContaining(["p2", "p4"]),
    );
    expect(result.length).toBeGreaterThan(0);
  });

  test("Capping limits results", () => {
    // Select 'calm' -> p1, p3, p5
    // Select 'cbd' -> p5, p7, p?(focus blend which has cbd)

    // Let's force a scenario with many matches.
    // Assume all products have 'all_tag'
    const manyProducts = Array.from({ length: 10 }, (_, i) =>
      mockProduct(`m${i}`, ["common"]),
    );

    const result = getMatchingProducts("any", 4, manyProducts, ["common"]);

    expect(result).toHaveLength(4);
  });
});
