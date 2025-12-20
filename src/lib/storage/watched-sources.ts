/**
 * Watched sources storage - public API
 *
 * This module delegates to the configured storage provider.
 */

import { getStorageProvider, initStorage } from "./factory";
import type { WatchedSource, WatchedSourceType } from "./types";

export async function listWatchedSources(): Promise<WatchedSource[]> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.watchedSources.list();
}

export async function getWatchedSourceById(id: string): Promise<WatchedSource | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.watchedSources.getById(id);
}

export async function addWatchedSource(args: {
  name: string;
  url: string;
  type: WatchedSourceType;
  fetchIntervalHours?: number;
}): Promise<WatchedSource> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.watchedSources.add(args);
}

export async function updateWatchedSource(
  id: string,
  updates: Partial<Pick<WatchedSource, "name" | "enabled" | "fetchIntervalHours" | "lastFetchedAt">>
): Promise<WatchedSource | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.watchedSources.update(id, updates);
}

export async function deleteWatchedSource(id: string): Promise<boolean> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.watchedSources.delete(id);
}

export async function getSourcesDueForFetch(): Promise<WatchedSource[]> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.watchedSources.getDueForFetch();
}
