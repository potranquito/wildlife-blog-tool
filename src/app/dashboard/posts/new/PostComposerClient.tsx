"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { KnowledgeSourceMeta, SourceType } from "@/lib/storage/types";

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

export default function PostComposerClient({ sources }: { sources: KnowledgeSourceMeta[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickStartExpanded, setQuickStartExpanded] = useState(true);
  const [quickIdea, setQuickIdea] = useState("");

  const [title, setTitle] = useState("");
  const [subtitles, setSubtitles] = useState("");
  const [keywords, setKeywords] = useState("");
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [cta, setCta] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(sources.map((s) => s.id)));

  const selectedCount = selected.size;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  async function getSuggestions(mode: "from-idea" | "surprise-me") {
    setSuggestBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/posts/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idea: mode === "from-idea" ? quickIdea : undefined,
          mode,
          includeSourceAnalysis: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suggestion failed");

      // Auto-fill the form
      setTitle(data.title || "");
      setSubtitles((data.subtitles || []).join("\n"));
      setKeywords((data.keywords || []).join(", "));
      setIdea(data.idea || "");
      setAudience(data.targetAudience || "");
      setCta(data.callToAction || "");

      // Auto-select relevant sources
      if (data.sources && Array.isArray(data.sources)) {
        setSelected(new Set(data.sources));
      }

      // Collapse quick start after filling
      setQuickStartExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setSuggestBusy(false);
    }
  }

  async function regenerateField(field: string) {
    setRegeneratingField(field);
    setError(null);
    try {
      // Use current form values as context for regeneration
      const res = await fetch("/api/posts/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idea: idea || title || quickIdea,
          mode: "from-idea",
          includeSourceAnalysis: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Regeneration failed");

      // Update only the specific field
      switch (field) {
        case "title":
          setTitle(data.title || "");
          break;
        case "subtitles":
          setSubtitles((data.subtitles || []).join("\n"));
          break;
        case "keywords":
          setKeywords((data.keywords || []).join(", "));
          break;
        case "idea":
          setIdea(data.idea || "");
          break;
        case "audience":
          setAudience(data.targetAudience || "");
          break;
        case "cta":
          setCta(data.callToAction || "");
          break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegeneratingField(null);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title,
        subtitles: subtitles
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        keywords: keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        idea,
        targetAudience: audience,
        callToAction: cta,
        sourceIds: selectedIds
      };

      const res = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const id = data.post?.id as string | undefined;
      if (!id) throw new Error("Missing post id");
      router.push(`/dashboard/posts/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">New post</h1>
        <p className="mt-2 text-[var(--wb-muted)]">
          Start with a quick idea or fill in the details manually. Then generate a draft you can edit before publishing.
        </p>
      </header>

      {/* Quick Start Section */}
      <div className="wb-card overflow-hidden">
        <button
          className="flex w-full items-center justify-between p-5 text-left"
          onClick={() => setQuickStartExpanded(!quickStartExpanded)}
        >
          <div>
            <div className="text-sm font-semibold">💡 Quick Start</div>
            <div className="mt-1 text-xs text-[var(--wb-muted)]">
              Auto-fill the form from a short idea or get random inspiration
            </div>
          </div>
          <div className="text-[var(--wb-muted)]">
            {quickStartExpanded ? "▼" : "▶"}
          </div>
        </button>

        {quickStartExpanded && (
          <div className="border-t border-[var(--wb-border)] p-5">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-semibold">Describe your blog post idea:</label>
                <textarea
                  className="wb-input mt-2 w-full"
                  rows={2}
                  value={quickIdea}
                  onChange={(e) => setQuickIdea(e.target.value)}
                  placeholder="e.g., Write about African elephant populations and conservation efforts..."
                  disabled={suggestBusy}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="wb-button flex items-center gap-2"
                  disabled={suggestBusy || quickIdea.trim().length < 5}
                  onClick={() => void getSuggestions("from-idea")}
                >
                  {suggestBusy ? "✨ Generating..." : "✨ Auto-fill form"}
                </button>
                <button
                  className="wb-button flex items-center gap-2"
                  disabled={suggestBusy}
                  onClick={() => void getSuggestions("surprise-me")}
                >
                  {suggestBusy ? "🎲 Generating..." : "🎲 Surprise me!"}
                </button>
              </div>

              <div className="text-xs text-[var(--wb-muted)]">
                💡 Tip: "Auto-fill form" uses your idea • "Surprise me" picks a random topic from your knowledge base
              </div>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="wb-card p-6">
          <div className="grid gap-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Title</label>
                {title && (
                  <button
                    className="text-xs text-[var(--wb-muted)] hover:text-[var(--wb-accent)] disabled:opacity-50"
                    onClick={() => void regenerateField("title")}
                    disabled={regeneratingField !== null}
                    title="Regenerate title"
                  >
                    {regeneratingField === "title" ? "↻ Regenerating..." : "↻ Regenerate"}
                  </button>
                )}
              </div>
              <input className="wb-input mt-2 w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Subtitles / section ideas (one per line)</label>
                {subtitles && (
                  <button
                    className="text-xs text-[var(--wb-muted)] hover:text-[var(--wb-accent)] disabled:opacity-50"
                    onClick={() => void regenerateField("subtitles")}
                    disabled={regeneratingField !== null}
                    title="Regenerate subtitles"
                  >
                    {regeneratingField === "subtitles" ? "↻ Regenerating..." : "↻ Regenerate"}
                  </button>
                )}
              </div>
              <textarea
                className="wb-input mt-2 min-h-28 w-full"
                value={subtitles}
                onChange={(e) => setSubtitles(e.target.value)}
                placeholder={"Why it matters\nHow the ecosystem works\nWhat people can do"}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Target keywords (comma-separated)</label>
                {keywords && (
                  <button
                    className="text-xs text-[var(--wb-muted)] hover:text-[var(--wb-accent)] disabled:opacity-50"
                    onClick={() => void regenerateField("keywords")}
                    disabled={regeneratingField !== null}
                    title="Regenerate keywords"
                  >
                    {regeneratingField === "keywords" ? "↻ Regenerating..." : "↻ Regenerate"}
                  </button>
                )}
              </div>
              <input
                className="wb-input mt-2 w-full"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="wildlife corridors, habitat restoration, biodiversity"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">General idea / notes</label>
                {idea && (
                  <button
                    className="text-xs text-[var(--wb-muted)] hover:text-[var(--wb-accent)] disabled:opacity-50"
                    onClick={() => void regenerateField("idea")}
                    disabled={regeneratingField !== null}
                    title="Regenerate idea"
                  >
                    {regeneratingField === "idea" ? "↻ Regenerating..." : "↻ Regenerate"}
                  </button>
                )}
              </div>
              <textarea
                className="wb-input mt-2 min-h-40 w-full"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="What should this post cover? Any facts to include? Any stories?"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Target audience (optional)</label>
                  {audience && (
                    <button
                      className="text-xs text-[var(--wb-muted)] hover:text-[var(--wb-accent)] disabled:opacity-50"
                      onClick={() => void regenerateField("audience")}
                      disabled={regeneratingField !== null}
                      title="Regenerate audience"
                    >
                      {regeneratingField === "audience" ? "↻" : "↻"}
                    </button>
                  )}
                </div>
                <input
                  className="wb-input mt-2 w-full"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="donors, students, local community…"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Call to action (optional)</label>
                  {cta && (
                    <button
                      className="text-xs text-[var(--wb-muted)] hover:text-[var(--wb-accent)] disabled:opacity-50"
                      onClick={() => void regenerateField("cta")}
                      disabled={regeneratingField !== null}
                      title="Regenerate call to action"
                    >
                      {regeneratingField === "cta" ? "↻" : "↻"}
                    </button>
                  )}
                </div>
                <input
                  className="wb-input mt-2 w-full"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="donate, volunteer, share…"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                className="wb-button"
                disabled={busy || !title.trim() || idea.trim().length < 10}
                onClick={() => void generate()}
              >
                {busy ? "Generating…" : "Generate draft"}
              </button>
            </div>
            <div className="text-xs text-[var(--wb-muted)]">
              If no API key is configured, generation uses a local template.
            </div>
          </div>
        </div>

        <div className="wb-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Include sources</div>
            <div className="text-xs text-[var(--wb-muted)]">{selectedCount} selected</div>
          </div>
          <div className="mt-3 grid max-h-[520px] gap-2 overflow-auto pr-1">
            {sources.length === 0 ? (
              <div className="text-sm text-[var(--wb-muted)]">No sources yet. Add some in Knowledge base.</div>
            ) : (
              sources.map((s) => {
                const checked = selected.has(s.id);
                return (
                  <label key={s.id} className="wb-card flex cursor-pointer gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          return next;
                        });
                      }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{s.title}</div>
                      <div className="mt-1 text-xs text-[var(--wb-muted)]">
                        {badge(s.type)} · {s.wordCount.toLocaleString()} words
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

