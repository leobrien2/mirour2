import { Mistral } from "@mistralai/mistralai";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { flowLog } from "@/lib/flowLogger";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// ── Types ────────────────────────────────────────────────────────────────────
interface StoreTag {
  id: string;
  name: string;
}

// ── Dynamic system prompt builder ────────────────────────────────────────────
function buildSystemPrompt(storeTags: StoreTag[]): string {
  const hasStoreTags = storeTags.length > 0;

  const tagsSection = hasStoreTags
    ? `━━━ AVAILABLE PRODUCT TAGS (use these to tag SELECT options) ━━━
These tags exist in the store's product catalog. Your job is to match them
semantically to SELECT option labels and assign the correct tag IDs.

Available tags:
${storeTags.map((t) => `  • "${t.name}"  →  id: "${t.id}"`).join("\n")}

TAGGING RULES:
- Only use tag IDs from the list above. Never invent tag IDs.
- Assign tags to SELECT options when the option semantically represents a product category.
  Example: option "Dry Skin" → tags: ["${storeTags[0]?.id ?? "tag_id"}"]
- Multiple tags per option are allowed if multiple tags match.
- If no tag clearly matches an option, use: "tags": []
- Do NOT assign tags on outcome/terminal step options — only on question steps.
- COVERAGE RULE: Every semantically meaningful option MUST attempt tag assignment.
  Do NOT leave options with tags:[] if ANY tag plausibly matches. Be VERY liberal.
  This includes abstract personality / lifestyle labels — map them to product vibes:
    "The Life of the Party"       → colorful, handmade, Marbled, hand-marbled, Featured
    "The Creative Professional"   → minimalist, modern, leather, Laptop, organization
    "The Legacy Seeker"           → handmade, leather, full-grain-leather, classic, Premium
    "Always on the go"            → everyday-carry, compact, fanny-pack, sling
    "Bold and expressive"         → colorful, Marbled, hand-marbled, handmade
    "Practical and minimal"       → minimalist, modern, organization, compact
    "Durability / lasts forever"  → leather, full-grain-leather, Natural Leather Product,
                                    vegetable tanned, vegetable-tanned, handmade
    "Boring / no personality"     → colorful, Marbled, hand-marbled, handmade
    "Can't fit tech + drinks"     → Backpack, Bag, everyday-carry, organization, Laptop
  When in doubt, assign. An over-tagged option is far better than tags:[].

`
    : `━━━ PRODUCT TAGS ━━━
No store tags available. Always use: "tags": []

`;

  return `You are an AI Flow Architect for "Mirour" — a retail quiz and form builder.
Users describe a customer quiz, branching form, or lead capture flow in plain English
OR as a structured outline. You generate a CanvasFlow JSON.

━━━ OUTPUT FORMAT ━━━
Output ONLY valid JSON. No markdown. No code fences. No explanation.

→ Ask for clarification:  { "type": "question", "content": "One focused question here." }
→ Generate a flow:        { "type": "flow", "data": { ...CanvasFlow } }

━━━ WHEN TO ASK A CLARIFYING QUESTION ━━━
Ask ONE question (not multiple) when:
1. The goal/outcome of the flow is completely unclear (what should happen at the end?)
2. The branching logic is ambiguous (do all options go to the same place, or diverge?)
3. You don't know the CTA URL/destination for outcome steps
4. The number of outcome paths is genuinely unclear

If you have enough to make reasonable assumptions, GENERATE the flow and note assumptions.
Never ask more than one question per turn.

━━━ INPUT HANDLING ━━━
Handle all of these seamlessly:
1. Plain English: "Create a skincare quiz that recommends products by skin type"
2. Structured outline:
   Title: ...
   Q1: ...  · Option A → outcome X  · Option B → Q2
3. Existing JSON flow (modification/fixing)
4. Hybrid: partial description + extra instructions

Preserve the user's exact wording for questions, options, and outcome messages.

${tagsSection}━━━ CANVASFLOW SCHEMA ━━━

CanvasFlow:
{
  "id": "flow_<8-char-slug>",
  "name": "Short descriptive name",
  "steps": [ ...CanvasStep[] ]
}

CanvasStep:
{
  "id": "step_<descriptive_slug>",
  "label": "Short readable label (sidebar)",
  "blocks": [ ...CanvasBlock[] ],
  "nextStepId": "step_id"   ← OMIT on terminal steps; OMIT when ALL routing is via option.nextStepId
}

CanvasBlock:
{
  "id": "block_<descriptive_slug>",
  "data": BlockData
}

━━━ BLOCK TYPES ━━━

HEADING:
{ "type": "h1"|"h2"|"h3", "text": string, "align": "left"|"center"|"right" }

PARAGRAPH:
{ "type": "paragraph", "text": string, "align": "left"|"center"|"right", "fontSize": 14 }
⚠ NEVER use **bold**, *italic*, or any markdown inside text fields — the platform renders
  plain text only. Write "Use code GLAD10" not "Use code **GLAD10**".

IMAGE:
{ "type": "image", "src": "", "alt": "", "fit": "cover", "aspectRatio": "16:9", "borderRadius": 8 }

SELECT ← primary branching + tagging block:
{
  "type": "select",
  "question": "",
  "selectionMode": "single" | "multi",
  "layout": "list" | "grid",
  "options": [
    {
      "id": "opt_<slug>",
      "label": string,
      "tags": [],
      "nextStepId": "step_id" ← ONLY set when THIS option routes differently from the default
                               ← OMIT ENTIRELY when not needed — never set to null
    }
  ]
}

CONTACT ← ALWAYS use this for any user identity / data capture:
{
  "type": "contact",
  "heading": string,
  "fields": {
    "firstName": { "enabled": true,  "required": true  },
    "lastName":  { "enabled": true,  "required": false },
    "email":     { "enabled": true,  "required": true  },
    "phone":     { "enabled": false, "required": false }
  },
  "submitLabel": "Continue",
  "nextStepId": "step_id",
  "showSkip": false,
  "skipLabel": "Skip"
}

TEXT INPUT ← ONLY for open-ended freeform answers (NOT for email/name/phone):
{ "type": "text-input", "question": string, "placeholder": string, "required": false, "multiline": false, "submitLabel": "Next" }

RATING:
{ "type": "rating", "question": string, "ratingType": "stars"|"thumbs", "maxStars": 5, "minLabel": "", "maxLabel": "", "required": false }

BUTTON:
{
  "type": "button",
  "label": string,
  "action": "link" | "next-step",
  "href": "/collections/all",   ← for "link" buttons: ALWAYS set a real path, never "" or null
  "nextStepId": "...",          ← for "next-step" buttons: MUST match step.nextStepId (RULE 7)
  "variant": "filled" | "outline" | "ghost",
  "align": "left" | "center" | "right",
  "borderRadius": 8,
  "fullWidth": true | false
}

PRODUCTS ← for recommendation / result steps:
{
  "type": "products",
  "mode": "tagged",
  "layout": "grid" | "list",
  "heading": "",
  "resultLimit": 6,
  "matchStrategy": "any",
  "showAddToCart": true,
  "showProductTags": false,
  "fallbackMessage": "We couldn't find exact matches — explore our full range below."
}

DIVIDER: { "type": "divider", "thickness": 1, "style": "solid" }
SPACER:  { "type": "spacer", "height": 24 }

AI-SEARCH ← inline semantic product search bar, user types freely:
{
  "type": "ai-search",
  "heading": "Find your perfect match",        ← optional heading above the search bar
  "description": "Describe what you're looking for", ← optional sub-copy
  "placeholder": "e.g. something cozy for winter",
  "resultLimit": 8,                             ← how many results to show (4–20)
  "showPrices": false                           ← whether to show price on result cards
}
When to use: Add an ai-search block on any step where the user should be able to
discover products by describing them in natural language. Great for open-ended
"explore" or browsing steps. Do NOT add it on terminal/outcome steps that already
have a products block — they serve different purposes.

━━━ SELECT QUESTION RULE — NO DUPLICATE RENDERING ━━━

The select block's "question" field renders as a visible sub-label ABOVE the options.
An h1/h2/h3 block on the same step ALSO renders visibly above the options.

RULE: If the step already has an h1/h2/h3 block with the question text → set select.question = ""
      If there is NO heading block on the step → put the question in select.question.

━━━ CONTACT vs TEXT-INPUT — CRITICAL DISTINCTION ━━━

CONTACT block — use when collecting ANY user identity data:
  ✅ Email address / Name / Phone number / Lead capture / Discount delivery
  Enable only the fields you need; set contact.nextStepId when a step follows.

TEXT-INPUT block — ONLY for qualitative / freeform answers:
  ✅ "What's on your mind?" / open-ended questions / feedback
  ❌ NEVER use for email, name, or phone — use contact block instead

━━━ ROUTING RULES (CRITICAL — READ ALL 8) ━━━

RULE 1 — Linear (all options → same next step):
  step.nextStepId = "step_q2"
  options: NO nextStepId on any option — omit it entirely on every option

RULE 2 — Full branch (every option diverges to a DIFFERENT step):
  step.nextStepId = OMIT entirely
  Every option MUST have nextStepId pointing to its OWN UNIQUE target
  ⚠ ALL option targets must be DIFFERENT. If they're all the same, use RULE 1 instead.

RULE 3 — Mixed branch (most options share a target, one diverges):
  step.nextStepId = "step_common"
  Only the diverging option has nextStepId = "step_special"

RULE 4 — Terminal steps (outcomes / end screens):
  OMIT step.nextStepId entirely
  ONLY "link" buttons allowed — no "next-step" buttons whatsoever

RULE 5 — No dangling references:
  Every nextStepId (step OR option OR block) MUST match an existing step.id in this flow

RULE 6 — No "Start Over" buttons:
  Never generate buttons with label containing: "start over", "restart", "try again", "reset", "begin again"

RULE 7 — Button nextStepId on welcome/intro steps:
  button.nextStepId MUST be present AND must exactly match step.nextStepId

RULE 8 — Contact block routing (CRITICAL):
  The contact block's onAdvance fires as: contact.nextStepId ?? step.nextStepId
  → If a results/products step follows contact capture, you MUST set BOTH:
      contact block's "nextStepId": "step_results"  AND  step-level "nextStepId": "step_results"
  → NEVER leave both undefined when another step must follow contact submission.
  → Contact is terminal ONLY when it is the last step in the entire flow.
  → Always include the phone field in the contact block and keep make it required.
  → NEVER set nextStepId to null — OMIT the key entirely if not needed.

 

━━━ STEP LAYOUT GUIDE ━━━

Welcome / intro step:
  h1 → paragraph → button (action:"next-step", variant:"filled", fullWidth:true)
  step.nextStepId = first question step
  button.nextStepId MUST equal step.nextStepId (RULE 7)

Question step (single-select):
  h2 → select block (select.question = "" since h2 carries the text)
  NO submit button — single-select auto-advances on pick

Question step (multi-select):
  h2 → select block (select.question = "") → button (label:"Continue", action:"next-step", variant:"filled")

Recommendation / result step:
  h2 → paragraph → spacer → products block (mode:"tagged")
  OMIT step.nextStepId (terminal)
  ALWAYS add a products block on any step whose purpose is to show recommendations.

Contact capture step:
  h2 → paragraph → spacer → contact block
  contact.nextStepId = next step id   ← ALWAYS set this
  step.nextStepId = same value        ← set BOTH for safety
  ONLY omit both when this is the absolute last step in the flow.

Outcome / terminal step (non-product):
  h2 → paragraph → spacer → button (action:"link", href:"/collections/all", variant:"filled", fullWidth:true)
  NO step.nextStepId. NO next-step buttons.

━━━ ARCHITECTURE RULES — READ CAREFULLY ━━━

RULE A — ONE reveal step vs MANY reveal steps:

  ONE reveal step (recommended for most flows):
    Use when all paths merge before the reveal (e.g. through contact).
    The products block uses accumulatedTags from ALL options picked — no branching needed.
    Contact → single reveal step. Simple and correct.

  MANY reveal steps (ONLY when paths branch BEFORE contact):
    Use when different problem options lead to truly different product sets.
    ⚠ If you create N reveal steps, you MUST have N different option.nextStepId values
      on the branching step pointing to each reveal step.
    ⚠ EVERY reveal step must be reachable via at least one routing path.
    ⚠ You CANNOT branch at problem_filter to reveal if personality_filter or contact
      sits between them — those intermediate steps collapse the branch.
    ⚠ In a merged flow (problem → personality → contact → reveal), there can only be
      ONE reveal step. Do not create multiple reveal steps in a merged flow.

  RULE OF THUMB: If contact comes BEFORE reveal, use exactly ONE reveal step.

RULE B — No unreachable steps:
  Every step except steps[0] must be pointed to by at least one nextStepId.
  Before outputting, trace every step's inbound paths. If a step has no inbound
  path, delete it or fix the routing — never output unreachable steps.

━━━ NO TEMPLATE / PLACEHOLDER SYNTAX ━━━
NEVER use {variable}, {{variable}}, [variable], [placeholder], or ANY bracket/brace syntax.
NEVER use **bold**, *italic*, or any other markdown in text fields.
The platform renders everything as literal plain text.

WRONG: "Use code **GLAD10**"   WRONG: "You're a {profile_name}"   WRONG: "/collections/{cat}"
RIGHT: "Use code GLAD10"        RIGHT: "Here's your match"          RIGHT: "/collections/all"

━━━ NO INTERACTIVE CHECKBOX BLOCK ━━━
There is NO checkbox block type. Use a PARAGRAPH block for consent/disclaimer text.

━━━ DYNAMIC PRODUCTS EXPLAINED ━━━
The products block with mode:"tagged" works at runtime:
  1. User picks options throughout the quiz
  2. All tags from every picked option → accumulatedTags[]
  3. Products block queries /api/products/by-tags with those tags
  4. Matching products shown automatically

This is WHY you tag SELECT options. Tags accumulate across ALL steps.
One products block on the final reveal is sufficient — it already has all tags.

━━━ SELF-CHECK BEFORE OUTPUT ━━━
Verify ALL of these before returning:
[ ] Every non-terminal step has: step.nextStepId OR every option has option.nextStepId
[ ] Every nextStepId (step + option + button + contact block) matches a real step.id
[ ] Tags only contain IDs from AVAILABLE TAGS (or [] if none match)
[ ] Zero "Start Over / Restart / Reset" buttons exist
[ ] Terminal steps have no step.nextStepId and no next-step buttons
[ ] Single-select steps have no submit button
[ ] Welcome step: button.nextStepId is present AND equals step.nextStepId (RULE 7)
[ ] No {variable}, {{variable}}, [variable] or placeholder syntax in any text/href/label
[ ] No **bold** or *italic* markdown in any text field
[ ] Any recommendation/result step has a products block with mode:"tagged"
[ ] Every step (except steps[0]) is pointed to by at least one nextStepId — NO DEAD STEPS
[ ] No option has nextStepId set to null — either a real step id or the key is OMITTED
[ ] Linear steps (RULE 1): options have NO nextStepId — only step.nextStepId is set
[ ] If a contact step is followed by another step, contact.nextStepId is set on the contact block
[ ] All semantically meaningful SELECT options have attempted tag assignment
[ ] Outcome headings use generic language unless the flow explicitly branches to named outcomes
[ ] select.question = "" when an h1/h2/h3 on the same step already shows the question text
[ ] If contact comes before reveal: exactly ONE reveal step exists
[ ] All link buttons have a non-empty href (use "/collections/all" as default)
[ ] Count reveal steps — trace every reveal step's inbound path, confirm all are reachable
[ ] ai-search block (if used) has a heading and placeholder; resultLimit is between 4 and 20
`;
}

// ── Routing validator ────────────────────────────────────────────────────────
function validateAndRepairRouting(steps: any[]): any[] {
  const validStepIds = new Set(steps.map((s: any) => s.id));

  // ── FIX D: Detect unreachable steps ────────────────────────────────────────
  // Build a set of all step IDs that are reachable from some routing reference.
  const reachableStepIds = new Set<string>();
  reachableStepIds.add(steps[0]?.id); // steps[0] is always the entry point

  for (const step of steps) {
    if (step.nextStepId) reachableStepIds.add(step.nextStepId);
    for (const block of step.blocks ?? []) {
      const data = block.data;
      if (!data) continue;
      if (data.nextStepId) reachableStepIds.add(data.nextStepId);
      if (data.type === "select") {
        for (const opt of data.options ?? []) {
          if (opt.nextStepId) reachableStepIds.add(opt.nextStepId);
        }
      }
    }
  }

  for (const step of steps) {
    if (!reachableStepIds.has(step.id)) {
      flowLog(
        "ROUTING_WARN_UNREACHABLE_STEP",
        { stepId: step.id, label: step.label },
        "warn",
      );
    }
  }
  // ── END FIX D ──────────────────────────────────────────────────────────────

  return steps.map((step: any, stepIndex: number) => {
    const selectBlocks = (step.blocks ?? []).filter(
      (b: any) => b.data?.type === "select",
    );
    const hasSelectBlock = selectBlocks.length > 0;
    const hasContactBlock = (step.blocks ?? []).some(
      (b: any) => b.data?.type === "contact",
    );

    const isTerminal = !step.nextStepId && !hasSelectBlock && !hasContactBlock;

    if (!isTerminal && hasSelectBlock) {
      for (const block of selectBlocks) {
        const options: any[] = block.data?.options ?? [];
        const allHaveNext = options.every((o) => o.nextStepId);
        const noneHaveNext = options.every((o) => !o.nextStepId);

        // Mixed routing with no step-level fallback → auto-assign most common target
        if (!allHaveNext && !noneHaveNext && !step.nextStepId) {
          const targets = options
            .filter((o) => o.nextStepId)
            .map((o) => o.nextStepId);
          const frequency: Record<string, number> = {};
          for (const t of targets) frequency[t] = (frequency[t] ?? 0) + 1;
          const mostCommon = Object.entries(frequency).sort(
            (a, b) => b[1] - a[1],
          )[0]?.[0];
          if (mostCommon && validStepIds.has(mostCommon)) {
            step.nextStepId = mostCommon;
            flowLog(
              "ROUTING_REPAIR_ASSIGNED_FALLBACK",
              { stepId: step.id, mostCommon },
              "warn",
            );
          }
        }

        // ── RULE 1 auto-enforcement ───────────────────────────────────────────
        // All options share the same target and step.nextStepId is absent →
        // promote to step-level routing and strip option routes.
        if (!step.nextStepId && allHaveNext) {
          const allTargets = options.map((o: any) => o.nextStepId as string);
          const firstTarget = allTargets[0];
          const allSameTarget = allTargets.every((t) => t === firstTarget);

          if (allSameTarget && firstTarget && validStepIds.has(firstTarget)) {
            step.nextStepId = firstTarget;
            block.data.options = options.map((o: any) => {
              const cleaned = { ...o };
              delete cleaned.nextStepId;
              return cleaned;
            });
            flowLog(
              "ROUTING_REPAIR_RULE1_ENFORCED",
              { stepId: step.id, target: firstTarget },
              "warn",
            );
          }
        }

        // Strip redundant option routes when step.nextStepId already covers them
        if (step.nextStepId && allHaveNext) {
          const allSameAsStep = options.every(
            (o) => o.nextStepId === step.nextStepId,
          );
          if (allSameAsStep) {
            block.data.options = options.map((o: any) => {
              const cleaned = { ...o };
              delete cleaned.nextStepId;
              return cleaned;
            });
            flowLog(
              "ROUTING_REPAIR_STRIPPED_REDUNDANT_OPTION_ROUTES",
              { stepId: step.id, target: step.nextStepId },
              "warn",
            );
          }
        }
      }
    }

    // ── Contact block routing repair ──────────────────────────────────────────
    if (hasContactBlock) {
      const contactBlocks = (step.blocks ?? []).filter(
        (b: any) => b.data?.type === "contact",
      );
      for (const block of contactBlocks) {
        const blockHasRoute =
          block.data?.nextStepId && validStepIds.has(block.data.nextStepId);
        const stepHasRoute =
          step.nextStepId && validStepIds.has(step.nextStepId);

        if (!blockHasRoute && !stepHasRoute) {
          const nextStep = steps[stepIndex + 1];
          if (nextStep?.id && validStepIds.has(nextStep.id)) {
            step.nextStepId = nextStep.id;
            block.data.nextStepId = nextStep.id;
            flowLog(
              "ROUTING_REPAIR_CONTACT_ASSIGNED_NEXT",
              { stepId: step.id, assignedNextStepId: nextStep.id },
              "warn",
            );
          }
        }

        // Sync contact.nextStepId ↔ step.nextStepId when one is set and the other isn't
        if (
          !block.data?.nextStepId &&
          step.nextStepId &&
          validStepIds.has(step.nextStepId)
        ) {
          block.data.nextStepId = step.nextStepId;
          flowLog(
            "ROUTING_REPAIR_CONTACT_SYNCED_FROM_STEP",
            { stepId: step.id, nextStepId: step.nextStepId },
            "warn",
          );
        }
        if (
          block.data?.nextStepId &&
          !step.nextStepId &&
          validStepIds.has(block.data.nextStepId)
        ) {
          step.nextStepId = block.data.nextStepId;
          flowLog(
            "ROUTING_REPAIR_STEP_SYNCED_FROM_CONTACT",
            { stepId: step.id, nextStepId: block.data.nextStepId },
            "warn",
          );
        }

        if (
          block.data?.nextStepId &&
          !validStepIds.has(block.data.nextStepId)
        ) {
          flowLog(
            "ROUTING_REPAIR_REMOVED_DANGLING_CONTACT_ROUTE",
            { stepId: step.id, danglingId: block.data.nextStepId },
            "warn",
          );
          delete block.data.nextStepId;
        }
      }
    }

    // Remove dangling step.nextStepId
    if (step.nextStepId && !validStepIds.has(step.nextStepId)) {
      flowLog(
        "ROUTING_REPAIR_REMOVED_DANGLING",
        { stepId: step.id, danglingId: step.nextStepId },
        "warn",
      );
      delete step.nextStepId;
    }

    return step;
  });
}

// ── Template placeholder scrubber ─────────────────────────────────────────────
function stripTemplateSyntax(value: string): string {
  return value
    .replace(/\{\{[^}]*\}\}/g, "") // {{variable}}
    .replace(/\{[^}]+\}/g, "") // {variable}
    .replace(/\[[^\]]+\]/g, "") // [variable] / [placeholder]
    .replace(/\s{2,}/g, " ") // collapse double spaces
    .trim();
}

// ── FIX B: Strip markdown bold/italic from plain text ─────────────────────────
function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** → bold
    .replace(/\*([^*]+)\*/g, "$1") // *italic* → italic
    .replace(/`([^`]+)`/g, "$1") // `code` → code
    .replace(/__([^_]+)__/g, "$1") // __bold__ → bold
    .replace(/_([^_]+)_/g, "$1") // _italic_ → italic
    .trim();
}

function deduplicateStepQuestions(steps: any[]): any[] {
  const HEADING_TYPES = new Set(["h1", "h2", "h3"]);
  const QUESTION_BLOCK_TYPES = new Set(["select", "text-input", "rating"]);

  return steps.map((step: any) => {
    const blocks: any[] = step.blocks ?? [];

    const headingTexts = new Set<string>(
      blocks
        .map((b: any) => b.data)
        .filter((d: any) => d && HEADING_TYPES.has(d.type) && d.text)
        .map((d: any) => (d.text as string).trim().toLowerCase()),
    );

    if (headingTexts.size === 0) return step;

    const newBlocks = blocks.map((block: any) => {
      const data = block.data;
      if (!data || !QUESTION_BLOCK_TYPES.has(data.type)) return block;

      const q: string = (data.question ?? "").trim().toLowerCase();
      if (q && headingTexts.has(q)) {
        flowLog(
          "DEDUP_QUESTION_CLEARED",
          {
            stepId: step.id,
            blockType: data.type,
            duplicatedText: data.question,
          },
          "warn",
        );
        return { ...block, data: { ...data, question: "" } };
      }

      return block;
    });

    return { ...step, blocks: newBlocks };
  });
}

// ── Block scrubber ────────────────────────────────────────────────────────────
function scrubBlocks(
  blocks: any[],
  validStepIds: Set<string>,
  validTagIds: Set<string>,
  stepNextStepId?: string, // ← FIX A: passed from parent step for button inheritance
): any[] {
  return blocks
    .map((block: any) => {
      const data = block.data;
      if (!data) return block;

      // HEADINGS + PARAGRAPH: strip template syntax AND markdown from text
      if (
        ["h1", "h2", "h3", "paragraph"].includes(data.type) &&
        typeof data.text === "string"
      ) {
        // FIX B: strip markdown bold/italic first, then template syntax
        data.text = stripMarkdown(stripTemplateSyntax(data.text));
      }

      // SELECT: sanitize tags + validate option routing
      if (data.type === "select" && Array.isArray(data.options)) {
        data.options = data.options.map((opt: any) => {
          if (opt.nextStepId === null || opt.nextStepId === undefined) {
            delete opt.nextStepId;
          }

          if (validTagIds.size === 0) {
            opt.tags = [];
          } else {
            opt.tags = Array.isArray(opt.tags)
              ? opt.tags.filter((tid: string) => validTagIds.has(tid))
              : [];
          }

          if (opt.nextStepId && !validStepIds.has(opt.nextStepId)) {
            flowLog(
              "BLOCK_SCRUB_REMOVED_DANGLING_OPTION_ROUTE",
              { optionId: opt.id, danglingId: opt.nextStepId },
              "warn",
            );
            delete opt.nextStepId;
          }

          return opt;
        });

        if (typeof data.question === "string") {
          data.question = stripTemplateSyntax(data.question);
        }
      }

      // TEXT-INPUT + RATING: scrub question field
      if (
        (data.type === "text-input" || data.type === "rating") &&
        typeof data.question === "string"
      ) {
        data.question = stripTemplateSyntax(data.question);
      }

      // CONTACT: strip null nextStepId + validate route
      if (data.type === "contact") {
        if (data.nextStepId === null || data.nextStepId === undefined) {
          delete data.nextStepId;
        } else if (data.nextStepId && !validStepIds.has(data.nextStepId)) {
          flowLog(
            "BLOCK_SCRUB_REMOVED_DANGLING_CONTACT_ROUTE",
            { danglingId: data.nextStepId },
            "warn",
          );
          delete data.nextStepId;
        }

        if (data.skipNextStepId && !validStepIds.has(data.skipNextStepId)) {
          flowLog(
            "BLOCK_SCRUB_REMOVED_DANGLING_SKIP_ROUTE",
            { danglingId: data.skipNextStepId },
            "warn",
          );
          delete data.skipNextStepId;
        }
      }

      // BUTTON: strip restart buttons + fix dangling routes + strip template hrefs
      if (data.type === "button") {
        const label: string = (data.label ?? "").toLowerCase();
        const RESTART_PATTERNS = [
          "start over",
          "restart",
          "try again",
          "begin again",
          "reset",
        ];
        if (RESTART_PATTERNS.some((p) => label.includes(p))) {
          flowLog(
            "BLOCK_SCRUB_REMOVED_RESTART_BUTTON",
            { label: data.label },
            "warn",
          );
          return null;
        }

        // ── FIX A: Inherit step.nextStepId when next-step button is missing it ──
        if (data.action === "next-step" && !data.nextStepId && stepNextStepId) {
          if (validStepIds.has(stepNextStepId)) {
            data.nextStepId = stepNextStepId;
            flowLog(
              "BLOCK_SCRUB_BUTTON_INHERITED_STEP_NEXT",
              { label: data.label, inheritedNextStepId: stepNextStepId },
              "warn",
            );
          }
        }

        if (
          data.action === "next-step" &&
          data.nextStepId &&
          !validStepIds.has(data.nextStepId)
        ) {
          flowLog(
            "BLOCK_SCRUB_REMOVED_DANGLING_BUTTON_ROUTE",
            { label: data.label, danglingId: data.nextStepId },
            "warn",
          );
          delete data.nextStepId;
        }

        // Strip template placeholder patterns from href
        if (typeof data.href === "string") {
          const scrubbed = stripTemplateSyntax(data.href);
          if (scrubbed !== data.href) {
            flowLog(
              "BLOCK_SCRUB_STRIPPED_HREF_TEMPLATE",
              { oldHref: data.href, newHref: scrubbed || "/collections/all" },
              "warn",
            );
            data.href = scrubbed || "/collections/all";
          }
          // ── FIX C: Replace empty href on link buttons ───────────────────────
          if (
            data.action === "link" &&
            (!data.href || data.href.trim() === "" || data.href === "#")
          ) {
            flowLog(
              "BLOCK_SCRUB_FIXED_EMPTY_HREF",
              { label: data.label, oldHref: data.href },
              "warn",
            );
            data.href = "/collections/all";
          }
        } else if (data.action === "link") {
          // href key missing entirely on a link button
          data.href = "/collections/all";
          flowLog(
            "BLOCK_SCRUB_ADDED_DEFAULT_HREF",
            { label: data.label },
            "warn",
          );
        }

        // Strip template syntax from button label
        if (typeof data.label === "string") {
          data.label = stripMarkdown(stripTemplateSyntax(data.label));
        }
      }

      // AI-SEARCH: sanitize fields
      if (data.type === "ai-search") {
        if (typeof data.heading === "string") {
          data.heading = stripMarkdown(stripTemplateSyntax(data.heading));
        }
        if (typeof data.description === "string") {
          data.description = stripMarkdown(
            stripTemplateSyntax(data.description),
          );
        }
        if (typeof data.placeholder === "string") {
          data.placeholder = stripTemplateSyntax(data.placeholder);
        }
        // Clamp resultLimit to safe range
        if (typeof data.resultLimit === "number") {
          data.resultLimit = Math.min(20, Math.max(4, data.resultLimit));
        } else {
          data.resultLimit = 8;
        }
      }

      return block;
    })
    .filter(Boolean);
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { messages, storeId, owner_id } = await req.json();
    flowLog("AI_GENERATE_FLOW_START", { storeId, messages }, "info");

    if (!process.env.MISTRAL_API_KEY) {
      flowLog("MISTRAL_API_KEY_MISSING", null, "error");
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 },
      );
    }

    console.log("storeId", storeId);
    console.log("messages", messages);

    // ── Fetch store tags ──────────────────────────────────────────────────────
    let storeTags: StoreTag[] = [];

    flowLog("OWNER_ID_FETCHED", { owner_id }, "info");
    console.log("owner_id", owner_id);

    if (owner_id) {
      try {
        let query = supabase
          .from("tags")
          .select("id, name")
          .order("name", { ascending: true });

        if (owner_id) {
          query = query.eq("owner_id", owner_id);
        } else if (storeId) {
          query = query.eq("store_id", storeId);
        }

        flowLog("STORE_TAGS_QUERY", { owner_id, storeId }, "db_read", "tags");

        const { data, error } = await query;
        console.log("data", data);

        if (!error && data) storeTags = data as StoreTag[];

        if (error) {
          flowLog(
            "STORE_TAGS_ERROR",
            { error, owner_id, storeId },
            "error",
            "tags",
          );
        } else {
          flowLog(
            "STORE_TAGS_FETCHED",
            { count: storeTags.length, tags: storeTags },
            "db_read",
            "tags",
          );
        }

        console.log(
          `[generate-flow] Fetched ${storeTags.length} tags for`,
          owner_id ? `owner ${owner_id}` : `store ${storeId}`,
        );
      } catch (e) {
        console.warn("[generate-flow] Tag fetch failed (non-fatal):", e);
      }
    } else {
      console.warn(
        "[generate-flow] No owner_id or storeId — skipping tag fetch",
      );
      flowLog("NO_OWNER_OR_STORE_ID", { owner_id, storeId }, "warn");
    }

    console.log("storeTags", storeTags);
    const systemPrompt = buildSystemPrompt(storeTags);
    const validTagIds = new Set(storeTags.map((t) => t.id));
    console.log("validTagIds", validTagIds);

    const chatResponse = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      responseFormat: { type: "json_object" },
    });

    const content = chatResponse.choices[0].message.content as string;

    let result: any;
    try {
      result = JSON.parse(content);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid AI response — could not parse JSON" },
        { status: 500 },
      );
    }

    // ── Post-processing safety pass ───────────────────────────────────────────
    if (result.type === "flow" && Array.isArray(result.data?.steps)) {
      result.data.id = result.data.id || `flow_${uuidv4().slice(0, 8)}`;

      const usedIds = new Set<string>();

      result.data.steps = (result.data.steps as any[]).map((step: any) => {
        if (!step.id || usedIds.has(step.id)) {
          step.id = `step_${uuidv4().slice(0, 8)}`;
        }
        usedIds.add(step.id);

        step.blocks = (step.blocks ?? []).map((block: any) => {
          let blockId = block.id;
          if (!blockId || usedIds.has(blockId)) {
            blockId = `block_${uuidv4().slice(0, 8)}`;
          }
          usedIds.add(blockId);

          if (
            block.data?.type === "select" &&
            Array.isArray(block.data?.options)
          ) {
            block.data.options = block.data.options.map((opt: any) => {
              let optId = opt.id;
              if (!optId || usedIds.has(optId)) {
                optId = `opt_${uuidv4().slice(0, 8)}`;
              }
              usedIds.add(optId);
              return { ...opt, id: optId };
            });
          }

          return { ...block, id: blockId };
        });

        return step;
      });

      const validStepIds = new Set(
        (result.data.steps as any[]).map((s: any) => s.id),
      );

      // 1. Validate + repair routing
      result.data.steps = validateAndRepairRouting(result.data.steps);

      // 2. Deduplicate heading text vs select/text-input/rating .question field
      result.data.steps = deduplicateStepQuestions(result.data.steps);

      // 3. Scrub blocks
      result.data.steps = (result.data.steps as any[]).map((step: any) => ({
        ...step,
        blocks: scrubBlocks(
          step.blocks ?? [],
          validStepIds,
          validTagIds,
          step.nextStepId,
        ),
      }));

      result.tagsSummary =
        storeTags.length > 0
          ? `${storeTags.length} store tags available`
          : "No store tags — product filtering disabled";
    }

    flowLog("AI_GENERATE_FLOW_SUCCESS", result, "info");

    // FIX: Only log steps if the result is actually a flow and contains data.steps
    if (result.type === "flow" && Array.isArray(result.data?.steps)) {
      console.log("Steps", result.data.steps);
      result.data.steps.forEach((step: any) => {
        console.log("Step", JSON.stringify(step, null, 2));
      });
    } else {
      console.log("AI Clarification Question:", result.content);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[generate-flow] Error:", error);
    flowLog("AI_GENERATE_FLOW_ERROR", { error }, "error");
    return NextResponse.json(
      { error: "Failed to generate flow" },
      { status: 500 },
    );
  }
}