/**
 * PostgreSQL storage provider
 *
 * Stores data in a PostgreSQL database for production use.
 * Provides better performance, concurrent access, and reliability than file storage.
 */

import { Pool, PoolClient } from "pg";
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
import crypto from "node:crypto";

// Database connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required for PostgreSQL storage");
    }
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

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
class PostgresPostsStorage implements IPostsStorage {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getById(id: string): Promise<BlogPost | null> {
    const result = await this.pool.query(
      `SELECT p.*, pc.content_markdown
       FROM posts p
       JOIN post_content pc ON p.id = pc.post_id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return this.rowToPost(row);
  }

  async getBySlug(slug: string): Promise<BlogPost | null> {
    const result = await this.pool.query(
      `SELECT p.*, pc.content_markdown
       FROM posts p
       JOIN post_content pc ON p.id = pc.post_id
       WHERE p.slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return this.rowToPost(row);
  }

  async getPublishedBySlug(slug: string): Promise<BlogPost | null> {
    const result = await this.pool.query(
      `SELECT p.*, pc.content_markdown
       FROM posts p
       JOIN post_content pc ON p.id = pc.post_id
       WHERE p.slug = $1 AND p.status = 'PUBLISHED'`,
      [slug]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return this.rowToPost(row);
  }

  async list(status?: PostStatus): Promise<BlogPostMeta[]> {
    const query = status
      ? `SELECT * FROM posts WHERE status = $1 ORDER BY COALESCE(published_at, created_at) DESC`
      : `SELECT * FROM posts ORDER BY COALESCE(published_at, created_at) DESC`;

    const result = status
      ? await this.pool.query(query, [status])
      : await this.pool.query(query);

    return result.rows.map(row => this.rowToPostMeta(row));
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
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const id = crypto.randomUUID();
      const slugBase = slugify(input.title);
      const slug = await this.ensureUniqueSlug(slugBase, undefined, client);

      const result = await client.query(
        `INSERT INTO posts (id, slug, status, title, subtitle, summary, keywords, seo_title, seo_description)
         VALUES ($1, $2, 'DRAFT', $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          id,
          slug,
          input.title,
          input.subtitle || null,
          input.summary,
          JSON.stringify(input.keywords),
          input.seoTitle || null,
          input.seoDescription || null
        ]
      );

      await client.query(
        `INSERT INTO post_content (post_id, content_markdown)
         VALUES ($1, $2)`,
        [id, input.contentMarkdown]
      );

      await client.query('COMMIT');

      return {
        ...this.rowToPostMeta(result.rows[0]),
        contentMarkdown: input.contentMarkdown
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(
    id: string,
    updates: Partial<Omit<BlogPost, "id" | "createdAt" | "publishedAt">>
  ): Promise<BlogPost | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let slug = existing.slug;
      let title = existing.title;

      if (typeof updates.title === "string" && updates.title.trim() && updates.title !== existing.title) {
        title = updates.title;
        if (existing.status !== "PUBLISHED") {
          slug = await this.ensureUniqueSlug(slugify(title), id, client);
        }
      }

      const result = await client.query(
        `UPDATE posts
         SET slug = $1,
             status = $2,
             title = $3,
             subtitle = $4,
             summary = $5,
             keywords = $6,
             seo_title = $7,
             seo_description = $8,
             updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          slug,
          updates.status ?? existing.status,
          title,
          updates.subtitle !== undefined ? (updates.subtitle || null) : existing.subtitle,
          updates.summary ?? existing.summary,
          JSON.stringify(updates.keywords ?? existing.keywords),
          updates.seoTitle !== undefined ? (updates.seoTitle || null) : existing.seoTitle,
          updates.seoDescription !== undefined ? (updates.seoDescription || null) : existing.seoDescription,
          id
        ]
      );

      if (updates.contentMarkdown !== undefined) {
        await client.query(
          `UPDATE post_content
           SET content_markdown = $1,
               updated_at = NOW()
           WHERE post_id = $2`,
          [updates.contentMarkdown, id]
        );
      }

      await client.query('COMMIT');

      const contentMarkdown = updates.contentMarkdown ?? existing.contentMarkdown;
      return {
        ...this.rowToPostMeta(result.rows[0]),
        contentMarkdown
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async publish(id: string): Promise<BlogPost | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const slug = await this.ensureUniqueSlug(existing.slug, id, client);
      const publishedAt = existing.publishedAt || new Date().toISOString();

      const result = await client.query(
        `UPDATE posts
         SET slug = $1,
             status = 'PUBLISHED',
             published_at = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [slug, publishedAt, id]
      );

      await client.query('COMMIT');

      return {
        ...this.rowToPostMeta(result.rows[0]),
        contentMarkdown: existing.contentMarkdown
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async ensureUniqueSlug(slugBase: string, selfId: string | undefined, client: PoolClient): Promise<string> {
    const query = selfId
      ? `SELECT slug FROM posts WHERE id != $1`
      : `SELECT slug FROM posts`;

    const result = selfId
      ? await client.query(query, [selfId])
      : await client.query(query);

    const used = new Set(result.rows.map(row => row.slug));

    if (!used.has(slugBase)) return slugBase;

    let i = 2;
    while (used.has(`${slugBase}-${i}`)) i += 1;
    return `${slugBase}-${i}`;
  }

  private rowToPostMeta(row: any): BlogPostMeta {
    return {
      id: row.id,
      slug: row.slug,
      status: row.status as PostStatus,
      title: row.title,
      subtitle: row.subtitle || undefined,
      summary: row.summary,
      keywords: Array.isArray(row.keywords) ? row.keywords : JSON.parse(row.keywords || '[]'),
      seoTitle: row.seo_title || undefined,
      seoDescription: row.seo_description || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      publishedAt: row.published_at?.toISOString()
    };
  }

  private rowToPost(row: any): BlogPost {
    return {
      ...this.rowToPostMeta(row),
      contentMarkdown: row.content_markdown
    };
  }
}

// Sources storage implementation
class PostgresSourcesStorage implements ISourcesStorage {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async list(type?: SourceType): Promise<KnowledgeSourceMeta[]> {
    const query = type
      ? `SELECT * FROM sources WHERE type = $1 ORDER BY created_at DESC`
      : `SELECT * FROM sources ORDER BY created_at DESC`;

    const result = type
      ? await this.pool.query(query, [type])
      : await this.pool.query(query);

    return result.rows.map(row => this.rowToSourceMeta(row));
  }

  async getById(id: string): Promise<KnowledgeSource | null> {
    const result = await this.pool.query(
      `SELECT s.*, sc.content_text
       FROM sources s
       JOIN source_content sc ON s.id = sc.source_id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return this.rowToSource(row);
  }

  async createFromText(input: {
    type: SourceType;
    title: string;
    url?: string;
    contentText: string;
  }): Promise<KnowledgeSource> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const id = crypto.randomUUID();
      const contentText = input.contentText.slice(0, 200_000);

      const result = await client.query(
        `INSERT INTO sources (id, type, title, url, word_count, sha256)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          id,
          input.type,
          input.title.trim() || "Untitled source",
          input.url || null,
          wordCount(contentText),
          sha256(contentText)
        ]
      );

      await client.query(
        `INSERT INTO source_content (source_id, content_text)
         VALUES ($1, $2)`,
        [id, contentText]
      );

      await client.query('COMMIT');

      return {
        ...this.rowToSourceMeta(result.rows[0]),
        contentText
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private rowToSourceMeta(row: any): KnowledgeSourceMeta {
    return {
      id: row.id,
      type: row.type as SourceType,
      title: row.title,
      url: row.url || undefined,
      createdAt: row.created_at.toISOString(),
      wordCount: row.word_count,
      sha256: row.sha256
    };
  }

  private rowToSource(row: any): KnowledgeSource {
    return {
      ...this.rowToSourceMeta(row),
      contentText: row.content_text
    };
  }
}

// Organization storage implementation
class PostgresOrgStorage implements IOrgStorage {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async get(): Promise<OrganizationProfile> {
    const result = await this.pool.query(`SELECT * FROM organization LIMIT 1`);

    if (result.rows.length === 0) {
      // No org exists, return seed
      return makeSeedProfile();
    }

    const row = result.rows[0];
    return this.rowToOrg(row);
  }

  async update(profile: OrganizationProfile): Promise<OrganizationProfile> {
    const existing = await this.pool.query(`SELECT id FROM organization LIMIT 1`);

    if (existing.rows.length === 0) {
      // Insert new org
      const result = await this.pool.query(
        `INSERT INTO organization (name, website, tagline, mission, focus_areas, objectives, voice_guidelines, preferred_terms, avoid_terms, onboarding_completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          profile.name,
          profile.website,
          profile.tagline,
          profile.mission,
          JSON.stringify(profile.focusAreas),
          JSON.stringify(profile.objectives),
          profile.voiceGuidelines,
          JSON.stringify(profile.preferredTerms),
          JSON.stringify(profile.avoidTerms),
          profile.onboardingCompletedAt
        ]
      );
      return this.rowToOrg(result.rows[0]);
    } else {
      // Update existing org
      const id = existing.rows[0].id;
      const result = await this.pool.query(
        `UPDATE organization
         SET name = $1,
             website = $2,
             tagline = $3,
             mission = $4,
             focus_areas = $5,
             objectives = $6,
             voice_guidelines = $7,
             preferred_terms = $8,
             avoid_terms = $9,
             onboarding_completed_at = $10,
             updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [
          profile.name,
          profile.website,
          profile.tagline,
          profile.mission,
          JSON.stringify(profile.focusAreas),
          JSON.stringify(profile.objectives),
          profile.voiceGuidelines,
          JSON.stringify(profile.preferredTerms),
          JSON.stringify(profile.avoidTerms),
          profile.onboardingCompletedAt,
          id
        ]
      );
      return this.rowToOrg(result.rows[0]);
    }
  }

  private rowToOrg(row: any): OrganizationProfile {
    return {
      name: row.name,
      website: row.website,
      tagline: row.tagline,
      mission: row.mission,
      focusAreas: Array.isArray(row.focus_areas) ? row.focus_areas : JSON.parse(row.focus_areas || '[]'),
      objectives: Array.isArray(row.objectives) ? row.objectives : JSON.parse(row.objectives || '[]'),
      voiceGuidelines: row.voice_guidelines,
      preferredTerms: Array.isArray(row.preferred_terms) ? row.preferred_terms : JSON.parse(row.preferred_terms || '[]'),
      avoidTerms: Array.isArray(row.avoid_terms) ? row.avoid_terms : JSON.parse(row.avoid_terms || '[]'),
      onboardingCompletedAt: row.onboarding_completed_at?.toISOString() || null
    };
  }
}

// Watched sources storage implementation
class PostgresWatchedSourcesStorage implements IWatchedSourcesStorage {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async list(): Promise<WatchedSource[]> {
    const result = await this.pool.query(`SELECT * FROM watched_sources ORDER BY created_at DESC`);
    return result.rows.map(row => this.rowToWatchedSource(row));
  }

  async getById(id: string): Promise<WatchedSource | null> {
    const result = await this.pool.query(`SELECT * FROM watched_sources WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return this.rowToWatchedSource(result.rows[0]);
  }

  async add(args: {
    name: string;
    url: string;
    type: WatchedSourceType;
    fetchIntervalHours?: number;
  }): Promise<WatchedSource> {
    // Check for duplicate URL
    const existing = await this.pool.query(`SELECT id FROM watched_sources WHERE url = $1`, [args.url]);
    if (existing.rows.length > 0) {
      throw new Error("This URL is already being watched");
    }

    const result = await this.pool.query(
      `INSERT INTO watched_sources (id, name, url, type, fetch_interval_hours)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        crypto.randomUUID(),
        args.name,
        args.url,
        args.type,
        args.fetchIntervalHours ?? 24
      ]
    );

    return this.rowToWatchedSource(result.rows[0]);
  }

  async update(
    id: string,
    updates: Partial<Pick<WatchedSource, "name" | "enabled" | "fetchIntervalHours" | "lastFetchedAt">>
  ): Promise<WatchedSource | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const result = await this.pool.query(
      `UPDATE watched_sources
       SET name = $1,
           enabled = $2,
           fetch_interval_hours = $3,
           last_fetched_at = $4
       WHERE id = $5
       RETURNING *`,
      [
        updates.name ?? existing.name,
        updates.enabled ?? existing.enabled,
        updates.fetchIntervalHours ?? existing.fetchIntervalHours,
        updates.lastFetchedAt ?? existing.lastFetchedAt,
        id
      ]
    );

    return this.rowToWatchedSource(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM watched_sources WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getDueForFetch(): Promise<WatchedSource[]> {
    const result = await this.pool.query(
      `SELECT * FROM watched_sources
       WHERE enabled = true
         AND (
           last_fetched_at IS NULL
           OR last_fetched_at <= NOW() - (fetch_interval_hours * INTERVAL '1 hour')
         )
       ORDER BY last_fetched_at NULLS FIRST`
    );

    return result.rows.map(row => this.rowToWatchedSource(row));
  }

  private rowToWatchedSource(row: any): WatchedSource {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      type: row.type as WatchedSourceType,
      enabled: row.enabled,
      lastFetchedAt: row.last_fetched_at?.toISOString() || null,
      fetchIntervalHours: row.fetch_interval_hours,
      createdAt: row.created_at.toISOString()
    };
  }
}

// Articles storage implementation
class PostgresArticlesStorage implements IArticlesStorage {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async list(options?: {
    sourceId?: string;
    limit?: number;
    minRelevance?: number;
  }): Promise<FetchedArticle[]> {
    let query = `SELECT * FROM articles WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.sourceId) {
      query += ` AND source_id = $${paramIndex}`;
      params.push(options.sourceId);
      paramIndex++;
    }

    if (options?.minRelevance !== undefined) {
      query += ` AND relevance_score >= $${paramIndex}`;
      params.push(options.minRelevance);
      paramIndex++;
    }

    query += ` ORDER BY fetched_at DESC`;

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.rowToArticle(row));
  }

  async getById(id: string): Promise<FetchedArticle | null> {
    const result = await this.pool.query(`SELECT * FROM articles WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return this.rowToArticle(result.rows[0]);
  }

  async getByUrl(url: string): Promise<FetchedArticle | null> {
    const result = await this.pool.query(`SELECT * FROM articles WHERE url = $1`, [url]);
    if (result.rows.length === 0) return null;
    return this.rowToArticle(result.rows[0]);
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
    // Check if article already exists
    const existing = await this.getByUrl(args.url);
    if (existing) {
      return existing;
    }

    const result = await this.pool.query(
      `INSERT INTO articles (id, source_id, source_name, title, url, published_at, excerpt, matched_keywords, relevance_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        crypto.randomUUID(),
        args.sourceId,
        args.sourceName,
        args.title,
        args.url,
        args.publishedAt,
        args.excerpt,
        JSON.stringify(args.matchedKeywords),
        args.relevanceScore
      ]
    );

    return this.rowToArticle(result.rows[0]);
  }

  async markSaved(id: string): Promise<FetchedArticle | null> {
    const result = await this.pool.query(
      `UPDATE articles
       SET saved_to_knowledge = true
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToArticle(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM articles WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteBySource(sourceId: string): Promise<number> {
    const result = await this.pool.query(`DELETE FROM articles WHERE source_id = $1`, [sourceId]);
    return result.rowCount ?? 0;
  }

  private rowToArticle(row: any): FetchedArticle {
    return {
      id: row.id,
      sourceId: row.source_id,
      sourceName: row.source_name,
      title: row.title,
      url: row.url,
      publishedAt: row.published_at?.toISOString() || null,
      fetchedAt: row.fetched_at.toISOString(),
      excerpt: row.excerpt,
      matchedKeywords: Array.isArray(row.matched_keywords) ? row.matched_keywords : JSON.parse(row.matched_keywords || '[]'),
      relevanceScore: parseFloat(row.relevance_score),
      savedToKnowledge: row.saved_to_knowledge
    };
  }
}

// Main provider implementation
export class PostgresStorageProvider implements IStorageProvider {
  private pool: Pool;
  posts: IPostsStorage;
  sources: ISourcesStorage;
  org: IOrgStorage;
  watchedSources: IWatchedSourcesStorage;
  articles: IArticlesStorage;

  constructor() {
    this.pool = getPool();
    this.posts = new PostgresPostsStorage(this.pool);
    this.sources = new PostgresSourcesStorage(this.pool);
    this.org = new PostgresOrgStorage(this.pool);
    this.watchedSources = new PostgresWatchedSourcesStorage(this.pool);
    this.articles = new PostgresArticlesStorage(this.pool);
  }

  async init(): Promise<void> {
    // Test connection
    try {
      await this.pool.query('SELECT 1');
    } catch (err) {
      throw new Error(`Failed to connect to PostgreSQL database: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Ensure organization exists (seed if not)
    const orgResult = await this.pool.query(`SELECT COUNT(*) as count FROM organization`);
    if (parseInt(orgResult.rows[0].count) === 0) {
      const profile = makeSeedProfile();
      await this.org.update(profile);
    }

    // Seed sample post if none exist
    const postsResult = await this.pool.query(`SELECT COUNT(*) as count FROM posts`);
    if (parseInt(postsResult.rows[0].count) === 0) {
      try {
        const { makeSeedPost } = await import("../seed");
        const seed = makeSeedPost();

        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');

          await client.query(
            `INSERT INTO posts (id, slug, status, title, subtitle, summary, keywords, seo_title, seo_description, published_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [
              seed.id,
              seed.meta.slug,
              seed.meta.status,
              seed.meta.title,
              seed.meta.subtitle || null,
              seed.meta.summary,
              JSON.stringify(seed.meta.keywords),
              seed.meta.seoTitle || null,
              seed.meta.seoDescription || null
            ]
          );

          await client.query(
            `INSERT INTO post_content (post_id, content_markdown)
             VALUES ($1, $2)`,
            [seed.id, seed.markdown]
          );

          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        console.error("Failed to seed sample post:", err);
      }
    }
  }

  async close(): Promise<void> {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }
}
