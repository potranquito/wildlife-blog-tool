import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { generateBlogDraft } from "@/lib/ai/generate";
import { getOrgProfile } from "@/lib/storage/org";
import { createDraft } from "@/lib/storage/posts";
import { getSourceById } from "@/lib/storage/sources";

const BodySchema = z.object({
  title: z.string().min(1).max(180),
  subtitles: z.array(z.string().min(1).max(140)).max(12).default([]),
  keywords: z.array(z.string().min(1).max(50)).max(30).default([]),
  idea: z.string().min(10).max(4000),
  targetAudience: z.string().max(200).optional().default(""),
  callToAction: z.string().max(200).optional().default(""),
  sourceIds: z.array(z.string().min(1)).max(60).default([])
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const org = await getOrgProfile();
  const sources = [];
  for (const id of parsed.data.sourceIds) {
    const s = await getSourceById(id);
    if (s) sources.push(s);
  }

  const generated = await generateBlogDraft({
    org,
    sources,
    input: {
      title: parsed.data.title,
      subtitles: parsed.data.subtitles,
      keywords: parsed.data.keywords,
      idea: parsed.data.idea,
      targetAudience: parsed.data.targetAudience,
      callToAction: parsed.data.callToAction
    }
  });

  const post = await createDraft(generated);
  return NextResponse.json({ post, provider: generated.provider });
}

