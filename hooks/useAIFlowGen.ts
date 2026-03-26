// hooks/useAIFlowGen.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { CanvasFlow } from "@/types/canvas";

export type AIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  generatedFlow?: CanvasFlow; // set when AI returns a flow
};

export type AIGenState = "idle" | "loading" | "error";

export function useAIFlowGen() {
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

      // Build message history in OpenAI/Mistral format
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content:
          m.role === "assistant" && m.generatedFlow
            ? `[Generated flow: ${m.generatedFlow.name}]` // Compact for context
            : m.content,
      }));

      try {
        const res = await fetch("/api/ai/generate-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        const assistantMsg: AIMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            data.type === "question"
              ? data.content
              : `I've created **${data.data?.name ?? "your flow"}** with ${data.data?.steps?.length ?? 0} steps. Click "Apply to Canvas" to load it.`,
          generatedFlow: data.type === "flow" ? data.data : undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setState("idle");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message ?? "Something went wrong");
        setState("error");
      }
    },
    [messages, state],
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
