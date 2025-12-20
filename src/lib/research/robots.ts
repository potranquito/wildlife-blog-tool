/**
 * Robots.txt checking utilities
 *
 * Ensures respectful web crawling by checking robots.txt
 * before scraping any website.
 */

import robotsParser from 'robots-parser';

interface RobotsCheckResult {
  allowed: boolean;
  crawlDelay?: number;
  reason?: string;
}

/**
 * Cache for robots.txt files
 */
const robotsCache = new Map<string, {
  robots: ReturnType<typeof robotsParser>;
  fetchedAt: number;
  ttl: number;
}>();

/**
 * Get the origin (protocol + host) from a URL
 */
function getOrigin(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

/**
 * Fetch and parse robots.txt for a domain
 */
async function fetchRobotsTxt(origin: string, userAgent: string): Promise<ReturnType<typeof robotsParser>> {
  const robotsUrl = `${origin}/robots.txt`;

  try {
    const res = await fetch(robotsUrl, {
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(5000)
    });

    let robotsTxt = '';
    if (res.ok) {
      robotsTxt = await res.text();
    }

    return robotsParser(robotsUrl, robotsTxt);
  } catch (err) {
    // If we can't fetch robots.txt, be permissive (standard behavior)
    return robotsParser(robotsUrl, '');
  }
}

/**
 * Check if a URL can be crawled according to robots.txt
 */
export async function checkRobotsTxt(
  url: string,
  userAgent: string = 'wildlife-blogger/0.1'
): Promise<RobotsCheckResult> {
  const origin = getOrigin(url);
  const now = Date.now();

  // Check cache
  const cached = robotsCache.get(origin);
  if (cached && (now - cached.fetchedAt) < cached.ttl) {
    const allowed = cached.robots.isAllowed(url, userAgent) ?? true;
    const crawlDelay = cached.robots.getCrawlDelay(userAgent);

    return {
      allowed,
      crawlDelay: crawlDelay ?? undefined,
      reason: allowed ? undefined : 'Disallowed by robots.txt'
    };
  }

  // Fetch robots.txt
  const robots = await fetchRobotsTxt(origin, userAgent);

  // Cache for 1 hour
  robotsCache.set(origin, {
    robots,
    fetchedAt: now,
    ttl: 60 * 60 * 1000
  });

  const allowed = robots.isAllowed(url, userAgent) ?? true;
  const crawlDelay = robots.getCrawlDelay(userAgent);

  return {
    allowed,
    crawlDelay: crawlDelay ?? undefined,
    reason: allowed ? undefined : 'Disallowed by robots.txt'
  };
}

/**
 * Clear the robots.txt cache (useful for testing)
 */
export function clearRobotsCache(): void {
  robotsCache.clear();
}
