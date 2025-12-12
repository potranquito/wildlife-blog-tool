import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { fetchAndExtractPage } from "@/lib/research/fetch";
import { analyzeText } from "@/lib/research/keywords";

const BodySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10)
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const results = [];
  for (const url of parsed.data.urls) {
    const page = await fetchAndExtractPage(url);
    const analysis = analyzeText(page.text);
    results.push({
      url,
      title: page.title,
      description: page.description,
      canonical: page.canonical,
      headings: page.headings,
      wordCount: analysis.wordCount,
      topTerms: analysis.topTerms,
      excerpt: analysis.excerpt
    });
  }

  return NextResponse.json({ results });
}

