import { JSDOM } from "jsdom";
import type { ParsedArticle } from "./parse-rss";

export async function parseHtmlNewsPage(url: string): Promise<ParsedArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "wildlife-blogger/0.1 (+https://example.invalid; feed monitor)"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch page: ${res.status}`);
    }

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Remove scripts, styles, nav, footer
    doc.querySelectorAll("script, style, noscript, nav, footer, header, aside").forEach((el) => el.remove());

    const articles: ParsedArticle[] = [];
    const seenUrls = new Set<string>();

    // Common article container selectors
    const containerSelectors = [
      "article",
      '[class*="post"]',
      '[class*="article"]',
      '[class*="news-item"]',
      '[class*="story"]',
      '[class*="card"]',
      ".entry",
      ".item"
    ];

    for (const selector of containerSelectors) {
      const containers = doc.querySelectorAll(selector);

      for (const container of containers) {
        // Find the main link
        const linkEl = container.querySelector("a[href]");
        if (!linkEl) continue;

        const href = linkEl.getAttribute("href");
        if (!href) continue;

        // Resolve relative URLs
        let articleUrl: string;
        try {
          articleUrl = new URL(href, url).toString();
        } catch {
          continue;
        }

        // Skip if already seen or same as source URL
        if (seenUrls.has(articleUrl) || articleUrl === url) continue;

        // Skip non-article links (images, categories, tags, etc.)
        if (
          /\.(jpg|jpeg|png|gif|pdf|mp4|mp3)$/i.test(articleUrl) ||
          /\/(tag|category|author|page)\//.test(articleUrl)
        ) {
          continue;
        }

        seenUrls.add(articleUrl);

        // Get title from heading or link text
        const headingEl = container.querySelector("h1, h2, h3, h4");
        const title = (headingEl?.textContent || linkEl.textContent || "").trim();

        if (!title || title.length < 10) continue;

        // Get excerpt from paragraph
        const excerptEl = container.querySelector("p");
        const excerpt = (excerptEl?.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500);

        // Try to find date
        const dateEl = container.querySelector("time, [class*='date'], [class*='time']");
        let publishedAt: string | null = null;
        if (dateEl) {
          const datetime = dateEl.getAttribute("datetime");
          if (datetime) {
            publishedAt = datetime;
          } else {
            // Try to parse text content as date
            const dateText = dateEl.textContent?.trim();
            if (dateText) {
              const parsed = Date.parse(dateText);
              if (!isNaN(parsed)) {
                publishedAt = new Date(parsed).toISOString();
              }
            }
          }
        }

        articles.push({
          title,
          url: articleUrl,
          publishedAt,
          excerpt
        });
      }

      // If we found articles, don't try other selectors
      if (articles.length > 0) break;
    }

    // Limit to 20 most recent
    return articles.slice(0, 20);
  } finally {
    clearTimeout(timeout);
  }
}
