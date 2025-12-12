import { readFile, writeFile } from "node:fs/promises";
import { initStorage } from "@/lib/storage/init";
import { ORG_PROFILE_PATH } from "@/lib/storage/paths";
import type { OrganizationProfile } from "@/lib/storage/types";
import { makeSeedProfile } from "@/lib/storage/seed";

export async function getOrgProfile(): Promise<OrganizationProfile> {
  await initStorage();
  try {
    const raw = await readFile(ORG_PROFILE_PATH, "utf8");
    return JSON.parse(raw) as OrganizationProfile;
  } catch {
    return makeSeedProfile();
  }
}

export async function updateOrgProfile(profile: OrganizationProfile) {
  await initStorage();
  await writeFile(ORG_PROFILE_PATH, JSON.stringify(profile, null, 2), "utf8");
  return profile;
}

