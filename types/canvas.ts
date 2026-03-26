// types/canvas.ts

// ── Device ────────────────────────────────────────────────────────────────────

export type DeviceView = "mobile" | "tablet" | "desktop";

export const DEVICE_WIDTHS: Record<DeviceView, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
};

// ── Shared primitives ─────────────────────────────────────────────────────────

export type TextAlign = "left" | "center" | "right";
export type ButtonVariant = "filled" | "outline" | "ghost";
export type ImageFit = "cover" | "contain";
export type AspectRatio = "1:1" | "16:9" | "4:3" | "3:2" | "auto";
export type ProductMatchStrategy = "any" | "all";

// ── Block data shapes ─────────────────────────────────────────────────────────

// ── Text ──────────────────────────────────────────────────────────────────────

export type HeadingBlockData = {
  type: "h1" | "h2" | "h3";
  text: string;
  align: TextAlign;
  color?: string; // undefined = hsl(var(--card-foreground))
};

export type ParagraphBlockData = {
  type: "paragraph";
  text: string;
  align: TextAlign;
  color?: string; // undefined = hsl(var(--card-foreground)/0.70)
  fontSize?: number;
};

// ── Media ─────────────────────────────────────────────────────────────────────

export type ImageBlockData = {
  type: "image";
  src: string;
  alt?: string;
  fit?: ImageFit;
  borderRadius?: number;
  aspectRatio?: AspectRatio;
  align?: TextAlign;
  width?: number;
  objectPosition?: string; // CSS object-position, e.g. "50% 50%", "top"
};

export type CarouselItem = {
  id: string;
  src: string;
  alt?: string;
  caption?: string;
};

export type CarouselBlockData = {
  type: "carousel";
  items: CarouselItem[];
  autoPlay?: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  aspectRatio?: AspectRatio;
  borderRadius?: number;
  align?: TextAlign;
  width?: number;
  objectPosition?: string; // CSS object-position applied to all slides
};

// ── Input — Select ────────────────────────────────────────────────────────────

export type SelectOption = {
  id: string;
  label: string;
  tags: string[]; // store product tags mapped to this option; [] = no tags
  nextStepId?: string; // undefined = proceed to next step in sequence
  imageUrl?: string; // optional card thumbnail
};

export type SelectBlockData = {
  type: "select";
  question: string;
  selectionMode: "single" | "multi";
  // single → auto-advances on pick
  // multi  → requires explicit "Next" button
  options: SelectOption[];
  layout: "list" | "grid"; // list = vertical rows, grid = 2-col cards
};

// ── Input — Contact capture ───────────────────────────────────────────────────

export type ContactFieldConfig = {
  enabled: boolean;
  required: boolean;
};

export type ContactBlockData = {
  type: "contact";
  heading?: string;
  fields: {
    firstName: ContactFieldConfig;
    lastName: ContactFieldConfig;
    email: ContactFieldConfig;
    phone: ContactFieldConfig;
  };
  submitLabel: string;
  nextStepId?: string;

  // ── Skip button ────────────────────────────────────────────
  showSkip?: boolean; // default false — skip button hidden
  skipLabel?: string; // default "Skip"
  skipNextStepId?: string; // undefined = next step in sequence
};



// ── Input — Text input ────────────────────────────────────────────────────────

export type TextInputBlockData = {
  type: "text-input";
  question: string; // prompt shown above the input
  placeholder?: string;
  required: boolean;
  multiline: boolean; // false = <input>, true = <textarea>
  submitLabel: string; // "Next" / "Continue"
};

// ── Input — Rating ────────────────────────────────────────────────────────────

export type RatingBlockData = {
  type: "rating";
  question: string;
  ratingType: "stars" | "thumbs";
  maxStars?: number; // default 5 — only applies when ratingType = "stars"
  minLabel?: string; // e.g. "Not at all" — shown below leftmost star
  maxLabel?: string; // e.g. "Absolutely" — shown below rightmost star
  required: boolean;
};

// ── Action — Button ───────────────────────────────────────────────────────────

export type ButtonBlockData = {
  type: "button";
  label: string;
  action: "link" | "next-step";
  // action = "link"      → opens href in new tab
  // action = "next-step" → advances flow to nextStepId (or next in sequence)
  href?: string; // used when action = "link"
  nextStepId?: string; // used when action = "next-step"; undefined = +1 step
  variant: ButtonVariant;
  align: TextAlign;
  bgColor?: string; // undefined = hsl(var(--primary))
  textColor?: string; // undefined = hsl(var(--primary-foreground))
  borderRadius?: number;
  fullWidth?: boolean;
};

// ── Products ──────────────────────────────────────────────────────────────────

export type PinnedProduct = {
  id: string;
  title: string; // cached for inspector display
  imageUrl?: string; // cached thumbnail
  price?: string; // cached price string e.g. "$24.99"
};

export type ProductsBlockData = {
  type: "products";
  mode: "tagged" | "manual";

  // ── Tagged mode (reads accumulated tags from all previous select blocks) ──
  matchStrategy?: ProductMatchStrategy; // default "any"
  resultLimit?: number; // default 4
  fallbackMessage?: string; // shown if 0 products match

  // ── Manual mode (pinned product IDs from store) ───────────────────────────
  pinnedProducts?: PinnedProduct[];

  // ── Shared display settings ───────────────────────────────────────────────
  heading?: string; // e.g. "Your matches", "We think you'll love these"
  layout: "grid" | "list";
  showAddToCart: boolean;
  showProductTags?: boolean; // show tag chips on each product card
};

// ── Layout ────────────────────────────────────────────────────────────────────

export type DividerBlockData = {
  type: "divider";
  color?: string; // undefined = hsl(var(--border))
  thickness?: number;
  style?: "solid" | "dashed" | "dotted";
};

export type SpacerBlockData = {
  type: "spacer";
  height: number;
};

// ── Union ─────────────────────────────────────────────────────────────────────

export type BlockData =
  | HeadingBlockData
  | ParagraphBlockData
  | ImageBlockData
  | CarouselBlockData
  | SelectBlockData
  | ContactBlockData
  | TextInputBlockData
  | RatingBlockData
  | ButtonBlockData
  | ProductsBlockData
  | DividerBlockData
  | SpacerBlockData;

export type BlockType = BlockData["type"];

// ── Canvas building blocks ────────────────────────────────────────────────────

export type CanvasBlock = {
  id: string;
  data: BlockData;
};

export type CanvasStep = {
  id: string;
  label: string;
  blocks: CanvasBlock[];
  nextStepId?: string; // default forward link (overridden by per-option routing)
  createdAt?: string;
};

export type CanvasFlow = {
  id: string;
  name: string;
  steps: CanvasStep[];
  createdAt?: string;
  updatedAt?: string;
};

// ── Runtime session (used by the preview player, not saved to DB) ─────────────

export type BlockSession = {
  blockId: string;
  selectedOptionIds: string[]; // for select blocks
  collectedTags: string[]; // flattened tags from selected options
  textValue?: string; // for text-input blocks
  ratingValue?: number; // for rating blocks
  contactValues?: {
    // for contact blocks
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
};

export type FlowSession = {
  visitedStepIds: string[]; // ordered — only steps user actually visited
  blocks: Record<string, BlockSession>; // blockId → session data
};

// Helper: collect all tags from a session (used by Products block)
export function collectSessionTags(session: FlowSession): string[] {
  const all: string[] = [];
  for (const b of Object.values(session.blocks)) {
    all.push(...b.collectedTags);
  }
  return [...new Set(all)]; // deduplicated
}

// ── Default block factory ─────────────────────────────────────────────────────

export function createDefaultBlock(type: BlockType): BlockData {
  switch (type) {
    // ── Text ──────────────────────────────────────────────────────────────────
    case "h1":
      return { type: "h1", text: "Your Heading", align: "left" };

    case "h2":
      return { type: "h2", text: "Subheading", align: "left" };

    case "h3":
      return { type: "h3", text: "Section Title", align: "left" };

    case "paragraph":
      return {
        type: "paragraph",
        text: "Add your description here. Click to edit this text.",
        align: "left",
        fontSize: 14,
      };

    // ── Media ─────────────────────────────────────────────────────────────────
    case "image":
      return {
        type: "image",
        src: "",
        alt: "",
        fit: "cover",
        aspectRatio: "16:9",
        borderRadius: 8,
        align: "center",
        width: 100,
      };

    case "carousel":
      return {
        type: "carousel",
        items: [],
        autoPlay: false,
        showDots: true,
        showArrows: true,
        aspectRatio: "16:9",
        borderRadius: 8,
        align: "center",
        width: 100,
      };

    // ── Input ─────────────────────────────────────────────────────────────────
    case "select":
      return {
        type: "select",
        question: "What are you looking for?",
        selectionMode: "single",
        layout: "list",
        options: [
          { id: crypto.randomUUID(), label: "Option 1", tags: [] },
          { id: crypto.randomUUID(), label: "Option 2", tags: [] },
          { id: crypto.randomUUID(), label: "Option 3", tags: [] },
        ],
      };

    case "contact":
      return {
        type: "contact",
        heading: "Almost there!",
        fields: {
          firstName: { enabled: true, required: true },
          lastName: { enabled: true, required: false },
          email: { enabled: true, required: true },
          phone: { enabled: true, required: true },
        },
        submitLabel: "Continue",
        showSkip: false, // ← hidden by default
        skipLabel: "Skip",
      };

    case "text-input":
      return {
        type: "text-input",
        question: "Tell us more",
        placeholder: "Type your answer here...",
        required: false,
        multiline: false,
        submitLabel: "Next",
      };

    case "rating":
      return {
        type: "rating",
        question: "How would you rate this?",
        ratingType: "stars",
        maxStars: 5,
        minLabel: "",
        maxLabel: "",
        required: false,
      };

    // ── Action ────────────────────────────────────────────────────────────────
    case "button":
      return {
        type: "button",
        label: "Click Here",
        action: "link",
        href: "",
        variant: "filled",
        align: "center",
        borderRadius: 8,
        fullWidth: false,
      };

    case "products":
      return {
        type: "products",
        mode: "tagged",
        matchStrategy: "any",
        resultLimit: 4,
        fallbackMessage: "No products found for your selection.",
        pinnedProducts: [],
        heading: "Your matches",
        layout: "grid",
        showAddToCart: true,
        showProductTags: false,
      };

    // ── Layout ────────────────────────────────────────────────────────────────
    case "divider":
      return { type: "divider", thickness: 1, style: "solid" };

    case "spacer":
      return { type: "spacer", height: 32 };

    default:
      return { type: "paragraph", text: "", align: "left" };
  }
}

// ── Block palette config ──────────────────────────────────────────────────────

export type PaletteItem = {
  type: BlockType;
  label: string;
  description: string;
  iconName: string;
};

export type PaletteGroup = {
  group: string;
  items: PaletteItem[];
};

export const BLOCK_PALETTE: PaletteGroup[] = [
  {
    group: "Text",
    items: [
      {
        type: "h1",
        label: "Heading 1",
        description: "Large title",
        iconName: "Heading1",
      },
      {
        type: "h2",
        label: "Heading 2",
        description: "Medium title",
        iconName: "Heading2",
      },
      {
        type: "h3",
        label: "Heading 3",
        description: "Small title",
        iconName: "Heading3",
      },
      {
        type: "paragraph",
        label: "Paragraph",
        description: "Body text",
        iconName: "AlignLeft",
      },
    ],
  },
  {
    group: "Media",
    items: [
      {
        type: "image",
        label: "Image",
        description: "Single image",
        iconName: "Image",
      },
      {
        type: "carousel",
        label: "Carousel",
        description: "Swipeable images",
        iconName: "GalleryHorizontal",
      },
    ],
  },
  {
    group: "Input",
    items: [
      {
        type: "select",
        label: "Select",
        description: "Single or multi choice",
        iconName: "ListChecks",
      },
      {
        type: "contact",
        label: "Contact",
        description: "Name, email, phone",
        iconName: "UserRound",
      },
      {
        type: "text-input",
        label: "Text Input",
        description: "Open-ended response",
        iconName: "MessageSquare",
      },
      {
        type: "rating",
        label: "Rating",
        description: "Stars or thumbs",
        iconName: "Star",
      },
    ],
  },
  {
    group: "Action",
    items: [
      {
        type: "button",
        label: "Button",
        description: "Link or next step",
        iconName: "MousePointer2",
      },
      {
        type: "products",
        label: "Products",
        description: "Tag-filtered or pinned",
        iconName: "ShoppingBag",
      },
    ],
  },
  {
    group: "Layout",
    items: [
      {
        type: "divider",
        label: "Divider",
        description: "Horizontal line",
        iconName: "Minus",
      },
      {
        type: "spacer",
        label: "Spacer",
        description: "Blank vertical gap",
        iconName: "ArrowUpDown",
      },
    ],
  },
];
