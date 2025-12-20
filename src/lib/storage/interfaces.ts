/**
 * Storage abstraction interfaces
 *
 * This allows switching between different storage backends (file, database, etc.)
 * without changing the application code.
 */

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
} from "./types";

/**
 * Posts storage operations
 */
export interface IPostsStorage {
  getById(id: string): Promise<BlogPost | null>;
  getBySlug(slug: string): Promise<BlogPost | null>;
  getPublishedBySlug(slug: string): Promise<BlogPost | null>;
  list(status?: PostStatus): Promise<BlogPostMeta[]>;
  listPublished(): Promise<BlogPostMeta[]>;
  create(input: {
    title: string;
    subtitle?: string;
    summary: string;
    keywords: string[];
    seoTitle?: string;
    seoDescription?: string;
    contentMarkdown: string;
  }): Promise<BlogPost>;
  update(
    id: string,
    updates: Partial<Omit<BlogPost, "id" | "createdAt" | "publishedAt">>
  ): Promise<BlogPost | null>;
  publish(id: string): Promise<BlogPost | null>;
}

/**
 * Knowledge sources storage operations
 */
export interface ISourcesStorage {
  list(type?: SourceType): Promise<KnowledgeSourceMeta[]>;
  getById(id: string): Promise<KnowledgeSource | null>;
  createFromText(input: {
    type: SourceType;
    title: string;
    url?: string;
    contentText: string;
  }): Promise<KnowledgeSource>;
}

/**
 * Organization profile storage operations
 */
export interface IOrgStorage {
  get(): Promise<OrganizationProfile>;
  update(profile: OrganizationProfile): Promise<OrganizationProfile>;
}

/**
 * Watched sources storage operations
 */
export interface IWatchedSourcesStorage {
  list(): Promise<WatchedSource[]>;
  getById(id: string): Promise<WatchedSource | null>;
  add(args: {
    name: string;
    url: string;
    type: WatchedSourceType;
    fetchIntervalHours?: number;
  }): Promise<WatchedSource>;
  update(
    id: string,
    updates: Partial<Pick<WatchedSource, "name" | "enabled" | "fetchIntervalHours" | "lastFetchedAt">>
  ): Promise<WatchedSource | null>;
  delete(id: string): Promise<boolean>;
  getDueForFetch(): Promise<WatchedSource[]>;
}

/**
 * Articles storage operations
 */
export interface IArticlesStorage {
  list(options?: {
    sourceId?: string;
    limit?: number;
    minRelevance?: number;
  }): Promise<FetchedArticle[]>;
  getById(id: string): Promise<FetchedArticle | null>;
  getByUrl(url: string): Promise<FetchedArticle | null>;
  add(args: {
    sourceId: string;
    sourceName: string;
    title: string;
    url: string;
    publishedAt: string | null;
    excerpt: string;
    matchedKeywords: string[];
    relevanceScore: number;
  }): Promise<FetchedArticle>;
  markSaved(id: string): Promise<FetchedArticle | null>;
  delete(id: string): Promise<boolean>;
  deleteBySource(sourceId: string): Promise<number>;
}

/**
 * Main storage provider interface
 *
 * A storage provider implements all sub-storage interfaces
 */
export interface IStorageProvider {
  posts: IPostsStorage;
  sources: ISourcesStorage;
  org: IOrgStorage;
  watchedSources: IWatchedSourcesStorage;
  articles: IArticlesStorage;

  /**
   * Initialize the storage (create tables, directories, etc.)
   */
  init(): Promise<void>;

  /**
   * Close connections, cleanup resources
   */
  close(): Promise<void>;
}
