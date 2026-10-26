/**
 * Server helper for the unlock gate: the one reader of UNLOCK_SECRET, the
 * cookie name and options, and typed issue and verify helpers for the three
 * signed artefacts (cookie, saved link, delete link). Routes import this and
 * never touch the secret or the token module directly, so "where is the
 * secret read" has one answer and the pure token module stays testable
 * with no env.
 *
 * Secret unset: every issue helper returns null and every verify helper
 * returns null or false. The unlock route still records the unlock on the
 * run (the 1a per-run behaviour), but no cookie, saved link or result email
 * can be signed, so none is issued. That is deliberate: an email that says
 * the result is stored but offers no delete link would break the promise on
 * the gate. The warning logs once per instance so a misconfigured
 * environment is visible in the function log without flooding it.
 */
import { signToken, verifyToken } from "./tools/unlock-token.ts";

export const UNLOCK_COOKIE = "summit_unlock";
/**
 * 30 days, enforced twice: on `iat` at verification (authoritative, so a
 * cookie copied off a browser after its Max-Age still fails) and as the
 * cookie's Max-Age (what makes the browser drop it).
 */
export const UNLOCK_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const PURPOSE_COOKIE = "unlock-cookie";
const PURPOSE_SAVED_LINK = "saved-link";
const PURPOSE_DELETE = "delete";
const PURPOSE_REPORT_ACCESS = "report-access";

/** The report access cookie, path scoped to one report. */
export const REPORT_ACCESS_COOKIE = "summit_report";

let warned = false;

export function getUnlockSecret(): string | null {
  const value = process.env.UNLOCK_SECRET?.trim();
  if (value) return value;
  if (!warned) {
    warned = true;
    console.warn("UNLOCK_SECRET is not set: unlocks are recorded but no cookie, saved link or result email is issued");
  }
  return null;
}

/** Same shape as `sessionCookieOptions` in auth.ts: `secure` follows NODE_ENV so `npm run dev` over http still sets it. */
export function unlockCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: UNLOCK_MAX_AGE_SECONDS,
  };
}

export function issueUnlockCookie(emailHash: string): string | null {
  const secret = getUnlockSecret();
  return secret ? signToken(secret, PURPOSE_COOKIE, { eh: emailHash }) : null;
}

export function verifyUnlockCookie(value: unknown): { emailHash: string } | null {
  const secret = getUnlockSecret();
  if (!secret || typeof value !== "string" || value.length === 0) return null;
  const r = verifyToken(secret, PURPOSE_COOKIE, value, { maxAgeSeconds: UNLOCK_MAX_AGE_SECONDS });
  if (!r.ok || typeof r.claims.eh !== "string" || r.claims.eh.length === 0) return null;
  return { emailHash: r.claims.eh };
}

/** No expiry: the token is bound to one run id and does nothing for any other run or for the delete route. */
export function issueSavedLinkToken(runId: string): string | null {
  const secret = getUnlockSecret();
  return secret ? signToken(secret, PURPOSE_SAVED_LINK, { run: runId }) : null;
}

/** True only when the token was signed for exactly this run id. */
export function verifySavedLinkToken(token: unknown, runId: string): boolean {
  const secret = getUnlockSecret();
  if (!secret || typeof token !== "string" || token.length === 0) return false;
  const r = verifyToken(secret, PURPOSE_SAVED_LINK, token);
  return r.ok && r.claims.run === runId;
}

/** No expiry: an old email's delete link still works, and it can only ever delete the data under its own hash. */
export function issueDeleteToken(emailHash: string): string | null {
  const secret = getUnlockSecret();
  return secret ? signToken(secret, PURPOSE_DELETE, { eh: emailHash }) : null;
}

/** True only when the token was signed for exactly this email hash. */
export function verifyDeleteToken(token: unknown, emailHash: string): boolean {
  const secret = getUnlockSecret();
  if (!secret || typeof token !== "string" || token.length === 0) return false;
  const r = verifyToken(secret, PURPOSE_DELETE, token);
  return r.ok && r.claims.eh === emailHash;
}

/**
 * Same shape as the unlock cookie's options but scoped to `/report/{slug}`
 * so a cookie for one report is never sent to another, with the Max-Age
 * the caller computes (the seconds until the report expires, capped).
 */
export function reportAccessCookieOptions(slug: string, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: `/report/${slug}`,
    maxAge: maxAgeSeconds,
  };
}

/**
 * Claims the slug and the first 8 hex characters of the access-code hash,
 * so clearing or changing the code invalidates every cookie issued under
 * the old one without any server state.
 */
export function issueReportAccessCookie(slug: string, codeHashPrefix: string): string | null {
  const secret = getUnlockSecret();
  return secret ? signToken(secret, PURPOSE_REPORT_ACCESS, { slug, ac: codeHashPrefix }) : null;
}

/** True only when the token carries this slug and this hash prefix; 30 days as a backstop on top of the cookie's Max-Age. */
export function verifyReportAccessCookie(value: unknown, slug: string, codeHashPrefix: string): boolean {
  const secret = getUnlockSecret();
  if (!secret || typeof value !== "string" || value.length === 0) return false;
  const r = verifyToken(secret, PURPOSE_REPORT_ACCESS, value, { maxAgeSeconds: UNLOCK_MAX_AGE_SECONDS });
  return r.ok && r.claims.slug === slug && r.claims.ac === codeHashPrefix;
}
