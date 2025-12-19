"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationObjective, OrganizationProfile } from "@/lib/storage/types";

type DiscoveredOrg = {
  name: string;
  url: string;
  description: string;
  newsUrl?: string;
  detectedNewsUrl?: string;
  feedType?: "RSS" | "HTML";
  relevance: "high" | "medium" | "low";
  validated: boolean;
  selected: boolean;
};

type DiscoveredWikiTopic = {
  title: string;
  description: string;
  relevance: "high" | "medium" | "low";
  validated: boolean;
  wikiUrl?: string;
  extract?: string;
  selected: boolean;
};

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

type Phase = "url" | "discovery" | "form";

export default function OnboardingClient({ initial }: { initial: OrganizationProfile }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("url");
  const [urlInput, setUrlInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OrganizationProfile>(initial);

  // Discovery state
  const [discoveredOrgs, setDiscoveredOrgs] = useState<DiscoveredOrg[]>([]);
  const [discoveredWikiTopics, setDiscoveredWikiTopics] = useState<DiscoveredWikiTopic[]>([]);
  const [extractedKeywords, setExtractedKeywords] = useState<{
    searchKeywords: string[];
    locationTerms: string[];
    speciesTerms: string[];
  }>({ searchKeywords: [], locationTerms: [], speciesTerms: [] });

  const [seed, setSeed] = useState({
    importWebsite: true,
    wikipedia: true,
    starterPlan: true,
    monitorFeeds: [] as string[],
    wikiTopics: [] as string[]
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

  async function extractFromUrl() {
    if (!urlInput.trim()) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch("/api/onboarding/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to analyze website");

      // Merge extracted profile with initial defaults
      const newProfile = {
        ...profile,
        name: data.profile.name || profile.name,
        website: normalizeWebsite(urlInput),
        tagline: data.profile.tagline || profile.tagline,
        mission: data.profile.mission || profile.mission,
        focusAreas: data.profile.focusAreas?.length ? data.profile.focusAreas : profile.focusAreas,
        objectives: data.profile.objectives?.length ? data.profile.objectives : profile.objectives,
        voiceGuidelines: data.profile.voiceGuidelines || profile.voiceGuidelines,
        preferredTerms: data.profile.preferredTerms?.length ? data.profile.preferredTerms : profile.preferredTerms,
        avoidTerms: data.profile.avoidTerms?.length ? data.profile.avoidTerms : profile.avoidTerms
      };
      setProfile(newProfile);

      // Store extracted keywords for discovery
      setExtractedKeywords({
        searchKeywords: data.profile.searchKeywords || [],
        locationTerms: data.profile.locationTerms || [],
        speciesTerms: data.profile.speciesTerms || []
      });

      // Start discovery phase
      setExtracting(false);
      setDiscovering(true);
      setPhase("discovery");

      // Run discovery in background
      await runDiscovery(data.profile);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Failed to analyze website");
      setExtracting(false);
    }
  }

  async function runDiscovery(extractedProfile: Record<string, unknown>) {
    setDiscoveryError(null);
    try {
      const res = await fetch("/api/onboarding/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: extractedProfile })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");

      setDiscoveredOrgs(data.similarOrgs || []);
      setDiscoveredWikiTopics(data.wikipediaTopics || []);
    } catch (e) {
      setDiscoveryError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  function toggleOrgSelection(index: number) {
    setDiscoveredOrgs((orgs) =>
      orgs.map((org, i) => (i === index ? { ...org, selected: !org.selected } : org))
    );
  }

  function toggleWikiSelection(index: number) {
    setDiscoveredWikiTopics((topics) =>
      topics.map((topic, i) => (i === index ? { ...topic, selected: !topic.selected } : topic))
    );
  }

  function proceedToForm() {
    // Collect selected feeds
    const selectedFeeds = discoveredOrgs
      .filter((org) => org.selected && (org.detectedNewsUrl || org.newsUrl))
      .map((org) => org.detectedNewsUrl || org.newsUrl!)
      .filter(Boolean);

    // Collect selected wiki topics
    const selectedWikiTopics = discoveredWikiTopics
      .filter((topic) => topic.selected)
      .map((topic) => topic.title);

    setSeed((s) => ({
      ...s,
      monitorFeeds: selectedFeeds,
      wikiTopics: selectedWikiTopics
    }));

    setPhase("form");
  }

  function skipToManual() {
    setPhase("form");
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
            ? { importWebsite: false, wikipedia: false, starterPlan: false, monitorFeeds: [], wikiTopics: [] }
            : {
                ...seed,
                importWebsite: seed.importWebsite && Boolean(profile.website.trim()),
                monitorFeeds: seed.monitorFeeds,
                wikiTopics: seed.wikiTopics
              }
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

  // URL input phase
  if (phase === "url") {
    return (
      <div className="grid gap-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Welcome — let's set up your organization</h1>
          <p className="mt-2 text-[var(--wb-muted)]">
            Enter your organization's website and we'll analyze it to pre-fill your profile.
          </p>
        </header>

        {extractError ? (
          <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{extractError}</div>
        ) : null}

        <div className="wb-card p-6">
          <label className="text-sm font-semibold">Organization website</label>
          <div className="mt-2 flex gap-3">
            <input
              className="wb-input flex-1"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://your-organization.org"
              disabled={extracting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && urlInput.trim()) {
                  void extractFromUrl();
                }
              }}
            />
            <button
              className="wb-button whitespace-nowrap"
              disabled={extracting || !urlInput.trim()}
              onClick={() => void extractFromUrl()}
            >
              {extracting ? "Analyzing..." : "Fetch & Analyze"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--wb-muted)]">
            We'll fetch your homepage and common pages (about, mission, etc.) to extract organization details.
          </p>

          {extracting ? (
            <div className="mt-4 flex items-center gap-3 text-sm text-[var(--wb-muted)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Fetching and analyzing your website...
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <button className="text-sm text-[var(--wb-muted)] hover:underline" onClick={skipToManual}>
            Skip — I'll fill this out manually
          </button>
        </div>
      </div>
    );
  }

  // Discovery phase
  if (phase === "discovery") {
    const selectedOrgCount = discoveredOrgs.filter((o) => o.selected).length;
    const selectedWikiCount = discoveredWikiTopics.filter((t) => t.selected).length;
    const orgsWithFeeds = discoveredOrgs.filter((o) => o.detectedNewsUrl || o.newsUrl);

    return (
      <div className="grid gap-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">
            {discovering ? "Discovering related sources..." : "We found related sources"}
          </h1>
          <p className="mt-2 text-[var(--wb-muted)]">
            {discovering
              ? "Searching for similar organizations and relevant topics..."
              : "Select organizations to add to your Monitor and Wikipedia topics for your Knowledge Base."}
          </p>
        </header>

        {discoveryError ? (
          <div className="wb-card border-red-400/30 p-4 text-sm text-red-200">{discoveryError}</div>
        ) : null}

        {discovering ? (
          <div className="wb-card p-6">
            <div className="flex items-center gap-3 text-sm text-[var(--wb-muted)]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <div>
                <div>Analyzing your organization profile...</div>
                <div className="mt-1 text-xs">Finding similar conservation organizations and relevant topics</div>
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--wb-border)]">
              <div className="h-full animate-pulse bg-[var(--wb-accent)]" style={{ width: "60%" }} />
            </div>
          </div>
        ) : (
          <>
            {/* Similar Organizations */}
            <div className="wb-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Similar Organizations</div>
                  <div className="mt-1 text-xs text-[var(--wb-muted)]">
                    Add their news feeds to Monitor ({orgsWithFeeds.length} have news feeds)
                  </div>
                </div>
                <div className="text-xs text-[var(--wb-muted)]">{selectedOrgCount} selected</div>
              </div>

              {discoveredOrgs.length === 0 ? (
                <div className="mt-4 text-sm text-[var(--wb-muted)]">No organizations found.</div>
              ) : (
                <div className="mt-4 grid gap-2">
                  {discoveredOrgs.map((org, i) => (
                    <label
                      key={i}
                      className={`wb-card flex cursor-pointer items-start gap-3 p-3 ${
                        !org.validated ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={org.selected}
                        onChange={() => toggleOrgSelection(i)}
                        disabled={!org.validated || (!org.detectedNewsUrl && !org.newsUrl)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{org.name}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              org.relevance === "high"
                                ? "bg-green-500/20 text-green-400"
                                : org.relevance === "medium"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-gray-500/20 text-gray-400"
                            }`}
                          >
                            {org.relevance}
                          </span>
                          {org.feedType && (
                            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">
                              {org.feedType}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[var(--wb-muted)]">{org.description}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <a
                            href={org.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--wb-accent)] hover:underline"
                          >
                            {new URL(org.url).hostname}
                          </a>
                          {(org.detectedNewsUrl || org.newsUrl) && (
                            <>
                              <span className="text-[var(--wb-muted)]">·</span>
                              <span className="text-green-400">Has news feed</span>
                            </>
                          )}
                          {!org.validated && <span className="text-red-400">· Could not verify</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Wikipedia Topics */}
            <div className="wb-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Wikipedia Topics</div>
                  <div className="mt-1 text-xs text-[var(--wb-muted)]">
                    Add background information to your Knowledge Base
                  </div>
                </div>
                <div className="text-xs text-[var(--wb-muted)]">{selectedWikiCount} selected</div>
              </div>

              {discoveredWikiTopics.length === 0 ? (
                <div className="mt-4 text-sm text-[var(--wb-muted)]">No topics found.</div>
              ) : (
                <div className="mt-4 grid gap-2">
                  {discoveredWikiTopics.map((topic, i) => (
                    <label
                      key={i}
                      className={`wb-card flex cursor-pointer items-start gap-3 p-3 ${
                        !topic.validated ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={topic.selected}
                        onChange={() => toggleWikiSelection(i)}
                        disabled={!topic.validated}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{topic.title}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              topic.relevance === "high"
                                ? "bg-green-500/20 text-green-400"
                                : topic.relevance === "medium"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-gray-500/20 text-gray-400"
                            }`}
                          >
                            {topic.relevance}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--wb-muted)]">{topic.description}</div>
                        {topic.extract && (
                          <div className="mt-2 text-xs text-[var(--wb-muted)] line-clamp-2">{topic.extract}</div>
                        )}
                        {!topic.validated && (
                          <div className="mt-1 text-xs text-red-400">Could not verify Wikipedia article</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Extracted Keywords Summary */}
            {(extractedKeywords.searchKeywords.length > 0 ||
              extractedKeywords.locationTerms.length > 0 ||
              extractedKeywords.speciesTerms.length > 0) && (
              <details className="wb-card p-5">
                <summary className="cursor-pointer text-sm font-semibold">Extracted keywords (used for discovery)</summary>
                <div className="mt-3 grid gap-2 text-xs">
                  {extractedKeywords.speciesTerms.length > 0 && (
                    <div>
                      <span className="text-[var(--wb-muted)]">Species: </span>
                      {extractedKeywords.speciesTerms.join(", ")}
                    </div>
                  )}
                  {extractedKeywords.locationTerms.length > 0 && (
                    <div>
                      <span className="text-[var(--wb-muted)]">Locations: </span>
                      {extractedKeywords.locationTerms.join(", ")}
                    </div>
                  )}
                  {extractedKeywords.searchKeywords.length > 0 && (
                    <div>
                      <span className="text-[var(--wb-muted)]">Keywords: </span>
                      {extractedKeywords.searchKeywords.join(", ")}
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex items-center justify-between gap-3">
              <button className="text-sm text-[var(--wb-muted)] hover:underline" onClick={() => setPhase("form")}>
                Skip discovery
              </button>
              <button className="wb-button" onClick={proceedToForm}>
                Continue with {selectedOrgCount + selectedWikiCount} sources
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Form phase
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Welcome — let's set up your organization</h1>
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

          {/* Discovered sources from discovery phase */}
          {seed.monitorFeeds.length > 0 && (
            <div className="wb-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-green-400">●</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    Add {seed.monitorFeeds.length} organization feed{seed.monitorFeeds.length > 1 ? "s" : ""} to Monitor
                  </div>
                  <div className="mt-1 text-xs text-[var(--wb-muted)]">
                    Selected from discovered similar organizations
                  </div>
                </div>
              </div>
            </div>
          )}

          {seed.wikiTopics.length > 0 && (
            <div className="wb-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-green-400">●</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    Add {seed.wikiTopics.length} Wikipedia topic{seed.wikiTopics.length > 1 ? "s" : ""} to Knowledge Base
                  </div>
                  <div className="mt-1 text-xs text-[var(--wb-muted)]">
                    {seed.wikiTopics.slice(0, 3).join(", ")}
                    {seed.wikiTopics.length > 3 && ` +${seed.wikiTopics.length - 3} more`}
                  </div>
                </div>
              </div>
            </div>
          )}
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
