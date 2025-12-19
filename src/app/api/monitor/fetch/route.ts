import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import {
  listWatchedSources,
  getWatchedSourceById,
  updateWatchedSource
} from "@/lib/storage/watched-sources";
import { addArticle } from "@/lib/storage/articles";
import { getOrgProfile } from "@/lib/storage/org";
import { parseRssFeed } from "@/lib/feeds/parse-rss";
import { parseHtmlNewsPage } from "@/lib/feeds/parse-html";
import { tagArticle } from "@/lib/feeds/tag-article";
import type { WatchedSource } from "@/lib/storage/types";

const FetchSchema = z.object({
  sourceId: z.string().optional() // If not provided, fetch all enabled sources
});

async function fetchSourceArticles(source: WatchedSource): Promise<{
  newArticles: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let newArticles = 0;

  try {
    // Parse the feed/page
    const articles =
      source.type === "RSS"
        ? await parseRssFeed(source.url)
        : await parseHtmlNewsPage(source.url);

    // Get org profile for tagging
    const orgProfile = await getOrgProfile();

    // Process each article
    for (const article of articles) {
      try {
        // Tag the article
        const { matchedKeywords, relevanceScore } = tagArticle(
          { title: article.title, excerpt: article.excerpt },
          orgProfile
        );

        // Add to storage (will skip if URL already exists)
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

        // Check if it was actually new (not a duplicate)
        const isNew = new Date(saved.fetchedAt).getTime() > Date.now() - 5000;
        if (isNew) {
          newArticles++;
        }
      } catch (e) {
        errors.push(`Failed to process article: ${article.title}`);
      }
    }

    // Update last fetched timestamp
    await updateWatchedSource(source.id, {
      lastFetchedAt: new Date().toISOString()
    });
  } catch (e) {
    errors.push(`Failed to fetch source ${source.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  return { newArticles, errors };
}

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Empty body is fine
  }

  const parsed = FetchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const results: Array<{
    sourceId: string;
    sourceName: string;
    newArticles: number;
    errors: string[];
  }> = [];

  if (parsed.data.sourceId) {
    // Fetch single source
    const source = await getWatchedSourceById(parsed.data.sourceId);
    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const result = await fetchSourceArticles(source);
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      ...result
    });
  } else {
    // Fetch all enabled sources
    const sources = await listWatchedSources();
    const enabledSources = sources.filter((s) => s.enabled);

    for (const source of enabledSources) {
      const result = await fetchSourceArticles(source);
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        ...result
      });
    }
  }

  const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  return NextResponse.json({
    results,
    summary: {
      sourcesProcessed: results.length,
      totalNewArticles: totalNew,
      totalErrors
    }
  });
}
