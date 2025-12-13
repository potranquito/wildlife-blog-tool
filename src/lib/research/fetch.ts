import dns from "node:dns/promises";
import net from "node:net";
import { JSDOM } from "jsdom";

type ExtractedPage = {
  url: string;
  title: string;
  description: string;
  canonical?: string;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  text: string;
};

function isPrivateIp(ip: string) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split(".").map((x) => Number(x));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast/reserved
    return false;
  }

  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    return false;
  }

  return true;
}

async function assertSafeHttpUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credentials in URL are not allowed");
  }

  const hostname = parsed.hostname;
  if (!hostname) throw new Error("Invalid hostname");
  if (hostname === "localhost" || hostname.endsWith(".local")) throw new Error("Localhost URLs are blocked");

  const ipKind = net.isIP(hostname);
  if (ipKind) {
    if (isPrivateIp(hostname)) throw new Error("Private network URLs are blocked");
    return parsed.toString();
  }

  const lookups = await dns.lookup(hostname, { all: true });
  if (!lookups.length) throw new Error("Could not resolve host");
  for (const { address } of lookups) {
    if (isPrivateIp(address)) throw new Error("Private network URLs are blocked");
  }

  return parsed.toString();
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function takeFirst(arr: string[], max: number) {
  return arr
    .map((s) => cleanText(s))
    .filter(Boolean)
    .slice(0, max);
}

export async function fetchAndExtractPage(
  inputUrl: string,
  opts?: {
    timeoutMs?: number;
    userAgent?: string;
  }
): Promise<ExtractedPage> {
  const url = await assertSafeHttpUrl(inputUrl);

  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          opts?.userAgent ??
          "wildlife-blogger/0.1 (+https://example.invalid; research bot for conservation content analysis)"
      }
    });
    if (!res.ok) {
      throw new Error(`Fetch failed (${res.status})`);
    }

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    doc.querySelectorAll("script, style, noscript, iframe").forEach((el) => el.remove());

    const title = cleanText(doc.querySelector("title")?.textContent ?? "");
    const description = cleanText(doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "");
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? undefined;

    const h1 = takeFirst(Array.from(doc.querySelectorAll("h1")).map((h) => h.textContent ?? ""), 5);
    const h2 = takeFirst(Array.from(doc.querySelectorAll("h2")).map((h) => h.textContent ?? ""), 16);
    const h3 = takeFirst(Array.from(doc.querySelectorAll("h3")).map((h) => h.textContent ?? ""), 20);

    const root = doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body;
    const text = cleanText(root?.textContent ?? "").slice(0, 200_000);

    return {
      url,
      title,
      description,
      canonical,
      headings: { h1, h2, h3 },
      text
    };
  } finally {
    clearTimeout(timeout);
  }
}
