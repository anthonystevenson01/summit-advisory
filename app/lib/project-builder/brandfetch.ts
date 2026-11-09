/**
 * The Brandfetch Brand API client: one GET for a company domain when its own
 * website gave no usable logo or colours. Server only. Never throws.
 *
 * Order: the key (unset means a silent skip), the domain check, the per
 * domain cache `brandfetch:{domain}` (shared by every brief: public brand
 * data, not prospect data), the site wide daily cap (only on a cache miss),
 * the request on the explicit domain route with a short timeout, then the
 * cache write: a found brand for 30 days, a 404 (which costs a credit) for 7.
 * A 400 is a miss that is not cached (no credit spent); 401, 402, 403, 429,
 * 5xx, a network error and a timeout are errors that are not cached.
 *
 * The key is read here and sent only in the Authorization header. It is
 * never logged, cached, returned or sent to the browser; the one log line on
 * an error carries the HTTP status and Brandfetch's error code only.
 */
import { getRedis } from "../redis.ts";
import { reserveBrandfetchDailyCall } from "../ratelimit.ts";
import { isPublicHostname } from "../ask-summit/validation.ts";
import { normaliseDomain } from "./brief.ts";
import { parseBrandfetch, type BrandData } from "./brand-data.ts";
import type { BrandLookup } from "./house-style.ts";

/**
 * The explicit domain route of the Brand API, so a short domain cannot be
 * read as a ticker. Found brands are cached for 30 days, not found for 7 (a
 * 404 costs a credit, and a newly indexed brand should appear within a
 * week). The request is cut at 4 s and the body read at most 512 KB.
 */
export const BRANDFETCH_API = "https://api.brandfetch.io/v2/brands/domain/";
export const BRANDFETCH_FOUND_TTL_SECONDS = 30 * 24 * 60 * 60;
export const BRANDFETCH_MISS_TTL_SECONDS = 7 * 24 * 60 * 60;
export const BRANDFETCH_TIMEOUT_MS = 4_000;
export const BRANDFETCH_BODY_CAP = 512 * 1024;
/** Under this much time left the call is not started. */
const MIN_TIME_MS = 1_000;

/** The per domain cache key. Shared by every brief and not deleted with a brief: it holds public brand data, not anything a prospect typed. */
export function brandfetchCacheKey(domain: string): string {
  return `brandfetch:${domain}`;
}

type CachedBrand = { found: true; data: BrandData } | { found: false };

/** Everything the lookup touches outside itself, so the tests run with a fake fetch, cache, cap and env and no network. */
export interface BrandfetchDeps {
  fetch: typeof fetch;
  apiKey: () => string;
  cacheGet: (key: string) => Promise<unknown>;
  cacheSet: (key: string, value: string, ttlSeconds: number) => Promise<void>;
  reserve: () => Promise<{ ok: boolean }>;
  log: (line: string) => void;
  now: () => number;
}

const realDeps: BrandfetchDeps = {
  fetch: (input, init) => fetch(input, init),
  apiKey: () => process.env.BRANDFETCH_API_KEY?.trim() ?? "",
  cacheGet: (key) => getRedis().get(key),
  cacheSet: async (key, value, ttlSeconds) => {
    await getRedis().set(key, value, { ex: ttlSeconds });
  },
  reserve: () => reserveBrandfetchDailyCall(),
  log: (line) => console.error(line),
  now: () => Date.now(),
};

/** The outcome (for the note and the stats) and the mapped data, null unless the brand was found. */
export interface BrandLookupResult {
  outcome: BrandLookup;
  data: BrandData | null;
}

function readCached(value: unknown): CachedBrand | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const v = parsed as { found?: unknown; data?: unknown };
  if (v.found === false) return { found: false };
  if (v.found === true && v.data && typeof v.data === "object") return { found: true, data: v.data as BrandData };
  return null;
}

async function errorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { code?: unknown; error?: unknown };
    const code = typeof body.code === "string" ? body.code : typeof body.error === "string" ? body.error : "";
    return code.replace(/[^a-z0-9_]/gi, "").slice(0, 40);
  } catch {
    return "";
  }
}

/** The brand record for a company domain, or why there is none. */
export async function lookupBrand(domain: string, opts: { deadlineAt: number }, overrides: Partial<BrandfetchDeps> = {}): Promise<BrandLookupResult> {
  const deps: BrandfetchDeps = { ...realDeps, ...overrides };
  const key = deps.apiKey();
  if (!key) return { outcome: "no-key", data: null };

  const host = normaliseDomain(domain);
  if (!host || !isPublicHostname(host)) return { outcome: "error", data: null };
  const cacheKey = brandfetchCacheKey(host);

  try {
    const cached = readCached(await deps.cacheGet(cacheKey));
    if (cached?.found) return { outcome: "cached-hit", data: cached.data };
    if (cached && !cached.found) return { outcome: "cached-miss", data: null };
  } catch {
    // a cache failure only means a live lookup
  }

  const remaining = opts.deadlineAt - deps.now() - 500;
  if (remaining < MIN_TIME_MS) return { outcome: "error", data: null };

  try {
    const reserved = await deps.reserve();
    if (!reserved.ok) return { outcome: "cap", data: null };
  } catch {
    return { outcome: "error", data: null };
  }

  const write = async (value: CachedBrand, ttl: number) => {
    try {
      await deps.cacheSet(cacheKey, JSON.stringify(value), ttl);
    } catch {
      // the answer is still used; the next brief asks again
    }
  };

  let res: Response;
  try {
    res = await deps.fetch(`${BRANDFETCH_API}${encodeURIComponent(host)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(BRANDFETCH_TIMEOUT_MS, remaining)),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    deps.log(`project-builder brandfetch: ${name === "TimeoutError" || name === "AbortError" ? "timeout" : "request failed"} for ${host}`);
    return { outcome: "error", data: null };
  }

  if (res.status === 200) {
    let data: BrandData;
    try {
      const text = (await res.text()).slice(0, BRANDFETCH_BODY_CAP);
      data = parseBrandfetch(JSON.parse(text));
    } catch {
      deps.log(`project-builder brandfetch: unusable answer for ${host}`);
      return { outcome: "error", data: null };
    }
    await write({ found: true, data }, BRANDFETCH_FOUND_TTL_SECONDS);
    return { outcome: "hit", data };
  }
  if (res.status === 404) {
    await write({ found: false }, BRANDFETCH_MISS_TTL_SECONDS);
    return { outcome: "miss", data: null };
  }
  if (res.status === 400) return { outcome: "miss", data: null };
  const code = await errorCode(res);
  deps.log(`project-builder brandfetch: ${res.status}${code ? ` ${code}` : ""} for ${host}`);
  return { outcome: "error", data: null };
}
