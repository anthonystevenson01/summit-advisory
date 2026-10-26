import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { BUILDER_DAILY_CAP } from "./project-builder/brief.ts";

function getRedisForRateLimit() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// 5 evaluations per IP per hour (Phase 1 — Haiku + Sonnet cost)
export function getEvaluateLimiter() {
  const redis = getRedisForRateLimit();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:evaluate",
  });
}

// 10 unlocks per IP per hour (Phase 2 — Sonnet cost)
export function getDetailsLimiter() {
  const redis = getRedisForRateLimit();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:details",
  });
}

// 2 Built to Scale? runs per IP per hour (seven scoring calls plus one synthesis per run)
export function getBuiltToScaleLimiter() {
  const redis = getRedisForRateLimit();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2, "1 h"),
    prefix: "rl:bts",
  });
}

// 20 admin login attempts per IP per 15 minutes (brute force protection)
export function getLoginLimiter() {
  const redis = getRedisForRateLimit();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "15 m"),
    prefix: "rl:login",
  });
}

// 3 Account Intel calls per IP per hour (web search is expensive)
export function getAccountIntelLimiter() {
  const redis = getRedisForRateLimit();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: "rl:gtm-account",
  });
}

// 10 report access-code attempts per IP per hour (Release 4; the hash cost is not the defence, this is)
export function getReportAccessLimiter() {
  const redis = getRedisForRateLimit();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:report-access",
  });
}

// ── Project Builder ──────────────────────────────────────────────────────────

function builderLimiter(limit: number, window: "1 h" | "24 h", prefix: string) {
  const redis = getRedisForRateLimit();
  if (!redis) return null;
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, window), prefix });
}

// 5 document reads per IP per day (the biggest input, no rule fallback)
export function getBuilderReadLimiter() {
  return builderLimiter(5, "24 h", "rl:builder-read");
}

// 40 suggestions or lookups per IP per hour
export function getBuilderSuggestLimiter() {
  return builderLimiter(40, "1 h", "rl:builder-suggest");
}

// 6 ideas runs per IP per hour (Sonnet)
export function getBuilderIdeasLimiter() {
  return builderLimiter(6, "1 h", "rl:builder-ideas");
}

// 20 saves per IP per hour, shared by create, autosave, submit and change
export function getBuilderSaveLimiter() {
  return builderLimiter(20, "1 h", "rl:builder-save");
}

// 5 "email me my link" requests per IP per hour
export function getBuilderLinkLimiter() {
  return builderLimiter(5, "1 h", "rl:builder-link");
}

// 120 page events per IP per hour
export function getBuilderEventLimiter() {
  return builderLimiter(120, "1 h", "rl:builder-event");
}

/** The site wide day key the builder helpers reserve before each model call. */
export function builderDailyKey(now = new Date()): string {
  return `builder:calls:${now.toISOString().slice(0, 10)}`;
}

/**
 * Reserves one of the day's builder model calls: INCR `builder:calls:{day}`
 * (UTC), EXPIRE 48 h on the first increment, `ok` false over the cap. A
 * reservation is spent even when the model call then fails. Without Redis
 * every call is allowed, so a missing variable never blocks the helpers.
 *
 * The reservation happens before the call, not after, so the cap is a hard
 * ceiling: one atomic INCR cannot let two concurrent requests both pass a
 * read-then-check, and a call that fails has already cost money at the
 * provider, so there is nothing honest to refund. The counter is a plain
 * day key an admin can reset by hand (`DEL builder:calls:{day}`).
 */
export async function reserveBuilderDailyCall(): Promise<{ ok: boolean; count: number }> {
  const redis = getRedisForRateLimit();
  if (!redis) return { ok: true, count: 0 };
  const key = builderDailyKey();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 172_800);
  return { ok: count <= BUILDER_DAILY_CAP, count };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
