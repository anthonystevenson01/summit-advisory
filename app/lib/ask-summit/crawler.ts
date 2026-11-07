/**
 * The polite crawler: robots.txt first, then the start URL and the pages it
 * links to on the same host, highest scored first, under the caps in
 * crawl-rules.ts and the stage deadline. No JavaScript rendering, no form
 * submission, no cookies, no query strings beyond the start URL. A failed
 * page never fails the stage: it is counted in `skipped` and the crawl goes
 * on; zero pages is a thin result, not an error. The rules live in
 * crawl-rules.ts and are tested; this file only fetches.
 *
 * The Project Builder's house style read uses the same crawler: a smaller
 * page cap, the raw HTML kept, and `fetchAsset` for the stylesheets and the
 * logo a page references, with the same user agent, timeout, host rule and
 * robots rules. Without those options Ask Summit behaves as before.
 */
import {
  CRAWL_CONCURRENCY,
  CRAWL_MAX_PAGES,
  CRAWL_TEXT_CAP,
  DEFAULT_USER_AGENT,
  PAGE_BODY_CAP,
  PAGE_HTML_CAP,
  PAGE_TIMEOUT_MS,
  START_PAGE_SCORE,
  cutAtWord,
  extractLinks,
  isAllowed,
  normaliseLink,
  parseRobots,
  scorePage,
  stripVisibleText,
  type CrawlStore,
  type CrawledPage,
  type RobotsRules,
} from "./crawl-rules.ts";
import { isPublicHostname, isSameHost } from "./validation.ts";

export interface FetchedRobots {
  rules: RobotsRules;
  status: CrawlStore["robots"];
}

export interface CrawlOptions {
  /** Epoch ms; no fetch starts within PAGE_TIMEOUT_MS of it. */
  deadlineAt: number;
  userAgent: string;
  /** Defaults to CRAWL_MAX_PAGES. */
  maxPages?: number;
  /** Keep each page's raw HTML (capped at PAGE_HTML_CAP); the start page is kept even when its visible text is short. */
  keepHtml?: boolean;
  /** Rules already fetched by the caller; skips the crawl's own robots.txt read. */
  robots?: FetchedRobots;
}

/** ASK_SUMMIT_USER_AGENT overrides the default so a token that sites start blocking can be changed without a deploy. */
export function crawlerUserAgent(): string {
  return process.env.ASK_SUMMIT_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

/** A page whose visible text is shorter than this is an empty shell and is not stored. */
const MIN_PAGE_CHARS = 40;
/** Two pages whose first 2000 characters match are one page (a print view, a trailing-slash twin); the second is skipped. */
const DUPLICATE_WINDOW = 2_000;
/** How long an idle worker waits for a busy one to add links before checking the frontier again. */
const IDLE_WAIT_MS = 100;

interface Candidate {
  url: string;
  score: number;
  order: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchRobots(origin: string, userAgent: string): Promise<FetchedRobots> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      redirect: "follow",
      headers: { "user-agent": userAgent, accept: "text/plain" },
    });
    if (res.status === 200) {
      const text = (await res.text()).slice(0, PAGE_BODY_CAP);
      return { rules: parseRobots(text), status: "fetched" };
    }
    return { rules: parseRobots(null), status: "missing" };
  } catch {
    return { rules: parseRobots(null), status: "error" };
  }
}

/**
 * Fetches the start URL and the best scored same-host links until 40
 * pages, 1.5 MB of text or the deadline. Pages come back sorted by score,
 * the start page first.
 */
export async function crawlSite(startUrl: string, opts: CrawlOptions): Promise<CrawlStore> {
  const start = new URL(startUrl);
  const userAgent = opts.userAgent;
  const { rules, status: robots } = opts.robots ?? (await fetchRobots(start.origin, userAgent));
  const maxPages = opts.maxPages ?? CRAWL_MAX_PAGES;
  const crawlDelayMs = rules.crawlDelayMs;
  // A Crawl-delay only means something with one request at a time; a site
  // that asks for one is the kind that blocks an impolite crawler.
  const concurrency = crawlDelayMs > 0 ? 1 : CRAWL_CONCURRENCY;

  const store: CrawlStore = {
    host: start.hostname,
    startUrl,
    fetchedAt: new Date().toISOString(),
    userAgent,
    robots,
    crawlDelayMs,
    pages: [],
    skipped: { disallowed: 0, offHost: 0, failed: 0, timedOut: 0, notHtml: 0, duplicate: 0 },
    truncated: false,
    totalChars: 0,
  };

  const startKey = normaliseLink(startUrl, startUrl) ?? startUrl;
  const visited = new Set<string>([startKey]);
  const seenText = new Set<string>();
  const frontier: Candidate[] = [{ url: startUrl, score: START_PAGE_SCORE, order: 0 }];
  let order = 1;
  let attempts = 0;
  let inFlight = 0;
  let stopped = false;
  let lastFetchAt = 0;

  const stopNow = () => stopped || attempts >= maxPages || store.totalChars >= CRAWL_TEXT_CAP || Date.now() >= opts.deadlineAt - PAGE_TIMEOUT_MS;

  /** The highest scored candidate, the earliest found on a tie, so the preferred pages are fetched before the cap is reached. */
  const takeNext = (): Candidate | null => {
    if (frontier.length === 0) return null;
    let best = 0;
    for (let i = 1; i < frontier.length; i += 1) {
      const a = frontier[i];
      const b = frontier[best];
      if (a.score > b.score || (a.score === b.score && a.order < b.order)) best = i;
    }
    return frontier.splice(best, 1)[0];
  };

  const addLinks = (html: string, base: string) => {
    for (const href of extractLinks(html)) {
      const link = normaliseLink(href, base);
      if (!link || visited.has(link)) continue;
      visited.add(link);
      frontier.push({ url: link, score: scorePage(new URL(link).pathname, ""), order });
      order += 1;
    }
  };

  const fetchOne = async (candidate: Candidate, isStart: boolean) => {
    const path = new URL(candidate.url).pathname;
    if (!isAllowed(rules, path)) {
      store.skipped.disallowed += 1;
      return;
    }
    if (crawlDelayMs > 0) {
      const wait = lastFetchAt + crawlDelayMs - Date.now();
      if (wait > 0) await sleep(wait);
    }
    attempts += 1;
    lastFetchAt = Date.now();
    let res: Response;
    try {
      res = await fetch(candidate.url, {
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        redirect: "follow",
        headers: { "user-agent": userAgent, accept: "text/html" },
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) store.skipped.timedOut += 1;
      else store.skipped.failed += 1;
      return;
    }
    if (!isSameHost(new URL(res.url).hostname, start.hostname)) {
      store.skipped.offHost += 1;
      return;
    }
    if (res.status < 200 || res.status >= 300) {
      store.skipped.failed += 1;
      return;
    }
    const contentType = res.headers.get("content-type") ?? "";
    const length = Number(res.headers.get("content-length") ?? 0);
    if (!contentType.toLowerCase().includes("text/html") || length > PAGE_BODY_CAP) {
      store.skipped.notHtml += 1;
      return;
    }
    let html: string;
    try {
      html = (await res.text()).slice(0, PAGE_BODY_CAP);
    } catch {
      store.skipped.failed += 1;
      return;
    }
    const finalPath = new URL(res.url).pathname;
    const { title, text } = stripVisibleText(html);
    const keepShortStart = opts.keepHtml === true && isStart;
    if (text.length < MIN_PAGE_CHARS && !keepShortStart) {
      // A shell page (a cookie wall, a script-only front page) is not
      // stored, but the pages it links to may be real, so its links are kept.
      addLinks(html, res.url);
      return;
    }
    const fingerprint = text.slice(0, DUPLICATE_WINDOW);
    if (seenText.has(fingerprint)) {
      store.skipped.duplicate += 1;
      return;
    }
    seenText.add(fingerprint);
    if (stopped) return;
    let kept = text;
    const room = CRAWL_TEXT_CAP - store.totalChars;
    if (kept.length > room) {
      kept = cutAtWord(kept, Math.max(0, room));
      store.truncated = true;
      stopped = true;
    }
    const page: CrawledPage = {
      url: res.url,
      path: finalPath,
      title,
      chars: kept.length,
      score: isStart ? START_PAGE_SCORE : scorePage(finalPath, title),
      status: res.status,
      text: kept,
      ...(opts.keepHtml ? { html: html.slice(0, PAGE_HTML_CAP) } : {}),
    };
    store.pages.push(page);
    store.totalChars += kept.length;
    if (!stopped) addLinks(html, res.url);
  };

  const worker = async () => {
    for (;;) {
      if (stopNow()) return;
      const candidate = takeNext();
      if (!candidate) {
        if (inFlight === 0) return;
        await sleep(IDLE_WAIT_MS);
        continue;
      }
      inFlight += 1;
      try {
        await fetchOne(candidate, candidate.order === 0);
      } catch (err) {
        store.skipped.failed += 1;
        console.error("ask-summit crawl: page failed", err instanceof Error ? err.message.slice(0, 200) : err);
      } finally {
        inFlight -= 1;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  store.pages.sort((a, b) => (b.score === a.score ? 0 : b.score - a.score));
  const startIndex = store.pages.findIndex((p) => p.score === START_PAGE_SCORE);
  if (startIndex > 0) {
    const [startPage] = store.pages.splice(startIndex, 1);
    store.pages.unshift(startPage);
  }
  return store;
}

// ── Assets ───────────────────────────────────────────────────────────────────

export interface FetchAssetOptions {
  /** Epoch ms; the request is cut at the earlier of this and PAGE_TIMEOUT_MS. */
  deadlineAt: number;
  userAgent: string;
  maxBytes: number;
  /** The accept header, e.g. "text/css" or "image/*". */
  accept: string;
  /** The crawled site's host: an asset on it must pass the robots rules. */
  siteHost: string;
  robots: RobotsRules;
}

export type FetchAssetResult =
  | { ok: true; bytes: Uint8Array; contentType: string; finalUrl: string }
  | { ok: false; reason: string };

/**
 * One GET for a stylesheet or an image a crawled page references. Refuses a
 * non http(s) URL or a host the form would refuse, applies robots.txt on the
 * site's own host, follows redirects but refuses a final host that fails the
 * same rule, refuses a non 2xx answer, a declared length over the cap, and
 * stops reading (and cancels the stream) once the cap is passed. The
 * content type is the caller's to check. Never throws.
 */
export async function fetchAsset(url: string, opts: FetchAssetOptions): Promise<FetchAssetResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "bad-url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, reason: "bad-scheme" };
  if (!isPublicHostname(parsed.hostname)) return { ok: false, reason: "blocked-host" };
  if (isSameHost(parsed.hostname, opts.siteHost) && !isAllowed(opts.robots, parsed.pathname)) return { ok: false, reason: "disallowed" };
  const remaining = opts.deadlineAt - Date.now();
  if (remaining <= 500) return { ok: false, reason: "deadline" };
  try {
    const res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(Math.min(PAGE_TIMEOUT_MS, remaining)),
      redirect: "follow",
      headers: { "user-agent": opts.userAgent, accept: opts.accept },
    });
    const finalUrl = res.url || parsed.toString();
    if (!isPublicHostname(new URL(finalUrl).hostname)) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, reason: "blocked-redirect" };
    }
    if (res.status < 200 || res.status >= 300) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, reason: `status-${res.status}` };
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > opts.maxBytes) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, reason: "too-large" };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.body) return { ok: true, bytes: new Uint8Array(0), contentType, finalUrl };
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > opts.maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return { ok: true, bytes, contentType, finalUrl };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "failed" };
  }
}
