/**
 * Reads the prospect's house style from their website, server side, through
 * the Ask Summit crawler: robots.txt first, up to three same host pages with
 * the raw HTML kept, up to three stylesheets and up to three logo fetches,
 * all through `crawlSite` and `fetchAsset`, under a deadline. The pure
 * extraction lives in house-style.ts. Never throws: any failure is the
 * neutral style with a reason, so a website never fails a generation.
 */
import { crawlSite, crawlerUserAgent, fetchAsset, fetchRobots } from "../ask-summit/crawler.ts";
import { CRAWL_TEXT_CAP } from "../ask-summit/crawl-rules.ts";
import {
  LOGO_MAX_BYTES,
  buildHouseStyle,
  checkLogoBytes,
  extractColours,
  extractFonts,
  extractPageColours,
  extractSiteName,
  extractTagline,
  findLogoCandidates,
  findStylesheetLinks,
  logoDataUri,
  neutralStyle,
  sanitiseSvg,
  type HouseLogo,
  type HouseStyle,
  type LogoCandidate,
} from "./house-style.ts";
import type { PrototypeWebsite } from "./prototype.ts";

const CRAWL_BUDGET_MS = 18_000;
const ASSET_BUDGET_MS = 8_000;
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

/** The house style for the target, or the neutral style with the reason it is neutral. */
export async function readHouseStyle(target: PrototypeWebsite | null, opts: { deadlineAt: number }): Promise<HouseStyle> {
  if (!target) return neutralStyle("no-website");
  try {
    const userAgent = crawlerUserAgent();
    const origin = new URL(target.url).origin;
    const robots = await fetchRobots(origin, userAgent);
    const crawlDeadline = Math.min(opts.deadlineAt, Date.now() + CRAWL_BUDGET_MS);
    const store = await crawlSite(target.url, { deadlineAt: crawlDeadline, userAgent, maxPages: PAGE_CAP, keepHtml: true, robots });
    const pages = store.pages.filter((p) => typeof p.html === "string" && p.html.length > 0);
    if (pages.length === 0) return neutralStyle("unreadable", target.host);
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
    return buildHouseStyle({
      host: target.host,
      siteName: extractSiteName(html),
      tagline: extractTagline(html),
      colours: extractColours(allHtml, cssTexts),
      background,
      text,
      headingFont,
      bodyFont,
      logo,
    });
  } catch (err) {
    console.error("project-builder house style: read failed", err instanceof Error ? err.message.slice(0, 200) : err);
    return neutralStyle("unreadable", target.host);
  }
}
