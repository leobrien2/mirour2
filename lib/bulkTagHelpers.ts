import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Standard tags required for Soberish entrance flow template
 */
export const STANDARD_SOBERISH_TAGS = [
  // Soft preferences
  { name: "Social", category: "occasion", is_hard_constraint: false },
  { name: "Calm", category: "mood", is_hard_constraint: false },
  { name: "Energize", category: "mood", is_hard_constraint: false },
  { name: "Focus", category: "mood", is_hard_constraint: false },
  { name: "Sleep", category: "mood", is_hard_constraint: false },
  { name: "Gift", category: "occasion", is_hard_constraint: false },
  { name: "Casual", category: "occasion", is_hard_constraint: false },

  // Hard constraints
  { name: "No-sugar", category: "dietary", is_hard_constraint: true },
  { name: "Vegan", category: "dietary", is_hard_constraint: true },
  { name: "Gluten-free", category: "dietary", is_hard_constraint: true },
  { name: "Organic", category: "dietary", is_hard_constraint: true },
  { name: "THC-free", category: "avoiding", is_hard_constraint: true },
  { name: "Caffeine-free", category: "avoiding", is_hard_constraint: true },
  { name: "No-effect", category: "avoiding", is_hard_constraint: true },
];

export interface BulkTagResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Creates all standard Soberish tags in one operation
 * Skips tags that already exist (duplicate key errors)
 *
 * @param supabase - Supabase client instance
 * @param storeId - Store ID to create tags for
 * @returns Result object with counts of created, skipped, and errors
 */
export async function createStandardSoberishTags(
  supabase: SupabaseClient,
  storeId: string,
): Promise<BulkTagResult> {
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const tag of STANDARD_SOBERISH_TAGS) {
    try {
      const { error } = await supabase.from("tags").insert({
        store_id: storeId,
        name: tag.name,
        category: tag.category,
        is_hard_constraint: tag.is_hard_constraint,
      });

      if (error) {
        if (error.code === "23505") {
          // Duplicate key - tag already exists
          skipped++;
        } else {
          errors.push(`${tag.name}: ${error.message}`);
        }
      } else {
        created++;
      }
    } catch (err) {
      errors.push(`${tag.name}: ${err}`);
    }
  }

  return { created, skipped, errors };
}
