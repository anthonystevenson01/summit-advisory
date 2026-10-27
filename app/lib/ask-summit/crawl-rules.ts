/**
 * The rules the polite crawler follows, as pure functions: robots.txt
 * parsing and the allow check, link normalising with the same-host rule,
 * the page scorer that decides which pages are fetched first, the visible
 * text stripper, the link extractor and the caps. No network, no Redis;
 * crawler.ts does the fetching and tests pin every rule here.
 */
import { isSameHost } from "./validation.ts";

export const ROBOTS_TOKEN = "SummitBot";
export const DEFAULT_USER_AGENT = "SummitBot/1.0 (+https://summitstrategyadvisory.com/tools/ask-summit)";

export const CRAWL_MAX_PAGES = 40;
export const CRAWL_TEXT_CAP = 1_500_000;
export const PAGE_TEXT_CAP = 60_000;
export const PAGE_TIMEOUT_MS = 10_000;
export const PAGE_BODY_CAP = 2_000_000;
export const CRAWL_CONCURRENCY = 4;
export const CRAWL_DELAY_CAP_MS = 5_000;
export const START_PAGE_SCORE = 100;

export interface CrawledPage {
  url: string;
  path: string;
  title: string;
  chars: number;
  score: number;
  status: number;
  text: string;
}

export interface CrawlSkipped {
  disallowed: number;
  offHost: number;
  failed: number;
  timedOut: number;
  notHtml: number;
  duplicate: number;
}

export interface CrawlStore {
  host: string;
  startUrl: string;
  fetchedAt: string;
  userAgent: string;
  robots: "fetched" | "missing" | "error";
  crawlDelayMs: number;
  pages: CrawledPage[];
  skipped: CrawlSkipped;
  truncated: boolean;
  totalChars: number;
}

// ── robots.txt ───────────────────────────────────────────────────────────────

export interface RobotsRules {
  allow: string[];
  disallow: string[];
  crawlDelayMs: number;
}

const EMPTY_RULES: RobotsRules = { allow: [], disallow: [], crawlDelayMs: 0 };

interface RobotsGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
  crawlDelayMs: number;
}

/** A pattern is a path prefix: the text up to the first `*`; `$` is not interpreted. */
function prefixOf(pattern: string): string {
  const star = pattern.indexOf("*");
  return star >= 0 ? pattern.slice(0, star) : pattern;
}

/**
 * Groups are `User-agent:` lines followed by rules; a group naming the
 * token (case insensitive, substring) wins over `*`; no group, or null text
 * (no robots.txt, or a non-200), allows everything. Empty `Disallow:` and
 * `Allow:` lines are ignored. `Crawl-delay` is read in seconds, capped.
 */
export function parseRobots(text: string | null, token: string = ROBOTS_TOKEN): RobotsRules {
  if (text === null) return { ...EMPTY_RULES };
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line.length === 0) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [], crawlDelayMs: 0 };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "disallow") {
      const prefix = prefixOf(value);
      if (prefix.length > 0) current.disallow.push(prefix);
    } else if (key === "allow") {
      const prefix = prefixOf(value);
      if (prefix.length > 0) current.allow.push(prefix);
    } else if (key === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) current.crawlDelayMs = Math.min(CRAWL_DELAY_CAP_MS, Math.round(seconds * 1000));
    }
  }
  const needle = token.toLowerCase();
  const own = groups.find((g) => g.agents.some((a) => a.includes(needle)));
  const star = groups.find((g) => g.agents.includes("*"));
  const chosen = own ?? star;
  if (!chosen) return { ...EMPTY_RULES };
  return { allow: [...chosen.allow], disallow: [...chosen.disallow], crawlDelayMs: chosen.crawlDelayMs };
}

/** The longest matching prefix among allow and disallow decides; a tie goes to allow; no match allows. */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  let allowLen = -1;
  let disallowLen = -1;
  for (const prefix of rules.allow) if (path.startsWith(prefix) && prefix.length > allowLen) allowLen = prefix.length;
  for (const prefix of rules.disallow) if (path.startsWith(prefix) && prefix.length > disallowLen) disallowLen = prefix.length;
  if (disallowLen < 0) return true;
  return allowLen >= disallowLen;
}

// ── Links ────────────────────────────────────────────────────────────────────

const SKIPPED_SCHEMES = ["mailto:", "tel:", "javascript:", "data:"];

const SKIPPED_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".zip", ".xml", ".css", ".js", ".ico",
  ".mp4", ".mp3", ".woff", ".woff2", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
];

/** http or https, and not a path ending in a file extension the crawler never reads. */
export function isCrawlableUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const path = url.pathname.toLowerCase();
  return !SKIPPED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Resolves `href` against `base`, keeps http and https on the same host,
 * drops the fragment and the query, strips a trailing slash except on the
 * root, and rejects file links and non-page schemes.
 */
export function normaliseLink(href: string, base: string): string | null {
  const trimmed = href.trim();
  if (trimmed.length === 0) return null;
  const lower = trimmed.toLowerCase();
  if (SKIPPED_SCHEMES.some((s) => lower.startsWith(s))) return null;
  let url: URL;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (!isCrawlableUrl(url)) return null;
  if (!isSameHost(url.hostname, base)) return null;
  url.hash = "";
  url.search = "";
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return `${url.origin}${path}`;
}

/** `href` values from `<a>` tags, in document order, deduplicated, before normalisation. */
export function extractLinks(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (href.length === 0 || seen.has(href)) continue;
    seen.add(href);
    out.push(href);
  }
  return out;
}

// ── Page scoring ─────────────────────────────────────────────────────────────

/**
 * The spec's preferred pages (product, pricing, customers, about, team,
 * solutions, case studies) with their common spellings score up; pages
 * that rarely describe the business (blog, legal, sign-in, listings) score
 * down so they are fetched last and dropped first at the cap.
 */
const KEYWORD_WEIGHTS: ReadonlyArray<[string, number]> = [
  ["product", 5], ["products", 5],
  ["pricing", 5], ["plans", 5], ["plan", 5],
  ["customers", 4], ["customer", 4], ["case-study", 4], ["case-studies", 4], ["casestudy", 4], ["case study", 4], ["testimonials", 4], ["success", 4],
  ["about", 4], ["about-us", 4], ["company", 4],
  ["team", 3], ["leadership", 3], ["people", 3], ["founders", 3],
  ["solutions", 3], ["solution", 3], ["platform", 3], ["features", 3], ["how-it-works", 3],
  ["industries", 2], ["use-cases", 2], ["usecases", 2], ["services", 2],
  ["blog", -3], ["news", -3], ["press", -3], ["careers", -3], ["jobs", -3], ["legal", -3], ["privacy", -3], ["terms", -3],
  ["cookie", -3], ["cookies", -3], ["login", -3], ["signin", -3], ["signup", -3], ["register", -3], ["account", -3],
  ["cart", -3], ["search", -3], ["tag", -3], ["category", -3], ["author", -3], ["page", -3],
];

/**
 * A sum over keywords found in the lowercased path segments (whole
 * segments, and the words inside them) or the title, minus one per path
 * segment beyond the second. The crawler gives the start URL 100.
 */
export function scorePage(path: string, title: string): number {
  const segments = path.toLowerCase().split("/").filter((s) => s.length > 0);
  const tokens = new Set<string>();
  for (const segment of segments) {
    tokens.add(segment);
    for (const word of segment.split(/[^a-z0-9]+/)) if (word) tokens.add(word);
  }
  const titleLower = title.toLowerCase();
  const titleWords = new Set(titleLower.split(/[^a-z0-9]+/).filter((w) => w.length > 0));
  let score = 0;
  for (const [keyword, weight] of KEYWORD_WEIGHTS) {
    const inPath = tokens.has(keyword);
    const inTitle = keyword.includes(" ") ? titleLower.includes(keyword) : titleWords.has(keyword);
    if (inPath || inTitle) score += weight;
  }
  if (segments.length > 2) score -= segments.length - 2;
  return score;
}

// ── Visible text ─────────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  // Dashes become commas so the text handed to the model carries none of
  // the characters the house rules forbid in what it writes back.
  mdash: ", ",
  ndash: ", ",
};

/** Named entities from the short list and numeric entities; anything else is left as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return lower in NAMED_ENTITIES ? NAMED_ENTITIES[lower] : whole;
  });
}

const DROPPED_BLOCKS = ["script", "style", "noscript", "template", "svg", "iframe", "head", "nav", "footer"];
const BLOCK_TAGS = "p|div|br|li|h[1-6]|tr|td|th|section|article|header|blockquote|pre|table|ul|ol|dd|dt";
const HIDDEN_ATTRIBUTE = /\b(?:role\s*=\s*["']?(?:navigation|contentinfo)["']?|aria-hidden\s*=\s*["']?true["']?)/i;

function dropBlock(html: string, tag: string): string {
  return html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), " ");
}

/** Removes elements whose opening tag carries a navigation, contentinfo or aria-hidden marker, through the next closing tag of the same name. */
function dropHiddenElements(html: string): string {
  const re = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let out = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match.index < cursor) continue;
    if (!HIDDEN_ATTRIBUTE.test(match[2])) continue;
    const tag = match[1].toLowerCase();
    const close = new RegExp(`<\\/${tag}\\s*>`, "i");
    const after = html.slice(match.index + match[0].length);
    const closeMatch = close.exec(after);
    out += html.slice(cursor, match.index);
    cursor = closeMatch ? match.index + match[0].length + closeMatch.index + closeMatch[0].length : match.index + match[0].length;
    re.lastIndex = cursor;
  }
  return out + html.slice(cursor);
}

/** Cuts at the last space inside the limit. */
export function cutAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(" ", limit);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, limit)).trimEnd();
}

/**
 * The page as a reader sees it: comments, scripts, styles, templates, SVG,
 * iframes, the head, navigation and footers removed; block tags become
 * newlines; entities decoded; whitespace collapsed; capped at PAGE_TEXT_CAP
 * on a word boundary. The title is the `<title>` text, 200 characters.
 */
export function stripVisibleText(html: string): { title: string; text: string } {
  let work = html.replace(/<!--[\s\S]*?-->/g, " ");
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(work);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim().slice(0, 200) : "";
  for (const tag of DROPPED_BLOCKS) work = dropBlock(work, tag);
  work = dropHiddenElements(work);
  work = work.replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n");
  work = work.replace(/<[^>]+>/g, "");
  work = decodeEntities(work);
  work = work.replace(/[ \t\r\f\v ]+/g, " ");
  const lines = work.split("\n").map((line) => line.trim());
  let text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  text = cutAtWord(text, PAGE_TEXT_CAP);
  return { title, text };
}
