import type { KnowledgeSource, OrganizationProfile } from "@/lib/storage/types";

export function generateWithTemplate(
  input: {
    title: string;
    subtitles: string[];
    keywords: string[];
    idea: string;
    targetAudience?: string;
    callToAction?: string;
  },
  org: OrganizationProfile,
  sources: KnowledgeSource[]
) {
  const keywords = Array.from(new Set(input.keywords.map((k) => k.trim()).filter(Boolean))).slice(0, 12);
  const primaryKeyword = keywords[0] ?? "wildlife conservation";

  const sourceLinks = sources
    .filter((s) => s.url)
    .slice(0, 8)
    .map((s) => `- ${s.url}`);

  const aboutMetaLines = [
    org.website ? `Website: ${org.website}` : "",
    org.focusAreas.length ? `Focus: ${org.focusAreas.join(", ")}` : "",
    org.objectives.length ? `Objectives: ${org.objectives.join(", ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const contentMarkdown = `# ${input.title}

## Summary

- **What this is about:** ${input.idea.trim()}
- **Why it matters:** Healthy habitats support biodiversity and resilient communities.
- **How you can help:** ${input.callToAction?.trim() || "Learn, share, and support conservation work."}

## Why "${primaryKeyword}" matters

${org.voiceGuidelines}

### What we’re trying to protect

Wildlife depends on connected habitat, clean water, and stable food webs. When any of those weaken, species face harder odds — often long before the public notices.

### Common threats (and what helps)

- Habitat loss and fragmentation → **wildlife corridors, restoration, protected areas**
- Human–wildlife conflict → **coexistence tools, community partnerships**
- Invasive species and disease → **monitoring, rapid response**

## Practical actions for readers

${input.targetAudience?.trim() ? `**For ${input.targetAudience.trim()}:**` : "**For everyday readers:**"}

- Support evidence-based conservation organizations
- Share accurate information and avoid sensational “doom” framing
- Advocate for habitat protection in your community

## Suggested sections

${(input.subtitles.length ? input.subtitles : ["What to watch for", "How to talk about this well", "How to help"]).map((s) => `### ${s}\n\nWrite a short, clear section here that ties back to the mission and the keyword goals.\n`).join("\n")}

## About ${org.name}

**${org.name}** — ${org.tagline}

${aboutMetaLines ? `${aboutMetaLines}\n\n` : ""}${org.mission}

${sourceLinks.length ? `## References\n${sourceLinks.join("\n")}` : ""}
`;

  return {
    title: input.title,
    subtitle: input.subtitles[0],
    summary:
      "Research-backed conservation writing: structured, source-aware, and action-oriented — designed for search and LLM discovery.",
    seoTitle: `${input.title}`.slice(0, 78),
    seoDescription:
      `A practical guide to ${primaryKeyword}: what it means, why it matters, and actions you can take to support wildlife conservation.`.slice(
        0,
        175
      ),
    keywords: keywords.length ? keywords : ["wildlife conservation", "habitat", "biodiversity"],
    contentMarkdown
  };
}
