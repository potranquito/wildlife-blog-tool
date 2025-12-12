import { z } from "zod";
import type { KnowledgeSource, OrganizationProfile } from "@/lib/storage/types";
import { truncateText } from "@/lib/utils/text";
import { generateWithAzureOpenAI } from "@/lib/ai/providers/azure";
import { generateWithOpenAI } from "@/lib/ai/providers/openai";
import { generateWithTemplate } from "@/lib/ai/providers/template";
import { extractJsonObject } from "@/lib/ai/json";

const DraftSchema = z.object({
  title: z.string().min(1).max(180),
  subtitle: z.string().max(220).optional(),
  summary: z.string().min(1).max(900),
  seoTitle: z.string().min(1).max(80),
  seoDescription: z.string().min(1).max(180),
  keywords: z.array(z.string().min(1).max(50)).max(30),
  contentMarkdown: z.string().min(200).max(200_000)
});

export async function generateBlogDraft(args: {
  org: OrganizationProfile;
  sources: KnowledgeSource[];
  input: {
    title: string;
    subtitles: string[];
    keywords: string[];
    idea: string;
    targetAudience?: string;
    callToAction?: string;
  };
}): Promise<
  z.infer<typeof DraftSchema> & {
    provider: "azure-openai" | "openai" | "template";
  }
> {
  const context = buildContext(args.org, args.sources);
  const prompt = buildPrompt(args.input, context);

  const azureConfigured =
    Boolean(process.env.AZURE_OPENAI_ENDPOINT?.trim()) &&
    Boolean(process.env.AZURE_OPENAI_API_KEY?.trim()) &&
    Boolean(process.env.AZURE_OPENAI_DEPLOYMENT?.trim());

  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (azureConfigured) {
    const raw = await generateWithAzureOpenAI(prompt);
    const obj = extractJsonObject(raw);
    const parsed = DraftSchema.safeParse(obj);
    if (!parsed.success) throw new Error("Azure OpenAI returned invalid JSON payload");
    return { ...parsed.data, provider: "azure-openai" };
  }

  if (openaiConfigured) {
    const raw = await generateWithOpenAI(prompt);
    const obj = extractJsonObject(raw);
    const parsed = DraftSchema.safeParse(obj);
    if (!parsed.success) throw new Error("OpenAI returned invalid JSON payload");
    return { ...parsed.data, provider: "openai" };
  }

  const generated = generateWithTemplate(args.input, args.org, args.sources);
  const parsed = DraftSchema.safeParse(generated);
  if (!parsed.success) throw new Error("Template generator returned invalid payload (bug)");
  return { ...parsed.data, provider: "template" };
}

function buildContext(org: OrganizationProfile, sources: KnowledgeSource[]) {
  const chunks: string[] = [];
  chunks.push(
    `Organization name: ${org.name}\nTagline: ${org.tagline}\nMission: ${org.mission}\nVoice guidelines: ${org.voiceGuidelines}\nPreferred terms: ${org.preferredTerms.join(
      ", "
    )}\nAvoid terms: ${org.avoidTerms.join(", ")}`
  );

  const maxPerSource = 6_000;
  const maxTotal = 40_000;

  for (const s of sources) {
    const header = `\n\n[Source: ${s.title} · ${s.type}${s.url ? ` · ${s.url}` : ""}]`;
    const body = truncateText(s.contentText, maxPerSource);
    chunks.push(`${header}\n${body}`);
  }

  return truncateText(chunks.join("\n"), maxTotal);
}

function buildPrompt(
  input: {
    title: string;
    subtitles: string[];
    keywords: string[];
    idea: string;
    targetAudience?: string;
    callToAction?: string;
  },
  context: string
) {
  return `
You are a senior wildlife conservation writer and SEO strategist.
Write for a wildlife conservation organization. Be accurate, calm, hopeful, and action-oriented.
Avoid sensationalism and avoid making precise factual claims unless supported by the provided sources; when uncertain, use cautious language and suggest verification.
Do not mention being an AI.

Return ONLY a single JSON object with these fields:
- title (string)
- subtitle (string, optional)
- summary (string, 1–3 sentences)
- seoTitle (string, <= 70–80 chars)
- seoDescription (string, <= 155–180 chars)
- keywords (string[], 6–16 items, dedupe)
- contentMarkdown (string, Markdown article with headings, lists, and a short “About ${input.title} / About the organization” box at the end)

Inputs:
Title: ${input.title}
Subtitles / section ideas: ${input.subtitles.join(" | ") || "(none provided)"}
Target keywords: ${input.keywords.join(", ") || "(none provided)"}
Target audience: ${input.targetAudience || "(not specified)"}
Call to action: ${input.callToAction || "(not specified)"}
General idea: ${input.idea}

Context sources (may be partial excerpts):
${context}
`.trim();
}

