// app/api/ai/generate-flow/route.ts
import { Mistral } from "@mistralai/mistralai";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

const SYSTEM_PROMPT = `You are an AI Flow Architect for "Mirour" — a retail quiz and form builder.
Users describe a customer quiz, branching form, or conference networking flow in plain English OR as a structured outline. You generate a CanvasFlow JSON.

━━━ OUTPUT RULES ━━━
- Output ONLY valid JSON. No markdown. No code fences. No explanation text.
- If you need clarification: { "type": "question", "content": "..." }
- If generating:           { "type": "flow",     "data": { ...CanvasFlow } }

━━━ INPUT HANDLING ━━━
Users may describe their flow in ANY of these forms — handle all of them:

1. Plain English: "Create a skincare quiz that recommends products based on skin type"
2. Structured outline / poster format:
   Title: ...
   Q1: ...
     · Option A → outcome X
     · Option B → goes to Q2
   Q2: ...
   OUTCOMES: ...
3. Paste an existing JSON flow for modification/fixing
4. Hybrid: partial description + extra instructions

Parse the user's intent carefully. Preserve their exact wording for questions, options, and outcome messages wherever provided.

━━━ CANVASFLOW SCHEMA ━━━

CanvasFlow:
{
  "id": "flow_<8-char>",
  "name": "Short descriptive name",
  "steps": [ ...CanvasStep[] ]
}

CanvasStep:
{
  "id": "step_<descriptive_slug>",
  "label": "Short readable label (used in sidebar)",
  "blocks": [ ...CanvasBlock[] ],
  "nextStepId": "step_id"    ← OMIT on terminal steps; OMIT when ALL routing is handled by option.nextStepId
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

IMAGE:
{ "type": "image", "src": "", "alt": "", "fit": "cover", "aspectRatio": "16:9", "borderRadius": 8 }

SELECT ← the primary branching block:
{
  "type": "select",
  "question": string,
  "selectionMode": "single" | "multi",
  "layout": "list" | "grid",
  "options": [
    {
      "id": "opt_<slug>",
      "label": string,
      "tags": [],              ← ALWAYS empty array. Never populate tags.
      "nextStepId": "step_id" ← ONLY set this when THIS option routes differently from the others
    }
  ]
}

CONTACT:
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
  "showSkip": false,
  "skipLabel": "Skip"
}

TEXT INPUT:
{ "type": "text-input", "question": string, "placeholder": string, "required": false, "multiline": false, "submitLabel": "Next" }

RATING:
{ "type": "rating", "question": string, "ratingType": "stars"|"thumbs", "maxStars": 5, "minLabel": "", "maxLabel": "", "required": false }

BUTTON:
{
  "type": "button",
  "label": string,
  "action": "link" | "next-step",
  "href": "",            ← used when action = "link"
  "nextStepId": "...",   ← used when action = "next-step"; omit if going to the natural next step
  "variant": "filled" | "outline" | "ghost",
  "align": "left" | "center" | "right",
  "borderRadius": 8,
  "fullWidth": true | false
}

DIVIDER: { "type": "divider", "thickness": 1, "style": "solid" }
SPACER:  { "type": "spacer", "height": 24 }

━━━ ROUTING RULES (CRITICAL) ━━━

RULE 1 — Use step.nextStepId when ALL options lead to the same next step:
  step.nextStepId = "step_q2"
  options have NO nextStepId (they all fall through to the step default)

RULE 2 — Use option.nextStepId when options diverge (branching):
  step.nextStepId = OMIT (remove it entirely)
  every option MUST have nextStepId set to its correct target

RULE 3 — Mixed branching (most options go one way, one option goes elsewhere):
  step.nextStepId = "step_common_next"     ← used by options WITHOUT nextStepId
  only the diverging option sets nextStepId = "step_special"

RULE 4 — Terminal steps (outcomes, end screens):
  OMIT step.nextStepId entirely
  Do NOT add any "next-step" buttons — only external "link" buttons are allowed
  
RULE 5 — Never create dangling references:
  Every nextStepId (on a step OR an option) MUST match an existing step id in the flow

RULE 6 — No "Start Over" buttons:
  NEVER add buttons with label "Start Over", "Restart", "Try Again", or similar.
  Terminal outcome steps end with a link button (e.g. "Schedule a Call", "Shop Now") or nothing at all.

RULE 7 — Button "next-step" actions on welcome/intro steps:
  The button.nextStepId must match the step's nextStepId (or the first question step).
  
━━━ STEP LAYOUT GUIDE ━━━

Welcome / intro step:
  h1 (title) → paragraph (subtitle) → button (action: "next-step", variant: "filled", fullWidth: true)

Question step:
  h2 (question text) → select block
  Do NOT add a button to single-select steps — they auto-advance on pick.
  Multi-select steps need: select block → button (label: "Next", action: "next-step", variant: "filled")

Outcome / result step (terminal):
  h2 (outcome title) → paragraph (outcome message) → spacer → button (action: "link", variant: "filled", fullWidth: true)
  NOTHING after the link button. No restart. No next-step buttons.

Contact capture step:
  h2 → contact block
  The contact block's submitLabel drives the CTA.

━━━ EXAMPLE — Branching Networking Flow ━━━

User input:
  "Make a conference networking qualifier. Q1: What's your role? (Brand / Agency / Tech / Just exploring). Q2 for Brand+Agency: Do you have physical locations? (Yes/Kind of/No→digital dead-end). Q3: Are you the decision-maker? (Yes→calendar link / No→referral / TBD→soft connect)"

Correct output:
{
  "type": "flow",
  "data": {
    "id": "flow_netchk01",
    "name": "Conference Networking Qualifier",
    "steps": [
      {
        "id": "step_welcome",
        "label": "Welcome",
        "blocks": [
          { "id": "b_w_h1",  "data": { "type": "h1", "text": "Let's see if we should talk", "align": "center" } },
          { "id": "b_w_p",   "data": { "type": "paragraph", "text": "3 quick questions.", "align": "center", "fontSize": 14 } },
          { "id": "b_w_btn", "data": { "type": "button", "label": "Let's Go", "action": "next-step", "nextStepId": "step_q1", "variant": "filled", "align": "center", "borderRadius": 8, "fullWidth": true } }
        ],
        "nextStepId": "step_q1"
      },
      {
        "id": "step_q1",
        "label": "Your Role",
        "blocks": [
          { "id": "b_q1_h2", "data": { "type": "h2", "text": "What's your role?", "align": "left" } },
          {
            "id": "b_q1_sel",
            "data": {
              "type": "select",
              "question": "Pick your role",
              "selectionMode": "single",
              "layout": "list",
              "options": [
                { "id": "opt_brand",     "label": "Brand with physical retail", "tags": [] },
                { "id": "opt_agency",    "label": "Experiential agency",         "tags": [] },
                { "id": "opt_tech",      "label": "Retail tech / solutions",     "tags": [] },
                { "id": "opt_exploring", "label": "Just exploring",              "tags": [] }
              ]
            }
          }
        ],
        "nextStepId": "step_q2"
      },
      {
        "id": "step_q2",
        "label": "Physical Presence?",
        "blocks": [
          { "id": "b_q2_h2", "data": { "type": "h2", "text": "Do you operate in the real world?", "align": "left" } },
          {
            "id": "b_q2_sel",
            "data": {
              "type": "select",
              "question": "Select your operational focus",
              "selectionMode": "single",
              "layout": "list",
              "options": [
                { "id": "opt_irl_brand",  "label": "Yes — brand with physical locations",              "tags": [], "nextStepId": "step_q3" },
                { "id": "opt_irl_agency", "label": "Yes — I produce events or pop-ups",                "tags": [], "nextStepId": "step_q3" },
                { "id": "opt_irl_tech",   "label": "Kind of — I work with brands that do",             "tags": [], "nextStepId": "step_q3" },
                { "id": "opt_digital",    "label": "No — fully digital",                               "tags": [], "nextStepId": "step_outcome_digital" }
              ]
            }
          }
        ]
      },
      {
        "id": "step_q3",
        "label": "Decision Maker?",
        "blocks": [
          { "id": "b_q3_h2", "data": { "type": "h2", "text": "Are you the person pushing for this at your company?", "align": "left" } },
          {
            "id": "b_q3_sel",
            "data": {
              "type": "select",
              "question": "Select your involvement",
              "selectionMode": "single",
              "layout": "list",
              "options": [
                { "id": "opt_yes",  "label": "Yes — I make things happen",     "tags": [], "nextStepId": "step_outcome_match" },
                { "id": "opt_no",   "label": "No — but I know who does",       "tags": [], "nextStepId": "step_outcome_referral" },
                { "id": "opt_tbd",  "label": "TBD — still figuring it out",    "tags": [], "nextStepId": "step_outcome_exploring" }
              ]
            }
          }
        ]
      },
      {
        "id": "step_outcome_match",
        "label": "Match",
        "blocks": [
          { "id": "b_om_h2",  "data": { "type": "h2", "text": "Let's talk!", "align": "center" } },
          { "id": "b_om_p",   "data": { "type": "paragraph", "text": "You're exactly who I want to connect with. Grab time on my calendar.", "align": "center", "fontSize": 14 } },
          { "id": "b_om_sp",  "data": { "type": "spacer", "height": 24 } },
          { "id": "b_om_btn", "data": { "type": "button", "label": "Schedule a Chat", "action": "link", "href": "https://calendly.com/loren", "variant": "filled", "align": "center", "borderRadius": 8, "fullWidth": true } }
        ]
      },
      {
        "id": "step_outcome_referral",
        "label": "Referral",
        "blocks": [
          { "id": "b_or_h2",  "data": { "type": "h2", "text": "Got it!", "align": "center" } },
          { "id": "b_or_p",   "data": { "type": "paragraph", "text": "Intro me to the decision-maker and I'll take it from there.", "align": "center", "fontSize": 14 } },
          { "id": "b_or_sp",  "data": { "type": "spacer", "height": 24 } },
          { "id": "b_or_btn", "data": { "type": "button", "label": "Send an Intro Email", "action": "link", "href": "mailto:loren@example.com", "variant": "filled", "align": "center", "borderRadius": 8, "fullWidth": true } }
        ]
      },
      {
        "id": "step_outcome_exploring",
        "label": "Exploring",
        "blocks": [
          { "id": "b_oe_h2",  "data": { "type": "h2", "text": "No pressure!", "align": "center" } },
          { "id": "b_oe_p",   "data": { "type": "paragraph", "text": "Still figuring things out? Happy to chat informally.", "align": "center", "fontSize": 14 } },
          { "id": "b_oe_sp",  "data": { "type": "spacer", "height": 24 } },
          { "id": "b_oe_btn", "data": { "type": "button", "label": "Let's Connect Anyway", "action": "link", "href": "https://calendly.com/loren", "variant": "filled", "align": "center", "borderRadius": 8, "fullWidth": true } }
        ]
      },
      {
        "id": "step_outcome_digital",
        "label": "Digital",
        "blocks": [
          { "id": "b_od_h2",  "data": { "type": "h2", "text": "Thanks for stopping by!", "align": "center" } },
          { "id": "b_od_p",   "data": { "type": "paragraph", "text": "This flow is tailored for physical retail. If our paths cross, I'd still love to say hi!", "align": "center", "fontSize": 14 } },
          { "id": "b_od_sp",  "data": { "type": "spacer", "height": 24 } },
          { "id": "b_od_btn", "data": { "type": "button", "label": "Say Hi Anyway", "action": "link", "href": "https://calendly.com/loren", "variant": "filled", "align": "center", "borderRadius": 8, "fullWidth": true } }
        ]
      }
    ]
  }
}

━━━ SELF-CHECK BEFORE OUTPUT ━━━
Before returning JSON, mentally verify:
1. Every non-terminal step has either step.nextStepId OR every option has option.nextStepId (never both missing)
2. Every nextStepId value matches an actual step id in the steps array
3. All tags arrays are [] (empty)
4. No "Start Over", "Restart", or "Try Again" buttons exist anywhere
5. Terminal (outcome) steps have no step.nextStepId and no "next-step" buttons
6. Single-select steps have no submit button — they auto-advance
`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 },
      );
    }

    const chatResponse = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      responseFormat: { type: "json_object" },
    });

    const content = chatResponse.choices[0].message.content as string;

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid AI response" },
        { status: 500 },
      );
    }

    // ── Post-processing safety pass ──────────────────────────────────────────
    if (result.type === "flow" && Array.isArray(result.data?.steps)) {
      const steps = result.data.steps as any[];

      // Build a set of all valid step IDs for reference validation
      const validStepIds = new Set(steps.map((s: any) => s.id));

      result.data.id = result.data.id || `flow_${uuidv4().slice(0, 8)}`;

      result.data.steps = steps.map((step: any) => {
        // Hydrate missing IDs
        step.id = step.id || `step_${uuidv4().slice(0, 8)}`;
        step.blocks = (step.blocks ?? []).map((block: any) => ({
          ...block,
          id: block.id || `block_${uuidv4().slice(0, 8)}`,
        }));

        // Remove dangling step.nextStepId
        if (step.nextStepId && !validStepIds.has(step.nextStepId)) {
          delete step.nextStepId;
        }

        // Scrub each block
        step.blocks = step.blocks
          .map((block: any) => {
            const data = block.data;
            if (!data) return block;

            // SELECT: empty all tags; remove dangling option.nextStepId
            if (data.type === "select" && Array.isArray(data.options)) {
              data.options = data.options.map((opt: any) => {
                // Always wipe tags
                opt.tags = [];
                // Remove dangling nextStepId on options
                if (opt.nextStepId && !validStepIds.has(opt.nextStepId)) {
                  delete opt.nextStepId;
                }
                return opt;
              });
            }

            // BUTTON: remove dangling nextStepId; strip "start over" variants
            if (data.type === "button") {
              const label: string = (data.label ?? "").toLowerCase();
              const isRestartBtn =
                label.includes("start over") ||
                label.includes("restart") ||
                label.includes("try again") ||
                label.includes("begin again") ||
                label.includes("reset");

              if (isRestartBtn) {
                // Signal removal by returning null — filtered below
                return null;
              }

              if (
                data.action === "next-step" &&
                data.nextStepId &&
                !validStepIds.has(data.nextStepId)
              ) {
                delete data.nextStepId;
              }
            }

            return block;
          })
          .filter(Boolean); // Remove nulled restart buttons

        return step;
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate flow" },
      { status: 500 },
    );
  }
}
