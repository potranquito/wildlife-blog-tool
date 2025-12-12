import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/site";
import { listPublishedPosts } from "@/lib/storage/posts";
import { getOrgProfile } from "@/lib/storage/org";

export async function GET() {
  const baseUrl = getBaseUrl();
  const org = await getOrgProfile();
  const posts = await listPublishedPosts();

  const lines = [
    `# ${org.name}`,
    ``,
    `${org.tagline}`,
    ``,
    `Mission: ${org.mission}`,
    ``,
    `This site publishes wildlife conservation blog posts with clear structure, summaries, and (when available) references.`,
    ``,
    `## Key pages`,
    `- ${baseUrl}/`,
    `- ${baseUrl}/blog`,
    `- ${baseUrl}/rss.xml`,
    `- ${baseUrl}/sitemap.xml`,
    ``,
    `## Latest posts`
  ];

  for (const p of posts.slice(0, 25)) {
    lines.push(`- ${baseUrl}/blog/${p.slug} — ${p.title}`);
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate"
    }
  });
}

