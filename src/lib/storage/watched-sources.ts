import fs from "node:fs/promises";
import crypto from "node:crypto";
import { WATCHED_SOURCES_PATH } from "./paths";
import type { WatchedSource, WatchedSourceType } from "./types";

async function readWatchedSources(): Promise<WatchedSource[]> {
  try {
    const data = await fs.readFile(WATCHED_SOURCES_PATH, "utf8");
    return JSON.parse(data) as WatchedSource[];
  } catch {
    return [];
  }
}

async function writeWatchedSources(sources: WatchedSource[]): Promise<void> {
  await fs.writeFile(WATCHED_SOURCES_PATH, JSON.stringify(sources, null, 2), "utf8");
}

export async function listWatchedSources(): Promise<WatchedSource[]> {
  return readWatchedSources();
}

export async function getWatchedSourceById(id: string): Promise<WatchedSource | null> {
  const sources = await readWatchedSources();
  return sources.find((s) => s.id === id) ?? null;
}

export async function addWatchedSource(args: {
  name: string;
  url: string;
  type: WatchedSourceType;
  fetchIntervalHours?: number;
}): Promise<WatchedSource> {
  const sources = await readWatchedSources();

  // Check for duplicate URL
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
  await writeWatchedSources(sources);
  return source;
}

export async function updateWatchedSource(
  id: string,
  updates: Partial<Pick<WatchedSource, "name" | "enabled" | "fetchIntervalHours" | "lastFetchedAt">>
): Promise<WatchedSource | null> {
  const sources = await readWatchedSources();
  const index = sources.findIndex((s) => s.id === id);
  if (index === -1) return null;

  sources[index] = { ...sources[index], ...updates };
  await writeWatchedSources(sources);
  return sources[index];
}

export async function deleteWatchedSource(id: string): Promise<boolean> {
  const sources = await readWatchedSources();
  const filtered = sources.filter((s) => s.id !== id);
  if (filtered.length === sources.length) return false;

  await writeWatchedSources(filtered);
  return true;
}

export async function getSourcesDueForFetch(): Promise<WatchedSource[]> {
  const sources = await readWatchedSources();
  const now = Date.now();

  return sources.filter((s) => {
    if (!s.enabled) return false;
    if (!s.lastFetchedAt) return true;

    const lastFetch = new Date(s.lastFetchedAt).getTime();
    const intervalMs = s.fetchIntervalHours * 60 * 60 * 1000;
    return now - lastFetch >= intervalMs;
  });
}
