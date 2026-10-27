import { NextRequest, NextResponse } from "next/server";
import { isPaused } from "@/app/lib/ask-summit/admin";
import { processRequest } from "@/app/lib/ask-summit/process";
import { verifyQueueSignature } from "@/app/lib/ask-summit/queue";
import { isStaleProcessing } from "@/app/lib/ask-summit/request-model";
import { claimProcessing, getAskRequest, releaseProcessing, updateAskRequest } from "@/app/lib/ask-summit/store";
import { isAskRequestId } from "@/app/lib/ask-summit/validation";
import { track } from "@/app/lib/events";
import { originFromHeaders } from "@/app/lib/report-notify";
import { redactAddresses } from "@/app/lib/tools/result-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel Pro. The stage clock budgets 290 s so the route always answers inside this. */
export const maxDuration = 300;

/**
 * The QStash target. Order: verify the signature against the raw body (503
 * with the keys unset, never processing unsigned; 401 on a bad signature),
 * parse the id, load the record, refuse a done, failed, processing or
 * paused request with a 200 so QStash never retries a handled outcome,
 * claim the lock, run the six stages, release the lock in `finally`.
 * Retries therefore only matter when the platform itself failed to run the
 * route; the lock and the state check make them harmless.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const rawBody = await req.text();
  const verdict = await verifyQueueSignature(req, rawBody);
  if (verdict === "unconfigured") {
    console.error("ask-summit process: QSTASH_CURRENT_SIGNING_KEY or QSTASH_NEXT_SIGNING_KEY is not set");
    return NextResponse.json({ error: "QStash signing keys are not set" }, { status: 503 });
  }
  if (verdict === "invalid") return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let requestId = "";
  try {
    const parsed = JSON.parse(rawBody) as { requestId?: unknown };
    if (typeof parsed.requestId === "string") requestId = parsed.requestId;
  } catch {
    requestId = "";
  }
  if (!isAskRequestId(requestId)) {
    console.error("ask-summit process: bad request id in the message");
    return NextResponse.json({ skipped: "bad id" });
  }

  const record = await getAskRequest(requestId);
  if (!record) {
    console.error(`ask-summit process: unknown request ${requestId}`);
    return NextResponse.json({ skipped: "unknown" });
  }
  if (record.state === "done" || record.state === "failed") return NextResponse.json({ skipped: record.state });
  if (record.state === "processing" && !isStaleProcessing(record, Date.now())) return NextResponse.json({ skipped: "processing" });
  if (record.dataDeleted) return NextResponse.json({ skipped: "data deleted" });
  if (await isPaused()) return NextResponse.json({ skipped: "paused" });

  if (!(await claimProcessing(requestId))) return NextResponse.json({ skipped: "locked" });
  void track("ask_processing", { requestId, attempt: record.attempts + 1 });

  const origin = originFromHeaders(req.headers);
  try {
    const outcome = await processRequest(requestId, { origin, startedAt });
    return NextResponse.json({ ok: true, state: outcome.state, stage: outcome.failedStage, timings: outcome.timings });
  } catch (err) {
    const message = redactAddresses(err instanceof Error ? err.message : String(err)).slice(0, 300);
    console.error(`ask-summit process: ${requestId} threw past the stage boundary: ${message}`);
    try {
      await updateAskRequest(requestId, { state: "failed", failedStage: "finish", failedMessage: message, finishedAt: new Date().toISOString() });
    } catch (writeErr) {
      console.error("ask-summit process: failure write failed", writeErr instanceof Error ? writeErr.message : writeErr);
    }
    return NextResponse.json({ ok: true, state: "failed", stage: "finish" });
  } finally {
    try {
      await releaseProcessing(requestId);
    } catch (err) {
      console.error("ask-summit process: lock release failed", err instanceof Error ? err.message : err);
    }
  }
}
