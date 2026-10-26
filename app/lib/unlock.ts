/**
 * Server helper for the unlock gate: the one reader of UNLOCK_SECRET, the
 * cookie name and options, and typed issue and verify helpers for the five
 * signed artefacts (cookie, saved link, delete link, the Project Builder
 * brief link and the brief delete link). Routes import this and
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
import { BRIEF_DELETE_PURPOSE, BRIEF_LINK_MAX_AGE_SECONDS, BRIEF_LINK_PURPOSE } from "./project-builder/brief.ts";

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

// ── Project Builder ──────────────────────────────────────────────────────────

/** The resume and view link for a brief: claim `b`, 30 days at verification. A fresh one is minted for every email. */
export function issueBriefLinkToken(briefId: string): string | null {
  const secret = getUnlockSecret();
  return secret ? signToken(secret, BRIEF_LINK_PURPOSE, { b: briefId }) : null;
}

/** True only when the token was signed for exactly this brief id and is under 30 days old. */
export function verifyBriefLinkToken(token: unknown, briefId: string): boolean {
  const secret = getUnlockSecret();
  if (!secret || typeof token !== "string" || token.length === 0) return false;
  const r = verifyToken(secret, BRIEF_LINK_PURPOSE, token, { maxAgeSeconds: BRIEF_LINK_MAX_AGE_SECONDS });
  return r.ok && r.claims.b === briefId;
}

/** No expiry: bound to the email hash, so it can only ever delete the briefs under its own address. */
export function issueBriefDeleteToken(emailHash: string): string | null {
  const secret = getUnlockSecret();
  return secret ? signToken(secret, BRIEF_DELETE_PURPOSE, { eh: emailHash }) : null;
}

export function verifyBriefDeleteToken(token: unknown, emailHash: string): boolean {
  const secret = getUnlockSecret();
  if (!secret || typeof token !== "string" || token.length === 0) return false;
  const r = verifyToken(secret, BRIEF_DELETE_PURPOSE, token);
  return r.ok && r.claims.eh === emailHash;
}
