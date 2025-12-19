import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ARTICLES_DIR } from "./paths";
import type { FetchedArticle } from "./types";

async function ensureArticlesDir(): Promise<void> {
  await fs.mkdir(ARTICLES_DIR, { recursive: true });
}

function articlePath(id: string): string {
  return path.join(ARTICLES_DIR, `${id}.json`);
}

export async function listArticles(options?: {
  sourceId?: string;
  limit?: number;
  minRelevance?: number;
}): Promise<FetchedArticle[]> {
  await ensureArticlesDir();

  try {
    const files = await fs.readdir(ARTICLES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const articles: FetchedArticle[] = [];
    for (const file of jsonFiles) {
      try {
        const data = await fs.readFile(path.join(ARTICLES_DIR, file), "utf8");
        const article = JSON.parse(data) as FetchedArticle;

        // Apply filters
        if (options?.sourceId && article.sourceId !== options.sourceId) continue;
        if (options?.minRelevance && article.relevanceScore < options.minRelevance) continue;

        articles.push(article);
      } catch {
        // Skip corrupted files
      }
    }

    // Sort by fetchedAt descending (newest first)
    articles.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());

    if (options?.limit) {
      return articles.slice(0, options.limit);
    }

    return articles;
  } catch {
    return [];
  }
}

export async function getArticleById(id: string): Promise<FetchedArticle | null> {
  try {
    const data = await fs.readFile(articlePath(id), "utf8");
    return JSON.parse(data) as FetchedArticle;
  } catch {
    return null;
  }
}

export async function getArticleByUrl(url: string): Promise<FetchedArticle | null> {
  const articles = await listArticles();
  return articles.find((a) => a.url === url) ?? null;
}

export async function addArticle(args: {
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  excerpt: string;
  matchedKeywords: string[];
  relevanceScore: number;
}): Promise<FetchedArticle> {
  await ensureArticlesDir();

  // Check if article already exists (by URL)
  const existing = await getArticleByUrl(args.url);
  if (existing) {
    return existing;
  }

  const article: FetchedArticle = {
    id: crypto.randomUUID(),
    sourceId: args.sourceId,
    sourceName: args.sourceName,
    title: args.title,
    url: args.url,
    publishedAt: args.publishedAt,
    fetchedAt: new Date().toISOString(),
    excerpt: args.excerpt,
    matchedKeywords: args.matchedKeywords,
    relevanceScore: args.relevanceScore,
    savedToKnowledge: false
  };

  await fs.writeFile(articlePath(article.id), JSON.stringify(article, null, 2), "utf8");
  return article;
}

export async function markArticleSaved(id: string): Promise<FetchedArticle | null> {
  const article = await getArticleById(id);
  if (!article) return null;

  article.savedToKnowledge = true;
  await fs.writeFile(articlePath(id), JSON.stringify(article, null, 2), "utf8");
  return article;
}

export async function deleteArticle(id: string): Promise<boolean> {
  try {
    await fs.unlink(articlePath(id));
    return true;
  } catch {
    return false;
  }
}

export async function deleteArticlesBySource(sourceId: string): Promise<number> {
  const articles = await listArticles({ sourceId });
  let deleted = 0;
  for (const article of articles) {
    if (await deleteArticle(article.id)) {
      deleted++;
    }
  }
  return deleted;
}
