import { NextRequest, NextResponse, after } from "next/server";
import { isPaused } from "@/app/lib/ask-summit/admin";
import { headBlob } from "@/app/lib/ask-summit/blobs";
import {
  CONSENT_MESSAGE,
  FILE_COUNT_MESSAGE,
  FILE_SIZE_MESSAGE,
  FILE_TYPE_MESSAGE,
  GENERIC_MESSAGE,
  PAUSED_BODY,
  RATE_LIMIT_EMAIL_MESSAGE,
  RATE_LIMIT_IP_MESSAGE,
  RELOAD_MESSAGE,
  REPLAY_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
} from "@/app/lib/ask-summit/copy";
import { notifyAnthony, sendConfirmation } from "@/app/lib/ask-summit/notify";
import { enqueueProcessing } from "@/app/lib/ask-summit/queue";
import type { AskFile, AskRequestRecord } from "@/app/lib/ask-summit/request-model";
import { deleteAtFor } from "@/app/lib/ask-summit/retention";
import { AskRequestExistsError, createAskRequest, updateAskRequest } from "@/app/lib/ask-summit/store";
import {
  ACCEPTED_CONTENT_TYPES,
  FILE_NAME_MAX,
  MAX_FILES,
  MAX_FILE_BYTES,
  fileTypeFromName,
  isAskRequestId,
  isUnderPrefix,
  validateCompanyEmail,
  validateWebsiteUrl,
} from "@/app/lib/ask-summit/validation";
import { track } from "@/app/lib/events";
import { getAskEmailLimiter, getAskIpLimiter, getClientIp } from "@/app/lib/ratelimit";
import { originFromHeaders } from "@/app/lib/report-notify";
import { hashEmail } from "@/app/lib/tools/unlock-token";
import { redactAddresses } from "@/app/lib/tools/result-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_BUDGET_MS = 58_000;
const SEND_TIMEOUT_MS = 10_000;
const FIELD_MAX = 120;

type Body = {
  requestId?: unknown;
  url?: unknown;
  email?: unknown;
  name?: unknown;
  company?: unknown;
  consent?: unknown;
  nickname?: unknown;
  files?: unknown;
};

type SubmittedFile = { name: string; pathname: string; url: string };

function field(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, FIELD_MAX) : "";
}

/** The submitted file list: at most three `{ name, pathname, url }` under the request's prefix with a known extension. */
function readFiles(raw: unknown, requestId: string): { ok: true; files: SubmittedFile[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, files: [] };
  if (!Array.isArray(raw)) return { ok: false, error: UPLOAD_FAILED_MESSAGE };
  if (raw.length > MAX_FILES) return { ok: false, error: FILE_COUNT_MESSAGE };
  const files: SubmittedFile[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return { ok: false, error: UPLOAD_FAILED_MESSAGE };
    const { name, pathname, url } = item as Record<string, unknown>;
    if (typeof name !== "string" || typeof pathname !== "string" || typeof url !== "string") return { ok: false, error: UPLOAD_FAILED_MESSAGE };
    const trimmed = name.trim().slice(0, FILE_NAME_MAX);
    if (!trimmed || !fileTypeFromName(trimmed)) return { ok: false, error: FILE_TYPE_MESSAGE };
    if (!isUnderPrefix(pathname, requestId) || seen.has(pathname)) return { ok: false, error: UPLOAD_FAILED_MESSAGE };
    seen.add(pathname);
    files.push({ name: trimmed, pathname, url });
  }
  return { ok: true, files };
}

/**
 * The submission, in order: parse, honeypot, pause, validate, the two
 * limiters, blob verification through `head()` (never the client's claims
 * beyond the display name), the record under HSETNX, the QStash publish
 * (an unconfigured queue leaves `enqueueError` on the record and alerts
 * Anthony), the confirmation email, the event, the thank-you payload. Blob
 * urls and pathnames never reach the response.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Honeypot: bots fill the hidden field. Answer as if it worked, store nothing.
  if (typeof body.nickname === "string" && body.nickname.length > 0) {
    return NextResponse.json({ ok: true });
  }

  if (await isPaused()) return NextResponse.json({ error: PAUSED_BODY }, { status: 503 });

  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!isAskRequestId(requestId)) return NextResponse.json({ error: RELOAD_MESSAGE }, { status: 400 });
  const site = validateWebsiteUrl(body.url);
  if (!site.ok) return NextResponse.json({ error: site.error }, { status: 400 });
  const address = validateCompanyEmail(body.email);
  if (!address.ok) return NextResponse.json({ error: address.error }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: CONSENT_MESSAGE }, { status: 400 });
  const name = field(body.name);
  const company = field(body.company);
  const submitted = readFiles(body.files, requestId);
  if (!submitted.ok) return NextResponse.json({ error: submitted.error }, { status: 400 });
  const emailHash = hashEmail(address.email);

  const ip = getClientIp(req);
  const ipLimiter = getAskIpLimiter();
  if (ipLimiter) {
    const { success } = await ipLimiter.limit(ip);
    if (!success) return NextResponse.json({ error: RATE_LIMIT_IP_MESSAGE }, { status: 429, headers: { "Retry-After": "86400" } });
  }
  const emailLimiter = getAskEmailLimiter();
  if (emailLimiter) {
    const { success } = await emailLimiter.limit(emailHash);
    if (!success) return NextResponse.json({ error: RATE_LIMIT_EMAIL_MESSAGE }, { status: 429, headers: { "Retry-After": "86400" } });
  }

  const files: AskFile[] = [];
  for (const file of submitted.files) {
    let stored;
    try {
      stored = await headBlob(file.url);
    } catch (err) {
      console.error(`ask-summit submit: blob head failed for ${requestId}`, err instanceof Error ? err.message.slice(0, 200) : err);
      return NextResponse.json({ error: UPLOAD_FAILED_MESSAGE }, { status: 400 });
    }
    if (!stored || stored.pathname !== file.pathname || !isUnderPrefix(stored.pathname, requestId)) {
      return NextResponse.json({ error: UPLOAD_FAILED_MESSAGE }, { status: 400 });
    }
    if (stored.size < 1 || stored.size > MAX_FILE_BYTES) return NextResponse.json({ error: FILE_SIZE_MESSAGE }, { status: 400 });
    if (stored.contentType && !ACCEPTED_CONTENT_TYPES.includes(stored.contentType)) return NextResponse.json({ error: FILE_TYPE_MESSAGE }, { status: 400 });
    const type = fileTypeFromName(file.name);
    if (!type) return NextResponse.json({ error: FILE_TYPE_MESSAGE }, { status: 400 });
    files.push({ name: file.name, pathname: stored.pathname, url: file.url, size: stored.size, contentType: stored.contentType, type });
  }

  const now = new Date().toISOString();
  const record: AskRequestRecord = {
    id: requestId,
    state: "queued",
    url: site.url,
    host: site.host,
    email: address.email,
    emailHash,
    name,
    company,
    files,
    createdAt: now,
    consentAt: now,
    deleteAt: deleteAtFor(now),
    dataDeleted: false,
    dataDeletedAt: null,
    enqueuedAt: null,
    enqueueMessageId: null,
    enqueueError: null,
    attempts: 0,
    processingStartedAt: null,
    finishedAt: null,
    failedStage: null,
    failedMessage: null,
    runId: null,
    previousRunIds: [],
    reportSlug: null,
    companyName: "",
    confidence: null,
    pageCount: 0,
    docCount: 0,
    timings: null,
    extractionModel: "",
    confirmationStatus: null,
    pdfDropped: false,
  };

  const origin = originFromHeaders(req.headers);
  let enqueued = false;
  let confirmationStatus: AskRequestRecord["confirmationStatus"] = null;
  try {
    try {
      await createAskRequest(record);
    } catch (err) {
      if (err instanceof AskRequestExistsError) return NextResponse.json({ error: REPLAY_MESSAGE }, { status: 409 });
      throw err;
    }

    const enqueue = await enqueueProcessing(requestId, origin);
    if (enqueue.ok) {
      enqueued = true;
      await updateAskRequest(requestId, { enqueuedAt: new Date().toISOString(), enqueueMessageId: enqueue.messageId });
    } else {
      await updateAskRequest(requestId, { enqueueError: enqueue.error });
      const error = enqueue.error;
      after(() =>
        notifyAnthony({ kind: "stuck", requestId, host: site.host, companyName: company, message: error, queueUrl: `${origin}/admin/ask-summit` }),
      );
    }

    const remaining = ROUTE_BUDGET_MS - (Date.now() - startedAt);
    confirmationStatus = await sendConfirmation(record, { origin, timeoutMs: Math.min(SEND_TIMEOUT_MS, Math.max(1_000, remaining)) });
    await updateAskRequest(requestId, { confirmationStatus });
  } catch (err) {
    console.error(`ask-summit submit: ${requestId} failed:`, redactAddresses(err instanceof Error ? err.message : String(err)));
    return NextResponse.json({ error: GENERIC_MESSAGE }, { status: 500 });
  }

  void track("ask_submitted", { requestId, host: site.host, files: files.length, enqueued });
  return NextResponse.json({
    ok: true,
    requestId,
    site: site.host,
    files: files.map((f) => f.name),
    confirmationSent: confirmationStatus === "sent",
  });
}
