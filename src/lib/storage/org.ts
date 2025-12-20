/**
 * Organization profile storage - public API
 *
 * This module delegates to the configured storage provider.
 */

import { getStorageProvider, initStorage } from "./factory";
import type { OrganizationProfile } from "./types";

export async function getOrgProfile(): Promise<OrganizationProfile> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.org.get();
}

export async function updateOrgProfile(profile: OrganizationProfile): Promise<OrganizationProfile> {
  await initStorage();
  const provider = getStorageProvider();
  return provider.org.update(profile);
}
