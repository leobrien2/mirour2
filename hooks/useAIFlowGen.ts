// hooks/useAIFlowGen.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { CanvasFlow } from "@/types/canvas";
import { supabase } from "@/integrations/supabase/client";

export type AIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  generatedFlow?: CanvasFlow;
  tagsSummary?: string;
};

export type AIGenState = "idle" | "loading" | "error";

interface UseAIFlowGenOptions {
  storeId?: string;
}

export function useAIFlowGen({ storeId }: UseAIFlowGenOptions = {}) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [state, setState] = useState<AIGenState>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || state === "loading") return;

      const userMsg: AIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userText.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setState("loading");
      setError(null);

      abortRef.current = new AbortController();

      // Build compact message history (avoid sending full JSON back)
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content:
          m.role === "assistant" && m.generatedFlow
            ? `[Previously generated flow: "${m.generatedFlow.name}" with ${m.generatedFlow.steps.length} steps]`
            : m.content,
      }));

      const { data: user } = await supabase.auth.getUser();

      console.log("user", user);
      const owner_id = user?.user?.id;

      try {
        const res = await fetch("/api/ai/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, storeId, owner_id }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error ?? `HTTP ${res.status}`);
        }

        const data = await res.json();

        const isFlow = data.type === "flow";
        const flow = isFlow ? (data.data as CanvasFlow) : undefined;

        const outcomeSteps = flow
          ? flow.steps.filter((s) => {
              const hasSelect = s.blocks?.some(
                (b: any) => b.data?.type === "select",
              );
              const hasContact = s.blocks?.some(
                (b: any) => b.data?.type === "contact",
              );
              return !s.nextStepId && !hasSelect && !hasContact;
            }).length
          : 0;

        const assistantMsg: AIMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: isFlow
            ? `I've built **${flow!.name}** — ${flow!.steps.length} steps${outcomeSteps > 0 ? `, ${outcomeSteps} outcome${outcomeSteps !== 1 ? "s" : ""}` : ""}. Review the preview below, then click **Apply to Canvas**.`
            : data.content,
          generatedFlow: flow,
          tagsSummary: data.tagsSummary,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setState("idle");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message ?? "Something went wrong");
        setState("error");
      }
    },
    [messages, state, storeId],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setState("idle");
    setError(null);
  }, []);

  const lastGeneratedFlow =
    messages.filter((m) => m.generatedFlow).at(-1)?.generatedFlow ?? null;

  return { messages, state, error, sendMessage, reset, lastGeneratedFlow };
}
