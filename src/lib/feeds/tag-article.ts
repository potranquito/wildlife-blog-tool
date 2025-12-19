import type { OrganizationProfile } from "@/lib/storage/types";

export type TagResult = {
  matchedKeywords: string[];
  relevanceScore: number;
};

export function tagArticle(
  article: { title: string; excerpt: string },
  orgProfile: OrganizationProfile
): TagResult {
  const text = `${article.title} ${article.excerpt}`.toLowerCase();

  // Combine focus areas and preferred terms as keywords
  const keywords = [
    ...orgProfile.focusAreas,
    ...orgProfile.preferredTerms
  ].filter(Boolean);

  // Also add common conservation terms if objectives include them
  const objectiveKeywords: Record<string, string[]> = {
    education: ["learn", "science", "research", "study", "discovery"],
    awareness: ["campaign", "awareness", "impact", "threat", "crisis"],
    donations: ["donate", "support", "fund", "contribute", "sponsor"],
    news: ["news", "update", "announcement", "milestone", "achievement"],
    "species-info": ["species", "wildlife", "animal", "population", "habitat"],
    "habitat-info": ["ecosystem", "habitat", "environment", "restoration", "conservation"],
    advocacy: ["policy", "legislation", "advocate", "protect", "law"],
    volunteering: ["volunteer", "join", "help", "community", "event"]
  };

  for (const objective of orgProfile.objectives) {
    const extraKeywords = objectiveKeywords[objective];
    if (extraKeywords) {
      keywords.push(...extraKeywords);
    }
  }

  // Deduplicate and lowercase keywords
  const uniqueKeywords = [...new Set(keywords.map((k) => k.toLowerCase().trim()))].filter(
    (k) => k.length >= 2
  );

  // Find matches
  const matched: string[] = [];
  for (const keyword of uniqueKeywords) {
    // Use word boundary matching for better accuracy
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
    if (regex.test(text)) {
      matched.push(keyword);
    }
  }

  // Calculate relevance score
  // - Each keyword match = 15 points
  // - Focus area matches are weighted higher (25 points)
  // - Max score = 100
  let score = 0;
  const focusAreasLower = orgProfile.focusAreas.map((f) => f.toLowerCase());

  for (const match of matched) {
    if (focusAreasLower.includes(match)) {
      score += 25; // Focus area match worth more
    } else {
      score += 15; // General keyword match
    }
  }

  score = Math.min(100, score);

  return {
    matchedKeywords: matched,
    relevanceScore: score
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
