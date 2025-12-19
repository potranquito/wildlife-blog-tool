"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WatchedSource, FetchedArticle } from "@/lib/storage/types";

type Props = {
  initialSources: WatchedSource[];
  initialArticles: FetchedArticle[];
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function relevanceColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  return "text-gray-400";
}

function relevanceIcon(score: number): string {
  if (score >= 75) return "●";
  if (score >= 40) return "●";
  return "○";
}

export default function MonitorClient({ initialSources, initialArticles }: Props) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [articles, setArticles] = useState(initialArticles);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "high" | string>("all");

  async function addSource() {
    if (!urlInput.trim()) return;
    setBusy("add");
    setError(null);

    try {
      const res = await fetch("/api/monitor/watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add source");

      setSources((prev) => [...prev, data.source]);
      setUrlInput("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add source");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSource(id: string, enabled: boolean) {
    setBusy(`toggle-${id}`);
    try {
      const res = await fetch("/api/monitor/watch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, enabled })
      });
      if (!res.ok) throw new Error("Failed to update");

      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    } catch {
      setError("Failed to update source");
    } finally {
      setBusy(null);
    }
  }

  async function deleteSource(id: string) {
    if (!confirm("Delete this source and all its articles?")) return;
    setBusy(`delete-${id}`);

    try {
      const res = await fetch("/api/monitor/watch", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error("Failed to delete");

      setSources((prev) => prev.filter((s) => s.id !== id));
      setArticles((prev) => prev.filter((a) => a.sourceId !== id));
      router.refresh();
    } catch {
      setError("Failed to delete source");
    } finally {
      setBusy(null);
    }
  }

  async function fetchAllNow() {
    setBusy("fetch-all");
    setError(null);

    try {
      const res = await fetch("/api/monitor/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fetch failed");

      // Refresh to get new articles
      router.refresh();

      // Show summary
      alert(`Fetched ${data.summary.totalNewArticles} new articles from ${data.summary.sourcesProcessed} sources`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveToKnowledge(articleId: string) {
    setBusy(`save-${articleId}`);

    try {
      const res = await fetch("/api/monitor/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, savedToKnowledge: true } : a))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save article");
    } finally {
      setBusy(null);
    }
  }

  // Filter articles
  const filteredArticles = articles.filter((a) => {
    if (filter === "all") return true;
    if (filter === "high") return a.relevanceScore >= 60;
    return a.sourceId === filter;
  });

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sources Monitor</h1>
        <p className="mt-2 text-[var(--wb-muted)]">
          Track news and articles from conservation organizations.
        </p>
      </header>

      {error ? (
        <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      {/* Add Source Form */}
      <div className="wb-card p-5">
        <div className="text-sm font-semibold">Add Source</div>
        <div className="mt-3 flex gap-3">
          <input
            className="wb-input flex-1"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://awf.org/news or RSS feed URL"
            disabled={busy === "add"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && urlInput.trim()) {
                void addSource();
              }
            }}
          />
          <button
            className="wb-button whitespace-nowrap"
            disabled={busy === "add" || !urlInput.trim()}
            onClick={() => void addSource()}
          >
            {busy === "add" ? "Adding..." : "Add Source"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--wb-muted)]">
          Auto-detects RSS feeds. News pages are also supported.
        </p>
      </div>

      {/* Watched Sources */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Watched Sources ({sources.length})</h2>
          <button
            className="wb-button text-sm"
            disabled={busy === "fetch-all" || sources.length === 0}
            onClick={() => void fetchAllNow()}
          >
            {busy === "fetch-all" ? "Fetching..." : "Fetch All Now"}
          </button>
        </div>

        {sources.length === 0 ? (
          <div className="mt-3 wb-card p-6 text-[var(--wb-muted)]">
            No sources yet. Add a URL above to start monitoring.
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {sources.map((source) => (
              <div key={source.id} className="wb-card flex items-center gap-4 p-4">
                <button
                  className={`text-xl ${source.enabled ? "text-green-400" : "text-gray-500"}`}
                  onClick={() => void toggleSource(source.id, !source.enabled)}
                  disabled={busy?.startsWith("toggle")}
                  title={source.enabled ? "Enabled - click to pause" : "Paused - click to enable"}
                >
                  {source.enabled ? "●" : "○"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{source.name}</div>
                  <div className="mt-1 text-xs text-[var(--wb-muted)]">
                    {source.type} ·{" "}
                    {source.fetchIntervalHours === 24
                      ? "Daily"
                      : source.fetchIntervalHours === 168
                        ? "Weekly"
                        : `Every ${source.fetchIntervalHours}h`}{" "}
                    · {source.lastFetchedAt ? `Last: ${timeAgo(source.lastFetchedAt)}` : "Never fetched"}
                  </div>
                </div>
                <button
                  className="text-xs text-red-400 hover:underline"
                  onClick={() => void deleteSource(source.id)}
                  disabled={busy === `delete-${source.id}`}
                >
                  {busy === `delete-${source.id}` ? "..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Articles */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent Articles</h2>
          <select
            className="wb-input text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="high">High Relevance (60%+)</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="mt-3 wb-card p-6 text-[var(--wb-muted)]">
            No articles yet. Add sources and click "Fetch All Now" to get started.
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {filteredArticles.map((article) => (
              <div key={article.id} className="wb-card p-4">
                <div className="flex items-start gap-3">
                  <span className={`text-lg ${relevanceColor(article.relevanceScore)}`}>
                    {relevanceIcon(article.relevanceScore)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold hover:underline"
                      >
                        <span className={relevanceColor(article.relevanceScore)}>
                          {article.relevanceScore}%
                        </span>{" "}
                        {article.title}
                      </a>
                    </div>
                    <div className="mt-1 text-xs text-[var(--wb-muted)]">
                      {article.sourceName} · {timeAgo(article.fetchedAt)}
                      {article.matchedKeywords.length > 0 && (
                        <> · {article.matchedKeywords.slice(0, 5).join(", ")}</>
                      )}
                    </div>
                    {article.excerpt && (
                      <p className="mt-2 text-xs text-[var(--wb-muted)] line-clamp-2">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="mt-2">
                      {article.savedToKnowledge ? (
                        <span className="text-xs text-green-400">✓ Saved to knowledge base</span>
                      ) : (
                        <button
                          className="text-xs text-[var(--wb-accent)] hover:underline"
                          onClick={() => void saveToKnowledge(article.id)}
                          disabled={busy === `save-${article.id}`}
                        >
                          {busy === `save-${article.id}` ? "Saving..." : "Save to Knowledge Base"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
