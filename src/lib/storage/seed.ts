import type { BlogPostMeta, OrganizationProfile } from "@/lib/storage/types";

export function makeSeedProfile(): OrganizationProfile {
  return {
    name: "wildlife-blogger",
    website: "",
    tagline: "AI-assisted storytelling for wildlife conservation",
    mission:
      "Help wildlife organizations educate and engage the public with accurate, hopeful, action-oriented content that supports conservation outcomes.",
    focusAreas: [],
    objectives: ["education", "awareness"],
    voiceGuidelines:
      "Warm, factual, and optimistic. Avoid doom-only framing; always include clear actions people can take. Use plain language, define scientific terms, and cite sources when making claims.",
    preferredTerms: ["habitat", "biodiversity", "conservation", "restoration", "wildlife corridors"],
    avoidTerms: ["clickbait", "miracle cure", "guaranteed"],
    onboardingCompletedAt: null
  };
}

export function makeSeedPost(): { id: string; meta: BlogPostMeta; markdown: string } {
  const id = "seed-welcome";
  const now = new Date().toISOString();

  const meta: BlogPostMeta = {
    id,
    slug: "welcome-to-wildlife-blogger",
    status: "PUBLISHED",
    title: "Welcome to wildlife-blogger",
    subtitle: "A new way to research, write, and publish for conservation",
    summary:
      "wildlife-blogger helps conservation teams research other organizations’ content, build a knowledge base, and publish SEO-friendly articles that can be cited by search engines and LLMs.",
    keywords: ["wildlife conservation", "biodiversity", "education", "habitat"],
    seoTitle: "Welcome to wildlife-blogger · AI for conservation content",
    seoDescription:
      "Meet wildlife-blogger: research competitor pages, build a knowledge base, generate drafts, and publish conservation blog posts built for search and LLM discovery.",
    createdAt: now,
    updatedAt: now,
    publishedAt: now
  };

  const markdown = `# Why this exists

Wildlife organizations do life-saving work — and still have to fight to be discovered online. Search engines and modern LLMs tend to reward content that is:

- Clear and specific
- Well-structured (headings, summaries, scannable sections)
- Source-aware (claims match evidence)
- Action-oriented (people know what to do next)

wildlife-blogger is an all-in-one tool that helps you research, write, and publish content that meets those standards.

## What you can do in the dashboard

1. **Build a knowledge base**: upload internal notes, paste research, or fetch pages from your own site.
2. **Research competitor pages**: analyze headings, themes, and keyword signals from similar organizations.
3. **Generate drafts**: provide a title, keywords, and ideas — then generate a structured draft aligned to your organization’s voice.
4. **Edit and publish**: refine the content, then publish it to this site.

## A note on accuracy

Conservation communication must stay trustworthy. When you publish:

- Double-check numbers and claims
- Prefer primary sources (journals, government, NGO reports)
- Avoid sensational framing

If you want, we can add a “citations required” mode next.
`;

  return { id, meta, markdown };
}
