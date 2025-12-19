import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { discoverRelatedSources, generateSearchQueries } from "@/lib/search/web-search";
import { validateDiscoveries } from "@/lib/search/discover-sources";
import type { ExtractedOrgProfile } from "@/lib/ai/extract-org";

const BodySchema = z.object({
  profile: z.object({
    name: z.string(),
    mission: z.string().optional().default(""),
    focusAreas: z.array(z.string()).optional().default([]),
    searchKeywords: z.array(z.string()).optional().default([]),
    locationTerms: z.array(z.string()).optional().default([]),
    speciesTerms: z.array(z.string()).optional().default([]),
    preferredTerms: z.array(z.string()).optional().default([]),
    avoidTerms: z.array(z.string()).optional().default([]),
    tagline: z.string().optional().default(""),
    objectives: z.array(z.string()).optional().default([]),
    voiceGuidelines: z.string().optional().default("")
  }),
  skipValidation: z.boolean().optional().default(false)
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const json = await request.json();
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { profile, skipValidation } = parsed.data;

    // Cast to ExtractedOrgProfile
    const extractedProfile = profile as ExtractedOrgProfile;

    // Discover related sources using AI
    const { result: discovery, provider } = await discoverRelatedSources(extractedProfile);

    // Generate additional search queries
    const searchQueries = generateSearchQueries(extractedProfile);

    // Optionally validate discovered URLs
    type OrgWithSelection = {
      name: string;
      url: string;
      description: string;
      newsUrl?: string;
      detectedNewsUrl?: string;
      feedType?: "RSS" | "HTML";
      relevance: "high" | "medium" | "low";
      validated: boolean;
      selected: boolean;
    };

    type WikiWithSelection = {
      title: string;
      description: string;
      relevance: "high" | "medium" | "low";
      validated: boolean;
      wikiUrl?: string;
      extract?: string;
      selected: boolean;
    };

    let validatedOrgs: OrgWithSelection[] = discovery.similarOrgs.map((org) => ({
      ...org,
      validated: false,
      selected: org.relevance === "high" // Pre-select high relevance
    }));

    let validatedWikiTopics: WikiWithSelection[] = discovery.wikipediaTopics.map((topic) => ({
      ...topic,
      validated: false,
      selected: topic.relevance === "high" // Pre-select high relevance
    }));

    if (!skipValidation) {
      // Validate discovered URLs (this may take a few seconds)
      const validated = await validateDiscoveries(
        discovery.similarOrgs,
        discovery.wikipediaTopics
      );

      validatedOrgs = validated.validatedOrgs.map((org) => ({
        ...org,
        selected: org.validated && org.relevance === "high"
      }));

      validatedWikiTopics = validated.validatedWikiTopics.map((topic) => ({
        ...topic,
        selected: topic.validated && topic.relevance === "high"
      }));
    }

    return NextResponse.json({
      provider,
      similarOrgs: validatedOrgs,
      wikipediaTopics: validatedWikiTopics,
      searchQueries: [...new Set([...discovery.suggestedSearchQueries, ...searchQueries])].slice(0, 15)
    });
  } catch (e) {
    console.error("Discovery error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Discovery failed" },
      { status: 500 }
    );
  }
}
