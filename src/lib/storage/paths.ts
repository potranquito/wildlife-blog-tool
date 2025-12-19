import path from "node:path";

const configuredDataDir = process.env.WILDLIFE_BLOGGER_DATA_DIR?.trim();

export const DATA_DIR = configuredDataDir ? path.resolve(configuredDataDir) : path.join(process.cwd(), "data");
export const POSTS_DIR = path.join(DATA_DIR, "posts");
export const SOURCES_DIR = path.join(DATA_DIR, "sources");
export const ORG_PROFILE_PATH = path.join(DATA_DIR, "org.json");
export const WATCHED_SOURCES_PATH = path.join(DATA_DIR, "watched-sources.json");
export const ARTICLES_DIR = path.join(DATA_DIR, "articles");
