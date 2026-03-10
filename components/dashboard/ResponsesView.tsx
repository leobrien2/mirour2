"use client";

import { DashboardForm, DashboardResponse } from "@/types/dashboard";
import { FlowNode } from "@/types/mirour";
import { ArrowLeft, Search, Download, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatInStoreTime } from "@/lib/utils";

// Column type for unified table structure
type TableColumn = {
  id: string;
  label: string;
  type:
    | "question"
    | "customer-name"
    | "customer-email"
    | "customer-phone"
    | "message";
  questionType?: string;
};

// Helper to get display label for a node
function getNodeDisplayLabel(node: FlowNode): string {
  if (node.label) return node.label;
  if (node.content)
    return node.content.slice(0, 40) + (node.content.length > 40 ? "..." : "");
  if (node.type === "message") return "Message";
  return `Step (${node.type})`;
}

// Extract table columns from flow nodes - each field is its own column
function extractTableColumns(nodes: FlowNode[]): TableColumn[] {
  const columns: TableColumn[] = [];

  for (const node of nodes) {
    if (node.type === "welcome" || node.type === "complete") continue;

    if (node.type === "customer-info") {
      // Split into separate columns for each enabled field
      if (node.captureFields?.name) {
        columns.push({
          id: `${node.id}_name`,
          label: "Name",
          type: "customer-name",
        });
      }
      if (node.captureFields?.email) {
        columns.push({
          id: `${node.id}_email`,
          label: "Email",
          type: "customer-email",
        });
      }
      if (node.captureFields?.phone) {
        columns.push({
          id: `${node.id}_phone`,
          label: "Phone",
          type: "customer-phone",
        });
      }
    } else {
      columns.push({
        id: node.id,
        label: getNodeDisplayLabel(node),
        type: node.type === "message" ? "message" : "question",
        questionType: node.questionType,
      });
    }

    // Recurse into branches
    if (node.branches) {
      for (const branch of node.branches) {
        columns.push(...extractTableColumns(branch.nodes));
      }
    }
  }

  return columns;
}

type ResponsesViewProps = {
  form: DashboardForm;
  onBack: () => void;
  initialSearch?: string;
  onSearchChange?: (search: string) => void;
  onNavigateToUserProfile?: (userId: string) => void;
};

export function ResponsesView({
  form,
  onBack,
  initialSearch = "",
  onSearchChange,
  onNavigateToUserProfile,
}: ResponsesViewProps) {
  // Extract table columns from flow (each field is its own column)
  const tableColumns = useMemo(
    () => extractTableColumns(form.questions),
    [form.questions],
  );
  const hasQuizQuestions = tableColumns.some(
    (col) => col.questionType === "quiz",
  );
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Fetch responses directly from the responses table
  const [responses, setResponses] = useState<DashboardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Store the callback in a ref to avoid dependency cycle in the cleanup effect
  const searchChangeRef = useRef(onSearchChange);
  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("Missing Supabase URL");

      const response = await fetch(`${supabaseUrl}/functions/v1/export-csv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ formId: form.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate CSV");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.name.replace(/\s+/g, "_")}_responses_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const fetchResponses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("responses")
        .select("*")
        .eq("form_id", form.id)
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Error fetching responses:", error);
        setLoading(false);
        return;
      }

      console.log("Data", data);


      if (data) {
        setResponses(
          data.map((r) => ({
            id: r.id,
            formId: r.form_id,
            customerName: r.customer_name ?? undefined,
            customerEmail: r.customer_email ?? undefined,
            customerPhone: r.customer_phone ?? undefined,
            answers: (r.answers as Record<string, any>) || {},
            submittedAt: new Date(r.submitted_at),
            redemptionCode: r.redemption_code,
            perkRedeemed: r.perk_redeemed,
            additionalFeedback: r.additional_feedback ?? undefined,
          })),
        );
      }
      setLoading(false);
    };

    fetchResponses();
  }, [form.id]);

  // Update search query when initialSearch changes
  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  // Notify parent of search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  // Clear search when unmounting, but only if there was a search query
  useEffect(() => {
    return () => {
      // We use the ref here to ensure we have the latest callback without triggering rerenders
      // and we only call it if there was actually something to clear to avoid redundant state updates in parent
      if (searchQuery) {
        searchChangeRef.current?.("");
      }
    };
  }, []); // Empty dependency array means this only runs on mount/unmount

  // Filter by search
  const filteredData = useMemo(() => {
    if (!searchQuery) return responses;

    const query = searchQuery.toLowerCase();
    return responses.filter(
      (item) =>
        item.customerEmail?.toLowerCase().includes(query) ||
        item.customerName?.toLowerCase().includes(query) ||
        item.customerPhone?.toLowerCase().includes(query) ||
        Object.values(item.answers).some((answer) =>
          String(answer).toLowerCase().includes(query),
        ),
    );
  }, [responses, searchQuery]);

  const formatDate = (date: Date | string) => {
    return formatInStoreTime(date);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background pt-6">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between min-h-[100px] bg-card border-2 border-primary/20 rounded-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-primary/10 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex flex-col justify-center">
              <h2 className="font-heading text-foreground">{form.name}</h2>
              <p className="text-sm text-muted-foreground">
                {responses.length} responses
              </p>
            </div>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={isExporting || responses.length === 0}
            className="px-4 py-2 border border-primary/20 bg-secondary rounded-xl text-sm font-medium hover:bg-primary/5 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search responses"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border-2 border-primary/20 rounded-xl focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border-2 border-primary/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary border-b-2 border-primary/10">
                  <th className="px-6 py-4 text-left text-sm text-muted-foreground">
                    Time
                  </th>
                  {tableColumns.map((col) => (
                    <th
                      key={col.id}
                      className="px-6 py-4 text-left text-sm text-muted-foreground min-w-[200px]"
                    >
                      {col.label}
                    </th>
                  ))}
                  {hasQuizQuestions && (
                    <th className="px-6 py-4 text-left text-sm text-muted-foreground">
                      Quiz Score
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        1 + tableColumns.length + (hasQuizQuestions ? 1 : 0)
                      }
                      className="px-6 py-12 text-center text-muted-foreground"
                    >
                      Loading responses...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        1 + tableColumns.length + (hasQuizQuestions ? 1 : 0)
                      }
                      className="px-6 py-12 text-center text-muted-foreground"
                    >
                      {searchQuery
                        ? "No responses match your search"
                        : "No responses yet"}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((response) => (
                    <tr
                      key={response.id}
                      onClick={() => 
                        onNavigateToUserProfile?.(
                          response.customerId ||
                          response.customerPhone || 
                          response.customerEmail || 
                          response.customerName || 
                          `anonymous-${response.id}`
                        )
                      }
                      className="border-b border-primary/10 hover:bg-secondary/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-foreground">
                        {formatDate(response.submittedAt)}
                      </td>
                      {tableColumns.map((col) => {
                        let displayValue = "-";

                        if (col.type === "customer-name") {
                          displayValue = response.customerName || "-";
                        } else if (col.type === "customer-email") {
                          displayValue = response.customerEmail || "-";
                        } else if (col.type === "customer-phone") {
                          displayValue = response.customerPhone || "-";
                        } else {
                          const answer = response.answers[col.id];
                          if (
                            answer !== undefined &&
                            answer !== null &&
                            answer !== ""
                          ) {
                            if (Array.isArray(answer)) {
                              displayValue = answer.join(", ");
                            } else if (typeof answer === "object") {
                              displayValue = JSON.stringify(answer);
                            } else {
                              displayValue = String(answer);
                            }
                          }
                        }

                        return (
                          <td key={col.id} className="px-6 py-4 text-sm">
                            {col.questionType === "rating" &&
                            displayValue !== "-" ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="text-foreground">
                                  {displayValue}
                                </span>
                                <span className="text-muted-foreground">
                                  / 5
                                </span>
                              </span>
                            ) : (
                              <span className="text-foreground">
                                {displayValue}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {hasQuizQuestions && (
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                            {response.answers._quizScore !== undefined
                              ? response.answers._quizScore
                              : "-"}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
