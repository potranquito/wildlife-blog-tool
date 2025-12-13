"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationObjective, OrganizationProfile } from "@/lib/storage/types";

const OBJECTIVES: Array<{
  id: OrganizationObjective;
  label: string;
  description: string;
}> = [
  {
    id: "education",
    label: "Education",
    description: "Explain species/habitat science clearly and responsibly."
  },
  {
    id: "awareness",
    label: "Awareness",
    description: "Highlight issues, build empathy, and make it shareable."
  },
  {
    id: "donations",
    label: "Donations",
    description: "Show impact and build trust for fundraising."
  },
  {
    id: "news",
    label: "News & updates",
    description: "Publish timely field notes, milestones, and announcements."
  },
  {
    id: "species-info",
    label: "Species info",
    description: "Create evergreen guides about focal species."
  },
  {
    id: "habitat-info",
    label: "Habitat/ecosystem info",
    description: "Explain how ecosystems work and why they matter."
  },
  {
    id: "advocacy",
    label: "Advocacy",
    description: "Support policy and community action with evidence."
  },
  {
    id: "volunteering",
    label: "Volunteer recruitment",
    description: "Help people understand how to get involved."
  }
];

function normalizeList(text: string, max: number) {
  return text
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeWebsite(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export default function OnboardingClient({ initial }: { initial: OrganizationProfile }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OrganizationProfile>(initial);

  const [seed, setSeed] = useState({
    importWebsite: true,
    wikipedia: true,
    starterPlan: true
  });

  const focusAreasText = useMemo(() => profile.focusAreas.join("\n"), [profile.focusAreas]);
  const preferredTermsText = useMemo(() => profile.preferredTerms.join(", "), [profile.preferredTerms]);
  const avoidTermsText = useMemo(() => profile.avoidTerms.join(", "), [profile.avoidTerms]);

  function toggleObjective(id: OrganizationObjective) {
    setProfile((p) => {
      const next = new Set(p.objectives);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...p, objectives: Array.from(next) };
    });
  }

  async function submit(mode: "complete" | "skip") {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        profile: {
          ...profile,
          website: normalizeWebsite(profile.website),
          focusAreas: profile.focusAreas.map((s) => s.trim()).filter(Boolean).slice(0, 30),
          preferredTerms: profile.preferredTerms.map((s) => s.trim()).filter(Boolean).slice(0, 100),
          avoidTerms: profile.avoidTerms.map((s) => s.trim()).filter(Boolean).slice(0, 100)
        },
        seed:
          mode === "skip"
            ? { importWebsite: false, wikipedia: false, starterPlan: false }
            : { ...seed, importWebsite: seed.importWebsite && Boolean(profile.website.trim()) }
      };

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Onboarding failed");

      router.push(mode === "complete" ? "/dashboard/knowledge" : "/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Welcome — let’s set up your organization</h1>
        <p className="mt-2 text-[var(--wb-muted)]">
          This information guides research, drafting, and the knowledge base you build.
        </p>
      </header>

      {error ? (
        <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="wb-card p-6">
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Organization name</label>
              <input
                className="wb-input mt-2 w-full"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Website (optional)</label>
              <input
                className="wb-input mt-2 w-full"
                value={profile.website}
                onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://example.org"
              />
              <div className="mt-2 text-xs text-[var(--wb-muted)]">
                If provided, we can pull a few pages into the knowledge base.
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Focus animals/plants/habitats (one per line)</label>
              <textarea
                className="wb-input mt-2 min-h-28 w-full"
                value={focusAreasText}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    focusAreas: normalizeList(e.target.value, 30)
                  }))
                }
                placeholder={"sea turtles\nmangrove forests\npollinators"}
              />
            </div>
            <div>
              <div className="text-sm font-semibold">Objectives</div>
              <div className="mt-2 grid gap-2">
                {OBJECTIVES.map((o) => {
                  const checked = profile.objectives.includes(o.id);
                  return (
                    <label key={o.id} className="wb-card flex cursor-pointer gap-3 p-3">
                      <input type="checkbox" checked={checked} onChange={() => toggleObjective(o.id)} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{o.label}</div>
                        <div className="mt-1 text-xs text-[var(--wb-muted)]">{o.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">Tagline</label>
            <input
              className="wb-input mt-2 w-full"
              value={profile.tagline}
              onChange={(e) => setProfile((p) => ({ ...p, tagline: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Mission</label>
            <textarea
              className="wb-input mt-2 min-h-24 w-full"
              value={profile.mission}
              onChange={(e) => setProfile((p) => ({ ...p, mission: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Voice & tone guidelines</label>
            <textarea
              className="wb-input mt-2 min-h-40 w-full"
              value={profile.voiceGuidelines}
              onChange={(e) => setProfile((p) => ({ ...p, voiceGuidelines: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Preferred terms (comma-separated)</label>
              <input
                className="wb-input mt-2 w-full"
                value={preferredTermsText}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    preferredTerms: normalizeList(e.target.value, 100)
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Avoid terms (comma-separated)</label>
              <input
                className="wb-input mt-2 w-full"
                value={avoidTermsText}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    avoidTerms: normalizeList(e.target.value, 100)
                  }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="wb-card p-6">
        <div className="text-sm font-semibold">Auto-setup (recommended)</div>
        <p className="mt-2 text-sm text-[var(--wb-muted)]">
          We’ll fetch a small number of public pages and save excerpts to your knowledge base. You can remove any
          sources later.
        </p>

        <div className="mt-4 grid gap-2">
          <label className="wb-card flex cursor-pointer items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={seed.importWebsite}
              disabled={!profile.website.trim()}
              onChange={(e) => setSeed((s) => ({ ...s, importWebsite: e.target.checked }))}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Import from my website</div>
              <div className="mt-1 text-xs text-[var(--wb-muted)]">Home + a few common pages (about/mission/etc).</div>
            </div>
          </label>
          <label className="wb-card flex cursor-pointer items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={seed.wikipedia}
              onChange={(e) => setSeed((s) => ({ ...s, wikipedia: e.target.checked }))}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Add Wikipedia summaries for focus areas</div>
              <div className="mt-1 text-xs text-[var(--wb-muted)]">Useful baseline context; verify with primary sources.</div>
            </div>
          </label>
          <label className="wb-card flex cursor-pointer items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={seed.starterPlan}
              onChange={(e) => setSeed((s) => ({ ...s, starterPlan: e.target.checked }))}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Create a starter content plan</div>
              <div className="mt-1 text-xs text-[var(--wb-muted)]">Suggested pillars, post ideas, and research prompts.</div>
            </div>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button className="wb-button" disabled={busy} onClick={() => void submit("skip")}>
          {busy ? "Working…" : "Skip for now"}
        </button>
        <button
          className="wb-button"
          disabled={busy || !profile.name.trim() || !profile.tagline.trim() || !profile.mission.trim()}
          onClick={() => void submit("complete")}
        >
          {busy ? "Setting up…" : "Complete setup"}
        </button>
      </div>
    </div>
  );
}
