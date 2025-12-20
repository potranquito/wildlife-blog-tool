"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Markdown from "@/components/Markdown";
import type { BlogPost } from "@/lib/storage/types";
import type { ReadabilityScore } from "@/lib/content-quality/readability";
import type { SEOAnalysis } from "@/lib/content-quality/seo";

interface ContentQuality {
  readability: ReadabilityScore;
  readingTime: number;
  seo: SEOAnalysis;
}

export default function PostEditorClient({ initial }: { initial: BlogPost }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<BlogPost>(initial);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [quality, setQuality] = useState<ContentQuality | null>(null);
  const [analyzingQuality, setAnalyzingQuality] = useState(false);
  const [qualityExpanded, setQualityExpanded] = useState(false);
  const [improving, setImproving] = useState(false);
  const qualityTimeoutRef = useRef<NodeJS.Timeout>();

  const keywordsText = useMemo(() => post.keywords.join(", "), [post.keywords]);

  // Debounced content quality analysis
  useEffect(() => {
    if (qualityTimeoutRef.current) {
      clearTimeout(qualityTimeoutRef.current);
    }

    qualityTimeoutRef.current = setTimeout(() => {
      void analyzeQuality();
    }, 1000);

    return () => {
      if (qualityTimeoutRef.current) {
        clearTimeout(qualityTimeoutRef.current);
      }
    };
  }, [post.title, post.summary, post.seoDescription, post.contentMarkdown, post.keywords]);

  async function analyzeQuality() {
    setAnalyzingQuality(true);
    try {
      const res = await fetch("/api/content-quality/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: post.title,
          summary: post.summary,
          seoDescription: post.seoDescription,
          contentMarkdown: post.contentMarkdown,
          keywords: post.keywords
        })
      });
      if (res.ok) {
        const data = await res.json();
        setQuality(data);
      }
    } catch (e) {
      console.error("Quality analysis failed:", e);
    } finally {
      setAnalyzingQuality(false);
    }
  }

  async function makeImprovements() {
    if (!quality) return;
    setImproving(true);
    setError(null);
    try {
      const res = await fetch("/api/posts/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          post: {
            title: post.title,
            subtitle: post.subtitle,
            summary: post.summary,
            seoTitle: post.seoTitle,
            seoDescription: post.seoDescription,
            keywords: post.keywords,
            contentMarkdown: post.contentMarkdown
          },
          quality
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Improvement failed");

      // Update post with improved content
      setPost(prev => ({
        ...prev,
        title: data.improved.title,
        subtitle: data.improved.subtitle,
        summary: data.improved.summary,
        seoTitle: data.improved.seoTitle,
        seoDescription: data.improved.seoDescription,
        keywords: data.improved.keywords,
        contentMarkdown: data.improved.contentMarkdown
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Improvement failed");
    } finally {
      setImproving(false);
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          title: post.title,
          subtitle: post.subtitle,
          summary: post.summary,
          keywords: post.keywords,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          contentMarkdown: post.contentMarkdown
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setPost(data.post);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("publish");
    setError(null);
    try {
      const res = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: post.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setPost(data.post);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-orange-400";
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">
            {post.status === "PUBLISHED" ? "Published" : "Draft"} · Updated {new Date(post.updatedAt).toLocaleString()}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{post.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link className="wb-button" href="/dashboard/posts">
              Back to posts
            </Link>
            {post.status === "PUBLISHED" ? (
              <Link className="wb-button" href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                View on blog
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewMode === 'preview' && (
            <button
              className="wb-button"
              onClick={() => setViewMode('edit')}
            >
              Edit & Regenerate
            </button>
          )}
          {viewMode === 'edit' && (
            <button
              className="wb-button"
              onClick={() => setViewMode('preview')}
            >
              Back to Preview
            </button>
          )}
          <button className="wb-button" disabled={busy === "save"} onClick={() => void save()}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          {post.status !== "PUBLISHED" ? (
            <button className="wb-button" disabled={busy === "publish"} onClick={() => void publish()}>
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      {viewMode === 'preview' ? (
        <>
          {/* Content Quality Card - Always visible in preview mode */}
          <div className="wb-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold">Content Quality</div>
                  {analyzingQuality && (
                    <div className="text-xs text-[var(--wb-muted)]">Analyzing...</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {quality && (
                    <button
                      className="wb-button text-sm"
                      disabled={improving}
                      onClick={() => void makeImprovements()}
                    >
                      {improving ? "Improving..." : "✨ Make suggested changes"}
                    </button>
                  )}
                  <button
                    className="text-sm text-[var(--wb-muted)] hover:text-[var(--wb-accent)]"
                    onClick={() => setQualityExpanded(!qualityExpanded)}
                  >
                    {qualityExpanded ? "▼ Hide details" : "▶ Show details"}
                  </button>
                </div>
              </div>

              {quality && (
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="wb-card p-3">
                    <div className="text-xs text-[var(--wb-muted)]">Overall SEO</div>
                    <div className={`mt-1 text-2xl font-bold ${getScoreColor(quality.seo.overallScore)}`}>
                      {quality.seo.overallScore}
                    </div>
                  </div>
                  <div className="wb-card p-3">
                    <div className="text-xs text-[var(--wb-muted)]">Readability</div>
                    <div className={`mt-1 text-2xl font-bold ${getScoreColor(quality.readability.fleschReadingEase)}`}>
                      {Math.round(quality.readability.fleschReadingEase)}
                    </div>
                  </div>
                  <div className="wb-card p-3">
                    <div className="text-xs text-[var(--wb-muted)]">Reading Time</div>
                    <div className="mt-1 text-2xl font-bold text-[var(--wb-accent)]">
                      {quality.readingTime}m
                    </div>
                  </div>
                  <div className="wb-card p-3">
                    <div className="text-xs text-[var(--wb-muted)]">Grade Level</div>
                    <div className="mt-1 text-2xl font-bold text-blue-400">
                      {quality.readability.fleschKincaidGrade.toFixed(1)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {qualityExpanded && quality && (
              <div className="border-t border-[var(--wb-border)] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Readability Details */}
                  <div>
                    <div className="text-sm font-semibold">Readability</div>
                    <div className="mt-2 text-xs text-[var(--wb-muted)]">{quality.readability.recommendation}</div>
                    <div className="mt-3 grid gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--wb-muted)]">Words:</span>
                        <span>{quality.readability.totalWords.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--wb-muted)]">Sentences:</span>
                        <span>{quality.readability.totalSentences}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--wb-muted)]">Avg sentence length:</span>
                        <span>{quality.readability.avgSentenceLength.toFixed(1)} words</span>
                      </div>
                    </div>
                  </div>

                  {/* SEO Details */}
                  <div>
                    <div className="text-sm font-semibold">SEO Recommendations</div>
                    <div className="mt-3 grid gap-2 text-xs">
                      {quality.seo.recommendations.slice(0, 5).map((rec, i) => (
                        <div key={i} className="text-yellow-400">• {rec}</div>
                      ))}
                      {quality.seo.warnings.map((warn, i) => (
                        <div key={i} className="text-red-400">⚠ {warn}</div>
                      ))}
                      {quality.seo.passed.slice(0, 3).map((pass, i) => (
                        <div key={i} className="text-green-400">✓ {pass}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="wb-card p-6">
            <div className="text-sm font-semibold mb-4">Preview</div>
            <div className="wb-markdown">
              <Markdown markdown={post.contentMarkdown} />
            </div>
          </div>
        </>
      ) : (
        /* Edit Mode */
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="wb-card p-6">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-semibold">Title</label>
                <input
                  className="wb-input mt-2 w-full"
                  value={post.title}
                  onChange={(e) => setPost((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Subtitle</label>
                <input
                  className="wb-input mt-2 w-full"
                  value={post.subtitle ?? ""}
                  onChange={(e) => setPost((p) => ({ ...p, subtitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Summary</label>
                <textarea
                  className="wb-input mt-2 min-h-24 w-full"
                  value={post.summary}
                  onChange={(e) => setPost((p) => ({ ...p, summary: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Keywords (comma-separated)</label>
                <input
                  className="wb-input mt-2 w-full"
                  value={keywordsText}
                  onChange={(e) =>
                    setPost((p) => ({
                      ...p,
                      keywords: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    }))
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold">SEO title</label>
                  <input
                    className="wb-input mt-2 w-full"
                    value={post.seoTitle ?? ""}
                    onChange={(e) => setPost((p) => ({ ...p, seoTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">SEO description</label>
                  <textarea
                    className="wb-input mt-2 min-h-16 w-full"
                    value={post.seoDescription ?? ""}
                    onChange={(e) => setPost((p) => ({ ...p, seoDescription: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Content (Markdown)</label>
                <textarea
                  className="wb-input mt-2 min-h-[420px] w-full font-mono text-sm"
                  value={post.contentMarkdown}
                  onChange={(e) => setPost((p) => ({ ...p, contentMarkdown: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="wb-card p-6">
            <div className="text-sm font-semibold">Preview</div>
            <div className="mt-4 wb-markdown">
              <Markdown markdown={post.contentMarkdown} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

