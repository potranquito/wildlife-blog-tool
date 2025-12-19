import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { extractOrgFromWebsite } from "@/lib/ai/extract-org";

const BodySchema = z.object({
  url: z.string().min(1).max(2000)
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const result = await extractOrgFromWebsite(parsed.data.url);
    return NextResponse.json({
      profile: result.profile,
      provider: result.provider,
      url: parsed.data.url
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to extract organization info";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
