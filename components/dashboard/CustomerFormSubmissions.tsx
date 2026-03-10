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
   // ❌ Removed: name-based userId fallback — name is not unique

   // ── Safe fallbacks from customerRecord fields (email + phone only) ──
   if (customerRecord?.email)
     orConditions.push(`customer_email.eq.${customerRecord.email}`);
   if (customerRecord?.phone)
     orConditions.push(`customer_phone.eq.${customerRecord.phone}`);
   // ❌ Removed: customer_name fallback — causes cross-customer contamination

   // ── Link via flowSessions response_id ──
   if (flowSessions?.length > 0) {
     flowSessions.forEach((session) => {
       if (session.response_id && isUUID(session.response_id)) {
         orConditions.push(`id.eq.${session.response_id}`);
       }
     });
   }

   console.log("orConditions", orConditions);

   const uniqueConditions = Array.from(new Set(orConditions));

   console.log("uniqueConditions", uniqueConditions);

   if (uniqueConditions.length === 0) {

    console.log("No unique conditions");
     setSubmissions([]);
     onSubmissionsLoaded([]);
     setLoading(false);
     return;
   }

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
      forms (
        id,
        name,
        questions
      )
    `,
     )
     .or(uniqueConditions.join(","))
     .order("submitted_at", { ascending: false });

     console.log("data", data);

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
         parsedQuestions = [];
       }
     }

     return {
       responseId: r.id,
       formId: r.form_id,
       formName: formObj?.name,
       submittedAt: new Date(r.submitted_at),
       perkRedeemed: r.perk_redeemed,
       redemptionCode: r.redemption_code,
       answers:
         typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers,
       schema: parsedQuestions,
       customerName: r.customer_name,
       customerEmail: r.customer_email,
       customerPhone: r.customer_phone,
       customerId: r.customer_id,
     };
   });


   console.log("formattedParams", formattedParams);
   // Deduplicate by responseId — safety net against any remaining RLS overlap
   const seen = new Set<string>();
   const deduplicated = formattedParams.filter((r) => {
     if (seen.has(r.responseId)) return false;
     seen.add(r.responseId);
     return true;
   });
   console.log("deduplicated", deduplicated);

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

            // Match session — prioritise customer_id UUID match (most accurate),
            // fall back to response_id, then form_id
            const session = flowSessions.find(
              (s) =>
                (submission.customerId &&
                  s.customer_id === submission.customerId) ||
                s.response_id === submission.responseId ||
                s.form_id === submission.formId,
            );

            // Get per-node timing rows for this specific session
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
