import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const POSTS_DIR = path.join(DATA_DIR, "posts");
export const SOURCES_DIR = path.join(DATA_DIR, "sources");
export const ORG_PROFILE_PATH = path.join(DATA_DIR, "org.json");

