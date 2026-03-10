// Extended Mirour types that include responses for dashboard views

import { Form as BaseForm, FlowNode, Profile } from "@/types/mirour";

export type { FlowNode, Profile };

// Alias for backward compatibility
export type Question = FlowNode;

// Response with camelCase for component compatibility
export interface DashboardResponse {
  id: string;
  formId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerId?: string;
  answers: Record<string, any>;
  redemptionCode: string;
  perkRedeemed: boolean;
  additionalFeedback?: string;
  submittedAt: Date;
}

// Form with embedded responses for dashboard views
export interface DashboardForm {
  id: string;
  ownerId: string;
  name: string;
  internalGoal?: string;
  store_id?: string;
  questions: FlowNode[];
  perk: string;
  active: boolean;
  captureName: boolean;
  captureEmail: boolean;
  capturePhone: boolean;
  show_start_page?: boolean;
  createdAt: Date;
  updatedAt: Date;
  responses: DashboardResponse[];
}

// Raw database response type (from Supabase query with Json type)
export interface RawDbResponse {
  id: string;
  form_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_id?: string | null;
  answers: unknown;
  redemption_code: string;
  perk_redeemed: boolean;
  additional_feedback: string | null;
  submitted_at: string;
}

// Convert raw database response to dashboard response
function rawToDashboardResponse(response: RawDbResponse): DashboardResponse {
  return {
    id: response.id,
    formId: response.form_id,
    customerName: response.customer_name ?? undefined,
    customerEmail: response.customer_email ?? undefined,
    customerPhone: response.customer_phone ?? undefined,
    customerId: response.customer_id ?? undefined,
    answers: (response.answers as Record<string, any>) || {},
    redemptionCode: response.redemption_code,
    perkRedeemed: response.perk_redeemed,
    additionalFeedback: response.additional_feedback ?? undefined,
    submittedAt: new Date(response.submitted_at),
  };
}

// Convert database form to dashboard form (accepts raw DB responses)
export function toDashboardForm(
  form: BaseForm,
  responses: RawDbResponse[] = [],
): DashboardForm {
  return {
    id: form.id,
    ownerId: form.owner_id,
    name: form.name,
    internalGoal: form.internal_goal,
    store_id: form.store_id,
    questions: form.questions,
    perk: form.perk,
    active: form.active,
    captureName: form.capture_name,
    captureEmail: form.capture_email,
    capturePhone: form.capture_phone,
    show_start_page: form.show_start_page,
    createdAt: new Date(form.created_at),
    updatedAt: new Date(form.updated_at),
    responses: responses.map(rawToDashboardResponse),
  };
}

// Session with computed status for dashboard views
export interface DashboardSession {
  id: string;
  formId: string;
  visitorId: string;
  visitedNodes: string[];
  partialAnswers: Record<string, any>;
  currentNodeId: string | null;
  status: "completed" | "in_progress" | "abandoned";
  startedAt: Date;
  lastActivityAt: Date;
  responseId?: string | null;
  response?: DashboardResponse; // Linked for completed sessions
}

// Helper to generate redemption codes
export function generateRedemptionCode(): string {
  return "MIR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}
