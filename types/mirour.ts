// Mirour Type Definitions

export type FlowNodeType =
  | "welcome"
  | "message"
  | "question"
  | "customer-info"
  | "recommendation"
  | "product-showcase"
  | "complete";

export type QuestionType =
  | "short-answer"
  | "long-answer"
  | "multiple-choice"
  | "checkboxes"
  | "rating"
  | "photo"
  | "quiz";

export type FlowType = "standard" | "entrance" | "zone";

export type SectionType = "content" | "link" | "options" | "product";

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  zone_what?: string;
  zone_when?: string;
  zone_who?: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  store_id: string;
  name: string;
  category?: string;
  is_hard_constraint?: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  owner_id: string;
  store_id?: string;
  store_ids?: string[];
  zone_id?: string;
  name: string;
  description?: string;
  image_url?: string;
  sku?: string;
  price?: number;
  in_stock: boolean;
  is_staff_pick?: boolean;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
}

export interface ProductItem {
  id: string;
  name: string;
  imageUrl?: string;
  linkUrl?: string;
}

export interface WelcomeSection {
  id: string;
  type: SectionType;
  text?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  options?: { label: string; targetNodeId?: string }[];
  products?: ProductItem[];
}

export function generateSectionId(): string {
  return "section-" + Math.random().toString(36).substring(2, 9);
}

export interface ConditionalNext {
  optionValue: string;
  nextNodeId?: string;
  addTags?: string[];
}

export interface Branch {
  optionValue: string;
  nodes: FlowNode[];
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  questionType?: QuestionType;
  label?: string;
  options?: string[];
  required?: boolean;
  pinnedProductIds?: string[];
  showcaseLayout?: "grid" | "carousel";
  showcaseHeader?: string;
  showcaseSubheader?: string;
  ratingScaleLeft?: string;
  ratingScaleRight?: string;
  content?: string;
  header?: string;
  subheader?: string;
  buttonText?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  captureFields?: {
    name?: boolean;
    email?: boolean;
    phone?: boolean;
  };
  contactRequired?: boolean;
  hasPerk?: boolean;
  perk?: string;
  perkCode?: string;
  optionTags?: string[][];
  sections?: WelcomeSection[];
  nextNodeId?: string;
  conditionalNext?: ConditionalNext[];
  hasConditionalLogic?: boolean;
  branches?: Branch[];
  recommendationLogic?: {
    useTags: boolean;
    matchStrategy: "any" | "all" | "zone-first";
    limit?: number;
    zoneId?: string;
    fallbackToStaffPicks?: boolean;
  };
}

export interface Form {
  id: string;
  owner_id: string;
  name: string;
  internal_goal?: string;
  store_id?: string;
  zone_id?: string;
  flow_type?: FlowType;
  questions: FlowNode[];
  perk: string;
  active: boolean;
  capture_name: boolean;
  capture_email: boolean;
  capture_phone: boolean;
  show_start_page?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Response {
  id: string;
  form_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  answers: Record<string, any>;
  redemption_code: string;
  perk_redeemed: boolean;
  additional_feedback?: string;
  notes?: string;
  submitted_at: string;
  // Optional until Supabase types are regenerated after migration
  session_id?: string | null;
  form_snapshot?: Record<string, any> | null;
}

// New types for submission_answers and answer_revisions tables
// These live here until supabase gen types picks them up
export interface SubmissionAnswer {
  id: string;
  session_id: string | null;
  response_id: string;
  customer_id: string | null;
  form_id: string;
  question_id: string;
  question_label: string | null;
  answer_value: any;
  answered_at: string | null;
  created_at: string;
}

export interface AnswerRevision {
  id: string;
  session_id: string;
  form_id: string;
  block_id: string;
  node_id: string | null;
  question_label: string | null;
  previous_value: any;
  new_value: any;
  revision_number: number;
  revised_at: string;
}

export interface Profile {
  id: string;
  business_name: string;
  business_logo?: string;
  role?: "owner" | "staff";
  created_at: string;
  updated_at: string;
}

export interface QRFormData {
  id: string;
  name: string;
  internal_goal?: string;
  questions: FlowNode[];
  perk: string;
  active: boolean;
  captureName: boolean;
  captureEmail: boolean;
  capturePhone: boolean;
  businessName: string;
  businessLogo?: string;
}

export function generateRedemptionCode(): string {
  return "MIR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generateNodeId(): string {
  return "node-" + Math.random().toString(36).substring(2, 9);
}

export function createWelcomeNode(): FlowNode {
  return {
    id: generateNodeId(),
    type: "welcome",
    header: "Welcome!",
    content: "We'd love your feedback.",
    buttonText: "Get Started",
  };
}

export function createCompleteNode(): FlowNode {
  return {
    id: generateNodeId(),
    type: "complete",
    header: "Thank You!",
    content: "Thanks for helping shape what we do next.",
    hasPerk: false,
    perk: "",
  };
}

export function createCustomerInfoNode(): FlowNode {
  return {
    id: generateNodeId(),
    type: "customer-info",
    content: "Almost done! Share your info to claim your reward.",
    captureFields: {
      name: true,
      email: true,
      phone: true,
    },
    contactRequired: false,
  };
}

export interface Customer {
  id: string;
  store_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  traits: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CustomerTag {
  id: string;
  store_id: string;
  customer_id?: string;
  session_id: string;
  tag_id: string;
  source?: string;
  created_at: string;
}

export type InteractionEventType =
  | "qr_scan"
  | "quiz_answer"
  | "product_shown"
  | "item_saved"
  | "identity_captured";

export interface Interaction {
  id: string;
  store_id: string;
  customer_id?: string;
  session_id: string;
  event_type: InteractionEventType | string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface SavedItem {
  id: string;
  store_id: string | null;
  customer_id: string | null;
  session_id: string;
  product_id: string;
  created_at: string;
  purchased_at?: string | null;

  // Populated when fetched with the products join
  products?: {
    id: string;
    name: string;
    price: number | null;
    imageurl: string | null;
    description: string | null;
    sku: string | null;
  } | null;
}

export type IntegrationPlatform = "squarespace" | "lightspeed" | "shopify";

export interface StoreIntegration {
  id: string;
  store_id: string;
  platform: IntegrationPlatform;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export type FormData = {
  id: string;
  name: string;
  perk: string;
  questions: FlowNode[];
  capture_name: boolean;
  capture_email: boolean;
  capture_phone: boolean;
  active: boolean;
  store_id?: string;
  show_start_page?: boolean;
};

export type ProfileData = {
  business_name: string;
  business_logo: string | null;
};
