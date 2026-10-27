import { NextRequest, NextResponse } from "next/server";
import { deleteBlobs, isBlobConfigured, listBlobs } from "@/app/lib/ask-summit/blobs";
import { isDue, isOrphanCandidate, requestIdFromPathname } from "@/app/lib/ask-summit/retention";
import { askRequestExists, deleteRequestData, getAskRequest, listAskRequestIds } from "@/app/lib/ask-summit/store";
import { track } from "@/app/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** At most this many blobs are scanned per run so the sweep stays inside maxDuration. */
const SWEEP_LIMIT = 1000;
const SWEEP_PREFIX = "ask-summit/";

/**
 * The daily retention cron (01:30 UTC): for every request past `deleteAt`
 * and not yet cleared, delete its blobs, its pages and its docs and mark
 * the record `dataDeleted`; then sweep the Blob store for orphans (uploads
 * at least 48 hours old whose request never arrived, and blobs a request
 * already marked deleted still holds). Authorised by CRON_SECRET as the
 * daily report is.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = Date.now();
  let deleted = 0;
  let orphans = 0;
  let scanned = 0;

  try {
    const ids = await listAskRequestIds();
    for (const id of ids) {
      const record = await getAskRequest(id);
      if (!record || record.dataDeleted || !isDue(record.deleteAt, now)) continue;
      try {
        await deleteBlobs(record.files.map((f) => f.url));
      } catch (err) {
        console.error(`ask-summit retention: blob delete failed for ${id}`, err instanceof Error ? err.message.slice(0, 200) : err);
      }
      await deleteRequestData(id);
      void track("ask_data_deleted", { requestId: id, reason: "retention" });
      deleted += 1;
    }
  } catch (err) {
    console.error("ask-summit retention: Redis failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Redis unavailable" }, { status: 500 });
  }

  if (isBlobConfigured()) {
    try {
      const known = new Map<string, boolean>();
      let cursor: string | null = null;
      do {
        const page = await listBlobs(SWEEP_PREFIX, cursor, Math.min(SWEEP_LIMIT - scanned, 1000));
        for (const blob of page.blobs) {
          scanned += 1;
          const id = requestIdFromPathname(blob.pathname);
          let remove = false;
          if (!id) {
            remove = isOrphanCandidate(blob.uploadedAt, now);
          } else {
            if (!known.has(id)) {
              // Live means a readable record not yet marked deleted; a key
              // that exists but will not read is left alone.
              const record = await getAskRequest(id);
              known.set(id, record ? !record.dataDeleted : await askRequestExists(id));
            }
            const live = known.get(id) === true;
            remove = !live && isOrphanCandidate(blob.uploadedAt, now);
          }
          if (remove) {
            try {
              await deleteBlobs([blob.url]);
              orphans += 1;
            } catch (err) {
              console.error(`ask-summit retention: orphan delete failed for ${blob.pathname}`, err instanceof Error ? err.message.slice(0, 200) : err);
            }
          }
        }
        cursor = page.hasMore && scanned < SWEEP_LIMIT ? page.cursor : null;
      } while (cursor);
    } catch (err) {
      console.error("ask-summit retention: blob sweep failed", err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }

  return NextResponse.json({ ok: true, deleted, orphans, scanned });
}
