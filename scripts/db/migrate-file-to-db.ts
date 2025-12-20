#!/usr/bin/env ts-node
/**
 * Migrate data from file storage to PostgreSQL
 *
 * This script reads all data from the file-based storage and imports it into PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=<connection-string> pnpm tsx scripts/db/migrate-file-to-db.ts
 */

import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const configuredDataDir = process.env.WILDLIFE_BLOGGER_DATA_DIR?.trim();
const DATA_DIR = configuredDataDir ? path.resolve(configuredDataDir) : path.join(process.cwd(), "data");
const POSTS_DIR = path.join(DATA_DIR, "posts");
const SOURCES_DIR = path.join(DATA_DIR, "sources");
const ORG_PROFILE_PATH = path.join(DATA_DIR, "org.json");
const WATCHED_SOURCES_PATH = path.join(DATA_DIR, "watched-sources.json");
const ARTICLES_DIR = path.join(DATA_DIR, "articles");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log("Starting migration from file storage to PostgreSQL...\n");

    // Migrate organization profile
    console.log("Migrating organization profile...");
    try {
      const orgData = await readFile(ORG_PROFILE_PATH, "utf8");
      const org = JSON.parse(orgData);

      await pool.query(
        `INSERT INTO organization (name, website, tagline, mission, focus_areas, objectives, voice_guidelines, preferred_terms, avoid_terms, onboarding_completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING`,
        [
          org.name,
          org.website || "",
          org.tagline,
          org.mission,
          JSON.stringify(org.focusAreas || []),
          JSON.stringify(org.objectives || []),
          org.voiceGuidelines,
          JSON.stringify(org.preferredTerms || []),
          JSON.stringify(org.avoidTerms || []),
          org.onboardingCompletedAt
        ]
      );
      console.log("✓ Organization profile migrated\n");
    } catch (err) {
      console.log("⚠ No organization profile found or already exists\n");
    }

    // Migrate posts
    console.log("Migrating blog posts...");
    const postFiles = await readdir(POSTS_DIR);
    const jsonFiles = postFiles.filter(f => f.endsWith(".json"));

    let postsCount = 0;
    for (const file of jsonFiles) {
      const id = file.replace(".json", "");
      const metaData = await readFile(path.join(POSTS_DIR, file), "utf8");
      const meta = JSON.parse(metaData);

      try {
        const markdown = await readFile(path.join(POSTS_DIR, `${id}.md`), "utf8");

        // Insert post
        await pool.query(
          `INSERT INTO posts (id, slug, status, title, subtitle, summary, keywords, seo_title, seo_description, created_at, updated_at, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            meta.id,
            meta.slug,
            meta.status,
            meta.title,
            meta.subtitle || null,
            meta.summary,
            JSON.stringify(meta.keywords || []),
            meta.seoTitle || null,
            meta.seoDescription || null,
            meta.createdAt,
            meta.updatedAt,
            meta.publishedAt || null
          ]
        );

        // Insert post content
        await pool.query(
          `INSERT INTO post_content (post_id, content_markdown)
           VALUES ($1, $2)
           ON CONFLICT (post_id) DO NOTHING`,
          [meta.id, markdown]
        );

        postsCount++;
      } catch (err) {
        console.error(`⚠ Failed to migrate post ${id}:`, err);
      }
    }
    console.log(`✓ Migrated ${postsCount} blog posts\n`);

    // Migrate sources
    console.log("Migrating knowledge sources...");
    const sourceFiles = await readdir(SOURCES_DIR);
    const sourceJsonFiles = sourceFiles.filter(f => f.endsWith(".json"));

    let sourcesCount = 0;
    for (const file of sourceJsonFiles) {
      const id = file.replace(".json", "");
      const metaData = await readFile(path.join(SOURCES_DIR, file), "utf8");
      const meta = JSON.parse(metaData);

      try {
        const content = await readFile(path.join(SOURCES_DIR, `${id}.txt`), "utf8");

        // Insert source
        await pool.query(
          `INSERT INTO sources (id, type, title, url, word_count, sha256, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            meta.id,
            meta.type,
            meta.title,
            meta.url || null,
            meta.wordCount,
            meta.sha256,
            meta.createdAt
          ]
        );

        // Insert source content
        await pool.query(
          `INSERT INTO source_content (source_id, content_text)
           VALUES ($1, $2)
           ON CONFLICT (source_id) DO NOTHING`,
          [meta.id, content]
        );

        sourcesCount++;
      } catch (err) {
        console.error(`⚠ Failed to migrate source ${id}:`, err);
      }
    }
    console.log(`✓ Migrated ${sourcesCount} knowledge sources\n`);

    // Migrate watched sources
    console.log("Migrating watched sources...");
    try {
      const watchedData = await readFile(WATCHED_SOURCES_PATH, "utf8");
      const watched = JSON.parse(watchedData);

      let watchedCount = 0;
      for (const source of watched) {
        await pool.query(
          `INSERT INTO watched_sources (id, name, url, type, enabled, last_fetched_at, fetch_interval_hours, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (url) DO NOTHING`,
          [
            source.id,
            source.name,
            source.url,
            source.type,
            source.enabled,
            source.lastFetchedAt || null,
            source.fetchIntervalHours,
            source.createdAt
          ]
        );
        watchedCount++;
      }
      console.log(`✓ Migrated ${watchedCount} watched sources\n`);
    } catch (err) {
      console.log("⚠ No watched sources found\n");
    }

    // Migrate articles
    console.log("Migrating fetched articles...");
    try {
      const articleFiles = await readdir(ARTICLES_DIR);
      const articleJsonFiles = articleFiles.filter(f => f.endsWith(".json"));

      let articlesCount = 0;
      for (const file of articleJsonFiles) {
        const articleData = await readFile(path.join(ARTICLES_DIR, file), "utf8");
        const article = JSON.parse(articleData);

        try {
          await pool.query(
            `INSERT INTO articles (id, source_id, source_name, title, url, published_at, fetched_at, excerpt, matched_keywords, relevance_score, saved_to_knowledge)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (url) DO NOTHING`,
            [
              article.id,
              article.sourceId,
              article.sourceName,
              article.title,
              article.url,
              article.publishedAt || null,
              article.fetchedAt,
              article.excerpt,
              JSON.stringify(article.matchedKeywords || []),
              article.relevanceScore,
              article.savedToKnowledge
            ]
          );
          articlesCount++;
        } catch (err) {
          console.error(`⚠ Failed to migrate article ${article.id}:`, err);
        }
      }
      console.log(`✓ Migrated ${articlesCount} fetched articles\n`);
    } catch (err) {
      console.log("⚠ No articles found\n");
    }

    console.log("Migration complete!\n");
    console.log("Summary:");
    console.log(`  - Organization: migrated`);
    console.log(`  - Posts: ${postsCount}`);
    console.log(`  - Knowledge sources: ${sourcesCount}`);
    console.log("\nTo use PostgreSQL storage, set:");
    console.log("  STORAGE_PROVIDER=postgres");
    console.log("  DATABASE_URL=<your-connection-string>");

  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
