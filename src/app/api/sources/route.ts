import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api";
import { listSources } from "@/lib/storage/sources";

export async function GET(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ sources: await listSources() });
}

