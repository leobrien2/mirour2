"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { List } from "lucide-react";
import { SubmissionAccordion } from "./SubmissionAccordion";
import { DashboardForm } from "@/types/dashboard";
import { useToast } from "@/hooks/use-toast";

type CustomerFormSubmissionsProps = {
  userId: string;
  customerRecord: any;
  flowSessions: any[];
  onSubmissionsLoaded: (submissions: any[]) => void;
};

const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export function CustomerFormSubmissions({
  userId,
  customerRecord,
  flowSessions,
  onSubmissionsLoaded,
}: CustomerFormSubmissionsProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  // Map of session_id → array of nodes
  const [sessionNodes, setSessionNodes] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<
    string | null
  >(null);
  const { toast } = useToast();

  // ── Fetch flow_session_nodes for all sessions belonging to this customer ──
  useEffect(() => {
    if (!flowSessions || flowSessions.length === 0) return;

    const sessionIds = flowSessions
      .map((s) => s.id)
      .filter((id): id is string => !!id && isUUID(id));

    if (sessionIds.length === 0) return;

    supabase
      .from("flow_session_nodes")
      .select(
        "id, session_id, node_id, entered_at, exited_at, time_spent_seconds, is_dropoff",
      )
      .in("session_id", sessionIds)
      .order("entered_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching session nodes:", error);
          return;
        }
        if (data) {
          // Group by session_id for O(1) lookup later
          const grouped = data.reduce(
            (acc: Record<string, any[]>, node: any) => {
              if (!acc[node.session_id]) acc[node.session_id] = [];
              acc[node.session_id].push(node);
              return acc;
            },
            {},
          );
          setSessionNodes(grouped);
        }
      });
  }, [flowSessions]);

const fetchSubmissions = useCallback(async () => {
  // 1. Get the current authenticated user (the owner)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log("No authenticated user found");
    setLoading(false);
    return;
  }

  const orConditions: string[] = [];

  // ── Primary: customer_id UUID (most reliable) ──
  if (customerRecord?.id && isUUID(customerRecord.id)) {
    orConditions.push(`customer_id.eq.${customerRecord.id}`);
  }

  // ── Fallback: userId string format detection ──
  if (userId.includes("@")) {
    orConditions.push(`customer_email.eq.${userId}`);
  } else if (userId.match(/^\+?[0-9\s-]+$/)) {
    orConditions.push(`customer_phone.eq.${userId}`);
  } else if (userId.startsWith("anonymous-")) {
    const responseId = userId.replace("anonymous-", "");
    if (isUUID(responseId)) orConditions.push(`id.eq.${responseId}`);
  }

  // ── Safe fallbacks from customerRecord fields (email + phone only) ──
  if (customerRecord?.email)
    orConditions.push(`customer_email.eq.${customerRecord.email}`);
  if (customerRecord?.phone)
    orConditions.push(`customer_phone.eq.${customerRecord.phone}`);

  // ── Link via flowSessions response_id ──
  if (flowSessions?.length > 0) {
    flowSessions.forEach((session) => {
      if (session.response_id && isUUID(session.response_id)) {
        orConditions.push(`id.eq.${session.response_id}`);
      }
    });
  }

  const uniqueConditions = Array.from(new Set(orConditions));

  if (uniqueConditions.length === 0) {
    console.log("No unique conditions");
    setSubmissions([]);
    onSubmissionsLoaded([]);
    setLoading(false);
    return;
  }

  // 2. Query responses with an inner join to forms and filter by owner_id
  const { data, error } = await supabase
    .from("responses")
    .select(
      `
        id,
        form_id,
        submitted_at,
        perk_redeemed,
        redemption_code,
        answers,
        customer_name,
        customer_email,
        customer_phone,
        customer_id,
        forms!inner (
          id,
          name,
          questions,
          owner_id
        )
      `,
    )
    .or(uniqueConditions.join(","))
    .eq("forms.owner_id", user.id) // <-- SECURITY FILTER: Only forms owned by current user
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Error fetching customer submissions:", error);
    setLoading(false);
    return;
  }

  const formattedParams = (data || []).map((r: any) => {
    const formObj = Array.isArray(r.forms) ? r.forms[0] : r.forms;
    let parsedQuestions = formObj?.questions;
    if (typeof parsedQuestions === "string") {
      try {
        parsedQuestions = JSON.parse(parsedQuestions);
      } catch {
        parsedQuestions = null;
      }
    }

    // ── FLATTEN BLOCKS FOR SEARCHING ──
    // Handle both legacy flat arrays and the new nested CanvasFlow (steps -> blocks) structure
    let allBlocks: any[] = [];
    if (parsedQuestions) {
      if (Array.isArray(parsedQuestions)) {
        parsedQuestions.forEach((item: any) => {
          if (item.blocks)
            allBlocks.push(...item.blocks); // CanvasStep format
          else allBlocks.push(item); // Legacy FlowNode format
        });
      } else if (parsedQuestions.steps) {
        // Full CanvasFlow object format
        parsedQuestions.steps.forEach((step: any) => {
          if (step.blocks) allBlocks.push(...step.blocks);
        });
      }
    }

    // Parse raw answers
    const rawAnswers =
      typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers || {};
    const processedAnswers: Record<string, any> = {};

    // Transform answers
    Object.entries(rawAnswers).forEach(([questionId, ans]: [string, any]) => {
      let label = questionId;
      let value = ans;

      // Extract the structured answer format { label, value, answeredAt }
      if (ans && typeof ans === "object" && !Array.isArray(ans)) {
        label = ans.label || questionId;
        value = ans.value !== undefined ? ans.value : ans;
      }

      // Find the block in our flattened array
      const blockDef = allBlocks.find((b: any) => b.id === questionId);

      if (blockDef) {
        // Support both new `data.options` and legacy `.options`
        const options = blockDef.data?.options || blockDef.options;

        if (Array.isArray(options)) {
          if (Array.isArray(value)) {
            // Handle multiple choice arrays
            value = value
              .map((v) => {
                const opt = options.find(
                  (o: any) => o.id === v || o.value === v,
                );
                return opt ? opt.label || opt.text || opt.value : v;
              })
              .join(", ");
          } else {
            // Handle single choice
            const opt = options.find(
              (o: any) => o.id === value || o.value === value,
            );
            if (opt) {
              value = opt.label || opt.text || opt.value;
            }
          }
        }
      }

      // Failsafe stringification
      if (value && typeof value === "object") {
        try {
          value = JSON.stringify(value);
        } catch {
          value = String(value);
        }
      }

      processedAnswers[label] = value;
    });

    return {
      responseId: r.id,
      formId: r.form_id,
      formName: formObj?.name,
      submittedAt: new Date(r.submitted_at),
      perkRedeemed: r.perk_redeemed,
      redemptionCode: r.redemption_code,
      answers: processedAnswers,
      schema: parsedQuestions,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      customerPhone: r.customer_phone,
      customerId: r.customer_id,
    };
  });

  // Deduplicate by responseId
  const seen = new Set<string>();
  const deduplicated = formattedParams.filter((r) => {
    if (seen.has(r.responseId)) return false;
    seen.add(r.responseId);
    return true;
  });

  setSubmissions(deduplicated);
  onSubmissionsLoaded(deduplicated);
  setLoading(false);
}, [userId, customerRecord, flowSessions, onSubmissionsLoaded]);
  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const toggleSubmission = (responseId: string) => {
    setExpandedSubmissionId((prev) =>
      prev === responseId ? null : responseId,
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Response ID copied to clipboard." });
  };

  if (loading) {
    return (
      <div className="bg-card rounded-3xl shadow-xl border border-border mt-6 overflow-hidden p-8 flex justify-center items-center">
        <div className="animate-pulse flex items-center gap-2">
          <List className="w-5 h-5 text-muted-foreground" />
          <span className="text-muted-foreground">Loading submissions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl shadow-xl border border-border mt-6 overflow-hidden">
      <div className="bg-secondary p-5 sm:p-6 flex items-center gap-2 border-b border-border">
        <List className="w-5 h-5 text-secondary-foreground" />
        <h2 className="text-lg font-semibold text-secondary-foreground">
          Form Submissions
        </h2>
      </div>
      <div className="flex flex-col">
        {submissions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No submissions found.
          </div>
        ) : (
          submissions.map((submission) => {
            const isExpanded = expandedSubmissionId === submission.responseId;

            // Match session
            const session = flowSessions.find(
              (s) =>
                (submission.customerId &&
                  s.customer_id === submission.customerId) ||
                s.response_id === submission.responseId ||
                s.form_id === submission.formId,
            );

            const nodes = session?.id ? (sessionNodes[session.id] ?? []) : [];

            const formSchema = {
              questions: submission.schema || [],
            } as DashboardForm;

            return (
              <SubmissionAccordion
                key={submission.responseId}
                submission={submission}
                session={session}
                sessionNodes={nodes}
                formSchema={formSchema}
                isExpanded={isExpanded}
                onToggle={() => toggleSubmission(submission.responseId)}
                onCopy={copyToClipboard}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
