/**
 * The Brandfetch client with injected deps: no key, the cache, the daily
 * cap, each status, timeouts, and the key never leaking. No network, no
 * Redis, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  BRANDFETCH_FOUND_TTL_SECONDS,
  BRANDFETCH_MISS_TTL_SECONDS,
  lookupBrand,
  type BrandfetchDeps,
} from "../app/lib/project-builder/brandfetch.ts";
import { brandfetchDailyCap } from "../app/lib/ratelimit.ts";

const KEY = "bf-secret-key-123";
const NOW = 1_000_000;

interface Harness {
  deps: Partial<BrandfetchDeps>;
  cache: Map<string, { value: string; ttl: number }>;
  requests: Array<{ url: string; init: RequestInit | undefined }>;
  logs: string[];
  reserves: number;
}

function harness(opts: { key?: string; respond?: (url: string) => Promise<Response>; reserveOk?: boolean; cached?: unknown } = {}): Harness {
  const h: Harness = { deps: {}, cache: new Map(), requests: [], logs: [], reserves: 0 };
  if (opts.cached !== undefined) h.cache.set("brandfetch:acme.com", { value: JSON.stringify(opts.cached), ttl: 1 });
  h.deps = {
    apiKey: () => opts.key ?? KEY,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      h.requests.push({ url: String(input), init });
      return (opts.respond ?? (async () => new Response(JSON.stringify({ logos: [], colors: [{ hex: "#0067B1", type: "accent" }], fonts: [] }), { status: 200 })))(String(input));
    }) as typeof fetch,
    cacheGet: async (key) => h.cache.get(key)?.value ?? null,
    cacheSet: async (key, value, ttl) => {
      h.cache.set(key, { value, ttl });
    },
    reserve: async () => {
      h.reserves += 1;
      return { ok: opts.reserveOk ?? true };
    },
    log: (line) => h.logs.push(line),
    now: () => NOW,
  };
  return h;
}

const deadline = { deadlineAt: NOW + 10_000 };

function noLeak(h: Harness, result: unknown): void {
  for (const line of h.logs) assert.ok(!line.includes(KEY), line);
  for (const { value } of h.cache.values()) assert.ok(!value.includes(KEY));
  assert.ok(!JSON.stringify(result).includes(KEY));
}

describe("lookupBrand", () => {
  test("no key: skipped silently, nothing called", async () => {
    const h = harness({ key: "" });
    const r = await lookupBrand("acme.com", deadline, h.deps);
    assert.deepEqual(r, { outcome: "no-key", data: null });
    assert.equal(h.requests.length, 0);
    assert.equal(h.reserves, 0);
    assert.equal(h.cache.size, 0);
    assert.equal(h.logs.length, 0);
  });

  test("a cached brand is a cached hit and a cached miss is a cached miss; no fetch, no reservation", async () => {
    const hit = harness({ cached: { found: true, data: { logos: [], colours: [], fonts: [], fetchedAt: "t" } } });
    const r = await lookupBrand("www.Acme.com", deadline, hit.deps);
    assert.equal(r.outcome, "cached-hit");
    assert.ok(r.data);
    assert.equal(hit.requests.length + hit.reserves, 0);
    const miss = harness({ cached: { found: false } });
    assert.deepEqual(await lookupBrand("acme.com", deadline, miss.deps), { outcome: "cached-miss", data: null });
    assert.equal(miss.requests.length + miss.reserves, 0);
  });

  test("the daily cap refuses before any request", async () => {
    const h = harness({ reserveOk: false });
    assert.deepEqual(await lookupBrand("acme.com", deadline, h.deps), { outcome: "cap", data: null });
    assert.equal(h.requests.length, 0);
  });

  test("200: the domain route with a bearer key, a hit cached for 30 days", async () => {
    const h = harness();
    const r = await lookupBrand("acme.com", deadline, h.deps);
    assert.equal(r.outcome, "hit");
    assert.deepEqual(r.data?.colours.map((c) => c.hex), ["#0067b1"]);
    assert.equal(h.requests[0].url, "https://api.brandfetch.io/v2/brands/domain/acme.com");
    assert.equal((h.requests[0].init?.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
    const stored = h.cache.get("brandfetch:acme.com");
    assert.equal(stored?.ttl, BRANDFETCH_FOUND_TTL_SECONDS);
    assert.equal(JSON.parse(stored?.value ?? "{}").found, true);
    noLeak(h, r);
  });

  test("404 is a miss cached for 7 days; 400 is a miss not cached", async () => {
    const nf = harness({ respond: async () => new Response(JSON.stringify({ code: "brand_not_found" }), { status: 404 }) });
    assert.deepEqual(await lookupBrand("acme.com", deadline, nf.deps), { outcome: "miss", data: null });
    assert.deepEqual(nf.cache.get("brandfetch:acme.com"), { value: JSON.stringify({ found: false }), ttl: BRANDFETCH_MISS_TTL_SECONDS });
    const bad = harness({ respond: async () => new Response("{}", { status: 400 }) });
    assert.deepEqual(await lookupBrand("acme.com", deadline, bad.deps), { outcome: "miss", data: null });
    assert.equal(bad.cache.size, 0);
  });

  test("401, 403, 429 and 500 are errors, not cached, logged with the status and code only", async () => {
    for (const [status, code] of [[401, "authorization_required"], [403, "api_key_invalid"], [429, "quota_exceeded"], [500, "internal_error"]] as const) {
      const h = harness({ respond: async () => new Response(JSON.stringify({ code, message: `token ${KEY}` }), { status }) });
      const r = await lookupBrand("acme.com", deadline, h.deps);
      assert.deepEqual(r, { outcome: "error", data: null }, String(status));
      assert.equal(h.cache.size, 0);
      assert.deepEqual(h.logs, [`project-builder brandfetch: ${status} ${code} for acme.com`]);
      noLeak(h, r);
    }
  });

  test("a timeout or abort is an error; under 1 s left skips the call", async () => {
    for (const name of ["TimeoutError", "AbortError"]) {
      const h = harness({
        respond: async () => {
          const err = new Error("timed out");
          err.name = name;
          throw err;
        },
      });
      assert.deepEqual(await lookupBrand("acme.com", deadline, h.deps), { outcome: "error", data: null });
      assert.equal(h.cache.size, 0);
      noLeak(h, null);
    }
    const late = harness();
    assert.deepEqual(await lookupBrand("acme.com", { deadlineAt: NOW + 1_200 }, late.deps), { outcome: "error", data: null });
    assert.equal(late.requests.length + late.reserves, 0);
  });

  test("an unparsable 200 body is an error and is not cached", async () => {
    const h = harness({ respond: async () => new Response("<html>not json</html>", { status: 200 }) });
    assert.deepEqual(await lookupBrand("acme.com", deadline, h.deps), { outcome: "error", data: null });
    assert.equal(h.cache.size, 0);
  });

  test("a local or bare host is refused before anything is spent", async () => {
    const h = harness();
    for (const host of ["localhost", "printer.local", "nope"]) assert.equal((await lookupBrand(host, deadline, h.deps)).outcome, "error");
    assert.equal(h.requests.length + h.reserves, 0);
  });
});

describe("brandfetchDailyCap", () => {
  test("200 by default or when not a number; a whole number otherwise; 0 turns lookups off", () => {
    assert.equal(brandfetchDailyCap(undefined), 200);
    assert.equal(brandfetchDailyCap("abc"), 200);
    assert.equal(brandfetchDailyCap("50"), 50);
    assert.equal(brandfetchDailyCap("0"), 0);
  });
});
