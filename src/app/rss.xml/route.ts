import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/site";
import { listPublishedPosts } from "@/lib/storage/posts";

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const baseUrl = getBaseUrl();
  const posts = await listPublishedPosts();

  const items = posts
    .map((p) => {
      const link = `${baseUrl}/blog/${p.slug}`;
      const pubDate = p.publishedAt ? new Date(p.publishedAt).toUTCString() : new Date(p.updatedAt).toUTCString();
      return `
<item>
  <title>${escapeXml(p.title)}</title>
  <link>${escapeXml(link)}</link>
  <guid>${escapeXml(link)}</guid>
  <pubDate>${escapeXml(pubDate)}</pubDate>
  <description>${escapeXml(p.summary)}</description>
</item>`.trim();
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>wildlife-blogger</title>
  <link>${escapeXml(baseUrl)}</link>
  <description>Research-backed wildlife conservation writing.</description>
  <language>en</language>
  <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
  ${items}
</channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate"
    }
  });
}

