import type { WatchedSourceType } from "@/lib/storage/types";

export type DetectedFeed = {
  type: WatchedSourceType;
  feedUrl: string;
  name: string;
};

export async function detectFeedType(url: string): Promise<DetectedFeed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "wildlife-blogger/0.1 (+https://example.invalid; feed detector)"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    // Check if it's an RSS/Atom feed by content type
    if (
      contentType.includes("xml") ||
      contentType.includes("rss") ||
      contentType.includes("atom")
    ) {
      return {
        type: "RSS",
        feedUrl: url,
        name: extractFeedTitle(text) || extractHostname(url)
      };
    }

    // Check if content looks like XML feed
    const trimmed = text.trim();
    if (
      trimmed.startsWith("<?xml") ||
      trimmed.startsWith("<rss") ||
      trimmed.startsWith("<feed") ||
      trimmed.includes("<channel>") ||
      trimmed.includes("<entry>")
    ) {
      return {
        type: "RSS",
        feedUrl: url,
        name: extractFeedTitle(text) || extractHostname(url)
      };
    }

    // It's an HTML page - try to find RSS link
    const rssUrl = findRssLink(text, url);
    if (rssUrl) {
      // Verify the RSS link works
      try {
        const rssRes = await fetch(rssUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "wildlife-blogger/0.1 (+https://example.invalid; feed detector)"
          }
        });
        if (rssRes.ok) {
          const rssText = await rssRes.text();
          if (
            rssText.includes("<rss") ||
            rssText.includes("<feed") ||
            rssText.includes("<channel>")
          ) {
            return {
              type: "RSS",
              feedUrl: rssUrl,
              name: extractFeedTitle(rssText) || extractPageTitle(text) || extractHostname(url)
            };
          }
        }
      } catch {
        // RSS link didn't work, fall through to HTML
      }
    }

    // Treat as HTML news page
    return {
      type: "HTML",
      feedUrl: url,
      name: extractPageTitle(text) || extractHostname(url)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractFeedTitle(xml: string): string | null {
  // Try to extract <title> from RSS/Atom
  const match = xml.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (match) {
    return match[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
  }
  return null;
}

function extractPageTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown Source";
  }
}

function findRssLink(html: string, baseUrl: string): string | null {
  // Look for RSS link in HTML
  const patterns = [
    /<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["']/i,
    /<link[^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/atom\+xml["']/i,
    /<a[^>]+href=["']([^"']*(?:rss|feed|atom)[^"']*)["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        continue;
      }
    }
  }

  // Try common RSS paths
  const commonPaths = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/feed/"];
  const base = new URL(baseUrl);

  for (const path of commonPaths) {
    // Check if this path is mentioned in the HTML
    if (html.includes(`href="${path}"`) || html.includes(`href='${path}'`)) {
      return new URL(path, base).toString();
    }
  }

  return null;
}
