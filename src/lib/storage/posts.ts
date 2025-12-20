/**
 * Posts storage - public API
 *
 * This module delegates to the configured storage provider.
 */

import { getStorageProvider, initStorage } from "./factory";
import type { BlogPost, BlogPostMeta, PostStatus } from "./types";

export async function getPostById(id: string): Promise<BlogPost | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.posts.getById(id);
}

export async function listPosts(status?: PostStatus): Promise<BlogPostMeta[]> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.posts.list(status);
}

export async function listPublishedPosts(): Promise<BlogPostMeta[]> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.posts.listPublished();
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.posts.getPublishedBySlug(slug);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.posts.getBySlug(slug);
}

export async function createDraft(input: {
  title: string;
  subtitle?: string;
  summary: string;
  keywords: string[];
  seoTitle?: string;
  seoDescription?: string;
  contentMarkdown: string;
}): Promise<BlogPost> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.posts.create(input);
}

export async function updateDraft(
  id: string,
  updates: Partial<Omit<BlogPost, "id" | "createdAt" | "publishedAt">>
): Promise<BlogPost | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.posts.update(id, updates);
}

export async function publishPost(id: string): Promise<BlogPost | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.posts.publish(id);
}

