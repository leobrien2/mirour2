"use client";

import { useState } from "react";
import { useStores } from "@/hooks/useStores";
import { useForms } from "@/hooks/useForms";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2, Play, CheckCircle, XCircle, Zap } from "lucide-react";

export default function TestRunnerPage() {
  return (
    <ProtectedRoute>
      <TestRunnerContent />
    </ProtectedRoute>
  );
}

function TestRunnerContent() {
  const {
    createStore,
    createProduct,
    createTag,
    createZone,
    linkTagToProduct,
  } = useStores();
  const { createForm } = useForms();
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (msg: string) =>
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runScenario1 = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog("🚀 Starting Scenario 1: Soberish Demo Setup...");

    try {
      // 1. Create Store
      const storeName = `Soberish Demo ${new Date().getTime()}`;
      addLog(`Creating Store: "${storeName}"...`);
      const { data: store, error: storeError } = await createStore(
        storeName,
        "Test Runner Location",
      );

      if (storeError || !store)
        throw new Error(storeError || "Failed to create store");
      addLog(`✅ Store Created! ID: ${store.id}`);

      // 2. Create Zones
      addLog("Creating Zones...");
      await createZone(store.id, "Entrance", "Main entry point");
      await createZone(store.id, "Chill Zone", "Relaxation area");
      addLog("✅ Zones Created.");

      // 3. Define Products & Tags
      const productsToCreate = [
        {
          name: "Calm Elixir",
          desc: "Relax your mind.",
          tags: ["calm", "cbd"],
        },
        {
          name: "Energy Tonic",
          desc: "Boost your day.",
          tags: ["energize", "caffeine"],
        },
        {
          name: "Focus Blend",
          desc: "Stay sharp.",
          tags: ["focus", "cbd"],
        },
      ];

      // 4. Create Tags first (to avoid duplicates per product if shared)
      addLog("Creating Tags...");
      const tagMap = new Map<string, string>(); // name -> id
      const uniqueTags = Array.from(
        new Set(productsToCreate.flatMap((p) => p.tags)),
      );

      for (const tagName of uniqueTags) {
        const { data: tag, error: tagError } = await createTag(
          store.id,
          tagName,
          "General",
        );
        if (tagError) addLog(`⚠️ Warning creating tag ${tagName}: ${tagError}`);
        if (tag) tagMap.set(tagName, tag.id);
      }
      addLog(`✅ ${tagMap.size} Tags Processed.`);

      // 5. Create Products & Link
      addLog("Creating Products & Linking Tags...");
      for (const p of productsToCreate) {
        const { data: prod, error: prodError } = await createProduct(store.id, {
          name: p.name,
          description: p.desc,
          in_stock: true,
        });

        if (prodError || !prod) {
          addLog(`❌ Failed to create product ${p.name}: ${prodError}`);
          continue;
        }

        addLog(`  - Created Product: ${p.name}`);

        // Link Tags
        for (const tName of p.tags) {
          const tagId = tagMap.get(tName);
          if (tagId) {
            const { error: linkError } = await linkTagToProduct(prod.id, tagId);
            if (linkError)
              addLog(`    ⚠️ Failed to link tag ${tName}: ${linkError}`);
            else addLog(`    + Linked Tag: ${tName}`);
          }
        }
      }

      addLog("🎉 Scenario 1 Complete!");
    } catch (e: any) {
      addLog(`❌ CRITICAL ERROR: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runScenario2 = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog("🚀 Starting Scenario 2: Full Integration (Store + P1 Flow)...");

    try {
      // Reuse logic from Scenario 1 for store/products
      // 1. Create Store
      const storeName = `Soberish Full ${new Date().getTime()}`;
      addLog(`Creating Store: "${storeName}"...`);
      const { data: store, error: storeError } = await createStore(
        storeName,
        "Test Runner Location",
      );
      if (storeError || !store)
        throw new Error(storeError || "Failed to create store");
      addLog(`✅ Store Created! ID: ${store.id}`);

      // 2. Create Zones
      await createZone(store.id, "Entrance", "Main entry point");
      addLog("✅ Zone (Entrance) Created.");

      // 3. Define Products & Tags
      const productsToCreate = [
        { name: "Calm Elixir", desc: "Relax.", tags: ["calm"] },
        { name: "Energy Tonic", desc: "Boost.", tags: ["energize"] },
      ];

      // 4. Create Tags
      addLog("Creating Tags...");
      const tagMap = new Map<string, string>();
      const uniqueTags = ["calm", "energize"];

      for (const tagName of uniqueTags) {
        const { data: tag } = await createTag(store.id, tagName, "General");
        if (tag) tagMap.set(tagName, tag.id);
      }
      addLog(`✅ Tags Created.`);

      // 5. Create Products & Link
      for (const p of productsToCreate) {
        const { data: prod } = await createProduct(store.id, {
          name: p.name,
          in_stock: true,
        });
        if (prod) {
          for (const tName of p.tags) {
            const tagId = tagMap.get(tName);
            if (tagId) await linkTagToProduct(prod.id, tagId);
          }
        }
      }
      addLog(`✅ Products Created & Linked.`);

      // 6. Create Flow
      addLog("Creating Flow 'Soberish Guided'...");

      const welcomeNodeId =
        "node-" + Math.random().toString(36).substring(2, 9);
      const quizNodeId = "node-" + Math.random().toString(36).substring(2, 9);
      const recNodeId = "node-" + Math.random().toString(36).substring(2, 9);
      const completeNodeId =
        "node-" + Math.random().toString(36).substring(2, 9);

      // Map tags to quiz answers
      const calmTagId = tagMap.get("calm");
      const energizeTagId = tagMap.get("energize");

      const questions = [
        {
          id: welcomeNodeId,
          type: "welcome",
          header: "Welcome to Soberish",
          content: "Find your perfect vibe.",
          buttonText: "Start Quiz",
          nextNodeId: quizNodeId,
        },
        {
          id: quizNodeId,
          type: "question",
          questionType: "multiple-choice",
          label: "How do you want to feel?",
          options: ["Relaxed", "Energized"],
          required: true,
          nextNodeId: recNodeId,
          conditionalNext: [
            {
              optionValue: "Relaxed",
              nextNodeId: recNodeId,
              addTags: calmTagId ? [calmTagId] : [],
            },
            {
              optionValue: "Energized",
              nextNodeId: recNodeId,
              addTags: energizeTagId ? [energizeTagId] : [],
            },
          ],
        },
        {
          id: recNodeId,
          type: "recommendation",
          header: "We recommend:",
          recommendationLogic: {
            useTags: true,
            matchStrategy: "any",
            limit: 3,
          },
          buttonText: "Finish",
          nextNodeId: completeNodeId,
        },
        {
          id: completeNodeId,
          type: "complete",
          header: "Enjoy!",
          content: "Ask a staff member for your selection.",
        },
      ];

      const { data: flow, error: flowError } = await createForm({
        name: "Entrance Recommendation Flow",
        store_id: store.id,
        questions: questions as any,
        perk: "",
        capture_name: false,
        capture_email: false,
        capture_phone: false,
      });

      if (flowError) throw new Error(flowError.message);
      addLog(`✅ Flow Created! ID: ${flow?.id}`);
      addLog("🎉 Scenario 2 Complete!");
    } catch (e: any) {
      addLog(`❌ CRITICAL ERROR: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-heading">Test Runner</h1>
          <p className="text-muted-foreground">
            Automated scenario execution and data seeding.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Scenario Card */}
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-2">
              Scenario 1: Soberish Standard
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Creates a demo store with 3 products (Calm, Energy, Focus) and
              links appropriate tags.
            </p>
            <div className="space-y-2 text-xs bg-muted p-2 rounded mb-4 font-mono">
              <div>Store: "Soberish Demo [Time]"</div>
              <div>Products: Calm Elixir, Energy Tonic...</div>
              <div>Tags: calm, cbd, energize...</div>
            </div>
            <button
              onClick={runScenario1}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isRunning ? "Running..." : "Run Scenario"}
            </button>
          </div>

          {/* Scenario 2 Card */}
          <div className="bg-card border rounded-xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap className="w-24 h-24 text-blue-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              Scenario 2: Complete Flow
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Full setup: Store + Products + <strong>Interactive Flow</strong>.
              Creates a "How do you feel?" quiz that recommends products based
              on your answer.
            </p>
            <div className="space-y-1 text-xs bg-muted p-2 rounded mb-4 font-mono">
              <div>Flow: "Entrance Recs"</div>
              <div>Logic: "Relaxed" &rarr; Calm Elixir</div>
              <div>Logic: "Energized" &rarr; Energy Tonic</div>
            </div>
            <button
              onClick={runScenario2}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isRunning ? "Running..." : "Run Complete Scenario"}
            </button>
          </div>
        </div>

        {/* Console Output */}
        <div className="bg-black/90 text-green-400 font-mono text-sm p-4 rounded-xl shadow-inner min-h-[300px] overflow-y-auto border border-green-900/30">
          <div className="flex items-center justify-between mb-2 border-b border-green-900/50 pb-2">
            <span className="font-bold">Console Output</span>
            <button
              onClick={() => setLogs([])}
              className="text-xs hover:text-green-200"
            >
              Clear
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="text-green-400/30 italic">
              Ready to run tests...
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1 break-all">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
