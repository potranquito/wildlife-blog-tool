/**
 * File-based storage provider
 *
 * Stores data as JSON and text files in the filesystem.
 * This is the original storage implementation, refactored into a provider.
 */

import crypto from "node:crypto";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  IStorageProvider,
  IPostsStorage,
  ISourcesStorage,
  IOrgStorage,
  IWatchedSourcesStorage,
  IArticlesStorage
} from "../interfaces";
import type {
  BlogPost,
  BlogPostMeta,
  PostStatus,
  KnowledgeSource,
  KnowledgeSourceMeta,
  SourceType,
  OrganizationProfile,
  WatchedSource,
  WatchedSourceType,
  FetchedArticle
} from "../types";
import { slugify } from "@/lib/utils/slug";
import { makeSeedProfile } from "../seed";
import { normalizeOrgProfile } from "../orgProfile";

const configuredDataDir = process.env.WILDLIFE_BLOGGER_DATA_DIR?.trim();
const DATA_DIR = configuredDataDir ? path.resolve(configuredDataDir) : path.join(process.cwd(), "data");
const POSTS_DIR = path.join(DATA_DIR, "posts");
const SOURCES_DIR = path.join(DATA_DIR, "sources");
const ORG_PROFILE_PATH = path.join(DATA_DIR, "org.json");
const WATCHED_SOURCES_PATH = path.join(DATA_DIR, "watched-sources.json");
const ARTICLES_DIR = path.join(DATA_DIR, "articles");

// Helper functions
function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function wordCount(text: string) {
  const t = cleanText(text);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function sha256(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// Posts storage implementation
class FilePostsStorage implements IPostsStorage {
  private async readMetaFile(filePath: string): Promise<BlogPostMeta> {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as BlogPostMeta;
  }

  private async readPostById(id: string): Promise<BlogPost | null> {
    try {
      const meta = await this.readMetaFile(`${POSTS_DIR}/${id}.json`);
      const contentMarkdown = await readFile(`${POSTS_DIR}/${id}.md`, "utf8");
      return { ...meta, contentMarkdown };
    } catch {
      return null;
    }
  }

  private async ensureUniqueSlug(slugBase: string, selfId?: string): Promise<string> {
    const metas = await this.list();
    const used = new Set(metas.filter((m) => m.id !== selfId).map((m) => m.slug));

    if (!used.has(slugBase)) return slugBase;

    let i = 2;
    while (used.has(`${slugBase}-${i}`)) i += 1;
    return `${slugBase}-${i}`;
  }

  async getById(id: string): Promise<BlogPost | null> {
    return this.readPostById(id);
  }

  async getBySlug(slug: string): Promise<BlogPost | null> {
    const metas = await this.list();
    const match = metas.find((m) => m.slug === slug);
    if (!match) return null;
    return this.readPostById(match.id);
  }

  async getPublishedBySlug(slug: string): Promise<BlogPost | null> {
    const metas = await this.listPublished();
    const match = metas.find((m) => m.slug === slug);
    if (!match) return null;
    const post = await this.readPostById(match.id);
    if (!post || post.status !== "PUBLISHED") return null;
    return post;
  }

  async list(status?: PostStatus): Promise<BlogPostMeta[]> {
    const files = await readdir(POSTS_DIR);
    const metas: BlogPostMeta[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const meta = await this.readMetaFile(`${POSTS_DIR}/${file}`);
      if (status && meta.status !== status) continue;
      metas.push(meta);
    }

    metas.sort((a, b) => {
      const ad = a.publishedAt ?? a.createdAt;
      const bd = b.publishedAt ?? b.createdAt;
      return bd.localeCompare(ad);
    });

    return metas;
  }

  async listPublished(): Promise<BlogPostMeta[]> {
    return this.list("PUBLISHED");
  }

  async create(input: {
    title: string;
    subtitle?: string;
    summary: string;
    keywords: string[];
    seoTitle?: string;
    seoDescription?: string;
    contentMarkdown: string;
  }): Promise<BlogPost> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slugBase = slugify(input.title);
    const slug = await this.ensureUniqueSlug(slugBase);

    const meta: BlogPostMeta = {
      id,
      slug,
      status: "DRAFT",
      title: input.title,
      subtitle: input.subtitle,
      summary: input.summary,
      keywords: input.keywords,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      createdAt: now,
      updatedAt: now
    };

    await writeFile(`${POSTS_DIR}/${id}.json`, JSON.stringify(meta, null, 2), "utf8");
    await writeFile(`${POSTS_DIR}/${id}.md`, input.contentMarkdown, "utf8");
    return { ...meta, contentMarkdown: input.contentMarkdown };
  }

  async update(
    id: string,
    updates: Partial<Omit<BlogPost, "id" | "createdAt" | "publishedAt">>
  ): Promise<BlogPost | null> {
    const existing = await this.readPostById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    let slug = existing.slug;
    let title = existing.title;

    if (typeof updates.title === "string" && updates.title.trim() && updates.title !== existing.title) {
      title = updates.title;
      if (existing.status !== "PUBLISHED") {
        slug = await this.ensureUniqueSlug(slugify(title), id);
      }
    }

    const meta: BlogPostMeta = {
      id,
      slug,
      status: updates.status ?? existing.status,
      title,
      subtitle: updates.subtitle ?? existing.subtitle,
      summary: updates.summary ?? existing.summary,
      keywords: updates.keywords ?? existing.keywords,
      seoTitle: updates.seoTitle ?? existing.seoTitle,
      seoDescription: updates.seoDescription ?? existing.seoDescription,
      createdAt: existing.createdAt,
      updatedAt: now,
      publishedAt: existing.publishedAt
    };

    const contentMarkdown = updates.contentMarkdown ?? existing.contentMarkdown;
    await writeFile(`${POSTS_DIR}/${id}.json`, JSON.stringify(meta, null, 2), "utf8");
    await writeFile(`${POSTS_DIR}/${id}.md`, contentMarkdown, "utf8");

    return { ...meta, contentMarkdown };
  }

  async publish(id: string): Promise<BlogPost | null> {
    const existing = await this.readPostById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const slug = await this.ensureUniqueSlug(existing.slug, id);

    const meta: BlogPostMeta = {
      ...existing,
      slug,
      status: "PUBLISHED",
      updatedAt: now,
      publishedAt: existing.publishedAt ?? now
    };

    await writeFile(`${POSTS_DIR}/${id}.json`, JSON.stringify(meta, null, 2), "utf8");
    return { ...meta, contentMarkdown: existing.contentMarkdown };
  }
}

// Sources storage implementation
class FileSourcesStorage implements ISourcesStorage {
  private async readMetaFile(filePath: string): Promise<KnowledgeSourceMeta> {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as KnowledgeSourceMeta;
  }

  async list(type?: SourceType): Promise<KnowledgeSourceMeta[]> {
    const files = await readdir(SOURCES_DIR);
    const metas: KnowledgeSourceMeta[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const meta = await this.readMetaFile(`${SOURCES_DIR}/${file}`);
      if (type && meta.type !== type) continue;
      metas.push(meta);
    }

    metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return metas;
  }

  async getById(id: string): Promise<KnowledgeSource | null> {
    try {
      const meta = await this.readMetaFile(`${SOURCES_DIR}/${id}.json`);
      const contentText = await readFile(`${SOURCES_DIR}/${id}.txt`, "utf8");
      return { ...meta, contentText };
    } catch {
      return null;
    }
  }

  async createFromText(input: {
    type: SourceType;
    title: string;
    url?: string;
    contentText: string;
  }): Promise<KnowledgeSource> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const contentText = input.contentText.slice(0, 200_000);
    const meta: KnowledgeSourceMeta = {
      id,
      type: input.type,
      title: input.title.trim() || "Untitled source",
      url: input.url,
      createdAt,
      wordCount: wordCount(contentText),
      sha256: sha256(contentText)
    };

    await writeFile(`${SOURCES_DIR}/${id}.json`, JSON.stringify(meta, null, 2), "utf8");
    await writeFile(`${SOURCES_DIR}/${id}.txt`, contentText, "utf8");

    return { ...meta, contentText };
  }
}

// Organization storage implementation
class FileOrgStorage implements IOrgStorage {
  async get(): Promise<OrganizationProfile> {
    try {
      const raw = await readFile(ORG_PROFILE_PATH, "utf8");
      return normalizeOrgProfile(JSON.parse(raw));
    } catch {
      return makeSeedProfile();
    }
  }

  async update(profile: OrganizationProfile): Promise<OrganizationProfile> {
    await writeFile(ORG_PROFILE_PATH, JSON.stringify(profile, null, 2), "utf8");
    return profile;
  }
}

// Watched sources storage implementation
class FileWatchedSourcesStorage implements IWatchedSourcesStorage {
  private async readWatchedSources(): Promise<WatchedSource[]> {
    try {
      const data = await readFile(WATCHED_SOURCES_PATH, "utf8");
      return JSON.parse(data) as WatchedSource[];
    } catch {
      return [];
    }
  }

  private async writeWatchedSources(sources: WatchedSource[]): Promise<void> {
    await writeFile(WATCHED_SOURCES_PATH, JSON.stringify(sources, null, 2), "utf8");
  }

  async list(): Promise<WatchedSource[]> {
    return this.readWatchedSources();
  }

  async getById(id: string): Promise<WatchedSource | null> {
    const sources = await this.readWatchedSources();
    return sources.find((s) => s.id === id) ?? null;
  }

  async add(args: {
    name: string;
    url: string;
    type: WatchedSourceType;
    fetchIntervalHours?: number;
  }): Promise<WatchedSource> {
    const sources = await this.readWatchedSources();

    const existing = sources.find((s) => s.url === args.url);
    if (existing) {
      throw new Error("This URL is already being watched");
    }

    const source: WatchedSource = {
      id: crypto.randomUUID(),
      name: args.name,
      url: args.url,
      type: args.type,
      enabled: true,
      lastFetchedAt: null,
      fetchIntervalHours: args.fetchIntervalHours ?? 24,
      createdAt: new Date().toISOString()
    };

    sources.push(source);
    await this.writeWatchedSources(sources);
    return source;
  }

  async update(
    id: string,
    updates: Partial<Pick<WatchedSource, "name" | "enabled" | "fetchIntervalHours" | "lastFetchedAt">>
  ): Promise<WatchedSource | null> {
    const sources = await this.readWatchedSources();
    const index = sources.findIndex((s) => s.id === id);
    if (index === -1) return null;

    sources[index] = { ...sources[index], ...updates };
    await this.writeWatchedSources(sources);
    return sources[index];
  }

  async delete(id: string): Promise<boolean> {
    const sources = await this.readWatchedSources();
    const filtered = sources.filter((s) => s.id !== id);
    if (filtered.length === sources.length) return false;

    await this.writeWatchedSources(filtered);
    return true;
  }

  async getDueForFetch(): Promise<WatchedSource[]> {
    const sources = await this.readWatchedSources();
    const now = Date.now();

    return sources.filter((s) => {
      if (!s.enabled) return false;
      if (!s.lastFetchedAt) return true;

      const lastFetch = new Date(s.lastFetchedAt).getTime();
      const intervalMs = s.fetchIntervalHours * 60 * 60 * 1000;
      return now - lastFetch >= intervalMs;
    });
  }
}

// Articles storage implementation
class FileArticlesStorage implements IArticlesStorage {
  private articlePath(id: string): string {
    return path.join(ARTICLES_DIR, `${id}.json`);
  }

  async list(options?: {
    sourceId?: string;
    limit?: number;
    minRelevance?: number;
  }): Promise<FetchedArticle[]> {
    try {
      const files = await readdir(ARTICLES_DIR);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const articles: FetchedArticle[] = [];
      for (const file of jsonFiles) {
        try {
          const data = await readFile(path.join(ARTICLES_DIR, file), "utf8");
          const article = JSON.parse(data) as FetchedArticle;

          if (options?.sourceId && article.sourceId !== options.sourceId) continue;
          if (options?.minRelevance && article.relevanceScore < options.minRelevance) continue;

          articles.push(article);
        } catch {
          // Skip corrupted files
        }
      }

      articles.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());

      if (options?.limit) {
        return articles.slice(0, options.limit);
      }

      return articles;
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<FetchedArticle | null> {
    try {
      const data = await readFile(this.articlePath(id), "utf8");
      return JSON.parse(data) as FetchedArticle;
    } catch {
      return null;
    }
  }

  async getByUrl(url: string): Promise<FetchedArticle | null> {
    const articles = await this.list();
    return articles.find((a) => a.url === url) ?? null;
  }

  async add(args: {
    sourceId: string;
    sourceName: string;
    title: string;
    url: string;
    publishedAt: string | null;
    excerpt: string;
    matchedKeywords: string[];
    relevanceScore: number;
  }): Promise<FetchedArticle> {
    const existing = await this.getByUrl(args.url);
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

    await writeFile(this.articlePath(article.id), JSON.stringify(article, null, 2), "utf8");
    return article;
  }

  async markSaved(id: string): Promise<FetchedArticle | null> {
    const article = await this.getById(id);
    if (!article) return null;

    article.savedToKnowledge = true;
    await writeFile(this.articlePath(id), JSON.stringify(article, null, 2), "utf8");
    return article;
  }

  async delete(id: string): Promise<boolean> {
    try {
      const fs = await import("node:fs/promises");
      await fs.unlink(this.articlePath(id));
      return true;
    } catch {
      return false;
    }
  }

  async deleteBySource(sourceId: string): Promise<number> {
    const articles = await this.list({ sourceId });
    let deleted = 0;
    for (const article of articles) {
      if (await this.delete(article.id)) {
        deleted++;
      }
    }
    return deleted;
  }
}

// Main provider implementation
export class FileStorageProvider implements IStorageProvider {
  posts: IPostsStorage;
  sources: ISourcesStorage;
  org: IOrgStorage;
  watchedSources: IWatchedSourcesStorage;
  articles: IArticlesStorage;

  constructor() {
    this.posts = new FilePostsStorage();
    this.sources = new FileSourcesStorage();
    this.org = new FileOrgStorage();
    this.watchedSources = new FileWatchedSourcesStorage();
    this.articles = new FileArticlesStorage();
  }

  async init(): Promise<void> {
    // Create directories if they don't exist
    await mkdir(DATA_DIR, { recursive: true });
    await mkdir(POSTS_DIR, { recursive: true });
    await mkdir(SOURCES_DIR, { recursive: true });
    await mkdir(ARTICLES_DIR, { recursive: true });

    // Create watched sources file if it doesn't exist
    try {
      await readFile(WATCHED_SOURCES_PATH, "utf8");
    } catch {
      await writeFile(WATCHED_SOURCES_PATH, JSON.stringify([], null, 2), "utf8");
    }

    // Initialize org profile (normalize if exists, create seed if not)
    await this.initOrgProfile();

    // Seed a sample post if none exist
    await this.seedSamplePostIfNeeded();
  }

  private async initOrgProfile(): Promise<void> {
    try {
      const raw = await readFile(ORG_PROFILE_PATH, "utf8");
      const json = JSON.parse(raw) as unknown;
      const normalized = normalizeOrgProfile(json, { markOnboardingCompleteIfLegacyCustomized: true });
      const next = JSON.stringify(normalized, null, 2);
      if (raw.trim() !== next.trim()) {
        await writeFile(ORG_PROFILE_PATH, next, "utf8");
      }
    } catch {
      const profile = makeSeedProfile();
      await writeFile(ORG_PROFILE_PATH, JSON.stringify(profile, null, 2), "utf8");
    }
  }

  private async seedSamplePostIfNeeded(): Promise<void> {
    try {
      const posts = await readdir(POSTS_DIR);
      const hasAnyPost = posts.some((f) => f.endsWith(".json"));
      if (hasAnyPost) return;

      // Import seed dynamically to avoid circular dependency
      const { makeSeedPost } = await import("../seed");
      const seed = makeSeedPost();
      await writeFile(`${POSTS_DIR}/${seed.id}.json`, JSON.stringify(seed.meta, null, 2), "utf8");
      await writeFile(`${POSTS_DIR}/${seed.id}.md`, seed.markdown, "utf8");
    } catch (err) {
      // Seeding is optional, don't fail initialization
      console.error("Failed to seed sample post:", err);
    }
  }

  async close(): Promise<void> {
    // No cleanup needed for file storage
  }
}
