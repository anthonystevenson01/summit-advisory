/**
 * The only server file that imports `@vercel/blob`: metadata, bytes,
 * deletion and the listing the orphan sweep reads. Every call reads
 * BLOB_READ_WRITE_TOKEN from the environment itself; no url, token or
 * downloadUrl leaves this module except to the processing function and the
 * store. Private access throughout: a blob url is not readable without the
 * token.
 */
import { BlobNotFoundError, del, get, head, list } from "@vercel/blob";
import { ACCEPTED_CONTENT_TYPES } from "./validation.ts";

export const ALLOWED_CONTENT_TYPES: readonly string[] = ACCEPTED_CONTENT_TYPES;

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export interface BlobHead {
  pathname: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

/** The blob's stored metadata, or null when the store has no such blob. */
export async function headBlob(url: string): Promise<BlobHead | null> {
  try {
    const result = await head(url);
    return { pathname: result.pathname, size: result.size, contentType: result.contentType, uploadedAt: result.uploadedAt.toISOString() };
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

/** The blob's bytes through the SDK's private read. Throws when the blob is missing or the read is aborted. */
export async function readBlob(url: string, opts: { signal?: AbortSignal } = {}): Promise<Uint8Array> {
  const result = await get(url, { access: "private", abortSignal: opts.signal });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error("blob not found");
  const buffer = await new Response(result.stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function deleteBlobs(urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return;
  await del([...urls]);
}

export interface BlobListing {
  blobs: Array<{ url: string; pathname: string; size: number; uploadedAt: string }>;
  cursor: string | null;
  hasMore: boolean;
}

export async function listBlobs(prefix: string, cursor?: string | null, limit = 1000): Promise<BlobListing> {
  const result = await list({ prefix, cursor: cursor ?? undefined, limit });
  return {
    blobs: result.blobs.map((b) => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt.toISOString() })),
    cursor: result.cursor ?? null,
    hasMore: result.hasMore,
  };
}
