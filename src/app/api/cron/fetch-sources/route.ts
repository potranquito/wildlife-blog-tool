import { NextResponse } from "next/server";
import { getSourcesDueForFetch, updateWatchedSource } from "@/lib/storage/watched-sources";
import { addArticle } from "@/lib/storage/articles";
import { getOrgProfile } from "@/lib/storage/org";
import { parseRssFeed } from "@/lib/feeds/parse-rss";
import { parseHtmlNewsPage } from "@/lib/feeds/parse-html";
import { tagArticle } from "@/lib/feeds/tag-article";
import type { WatchedSource } from "@/lib/storage/types";

// Verify cron secret for security
function verifyCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  // If no secret configured, allow in development only
  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === cronSecret;
  }

  // Check x-cron-secret header (alternative)
  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader) {
    return cronHeader === cronSecret;
  }

  return false;
}

async function fetchSourceArticles(source: WatchedSource): Promise<{
  newArticles: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let newArticles = 0;

  try {
    const articles =
      source.type === "RSS"
        ? await parseRssFeed(source.url)
        : await parseHtmlNewsPage(source.url);

    const orgProfile = await getOrgProfile();

    for (const article of articles) {
      try {
        const { matchedKeywords, relevanceScore } = tagArticle(
          { title: article.title, excerpt: article.excerpt },
          orgProfile
        );

        const saved = await addArticle({
          sourceId: source.id,
          sourceName: source.name,
          title: article.title,
          url: article.url,
          publishedAt: article.publishedAt,
          excerpt: article.excerpt,
          matchedKeywords,
          relevanceScore
        });

        const isNew = new Date(saved.fetchedAt).getTime() > Date.now() - 5000;
        if (isNew) {
          newArticles++;
        }
      } catch {
        errors.push(`Failed to process: ${article.title}`);
      }
    }

    await updateWatchedSource(source.id, {
      lastFetchedAt: new Date().toISOString()
    });
  } catch (e) {
    errors.push(`Failed to fetch ${source.name}: ${e instanceof Error ? e.message : "Unknown"}`);
  }

  return { newArticles, errors };
}

export async function POST(request: Request) {
  // Verify authentication
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get sources that are due for fetching
  const sourcesDue = await getSourcesDueForFetch();

  if (sourcesDue.length === 0) {
    return NextResponse.json({
      message: "No sources due for fetching",
      sourcesProcessed: 0,
      totalNewArticles: 0
    });
  }

  const results: Array<{
    sourceId: string;
    sourceName: string;
    newArticles: number;
    errors: string[];
  }> = [];

  for (const source of sourcesDue) {
    const result = await fetchSourceArticles(source);
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      ...result
    });
  }

  const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  return NextResponse.json({
    message: "Cron fetch completed",
    results,
    summary: {
      sourcesProcessed: results.length,
      totalNewArticles: totalNew,
      totalErrors
    }
  });
}

// Also support GET for simpler cron services
export async function GET(request: Request) {
  return POST(request);
}
