/**
 * Playwright-based web scraping for dynamic content
 *
 * Handles JavaScript-heavy sites that require a headless browser
 * to properly render and extract content.
 */

import { chromium, type Browser, type Page } from 'playwright';

let browserInstance: Browser | null = null;

/**
 * Get or create a shared browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  browserInstance = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  return browserInstance;
}

/**
 * Close the shared browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export interface DynamicScrapingOptions {
  /**
   * Wait for a specific selector before extracting content
   */
  waitForSelector?: string;

  /**
   * Scroll to the bottom of the page to load lazy content
   */
  scrollToBottom?: boolean;

  /**
   * Click selectors (e.g., "Load More" buttons) before extracting
   */
  clickSelectors?: string[];

  /**
   * Execute custom JavaScript before extraction
   */
  executeScript?: string;

  /**
   * Take a screenshot and return it as base64
   */
  captureScreenshot?: boolean;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * User agent string
   */
  userAgent?: string;
}

export interface DynamicPageData {
  url: string;
  title: string;
  description: string;
  canonical?: string;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  text: string;
  screenshot?: string;
  links: { text: string; href: string }[];
}

/**
 * Scroll to the bottom of the page to load lazy content
 */
async function scrollPage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Extract page content using Playwright for dynamic sites
 */
export async function fetchDynamicPage(
  url: string,
  options: DynamicScrapingOptions = {}
): Promise<DynamicPageData> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: options.userAgent ?? 'wildlife-blogger/0.1 (+https://example.invalid; research bot for conservation content analysis)'
  });

  const page = await context.newPage();

  try {
    const timeout = options.timeout ?? 30000;

    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout
    });

    // Wait for specific selector if provided
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout });
    }

    // Execute custom script if provided
    if (options.executeScript) {
      await page.evaluate(options.executeScript);
    }

    // Click selectors if provided (e.g., "Load More" buttons)
    if (options.clickSelectors && options.clickSelectors.length > 0) {
      for (const selector of options.clickSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          await page.waitForTimeout(1000); // Wait for content to load
        } catch (err) {
          // Selector might not exist, continue
          console.warn(`Could not click selector: ${selector}`);
        }
      }
    }

    // Scroll to bottom if requested
    if (options.scrollToBottom) {
      await scrollPage(page);
      await page.waitForTimeout(1000); // Wait for lazy-loaded content
    }

    // Extract page data
    const pageData = await page.evaluate(() => {
      // Remove unwanted elements
      document.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());

      // Extract metadata
      const title = document.querySelector('title')?.textContent?.trim() || '';
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || undefined;

      // Extract headings
      const h1 = Array.from(document.querySelectorAll('h1'))
        .map(h => h.textContent?.trim() || '')
        .filter(Boolean)
        .slice(0, 5);

      const h2 = Array.from(document.querySelectorAll('h2'))
        .map(h => h.textContent?.trim() || '')
        .filter(Boolean)
        .slice(0, 16);

      const h3 = Array.from(document.querySelectorAll('h3'))
        .map(h => h.textContent?.trim() || '')
        .filter(Boolean)
        .slice(0, 20);

      // Extract text content
      const root = document.querySelector('article') ?? document.querySelector('main') ?? document.body;
      const text = root?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200000) || '';

      // Extract links
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          text: a.textContent?.trim() || '',
          href: a.getAttribute('href') || ''
        }))
        .filter(link => link.text && link.href)
        .slice(0, 100);

      return { title, description, canonical, headings: { h1, h2, h3 }, text, links };
    });

    // Capture screenshot if requested
    let screenshot: string | undefined;
    if (options.captureScreenshot) {
      const buffer = await page.screenshot({ fullPage: true });
      screenshot = buffer.toString('base64');
    }

    return {
      url,
      ...pageData,
      screenshot
    };
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Check if a URL likely needs dynamic scraping
 * (heuristic based on common SPA frameworks)
 */
export function likelyNeedsDynamicScraping(url: string): boolean {
  const urlLower = url.toLowerCase();

  // Common SPA frameworks or sites that use heavy JavaScript
  const dynamicIndicators = [
    'react',
    'angular',
    'vue',
    'next.js',
    'gatsby',
    'nuxt',
    'svelte',
    '#/',  // Hash routing often indicates SPA
  ];

  return dynamicIndicators.some(indicator => urlLower.includes(indicator));
}
