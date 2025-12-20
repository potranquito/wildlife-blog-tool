import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/api";
import { fetchAndExtractPage } from "@/lib/research/fetch";
import { fetchDynamicPage, likelyNeedsDynamicScraping } from "@/lib/research/playwright-fetch";
import { analyzeText } from "@/lib/research/keywords";
import { checkRobotsTxt } from "@/lib/research/robots";

const BodySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
  useDynamicScraping: z.boolean().optional().default(false),
  respectRobotsTxt: z.boolean().optional().default(true),
  dynamicOptions: z.object({
    waitForSelector: z.string().optional(),
    scrollToBottom: z.boolean().optional(),
    clickSelectors: z.array(z.string()).optional(),
    captureScreenshot: z.boolean().optional(),
  }).optional()
});

export async function POST(request: Request) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  const json = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const { urls, useDynamicScraping, respectRobotsTxt, dynamicOptions } = parsed.data;
  const results = [];
  const errors = [];

  for (const url of urls) {
    try {
      // Check robots.txt if requested
      if (respectRobotsTxt) {
        const robotsCheck = await checkRobotsTxt(url);
        if (!robotsCheck.allowed) {
          errors.push({
            url,
            error: robotsCheck.reason || 'Blocked by robots.txt'
          });
          continue;
        }

        // Respect crawl delay if specified
        if (robotsCheck.crawlDelay && robotsCheck.crawlDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, robotsCheck.crawlDelay! * 1000));
        }
      }

      // Determine whether to use dynamic scraping
      const shouldUseDynamic = useDynamicScraping || likelyNeedsDynamicScraping(url);

      let page: any;
      if (shouldUseDynamic) {
        // Use Playwright for dynamic content
        page = await fetchDynamicPage(url, dynamicOptions);
      } else {
        // Use simple fetch for static content
        page = await fetchAndExtractPage(url);
      }

      const analysis = analyzeText(page.text);
      results.push({
        url,
        title: page.title,
        description: page.description,
        canonical: page.canonical,
        headings: page.headings,
        wordCount: analysis.wordCount,
        topTerms: analysis.topTerms,
        excerpt: analysis.excerpt,
        screenshot: page.screenshot,
        scrapingMethod: shouldUseDynamic ? 'dynamic' : 'static'
      });
    } catch (err) {
      errors.push({
        url,
        error: err instanceof Error ? err.message : 'Failed to fetch'
      });
    }
  }

  return NextResponse.json({ results, errors: errors.length > 0 ? errors : undefined });
}

