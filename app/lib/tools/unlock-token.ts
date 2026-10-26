/**
 * Signed tokens for the unlock gate: the 30 day unlock cookie, the saved
 * result link and the delete-my-data link all go through signToken and
 * verifyToken with a different purpose string each. The purpose sits inside
 * the signed payload, so a saved-link token presented as a cookie, or a
 * cookie value pasted into a delete link, fails on purpose before any claim
 * is read. One module and one pair of functions means one set of tests
 * covers tampering, expiry and purpose for all three. Pure: the secret and
 * the clock are arguments, so tests import this file with no env.
 *
 * Token shape: base64url(payload) "." base64url(HMAC-SHA256(payload)). The
 * payload is the JSON of { v: 1, p: purpose, iat, ...claims } with the keys
 * in that order, so the same inputs always produce the same token. Both
 * halves are base64url without padding so a token travels in a cookie or a
 * query string without escaping.
 *
 * Expiry is opt-in at verification (maxAgeSeconds), not baked into the
 * token: every token carries iat, but only the cookie's verifier applies a
 * limit. The cookie is a standing credential on a browser, so it must lapse;
 * a saved link or delete link is bound to one run id or one email hash and
 * is useful to nobody else, so it is left to work for as long as the email
 * sits in an inbox.
 *
 * Claims carry the email hash and never the address. The cookie and the
 * delete link are both readable by whoever holds them (the cookie is signed,
 * not encrypted), so an address in a claim would be an address in the wild.
 * hashEmail is the one normalisation every caller uses: SHA-256 hex of the
 * trimmed, lowercased address. Nothing in this module ever sees an address
 * except through that function.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TokenClaims = Record<string, string | number>;

export type VerifyFailure = "malformed" | "signature" | "purpose" | "expired";

export type VerifyResult =
  | { ok: true; claims: TokenClaims & { iat: number } }
  | { ok: false; reason: VerifyFailure };

export interface VerifyOptions {
  nowSeconds?: number;
  maxAgeSeconds?: number;
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function hmac(secret: string, payload: Buffer): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

/**
 * Claims are spread after `v`, `p` and `iat`, so a claim named `v`, `p` or
 * `iat` would override the header. Callers in this codebase use fixed claim
 * names (`eh`, `run`); add a guard before reusing this with caller-supplied
 * claim names.
 */
export function signToken(secret: string, purpose: string, claims: TokenClaims, nowSeconds?: number): string {
  const iat = nowSeconds ?? nowInSeconds();
  const payload = Buffer.from(JSON.stringify({ v: 1, p: purpose, iat, ...claims }), "utf8");
  return `${base64url(payload)}.${base64url(hmac(secret, payload))}`;
}

/**
 * Check order is malformed, signature, purpose, expired, so a tampered token
 * never reveals whether its purpose or age would have passed.
 */
export function verifyToken(secret: string, purpose: string, token: unknown, options: VerifyOptions = {}): VerifyResult {
  if (typeof token !== "string") return { ok: false, reason: "malformed" };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "malformed" };

  const payload = Buffer.from(token.slice(0, dot), "base64url");
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false, reason: "malformed" };
  const body = parsed as Record<string, unknown>;
  if (body.v !== 1) return { ok: false, reason: "malformed" };
  if (typeof body.iat !== "number" || !Number.isInteger(body.iat)) return { ok: false, reason: "malformed" };

  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = hmac(secret, payload);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "signature" };
  }

  if (body.p !== purpose) return { ok: false, reason: "purpose" };

  const iat = body.iat;
  if (options.maxAgeSeconds !== undefined) {
    const now = options.nowSeconds ?? nowInSeconds();
    if (iat + options.maxAgeSeconds < now) return { ok: false, reason: "expired" };
  }

  const claims: TokenClaims & { iat: number } = { iat };
  for (const [key, value] of Object.entries(body)) {
    if (key === "v" || key === "p" || key === "iat") continue;
    if (typeof value === "string" || typeof value === "number") claims[key] = value;
  }
  return { ok: true, claims };
}

/** SHA-256 hex of the trimmed, lowercased address. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
