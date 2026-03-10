import { Tag, Zone } from "@/types/mirour";
import { nanoid } from "nanoid";

// Helper: Look up tag ID by name (case-insensitive)
function getTagIdByName(tags: Tag[], name: string): string | null {
  const tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  return tag?.id || null;
}

/**
 * Validates that all required tags exist for entrance flow template
 * @throws Error with list of missing tags if validation fails
 */
function validateRequiredTags(tags: Tag[]): void {
  const requiredTags = [
    // Soft preferences
    "Social",
    "Calm",
    "Energize",
    "Focus",
    "Sleep",
    "Gift",
    "Casual",
    // Hard constraints
    "No-sugar",
    "Vegan",
    "Gluten-free",
    "Organic",
    "THC-free",
    "Caffeine-free",
    "No-effect",
  ];

  const missingTags: string[] = [];

  requiredTags.forEach((tagName) => {
    if (!getTagIdByName(tags, tagName)) {
      missingTags.push(tagName);
    }
  });

  if (missingTags.length > 0) {
    throw new Error(
      `Cannot create entrance flow. Missing required tags:\n` +
        `${missingTags.map((t) => `- ${t}`).join("\n")}\n\n` +
        `Please create these tags in Tag Manager first, then try again.`,
    );
  }
}

/**
 * Validates that a zone has all required education fields
 * @throws Error with list of missing fields if validation fails
 */
function validateZoneEducationFields(zone: Zone): void {
  if (!zone.name || zone.name.trim() === "") {
    throw new Error("Zone must have a name");
  }

  const missingFields: string[] = [];

  if (!zone.zone_what || zone.zone_what.trim() === "") {
    missingFields.push("What (zone_what)");
  }
  if (!zone.zone_when || zone.zone_when.trim() === "") {
    missingFields.push("When (zone_when)");
  }
  if (!zone.zone_who || zone.zone_who.trim() === "") {
    missingFields.push("Who (zone_who)");
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Zone "${zone.name}" is missing education fields:\n` +
        `${missingFields.map((f) => `- ${f}`).join("\n")}\n\n` +
        `Please fill in these fields in Zone Manager before creating a flow.`,
    );
  }
}

/**
 * Creates an entrance flow template based on Soberish content spec
 * 4 questions: Occasion → Mood → Dietary → Avoiding
 */
export function createEntranceFlowTemplate(storeId: string, tags: Tag[]) {
  // Validate that all required tags exist before generating template
  validateRequiredTags(tags);
  // Look up tag IDs (validation ensures all tags exist)
  const getTagId = (name: string) => {
    const id = getTagIdByName(tags, name);
    return id;
  };

  const nodes = [];
  const edges = [];

  // Welcome Node
  const welcomeId = nanoid();
  nodes.push({
    id: welcomeId,
    type: "welcome",
    position: { x: 250, y: 50 },
    data: {
      label: "Welcome",
      header: "Not sure where to start?",
      content:
        "Find your perfect picks in 60 seconds! We'll ask you 4 quick questions to personalize your recommendations.",
      buttonText: "Let's Go",
    },
  });

  // Q1: Occasion
  const q1Id = nanoid();
  nodes.push({
    id: q1Id,
    type: "question",
    position: { x: 250, y: 200 },
    data: {
      label: "Q1: Occasion",
      header: "What's the occasion?",
      questionType: "multiple-choice",
      options: [
        { value: "social", label: "Social gathering or party" },
        { value: "relaxing", label: "Relaxing alone or winding down" },
        { value: "gift", label: "Looking for a gift" },
        { value: "browsing", label: "Just browsing" },
      ],
      conditionalNext: [
        {
          optionValue: "social",
          addTags: getTagId("Social") ? [getTagId("Social")!] : [],
        },
        {
          optionValue: "relaxing",
          addTags: getTagId("Calm") ? [getTagId("Calm")!] : [],
        },
        {
          optionValue: "gift",
          addTags: getTagId("Gift") ? [getTagId("Gift")!] : [],
        },
        {
          optionValue: "browsing",
          addTags: getTagId("Casual") ? [getTagId("Casual")!] : [],
        },
      ],
    },
  });

  edges.push({
    id: `${welcomeId}-${q1Id}`,
    source: welcomeId,
    target: q1Id,
  });

  // Q2: Mood
  const q2Id = nanoid();
  nodes.push({
    id: q2Id,
    type: "question",
    position: { x: 250, y: 350 },
    data: {
      label: "Q2: Mood",
      header: "What mood are you going for?",
      questionType: "multiple-choice",
      options: [
        { value: "calm", label: "Relaxed and calm" },
        { value: "energize", label: "Energized and alert" },
        { value: "focus", label: "Focused and productive" },
        { value: "sleep", label: "Ready for sleep" },
      ],
      conditionalNext: [
        {
          optionValue: "calm",
          addTags: getTagId("Calm") ? [getTagId("Calm")!] : [],
        },
        {
          optionValue: "energize",
          addTags: getTagId("Energize") ? [getTagId("Energize")!] : [],
        },
        {
          optionValue: "focus",
          addTags: getTagId("Focus") ? [getTagId("Focus")!] : [],
        },
        {
          optionValue: "sleep",
          addTags: getTagId("Sleep") ? [getTagId("Sleep")!] : [],
        },
      ],
    },
  });

  edges.push({
    id: `${q1Id}-${q2Id}`,
    source: q1Id,
    target: q2Id,
  });

  // Q3: Dietary
  const q3Id = nanoid();
  nodes.push({
    id: q3Id,
    type: "question",
    position: { x: 250, y: 500 },
    data: {
      label: "Q3: Dietary",
      header: "Do you have any dietary restrictions?",
      questionType: "checkboxes",
      options: [
        { value: "no-sugar", label: "No sugar" },
        { value: "vegan", label: "Vegan" },
        { value: "gluten-free", label: "Gluten-free" },
        { value: "organic", label: "Organic only" },
        { value: "none", label: "No preferences" },
      ],
      conditionalNext: [
        {
          optionValue: "no-sugar",
          addTags: getTagId("No-sugar") ? [getTagId("No-sugar")!] : [],
        },
        {
          optionValue: "vegan",
          addTags: getTagId("Vegan") ? [getTagId("Vegan")!] : [],
        },
        {
          optionValue: "gluten-free",
          addTags: getTagId("Gluten-free") ? [getTagId("Gluten-free")!] : [],
        },
        {
          optionValue: "organic",
          addTags: getTagId("Organic") ? [getTagId("Organic")!] : [],
        },
      ],
    },
  });

  edges.push({
    id: `${q2Id}-${q3Id}`,
    source: q2Id,
    target: q3Id,
  });

  // Q4: Avoiding
  const q4Id = nanoid();
  nodes.push({
    id: q4Id,
    type: "question",
    position: { x: 250, y: 650 },
    data: {
      label: "Q4: Avoiding",
      header: "Anything you want to avoid?",
      questionType: "checkboxes",
      options: [
        { value: "thc", label: "THC / Cannabis" },
        { value: "caffeine", label: "Caffeine" },
        { value: "psychoactive", label: "Any psychoactive effects" },
        { value: "open", label: "I'm open to everything" },
      ],
      conditionalNext: [
        {
          optionValue: "thc",
          addTags: getTagId("THC-free") ? [getTagId("THC-free")!] : [],
        },
        {
          optionValue: "caffeine",
          addTags: getTagId("Caffeine-free")
            ? [getTagId("Caffeine-free")!]
            : [],
        },
        {
          optionValue: "psychoactive",
          addTags: getTagId("No-effect") ? [getTagId("No-effect")!] : [],
        },
      ],
    },
  });

  edges.push({
    id: `${q3Id}-${q4Id}`,
    source: q3Id,
    target: q4Id,
  });

  // Recommendation Node
  const recoId = nanoid();
  nodes.push({
    id: recoId,
    type: "recommendation",
    position: { x: 250, y: 800 },
    data: {
      label: "Your Picks",
      header: "Here are your personalized picks!",
      recommendationLogic: {
        useTags: true,
        matchStrategy: "any",
        limit: 6,
        fallbackToStaffPicks: true,
      },
    },
  });

  edges.push({
    id: `${q4Id}-${recoId}`,
    source: q4Id,
    target: recoId,
  });

  // Customer Info Node
  const infoId = nanoid();
  nodes.push({
    id: infoId,
    type: "customer-info",
    position: { x: 250, y: 950 },
    data: {
      label: "Save Profile",
      header: "Save your preferences?",
      content: "We'll remember your picks for next time!",
      collectEmail: true,
      collectPhone: false,
    },
  });

  edges.push({
    id: `${recoId}-${infoId}`,
    source: recoId,
    target: infoId,
  });

  // Complete Node
  const completeId = nanoid();
  nodes.push({
    id: completeId,
    type: "complete",
    position: { x: 250, y: 1100 },
    data: {
      label: "Thank You",
      header: "Enjoy your picks!",
      content: "Ask a team member if you need help finding these products.",
    },
  });

  edges.push({
    id: `${infoId}-${completeId}`,
    source: infoId,
    target: completeId,
  });

  return {
    name: "Entrance Flow - Soberish",
    description: "4-question quiz to find perfect picks",
    flow_type: "entrance" as const,
    nodes,
    edges,
  };
}

/**
 * Creates a zone-specific flow template with placeholder support
 */
export function createZoneFlowTemplate(storeId: string, zone: Zone) {
  // Validate that zone has all required education fields
  validateZoneEducationFields(zone);

  const nodes = [];
  const edges = [];

  // Welcome Node with zone placeholders
  const welcomeId = nanoid();
  nodes.push({
    id: welcomeId,
    type: "welcome",
    position: { x: 250, y: 50 },
    data: {
      label: "Welcome",
      header: "Welcome to {{zone_name}}",
      content: "Let us show you some great options from this collection!",
      buttonText: "Explore",
    },
  });

  // Message Node with zone education copy
  const messageId = nanoid();
  nodes.push({
    id: messageId,
    type: "message",
    position: { x: 250, y: 200 },
    data: {
      label: "About This Zone",
      header: "{{zone_name}}",
      content:
        "{{zone_what}}\n\nPerfect for: {{zone_when}}\n\nIdeal for: {{zone_who}}",
    },
  });

  edges.push({
    id: `${welcomeId}-${messageId}`,
    source: welcomeId,
    target: messageId,
  });

  // Recommendation Node (zone-filtered)
  const recoId = nanoid();
  nodes.push({
    id: recoId,
    type: "recommendation",
    position: { x: 250, y: 350 },
    data: {
      label: "Featured Products",
      header: "Check out these {{zone_name}} favorites",
      recommendationLogic: {
        useTags: true,
        matchStrategy: "zone-first",
        limit: 3,
        zoneId: zone.id,
        fallbackToStaffPicks: true,
      },
    },
  });

  edges.push({
    id: `${messageId}-${recoId}`,
    source: messageId,
    target: recoId,
  });

  // Complete Node
  const completeId = nanoid();
  nodes.push({
    id: completeId,
    type: "complete",
    position: { x: 250, y: 500 },
    data: {
      label: "Enjoy",
      header: "Enjoy exploring {{zone_name}}!",
      content:
        "Ask a team member if you'd like to learn more about any of these products.",
    },
  });

  edges.push({
    id: `${recoId}-${completeId}`,
    source: recoId,
    target: completeId,
  });

  return {
    name: `${zone.name} - Zone Flow`,
    description: `Quick exploration flow for ${zone.name} zone`,
    flow_type: "zone" as const,
    zone_id: zone.id,
    nodes,
    edges,
  };
}
