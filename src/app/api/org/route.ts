import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api";
import { getOrgProfile, updateOrgProfile } from "@/lib/storage/org";
import { OrgProfileSchema } from "@/lib/storage/orgProfile";

export async function GET(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ profile: await getOrgProfile() });
}

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = OrgProfileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile payload" }, { status: 400 });
  }

  const updated = await updateOrgProfile(parsed.data);
  return NextResponse.json({ profile: updated });
}
