export function getBaseUrl() {
  const fromEnv = process.env.WILDLIFE_BLOGGER_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3000";
}

