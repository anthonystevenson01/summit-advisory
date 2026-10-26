/**
 * The report access code: a per-report salt, an scrypt hash and a
 * constant-time verify. Separate from `report-model.ts` because it needs
 * `node:crypto`, which the edge image that loads the model cannot import.
 * Pure: the code and the stored value are arguments, so the tests run with
 * no env. Codes are normalised by trim and lowercase before hashing because
 * a prospect types them on a phone with autocapitalisation; the stored
 * value is the salt and the hash only, never the code.
 *
 * Why scrypt with a salt per report: codes are short and human chosen, so a
 * plain or shared-salt hash would let one leaked store be attacked with a
 * precomputed table and would show which reports share a code. The hash
 * cost is not the defence against guessing online; the `rl:report-access`
 * limiter is (10 attempts per IP per hour), which is why Node's default
 * scrypt parameters are enough. The compare is constant time so response
 * timing does not reveal how many bytes of a guess matched.
 *
 * The first 8 hex characters of the hash are also the claim inside the
 * access cookie (`issueReportAccessCookie` in `app/lib/unlock.ts`): enough
 * to tie a cookie to one code without exposing the hash, so clearing or
 * changing the code invalidates every cookie issued under the old one with
 * no server-side session state.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ACCESS_CODE_MIN = 4;
export const ACCESS_CODE_MAX = 64;

const HASH_BYTES = 32;

export interface StoredAccessCode {
  salt: string;
  hash: string;
}

/** 16 random bytes as hex. */
export function newAccessCodeSalt(): string {
  return randomBytes(16).toString("hex");
}

export function normaliseAccessCode(code: string): string {
  return code.trim().toLowerCase();
}

/** 4 to 64 characters once trimmed. */
export function isAcceptableAccessCode(code: unknown): code is string {
  if (typeof code !== "string") return false;
  const length = code.trim().length;
  return length >= ACCESS_CODE_MIN && length <= ACCESS_CODE_MAX;
}

/** scrypt of the normalised code with the salt, 32 bytes, Node's default cost, as hex. */
export function hashAccessCode(code: string, salt: string): string {
  return scryptSync(normaliseAccessCode(code), salt, HASH_BYTES).toString("hex");
}

/** Recomputes with the stored salt and compares in constant time. False for an empty code or a malformed stored value. */
export function verifyAccessCode(code: unknown, stored: Partial<StoredAccessCode> | null | undefined): boolean {
  if (typeof code !== "string" || normaliseAccessCode(code).length === 0) return false;
  if (!stored || typeof stored.salt !== "string" || typeof stored.hash !== "string" || !stored.salt || !stored.hash) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(stored.hash, "hex");
  } catch {
    return false;
  }
  const given = Buffer.from(hashAccessCode(code, stored.salt), "hex");
  if (given.length !== expected.length || given.length === 0) return false;
  return timingSafeEqual(given, expected);
}
