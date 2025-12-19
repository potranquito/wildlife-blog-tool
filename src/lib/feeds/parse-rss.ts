import Parser from "rss-parser";

export type ParsedArticle = {
  title: string;
  url: string;
  publishedAt: string | null;
  excerpt: string;
};

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "wildlife-blogger/0.1 (+https://example.invalid; feed monitor)"
  }
});

export async function parseRssFeed(url: string): Promise<ParsedArticle[]> {
  const feed = await parser.parseURL(url);

  const articles: ParsedArticle[] = [];

  for (const item of feed.items ?? []) {
    if (!item.title || !item.link) continue;

    // Get excerpt from content or description
    let excerpt = "";
    const content = item.contentSnippet || item.content || item["content:encoded"] || item.summary || "";
    if (typeof content === "string") {
      // Strip HTML tags and limit length
      excerpt = content
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);
    }

    articles.push({
      title: item.title.trim(),
      url: item.link.trim(),
      publishedAt: item.pubDate || item.isoDate || null,
      excerpt
    });
  }

  return articles;
}

export async function isRssFeed(url: string): Promise<boolean> {
  try {
    await parser.parseURL(url);
    return true;
  } catch {
    return false;
  }
}
