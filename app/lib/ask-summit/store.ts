/**
 * The Ask Summit request store: one Redis hash per request at `ask:{id}`
 * (no TTL), the index `ask:by-time` (score: createdAt in ms), the per-email
 * set `ask:by-email:{hash}` the delete-my-data flow reads, and the data keys
 * beside the record: `ask:{id}:pages` and `ask:{id}:docs` (strings with a
 * backstop expiry two days past `deleteAt`, under the retention cron),
 * `ask:{id}:draft` (no expiry: derived work kept with the report),
 * `ask:{id}:lock` (the processing claim, 6 minutes) and `ask:{id}:uploads`
 * (the token route's per-request file count, 1 hour).
 *
 * Serialisation follows runs.ts: nested values as JSON strings, null as the
 * string "null", booleans as "true"/"false", numbers as themselves;
 * `readAskRequestHash` in the pure model reads both Upstash shapes.
 */
import { getRedis } from "../redis.ts";
import {
  readAskRequestHash,
  type AskDocEntry,
  type AskDraft,
  type AskRequestRecord,
  type AskRequestState,
} from "./request-model.ts";
import { isAskRequestId } from "./validation.ts";
import type { CrawlStore, CrawledPage } from "./crawl-rules.ts";

export const ASK_INDEX_KEY = "ask:by-time";
const LOCK_TTL_SECONDS = 360;
const UPLOADS_TTL_SECONDS = 3600;
const DATA_BACKSTOP_MS = 2 * 24 * 60 * 60 * 1000;

export class AskRequestExistsError extends Error {
  constructor(id: string) {
    super(`request already exists: ${id}`);
    this.name = "AskRequestExistsError";
  }
}

export function askKey(id: string): string {
  return `ask:${id}`;
}

export function askEmailIndexKey(emailHash: string): string {
  return `ask:by-email:${emailHash}`;
}

export function pagesKey(id: string): string {
  return `ask:${id}:pages`;
}

export function docsKey(id: string): string {
  return `ask:${id}:docs`;
}

export function draftKey(id: string): string {
  return `ask:${id}:draft`;
}

export function lockKey(id: string): string {
  return `ask:${id}:lock`;
}

export function uploadsKey(id: string): string {
  return `ask:${id}:uploads`;
}

const JSON_FIELDS = new Set(["files", "previousRunIds", "confidence", "timings"]);

function serialise(patch: object): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(patch) as Array<[string, unknown]>) {
    if (value === undefined) continue;
    if (JSON_FIELDS.has(key) || (typeof value === "object" && value !== null)) {
      out[key] = JSON.stringify(value);
    } else if (value === null) {
      out[key] = "null";
    } else if (typeof value === "boolean") {
      out[key] = String(value);
    } else {
      out[key] = value as string | number;
    }
  }
  return out;
}

/**
 * HSETNX `id` claims the key; a 0 reply throws AskRequestExistsError and
 * nothing else is written. Then HSET the rest, ZADD the time index and
 * SADD the per-email set.
 */
export async function createAskRequest(record: AskRequestRecord): Promise<void> {
  const redis = getRedis();
  const key = askKey(record.id);
  const claimed = await redis.hsetnx(key, "id", record.id);
  if (claimed === 0) throw new AskRequestExistsError(record.id);
  const { id: _id, ...rest } = record;
  await redis.hset(key, serialise(rest));
  const pipeline = redis.pipeline();
  pipeline.zadd(ASK_INDEX_KEY, { score: Date.parse(record.createdAt) || Date.now(), member: record.id });
  pipeline.sadd(askEmailIndexKey(record.emailHash), record.id);
  await pipeline.exec();
}

/** Null for a bad id, an empty hash or a malformed one. */
export async function getAskRequest(id: string): Promise<AskRequestRecord | null> {
  if (!isAskRequestId(id)) return null;
  const hash = await getRedis().hgetall<Record<string, unknown>>(askKey(id));
  if (!hash || Object.keys(hash).length === 0) return null;
  return readAskRequestHash(hash);
}

export type AskRequestPatch = Partial<Omit<AskRequestRecord, "id">>;

export async function updateAskRequest(id: string, patch: AskRequestPatch): Promise<void> {
  const fields = serialise(patch);
  if (Object.keys(fields).length === 0) return;
  await getRedis().hset(askKey(id), fields);
}

export interface ListAskRequestsOptions {
  limit: number;
  offset?: number;
  state?: AskRequestState;
}

/** Newest first; members whose hash is gone are pruned from the index, best effort. */
export async function listAskRequests(opts: ListAskRequestsOptions): Promise<{ requests: AskRequestRecord[]; total: number }> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(ASK_INDEX_KEY, 0, -1, { rev: true });
  const requests: AskRequestRecord[] = [];
  const stale: string[] = [];
  const offset = opts.offset ?? 0;
  let matched = 0;
  const batchSize = 100;

  for (let i = 0; i < ids.length && requests.length < opts.limit; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const pipeline = redis.pipeline();
    for (const id of batch) pipeline.hgetall(askKey(id));
    const hashes = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
    hashes.forEach((hash, j) => {
      const record = hash && Object.keys(hash).length > 0 ? readAskRequestHash(hash) : null;
      if (!record) {
        stale.push(batch[j]);
        return;
      }
      if (opts.state && record.state !== opts.state) return;
      if (matched >= offset && requests.length < opts.limit) requests.push(record);
      matched += 1;
    });
  }

  if (stale.length > 0) {
    try {
      await redis.zrem(ASK_INDEX_KEY, ...stale);
    } catch {
      // pruning is best effort
    }
  }
  return { requests, total: ids.length - stale.length };
}

export async function listAskRequestIds(): Promise<string[]> {
  return getRedis().zrange<string[]>(ASK_INDEX_KEY, 0, -1, { rev: true });
}

export async function countAskRequestsByState(): Promise<Record<AskRequestState, number>> {
  const counts: Record<AskRequestState, number> = { queued: 0, processing: 0, done: 0, failed: 0 };
  const { requests } = await listAskRequests({ limit: 10_000 });
  for (const r of requests) counts[r.state] += 1;
  return counts;
}

/**
 * SET NX the lock for 6 minutes (longer than maxDuration, so a killed
 * function's lock expires on its own), then HSET the state and the start
 * and HINCRBY the attempt counter. False when the lock is held. A rerun
 * passes `countAttempt: false` so the queue's Attempts column stays the
 * processing count.
 */
export async function claimProcessing(id: string, opts: { countAttempt?: boolean } = {}): Promise<boolean> {
  const redis = getRedis();
  const claimed = await redis.set(lockKey(id), "1", { nx: true, ex: LOCK_TTL_SECONDS });
  if (claimed !== "OK") return false;
  const pipeline = redis.pipeline();
  pipeline.hset(askKey(id), serialise({ state: "processing", processingStartedAt: new Date().toISOString() }));
  if (opts.countAttempt !== false) pipeline.hincrby(askKey(id), "attempts", 1);
  await pipeline.exec();
  return true;
}

export async function releaseProcessing(id: string): Promise<void> {
  await getRedis().del(lockKey(id));
}

/**
 * EXPIREAT for the pages and docs keys: `deleteAt` plus two days. The cron
 * is the mechanism; the backstop means a cron that is never configured
 * still cannot keep crawled text past 32 days, and the two day gap lets
 * the cron mark the record `dataDeleted` first in the normal case.
 */
function backstopSeconds(deleteAtIso: string): number {
  const t = Date.parse(deleteAtIso);
  const base = Number.isFinite(t) ? t : Date.now();
  return Math.floor((base + DATA_BACKSTOP_MS) / 1000);
}

/**
 * The whole crawl store as one string, up to 1.5 MB of JSON. Upstash caps
 * a request by plan (1 MB on the free tier), so a large site fails here
 * with a clear message; lowering CRAWL_TEXT_CAP is the lever.
 */
export async function savePages(id: string, store: CrawlStore, deleteAtIso: string): Promise<void> {
  await getRedis().set(pagesKey(id), JSON.stringify(store), { exat: backstopSeconds(deleteAtIso) });
}

function parseStored<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw as T;
}

/** `withText: false` strips `text` from each page for the editor. */
export async function getPages(id: string, opts: { withText: boolean }): Promise<CrawlStore | null> {
  const store = parseStored<CrawlStore>(await getRedis().get(pagesKey(id)));
  if (!store || !Array.isArray(store.pages)) return null;
  if (opts.withText) return store;
  const pages = store.pages.map((page) => {
    const { text: _text, ...rest } = page as CrawledPage;
    return { ...rest, text: "" };
  });
  return { ...store, pages };
}

export async function saveDocs(id: string, docs: { files: AskDocEntry[] }, deleteAtIso: string): Promise<void> {
  await getRedis().set(docsKey(id), JSON.stringify(docs), { exat: backstopSeconds(deleteAtIso) });
}

export async function getDocs(id: string): Promise<{ files: AskDocEntry[] } | null> {
  const docs = parseStored<{ files: AskDocEntry[] }>(await getRedis().get(docsKey(id)));
  return docs && Array.isArray(docs.files) ? docs : null;
}

export async function saveDraft(id: string, draft: AskDraft): Promise<void> {
  await getRedis().set(draftKey(id), JSON.stringify(draft));
}

export async function getDraft(id: string): Promise<AskDraft | null> {
  const draft = parseStored<AskDraft>(await getRedis().get(draftKey(id)));
  return draft && typeof draft.parts === "object" && draft.parts !== null ? draft : null;
}

/** The Redis half of retention and the admin delete: DEL pages and docs, mark the record. Blobs go through blobs.ts first. */
export async function deleteRequestData(id: string): Promise<void> {
  const pipeline = getRedis().pipeline();
  pipeline.del(pagesKey(id));
  pipeline.del(docsKey(id));
  pipeline.hset(askKey(id), serialise({ dataDeleted: true, dataDeletedAt: new Date().toISOString() }));
  await pipeline.exec();
}

/** The records under one email hash, for the delete flow to collect their blob urls before the store removes them. */
export async function listAskRequestsByEmail(emailHash: string): Promise<AskRequestRecord[]> {
  const redis = getRedis();
  const ids = await redis.smembers(askEmailIndexKey(emailHash));
  if (ids.length === 0) return [];
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.hgetall(askKey(id));
  const hashes = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
  const records: AskRequestRecord[] = [];
  hashes.forEach((hash) => {
    const record = hash && Object.keys(hash).length > 0 ? readAskRequestHash(hash) : null;
    if (record) records.push(record);
  });
  return records;
}

/**
 * Removes every request under the hash: the record, its pages, docs, draft
 * and lock, its entry in `ask:by-time`, and the set itself. Returns the
 * ids whose record existed.
 */
export async function deleteAskRequestsByEmail(emailHash: string): Promise<string[]> {
  const redis = getRedis();
  const indexKey = askEmailIndexKey(emailHash);
  const ids = (await redis.smembers(indexKey)).filter((id) => isAskRequestId(id));
  if (ids.length === 0) {
    await redis.del(indexKey);
    return [];
  }
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.del(askKey(id));
  for (const id of ids) pipeline.del(pagesKey(id), docsKey(id), draftKey(id), lockKey(id), uploadsKey(id));
  pipeline.zrem(ASK_INDEX_KEY, ...ids);
  pipeline.del(indexKey);
  const replies = (await pipeline.exec()) as unknown[];
  const deleted: string[] = [];
  ids.forEach((id, i) => {
    if (Number(replies[i] ?? 0) > 0) deleted.push(id);
  });
  return deleted;
}

/** INCR the per-request upload count with a one hour expiry; returns the new count. */
export async function incrementUploads(id: string): Promise<number> {
  const redis = getRedis();
  const count = await redis.incr(uploadsKey(id));
  if (count === 1) await redis.expire(uploadsKey(id), UPLOADS_TTL_SECONDS);
  return count;
}

/** True when `ask:{id}` exists, for the orphan sweep. */
export async function askRequestExists(id: string): Promise<boolean> {
  return (await getRedis().exists(askKey(id))) > 0;
}
