"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationProfile } from "@/lib/storage/types";

export default function OrgSettingsClient({ initial }: { initial: OrganizationProfile }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OrganizationProfile>(initial);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile)
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
          <div>
            <label className="text-sm font-semibold">Name</label>
            <input
              className="wb-input mt-2 w-full"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            />
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
                value={profile.preferredTerms.join(", ")}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    preferredTerms: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
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
                    avoidTerms: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
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

