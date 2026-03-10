// Verification Script for Recommendation Logic
// Run with: npx tsx scripts/verify-recommendation-logic.ts

// --- Mock Data Types ---
type Tag = { id: string; name: string; is_hard_constraint: boolean };
type Product = {
  id: string;
  name: string;
  zone_id?: string;
  is_staff_pick?: boolean;
  tags: { id: string }[];
};
type FlowNode = {
  recommendationLogic?: {
    matchStrategy: string;
    zoneId?: string;
    limit?: number;
    fallbackToStaffPicks?: boolean;
  };
};

// --- Mock Data ---
const storeTags: Tag[] = [
  { id: "t1", name: "Red", is_hard_constraint: true },
  { id: "t2", name: "Blue", is_hard_constraint: true },
  { id: "t3", name: "Cotton", is_hard_constraint: false },
  { id: "t4", name: "Silk", is_hard_constraint: false },
];

const storeProducts: Product[] = [
  {
    id: "p1",
    name: "Red Cotton Shirt",
    tags: [{ id: "t1" }, { id: "t3" }],
    zone_id: "z1",
    is_staff_pick: false,
  },
  {
    id: "p2",
    name: "Blue Silk Tie",
    tags: [{ id: "t2" }, { id: "t4" }],
    zone_id: "z1",
    is_staff_pick: true,
  },
  {
    id: "p3",
    name: "Red Silk Scarf",
    tags: [{ id: "t1" }, { id: "t4" }],
    zone_id: "z2",
    is_staff_pick: true,
  },
  {
    id: "p4",
    name: "Blue Cotton Socks",
    tags: [{ id: "t2" }, { id: "t3" }],
    zone_id: "z2",
    is_staff_pick: false,
  },
  {
    id: "p5",
    name: "Staff Pick Special",
    tags: [],
    zone_id: "z1",
    is_staff_pick: true,
  }, // No tags
];

// --- Mock State ---
let mockAnswers: Record<string, any> = {};

// --- Logic to Test (Copied & Adapted) ---
const calculateCollectedTags = () => {
  // Mock implementation for testing
  const collected: string[] = [];
  if (mockAnswers["q1"] === "Red") collected.push("t1");
  if (mockAnswers["q1"] === "Blue") collected.push("t2");
  if (mockAnswers["q1"] === "Green") collected.push("t5");
  if (mockAnswers["q2"] === "Cotton") collected.push("t3");
  if (mockAnswers["q2"] === "Silk") collected.push("t4");
  return collected;
};

const getMatchingProducts = (node: FlowNode) => {
  if (!node.recommendationLogic)
    return { products: [], hardFilteredAll: false, zoneFilteredAll: false };

  const accumulatedTagIds = calculateCollectedTags();

  // Split tags
  const hardTags: string[] = [];
  const softTags: string[] = [];
  accumulatedTagIds.forEach((tagId) => {
    const tag = storeTags.find((t) => t.id === tagId);
    if (tag?.is_hard_constraint) hardTags.push(tagId);
    else softTags.push(tagId);
  });

  // Helper: Filter logic
  const filterProducts = (
    candidates: Product[],
    useHardTags = true,
    strategy = "any",
  ) => {
    let filtered = candidates;

    // A. Hard Constraints
    if (useHardTags && hardTags.length > 0) {
      filtered = candidates.filter((p) => {
        const pTags = p.tags.map((t) => t.id);
        return hardTags.every((ht) => pTags.includes(ht));
      });
    }

    // A.1. Match All Strategy
    if (strategy === "all" && softTags.length > 0) {
      filtered = filtered.filter((p) => {
        const pTags = p.tags.map((t) => t.id);
        return softTags.every((st) => pTags.includes(st));
      });
    }

    // B. Scoring
    if (
      filtered.length === 0 &&
      (hardTags.length > 0 || strategy === "all") &&
      useHardTags
    ) {
      return { matches: [], hardFiltered: true };
    }

    const scored = filtered.map((p) => {
      const pTags = p.tags.map((t) => t.id);
      let score = 0;
      softTags.forEach((st) => {
        if (pTags.includes(st)) score += 1;
      });
      return { product: p, score };
    });

    const matches = scored
      .filter((item) => item.score >= 0)
      .filter((item) => softTags.length === 0 || item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.product);

    return { matches, hardFiltered: false };
  };

  const limit = node.recommendationLogic.limit || 6;
  const strategy = node.recommendationLogic.matchStrategy || "any";
  const zoneId = node.recommendationLogic.zoneId;
  const fallbackToStaffPicks =
    node.recommendationLogic.fallbackToStaffPicks ?? true;

  // Execution
  if (strategy === "zone-first" && zoneId) {
    const zoneProducts = storeProducts.filter((p) => p.zone_id === zoneId);
    const level1 = filterProducts(zoneProducts, true, "any");
    let finalProducts = [...level1.matches];

    if (finalProducts.length < limit && !level1.hardFiltered) {
      const outputIds = new Set(finalProducts.map((p) => p.id));
      const otherProducts = storeProducts.filter(
        (p) => !outputIds.has(p.id) && p.zone_id !== zoneId,
      );
      const level2 = filterProducts(otherProducts, true, "any");
      finalProducts = [...finalProducts, ...level2.matches];
    }

    if (finalProducts.length < limit && fallbackToStaffPicks) {
      const outputIds = new Set(finalProducts.map((p) => p.id));
      const zoneStaffPicks = zoneProducts.filter(
        (p) => p.is_staff_pick && !outputIds.has(p.id),
      );
      finalProducts = [...finalProducts, ...zoneStaffPicks];

      if (finalProducts.length < limit) {
        const globalStaffPicks = storeProducts.filter(
          (p) =>
            p.is_staff_pick &&
            !outputIds.has(p.id) &&
            !zoneStaffPicks.includes(p),
        );
        finalProducts = [...finalProducts, ...globalStaffPicks];
      }
    }

    return {
      products: finalProducts.slice(0, limit),
      hardFilteredAll: level1.hardFiltered && finalProducts.length === 0,
      zoneFilteredAll:
        level1.matches.length === 0 && finalProducts.length === 0,
    };
  }

  // Standard Strategy
  const { matches, hardFiltered } = filterProducts(
    storeProducts,
    true,
    strategy,
  );
  let finalProducts = [...matches];

  if (finalProducts.length < limit && fallbackToStaffPicks) {
    const outputIds = new Set(finalProducts.map((p) => p.id));
    const staffPicks = storeProducts.filter(
      (p) => p.is_staff_pick && !outputIds.has(p.id),
    );
    finalProducts = [...finalProducts, ...staffPicks];
  }

  return {
    products: finalProducts.slice(0, limit),
    hardFilteredAll: hardFiltered && finalProducts.length === 0,
    zoneFilteredAll: false,
  };
};

// --- Test Runner ---
function runTests() {
  console.log("🚀 Starting Verification Tests (Round 2)\n");

  // Test 1: Match All Strategy (Red + Cotton) - STRICT (No Fallback)
  console.log("Test 1: 'Match All' Strategy (Red + Cotton) [Strict Mode]");
  mockAnswers = { q1: "Red", q2: "Cotton" }; // t1 (Hard), t3 (Soft)
  const node1: FlowNode = {
    recommendationLogic: {
      matchStrategy: "all",
      limit: 3,
      fallbackToStaffPicks: false,
    },
  };
  const res1 = getMatchingProducts(node1);
  console.log("Inputs: Red (Hard), Cotton (Soft)");
  console.log("Expected: 'Red Cotton Shirt' ONLY");
  console.log(
    "Actual:",
    res1.products.map((p) => p.name),
  );
  if (
    res1.products.length === 1 &&
    res1.products[0].name === "Red Cotton Shirt"
  )
    console.log("✅ PASSED");
  else console.log("❌ FAILED");
  console.log("\n");

  // Test 2: Zone First Strategy (Zone 1, Red)
  // ... (Same as before, it passed)
  console.log("Test 2: Zone First Strategy (Zone 1, Red)");
  mockAnswers = { q1: "Red" };
  const node2: FlowNode = {
    recommendationLogic: {
      matchStrategy: "zone-first",
      zoneId: "z1",
      limit: 2,
    },
  };
  const res2 = getMatchingProducts(node2);
  console.log(
    "Expected: 1. 'Red Cotton Shirt' (Zone 1), 2. 'Red Silk Scarf' (Zone 2, via fallback)",
  );
  console.log(
    "Actual:",
    res2.products.map((p) => p.name),
  );
  if (
    res2.products.length >= 2 &&
    res2.products[0].name === "Red Cotton Shirt" &&
    res2.products[1].name === "Red Silk Scarf"
  )
    console.log("✅ PASSED");
  else console.log("❌ FAILED");
  console.log("\n");

  // Test 3: Fallback to Staff Picks (Impossible Match)
  console.log("Test 3: Staff Pick Fallback [Impossible Hard Tag]");
  // Hard Tag: 'Green'. No products have Green.
  mockAnswers = { q1: "Green" };
  const node3: FlowNode = {
    recommendationLogic: {
      matchStrategy: "any",
      limit: 3,
      fallbackToStaffPicks: true,
    },
  };
  const res3 = getMatchingProducts(node3);
  console.log(
    "Expected: Staff Picks (p2, p3, p5) because Green matches nothing.",
  );
  console.log(
    "Actual:",
    res3.products.map((p) => p.name),
  );

  // Sort logic might affect order of staff picks?
  // They are appended in order found in storeProducts filter?
  // p2 is staff pick. p3 is staff pick. p5 is staff pick.
  const names = res3.products.map((p) => p.name);
  const expected = ["Blue Silk Tie", "Red Silk Scarf", "Staff Pick Special"];
  // We check if all expected are present.
  const allPresent = expected.every((n) => names.includes(n));

  if (
    res3.products.length === 3 &&
    allPresent &&
    !names.includes("Red Cotton Shirt")
  )
    console.log("✅ PASSED");
  else console.log("❌ FAILED");
}

runTests();
