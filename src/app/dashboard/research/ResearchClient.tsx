"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Analysis = {
  url: string;
  title: string;
  description: string;
  canonical?: string;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  wordCount: number;
  topTerms: Array<{ term: string; count: number }>;
  excerpt: string;
};

export default function ResearchClient({ initial }: { initial: Analysis[] }) {
  const router = useRouter();
  const [urlsRaw, setUrlsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Analysis[]>(initial);

  const urls = useMemo(() => {
    return urlsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [urlsRaw]);

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/research/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analyze failed");
      setResults(data.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAsCompetitor(url: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sources/fetch-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, type: "COMPETITOR_URL" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Research</h1>
        <p className="mt-2 text-[var(--wb-muted)]">
          Analyze other organizations’ pages to understand headings, topics, and keyword signals.
        </p>
      </header>

      {error ? (
        <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="wb-card p-5">
        <label className="text-sm font-semibold">URLs (one per line)</label>
        <textarea
          className="wb-input mt-2 min-h-32 w-full"
          value={urlsRaw}
          onChange={(e) => setUrlsRaw(e.target.value)}
          placeholder={"https://example.org/blog/post\nhttps://another.org/article"}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[var(--wb-muted)]">Max 10 URLs per run.</div>
          <button className="wb-button" disabled={busy || urls.length === 0} onClick={() => void analyze()}>
            {busy ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>

      <section className="grid gap-4">
        {results.length === 0 ? (
          <div className="wb-card p-6 text-[var(--wb-muted)]">No research results yet.</div>
        ) : (
          results.map((r) => (
            <div key={r.url} className="wb-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{r.title || r.url}</div>
                  <div className="mt-1 truncate text-xs">
                    <a className="wb-link" href={r.url} rel="noreferrer" target="_blank">
                      {r.url}
                    </a>
                  </div>
                  {r.description ? <p className="mt-3 text-sm text-[var(--wb-muted)]">{r.description}</p> : null}
                  <div className="mt-2 text-xs text-[var(--wb-muted)]">{r.wordCount.toLocaleString()} words</div>
                </div>
                <button className="wb-button" disabled={busy} onClick={() => void saveAsCompetitor(r.url)}>
                  Save to knowledge base
                </button>
              </div>

              {r.headings.h2.length > 0 ? (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">Key headings</div>
                  <ul className="mt-2 grid gap-1 text-sm text-[var(--wb-muted)]">
                    {r.headings.h2.slice(0, 8).map((h) => (
                      <li key={h}>• {h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {r.topTerms.length > 0 ? (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">Top terms</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.topTerms.slice(0, 12).map((t) => (
                      <span
                        key={t.term}
                        className="rounded-full border border-[var(--wb-border)] bg-black/20 px-3 py-1 text-xs text-[var(--wb-muted)]"
                        title={`${t.count} occurrences`}
                      >
                        {t.term}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {r.excerpt ? (
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm text-[var(--wb-accent2)]">Show excerpt</summary>
                  <p className="mt-3 text-sm text-[var(--wb-muted)]">{r.excerpt}</p>
                </details>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

