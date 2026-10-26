import { NextRequest, NextResponse } from "next/server";
import { getDetailsLimiter, getClientIp } from "@/app/lib/ratelimit";
import { findAddressForHash, getCompositeRun, getToolRuns, recordEmailStatus, type CompositeRunRecord } from "@/app/lib/runs";
import { detailModel, toCompositeFullView } from "@/app/lib/tools/built-to-scale";
import { BUILT_TO_SCALE_TOOL, type CompositeFullView } from "@/app/lib/tools/built-to-scale-method";
import { renderBuiltToScaleEmail } from "@/app/lib/tools/built-to-scale-email";
import { redactAddresses } from "@/app/lib/tools/result-email";
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
import { errorResponse } from "@/app/api/tools/[tool]/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The 1b send budget: 58 s minus elapsed, capped at 10 s, skipped under 2 s. */
const ROUTE_BUDGET_MS = 58_000;
const SEND_TIMEOUT_MS = 10_000;
const MIN_SEND_BUDGET_MS = 2_000;

type Body = { runId?: unknown; token?: unknown };

/**
 * Mirrors the 1b tool details route. Order: parse, runId; verify the cookie
 * and the saved-link token (string checks only); read the composite; stored
 * early return when every child's working exists and the run is unlocked;
 * 403 when neither the record, the cookie nor the token authorises; limiter
 * under its own key; detailModel; email once when this request produced the
 * full working; respond with the full view plus `emailed`.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  if (!runId) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  const cookieUnlock = verifyUnlockCookie(req.cookies.get(UNLOCK_COOKIE)?.value);
  const linkVerified = verifySavedLinkToken(body.token, runId);

  try {
    const run = await getCompositeRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found. It may have expired." }, { status: 404 });
    }
    if (run.detailsAt && run.unlock) {
      const children = await getToolRuns(Object.values(run.children));
      return NextResponse.json({ ...toCompositeFullView(run, children), emailed: false });
    }
    if (!run.unlock && !cookieUnlock && !linkVerified) {
      return NextResponse.json({ error: "Unlock this run to see the full view." }, { status: 403 });
    }

    const ip = getClientIp(req);
    const limiter = getDetailsLimiter();
    if (limiter) {
      const { success } = await limiter.limit(`${ip}:${BUILT_TO_SCALE_TOOL}`);
      if (!success) {
        return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
      }
    }

    const result = await detailModel(runId, {
      source: "web",
      ip,
      ...(cookieUnlock ? { cookieUnlock } : {}),
      linkVerified,
    });

    // Send once per run, only when this request produced the full working
    // and no send has been attempted. A partial working (a child failed)
    // keeps detailsAt unset and sends nothing; the next open regenerates the
    // missing child and then emails.
    let emailed = false;
    if (result.generated && run.emailStatus === null && result.run.emailStatus === null) {
      emailed = await emailResult(req, result.run, result.full, startedAt);
    }
    return NextResponse.json({ ...result.full, emailed });
  } catch (err) {
    return errorResponse(err, "built-to-scale details");
  }
}

/**
 * Sends the scorecard once. Any failure is caught, logged with the hash
 * prefix (addresses redacted) and recorded on the run as `failed`; the
 * response goes out either way. Links use the request origin.
 */
async function emailResult(req: NextRequest, run: CompositeRunRecord, full: CompositeFullView, startedAt: number): Promise<boolean> {
  const emailHash = run.unlock?.emailHash ?? "";
  const hashPrefix = emailHash.slice(0, 12);
  const fail = async (reason: string) => {
    console.error(`built-to-scale details: result email failed for ${hashPrefix}: ${reason}`);
    try {
      await recordEmailStatus(run.id, "failed");
    } catch (err) {
      console.error("built-to-scale details: email status write failed", err instanceof Error ? err.message : err);
    }
    return false;
  };

  if (!run.unlock || !getUnlockSecret()) return fail("UNLOCK_SECRET is not set");

  const address = run.unlock.email || (await findAddressForHash(run.unlock.emailHash, run.id));
  if (!address) return fail("no address on record for hash");

  const savedToken = issueSavedLinkToken(run.id);
  const deleteToken = issueDeleteToken(emailHash);
  if (!savedToken || !deleteToken) return fail("could not sign links");

  const origin = req.nextUrl.origin;
  const savedUrl = `${origin}/tools/built-to-scale/r/${encodeURIComponent(run.id)}?t=${encodeURIComponent(savedToken)}`;
  const deleteUrl = `${origin}/api/tools/data/delete?e=${encodeURIComponent(emailHash)}&t=${encodeURIComponent(deleteToken)}`;

  const remaining = ROUTE_BUDGET_MS - (Date.now() - startedAt);
  if (remaining < MIN_SEND_BUDGET_MS) return fail("no time budget for email");

  const email = renderBuiltToScaleEmail({ full, savedUrl, deleteUrl });

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
    console.error("built-to-scale details: email status write failed", err instanceof Error ? err.message : err);
  }
  void track("bts_result_emailed", { runId: run.id, emailHash });
  return true;
}
