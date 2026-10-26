/**
 * The brief store: every Project Builder brief as a Redis hash at
 * `brief:{id}`, the index sorted set `briefs:by-updated` (score: updatedAt
 * in ms), the per-email set `briefs:by-email:{emailHash}` that the link
 * request and the delete flow read, and the pasted text at
 * `brief-source:{id}` with its own 90 day TTL.
 *
 * TTL rule: a draft expires 183 days after its last update (set on create
 * and refreshed by every write that moves `updatedAt`); a submit PERSISTs
 * the hash; an unlock back to draft sets the TTL again. The index does not
 * expire with the hash: `listBriefs` prunes ids whose hash is gone. The
 * source text keeps its 90 day TTL whatever the status, which is the
 * promise the paste box makes.
 *
 * Ids are `brief_` plus 16 lowercase hex, so a brief id never matches the
 * run id pattern and the two stores cannot be confused. The serialise and
 * parse helpers follow runs.ts: nested values as JSON strings, null as the
 * string "null", both read shapes accepted.
 */
import { randomUUID } from "node:crypto";
import { getRedis } from "./redis.ts";
import {
  BRIEF_DRAFT_TTL_SECONDS,
  BRIEF_SOURCE_TTL_SECONDS,
  SOURCE_MAX_CHARS,
  isBriefId,
  isBriefStatus,
  parseBriefState,
  type BriefState,
  type BriefStatus,
} from "./project-builder/brief.ts";

export interface BriefContact {
  name: string;
  email: string;
  emailHash: string;
  company: string;
  website: string;
  marketing: boolean;
}

export type NotionStatus = "ok" | "failed" | null;
export type BriefEmailStatus = "sent" | "failed" | null;

export interface BriefRecord {
  id: string;
  createdAt: string;
  savedAt: string;
  submittedAt: string | null;
  updatedAt: string;
  lastRemindedAt: string | null;
  status: BriefStatus;
  state: BriefState;
  contact: BriefContact;
  /** The `?src=` tag; "" when none. */
  sourceTag: string;
  notionPageId: string | null;
  notionStatus: NotionStatus;
  suggestCount: number;
  ideasCount: number;
  readCount: number;
  lastEmailStatus: BriefEmailStatus;
  firstStatusChangeAt: string | null;
  changeRequestedAt: string | null;
  changeRequest: string;
}

export const BRIEF_INDEX_KEY = "briefs:by-updated";

export function briefKey(id: string): string {
  return `brief:${id}`;
}

export function briefSourceKey(id: string): string {
  return `brief-source:${id}`;
}

export function briefEmailIndexKey(emailHash: string): string {
  return `briefs:by-email:${emailHash}`;
}

export function newBriefId(): string {
  return `brief_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

const JSON_FIELDS = new Set(["state", "contact"]);
const NUMERIC_FIELDS = new Set(["suggestCount", "ideasCount", "readCount"]);

function serialise(patch: object): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(patch) as Array<[string, unknown]>) {
    if (value === undefined) continue;
    if (JSON_FIELDS.has(key) || (typeof value === "object" && value !== null)) out[key] = JSON.stringify(value);
    else if (value === null) out[key] = "null";
    else if (typeof value === "boolean") out[key] = String(value);
    else out[key] = value as string | number;
  }
  return out;
}

function parseValue(key: string, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  if (raw === "null") return null;
  if (JSON_FIELDS.has(key) || NUMERIC_FIELDS.has(key)) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function deserialise(hash: Record<string, unknown>): BriefRecord {
  const r: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(hash)) r[key] = parseValue(key, raw);
  const contactRaw = (r.contact && typeof r.contact === "object" ? r.contact : {}) as Partial<BriefContact>;
  let state: BriefState;
  try {
    state = parseBriefState(r.state);
  } catch {
    state = parseBriefState({});
  }
  return {
    id: String(r.id ?? ""),
    createdAt: String(r.createdAt ?? ""),
    savedAt: String(r.savedAt ?? r.createdAt ?? ""),
    submittedAt: nullableString(r.submittedAt),
    updatedAt: String(r.updatedAt ?? r.createdAt ?? ""),
    lastRemindedAt: nullableString(r.lastRemindedAt),
    status: isBriefStatus(r.status) ? r.status : "draft",
    state,
    contact: {
      name: String(contactRaw.name ?? ""),
      email: String(contactRaw.email ?? ""),
      emailHash: String(contactRaw.emailHash ?? ""),
      company: String(contactRaw.company ?? ""),
      website: String(contactRaw.website ?? ""),
      marketing: contactRaw.marketing === true,
    },
    sourceTag: typeof r.sourceTag === "string" ? r.sourceTag : "",
    notionPageId: nullableString(r.notionPageId),
    notionStatus: r.notionStatus === "ok" || r.notionStatus === "failed" ? r.notionStatus : null,
    suggestCount: Number(r.suggestCount ?? 0) || 0,
    ideasCount: Number(r.ideasCount ?? 0) || 0,
    readCount: Number(r.readCount ?? 0) || 0,
    lastEmailStatus: r.lastEmailStatus === "sent" || r.lastEmailStatus === "failed" ? r.lastEmailStatus : null,
    firstStatusChangeAt: nullableString(r.firstStatusChangeAt),
    changeRequestedAt: nullableString(r.changeRequestedAt),
    changeRequest: typeof r.changeRequest === "string" ? r.changeRequest : "",
  };
}

export interface CreateBriefArgs {
  state: BriefState;
  source: string;
  contact: BriefContact;
  sourceTag: string;
}

/** HSET, the draft TTL, ZADD into the index, SADD into the email set, and the source with its own TTL when non empty. */
export async function createBrief(args: CreateBriefArgs): Promise<BriefRecord> {
  const now = new Date().toISOString();
  const record: BriefRecord = {
    id: newBriefId(),
    createdAt: now,
    savedAt: now,
    submittedAt: null,
    updatedAt: now,
    lastRemindedAt: null,
    status: "draft",
    state: args.state,
    contact: args.contact,
    sourceTag: args.sourceTag,
    notionPageId: null,
    notionStatus: null,
    suggestCount: 0,
    ideasCount: 0,
    readCount: 0,
    lastEmailStatus: null,
    firstStatusChangeAt: null,
    changeRequestedAt: null,
    changeRequest: "",
  };
  const redis = getRedis();
  const key = briefKey(record.id);
  const pipeline = redis.pipeline();
  pipeline.hset(key, serialise(record));
  pipeline.expire(key, BRIEF_DRAFT_TTL_SECONDS);
  pipeline.zadd(BRIEF_INDEX_KEY, { score: Date.parse(now), member: record.id });
  pipeline.sadd(briefEmailIndexKey(args.contact.emailHash), record.id);
  const source = args.source.slice(0, SOURCE_MAX_CHARS);
  if (source.trim()) pipeline.set(briefSourceKey(record.id), source, { ex: BRIEF_SOURCE_TTL_SECONDS });
  await pipeline.exec();
  return record;
}

export async function getBrief(id: string): Promise<BriefRecord | null> {
  if (!isBriefId(id)) return null;
  const hash = await getRedis().hgetall<Record<string, unknown>>(briefKey(id));
  if (!hash || Object.keys(hash).length === 0) return null;
  return deserialise(hash);
}

/** One pipelined read; ids whose hash is gone are dropped. Order follows `ids`. */
export async function getBriefs(ids: string[]): Promise<BriefRecord[]> {
  const valid = ids.filter((id) => isBriefId(id));
  if (valid.length === 0) return [];
  const pipeline = getRedis().pipeline();
  for (const id of valid) pipeline.hgetall(briefKey(id));
  const hashes = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
  const out: BriefRecord[] = [];
  for (const hash of hashes) if (hash && Object.keys(hash).length > 0) out.push(deserialise(hash));
  return out;
}

export async function getBriefSource(id: string): Promise<string | null> {
  if (!isBriefId(id)) return null;
  const value = await getRedis().get<string>(briefSourceKey(id));
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * HSET the serialised patch. When the patch carries `updatedAt` and the
 * record is a draft, the TTL is refreshed and the index score moved.
 */
export async function updateBrief(id: string, patch: Partial<BriefRecord>): Promise<void> {
  const fields = serialise(patch);
  if (Object.keys(fields).length === 0) return;
  const redis = getRedis();
  const key = briefKey(id);
  await redis.hset(key, fields);
  if (typeof patch.updatedAt === "string") {
    const status = patch.status ?? (await redis.hget<string>(key, "status")) ?? "draft";
    if (status === "draft") await redis.expire(key, BRIEF_DRAFT_TTL_SECONDS);
    await redis.zadd(BRIEF_INDEX_KEY, { score: Date.parse(patch.updatedAt) || Date.now(), member: id });
  }
}

/**
 * The autosave: the state, the source when given, the contact when given,
 * `updatedAt`, the TTL and the index. When the contact's hash changes the
 * email set is re-indexed. Returns the new `updatedAt`.
 */
export async function saveBriefState(id: string, state: BriefState, source?: string, contact?: BriefContact): Promise<string> {
  const redis = getRedis();
  const key = briefKey(id);
  const now = new Date().toISOString();
  const patch: Partial<BriefRecord> = { state, updatedAt: now };
  if (contact) {
    const previousHash = await redis.hget<string>(key, "contact");
    const previous = (typeof previousHash === "string" ? (JSON.parse(previousHash) as Partial<BriefContact>) : (previousHash as Partial<BriefContact> | null)) ?? {};
    if (previous.emailHash && previous.emailHash !== contact.emailHash) {
      await redis.srem(briefEmailIndexKey(previous.emailHash), id);
    }
    await redis.sadd(briefEmailIndexKey(contact.emailHash), id);
    patch.contact = contact;
  }
  await updateBrief(id, patch);
  if (typeof source === "string" && source.trim()) {
    await redis.set(briefSourceKey(id), source.slice(0, SOURCE_MAX_CHARS), { ex: BRIEF_SOURCE_TTL_SECONDS });
  }
  return now;
}

/**
 * Moves the status: `submittedAt` and PERSIST on `submitted`; the TTL back
 * on `draft`; `firstStatusChangeAt` on the first admin change after a
 * submit. Returns the updated record.
 */
export async function setBriefStatus(id: string, status: BriefStatus, by: "prospect" | "admin"): Promise<BriefRecord | null> {
  const redis = getRedis();
  const key = briefKey(id);
  const current = await getBrief(id);
  if (!current) return null;
  const now = new Date().toISOString();
  const patch: Partial<BriefRecord> = { status, updatedAt: now };
  if (status === "submitted") patch.submittedAt = now;
  if (by === "admin" && current.firstStatusChangeAt === null && current.submittedAt) patch.firstStatusChangeAt = now;
  await redis.hset(key, serialise(patch));
  if (status === "draft") await redis.expire(key, BRIEF_DRAFT_TTL_SECONDS);
  else await redis.persist(key);
  await redis.zadd(BRIEF_INDEX_KEY, { score: Date.parse(now), member: id });
  return { ...current, ...patch } as BriefRecord;
}

export type BriefCounter = "suggestCount" | "ideasCount" | "readCount";

export async function incrementBriefCounter(id: string, field: BriefCounter): Promise<number> {
  return getRedis().hincrby(briefKey(id), field, 1);
}

export interface ListBriefsOptions {
  limit: number;
  offset: number;
}

/** Newest first by `updatedAt`. Ids whose hash has gone are dropped and pruned from the index. */
export async function listBriefs(opts: ListBriefsOptions): Promise<{ briefs: BriefRecord[]; total: number }> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(BRIEF_INDEX_KEY, 0, -1, { rev: true });
  const briefs: BriefRecord[] = [];
  const stale: string[] = [];
  let matched = 0;
  const batchSize = 100;
  for (let i = 0; i < ids.length && briefs.length < opts.limit; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const pipeline = redis.pipeline();
    for (const id of batch) pipeline.hgetall(briefKey(id));
    const hashes = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
    hashes.forEach((hash, j) => {
      if (!hash || Object.keys(hash).length === 0) {
        stale.push(batch[j]);
        return;
      }
      if (matched >= opts.offset && briefs.length < opts.limit) briefs.push(deserialise(hash));
      matched += 1;
    });
  }
  if (stale.length > 0) {
    try {
      await redis.zrem(BRIEF_INDEX_KEY, ...stale);
    } catch {
      // pruning is best effort
    }
  }
  return { briefs, total: ids.length - stale.length };
}

export async function countBriefs(): Promise<number> {
  return getRedis().zcard(BRIEF_INDEX_KEY);
}

export async function listBriefIdsByEmail(emailHash: string): Promise<string[]> {
  return getRedis().smembers(briefEmailIndexKey(emailHash));
}

/** Briefs whose `updatedAt` falls between the two times, by index score. */
export async function listBriefsUpdatedBetween(fromMs: number, toMs: number): Promise<BriefRecord[]> {
  const ids = await getRedis().zrange<string[]>(BRIEF_INDEX_KEY, fromMs, toMs, { byScore: true });
  return getBriefs(ids);
}

/** Drafts whose `updatedAt` is at or before `olderThanMs`. */
export async function listStaleDrafts(olderThanMs: number): Promise<BriefRecord[]> {
  const ids = await getRedis().zrange<string[]>(BRIEF_INDEX_KEY, 0, olderThanMs, { byScore: true });
  return (await getBriefs(ids)).filter((b) => b.status === "draft");
}

/** DEL the hash and the source, ZREM, SREM from the email set. Returns the record it deleted, or null. */
export async function deleteBrief(id: string): Promise<BriefRecord | null> {
  const record = await getBrief(id);
  if (!record) return null;
  const pipeline = getRedis().pipeline();
  pipeline.del(briefKey(id));
  pipeline.del(briefSourceKey(id));
  pipeline.zrem(BRIEF_INDEX_KEY, id);
  if (record.contact.emailHash) pipeline.srem(briefEmailIndexKey(record.contact.emailHash), id);
  await pipeline.exec();
  return record;
}

/** Every brief under the hash: hashes, sources, index entries and the set itself. */
export async function deleteBriefsByEmail(emailHash: string): Promise<{ count: number; notionPageIds: string[] }> {
  const redis = getRedis();
  const setKey = briefEmailIndexKey(emailHash);
  const ids = (await redis.smembers(setKey)).filter((id) => isBriefId(id));
  const records = await getBriefs(ids);
  const pipeline = redis.pipeline();
  for (const id of ids) {
    pipeline.del(briefKey(id));
    pipeline.del(briefSourceKey(id));
  }
  if (ids.length > 0) pipeline.zrem(BRIEF_INDEX_KEY, ...ids);
  pipeline.del(setKey);
  await pipeline.exec();
  return { count: records.length, notionPageIds: records.map((r) => r.notionPageId).filter((p): p is string => !!p) };
}

export interface BriefSummary {
  id: string;
  status: BriefStatus;
  submittedAt: string | null;
  firstStatusChangeAt: string | null;
}

/** The rows the stats page needs, newest first. */
export async function briefSummaries(limit: number): Promise<BriefSummary[]> {
  const { briefs } = await listBriefs({ limit, offset: 0 });
  return briefs.map((b) => ({ id: b.id, status: b.status, submittedAt: b.submittedAt, firstStatusChangeAt: b.firstStatusChangeAt }));
}
