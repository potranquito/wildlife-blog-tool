import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { createDraft, listPosts, updateDraft } from "@/lib/storage/posts";

export async function GET(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ posts: await listPosts() });
}

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(180),
  subtitle: z.string().max(220).optional(),
  summary: z.string().min(1).max(800),
  keywords: z.array(z.string().min(1).max(50)).max(30),
  seoTitle: z.string().max(80).optional(),
  seoDescription: z.string().max(180).optional(),
  contentMarkdown: z.string().min(50).max(200_000)
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = UpsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post payload" }, { status: 400 });
  }

  const payload = parsed.data;
  if (payload.id) {
    const post = await updateDraft(payload.id, payload);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ post });
  }

  const post = await createDraft(payload);
  return NextResponse.json({ post });
}

