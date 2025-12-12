"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "@/components/Markdown";
import type { BlogPost } from "@/lib/storage/types";

export default function PostEditorClient({ initial }: { initial: BlogPost }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<BlogPost>(initial);

  const keywordsText = useMemo(() => post.keywords.join(", "), [post.keywords]);

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
    </div>
  );
}

