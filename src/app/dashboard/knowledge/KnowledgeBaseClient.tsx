"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { KnowledgeSourceMeta, SourceType } from "@/lib/storage/types";

type Props = {
  initialSources: KnowledgeSourceMeta[];
};

function badge(type: SourceType) {
  switch (type) {
    case "ORG_URL":
      return "Org URL";
    case "COMPETITOR_URL":
      return "Competitor URL";
    case "UPLOAD":
      return "Upload";
    case "PASTE":
      return "Paste";
  }
}

export default function KnowledgeBaseClient({ initialSources }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sources = useMemo(() => initialSources, [initialSources]);

  async function handleUpload(form: HTMLFormElement) {
    setError(null);
    setBusy("upload");
    try {
      const formData = new FormData(form);
      const res = await fetch("/api/sources/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      form.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function handlePaste(form: HTMLFormElement) {
    setError(null);
    setBusy("paste");
    try {
      const title = (form.elements.namedItem("title") as HTMLInputElement | null)?.value ?? "";
      const contentText = (form.elements.namedItem("contentText") as HTMLTextAreaElement | null)?.value ?? "";
      const res = await fetch("/api/sources/paste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, contentText })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      form.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleFetchUrl(form: HTMLFormElement) {
    setError(null);
    setBusy("fetch");
    try {
      const url = (form.elements.namedItem("url") as HTMLInputElement | null)?.value ?? "";
      const res = await fetch("/api/sources/fetch-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, type: "ORG_URL" })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fetch failed");
      form.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge base</h1>
        <p className="mt-2 text-[var(--wb-muted)]">
          Add organization documents and URLs you want the generator to write with.
        </p>
      </header>

      {error ? (
        <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid gap-4">
        <div className="wb-card overflow-hidden p-5">
          <div className="text-sm font-semibold">Upload</div>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleUpload(e.currentTarget);
            }}
          >
            <input
              className="wb-input w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--wb-accent)] file:px-3 file:py-1 file:text-sm file:text-white"
              name="file"
              type="file"
              accept=".txt,.md,.markdown,.pdf,.doc,.docx,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
            <button className="wb-button w-full" disabled={busy === "upload"} type="submit">
              {busy === "upload" ? "Uploading…" : "Upload"}
            </button>
            <div className="text-xs text-[var(--wb-muted)]">Supported: .txt, .md, .pdf, .docx</div>
          </form>
        </div>

        <div className="wb-card overflow-hidden p-5">
          <div className="text-sm font-semibold">Fetch a URL</div>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleFetchUrl(e.currentTarget);
            }}
          >
            <input className="wb-input w-full" name="url" placeholder="https://example.org/blog/post" />
            <button className="wb-button w-full" disabled={busy === "fetch"} type="submit">
              {busy === "fetch" ? "Fetching…" : "Fetch & save"}
            </button>
          </form>
        </div>

        <div className="wb-card overflow-hidden p-5">
          <div className="text-sm font-semibold">Paste notes</div>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handlePaste(e.currentTarget);
            }}
          >
            <input className="wb-input w-full" name="title" placeholder="Title (e.g., Team notes)" />
            <textarea className="wb-input w-full min-h-28" name="contentText" placeholder="Paste plain text…" />
            <button className="wb-button w-full" disabled={busy === "paste"} type="submit">
              {busy === "paste" ? "Saving…" : "Save notes"}
            </button>
          </form>
        </div>
      </div>

      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Sources ({sources.length})</h2>
          <div className="text-xs text-[var(--wb-muted)]">
            Tip: keep sources focused; quality beats quantity.
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="wb-card p-6 text-[var(--wb-muted)]">No sources yet.</div>
        ) : (
          sources.map((s) => (
            <div key={s.id} className="wb-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.title}</div>
                  <div className="mt-1 text-xs text-[var(--wb-muted)]">
                    {badge(s.type)} · {s.wordCount.toLocaleString()} words ·{" "}
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                  {s.url ? (
                    <div className="mt-2 truncate text-xs">
                      <a className="wb-link" href={s.url} rel="noreferrer" target="_blank">
                        {s.url}
                      </a>
                    </div>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--wb-muted)]">sha256: {s.sha256.slice(0, 10)}…</div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

