import crypto from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { initStorage } from "@/lib/storage/init";
import { SOURCES_DIR } from "@/lib/storage/paths";
import type { KnowledgeSource, KnowledgeSourceMeta, SourceType } from "@/lib/storage/types";

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

async function readMetaFile(path: string): Promise<KnowledgeSourceMeta> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as KnowledgeSourceMeta;
}

export async function listSources(type?: SourceType): Promise<KnowledgeSourceMeta[]> {
  await initStorage();
  const files = await readdir(SOURCES_DIR);
  const metas: KnowledgeSourceMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const meta = await readMetaFile(`${SOURCES_DIR}/${file}`);
    if (type && meta.type !== type) continue;
    metas.push(meta);
  }

  metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return metas;
}

export async function getSourceById(id: string): Promise<KnowledgeSource | null> {
  await initStorage();
  try {
    const meta = await readMetaFile(`${SOURCES_DIR}/${id}.json`);
    const contentText = await readFile(`${SOURCES_DIR}/${id}.txt`, "utf8");
    return { ...meta, contentText };
  } catch {
    return null;
  }
}

export async function createSourceFromText(input: {
  type: SourceType;
  title: string;
  url?: string;
  contentText: string;
}): Promise<KnowledgeSource> {
  await initStorage();

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

