import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { generateWithAzureOpenAI } from "@/lib/ai/providers/azure";
import { generateWithOpenAI } from "@/lib/ai/providers/openai";
import { extractJsonObject } from "@/lib/ai/json";

const ImproveSchema = z.object({
  post: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    summary: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    keywords: z.array(z.string()),
    contentMarkdown: z.string()
  }),
  quality: z.object({
    readability: z.object({
      fleschReadingEase: z.number(),
      fleschKincaidGrade: z.number(),
      avgSentenceLength: z.number(),
      recommendation: z.string()
    }),
    seo: z.object({
      overallScore: z.number(),
      recommendations: z.array(z.string()),
      warnings: z.array(z.string())
    })
  })
});

const ImprovedPostSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  summary: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  keywords: z.array(z.string()),
  contentMarkdown: z.string()
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = ImproveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const { post, quality } = parsed.data;

  try {
    // Build improvement prompt based on quality analysis
    const prompt = buildImprovementPrompt(post, quality);

    // Check which AI provider is configured
    const azureConfigured =
      Boolean(process.env.AZURE_OPENAI_ENDPOINT?.trim()) &&
      Boolean(process.env.AZURE_OPENAI_API_KEY?.trim()) &&
      Boolean(process.env.AZURE_OPENAI_DEPLOYMENT?.trim());

    const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

    let response: string;
    if (azureConfigured) {
      response = await generateWithAzureOpenAI(prompt);
    } else if (openaiConfigured) {
      response = await generateWithOpenAI(prompt);
    } else {
      return NextResponse.json({ error: "No AI provider configured" }, { status: 503 });
    }

    // Parse the AI response
    const obj = extractJsonObject(response);
    const improved = ImprovedPostSchema.safeParse(obj);

    if (!improved.success) {
      console.error("AI improvement validation errors:", JSON.stringify(improved.error.errors, null, 2));
      console.error("Received object:", JSON.stringify(obj, null, 2));
      throw new Error("AI returned invalid improved content");
    }

    return NextResponse.json({ improved: improved.data });
  } catch (err) {
    console.error("Improvement error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to improve content" },
      { status: 500 }
    );
  }
}

function buildImprovementPrompt(
  post: {
    title: string;
    subtitle?: string;
    summary: string;
    seoTitle?: string;
    seoDescription?: string;
    keywords: string[];
    contentMarkdown: string;
  },
  quality: {
    readability: {
      fleschReadingEase: number;
      fleschKincaidGrade: number;
      avgSentenceLength: number;
      recommendation: string;
    };
    seo: {
      overallScore: number;
      recommendations: string[];
      warnings: string[];
    };
  }
) {
  return `
You are a wildlife conservation content editor. Your task is to improve a blog post based on content quality analysis.

## Current Content

**Title:** ${post.title}
**Subtitle:** ${post.subtitle || "(none)"}
**Summary:** ${post.summary}
**SEO Title:** ${post.seoTitle || "(none)"}
**SEO Description:** ${post.seoDescription || "(none)"}
**Keywords:** ${post.keywords.join(", ")}

**Content (Markdown):**
${post.contentMarkdown}

## Quality Analysis

**Readability Score:** ${quality.readability.fleschReadingEase.toFixed(1)} (Flesch Reading Ease)
**Grade Level:** ${quality.readability.fleschKincaidGrade.toFixed(1)}
**Average Sentence Length:** ${quality.readability.avgSentenceLength.toFixed(1)} words
**Recommendation:** ${quality.readability.recommendation}

**SEO Score:** ${quality.seo.overallScore}/100

**SEO Recommendations:**
${quality.seo.recommendations.map(r => `- ${r}`).join('\n')}

**SEO Warnings:**
${quality.seo.warnings.map(w => `- ${w}`).join('\n')}

## Improvement Instructions

Based on the quality analysis above, improve the blog post by:

1. **Readability Improvements:**
   - If average sentence length > 20 words, break long sentences into shorter ones
   - Simplify complex words and phrases where possible
   - Use active voice instead of passive voice
   - Add transition words to improve flow

2. **SEO Improvements:**
   - Address all SEO recommendations
   - Fix SEO warnings
   - Optimize title and meta description if they're missing or suboptimal
   - Ensure keywords are naturally integrated (avoid stuffing)
   - Add or improve headings (H1, H2, H3) for better structure

3. **Content Quality:**
   - Maintain the original message and accuracy
   - Keep the wildlife conservation focus
   - Preserve factual information
   - Keep the hopeful, action-oriented tone

## Output Format

Return ONLY a single JSON object with these fields:
{
  "title": "improved title (50-60 chars, include primary keyword)",
  "subtitle": "improved subtitle (optional)",
  "summary": "improved summary (1-3 sentences, clear and engaging)",
  "seoTitle": "optimized SEO title (50-60 chars)",
  "seoDescription": "optimized SEO description (150-160 chars)",
  "keywords": ["keyword1", "keyword2", ...],
  "contentMarkdown": "improved markdown content with better readability, structure, and SEO"
}

Make meaningful improvements while preserving the essence of the original content.
`.trim();
}
