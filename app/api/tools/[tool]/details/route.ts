import { NextRequest, NextResponse } from "next/server";
import { getDetailsLimiter, getClientIp } from "@/app/lib/ratelimit";
import { getTool, isToolPublic } from "@/app/lib/tools/registry";
import { getRun, getRuns, listRunIdsByEmail, recordEmailStatus, type RunRecord } from "@/app/lib/runs";
import { detailRun, toFullView, type FullView } from "@/app/lib/tools/pipeline";
import { redactAddresses, renderResultEmail } from "@/app/lib/tools/result-email";
import { resultFromAddress, sendMail } from "@/app/lib/mail";
import { track } from "@/app/lib/events";
import {
  UNLOCK_COOKIE,
  getUnlockSecret,
  issueDeleteToken,
  issueSavedLinkToken,
  verifySavedLinkToken,
  verifyUnlockCookie,
} from "@/app/lib/unlock";
import { errorResponse } from "../errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Time budget for the email send inside `maxDuration = 60`. The send starts
 * only after the full view is computed and persisted, so the model call's
 * worst case (about 55 s) has already been spent by then; the transport gets
 * whatever is left of 58 s, capped at 10 s, and is skipped under 2 s. The
 * visitor gets the full view either way; a skipped send is recorded as
 * `failed`. The clock starts at the top of the handler, not after detailRun.
 */
const ROUTE_BUDGET_MS = 58_000;
const SEND_TIMEOUT_MS = 10_000;
const MIN_SEND_BUDGET_MS = 2_000;

type Body = { runId?: unknown; token?: unknown };

/**
 * Order: parse, slug, runId; verify the cookie and the saved-link token (plain
 * string checks, no Redis, so a bad token costs nothing); read the run;
 * stored early return (a re-open is free and served before the limiter, as
 * in 1a); 403 when neither the record, the cookie nor the token authorises;
 * limiter; detailRun (which records a cookie unlock on the run and generates
 * the details); email once; respond with the full view plus `emailed`.
 *
 * The route only verifies and passes claims in. Recording the cookie unlock
 * happens inside detailRun because the pipeline already owns the run write
 * and every caller (including the calibration script) then gets one rule.
 * The email is sent here and not in the pipeline so the pipeline stays free
 * of transport concerns and calibration never emails anyone.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const startedAt = Date.now();
  const { tool } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isToolPublic(tool)) {
    return NextResponse.json({ error: "This tool is not available." }, { status: 404 });
  }
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  if (!runId) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  const cookieUnlock = verifyUnlockCookie(req.cookies.get(UNLOCK_COOKIE)?.value);
  const linkVerified = verifySavedLinkToken(body.token, runId);

  try {
    const run = await getRun(runId);
    if (!run || run.tool !== tool) {
      return NextResponse.json({ error: "Run not found. It may have expired." }, { status: 404 });
    }
    // Re-opening a run that already has details is free: served before the limiter.
    if (run.detailsAt && run.unlock) {
      return NextResponse.json({ ...toFullView(run), emailed: false });
    }
    if (!run.unlock && !cookieUnlock && !linkVerified) {
      return NextResponse.json({ error: "Unlock this run to see the full view." }, { status: 403 });
    }

    const ip = getClientIp(req);
    const limiter = getDetailsLimiter();
    if (limiter) {
      const { success } = await limiter.limit(`${ip}:${tool}`);
      if (!success) {
        return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
      }
    }

    const result = await detailRun(runId, {
      source: "web",
      ip,
      ...(cookieUnlock ? { cookieUnlock } : {}),
      linkVerified,
    });

    // Send once per run: only the request that generated the details sends,
    // and only when no send has been attempted (checked on the record read
    // above and on the record detailRun returned). A second request hits the
    // stored early return and never gets here; a `failed` status is final in
    // this release, there is no resend path. Two concurrent first requests
    // could both generate and both send; that race already exists for the
    // model call and is accepted.
    let emailed = false;
    if (result.generated && run.emailStatus === null && result.run.emailStatus === null) {
      emailed = await emailResult(req, tool, result.run, result.full, startedAt);
    }
    return NextResponse.json({ ...result.full, emailed });
  } catch (err) {
    return errorResponse(err, `${tool} details`);
  }
}

/**
 * Sends the full result once. Sending happens after the full view is
 * persisted so a failed or slow send can never cost the visitor the result:
 * any failure is caught, logged with the hash prefix (never the address;
 * transport errors go through redactAddresses) and recorded on the run as
 * `failed`; the response goes out either way. Links use the request origin
 * rather than the canonical host so a preview deployment emails links to
 * itself, where the run actually lives.
 */
async function emailResult(req: NextRequest, tool: string, run: RunRecord, full: FullView, startedAt: number): Promise<boolean> {
  const emailHash = run.unlock?.emailHash ?? "";
  const hashPrefix = emailHash.slice(0, 12);
  const fail = async (reason: string) => {
    console.error(`${tool} details: result email failed for ${hashPrefix}: ${reason}`);
    try {
      await recordEmailStatus(run.id, "failed");
    } catch (err) {
      console.error(`${tool} details: email status write failed`, err instanceof Error ? err.message : err);
    }
    return false;
  };

  if (!run.unlock || !getUnlockSecret()) return fail("UNLOCK_SECRET is not set");

  const address = await resolveAddress(run);
  if (!address) return fail("no address on record for hash");

  const entry = getTool(tool);
  if (!entry) return fail("tool not in registry");

  const savedToken = issueSavedLinkToken(run.id);
  const deleteToken = issueDeleteToken(emailHash);
  if (!savedToken || !deleteToken) return fail("could not sign links");

  const origin = req.nextUrl.origin;
  const savedUrl = `${origin}/tools/${entry.slug}?run=${encodeURIComponent(run.id)}&t=${encodeURIComponent(savedToken)}`;
  const deleteUrl = `${origin}/api/tools/data/delete?e=${encodeURIComponent(emailHash)}&t=${encodeURIComponent(deleteToken)}`;

  const remaining = ROUTE_BUDGET_MS - (Date.now() - startedAt);
  if (remaining < MIN_SEND_BUDGET_MS) return fail("no time budget for email");

  const email = renderResultEmail({
    toolName: entry.name,
    toolNumber: entry.number,
    full,
    dimensions: entry.dimensions,
    extrasMeta: entry.extras,
    savedUrl,
    deleteUrl,
  });

  try {
    await sendMail({
      from: resultFromAddress(),
      to: address,
      subject: email.subject,
      text: email.text,
      html: email.html,
      timeoutMs: Math.min(SEND_TIMEOUT_MS, remaining),
    });
  } catch (err) {
    return fail(redactAddresses(err instanceof Error ? err.message : String(err)));
  }

  try {
    await recordEmailStatus(run.id, "sent");
  } catch (err) {
    console.error(`${tool} details: email status write failed`, err instanceof Error ? err.message : err);
  }
  void track("result_emailed", { tool, runId: run.id, emailHash });
  return true;
}

/**
 * The address for a form unlock is on the run. A cookie unlock stores the
 * hash only, so the address comes from the newest sibling run under the
 * same hash that carries one. Null when nothing is on record.
 */
async function resolveAddress(run: RunRecord): Promise<string | null> {
  if (!run.unlock) return null;
  if (run.unlock.email) return run.unlock.email;
  const ids = await listRunIdsByEmail(run.unlock.emailHash);
  const siblings = await getRuns(ids.filter((id) => id !== run.id));
  siblings.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const withAddress = siblings.find((r) => r.unlock?.email);
  return withAddress?.unlock?.email ?? null;
}
