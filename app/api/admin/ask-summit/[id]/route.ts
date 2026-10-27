import { NextRequest, NextResponse } from "next/server";
import { deleteBlobs } from "@/app/lib/ask-summit/blobs";
import { enqueueProcessing } from "@/app/lib/ask-summit/queue";
import { isStaleProcessing } from "@/app/lib/ask-summit/request-model";
import { deleteRequestData, getAskRequest, releaseProcessing, updateAskRequest } from "@/app/lib/ask-summit/store";
import { isAskRequestId } from "@/app/lib/ask-summit/validation";
import { validateSession } from "@/app/lib/auth";
import { track } from "@/app/lib/events";
import { originFromHeaders } from "@/app/lib/report-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Per-request controls on the queue. `action=process` re-queues a queued,
 * failed or stale request (clearing the failure and the stale lock) and
 * publishes to QStash; `action=delete` removes the blobs, the pages and the
 * docs and marks the record, keeping the request, the draft, the run and
 * the report.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  if (!isAskRequestId(id)) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  const redirectTo = (query: string) => NextResponse.redirect(new URL(`/admin/ask-summit?${query}`, req.url), 303);

  let action = "";
  try {
    const form = await req.formData();
    const value = form.get("action");
    if (typeof value === "string") action = value;
  } catch {
    action = "";
  }

  try {
    const record = await getAskRequest(id);
    if (!record) return redirectTo("error=not-found");

    if (action === "process") {
      const stale = isStaleProcessing(record, Date.now());
      const allowed = !record.dataDeleted && (record.state === "queued" || record.state === "failed" || stale);
      if (!allowed) return redirectTo("error=not-queued");
      if (stale) await releaseProcessing(id);
      await updateAskRequest(id, { state: "queued", failedStage: null, failedMessage: null, enqueueError: null });
      const enqueue = await enqueueProcessing(id, originFromHeaders(req.headers));
      if (!enqueue.ok) {
        await updateAskRequest(id, { enqueueError: enqueue.error });
        return redirectTo("error=enqueue-failed");
      }
      await updateAskRequest(id, { enqueuedAt: new Date().toISOString(), enqueueMessageId: enqueue.messageId });
      return redirectTo("status=enqueued");
    }

    if (action === "delete") {
      try {
        await deleteBlobs(record.files.map((f) => f.url));
      } catch (err) {
        console.error(`admin ask-summit delete: blob delete failed for ${id}`, err instanceof Error ? err.message.slice(0, 200) : err);
      }
      await deleteRequestData(id);
      void track("ask_data_deleted", { requestId: id, reason: "admin" });
      return redirectTo("status=data-deleted");
    }

    return redirectTo("error=failed");
  } catch (err) {
    console.error(`admin ask-summit ${action} ${id}`, err instanceof Error ? err.message : err);
    return redirectTo("error=failed");
  }
}
