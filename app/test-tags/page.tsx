"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const TAGS_TO_ADD = [
  // GROUP 1: Occasion Tags (Soft)
  {
    name: "Social",
    category: "occasion",
    is_hard_constraint: false,
    description: "Products great for social settings and sharing",
  },
  {
    name: "Gift",
    category: "occasion",
    is_hard_constraint: false,
    description: "Products that make great gifts",
  },
  {
    name: "Casual",
    category: "occasion",
    is_hard_constraint: false,
    description: "Everyday drinks for no specific occasion",
  },
  {
    name: "Celebration",
    category: "occasion",
    is_hard_constraint: false,
    description: "Festive and celebratory drinks",
  },

  // GROUP 2: Mood Tags (Soft)
  {
    name: "Calm",
    category: "mood",
    is_hard_constraint: false,
    description: "Promotes relaxation and calmness",
  },
  {
    name: "Energize",
    category: "mood",
    is_hard_constraint: false,
    description: "Boosts energy and alertness",
  },
  {
    name: "Focus",
    category: "mood",
    is_hard_constraint: false,
    description: "Supports mental clarity and concentration",
  },
  {
    name: "Sleep",
    category: "mood",
    is_hard_constraint: false,
    description: "Promotes better sleep and rest",
  },
  {
    name: "Recovery",
    category: "mood",
    is_hard_constraint: false,
    description: "Post-workout or post-stress recovery",
  },

  // GROUP 3: Dietary Tags (Hard)
  {
    name: "No-sugar",
    category: "dietary",
    is_hard_constraint: true,
    description: "Zero sugar or sugar-free products",
  },
  {
    name: "Vegan",
    category: "dietary",
    is_hard_constraint: true,
    description: "100% plant-based, no animal products",
  },
  {
    name: "Gluten-free",
    category: "dietary",
    is_hard_constraint: true,
    description: "Contains no gluten",
  },
  {
    name: "Organic",
    category: "dietary",
    is_hard_constraint: true,
    description: "Certified organic ingredients",
  },

  // GROUP 4: Avoiding Tags (Hard)
  {
    name: "THC-free",
    category: "avoiding",
    is_hard_constraint: true,
    description: "Contains absolutely no THC",
  },
  {
    name: "Caffeine-free",
    category: "avoiding",
    is_hard_constraint: true,
    description: "Zero caffeine content",
  },
  {
    name: "No-effect",
    category: "avoiding",
    is_hard_constraint: true,
    description: "No psychoactive or adaptogenic effects",
  },

  // GROUP 5: Ingredient Tags (For Education Flows)
  {
    name: "CBD",
    category: "ingredient",
    is_hard_constraint: false,
    description: "Contains CBD (cannabidiol)",
  },
  {
    name: "Adaptogen",
    category: "ingredient",
    is_hard_constraint: false,
    description: "Contains adaptogenic herbs (ashwagandha, reishi, etc.)",
  },
  {
    name: "Nootropic",
    category: "ingredient",
    is_hard_constraint: false,
    description: "Contains nootropic compounds for brain function",
  },
  {
    name: "Botanical",
    category: "ingredient",
    is_hard_constraint: false,
    description: "Made with herbal and botanical ingredients",
  },
  {
    name: "Probiotic",
    category: "ingredient",
    is_hard_constraint: false,
    description: "Contains live probiotic cultures",
  },
];

export default function TestTagsPage() {
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStore() {
      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatusMessage("You must be logged in to create tags.");
        return;
      }

      // Find the user's first store to use for tags
      const { data: stores, error } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1);

      if (error || !stores || stores.length === 0) {
        setStatusMessage("Could not find a store for the current user.");
        return;
      }

      setStoreId(stores[0].id);
    }
    fetchStore();
  }, []);

  const handleInsertTags = async () => {
    if (!storeId) {
      setStatusMessage("Wait for store initialization or login.");
      return;
    }

    setLoading(true);
    setStatusMessage("Inserting tags...");

    const tagsToInsert = TAGS_TO_ADD.map((tag) => ({
      ...tag,
      store_id: storeId,
    }));

    const { data, error } = await supabase
      .from("tags")
      .insert(tagsToInsert)
      .select();

    if (error) {
      setStatusMessage(`Error inserting tags: ${error.message}`);
    } else {
      setStatusMessage(`Successfully inserted ${data.length} tags!`);
    }

    setLoading(false);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Add Test Tags</h1>
      <p className="text-muted-foreground">
        This page will insert the 21 predefined tags (Occasion, Mood, Dietary,
        Avoiding, Ingredient) into your database.
      </p>

      {statusMessage && (
        <div className="bg-muted p-4 rounded-md">{statusMessage}</div>
      )}

      <Button onClick={handleInsertTags} disabled={loading || !storeId}>
        {loading ? "Adding..." : "Add 21 Tags"}
      </Button>
    </div>
  );
}
