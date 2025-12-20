/**
 * Articles storage - public API
 *
 * This module delegates to the configured storage provider.
 */

import { getStorageProvider, initStorage } from "./factory";
import type { FetchedArticle } from "./types";

export async function listArticles(options?: {
  sourceId?: string;
  limit?: number;
  minRelevance?: number;
}): Promise<FetchedArticle[]> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.articles.list(options);
}

export async function getArticleById(id: string): Promise<FetchedArticle | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.articles.getById(id);
}

export async function getArticleByUrl(url: string): Promise<FetchedArticle | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.articles.getByUrl(url);
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
  await initStorage();
  const provider = getStorageProvider();
  return provider.articles.add(args);
}

export async function markArticleSaved(id: string): Promise<FetchedArticle | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.articles.markSaved(id);
}

export async function deleteArticle(id: string): Promise<boolean> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.articles.delete(id);
}

export async function deleteArticlesBySource(sourceId: string): Promise<number> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.articles.deleteBySource(sourceId);
}
