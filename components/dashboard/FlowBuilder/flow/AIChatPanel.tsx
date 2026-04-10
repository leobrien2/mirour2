// components/canvas/AIChatPanel.tsx
"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  ChevronRight,
  Loader2,
  AlertCircle,
  Wand2,
  CheckCircle2,
} from "lucide-react";
import type { CanvasFlow } from "@/types/canvas";
import { useAIFlowGen, type AIMessage } from "@/hooks/useAIFlowGen";
import { FlowPreviewCard } from "@/components/dashboard/FlowBuilder/flow/FlowPreviewCard";

// ── Markdown-lite renderer (bold only) ───────────────────────────────────────
function RenderText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onApply,
}: {
  msg: AIMessage;
  onApply?: (flow: CanvasFlow) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
      )}

      <div className="max-w-[88%] space-y-2 min-w-0">
        {/* Text bubble */}
        <div
          className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted/60 border border-border/40 text-foreground rounded-tl-sm"
          }`}
        >
          <RenderText text={msg.content} />
        </div>

        {/* Flow preview — shown BEFORE the apply button */}
        {msg.generatedFlow && (
          <FlowPreviewCard
            flow={msg.generatedFlow}
            tagsSummary={msg.tagsSummary}
          />
        )}

        {/* Apply button */}
        {msg.generatedFlow && onApply && (
          <button
            onClick={() => onApply(msg.generatedFlow!)}
            className="flex items-center gap-1.5 w-full px-3 py-2 rounded-xl
              bg-primary/5 hover:bg-primary/10 border border-primary/20
              text-xs font-semibold text-primary transition-all group"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">
              Apply "{msg.generatedFlow.name}"
            </span>
            <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Starter prompts ───────────────────────────────────────────────────────────
const STARTER_PROMPTS = [
  "Create a skincare quiz that recommends products by skin type",
  "Build a supplement recommendation flow with 4 questions",
  "Make a lead capture form for a clothing store",
  "Conference networking qualifier — 3 questions with outcomes",
];

// ── Main component ────────────────────────────────────────────────────────────
interface AIChatPanelProps {
  onApplyFlow: (flow: CanvasFlow) => void;
  isOpen: boolean;
  onClose: () => void;
  storeId?: string; // ← NEW: passed from FlowBuilder
}

export function AIChatPanel({
  onApplyFlow,
  isOpen,
  onClose,
  storeId,
}: AIChatPanelProps) {
  const { messages, state, error, sendMessage, reset } = useAIFlowGen({storeId});
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus on open
  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || state === "loading") return;
    sendMessage(input);
    setInput("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApply = (flow: CanvasFlow) => {
    onApplyFlow(flow);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full sm:w-[420px] h-[88vh] sm:h-[640px] flex flex-col
          bg-background border border-border/60 rounded-t-3xl sm:rounded-2xl
          shadow-2xl overflow-hidden
          animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 duration-300"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              AI Flow Builder
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {storeId
                ? "Store tags enabled — smart product matching active"
                : "Describe your flow in plain English"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {messages.length > 0 && (
              <button
                onClick={reset}
                title="New chat"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
          {messages.length === 0 ? (
            <div className="space-y-4">
              {/* Empty state */}
              <div className="text-center pt-4 pb-2">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  Describe your flow
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                  Tell me what quiz or form you need. I'll ask if I need
                  clarification, then generate it with proper routing and
                  product tag matching.
                </p>
              </div>

              {/* Starter prompts */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Try an example
                </p>
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-border/50
                      bg-muted/20 hover:bg-muted/50 hover:border-primary/30
                      text-xs text-foreground/80 transition-all group"
                  >
                    <span className="flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 text-primary/50 mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      {prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} onApply={handleApply} />
              ))}

              {/* Loading indicator */}
              {state === "loading" && (
                <div className="flex items-center gap-2 px-1 py-1">
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-tl-sm bg-muted/60 border border-border/40">
                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">
                      Building flow…
                    </span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/20">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border/40 shrink-0 bg-background">
          <div className="flex items-end gap-2 p-2 rounded-xl border border-border/60 bg-muted/10 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Describe your flow... (Enter to send, Shift+Enter for newline)"
              rows={2}
              className="flex-1 text-xs bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground/50 leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || state === "loading"}
              className="p-2 rounded-lg bg-primary text-primary-foreground
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-primary/90 active:scale-95 transition-all shrink-0"
            >
              {state === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground/40 text-center mt-1.5">
            AI can make mistakes — always review before applying
          </p>
        </div>
      </div>
    </div>
  );
}
