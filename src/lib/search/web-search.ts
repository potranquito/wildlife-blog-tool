import { z } from "zod";
import { generateWithAzureOpenAI } from "@/lib/ai/providers/azure";
import { generateWithOpenAI } from "@/lib/ai/providers/openai";
import { extractJsonObject } from "@/lib/ai/json";
import type { ExtractedOrgProfile } from "@/lib/ai/extract-org";

export type DiscoveredOrg = {
  name: string;
  url: string;
  description: string;
  newsUrl?: string;
  relevance: "high" | "medium" | "low";
};

export type DiscoveredWikiTopic = {
  title: string;
  description: string;
  relevance: "high" | "medium" | "low";
};

export type DiscoveryResult = {
  similarOrgs: DiscoveredOrg[];
  wikipediaTopics: DiscoveredWikiTopic[];
  suggestedSearchQueries: string[];
};

const DiscoveryResultSchema = z.object({
  similarOrgs: z.array(z.object({
    name: z.string(),
    url: z.string(),
    description: z.string(),
    newsUrl: z.string().optional(),
    relevance: z.enum(["high", "medium", "low"])
  })).default([]),
  wikipediaTopics: z.array(z.object({
    title: z.string(),
    description: z.string(),
    relevance: z.enum(["high", "medium", "low"])
  })).default([]),
  suggestedSearchQueries: z.array(z.string()).default([])
});

function buildDiscoveryPrompt(profile: ExtractedOrgProfile): string {
  const focusAreas = profile.focusAreas.join(", ") || "wildlife conservation";
  const searchKeywords = profile.searchKeywords.join(", ") || focusAreas;
  const locations = profile.locationTerms.join(", ") || "global";
  const species = profile.speciesTerms.join(", ") || "wildlife";

  return `
You are an expert in wildlife conservation organizations and research.

Given this organization profile:
- Name: ${profile.name}
- Focus areas: ${focusAreas}
- Search keywords: ${searchKeywords}
- Geographic focus: ${locations}
- Species focus: ${species}
- Mission: ${profile.mission || "Not specified"}

Generate a JSON object with:

1. "similarOrgs" (array): 5-8 real, well-known conservation organizations that work on similar topics.
   Each org should have:
   - name: Organization name
   - url: Their main website URL (use real, accurate URLs like "https://www.awf.org", "https://www.savetheelephants.org")
   - description: Brief description of their work
   - newsUrl: Their news/blog page URL if known (e.g., "https://www.awf.org/news")
   - relevance: "high" (very similar focus), "medium" (related), or "low" (tangentially related)

2. "wikipediaTopics" (array): 5-10 Wikipedia topics that would provide useful background information.
   Each topic should have:
   - title: Exact Wikipedia article title (e.g., "African elephant", "Maasai Mara", "Wildlife conservation")
   - description: Why this topic is relevant
   - relevance: "high", "medium", or "low"

3. "suggestedSearchQueries" (array): 5-10 search queries for finding more relevant articles and blogs.
   Examples: "elephant conservation blogs", "Kenya wildlife news", "African savanna ecosystem research"

IMPORTANT:
- Only include REAL organizations with ACCURATE URLs
- Focus on organizations in the same geographic region or with the same species focus
- Include major international organizations (WWF, IUCN, Wildlife Conservation Society) if relevant
- Include regional/local organizations specific to the location
- For Wikipedia topics, use exact article titles that exist
- Return ONLY valid JSON, no explanations

JSON:
`.trim();
}

function buildFallbackDiscovery(profile: ExtractedOrgProfile): DiscoveryResult {
  // Fallback with common conservation organizations
  const similarOrgs: DiscoveredOrg[] = [
    {
      name: "World Wildlife Fund",
      url: "https://www.worldwildlife.org",
      description: "Global conservation organization working on wildlife and habitat protection",
      newsUrl: "https://www.worldwildlife.org/stories",
      relevance: "medium"
    },
    {
      name: "Wildlife Conservation Society",
      url: "https://www.wcs.org",
      description: "Saves wildlife and wild places through science, conservation action, and education",
      newsUrl: "https://newsroom.wcs.org",
      relevance: "medium"
    },
    {
      name: "IUCN",
      url: "https://www.iucn.org",
      description: "International Union for Conservation of Nature - global authority on the status of nature",
      newsUrl: "https://www.iucn.org/news",
      relevance: "medium"
    }
  ];

  const wikipediaTopics: DiscoveredWikiTopic[] = [
    {
      title: "Wildlife conservation",
      description: "General overview of conservation practices and principles",
      relevance: "high"
    },
    {
      title: "Habitat conservation",
      description: "Protection and restoration of natural habitats",
      relevance: "medium"
    },
    {
      title: "Biodiversity",
      description: "Variety of life on Earth and importance of preservation",
      relevance: "medium"
    }
  ];

  // Add species-specific topics
  for (const species of profile.speciesTerms.slice(0, 3)) {
    wikipediaTopics.push({
      title: species,
      description: `Information about ${species}`,
      relevance: "high"
    });
  }

  // Add location-specific topics
  for (const location of profile.locationTerms.slice(0, 2)) {
    wikipediaTopics.push({
      title: location,
      description: `Geographic context for ${location}`,
      relevance: "medium"
    });
  }

  const suggestedSearchQueries: string[] = [];
  for (const keyword of profile.searchKeywords.slice(0, 3)) {
    suggestedSearchQueries.push(`${keyword} conservation`);
    suggestedSearchQueries.push(`${keyword} news blog`);
  }
  for (const species of profile.speciesTerms.slice(0, 2)) {
    suggestedSearchQueries.push(`${species} protection organizations`);
  }

  return { similarOrgs, wikipediaTopics, suggestedSearchQueries };
}

export async function discoverRelatedSources(profile: ExtractedOrgProfile): Promise<{
  result: DiscoveryResult;
  provider: "azure-openai" | "openai" | "fallback";
}> {
  const prompt = buildDiscoveryPrompt(profile);

  const azureConfigured =
    Boolean(process.env.AZURE_OPENAI_ENDPOINT?.trim()) &&
    Boolean(process.env.AZURE_OPENAI_API_KEY?.trim()) &&
    Boolean(process.env.AZURE_OPENAI_DEPLOYMENT?.trim());

  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  // Try Azure OpenAI first
  if (azureConfigured) {
    try {
      const raw = await generateWithAzureOpenAI(prompt);
      const obj = extractJsonObject(raw);
      const parsed = DiscoveryResultSchema.safeParse(obj);
      if (parsed.success) {
        return { result: parsed.data, provider: "azure-openai" };
      }
    } catch {
      // Fall through to next provider
    }
  }

  // Try OpenAI
  if (openaiConfigured) {
    try {
      const raw = await generateWithOpenAI(prompt);
      const obj = extractJsonObject(raw);
      const parsed = DiscoveryResultSchema.safeParse(obj);
      if (parsed.success) {
        return { result: parsed.data, provider: "openai" };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: return basic suggestions
  return { result: buildFallbackDiscovery(profile), provider: "fallback" };
}

// Generate search queries based on profile
export function generateSearchQueries(profile: ExtractedOrgProfile): string[] {
  const queries: string[] = [];

  // Species-focused queries
  for (const species of profile.speciesTerms.slice(0, 3)) {
    queries.push(`${species} conservation organizations`);
    queries.push(`${species} protection news blog`);
  }

  // Location-focused queries
  for (const location of profile.locationTerms.slice(0, 2)) {
    queries.push(`${location} wildlife conservation`);
    queries.push(`${location} conservation NGO`);
  }

  // Keyword-focused queries
  for (const keyword of profile.searchKeywords.slice(0, 3)) {
    queries.push(`${keyword} blog`);
    queries.push(`${keyword} organization`);
  }

  // Focus area queries
  for (const focus of profile.focusAreas.slice(0, 2)) {
    queries.push(`${focus} conservation news`);
  }

  // Deduplicate and limit
  return [...new Set(queries)].slice(0, 15);
}
