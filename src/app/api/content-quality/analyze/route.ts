import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateReadability, estimateReadingTime } from "@/lib/content-quality/readability";
import { analyzeSEO } from "@/lib/content-quality/seo";

const AnalyzeSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  seoDescription: z.string().optional(),
  contentMarkdown: z.string(),
  keywords: z.array(z.string()).default([]),
  baseUrl: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = AnalyzeSchema.parse(body);

    // Calculate readability
    const readability = calculateReadability(input.contentMarkdown);
    const readingTime = estimateReadingTime(input.contentMarkdown);

    // Perform SEO analysis
    const seo = analyzeSEO(
      input.title,
      input.summary || '',
      input.seoDescription,
      input.contentMarkdown,
      input.keywords,
      input.baseUrl
    );

    return NextResponse.json({
      readability,
      readingTime,
      seo
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
