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

// 5 GTM tool calls per IP per hour
export function getToolLimiter() {
  const redis = getRedisForRateLimit();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:gtm-tool",
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

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
