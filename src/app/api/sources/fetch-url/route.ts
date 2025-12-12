import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { fetchAndExtractPage } from "@/lib/research/fetch";
import { createSourceFromText } from "@/lib/storage/sources";

const BodySchema = z.object({
  url: z.string().url(),
  type: z.enum(["ORG_URL", "COMPETITOR_URL"]).default("COMPETITOR_URL")
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const page = await fetchAndExtractPage(parsed.data.url);
  const title = page.title || new URL(parsed.data.url).hostname;

  const source = await createSourceFromText({
    type: parsed.data.type,
    title,
    url: parsed.data.url,
    contentText: page.text
  });

  return NextResponse.json({ source, page });
}

