import { detectFeedType } from "@/lib/feeds/detect-feed";
import type { DiscoveredOrg, DiscoveredWikiTopic } from "./web-search";

export type ValidatedOrg = DiscoveredOrg & {
  validated: boolean;
  feedType?: "RSS" | "HTML";
  detectedNewsUrl?: string;
};

export type ValidatedWikiTopic = DiscoveredWikiTopic & {
  validated: boolean;
  wikiUrl?: string;
  extract?: string;
};

// Common news/blog paths to check
const NEWS_PATHS = [
  "/news",
  "/blog",
  "/updates",
  "/stories",
  "/articles",
  "/press",
  "/newsroom",
  "/latest",
  "/media"
];

async function validateUrl(url: string, timeoutMs = 8000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "user-agent": "wildlife-blogger/0.1 (+https://example.invalid; discovery)"
      }
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function findNewsUrl(baseUrl: string): Promise<string | null> {
  try {
    const base = new URL(baseUrl);

    // Check common news paths
    for (const path of NEWS_PATHS) {
      const testUrl = new URL(path, base).toString();
      const valid = await validateUrl(testUrl);
      if (valid) {
        return testUrl;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function validateOrg(org: DiscoveredOrg): Promise<ValidatedOrg> {
  // Validate main URL
  const mainValid = await validateUrl(org.url);

  if (!mainValid) {
    return { ...org, validated: false };
  }

  // Try to detect news feed
  let newsUrl = org.newsUrl;
  let feedType: "RSS" | "HTML" | undefined;

  // If no news URL provided, try to find one
  if (!newsUrl) {
    newsUrl = await findNewsUrl(org.url) || undefined;
  }

  // If we have a news URL, detect its type
  if (newsUrl) {
    const newsValid = await validateUrl(newsUrl);
    if (newsValid) {
      try {
        const detected = await detectFeedType(newsUrl);
        feedType = detected.type;
        // Use detected feed URL if different (e.g., found RSS link in HTML)
        if (detected.feedUrl && detected.feedUrl !== newsUrl) {
          newsUrl = detected.feedUrl;
        }
      } catch {
        feedType = "HTML";
      }
    } else {
      newsUrl = undefined;
    }
  }

  return {
    ...org,
    validated: true,
    feedType,
    detectedNewsUrl: newsUrl
  };
}

export async function validateWikiTopic(topic: DiscoveredWikiTopic): Promise<ValidatedWikiTopic> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // Try Wikipedia API
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.title)}`;
    const res = await fetch(summaryUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "wildlife-blogger/0.1 (+https://example.invalid; discovery)"
      }
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { ...topic, validated: false };
    }

    const data = (await res.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };

    return {
      ...topic,
      validated: true,
      wikiUrl: data.content_urls?.desktop?.page,
      extract: data.extract?.slice(0, 500)
    };
  } catch {
    return { ...topic, validated: false };
  }
}

export async function validateDiscoveries(
  orgs: DiscoveredOrg[],
  wikiTopics: DiscoveredWikiTopic[]
): Promise<{
  validatedOrgs: ValidatedOrg[];
  validatedWikiTopics: ValidatedWikiTopic[];
}> {
  // Validate in parallel, but limit concurrency
  const orgResults = await Promise.all(
    orgs.slice(0, 10).map(async (org) => {
      try {
        return await validateOrg(org);
      } catch {
        return { ...org, validated: false } as ValidatedOrg;
      }
    })
  );

  const wikiResults = await Promise.all(
    wikiTopics.slice(0, 10).map(async (topic) => {
      try {
        return await validateWikiTopic(topic);
      } catch {
        return { ...topic, validated: false } as ValidatedWikiTopic;
      }
    })
  );

  return {
    validatedOrgs: orgResults,
    validatedWikiTopics: wikiResults
  };
}

// Classify a URL as org site, news page, blog, etc.
export function classifyUrl(url: string): "org" | "news" | "blog" | "wiki" | "article" | "unknown" {
  const lowered = url.toLowerCase();

  if (lowered.includes("wikipedia.org")) return "wiki";
  if (lowered.includes("/blog")) return "blog";
  if (lowered.includes("/news") || lowered.includes("/press") || lowered.includes("/stories")) return "news";
  if (lowered.includes("/article") || lowered.includes("/post/")) return "article";
  if (lowered.endsWith(".org") || lowered.includes(".org/")) return "org";

  return "unknown";
}
