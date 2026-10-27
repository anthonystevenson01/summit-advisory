/**
 * What the Project Builder routes share: JSON parsing, the honeypot, the
 * limiter answer, brief resolution from `briefId` and `token`, the two
 * links every email carries, and the budgeted mail send in the 1b style.
 *
 * `resolveBrief` is the one path from a request body to a brief: the id
 * must match the pattern (400), the token must verify for that id (403),
 * the hash must exist (404), and a locked brief answers 409 for every write
 * and helper. Without a `briefId` the helpers run unsaved and store nothing.
 */
import { NextRequest, NextResponse } from "next/server";
import type { Ratelimit } from "@upstash/ratelimit";
import { getClientIp } from "@/app/lib/ratelimit";
import { getBrief, type BriefRecord } from "@/app/lib/briefs";
import { isMailConfigured, resultFromAddress, sendMail } from "@/app/lib/mail";
import { redactAddresses } from "@/app/lib/tools/result-email";
import { getUnlockSecret, issueBriefDeleteToken, issueBriefLinkToken, verifyBriefLinkToken } from "@/app/lib/unlock";
import { BRIEF_ID_PATTERN, isLocked } from "@/app/lib/project-builder/brief";
import type { BriefEmail, EmailContact } from "@/app/lib/project-builder/emails";
import { BRIEF_LOCKED_MESSAGE, RATE_LIMIT_MESSAGE } from "./errors";

export type Body = Record<string, unknown>;

export async function readJson(req: NextRequest): Promise<{ body: Body } | { res: NextResponse }> {
  try {
    const body = (await req.json()) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return { res: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }) };
    }
    return { body: body as Body };
  } catch {
    return { res: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }) };
  }
}

/** The top level `website` field is the honeypot on every builder route; the real website fields are nested. */
export function isHoneypotFilled(body: Body): boolean {
  return typeof body.website === "string" && body.website.length > 0;
}

export function honeypotResponse(): NextResponse {
  return NextResponse.json({ ok: true });
}

/** A 429 with Retry-After when the limiter refuses, else null. No limiter (no Upstash) means no limit. */
export async function limit(req: NextRequest, limiter: Ratelimit | null, scope: string, retryAfterSeconds: number): Promise<NextResponse | null> {
  if (!limiter) return null;
  const { success } = await limiter.limit(`${getClientIp(req)}:${scope}`);
  if (success) return null;
  return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
}

export function secondsToMidnightUtc(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export type ResolvedBrief = { brief: BriefRecord | null } | { res: NextResponse };

export const LINK_INVALID = "This link is not valid or has expired.";
export const BRIEF_GONE = "This brief was not found. It may have expired or been deleted.";

/**
 * With a `briefId`: pattern (400), token (403), record (404), lock (409 when
 * `write`). Without one: `{ brief: null }`.
 */
export async function resolveBrief(body: Body, write = true): Promise<ResolvedBrief> {
  const briefId = typeof body.briefId === "string" ? body.briefId.trim() : "";
  if (!briefId) return { brief: null };
  if (!BRIEF_ID_PATTERN.test(briefId)) return { res: NextResponse.json({ error: "That brief id is not valid." }, { status: 400 }) };
  if (!verifyBriefLinkToken(body.token, briefId)) return { res: NextResponse.json({ error: LINK_INVALID }, { status: 403 }) };
  const brief = await getBrief(briefId);
  if (!brief) return { res: NextResponse.json({ error: BRIEF_GONE }, { status: 404 }) };
  if (write && isLocked(brief.status)) return { res: NextResponse.json({ error: BRIEF_LOCKED_MESSAGE, locked: true }, { status: 409 }) };
  return { brief };
}

export function adminUrlFor(origin: string, id: string): string {
  return `${origin}/admin/briefs/${encodeURIComponent(id)}`;
}

export interface BriefLinks {
  token: string;
  resumeUrl: string;
  deleteUrl: string;
}

/** A fresh link token and the delete token, or null when the secret is unset. */
export function briefLinks(origin: string, id: string, emailHash: string): BriefLinks | null {
  const token = issueBriefLinkToken(id);
  const deleteToken = issueBriefDeleteToken(emailHash);
  if (!token || !deleteToken) return null;
  return {
    token,
    resumeUrl: `${origin}/tools/project-builder?b=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`,
    deleteUrl: `${origin}/api/project-builder/delete?e=${encodeURIComponent(emailHash)}&t=${encodeURIComponent(deleteToken)}`,
  };
}

export function emailContactOf(brief: BriefRecord): EmailContact {
  return { name: brief.contact.name, company: brief.contact.company, website: brief.contact.website };
}

/**
 * The 1b time budget inside `maxDuration = 60`: the transport gets what is
 * left of 58 s, capped at 10 s, and is skipped under 2 s.
 */
export const ROUTE_BUDGET_MS = 58_000;
export const SEND_TIMEOUT_MS = 10_000;
export const MIN_SEND_BUDGET_MS = 2_000;

export interface SendArgs {
  to: string;
  email: BriefEmail;
  startedAt: number;
  context: string;
  /** The hash prefix for the log line, never an address. */
  hashPrefix: string;
  /** Overrides the From address (the alert goes from NOTIFY_EMAIL to itself). */
  from?: string;
}

/** Sends inside the budget; any failure is logged with the hash prefix and returns false. Never throws. */
export async function sendBudgeted(args: SendArgs): Promise<boolean> {
  const fail = (reason: string) => {
    console.error(`${args.context}: email failed for ${args.hashPrefix}: ${reason}`);
    return false;
  };
  if (!getUnlockSecret()) return fail("UNLOCK_SECRET is not set");
  if (!isMailConfigured()) return fail("SMTP not configured");
  const remaining = ROUTE_BUDGET_MS - (Date.now() - args.startedAt);
  if (remaining < MIN_SEND_BUDGET_MS) return fail("no time budget for email");
  try {
    await sendMail({
      from: args.from ?? resultFromAddress(),
      to: args.to,
      subject: args.email.subject,
      text: args.email.text,
      html: args.email.html,
      timeoutMs: Math.min(SEND_TIMEOUT_MS, remaining),
    });
    return true;
  } catch (err) {
    return fail(redactAddresses(err instanceof Error ? err.message : String(err)));
  }
}

export function notifyAddress(): string {
  return process.env.NOTIFY_EMAIL?.trim() ?? "";
}
