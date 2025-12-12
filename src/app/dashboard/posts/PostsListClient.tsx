"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlogPostMeta } from "@/lib/storage/types";

export default function PostsListClient({ initialPosts }: { initialPosts: BlogPostMeta[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { drafts, published } = useMemo(() => {
    const drafts = initialPosts.filter((p) => p.status === "DRAFT");
    const published = initialPosts.filter((p) => p.status === "PUBLISHED");
    return { drafts, published };
  }, [initialPosts]);

  async function publish(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="mt-2 text-[var(--wb-muted)]">Generate drafts, edit, then publish to `/blog`.</p>
        </div>
        <Link className="wb-button" href="/dashboard/posts/new">
          New post
        </Link>
      </header>

      {error ? (
        <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Drafts ({drafts.length})</h2>
        {drafts.length === 0 ? (
          <div className="wb-card p-6 text-[var(--wb-muted)]">No drafts yet.</div>
        ) : (
          drafts.map((p) => (
            <div key={p.id} className="wb-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.title}</div>
                  <div className="mt-1 text-xs text-[var(--wb-muted)]">
                    Updated {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="wb-button" href={`/dashboard/posts/${p.id}`}>
                    Edit
                  </Link>
                  <button className="wb-button" disabled={busyId === p.id} onClick={() => void publish(p.id)}>
                    {busyId === p.id ? "Publishing…" : "Publish"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Published ({published.length})</h2>
        {published.length === 0 ? (
          <div className="wb-card p-6 text-[var(--wb-muted)]">No published posts yet.</div>
        ) : (
          published.map((p) => (
            <div key={p.id} className="wb-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.title}</div>
                  <div className="mt-1 text-xs text-[var(--wb-muted)]">
                    Published {p.publishedAt ? new Date(p.publishedAt).toLocaleString() : "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="wb-button" href={`/dashboard/posts/${p.id}`}>
                    Edit
                  </Link>
                  <Link className="wb-button" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

