/**
 * Sources storage - public API
 *
 * This module delegates to the configured storage provider.
 */

import { getStorageProvider, initStorage } from "./factory";
import type { KnowledgeSource, KnowledgeSourceMeta, SourceType } from "./types";

export async function listSources(type?: SourceType): Promise<KnowledgeSourceMeta[]> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.sources.list(type);
}

export async function getSourceById(id: string): Promise<KnowledgeSource | null> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.sources.getById(id);
}

export async function createSourceFromText(input: {
  type: SourceType;
  title: string;
  url?: string;
  contentText: string;
}): Promise<KnowledgeSource> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.sources.createFromText(input);
}

