import { z } from "zod";
import type { OrganizationObjective } from "@/lib/storage/types";
import { fetchAndExtractPage } from "@/lib/research/fetch";
import { generateWithAzureOpenAI } from "@/lib/ai/providers/azure";
import { generateWithOpenAI } from "@/lib/ai/providers/openai";
import { extractJsonObject } from "@/lib/ai/json";
import { truncateText } from "@/lib/utils/text";

const OBJECTIVES: OrganizationObjective[] = [
  "education",
  "awareness",
  "donations",
  "news",
  "species-info",
  "habitat-info",
  "advocacy",
  "volunteering"
];

const ExtractedProfileSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).default(""),
  mission: z.string().max(2000).default(""),
  focusAreas: z.array(z.string().max(100)).max(30).default([]),
  objectives: z.array(z.enum([
    "education",
    "awareness",
    "donations",
    "news",
    "species-info",
    "habitat-info",
    "advocacy",
    "volunteering"
  ])).default([]),
  voiceGuidelines: z.string().max(8000).default(""),
  preferredTerms: z.array(z.string().max(50)).max(100).default([]),
  avoidTerms: z.array(z.string().max(50)).max(100).default([]),
  // Discovery keywords for finding related sources
  searchKeywords: z.array(z.string().max(100)).max(20).default([]),
  locationTerms: z.array(z.string().max(100)).max(10).default([]),
  speciesTerms: z.array(z.string().max(100)).max(15).default([])
});

export type ExtractedOrgProfile = z.infer<typeof ExtractedProfileSchema>;

function candidateUrls(website: string): string[] {
  const urls: string[] = [];
  const base = new URL(website);
  urls.push(new URL("/", base).toString());

  const common = [
    "/about",
    "/about-us",
    "/mission",
    "/our-mission",
    "/who-we-are",
    "/what-we-do",
    "/our-work",
    "/programs",
    "/conservation",
    "/wildlife",
    "/impact"
  ];
  for (const path of common) {
    urls.push(new URL(path, base).toString());
  }

  return Array.from(new Set(urls));
}

async function fetchPagesContent(website: string): Promise<string> {
  const candidates = candidateUrls(website);
  const chunks: string[] = [];
  const maxPages = 3;
  let fetched = 0;

  for (const url of candidates) {
    if (fetched >= maxPages) break;
    try {
      const page = await fetchAndExtractPage(url, {
        timeoutMs: 10_000,
        userAgent: "wildlife-blogger/0.1 (+https://example.invalid; onboarding extraction)"
      });
      if (page.text.length > 200) {
        chunks.push(`[Page: ${page.title || url}]\n${truncateText(page.text, 8000)}`);
        fetched++;
      }
    } catch {
      // best-effort, continue to next URL
    }
  }

  if (chunks.length === 0) {
    throw new Error("Could not fetch any content from the provided URL");
  }

  return chunks.join("\n\n---\n\n");
}

function buildExtractionPrompt(websiteContent: string): string {
  return `
You are an expert at analyzing wildlife conservation organization websites.

Analyze the following website content and extract organization information.

Return ONLY a valid JSON object with these fields:
- name (string): The organization's name
- tagline (string): A short tagline or slogan (if found, otherwise create one based on their work)
- mission (string): Their mission statement (if found, otherwise summarize their purpose)
- focusAreas (string[]): Animals, plants, habitats, or ecosystems they focus on (e.g., "sea turtles", "mangrove forests", "pollinators")
- objectives (string[]): Which of these apply: "education", "awareness", "donations", "news", "species-info", "habitat-info", "advocacy", "volunteering"
- voiceGuidelines (string): Describe their writing voice/tone based on the content (e.g., "Warm, factual, and optimistic. Uses accessible language...")
- preferredTerms (string[]): Key terms they use frequently (e.g., "habitat", "biodiversity", "conservation")
- avoidTerms (string[]): Terms to avoid based on their style (e.g., "clickbait", "doom")
- searchKeywords (string[]): Keywords for finding similar organizations (e.g., "elephant conservation", "African wildlife protection", "anti-poaching")
- locationTerms (string[]): Geographic locations mentioned (e.g., "Kenya", "Maasai Mara", "East Africa", "Serengeti")
- speciesTerms (string[]): Specific species or taxa mentioned (e.g., "African elephant", "lion", "rhino", "endangered wildlife")

Guidelines:
- For objectives, only include those clearly relevant to their content
- For focusAreas, extract specific species, habitats, or ecosystems mentioned
- For voiceGuidelines, analyze their actual writing style
- For searchKeywords, include terms useful for finding competitor organizations and relevant blogs
- For locationTerms, extract any geographic regions, countries, parks, or ecosystems mentioned
- For speciesTerms, extract specific animal or plant species they focus on
- Be concise but thorough

Website content:
${websiteContent}
`.trim();
}

function buildFallbackProfile(website: string): ExtractedOrgProfile {
  let hostname = "";
  try {
    hostname = new URL(website).hostname.replace(/^www\./, "");
  } catch {
    hostname = "Unknown Organization";
  }

  return {
    name: hostname,
    tagline: "",
    mission: "",
    focusAreas: [],
    objectives: [],
    voiceGuidelines: "",
    preferredTerms: [],
    avoidTerms: [],
    searchKeywords: [],
    locationTerms: [],
    speciesTerms: []
  };
}

export async function extractOrgFromWebsite(website: string): Promise<{
  profile: ExtractedOrgProfile;
  provider: "azure-openai" | "openai" | "fallback";
}> {
  // Normalize URL
  let normalizedUrl = website.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  // Fetch website content
  const content = await fetchPagesContent(normalizedUrl);
  const prompt = buildExtractionPrompt(content);

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
      const parsed = ExtractedProfileSchema.safeParse(obj);
      if (parsed.success) {
        return { profile: parsed.data, provider: "azure-openai" };
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
      const parsed = ExtractedProfileSchema.safeParse(obj);
      if (parsed.success) {
        return { profile: parsed.data, provider: "openai" };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: return minimal profile
  return { profile: buildFallbackProfile(normalizedUrl), provider: "fallback" };
}
