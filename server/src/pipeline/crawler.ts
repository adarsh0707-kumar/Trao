import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import dns from "node:dns/promises";
import net from "node:net";

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  category: "homepage" | "hiring" | "about" | "engineering" | "other";
}

export interface CrawlResult {
  pagesUsed: string[];
  pages: CrawledPage[];
  siteReachable: boolean;
  hiringInfoFound: boolean;
  warnings: string[];
}

const HIRING_KEYWORDS = [
  "career",
  "careers",
  "job",
  "jobs",
  "hiring",
  "interview",
  "work-with-us",
  "join-us",
  "open-roles",
  "positions",
  "opportunities",
];

const CULTURE_KEYWORDS = [
  "handbook",
  "culture",
  "values",
  "about",
  "team",
  "engineering",
  "tech-blog",
  "blog",
];

/**
 * Checks if a given IP address is private/loopback/link-local
 */
function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 10.0.0.0 - 10.255.255.255
    if (parts[0] === 10) return true;
    // 172.16.0.0 - 172.31.255.255
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0 - 192.168.255.255
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0 - 169.254.255.255 (link-local / AWS metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0
    if (parts[0] === 0) return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF vulnerabilities
 */
export async function validateSafeUrl(
  rawUrl: string,
  allowLocalUrls: boolean = false
): Promise<{ safe: boolean; reason?: string; url?: URL }> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { safe: false, reason: `Unsupported protocol: ${parsed.protocol}` };
    }

    if (allowLocalUrls) {
      return { safe: true, url: parsed };
    }

    // Resolve DNS in production
    const hostname = parsed.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return { safe: false, reason: "Localhost access forbidden in production" };
    }

    try {
      const lookup = await dns.lookup(hostname);
      if (isPrivateIp(lookup.address)) {
        return {
          safe: false,
          reason: `Target hostname resolves to private IP (${lookup.address})`,
        };
      }
    } catch {
      // DNS resolution failed
      return { safe: false, reason: `Failed to resolve hostname: ${hostname}` };
    }

    return { safe: true, url: parsed };
  } catch (err: any) {
    return { safe: false, reason: `Malformed URL: ${err.message}` };
  }
}

/**
 * Strips HTML noise and produces clean readable text
 */
export function extractCleanText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, noscript, svg, nav, footer, iframe, header, form").remove();

  const title = $("title").text().trim() || "";

  // Extract text and collapse excessive whitespace
  const rawText = $("body").text();
  const cleanedText = rawText
    .replace(/\s+/g, " ")
    .replace(/(\r\n|\n|\r)/gm, " ")
    .trim()
    .slice(0, 8000); // Limit text length to prevent prompt token bloat

  return { title, text: cleanedText };
}

/**
 * Autonomous company web crawler
 */
export async function crawlCompanySite(
  startUrl: string,
  options: {
    allowLocalUrls?: boolean;
    timeoutMs?: number;
    maxPages?: number;
  } = {}
): Promise<CrawlResult> {
  const allowLocal = options.allowLocalUrls ?? process.env.ALLOW_LOCAL_URLS === "true";
  const timeoutMs = options.timeoutMs ?? 6000;
  const maxPages = options.maxPages ?? 3;

  const warnings: string[] = [];
  const pages: CrawledPage[] = [];
  const pagesUsed: string[] = [];

  const validation = await validateSafeUrl(startUrl, allowLocal);
  if (!validation.safe || !validation.url) {
    return {
      pagesUsed: [],
      pages: [],
      siteReachable: false,
      hiringInfoFound: false,
      warnings: [validation.reason || "URL validation rejected target address"],
    };
  }

  const baseOrigin = validation.url.origin;

  // 1. Fetch robots.txt if available
  let robots: any = null;
  try {
    const robotsUrl = `${baseOrigin}/robots.txt`;
    const robotsRes = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": "TraoBot/1.0" },
    });
    if (robotsRes.ok) {
      const robotsTxt = await robotsRes.text();
      const parserFn = (robotsParser as any).default || (robotsParser as any);
      robots = parserFn(robotsUrl, robotsTxt);
    }
  } catch {
    // robots.txt missing or timeout is common and harmless
  }

  // Helper fetch function
  const fetchPage = async (pageUrl: string): Promise<string | null> => {
    try {
      if (robots && !robots.isAllowed(pageUrl, "TraoBot/1.0")) {
        warnings.push(`Crawl skipped ${pageUrl} per robots.txt policy`);
        return null;
      }

      const res = await fetch(pageUrl, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 TraoBot/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!res.ok) {
        warnings.push(`HTTP ${res.status} when retrieving ${pageUrl}`);
        return null;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        warnings.push(`Unsupported content-type ${contentType} for ${pageUrl}`);
        return null;
      }

      return await res.text();
    } catch (err: any) {
      warnings.push(`Fetch failed for ${pageUrl}: ${err.message}`);
      return null;
    }
  };

  // 2. Fetch Homepage
  const homeHtml = await fetchPage(startUrl);
  if (!homeHtml) {
    return {
      pagesUsed: [],
      pages: [],
      siteReachable: false,
      hiringInfoFound: false,
      warnings: [...warnings, `Target website ${startUrl} could not be reached.`],
    };
  }

  const homeParsed = extractCleanText(homeHtml);
  pages.push({
    url: startUrl,
    title: homeParsed.title,
    text: homeParsed.text,
    category: "homepage",
  });
  pagesUsed.push(startUrl);

  // 3. Discover and score links
  const $ = cheerio.load(homeHtml);
  interface LinkCandidate {
    url: string;
    score: number;
    category: CrawledPage["category"];
  }

  const candidates: LinkCandidate[] = [];
  const seenUrls = new Set<string>([startUrl, startUrl.replace(/\/$/, "")]);

  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href");
    if (!rawHref) return;

    try {
      const resolved = new URL(rawHref, startUrl);
      // Keep only same origin links or relative paths
      if (resolved.origin !== baseOrigin) return;

      const cleanResolved = resolved.href.split("#")[0].replace(/\/$/, "");
      if (seenUrls.has(cleanResolved)) return;
      seenUrls.add(cleanResolved);

      const pathLower = resolved.pathname.toLowerCase();
      const anchorText = $(el).text().toLowerCase();

      let score = 0;
      let category: CrawledPage["category"] = "other";

      for (const kw of HIRING_KEYWORDS) {
        if (pathLower.includes(kw) || anchorText.includes(kw)) {
          score += 20;
          category = "hiring";
        }
      }

      for (const kw of CULTURE_KEYWORDS) {
        if (pathLower.includes(kw) || anchorText.includes(kw)) {
          score += 10;
          if (category === "other") category = "about";
        }
      }

      if (score > 0) {
        candidates.push({ url: resolved.href, score, category });
      }
    } catch {
      // ignore invalid hrefs
    }
  });

  // Sort descending by discovery score
  candidates.sort((a, b) => b.score - a.score);

  // 4. Fetch top ranked candidates
  let hiringFound = false;
  const pagesToFetch = candidates.slice(0, maxPages - 1);

  for (const candidate of pagesToFetch) {
    const subHtml = await fetchPage(candidate.url);
    if (subHtml) {
      const subParsed = extractCleanText(subHtml);
      pages.push({
        url: candidate.url,
        title: subParsed.title,
        text: subParsed.text,
        category: candidate.category,
      });
      pagesUsed.push(candidate.url);
      if (candidate.category === "hiring") {
        hiringFound = true;
      }
    }
  }

  return {
    pagesUsed,
    pages,
    siteReachable: true,
    hiringInfoFound: hiringFound,
    warnings,
  };
}
