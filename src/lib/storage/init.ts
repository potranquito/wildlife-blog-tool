import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { ORG_PROFILE_PATH, POSTS_DIR, SOURCES_DIR } from "@/lib/storage/paths";
import { makeSeedPost, makeSeedProfile } from "@/lib/storage/seed";

let initPromise: Promise<void> | undefined;

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function initStorage() {
  if (!initPromise) initPromise = initStorageImpl();
  return initPromise;
}

async function initStorageImpl() {
  await mkdir(POSTS_DIR, { recursive: true });
  await mkdir(SOURCES_DIR, { recursive: true });

  const hasOrg = await fileExists(ORG_PROFILE_PATH);
  if (!hasOrg) {
    const profile = makeSeedProfile();
    await writeFile(ORG_PROFILE_PATH, JSON.stringify(profile, null, 2), "utf8");
  }

  const posts = await readdir(POSTS_DIR);
  const hasAnyPost = posts.some((f) => f.endsWith(".json"));
  if (!hasAnyPost) {
    const seed = makeSeedPost();
    await writeFile(`${POSTS_DIR}/${seed.id}.json`, JSON.stringify(seed.meta, null, 2), "utf8");
    await writeFile(`${POSTS_DIR}/${seed.id}.md`, seed.markdown, "utf8");
  }
}

