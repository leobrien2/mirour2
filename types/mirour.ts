// Mirour Type Definitions

export type FlowNodeType =
  | "welcome"
  | "message"
  | "question"
  | "customer-info"
  | "recommendation"
  | "product-showcase" // ← NEW
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

// Section types for customizable welcome/complete pages
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
  zone_what?: string; // What is this zone about? (1 sentence)
  zone_when?: string; // When to explore this zone? (1 sentence)
  zone_who?: string; // Who is this for? (1 sentence)
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  store_id: string;
  name: string;
  category?: string;
  is_hard_constraint?: boolean; // NEW: True for strict requirements (No-sugar, THC-free), false for preferences (Social, Calm)
  created_at: string;
}

export interface Product {
  id: string;
  owner_id: string; // NEW: Global owner of the product
  store_id?: string; // DEPRECATED: Retained temporarily for backward compatibility
  store_ids?: string[]; // NEW: Hydrated array of store IDs
  zone_id?: string; // Optional zone assignment for zone-first filtering
  name: string;
  description?: string;
  image_url?: string;
  sku?: string;
  price?: number;
  in_stock: boolean;
  is_staff_pick?: boolean; // True for fallback recommendations
  tags?: Tag[]; // Hydrated tags
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
  // For content sections
  text?: string;
  imageUrl?: string;
  // For link sections
  linkUrl?: string;
  linkTitle?: string;
  // For options sections (multiple choice that routes to flow)
  options?: { label: string; targetNodeId?: string }[];
  // For product sections
  products?: ProductItem[];
}

// Helper to generate section IDs
export function generateSectionId(): string {
  return "section-" + Math.random().toString(36).substring(2, 9);
}

export interface ConditionalNext {
  optionValue: string;
  nextNodeId?: string;
  // New: Tagging logic
  addTags?: string[]; // Tag IDs to add if this option is selected
}

// Branch represents a conditional path with its own sequence of nodes
export interface Branch {
  optionValue: string;
  nodes: FlowNode[];
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;

  // For questions
  questionType?: QuestionType;
  label?: string;
  options?: string[];
  required?: boolean;

  pinnedProductIds?: string[]; // ordered list of selected product IDs
  showcaseLayout?: "grid" | "carousel"; // display style on customer screen
  showcaseHeader?: string; // optional section header
  showcaseSubheader?: string; // optional section subheader

  // For rating scale labels
  ratingScaleLeft?: string;
  ratingScaleRight?: string;

  // For messages/welcome/ending content
  content?: string;
  header?: string; // Header text for content cards
  subheader?: string; // Subheader text for content cards
  buttonText?: string;
  imageUrl?: string; // Optional image for message/content cards

  // External link for content cards
  linkUrl?: string;
  linkTitle?: string;

  // For customer-info node
  captureFields?: {
    name?: boolean;
    email?: boolean;
    phone?: boolean;
  };
  contactRequired?: boolean; // If true, user cannot skip contact info

  // For complete page
  hasPerk?: boolean;
  perk?: string;
  perkCode?: string; // Brand's custom redemption code for their POS

  // Score-based result routing (for quiz results)
  isScoreResult?: boolean;
  scoreThreshold?: { min: number; max: number };

  // Quiz scoring - points for each option (parallel to options array)
  optionScores?: number[];

  // Customizable sections for welcome/complete pages
  sections?: WelcomeSection[];

  // Flow control
  nextNodeId?: string;
  conditionalNext?: ConditionalNext[];
  hasConditionalLogic?: boolean;

  // Visual branching - each option can have its own child nodes
  branches?: Branch[];

  // Recommendation Node Actions
  recommendationLogic?: {
    useTags: boolean; // Match products based on accumulated tags
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

  // New fields
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
  submitted_at: string;
}

export interface Profile {
  id: string;
  business_name: string;
  business_logo?: string;
  role?: "owner" | "staff";
  created_at: string;
  updated_at: string;
}

// Form data encoded in QR codes
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

// Helper to generate redemption codes
export function generateRedemptionCode(): string {
  return "MIR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper to generate unique node IDs
export function generateNodeId(): string {
  return "node-" + Math.random().toString(36).substring(2, 9);
}

// Create default welcome node
export function createWelcomeNode(): FlowNode {
  return {
    id: generateNodeId(),
    type: "welcome",
    header: "Welcome!",
    content: "We'd love your feedback.",
    buttonText: "Get Started",
  };
}

// Create default complete node
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

// Existing Customer Info Node
export function createCustomerInfoNode(): FlowNode {
  return {
    id: generateNodeId(),
    type: "customer-info",
    content: "Almost done! Share your info to claim your reward.",
    captureFields: {
      name: true,
      email: true,
      phone: false,
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
  traits: Record<string, any>; // Stores legacy profile traits, maybe used less now with append-only tags
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
  store_id: string;
  customer_id?: string;
  session_id: string;
  product_id: string;
  created_at: string;
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
