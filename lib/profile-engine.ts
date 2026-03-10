export interface Profile {
  id: string;
  display_name: string;
  description: string | null;
  is_default: boolean;
  zones: string[] | null;
  tags?: string[] | null;
}

export interface ProfileRule {
  id: string;
  profile_id: string;
  question: string;
  answer: string;
  weight: number;
}

const MINIMUM_PROFILE_SCORE = 3;

/**
 * M3 Profile Engine
 * 4-step algorithm to determine the best profile match for a given set of answers.
 */
export function evaluateProfile(
  answers: Record<string, any>,
  profiles: Profile[],
  rules: ProfileRule[],
): Profile {
  const defaultProfile = profiles.find((p) => p.is_default) || profiles[0];

  if (!profiles || profiles.length === 0) {
    throw new Error("No profiles provided to evaluateProfile");
  }

  // 1. Hard branch: non-drinker override
  // Normalizes question key assuming it could be "Q3" or "q3"
  const q3Answer = answers["Q3"] || answers["q3"];
  const isNonDrinker = Array.isArray(q3Answer)
    ? q3Answer.includes("no")
    : q3Answer === "no";

  if (isNonDrinker) {
    const wellnessProfile = profiles.find(
      (p) =>
        p.id === "wellness-seeker" ||
        p.display_name.toLowerCase().includes("wellness"),
    );
    return wellnessProfile || defaultProfile;
  }

  // 2. Weighted scoring from public.profile_rules
  const scoreMap: Record<string, number> = {};
  profiles.forEach((p) => {
    scoreMap[p.id] = 0;
  });

  rules.forEach((rule) => {
    // Accommodate 'Qx' or 'qx' keys
    const userAnswer =
      answers[rule.question] ||
      answers[rule.question.toLowerCase()] ||
      answers[rule.question.toUpperCase()];
    if (userAnswer) {
      if (Array.isArray(userAnswer)) {
        if (userAnswer.includes(rule.answer)) {
          scoreMap[rule.profile_id] += rule.weight;
        }
      } else if (
        String(userAnswer).toLowerCase() === String(rule.answer).toLowerCase()
      ) {
        scoreMap[rule.profile_id] += rule.weight;
      }
    }
  });

  const sortedProfiles = profiles
    .map((p) => ({ profile: p, score: scoreMap[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  // 3. Catch-all check
  if (sortedProfiles[0].score < MINIMUM_PROFILE_SCORE) {
    return defaultProfile; // curious-explorer usually
  }

  // 4. Tiebreaker
  if (
    sortedProfiles.length > 1 &&
    sortedProfiles[0].score === sortedProfiles[1].score
  ) {
    const q4Answer = answers["Q4"] || answers["q4"];
    if (q4Answer) {
      const q4Str = String(q4Answer).toLowerCase();

      const checkTags = (p: Profile) => {
        if (p.tags) return p.tags.some((t) => t.toLowerCase() === q4Str);
        if (p.zones)
          return p.zones.some((z) => z.toLowerCase().includes(q4Str));
        return false;
      };

      const p1Matches = checkTags(sortedProfiles[0].profile);
      const p2Matches = checkTags(sortedProfiles[1].profile);

      if (p1Matches && !p2Matches) return sortedProfiles[0].profile;
      if (p2Matches && !p1Matches) return sortedProfiles[1].profile;
    }

    // If tiebreaker fails, fallback to default to avoid random assignments
    return defaultProfile;
  }

  return sortedProfiles[0].profile;
}
