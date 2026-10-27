import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isPaused } from "@/app/lib/ask-summit/admin";
import { ALLOWED_CONTENT_TYPES, isBlobConfigured } from "@/app/lib/ask-summit/blobs";
import { FILE_COUNT_MESSAGE, FILE_TYPE_MESSAGE, PAUSED_BODY, RELOAD_MESSAGE, UPLOADS_UNCONFIGURED_MESSAGE } from "@/app/lib/ask-summit/copy";
import { incrementUploads } from "@/app/lib/ask-summit/store";
import { MAX_FILES, MAX_FILE_BYTES, fileTypeFromName, isAskRequestId, isUnderPrefix } from "@/app/lib/ask-summit/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** A client token lives this long; the browser uses it at once. */
const TOKEN_VALIDITY_MS = 15 * 60 * 1000;
const KNOWN_MESSAGES = new Set([FILE_TYPE_MESSAGE, FILE_COUNT_MESSAGE, RELOAD_MESSAGE]);

let warnedUnconfigured = false;

/**
 * The Vercel Blob client-upload token route. The browser asks for a token
 * per file; `onBeforeGenerateToken` restricts the content types, caps the
 * size at 25 MB, limits three files per request id, scopes the pathname to
 * `ask-summit/{requestId}/` and sets private access with a random suffix
 * so no pathname is guessable. The completion callback only logs; nothing
 * depends on it (it never fires on a local host).
 */
export async function POST(req: NextRequest) {
  if (await isPaused()) return NextResponse.json({ error: PAUSED_BODY }, { status: 503 });
  if (!isBlobConfigured()) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn("ask-summit uploads are off: BLOB_READ_WRITE_TOKEN is not set");
    }
    return NextResponse.json({ error: UPLOADS_UNCONFIGURED_MESSAGE }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let requestId = "";
        try {
          const payload = clientPayload ? (JSON.parse(clientPayload) as { requestId?: unknown }) : {};
          if (typeof payload.requestId === "string") requestId = payload.requestId;
        } catch {
          requestId = "";
        }
        if (!isAskRequestId(requestId)) throw new Error(RELOAD_MESSAGE);
        if (!isUnderPrefix(pathname, requestId)) throw new Error(RELOAD_MESSAGE);
        const name = pathname.slice(pathname.lastIndexOf("/") + 1);
        if (!fileTypeFromName(name)) throw new Error(FILE_TYPE_MESSAGE);
        const count = await incrementUploads(requestId);
        if (count > MAX_FILES) throw new Error(FILE_COUNT_MESSAGE);
        return {
          allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + TOKEN_VALIDITY_MS,
          tokenPayload: JSON.stringify({ requestId }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log(`ask-summit upload completed: ${blob.pathname}`);
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!KNOWN_MESSAGES.has(message)) console.error("ask-summit upload token:", message.slice(0, 200));
    return NextResponse.json({ error: KNOWN_MESSAGES.has(message) ? message : "Upload could not be authorised." }, { status: 400 });
  }
}
