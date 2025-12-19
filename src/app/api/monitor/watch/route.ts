import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import {
  listWatchedSources,
  addWatchedSource,
  deleteWatchedSource,
  updateWatchedSource
} from "@/lib/storage/watched-sources";
import { detectFeedType } from "@/lib/feeds/detect-feed";
import { deleteArticlesBySource } from "@/lib/storage/articles";

const AddSourceSchema = z.object({
  url: z.string().url().min(1),
  fetchIntervalHours: z.number().min(1).max(168).optional()
});

const UpdateSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  fetchIntervalHours: z.number().min(1).max(168).optional()
});

const DeleteSourceSchema = z.object({
  id: z.string().min(1)
});

export async function GET(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const sources = await listWatchedSources();
  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AddSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Detect feed type and get name
    const detected = await detectFeedType(parsed.data.url);

    const source = await addWatchedSource({
      name: detected.name,
      url: detected.feedUrl,
      type: detected.type,
      fetchIntervalHours: parsed.data.fetchIntervalHours
    });

    return NextResponse.json({ source, detected });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add source";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id, ...updates } = parsed.data;
  const source = await updateWatchedSource(id, updates);

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json({ source });
}

export async function DELETE(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DeleteSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Delete associated articles first
  await deleteArticlesBySource(parsed.data.id);

  const deleted = await deleteWatchedSource(parsed.data.id);
  if (!deleted) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
