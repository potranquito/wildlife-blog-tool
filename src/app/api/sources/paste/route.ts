import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { createSourceFromText } from "@/lib/storage/sources";

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  contentText: z.string().min(20).max(200_000)
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const source = await createSourceFromText({
    type: "PASTE",
    title: parsed.data.title,
    contentText: parsed.data.contentText
  });
  return NextResponse.json({ source });
}

