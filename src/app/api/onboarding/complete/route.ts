import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { updateOrgProfile } from "@/lib/storage/org";
import { OrgProfileSchema } from "@/lib/storage/orgProfile";
import { fetchAndExtractPage } from "@/lib/research/fetch";
import { createSourceFromText } from "@/lib/storage/sources";
import { addWatchedSource } from "@/lib/storage/watched-sources";
import { detectFeedType } from "@/lib/feeds/detect-feed";
import type { OrganizationObjective, OrganizationProfile } from "@/lib/storage/types";

const BodySchema = z.object({
  profile: OrgProfileSchema,
  seed: z
    .object({
      importWebsite: z.boolean().optional().default(true),
      wikipedia: z.boolean().optional().default(false),
      starterPlan: z.boolean().optional().default(true),
      monitorFeeds: z.array(z.string()).optional().default([]),
      wikiTopics: z.array(z.string()).optional().default([])
    })
    .optional()
});

function objectiveLabel(o: OrganizationObjective) {
  switch (o) {
    case "education":
      return "Education";
    case "awareness":
      return "Awareness";
    case "donations":
      return "Donations";
    case "news":
      return "News & updates";
    case "species-info":
      return "Species info";
    case "habitat-info":
      return "Habitat/ecosystem info";
    case "advocacy":
      return "Advocacy";
    case "volunteering":
      return "Volunteer recruitment";
  }
}

function buildStarterPlan(profile: OrganizationProfile) {
  const focus = profile.focusAreas.length ? profile.focusAreas.join(", ") : "(add focus areas)";
  const objectives = profile.objectives.length ? profile.objectives.map(objectiveLabel).join(", ") : "(choose objectives)";

  const pillars: string[] = [];
  if (profile.objectives.includes("education")) pillars.push("Explainers (science, threats, solutions)");
  if (profile.objectives.includes("awareness")) pillars.push("Why it matters (stories, empathy, shareables)");
  if (profile.objectives.includes("donations")) pillars.push("Impact + trust (where funds go, proof, outcomes)");
  if (profile.objectives.includes("news")) pillars.push("Updates (field notes, wins, milestones)");
  if (profile.objectives.includes("species-info")) pillars.push("Species guides (habits, ecology, myths vs facts)");
  if (profile.objectives.includes("habitat-info")) pillars.push("Habitat guides (how ecosystems work, restoration)");
  if (profile.objectives.includes("advocacy")) pillars.push("Advocacy (policy context, talking points, actions)");
  if (profile.objectives.includes("volunteering")) pillars.push("Get involved (volunteering, events, partnerships)");

  const suggestedTitles = [
    `Why ${focus} matters — and what we can do next`,
    `A practical guide to protecting ${focus}`,
    `Myths vs facts: ${focus}`,
    `How habitat restoration helps ${focus}`,
    `What “biodiversity” actually means for ${focus}`,
    `How to help: 7 actions that support conservation`,
    `Behind the scenes: how conservation work happens`,
    `Where donations go: the impact of your support`
  ];

  const researchPrompts = [
    `site:.org ${focus} conservation`,
    `${focus} habitat restoration case study`,
    `${focus} threats and solutions`,
    `${focus} IUCN status`,
    `${focus} how to help donate volunteer`
  ];

  return `# Starter content plan

## Organization

- **Name:** ${profile.name}
- **Website:** ${profile.website || "(not set)"}
- **Focus:** ${focus}
- **Objectives:** ${objectives}

## Content pillars (start here)

${pillars.length ? pillars.map((p) => `- ${p}`).join("\n") : "- (Choose objectives to generate pillars)"}

## Draft post ideas (pick 1–2 for week one)

${suggestedTitles.slice(0, 8).map((t, i) => `${i + 1}. ${t}`).join("\n")}

## Competitor research prompts

Copy/paste into a search engine, then feed the best URLs into the **Research** tab:

${researchPrompts.map((q) => `- ${q}`).join("\n")}

## What to add to the knowledge base next

- Annual report / impact report
- Program descriptions and outcomes
- Donation FAQ / transparency notes
- Press kit / brand guidelines
- 3–5 competitor “best pages” (high ranking, clear structure)
`;
}

function candidateOrgUrls(website: string) {
  const urls: string[] = [];
  const base = new URL(website);
  urls.push(new URL("/", base).toString());
  urls.push(base.toString());

  const common = [
    "/about",
    "/about-us",
    "/mission",
    "/our-mission",
    "/who-we-are",
    "/what-we-do",
    "/our-work",
    "/programs",
    "/projects",
    "/impact",
    "/donate",
    "/get-involved"
  ];
  for (const path of common) urls.push(new URL(path, base).toString());

  return Array.from(new Set(urls));
}

async function fetchWikipediaSummary(query: string): Promise<{ title: string; url?: string; extract: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=1`;
    const searchRes = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "wildlife-blogger/0.1 (+https://example.invalid; onboarding bootstrap)"
      }
    });
    if (!searchRes.ok) return null;
    const searchJson = (await searchRes.json()) as { pages?: Array<{ title?: string }> };
    const title = searchJson.pages?.[0]?.title?.trim();
    if (!title) return null;

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const summaryRes = await fetch(summaryUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "wildlife-blogger/0.1 (+https://example.invalid; onboarding bootstrap)"
      }
    });
    if (!summaryRes.ok) return null;
    const summaryJson = (await summaryRes.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };

    const extract = (summaryJson.extract ?? "").trim();
    if (!extract) return null;

    return { title: summaryJson.title?.trim() || title, url: summaryJson.content_urls?.desktop?.page, extract };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding payload" }, { status: 400 });
  }

  const completedProfile = { ...parsed.data.profile, onboardingCompletedAt: new Date().toISOString() };
  const profile = await updateOrgProfile(completedProfile);

  const seed = parsed.data.seed ?? null;
  const createdSourceIds: string[] = [];
  const seedErrors: Array<{ step: string; message: string }> = [];

  if (seed?.starterPlan) {
    try {
      const source = await createSourceFromText({
        type: "PASTE",
        title: "Starter content plan (auto-generated)",
        contentText: buildStarterPlan(profile)
      });
      createdSourceIds.push(source.id);
    } catch (e) {
      seedErrors.push({
        step: "starterPlan",
        message: e instanceof Error ? e.message : "Failed to create starter plan"
      });
    }
  }

  if (seed?.importWebsite && profile.website) {
    const candidates = candidateOrgUrls(profile.website);
    const maxPages = 2;
    let okPages = 0;
    for (const url of candidates) {
      if (okPages >= maxPages) break;
      try {
        const page = await fetchAndExtractPage(url, {
          timeoutMs: 10_000,
          userAgent: "wildlife-blogger/0.1 (+https://example.invalid; onboarding bootstrap)"
        });
        const title = page.title || new URL(page.url).hostname;
        const source = await createSourceFromText({
          type: "ORG_URL",
          title,
          url: page.url,
          contentText: page.text
        });
        createdSourceIds.push(source.id);
        okPages += 1;
      } catch {
        // best-effort
      }
    }
  }

  if (seed?.wikipedia && profile.focusAreas.length) {
    const unique = new Map<string, string>();
    for (const raw of profile.focusAreas) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!unique.has(key)) unique.set(key, trimmed);
      if (unique.size >= 3) break;
    }

    for (const q of unique.values()) {
      try {
        const summary = await fetchWikipediaSummary(q);
        if (!summary) continue;
        const source = await createSourceFromText({
          type: "PASTE",
          title: `Wikipedia: ${summary.title}`,
          url: summary.url,
          contentText: `${summary.extract}\n\nNote: This is a Wikipedia summary excerpt. Verify key claims with primary sources before publishing.`
        });
        createdSourceIds.push(source.id);
      } catch {
        // best-effort
      }
    }
  }

  // Add discovered wiki topics (from discovery phase)
  const addedWikiTopics: string[] = [];
  if (seed?.wikiTopics?.length) {
    // Skip topics already added via focus areas wikipedia
    const alreadyAdded = new Set(
      profile.focusAreas
        .slice(0, 3)
        .map((f) => f.trim().toLowerCase())
    );

    for (const topic of seed.wikiTopics.slice(0, 5)) {
      const topicLower = topic.toLowerCase();
      if (alreadyAdded.has(topicLower)) continue;
      alreadyAdded.add(topicLower);

      try {
        const summary = await fetchWikipediaSummary(topic);
        if (!summary) continue;
        const source = await createSourceFromText({
          type: "PASTE",
          title: `Wikipedia: ${summary.title}`,
          url: summary.url,
          contentText: `${summary.extract}\n\nNote: This is a Wikipedia summary excerpt. Verify key claims with primary sources before publishing.`
        });
        createdSourceIds.push(source.id);
        addedWikiTopics.push(summary.title);
      } catch {
        // best-effort
      }
    }
  }

  // Add discovered monitor feeds (from discovery phase)
  const addedMonitorFeeds: string[] = [];
  if (seed?.monitorFeeds?.length) {
    for (const feedUrl of seed.monitorFeeds.slice(0, 8)) {
      try {
        // Detect feed type
        const detected = await detectFeedType(feedUrl);

        // Add to watched sources
        await addWatchedSource({
          name: detected.name || new URL(feedUrl).hostname,
          url: detected.feedUrl || feedUrl,
          type: detected.type,
          fetchIntervalHours: 24 // Daily by default
        });

        addedMonitorFeeds.push(detected.name || feedUrl);
      } catch {
        // best-effort - skip invalid feeds
      }
    }
  }

  return NextResponse.json({
    profile,
    seed,
    createdSourceIds,
    seedErrors,
    addedWikiTopics,
    addedMonitorFeeds
  });
}
