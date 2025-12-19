import { requireAdmin } from "@/lib/auth/server";
import { listWatchedSources } from "@/lib/storage/watched-sources";
import { listArticles } from "@/lib/storage/articles";
import MonitorClient from "./MonitorClient";

export default async function MonitorPage() {
  await requireAdmin();

  const sources = await listWatchedSources();
  const articles = await listArticles({ limit: 50 });

  return <MonitorClient initialSources={sources} initialArticles={articles} />;
}
