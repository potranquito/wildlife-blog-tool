import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { getOrgProfile, updateOrgProfile } from "@/lib/storage/org";

export async function GET(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ profile: await getOrgProfile() });
}

const ProfileSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().min(1).max(200),
  mission: z.string().min(1).max(2000),
  voiceGuidelines: z.string().min(1).max(8000),
  preferredTerms: z.array(z.string().min(1).max(50)).max(100),
  avoidTerms: z.array(z.string().min(1).max(50)).max(100)
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = ProfileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile payload" }, { status: 400 });
  }

  const updated = await updateOrgProfile(parsed.data);
  return NextResponse.json({ profile: updated });
}

