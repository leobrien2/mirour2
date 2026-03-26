// hooks/useFlowSession.ts
"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useFormAnalytics } from "@/hooks/useFormAnalytics";
import { useResponses } from "@/hooks/useResponses";
import { supabase } from "@/integrations/supabase/client";
import type { CanvasFlow, CanvasStep } from "@/types/canvas";
import type { Product } from "@/types/mirour";
import { flowLog } from "@/lib/flowLogger";
import {
  saveCustomerLocally,
  clearCustomerLocally,
  getLocalCustomer,
} from "@/lib/customerSession";

// ─── Public types ─────────────────────────────────────────────────────────────

export type FlowPhase = "loading" | "quiz" | "done";

export interface ContactData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface FlowSessionState {
  phase: FlowPhase;
  currentStep: CanvasStep | null;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, unknown>;
  accumulatedTags: string[];
  filteredProducts: Product[];
  isSubmitting: boolean;
  sessionId: string | null;
  customerId: string | null;
  canGoBack: boolean;
}

export interface FlowSessionActions {
  init: (zoneId?: string) => Promise<void>;
  selectOption: (
    blockId: string,
    value: string | string[],
    opts?: {
      tags?: string[];
      nextStepId?: string | null;
      autoAdvance?: boolean;
    },
  ) => void;
  submitText: (blockId: string, value: string) => void;
  submitRating: (blockId: string, value: number) => void;
  advance: (nextStepId?: string | null) => void;
  goBack: () => void;
  goToStep: (stepId: string) => void;
  submitContact: (data: ContactData) => Promise<{ error: string | null }>;
  reset: () => void;
}

// ─── Hook params ──────────────────────────────────────────────────────────────

export interface UseFlowSessionParams {
  flow: CanvasFlow;
  formId: string;
  storeId?: string;
  allProducts?: Product[];
  redemptionCode?: string;
  onComplete?: (responseId: string) => void;
  isPreview?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Must match customerSession.ts KEYS.token
const CUSTOMER_TOKEN_KEY = "mirour:customertoken";

// ─── Utility: tag-based product filter ───────────────────────────────────────

export function filterProductsByTags(
  products: Product[],
  tags: string[],
  strategy: "any" | "all" = "any",
  max = 10,
): Product[] {
  if (products.length === 0) return [];
  if (tags.length === 0) return products.slice(0, max);

  const filtered = products.filter((p) => {
    const ids: string[] = (p.tags ?? []).map((t: any) =>
      typeof t === "string" ? t : (t.id as string),
    );
    return strategy === "all"
      ? tags.every((tid) => ids.includes(tid))
      : tags.some((tid) => ids.includes(tid));
  });

  return filtered.slice(0, max);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function linearNextStepId(
  flow: CanvasFlow,
  currentStepId: string,
): string | null {
  const idx = flow.steps.findIndex((s) => s.id === currentStepId);
  return flow.steps[idx + 1]?.id ?? null;
}

function buildQuestionLabelMap(flow: CanvasFlow): Record<string, string> {
  const map: Record<string, string> = {};

  for (const step of flow.steps) {
    const heading = step.blocks?.find(
      (b) => b.data?.type === "h1" || b.data?.type === "h2",
    );
    const fallbackLabel = (heading?.data as any)?.text ?? step.label ?? null;

    for (const block of step.blocks ?? []) {
      const data = block.data as any;
      const type = data?.type as string | undefined;

      if (type === "select")
        map[block.id] = data.question ?? fallbackLabel ?? block.id;
      else if (type === "text-input")
        map[block.id] = data.placeholder ?? fallbackLabel ?? block.id;
      else if (type === "rating")
        map[block.id] = data.question ?? fallbackLabel ?? block.id;
      else if (type === "contact") map[block.id] = "Contact Information";
    }
  }

  return map;
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useFlowSession({
  flow,
  formId,
  storeId,
  allProducts = [],
  redemptionCode,
  onComplete,
  isPreview = false,
}: UseFlowSessionParams): FlowSessionState & FlowSessionActions {
  const analytics = useFormAnalytics(formId, isPreview);
  const { submitResponse } = useResponses();

  // ── Core state ─────────────────────────────────────────────────────────────

  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [currentStepId, setCurrentStepId] = useState<string | null>(
    flow.steps[0]?.id ?? null,
  );
  const [history, setHistory] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [accumulatedTags, setAccumulatedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // ── Stable refs ────────────────────────────────────────────────────────────

  const currentStepIdRef = useRef<string | null>(currentStepId);
  const phaseRef = useRef<FlowPhase>("loading");
  const answersRef = useRef<Record<string, unknown>>({});
  const answerTimestampsRef = useRef<Record<string, string>>({});
  const customerIdRef = useRef<string | null>(null);
  const tagsByBlockRef = useRef<Record<string, string[]>>({});
  const responseIdRef = useRef<string | null>(null);
  const accumulatedTagsRef = useRef<string[]>([]);
  const analyticsSessionIdRef = useRef<string | null>(null);
  const sessionCompletedRef = useRef(false);

  const questionLabelMap = useMemo(
    () => buildQuestionLabelMap(flow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formId],
  );

  useEffect(() => {
    currentStepIdRef.current = currentStepId;
  }, [currentStepId]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    accumulatedTagsRef.current = accumulatedTags;
  }, [accumulatedTags]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentStep = useMemo(
    () => flow.steps.find((s) => s.id === currentStepId) ?? null,
    [flow.steps, currentStepId],
  );

  const stepIndex = useMemo(
    () =>
      currentStepId
        ? Math.max(
            0,
            flow.steps.findIndex((s) => s.id === currentStepId),
          )
        : 0,
    [flow.steps, currentStepId],
  );

  const filteredProducts = useMemo(
    () => filterProductsByTags(allProducts, accumulatedTags),
    [allProducts, accumulatedTags],
  );

  // ── Commit Response ────────────────────────────────────────────────────────

  const commitResponse = useCallback(
    async (cid: string | null, contactData?: ContactData) => {
      if (isPreview) return null;
      if (responseIdRef.current) return responseIdRef.current;

      const sessionId = analyticsSessionIdRef.current;
      const fullName = contactData
        ? [contactData.firstName, contactData.lastName]
            .filter(Boolean)
            .join(" ") || null
        : null;

      // 1. Build enriched answers
      const enrichedAnswers: Record<string, any> = {};
      for (const [blockId, value] of Object.entries(answersRef.current)) {
        enrichedAnswers[blockId] = {
          label: questionLabelMap[blockId] ?? blockId,
          value,
          answeredAt: answerTimestampsRef.current[blockId] ?? null,
        };
      }

      flowLog("ENRICHED_ANSWERS_BUILT", {
        count: Object.keys(enrichedAnswers).length,
        answers: enrichedAnswers,
      });

      // 2. Insert form_responses row
      const finalCode = redemptionCode
        ? `${redemptionCode}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
        : `PERK-${Date.now()}`;

      const responsePayload = {
        form_id: formId,
        customer_id: cid ?? undefined,
        customer_name: fullName ?? undefined,
        customer_email: contactData?.email ?? undefined,
        customer_phone: contactData?.phone ?? undefined,
        answers: enrichedAnswers,
        redemption_code: finalCode,
        session_id: sessionId,
      };

      flowLog(
        "DB_WRITE form_responses — insert",
        responsePayload,
        "db_write",
        "form_responses",
      );

      const { error: responseError, data: responseData } =
        await submitResponse(responsePayload);

      if (responseError || !responseData) {
        flowLog(
          "FORM_RESPONSE_ERROR",
          { error: responseError?.message },
          "error",
        );
        return null;
      }

      flowLog("FORM_RESPONSE_SAVED", { responseId: responseData.id });
      responseIdRef.current = responseData.id;

      // 3. Bulk insert submission_answers
      const answerRows = Object.entries(answersRef.current).map(
        ([blockId, value]) => ({
          response_id: responseData.id,
          form_id: formId,
          customer_id: cid,
          question_id: blockId,
          question_label: questionLabelMap[blockId] ?? null,
          answer_value:
            typeof value === "string" ? value : JSON.stringify(value),
        }),
      );

      if (answerRows.length > 0) {
        flowLog(
          "DB_WRITE submission_answers — bulk insert",
          { count: answerRows.length, rows: answerRows },
          "db_write",
          "submission_answers",
        );
        (supabase as any)
          .from("submission_answers")
          .insert(answerRows)
          .then(({ error: answersError }: { error: any }) => {
            if (answersError) {
              flowLog(
                "SUBMISSION_ANSWERS_ERROR",
                { error: answersError.message },
                "error",
              );
              console.error(
                "[submission_answers] bulk insert failed:",
                answersError.message,
              );
            } else {
              flowLog("SUBMISSION_ANSWERS_SAVED", { count: answerRows.length });
            }
          });
      }

      // 4. Backfill response_id on flow_sessions row
      if (sessionId) {
        flowLog(
          "DB_WRITE flow_sessions — backfill response_id",
          { sessionId, responseId: responseData.id },
          "db_write",
          "flow_sessions",
        );
        (supabase as any)
          .from("flow_sessions")
          .update({ response_id: responseData.id })
          .eq("id", sessionId)
          .then(({ error: sessionRespErr }: { error: any }) => {
            if (sessionRespErr) {
              flowLog(
                "SESSION_UPDATE_ERROR",
                { field: "response_id", error: sessionRespErr.message },
                "error",
              );
            }
          });
      }

      onComplete?.(responseData.id);
      return responseData.id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formId,
      isPreview,
      redemptionCode,
      questionLabelMap,
      submitResponse,
      onComplete,
    ],
  );

  // ── Abandon on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (phaseRef.current !== "done" && !sessionCompletedRef.current) {
        flowLog("SESSION_ABANDON", { formId, phase: phaseRef.current }, "warn");
        analytics.markAbandoned();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Session Completion Watcher ─────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "quiz" || !currentStep) return;

    const isLastStep = flow.steps[flow.steps.length - 1]?.id === currentStep.id;
    flowLog("isLastStep", isLastStep);
    if (!isLastStep) return;
    if (sessionCompletedRef.current) return;

    sessionCompletedRef.current = true;

    const finalizeSession = async () => {
      let finalResponseId = responseIdRef.current;

      if (!finalResponseId && Object.keys(answersRef.current).length > 0) {
        flowLog("AUTO_SAVING_ANONYMOUS_RESPONSE", {
          cid: customerIdRef.current,
        });
        finalResponseId = await commitResponse(customerIdRef.current);
      }

      flowLog(
        "COMPLETE_SESSION",
        { responseId: finalResponseId },
        "db_write",
        "flow_sessions",
      );
      await analytics.completeSession(finalResponseId ?? "");

  
      flowLog(
        "LOCALSTORAGE_CLEAR",
        { keys: ["mirour:customertoken", "mirour:customer:profile"] },
        "warn",
      );



      flowLog("setPhase", "done");
    };

    finalizeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id, phase, commitResponse]);

  // ── Init ───────────────────────────────────────────────────────────────────

  const init = useCallback(
    async (zoneId?: string) => {
      flowLog("FLOW_INIT_START", {
        formId,
        isPreview,
        zoneId,
        totalSteps: flow.steps.length,
      });
      setPhase("loading");
      const firstStepId = flow.steps[0]?.id ?? null;

      if (isPreview) {
        flowLog("FLOW_INIT_PREVIEW_MODE", { firstStepId });
        setCurrentStepId(firstStepId);
        setHistory([]);
        setAnswers({});
        setAccumulatedTags([]);
        answerTimestampsRef.current = {};
        tagsByBlockRef.current = {};
        responseIdRef.current = null;
        customerIdRef.current = null;
        accumulatedTagsRef.current = [];
        setCustomerId(null);
        setPhase(firstStepId ? "quiz" : "done");
        return;
      }

      // ✅ Fix 1: read from the unified key "mirour:customertoken"
      const existingCustomerId =
        typeof window !== "undefined"
          ? (localStorage.getItem(CUSTOMER_TOKEN_KEY) ?? null)
          : null;

      flowLog(
        "LOCALSTORAGE_READ",
        { key: CUSTOMER_TOKEN_KEY, value: existingCustomerId },
        "db_read",
      );

      customerIdRef.current = existingCustomerId;
      setCustomerId(existingCustomerId);

      await analytics.trackVisit(zoneId);

      const sessionId = await analytics.startSession(firstStepId ?? undefined, {
        flowVersion: "v1",
        customerId: existingCustomerId,
      });

      analyticsSessionIdRef.current = sessionId;

      if (existingCustomerId && sessionId) {
        flowLog(
          "DB_WRITE flow_sessions — backfill customer_id on init",
          { sessionId, customerId: existingCustomerId },
          "db_write",
          "flow_sessions",
        );
        (supabase as any)
          .from("flow_sessions")
          .update({ customer_id: existingCustomerId })
          .eq("id", sessionId)
          .then();
      }

      if (storeId && sessionId) {
        await analytics.recordJourney(sessionId, storeId);
      }

      setCurrentStepId(firstStepId);
      setHistory([]);
      setAnswers({});
      setAccumulatedTags([]);
      answerTimestampsRef.current = {};
      tagsByBlockRef.current = {};
      responseIdRef.current = null;
      accumulatedTagsRef.current = [];
      setPhase(firstStepId ? "quiz" : "done");
      flowLog("FLOW_INIT_COMPLETE", { firstStepId, sessionId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.steps, storeId, isPreview],
  );

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goToStep = useCallback(
    (stepId: string) => {
      const current = currentStepIdRef.current;
      flowLog("STEP_ADVANCE", { from: current, to: stepId }, "nav");
      if (current) setHistory((prev) => [...prev, current]);
      setCurrentStepId(stepId);
      analytics.updateProgress(stepId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analytics],
  );

  const advance = useCallback(
    async (overrideNextStepId?: string | null) => {
      const csid = currentStepIdRef.current;
      if (!csid) return;
      const nextId =
        overrideNextStepId === undefined
          ? linearNextStepId(flow, csid)
          : overrideNextStepId;

      if (nextId) {
        flowLog("STEP_ADVANCE", { from: csid, to: nextId }, "nav");
        goToStep(nextId);
      } else {
        flowLog("STEP_ADVANCE", { from: csid, to: "done" }, "nav");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, goToStep],
  );

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const prevStepId = updated.pop()!;
      flowLog(
        "STEP_BACK",
        { to: prevStepId, from: currentStepIdRef.current },
        "nav",
      );
      setCurrentStepId(prevStepId);
      analytics.updateProgress(prevStepId);
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Answer recording ───────────────────────────────────────────────────────

  const recordAnswer = useCallback(
    (blockId: string, value: unknown) => {
      const now = new Date().toISOString();
      answerTimestampsRef.current[blockId] = now;
      setAnswers((prev) => ({ ...prev, [blockId]: value }));

      const csid = currentStepIdRef.current;
      if (csid) analytics.updateProgress(csid, { questionId: blockId, value });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Select option ──────────────────────────────────────────────────────────

  const selectOption = useCallback(
    (
      blockId: string,
      value: string | string[],
      opts: {
        tags?: string[];
        nextStepId?: string | null;
        autoAdvance?: boolean;
      } = {},
    ) => {
      const { tags = [], nextStepId, autoAdvance = false } = opts;
      flowLog("ANSWER_SELECTED", {
        blockId,
        value,
        tags,
        nextStepId,
        autoAdvance,
      });

      recordAnswer(blockId, value);

      setAccumulatedTags((prev) => {
        const oldTags = tagsByBlockRef.current[blockId] ?? [];
        const stripped = prev.filter((t) => !oldTags.includes(t));
        const next = Array.from(new Set([...stripped, ...tags]));
        if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
        tagsByBlockRef.current[blockId] = tags;
        accumulatedTagsRef.current = next;
        flowLog("TAGS_UPDATED", {
          blockId,
          addedTags: tags,
          accumulatedTags: next,
        });
        return next;
      });

      if (autoAdvance) advance(nextStepId);
    },
    [recordAnswer, advance],
  );

  // ── Text / Rating ──────────────────────────────────────────────────────────

  const submitText = useCallback(
    (blockId: string, value: string) => {
      flowLog("TEXT_SUBMITTED", { blockId, value });
      recordAnswer(blockId, value);
    },
    [recordAnswer],
  );

  const submitRating = useCallback(
    (blockId: string, value: number) => {
      flowLog("RATING_SUBMITTED", { blockId, value });
      recordAnswer(blockId, value);
    },
    [recordAnswer],
  );

  // ── Contact submit ─────────────────────────────────────────────────────────

const submitContact = useCallback(
  async (data: ContactData): Promise<{ error: string | null }> => {
    if (isPreview) return { error: null };

    setIsSubmitting(true);
    flowLog("CONTACT_SUBMIT_START", {
      hasFirstName: !!data.firstName,
      hasLastName: !!data.lastName,
      hasEmail: !!data.email,
      hasPhone: !!data.phone,
    });

    try {
      const sessionId = analyticsSessionIdRef.current;
      const fullName =
        [data.firstName, data.lastName].filter(Boolean).join(" ") || null;

      let cid: string;

      // ── Path 1: Known customer — skip DB entirely ──────────────────────
      if (customerIdRef.current) {
        cid = customerIdRef.current;
        flowLog("CONTACT_SUBMIT_SKIP_UPSERT", {
          reason: "customer already identified via floating bar login",
          customerId: cid,
        });

        // Silently patch any new data — fire & forget
        if (data.email || data.phone || fullName) {
          (supabase as any)
            .from("customers")
            .update({
              ...(fullName ? { name: fullName } : {}),
              ...(data.firstName ? { first_name: data.firstName } : {}),
              ...(data.email ? { email: data.email } : {}),
              ...(data.phone ? { phone: data.phone } : {}),
              last_active: new Date().toISOString(),
            })
            .eq("id", cid)
            .then(({ error: patchErr }: { error: any }) => {
              if (patchErr)
                flowLog(
                  "CUSTOMER_PATCH_ERROR",
                  { error: patchErr.message },
                  "error",
                );
            });
        }

        // ── Path 2: Customer with phone — SELECT first, then INSERT/UPDATE ─
      } else if (data.phone) {
        flowLog(
          "DB_READ customers — lookup by phone",
          { phone: data.phone, storeId },
          "db_read",
          "customers",
        );

        // Step 1: Find existing customer by phone
        const { data: existing, error: lookupError } = await (supabase as any)
          .from("customers")
          .select("id")
          .eq("phone", data.phone)
          .maybeSingle();

        if (lookupError) {
          flowLog(
            "CUSTOMER_LOOKUP_ERROR",
            { error: lookupError.message },
            "error",
          );
          return {
            error:
              "We encountered an issue verifying your phone number. Please try again.",
          };
        }

        if (existing) {
          // Step 2a: Found — UPDATE by primary key
          cid = existing.id;
          flowLog("CUSTOMER_FOUND", {
            customerId: cid,
            method: "phone_lookup",
          });

          (supabase as any)
            .from("customers")
            .update({
              ...(fullName ? { name: fullName } : {}),
              ...(data.firstName ? { first_name: data.firstName } : {}),
              ...(data.email ? { email: data.email } : {}),
              traits: { tags: accumulatedTagsRef.current },
              last_active: new Date().toISOString(),
            })
            .eq("id", cid)
            .then(({ error: updateErr }: { error: any }) => {
              if (updateErr) {
                flowLog(
                  "CUSTOMER_UPDATE_ERROR",
                  { error: updateErr.message },
                  "error",
                );
              } else {
                flowLog("CUSTOMER_UPDATED", { customerId: cid });
              }
            });
        } else {
          // Step 2b: Not found — INSERT fresh row without email first
          const insertPayload = {
            name: fullName,
            first_name: data.firstName ?? null,
            phone: data.phone,
            store_id: storeId ?? null,
            traits: { tags: accumulatedTagsRef.current },
            last_active: new Date().toISOString(),
          };
          flowLog(
            "DB_WRITE customers — insert (new phone customer)",
            insertPayload,
            "db_write",
            "customers",
          );

          const { data: newCustomer, error: insertError } = await (
            supabase as any
          )
            .from("customers")
            .insert(insertPayload)
            .select("id")
            .single();

          if (insertError || !newCustomer) {
            flowLog(
              "CUSTOMER_INSERT_ERROR",
              { error: insertError?.message },
              "error",
            );
            return {
              error:
                "We couldn't save your details at this time. Please try again.",
            };
          }

          cid = newCustomer.id;
          flowLog("CUSTOMER_SAVED", {
            customerId: cid,
            method: "insert_phone",
          });

          // Patch email separately by primary key
          if (data.email) {
            (supabase as any)
              .from("customers")
              .update({ email: data.email })
              .eq("id", cid)
              .then(({ error: emailErr }: { error: any }) => {
                if (emailErr) {
                  flowLog(
                    "CUSTOMER_EMAIL_PATCH_ERROR",
                    { error: emailErr.message },
                    "error",
                  );
                } else {
                  flowLog("CUSTOMER_EMAIL_PATCHED", { customerId: cid });
                }
              });
          }
        }

        saveCustomerLocally({
          id: cid,
          name: fullName,
          firstname: data.firstName ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
        });
        flowLog("LOCALSTORAGE_WRITE", {
          key: "mirour:customertoken + mirour:customer:profile",
          cid,
        });

        customerIdRef.current = cid;
        setCustomerId(cid);

        // ── Path 3: Email only (no phone) — safe select then insert/update ──────────
      } else if (data.email) {
        flowLog(
          "DB_READ customers — lookup by email",
          { email: data.email, storeId },
          "db_read",
          "customers",
        );

        // Step 1: Find existing customer by email
        let query = (supabase as any)
          .from("customers")
          .select("id")
          .eq("email", data.email);
       if (storeId) {
         query = query.eq("store_id", storeId);
       } else {
         query = query.is("store_id", null); // ← must be explicit
       }

        const { data: existing, error: lookupError } =
          await query.maybeSingle();

        if (lookupError) {
          flowLog(
            "CUSTOMER_LOOKUP_ERROR",
            { error: lookupError.message },
            "error",
          );
          return {
            error:
              "We encountered an issue verifying your email address. Please try again.",
          };
        }

        if (existing) {
          // Step 2a: Found — UPDATE by primary key
          cid = existing.id;
          flowLog("CUSTOMER_FOUND", {
            customerId: cid,
            method: "email_lookup",
          });

          (supabase as any)
            .from("customers")
            .update({
              ...(fullName ? { name: fullName } : {}),
              ...(data.firstName ? { first_name: data.firstName } : {}),
              traits: { tags: accumulatedTagsRef.current },
              last_active: new Date().toISOString(),
            })
            .eq("id", cid)
            .then(({ error: updateErr }: { error: any }) => {
              if (updateErr) {
                flowLog(
                  "CUSTOMER_UPDATE_ERROR",
                  { error: updateErr.message },
                  "error",
                );
              } else {
                flowLog("CUSTOMER_UPDATED", { customerId: cid });
              }
            });
        } else {
          // Step 2b: Not found — INSERT fresh row
          const insertPayload = {
            name: fullName,
            first_name: data.firstName ?? null,
            email: data.email,
            phone: null,
            store_id: storeId ?? null,
            traits: { tags: accumulatedTagsRef.current },
            last_active: new Date().toISOString(),
          };

          flowLog(
            "DB_WRITE customers — insert (new email customer)",
            insertPayload,
            "db_write",
            "customers",
          );

          const { data: newCustomer, error: insertError } = await (
            supabase as any
          )
            .from("customers")
            .insert(insertPayload)
            .select("id")
            .single();

          if (insertError || !newCustomer) {
            flowLog(
              "CUSTOMER_INSERT_ERROR",
              { error: insertError?.message },
              "error",
            );
            return {
              error:
                "We couldn't save your details at this time. Please try again.",
            };
          }

          cid = newCustomer.id;
          flowLog("CUSTOMER_SAVED", {
            customerId: cid,
            method: "insert_email",
          });
        }

        saveCustomerLocally({
          id: cid,
          name: fullName,
          firstname: data.firstName ?? null,
          email: data.email,
          phone: null,
        });

        flowLog("LOCALSTORAGE_WRITE", {
          key: "mirour:customertoken + mirour:customer:profile",
          cid,
        });

        customerIdRef.current = cid;
        setCustomerId(cid);
      } else {
        // Fallback if neither email nor phone is provided but somehow passed validation
        return {
          error: "Please provide either an email address or a phone number.",
        };
      }

      // ── Backfill session — runs for all 3 paths ────────────────────────
      if (sessionId) {
        flowLog(
          "DB_WRITE flow_sessions — backfill customer_id post-contact",
          { sessionId, customerId: cid },
          "db_write",
          "flow_sessions",
        );
        const { error: sessionCustErr } = await (supabase as any)
          .from("flow_sessions")
          .update({ customer_id: cid })
          .eq("id", sessionId);
        if (sessionCustErr) {
          flowLog(
            "SESSION_UPDATE_ERROR",
            { field: "customer_id", error: sessionCustErr.message },
            "error",
          );
        }
      }

      // ── Commit response ────────────────────────────────────────────────
      const responseId = await commitResponse(cid, data);
      if (!responseId) {
        return { error: "We couldn't submit your response. Please try again." };
      }

      flowLog("CONTACT_SUBMIT_SUCCESS", {
        responseId,
        customerId: cid,
        sessionId,
      });
      return { error: null };
    } catch (err: any) {
      flowLog(
        "CONTACT_SUBMIT_FATAL_ERROR",
        { error: err?.message || err },
        "error",
      );
      return {
        error:
          "An unexpected error occurred while saving your information. Please try again.",
      };
    } finally {
      setIsSubmitting(false);
    }
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [commitResponse, storeId, isPreview],
);
  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    flowLog("SESSION_RESET", { formId }, "warn");

    if (typeof window !== "undefined") {
      // ✅ Fix 4: clearCustomerLocally handles mirour:customertoken
      //    and mirour:customer:profile. Also clear saved items + any
      //    legacy mirour_ underscore keys.
      // clearCustomerLocally();
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("mirour_") || key.startsWith("mirour:saved:")) {
          localStorage.removeItem(key);
        }
      });
    }

    setPhase("loading");
    setCurrentStepId(flow.steps[0]?.id ?? null);
    setHistory([]);
    setAnswers({});
    setAccumulatedTags([]);
    setIsSubmitting(false);
    setCustomerId(null);
    answerTimestampsRef.current = {};
    tagsByBlockRef.current = {};
    responseIdRef.current = null;
    accumulatedTagsRef.current = [];
    customerIdRef.current = null;
    sessionCompletedRef.current = false;
    analyticsSessionIdRef.current = null;
  }, [flow.steps, formId]);

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    phase,
    currentStep,
    stepIndex,
    totalSteps: flow.steps.length,
    answers,
    accumulatedTags,
    filteredProducts,
    isSubmitting,
    sessionId: analytics.sessionId,
    customerId,
    canGoBack: history.length > 0,
    init,
    selectOption,
    submitText,
    submitRating,
    advance,
    goBack,
    goToStep,
    submitContact,
    reset,
  };
}
