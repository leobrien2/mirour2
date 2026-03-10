// @ts-nocheck
"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Database } from "lucide-react";

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs((prev) => [...prev, msg]);
  };

  const runSeed = async () => {
    setLoading(true);
    setLogs([]);
    addLog("🚀 Starting database seed...");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to seed data.");
      }

      // 1. GET OR CREATE STORE
      addLog("Checking for existing store...");
      let { data: stores } = await supabase
        .from("stores" as any)
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      let storeId: string;

      if (!stores || stores.length === 0) {
        addLog("No store found. Creating 'Soberish Demo Store'...");
        const { data: newStore, error: storeErr } = await supabase
          .from("stores" as any)
          .insert({ name: "Soberish Demo Store", owner_id: user.id })
          .select("id")
          .single();

        if (storeErr) throw storeErr;
        storeId = newStore.id;
        addLog(`✅ Created Store: ${storeId}`);
      } else {
        storeId = stores[0].id;
        addLog(`✅ Using existing Store: ${storeId}`);
      }

      // 2. HELPER FUNCTIONS
      const getOrCreateZone = async (
        name: string,
        description: string,
        zone_what: string,
        zone_when: string,
        zone_who: string,
      ) => {
        let { data: existing } = await supabase
          .from("zones" as any)
          .select("id")
          .eq("store_id", storeId)
          .eq("name", name)
          .maybeSingle();

        if (existing) {
          addLog(`Zone exists: ${name}`);
          return existing.id;
        }

        const { data: newZone, error } = await supabase
          .from("zones" as any)
          .insert({
            store_id: storeId,
            name,
            description,
            zone_what,
            zone_when,
            zone_who,
          })
          .select("id")
          .single();

        if (error) throw error;
        addLog(`✅ Created Zone: ${name}`);
        return newZone.id;
      };

      const getOrCreateTag = async (
        name: string,
        category: string,
        is_hard_constraint: boolean,
      ) => {
        let { data: existing } = await supabase
          .from("tags" as any)
          .select("id")
          .eq("store_id", storeId)
          .eq("name", name)
          .maybeSingle();

        if (existing) return existing.id;

        const { data: newTag, error } = await supabase
          .from("tags" as any)
          .insert({ store_id: storeId, name, category, is_hard_constraint })
          .select("id")
          .single();

        if (error) throw error;
        return newTag.id;
      };

      // 3. ZONES
      addLog("Seeding Zones...");
      const calmZoneId = await getOrCreateZone(
        "Calm & Relax",
        "Products for relaxation and stress relief",
        "Hemp-infused drinks, herbal teas, and adaptogens for relaxation",
        "After work, bedtime, or whenever you need to unwind",
        "Anyone seeking calm, stress relief, or better sleep",
      );

      const energyZoneId = await getOrCreateZone(
        "Energy & Focus",
        "Energizing drinks without the crash",
        "Prebiotic sodas, hoppy teas, and functional beverages for energy",
        "Morning boost, afternoon pick-me-up, or pre-workout",
        "Anyone seeking natural energy and mental clarity",
      );

      const socialZoneId = await getOrCreateZone(
        "Social Sippers",
        "Non-alcoholic drinks for social occasions",
        "NA beers, mocktails, and sophisticated alcohol alternatives",
        "Parties, dinners, celebrations, or any social gathering",
        "Social drinkers choosing healthier alternatives",
      );

      // 4. TAGS
      addLog("Seeding Tags...");
      const tags: Record<string, string> = {};
      tags["Social"] = await getOrCreateTag("Social", "occasion", false);
      tags["Calm"] = await getOrCreateTag("Calm", "mood", false);
      tags["Energize"] = await getOrCreateTag("Energize", "mood", false);
      tags["Focus"] = await getOrCreateTag("Focus", "mood", false);
      tags["Sleep"] = await getOrCreateTag("Sleep", "mood", false);
      tags["No-sugar"] = await getOrCreateTag("No-sugar", "dietary", true);
      tags["Vegan"] = await getOrCreateTag("Vegan", "dietary", true);
      tags["Gluten-free"] = await getOrCreateTag(
        "Gluten-free",
        "dietary",
        true,
      );
      tags["Organic"] = await getOrCreateTag("Organic", "dietary", true);
      tags["THC-free"] = await getOrCreateTag("THC-free", "avoiding", true);
      tags["Caffeine-free"] = await getOrCreateTag(
        "Caffeine-free",
        "avoiding",
        true,
      );

      // 5. PRODUCTS
      addLog("Seeding Products...");

      const createProduct = async (
        zoneId: string,
        name: string,
        sku: string,
        description: string,
        price: number,
        image_url: string,
        is_staff_pick: boolean,
        tagNames: string[],
      ) => {
        let { data: existing } = await supabase
          .from("products" as any)
          .select("id")
          .eq("store_id", storeId)
          .eq("sku", sku)
          .maybeSingle();

        let productId: string;

        if (existing) {
          productId = existing.id;
          addLog(`Product exists: ${name}`);
        } else {
          const { data: newProd, error } = await supabase
            .from("products" as any)
            .insert({
              store_id: storeId,
              owner_id: user.id,
              zone_id: zoneId,
              name,
              sku,
              description,
              price,
              image_url,
              in_stock: true,
              is_staff_pick,
            })
            .select("id")
            .single();

          if (error) throw error;
          productId = newProd.id;
          addLog(`✅ Created Product: ${name}`);

          // Link to store_products table for global inventory
          const { error: spError } = await supabase
            .from("store_products" as any)
            .insert({
              store_id: storeId,
              product_id: productId,
            });
          if (spError) {
             // Silence duplicate link errors if they somehow occur
          }
        }

        // Link tags
        for (const tagName of tagNames) {
          const tagId = tags[tagName];
          if (!tagId) continue;

          // Ignore constraint errors (already linked)
          const { error: linkErr } = await supabase
            .from("product_tags" as any)
            .insert({
              product_id: productId,
              tag_id: tagId,
            });

          if (linkErr) {
            // Silence duplicate link errors
          }
        }
      };

      await createProduct(
        calmZoneId,
        "Recess Mood",
        "RECESS-MOOD-12OZ",
        "Hemp-infused sparkling water with adaptogens. Calming, not sedating.",
        5.99,
        "https://m.media-amazon.com/images/S/aplus-media-library-service-media/3f758730-e76e-4103-ba17-f471e7ce9c4f.__CR0,0,1200,900_PT0_SX600_V1___.jpg",
        true,
        ["Calm", "No-sugar", "Vegan", "Gluten-free"],
      );

      await createProduct(
        calmZoneId,
        "Kin Spritz",
        "KIN-SPRITZ-8OZ",
        "Euphorics with adaptogens, nootropics, and botanicals. Stress relief.",
        39.0,
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpUsaex31S9226oTGdQOSqSZg7xCpcYe71Iw&s",
        false,
        ["Calm", "Vegan", "Gluten-free"],
      );

      await createProduct(
        calmZoneId,
        "Soberish Calm Herbal Tea",
        "CALM-TEA-20CT",
        "Chamomile, lavender, and passionflower. Perfect for bedtime.",
        12.99,
        "https://us.foursigmatic.com/cdn/shop/files/ThinkTeaLifestyleIced-1_Square_copy.webp?crop=center&height=700&v=1716227065&width=700",
        false,
        ["Calm", "Sleep", "Vegan", "Organic", "THC-free", "Caffeine-free"],
      );

      await createProduct(
        energyZoneId,
        "Poppi Orange Prebiotic Soda",
        "POPPI-ORANGE-12OZ",
        "Apple cider vinegar soda with prebiotics. Refreshing, gut-friendly.",
        3.49,
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRF4UdYagWOQpuVlZj8EW-YwK5wOSHz54Mq2g&s",
        true,
        ["Energize", "No-sugar", "Vegan", "Gluten-free", "THC-free"],
      );

      await createProduct(
        energyZoneId,
        "Olipop Vintage Cola",
        "OLIPOP-COLA-12OZ",
        "Prebiotic soda with 9g fiber. Tastes like nostalgia, feels like wellness.",
        3.99,
        "https://marvel-b1-cdn.bc0a.com/f00000000205501/www.fruitfulyield.com/media/catalog/product/cache/b69948113e5023d37b0ec38a936ce2ea/8/6/860439001005-main.png",
        false,
        ["Energize", "Vegan", "Gluten-free", "THC-free", "Caffeine-free"],
      );

      await createProduct(
        energyZoneId,
        "HopLark The Really Hoppy One",
        "HOPLARK-HOPPY-12OZ",
        "Sparkling HopTea. Energizing, refreshing, zero sugar.",
        4.49,
        "https://m.media-amazon.com/images/S/assets.wholefoodsmarket.com/PIE/product/62eb2a7379c0186618a19ea8_0854948008037-glamor-front-2022-07-12t14-22-20-iphone-x-quality-90-1-29-0-user-5d7652c1db2c4b51d4c666ca-vx1o-447998._TTD_._SR600,600_._QL100_.jpg",
        false,
        ["Energize", "Focus", "No-sugar", "Vegan", "THC-free"],
      );

      await createProduct(
        socialZoneId,
        "Partake Blonde Ale",
        "PARTAKE-BLONDE-6PK",
        "Light, crisp, refreshing. Only 10 calories, zero sugar.",
        9.49,
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2townp2CCdcOEZ3ndMnoPNTfile79iTDbxA&s",
        false,
        ["Social", "No-sugar", "Gluten-free", "THC-free", "Caffeine-free"],
      );

      // 6. CREATE DEMO FLOW
      addLog("Seeding 'Store Assistant Demo' Flow...");

      let { data: existingForm } = await supabase
        .from("forms" as any)
        .select("id")
        .eq("store_id", storeId)
        .eq("name", "Store Assistant Demo")
        .maybeSingle();

      if (!existingForm) {
        const flowNodes = [
          {
            id: "node-welcome",
            type: "welcome",
            header: "Welcome to Soberish!",
            content: "Let's find the perfect drink for you today.",
            buttonText: "Get Started",
            nextNodeId: "node-q1",
          },
          {
            id: "node-q1",
            type: "question",
            questionType: "multiple-choice",
            label: "What brings you in today?",
            options: ["I need to relax", "I need a boost", "Going to a party"],
            conditionalNext: [
              {
                optionValue: "I need to relax",
                nextNodeId: "node-q2",
                addTags: [tags["Calm"], tags["Sleep"]],
              },
              {
                optionValue: "I need a boost",
                nextNodeId: "node-q2",
                addTags: [tags["Energize"], tags["Focus"]],
              },
              {
                optionValue: "Going to a party",
                nextNodeId: "node-q2",
                addTags: [tags["Social"]],
              },
            ],
            hasConditionalLogic: true,
          },
          {
            id: "node-q2",
            type: "question",
            questionType: "multiple-choice",
            label: "Any dietary preferences?",
            options: ["Vegan", "No Sugar", "Gluten Free", "Organic", "None"],
            conditionalNext: [
              {
                optionValue: "Vegan",
                nextNodeId: "node-q3",
                addTags: [tags["Vegan"]],
              },
              {
                optionValue: "No Sugar",
                nextNodeId: "node-q3",
                addTags: [tags["No-sugar"]],
              },
              {
                optionValue: "Gluten Free",
                nextNodeId: "node-q3",
                addTags: [tags["Gluten-free"]],
              },
              {
                optionValue: "Organic",
                nextNodeId: "node-q3",
                addTags: [tags["Organic"]],
              },
              { optionValue: "None", nextNodeId: "node-q3", addTags: [] },
            ],
            hasConditionalLogic: true,
          },
          {
            id: "node-q3",
            type: "question",
            questionType: "multiple-choice",
            label: "Anything you want to avoid?",
            options: ["No THC", "No Caffeine", "None"],
            conditionalNext: [
              {
                optionValue: "No THC",
                nextNodeId: "node-email",
                addTags: [tags["THC-free"]],
              },
              {
                optionValue: "No Caffeine",
                nextNodeId: "node-email",
                addTags: [tags["Caffeine-free"]],
              },
              { optionValue: "None", nextNodeId: "node-email", addTags: [] },
            ],
            hasConditionalLogic: true,
          },
          {
            id: "node-email",
            type: "customer-info",
            header: "Unlock 10% Off",
            content:
              "Enter your details to see your recommendations and get a 10% discount code!",
            captureFields: { name: true, email: true, phone: true },
            contactRequired: true,
            nextNodeId: "node-rec",
          },
          {
            id: "node-rec",
            type: "recommendation",
            recommendationLogic: {
              useTags: true,
              matchStrategy: "any",
              limit: 3,
              fallbackToStaffPicks: true,
            },
            nextNodeId: "node-complete",
          },
          {
            id: "node-complete",
            type: "complete",
            header: "Done!",
            content:
              "Check out your matching products with the staff. Use your code at checkout.",
            hasPerk: true,
            perk: "10% Off Purchase",
            perkCode: "SOBERISH10",
          },
        ];

        const { error: formErr } = await supabase.from("forms" as any).insert({
          store_id: storeId,
          owner_id: user.id,
          name: "Store Assistant Demo",
          flow_type: "standard",
          questions: flowNodes,
          perk: "10% Off Purchase",
          active: true,
          capture_name: true,
          capture_email: true,
          capture_phone: true,
        });

        if (formErr) {
          throw new Error(`Flow Error: ${formErr.message}`);
        }
        addLog("✅ Created standard flow: Store Assistant Demo");
      } else {
        addLog("Flow exists: Store Assistant Demo");
      }

      addLog("🎉 Seed completed successfully!");
      toast({
        title: "Success!",
        description: "Data added. Check your dashboard.",
      });
    } catch (error: any) {
      console.error(error);
      addLog(`❌ ERROR: ${error.message}`);
      toast({
        title: "Seed Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-card rounded-2xl border p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Seed Database</h1>
              <p className="text-muted-foreground text-sm">
                Populate your store with demo zones, tags, and product catalog
                data.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-4">
            <Button
              onClick={runSeed}
              disabled={loading}
              className="w-full sm:w-auto gap-2"
              size="lg"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              {loading ? "Seeding Data..." : "Run Seed Script"}
            </Button>
          </div>
        </div>

        {logs.length > 0 && (
          <div className="bg-black text-green-400 p-6 rounded-xl font-mono text-xs overflow-x-auto shadow-sm">
            <h3 className="text-white mb-4 font-semibold uppercase tracking-wider text-[10px]">
              Execution Logs
            </h3>
            <div className="space-y-1.5 opacity-90">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
