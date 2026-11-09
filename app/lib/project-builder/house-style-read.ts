/**
 * Reads the prospect's house style from their website, server side, through
 * the Ask Summit crawler: robots.txt first, up to three same host pages with
 * the raw HTML kept, up to three stylesheets and up to three logo fetches,
 * all through `crawlSite` and `fetchAsset`, under a deadline. When that
 * gives no logo or no colours (a blocked site counts as unreadable; nothing
 * here tries to get past bot protection), the Brandfetch record for the
 * domain tops it up. The pure extraction and the merge live in
 * house-style.ts and brand-data.ts. Never throws: any failure is the neutral
 * style with a reason, so a website never fails a generation.
 *
 * Budget, inside the run's 30 s style share: crawl 14 s, site assets 6 s,
 * the brand API call 4 s, brand logo fetches 4 s; each stage takes the
 * smaller of its share and what is left.
 */
import { crawlSite, crawlerUserAgent, fetchAsset, fetchRobots } from "../ask-summit/crawler.ts";
import { CRAWL_TEXT_CAP, parseRobots } from "../ask-summit/crawl-rules.ts";
import { brandColours, brandFonts, chooseBrandLogoFormats, darkSurface, type BrandData } from "./brand-data.ts";
import { lookupBrand } from "./brandfetch.ts";
import {
  LOGO_MAX_BYTES,
  checkLogoBytes,
  extractColours,
  extractFonts,
  extractPageColours,
  extractSiteName,
  extractTagline,
  findLogoCandidates,
  findStylesheetLinks,
  logoDataUri,
  mergeHouseStyle,
  needsBrandLookup,
  neutralStyle,
  sanitiseSvg,
  type BrandParts,
  type HouseLogo,
  type HouseStyle,
  type HouseStyleParts,
  type LogoCandidate,
  type LogoTheme,
} from "./house-style.ts";
import type { PrototypeWebsite } from "./prototype.ts";
import type { ResearchPage } from "./research.ts";

const CRAWL_BUDGET_MS = 14_000;
const ASSET_BUDGET_MS = 6_000;
const BRAND_API_BUDGET_MS = 4_500;
const BRAND_LOGO_BUDGET_MS = 4_000;
const BRAND_LOGO_FETCHES = 2;
/** Brandfetch asset hosts are not the prospect's site, so no robots rules apply to them. */
const NO_ROBOTS = parseRobots(null);
const PAGE_CAP = 3;
const STYLESHEET_MAX_BYTES = 400_000;
const LOGO_FETCHES = 3;

async function readLogo(
  candidates: LogoCandidate[],
  base: { deadlineAt: number; userAgent: string; siteHost: string; robots: Parameters<typeof fetchAsset>[1]["robots"] },
): Promise<HouseLogo | null> {
  let fetches = 0;
  for (const candidate of candidates) {
    if (candidate.kind === "svg") {
      const clean = sanitiseSvg(candidate.markup);
      if (clean) {
        const logo = logoDataUri(new TextEncoder().encode(clean), "image/svg+xml");
        if (logo) return logo;
      }
      continue;
    }
    if (candidate.url.startsWith("data:image/")) {
      const m = /^data:(image\/[a-z0-9.+-]+)(;base64)?,(.*)$/i.exec(candidate.url);
      if (!m) continue;
      let bytes: Uint8Array;
      try {
        bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
      } catch {
        continue;
      }
      const checked = checkLogoBytes(bytes, m[1]);
      const logo = checked ? logoDataUri(bytes, checked.mime) : null;
      if (logo) return logo;
      continue;
    }
    if (fetches >= LOGO_FETCHES) break;
    fetches += 1;
    const res = await fetchAsset(candidate.url, { ...base, maxBytes: LOGO_MAX_BYTES, accept: "image/png,image/jpeg,image/webp,image/svg+xml" });
    if (!res.ok) continue;
    const checked = checkLogoBytes(res.bytes, res.contentType);
    const logo = checked ? logoDataUri(res.bytes, checked.mime) : null;
    if (logo) return logo;
  }
  return null;
}

/** The site half of the read, before any brand top up. */
export interface SiteRead {
  /** The raw parts, or null when no page could be read. */
  parts: HouseStyleParts | null;
  reason: "unreadable" | "nothing-usable";
  /** The visible text of every page the crawl read, so the research stage reads the same pages without a second crawl. */
  pageTexts: ResearchPage[];
}

/** The site read alone: today's crawl, returning the raw parts or why there are none. A blocked site is simply unreadable. */
export async function readSiteParts(target: PrototypeWebsite, opts: { deadlineAt: number }): Promise<SiteRead> {
  try {
    const userAgent = crawlerUserAgent();
    const origin = new URL(target.url).origin;
    // The 14 s share covers robots.txt and the crawl together, so a site that hangs on robots.txt leaves time for the brand step.
    const crawlDeadline = Math.min(opts.deadlineAt, Date.now() + CRAWL_BUDGET_MS);
    const robots = await fetchRobots(origin, userAgent);
    const store = await crawlSite(target.url, { deadlineAt: crawlDeadline, userAgent, maxPages: PAGE_CAP, keepHtml: true, robots });
    const pages = store.pages.filter((p) => typeof p.html === "string" && p.html.length > 0);
    const pageTexts: ResearchPage[] = store.pages.map((p) => ({ url: p.url, title: p.title, text: p.text }));
    if (pages.length === 0) return { parts: null, reason: "unreadable", pageTexts };
    const start = pages[0];
    const html = start.html as string;

    const assetDeadline = Math.min(opts.deadlineAt, Date.now() + ASSET_BUDGET_MS);
    const base = { deadlineAt: assetDeadline, userAgent, siteHost: store.host, robots: robots.rules };
    const sheets = await Promise.all(
      findStylesheetLinks(html, start.url).map(async (url) => {
        const res = await fetchAsset(url, { ...base, maxBytes: STYLESHEET_MAX_BYTES, accept: "text/css" });
        if (!res.ok || !res.contentType.toLowerCase().includes("css")) return "";
        return new TextDecoder().decode(res.bytes);
      }),
    );
    const cssTexts = sheets.filter(Boolean).map((css) => css.slice(0, CRAWL_TEXT_CAP));
    const allHtml = pages.map((p) => p.html as string).join("\n");
    const logo = await readLogo(findLogoCandidates(html, start.url), base);
    const { background, text } = extractPageColours(html, cssTexts);
    const { headingFont, bodyFont } = extractFonts(html, cssTexts);
    return {
      parts: {
        host: target.host,
        siteName: extractSiteName(html),
        tagline: extractTagline(html),
        colours: extractColours(allHtml, cssTexts),
        background,
        text,
        headingFont,
        bodyFont,
        logo,
      },
      reason: "nothing-usable",
      pageTexts,
    };
  } catch (err) {
    console.error("project-builder house style: read failed", err instanceof Error ? err.message.slice(0, 200) : err);
    return { parts: null, reason: "unreadable", pageTexts: [] };
  }
}

/** The brand logo: at most two fetches of the chosen formats, through the crawler's fetchAsset and the same byte checks as a site logo. */
async function readBrandLogo(data: BrandData, deadlineAt: number): Promise<{ logo: HouseLogo; theme: LogoTheme } | null> {
  let fetches = 0;
  for (const candidate of chooseBrandLogoFormats(data)) {
    if (fetches >= BRAND_LOGO_FETCHES || Date.now() >= deadlineAt - 500) break;
    fetches += 1;
    const res = await fetchAsset(candidate.src, {
      deadlineAt,
      userAgent: crawlerUserAgent(),
      maxBytes: LOGO_MAX_BYTES,
      accept: "image/svg+xml,image/png,image/webp,image/jpeg",
      siteHost: "",
      robots: NO_ROBOTS,
    });
    if (!res.ok) continue;
    const checked = checkLogoBytes(res.bytes, res.contentType);
    const logo = checked ? logoDataUri(res.bytes, checked.mime) : null;
    if (logo) return { logo, theme: candidate.theme };
  }
  return null;
}

/** The style plus what the read saw on the way, so the research stage can reuse the crawl and the brand record. */
export interface HouseStyleRead {
  style: HouseStyle;
  pageTexts: ResearchPage[];
  /** The Brandfetch record when a lookup ran and found one; null otherwise (the research stage looks it up from the cache itself). */
  brand: BrandData | null;
}

/**
 * The house style for the target: the site first, then Brandfetch to fill a
 * missing logo or missing colours (fonts fill an empty role when a lookup
 * runs anyway), then neutral. Never throws. Returns the page texts and the
 * brand record alongside so a first press crawls once.
 */
export async function readHouseStyleWithParts(target: PrototypeWebsite | null, opts: { deadlineAt: number }): Promise<HouseStyleRead> {
  if (!target) return { style: neutralStyle("no-website"), pageTexts: [], brand: null };
  const site = await readSiteParts(target, opts);
  const pageTexts = site.pageTexts;
  const meta = { host: target.host, reason: site.reason };
  if (!needsBrandLookup(site.parts)) return { style: mergeHouseStyle(site.parts, null, { ...meta, brandLookup: "not-needed" }), pageTexts, brand: null };
  try {
    const lookup = await lookupBrand(target.host, { deadlineAt: Math.min(opts.deadlineAt, Date.now() + BRAND_API_BUDGET_MS) });
    if (!lookup.data) return { style: mergeHouseStyle(site.parts, null, { ...meta, brandLookup: lookup.outcome }), pageTexts, brand: null };
    const fonts = brandFonts(lookup.data);
    const logo = site.parts?.logo ? null : await readBrandLogo(lookup.data, Math.min(opts.deadlineAt, Date.now() + BRAND_LOGO_BUDGET_MS));
    const brand: BrandParts = {
      logo: logo?.logo ?? null,
      logoTheme: logo?.theme ?? null,
      colours: brandColours(lookup.data),
      headingFamily: fonts.headingFamily,
      bodyFamily: fonts.bodyFamily,
      darkSurface: darkSurface(lookup.data),
    };
    return { style: mergeHouseStyle(site.parts, brand, { ...meta, brandLookup: lookup.outcome }), pageTexts, brand: lookup.data };
  } catch (err) {
    console.error("project-builder house style: brand top up failed", err instanceof Error ? err.message.slice(0, 200) : err);
    return { style: mergeHouseStyle(site.parts, null, { ...meta, brandLookup: "error" }), pageTexts, brand: null };
  }
}

/** The style alone, for callers that do not need the pages. */
export async function readHouseStyle(target: PrototypeWebsite | null, opts: { deadlineAt: number }): Promise<HouseStyle> {
  return (await readHouseStyleWithParts(target, opts)).style;
}
