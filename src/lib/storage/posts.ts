import { readFile, readdir, writeFile } from "node:fs/promises";
import { initStorage } from "@/lib/storage/init";
import { POSTS_DIR } from "@/lib/storage/paths";
import type { BlogPost, BlogPostMeta, PostStatus } from "@/lib/storage/types";
import { slugify } from "@/lib/utils/slug";

async function readMetaFile(path: string): Promise<BlogPostMeta> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as BlogPostMeta;
}

async function readPostById(id: string): Promise<BlogPost | null> {
  await initStorage();
  try {
    const meta = await readMetaFile(`${POSTS_DIR}/${id}.json`);
    const contentMarkdown = await readFile(`${POSTS_DIR}/${id}.md`, "utf8");
    return { ...meta, contentMarkdown };
  } catch {
    return null;
  }
}

export async function getPostById(id: string) {
  return readPostById(id);
}

export async function listPosts(status?: PostStatus): Promise<BlogPostMeta[]> {
  await initStorage();
  const files = await readdir(POSTS_DIR);
  const metas: BlogPostMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const meta = await readMetaFile(`${POSTS_DIR}/${file}`);
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

export async function listPublishedPosts() {
  return listPosts("PUBLISHED");
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  const metas = await listPublishedPosts();
  const match = metas.find((m) => m.slug === slug);
  if (!match) return null;
  const post = await readPostById(match.id);
  if (!post || post.status !== "PUBLISHED") return null;
  return post;
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const metas = await listPosts();
  const match = metas.find((m) => m.slug === slug);
  if (!match) return null;
  return readPostById(match.id);
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

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slugBase = slugify(input.title);
  const slug = await ensureUniqueSlug(slugBase);

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

export async function updateDraft(
  id: string,
  updates: Partial<Omit<BlogPost, "id" | "createdAt" | "publishedAt">>
): Promise<BlogPost | null> {
  const existing = await readPostById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  let slug = existing.slug;
  let title = existing.title;

  if (typeof updates.title === "string" && updates.title.trim() && updates.title !== existing.title) {
    title = updates.title;
    if (existing.status !== "PUBLISHED") {
      slug = await ensureUniqueSlug(slugify(title), id);
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

export async function publishPost(id: string): Promise<BlogPost | null> {
  const existing = await readPostById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const slug = await ensureUniqueSlug(existing.slug, id);

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

async function ensureUniqueSlug(slugBase: string, selfId?: string) {
  const metas = await listPosts();
  const used = new Set(metas.filter((m) => m.id !== selfId).map((m) => m.slug));

  if (!used.has(slugBase)) return slugBase;

  let i = 2;
  while (used.has(`${slugBase}-${i}`)) i += 1;
  return `${slugBase}-${i}`;
}

