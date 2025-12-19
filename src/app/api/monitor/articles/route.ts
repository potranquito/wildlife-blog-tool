import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { listArticles, getArticleById, markArticleSaved, deleteArticle } from "@/lib/storage/articles";
import { createSourceFromText } from "@/lib/storage/sources";
import { fetchAndExtractPage } from "@/lib/research/fetch";

const SaveArticleSchema = z.object({
  articleId: z.string().min(1)
});

const DeleteArticleSchema = z.object({
  articleId: z.string().min(1)
});

export async function GET(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
  const minRelevance = searchParams.get("minRelevance")
    ? parseInt(searchParams.get("minRelevance")!, 10)
    : undefined;

  const articles = await listArticles({ sourceId, limit, minRelevance });
  return NextResponse.json({ articles });
}

export async function POST(request: Request) {
  // Save article to knowledge base
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SaveArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const article = await getArticleById(parsed.data.articleId);
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (article.savedToKnowledge) {
    return NextResponse.json({ error: "Article already saved to knowledge base" }, { status: 400 });
  }

  try {
    // Fetch full article content
    const page = await fetchAndExtractPage(article.url, {
      timeoutMs: 15000,
      userAgent: "wildlife-blogger/0.1 (+https://example.invalid; article save)"
    });

    // Create knowledge base source
    const source = await createSourceFromText({
      type: "ORG_URL",
      title: article.title,
      url: article.url,
      contentText: page.text
    });

    // Mark article as saved
    await markArticleSaved(article.id);

    return NextResponse.json({
      success: true,
      sourceId: source.id,
      articleId: article.id
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  const parsed = DeleteArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const deleted = await deleteArticle(parsed.data.articleId);
  if (!deleted) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
