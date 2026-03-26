import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Response as MirourResponse,
  SubmissionAnswer,
  AnswerRevision,
} from "@/types/mirour";
import { useToast } from "./use-toast";
import { flowLog } from "@/lib/flowLogger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmitResponseParams {
  form_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_id?: string | null;
  answers: Record<string, any>;
  redemption_code: string;
  additional_feedback?: string;
  session_id?: string | null;
  form_snapshot?: Record<string, any> | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useResponses() {
  const { toast } = useToast();
  const [responses, setResponses] = useState<MirourResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Fetch all responses for a form ─────────────────────────────────────────

  const fetchResponses = async (formId: string): Promise<MirourResponse[]> => {
    setLoading(true);
    flowLog("DB_READ responses — fetchResponses", { formId }, "db_read", "responses");

    const { data, error } = await supabase
      .from("responses")
      .select("*")
      .eq("form_id", formId)
      .order("submitted_at", { ascending: false });

    if (error) {
      flowLog("RESPONSES_ERROR", { fn: "fetchResponses", error: error.message }, "error");
      console.error("Error fetching responses:", error);
      toast({
        title: "Error",
        description: "Failed to load responses",
        variant: "destructive",
      });
      setResponses([]);
      setLoading(false);
      return [];
    }

    const parsedData: MirourResponse[] = (data || []).map((r) => {
      // Cast to any to safely read new columns (session_id, form_snapshot)
      // that Supabase generated types don't include yet.
      // Remove these casts after running: npx supabase gen types typescript
      const row = r as any;
      return {
        id: r.id,
        form_id: r.form_id,
        answers: (r.answers as Record<string, any>) || {},
        redemption_code: r.redemption_code,
        perk_redeemed: r.perk_redeemed,
        submitted_at: r.submitted_at,
        customer_name: r.customer_name ?? undefined,
        customer_email: r.customer_email ?? undefined,
        customer_phone: r.customer_phone ?? undefined,
        additional_feedback: r.additional_feedback ?? undefined,
        notes: r.notes ?? undefined,
        session_id: row.session_id ?? null,
        form_snapshot: row.form_snapshot ?? null,
      };
    });

    setResponses(parsedData);
    setLoading(false);
    flowLog("RESPONSES_FETCHED", { count: parsedData.length, formId }, "db_read");
    return parsedData;
  };

  // ── Submit a new response ──────────────────────────────────────────────────

const submitResponse = async (params: SubmitResponseParams) => {
  const {
    form_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_id = null,
    answers,
    redemption_code,
    additional_feedback,
    session_id = null,
    form_snapshot = null,
  } = params;
  const uniqueCode = redemption_code
    ? `${redemption_code}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    : `PERK-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const insertPayload = {
    form_id,
    customer_name: customer_name || null,
    customer_email: customer_email || null,
    customer_phone: customer_phone || null,
    customer_id: customer_id || null,
    answers,
    redemption_code: uniqueCode,
    additional_feedback: additional_feedback || null,
    session_id,
  };
  flowLog("DB_WRITE responses — insert", insertPayload, "db_write", "responses");

  const { data, error } = await (supabase as any)
    .from("responses")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    flowLog("RESPONSES_ERROR", { fn: "submitResponse", error: error.message }, "error");
    console.error("Error submitting response:", error);
    return { error: new Error(error.message), data: null };
  }

  flowLog("RESPONSE_SAVED", { responseId: data.id, redemption_code: uniqueCode });
  return { error: null, data };
};


  // ── Mark perk as redeemed ──────────────────────────────────────────────────

  const markAsRedeemed = async (responseId: string) => {
    flowLog("DB_WRITE responses — mark redeemed", { responseId }, "db_write", "responses");
    const { error } = await supabase
      .from("responses")
      .update({ perk_redeemed: true })
      .eq("id", responseId);

    if (error) {
      flowLog("RESPONSES_ERROR", { fn: "markAsRedeemed", error: error.message }, "error");
      toast({
        title: "Error",
        description: "Failed to mark as redeemed",
        variant: "destructive",
      });
      return { error: new Error(error.message) };
    }

    setResponses((prev) =>
      prev.map((r) =>
        r.id === responseId ? { ...r, perk_redeemed: true } : r,
      ),
    );

    toast({ title: "Success", description: "Perk marked as redeemed" });
    return { error: null };
  };

  // ── Delete a response ──────────────────────────────────────────────────────

  const deleteResponse = async (responseId: string) => {
    flowLog("DB_WRITE responses — delete", { responseId }, "db_write", "responses");
    const { error } = await supabase
      .from("responses")
      .delete()
      .eq("id", responseId);

    if (error) {
      flowLog("RESPONSES_ERROR", { fn: "deleteResponse", error: error.message }, "error");
      toast({
        title: "Error",
        description: "Failed to delete response",
        variant: "destructive",
      });
      return { error: new Error(error.message) };
    }

    setResponses((prev) => prev.filter((r) => r.id !== responseId));
    return { error: null };
  };

  // ── Update customer info on a response ────────────────────────────────────

  const updateResponseCustomerInfo = async (
    responseId: string,
    updates: {
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
    },
  ) => {
    const { error } = await supabase
      .from("responses")
      .update(updates)
      .eq("id", responseId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update customer info",
        variant: "destructive",
      });
      return { error: new Error(error.message) };
    }

    setResponses((prev) =>
      prev.map((r) => (r.id === responseId ? { ...r, ...updates } : r)),
    );

    toast({ title: "Success", description: "Customer info updated" });
    return { error: null };
  };

  // ── Find response by redemption code ──────────────────────────────────────

  const findByRedemptionCode = async (code: string) => {
    const { data, error } = await supabase
      .from("responses")
      .select("*, forms!inner(name, perk, owner_id)")
      .eq("redemption_code", code)
      .maybeSingle();

    if (error) {
      console.error("Error finding redemption code:", error);
      return { error: new Error(error.message), data: null };
    }

    return { error: null, data };
  };

  // ── Redeem perk by code ───────────────────────────────────────────────────

  const redeemByCode = async (code: string) => {
    const { error } = await supabase
      .from("responses")
      .update({ perk_redeemed: true })
      .eq("redemption_code", code);

    if (error) return { error: new Error(error.message) };
    return { error: null };
  };

  // ── Fetch response + its session in one query ─────────────────────────────
  // Joins via session_id FK — shows timing, device, node path

  const fetchResponseWithSession = async (responseId: string) => {
    // Cast to any — session_id FK join not in generated types yet
    const { data, error } = await (supabase as any)
      .from("responses")
      .select(
        `
        *,
        flow_sessions!session_id (
          id,
          visitor_id,
          visited_nodes,
          total_time_seconds,
          device_type,
          browser,
          os,
          city,
          country,
          started_at,
          completed_at
        )
      `,
      )
      .eq("id", responseId)
      .single();

    if (error) {
      console.error("Error fetching response with session:", error);
      return { error: new Error(error.message), data: null };
    }

    return { error: null, data };
  };

  // ── Fetch submission answers for a response ───────────────────────────────
  // One row per question — queryable source of truth for answer history

  const fetchSubmissionAnswers = async (
    responseId: string,
  ): Promise<{ error: Error | null; data: SubmissionAnswer[] | null }> => {
    flowLog("DB_READ submission_answers — fetchSubmissionAnswers", { responseId }, "db_read", "submission_answers");
    const { data, error } = await (supabase as any)
      .from("submission_answers")
      .select("*")
      .eq("response_id", responseId)
      .order("answered_at", { ascending: true });

    if (error) {
      flowLog("RESPONSES_ERROR", { fn: "fetchSubmissionAnswers", error: error.message }, "error");
      console.error("Error fetching submission answers:", error);
      return { error: new Error(error.message), data: null };
    }

    flowLog("SUBMISSION_ANSWERS_FETCHED", { responseId, count: (data as any[])?.length ?? 0 }, "db_read");
    return { error: null, data: data as SubmissionAnswer[] };
  };

  // ── Fetch answer revisions for a session ─────────────────────────────────
  // Every time user went back and changed their mind — ordered chronologically

  const fetchAnswerRevisions = async (
    sessionId: string,
  ): Promise<{ error: Error | null; data: AnswerRevision[] | null }> => {
    flowLog("DB_READ answer_revisions — fetchAnswerRevisions", { sessionId }, "db_read", "answer_revisions");
    const { data, error } = await (supabase as any)
      .from("answer_revisions")
      .select("*")
      .eq("session_id", sessionId)
      .order("revised_at", { ascending: true });

    if (error) {
      flowLog("RESPONSES_ERROR", { fn: "fetchAnswerRevisions", error: error.message }, "error");
      console.error("Error fetching answer revisions:", error);
      return { error: new Error(error.message), data: null };
    }

    flowLog("ANSWER_REVISIONS_FETCHED", { sessionId, count: (data as any[])?.length ?? 0 }, "db_read");
    return { error: null, data: data as AnswerRevision[] };
  };

  // ─────────────────────────────────────────────────────────────────────────

  return {
    responses,
    loading,
    fetchResponses,
    submitResponse,
    markAsRedeemed,
    deleteResponse,
    updateResponseCustomerInfo,
    findByRedemptionCode,
    redeemByCode,
    fetchResponseWithSession,
    fetchSubmissionAnswers,
    fetchAnswerRevisions,
  };
}
