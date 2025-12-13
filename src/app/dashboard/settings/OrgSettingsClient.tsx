"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationObjective, OrganizationProfile } from "@/lib/storage/types";

const OBJECTIVES: Array<{ id: OrganizationObjective; label: string }> = [
  { id: "education", label: "Education" },
  { id: "awareness", label: "Awareness" },
  { id: "donations", label: "Donations" },
  { id: "news", label: "News & updates" },
  { id: "species-info", label: "Species info" },
  { id: "habitat-info", label: "Habitat/ecosystem info" },
  { id: "advocacy", label: "Advocacy" },
  { id: "volunteering", label: "Volunteer recruitment" }
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

export default function OrgSettingsClient({ initial }: { initial: OrganizationProfile }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OrganizationProfile>(initial);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...profile,
        website: normalizeWebsite(profile.website),
        focusAreas: profile.focusAreas.map((s) => s.trim()).filter(Boolean).slice(0, 30),
        preferredTerms: profile.preferredTerms.map((s) => s.trim()).filter(Boolean).slice(0, 100),
        avoidTerms: profile.avoidTerms.map((s) => s.trim()).filter(Boolean).slice(0, 100)
      };
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
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
        <h1 className="text-2xl font-bold tracking-tight">Organization settings</h1>
        <p className="mt-2 text-[var(--wb-muted)]">
          These settings guide the writing tone and preferred language.
        </p>
      </header>

      {error ? (
        <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="wb-card p-6">
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Name</label>
              <input
                className="wb-input mt-2 w-full"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Website</label>
              <input
                className="wb-input mt-2 w-full"
                value={profile.website}
                onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://example.org"
              />
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Focus areas (one per line)</label>
              <textarea
                className="wb-input mt-2 min-h-28 w-full"
                value={profile.focusAreas.join("\n")}
                onChange={(e) => setProfile((p) => ({ ...p, focusAreas: normalizeList(e.target.value, 30) }))}
                placeholder={"sea turtles\nmangrove forests\npollinators"}
              />
            </div>
            <div>
              <div className="text-sm font-semibold">Objectives</div>
              <div className="mt-2 grid gap-2">
                {OBJECTIVES.map((o) => {
                  const checked = profile.objectives.includes(o.id);
                  return (
                    <label key={o.id} className="wb-card flex cursor-pointer items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setProfile((p) => {
                            const next = new Set(p.objectives);
                            if (e.target.checked) next.add(o.id);
                            else next.delete(o.id);
                            return { ...p, objectives: Array.from(next) };
                          });
                        }}
                      />
                      <div className="text-sm font-semibold">{o.label}</div>
                    </label>
                  );
                })}
              </div>
            </div>
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
                value={profile.preferredTerms.join(", ")}
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
                value={profile.avoidTerms.join(", ")}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    avoidTerms: normalizeList(e.target.value, 100)
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button className="wb-button" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
