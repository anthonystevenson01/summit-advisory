import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
