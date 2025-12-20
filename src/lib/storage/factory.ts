/**
 * Storage factory
 *
 * Selects and initializes the appropriate storage provider based on configuration.
 */

import type { IStorageProvider } from "./interfaces";
import { FileStorageProvider } from "./providers/file";
import { PostgresStorageProvider } from "./providers/postgres";

type StorageProviderType = "file" | "postgres";

let cachedProvider: IStorageProvider | null = null;

/**
 * Get the storage provider
 *
 * This function is idempotent - it returns the same provider instance across calls.
 * Call `initStorage()` to ensure the provider is initialized.
 */
export function getStorageProvider(): IStorageProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerType = (process.env.STORAGE_PROVIDER?.toLowerCase() || "file") as StorageProviderType;

  switch (providerType) {
    case "file":
      cachedProvider = new FileStorageProvider();
      break;

    case "postgres":
      cachedProvider = new PostgresStorageProvider();
      break;

    default:
      throw new Error(`Unknown storage provider: ${providerType}`);
  }

  return cachedProvider;
}

/**
 * Initialize storage
 *
 * This must be called before using any storage operations.
 * Safe to call multiple times - will only initialize once.
 */
let initPromise: Promise<void> | null = null;

export async function initStorage(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const provider = getStorageProvider();
    await provider.init();
  })();

  return initPromise;
}

/**
 * Close storage connections
 *
 * Call this when shutting down the application.
 */
export async function closeStorage(): Promise<void> {
  if (cachedProvider) {
    await cachedProvider.close();
    cachedProvider = null;
    initPromise = null;
  }
}
