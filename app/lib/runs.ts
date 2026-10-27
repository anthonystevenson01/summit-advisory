/**
 * The run store: every scored run as a Redis hash at `run:{id}` plus the
 * index sorted set `runs:by-time` (score: createdAt in ms) and, for unlocked
 * runs, the per-email set `runs:by-email:{emailHash}` that the emailed result
 * and the delete-my-data flow read.
 *
 * Two record kinds share the key space and the indexes, discriminated on the
 * stored `tool`: a tool run (`RunRecord`, one registry tool) and a Built to
 * Scale? composite (`CompositeRunRecord`, `tool: "built-to-scale"`, with the
 * child run ids in `children`). `getRun` returns null for a composite and
 * `getCompositeRun` null for a tool run, so each route only ever sees its
 * own kind; `getRuns` and `listRuns` return the union for admin and the
 * address lookup. Child runs are ordinary tool runs with `source:
 * "built-to-scale"` and `parentId`.
 *
 * TTL rule: a run is saved with a 30 day expiry and an unlock removes it
 * (PERSIST). A run without an unlock is an anonymous score nobody asked to
 * keep; a run with one is a lead record that the daily digest, /admin/runs
 * and the Release 1b per-email lookup and deletion all depend on. The index
 * does not expire with the hash: listRuns prunes ids whose hash is gone.
 * Unlocking a composite unlocks and persists its children with it, so the
 * working stays alive as long as the scorecard and the delete flow removes
 * the lot.
 *
 * Two read shapes. The Upstash client returns a hash field as the stored
 * string or, when that string is valid JSON, as the already parsed value,
 * depending on the call path. serialise and parseValue accept both so a
 * record reads back the same whichever arrives. Nested fields are always
 * written as JSON strings; null is written as the string "null".
 */
import { randomUUID } from "node:crypto";
import { getRedis } from "./redis.ts";
import type { ToolSlug } from "./tools/registry.ts";
import type { Confidence, ExtraValue } from "./tools/schema.ts";
import { BUILT_TO_SCALE_TOOL, type BandKey, type BtsPartKey } from "./tools/built-to-scale-method.ts";

export interface Recommendation {
  dim: string;
  name: string;
  score: number;
  gap: string;
  consequence: string;
  action: string;
}

export interface RunUnlock {
  emailHash: string;
  email: string;
  name: string;
  company: string;
  at: string;
}

/** "built-to-scale" marks a child the orchestration made; the record is otherwise an ordinary tool run. */
export type RunSource = "web" | "built-to-scale";

export interface RunRecord {
  id: string;
  tool: ToolSlug;
  createdAt: string;
  source: RunSource;
  /** The composite run this child belongs to, or null for a run a visitor made directly. */
  parentId: string | null;
  inputs: Record<string, string>;
  scores: Record<string, number>;
  score: number;
  grade: number;
  verdict: string;
  confidence: Confidence;
  confidenceReason: string;
  extras: Record<string, ExtraValue> | null;
  dimensionReasoning: Record<string, string> | null;
  recommendations: Recommendation[] | null;
  /** Dimensions scoring 3 or below for which the details model gave no recommendation. */
  missingRecommendations: string[] | null;
  detailsAt: string | null;
  rubricVersion: number;
  rubricHash: string;
  detailsRubricHash: string | null;
  /** Model id that answered, per call: `scoring` and later `details`. */
  models: Record<string, string>;
  /** Routing key that resolved per call, so a `scoring:{tool}` override is visible. */
  routes: Record<string, string>;
  calibrated: Record<string, boolean>;
  unlock: RunUnlock | null;
  /** Result email: "sent", "failed", or null when no send has been attempted. */
  emailStatus: "sent" | "failed" | null;
  emailedAt: string | null;
}

export interface CompositeRunRow {
  key: BtsPartKey;
  grade: number;
  comment: string;
  /** Child run ids the model cited and the parser kept. */
  sources: string[];
}

/** A Built to Scale? run: the five parts, the children and the synthesis. */
export interface CompositeRunRecord {
  id: string;
  tool: typeof BUILT_TO_SCALE_TOOL;
  createdAt: string;
  /** "ask-summit" marks a composite the Ask Summit processing made; its result surfaces are admin only. */
  source: "web" | "ask-summit";
  quickMode: boolean;
  /** Five-part mode: the parts by part key. Quick mode: `{ description }`. */
  inputs: Record<string, string>;
  /** Tool slug to child run id, for the public tools that ran. */
  children: Record<string, string>;
  /** Tools skipped: hidden, or rubric not published at run time. */
  absentTools: string[];
  rows: CompositeRunRow[];
  total: number;
  bandKey: BandKey;
  band: string;
  verdict: string;
  strongest: string;
  weakest: string;
  oneChange: string;
  confidence: Confidence;
  confidenceReason: string;
  rubricVersion: number;
  rubricHash: string;
  models: Record<string, string>;
  routes: Record<string, string>;
  calibrated: Record<string, boolean>;
  /** Set when every child's full view was produced. */
  detailsAt: string | null;
  unlock: RunUnlock | null;
  emailStatus: "sent" | "failed" | null;
  emailedAt: string | null;
}

export type StoredRun = RunRecord | CompositeRunRecord;

/** The discriminator: `tool` is a registry slug for a tool run and "built-to-scale" for a composite. */
export function isCompositeRun(run: StoredRun): run is CompositeRunRecord {
  return run.tool === BUILT_TO_SCALE_TOOL;
}

export type EmailStatus = NonNullable<RunRecord["emailStatus"]>;

export const RUN_INDEX_KEY = "runs:by-time";
const RUN_TTL_SECONDS = 30 * 24 * 60 * 60;
const RUN_ID_PATTERN = /^run_[0-9a-f]{16}$/;

export function runKey(id: string): string {
  return `run:${id}`;
}

/** Checked before every read; a `cal_` calibration id never matches, so a calibration run can never be read back. */
export function isRunId(value: unknown): value is string {
  return typeof value === "string" && RUN_ID_PATTERN.test(value);
}

/** Set of run ids unlocked under one email hash. No TTL. */
export function emailIndexKey(emailHash: string): string {
  return `runs:by-email:${emailHash}`;
}

/** `run_` plus 16 lowercase hex characters. */
export function newRunId(): string {
  return `run_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

const JSON_FIELDS = new Set([
  "inputs", "scores", "extras", "dimensionReasoning", "recommendations", "missingRecommendations",
  "models", "routes", "calibrated", "unlock", "children", "rows", "absentTools",
]);

const NUMERIC_FIELDS = new Set(["score", "grade", "rubricVersion", "total"]);

/** Nested values are stored as JSON strings; scalars as themselves. */
function serialise(patch: object): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(patch) as Array<[string, unknown]>) {
    if (value === undefined) continue;
    if (JSON_FIELDS.has(key) || (typeof value === "object" && value !== null)) {
      out[key] = JSON.stringify(value);
    } else if (value === null) {
      out[key] = "null";
    } else if (typeof value === "boolean") {
      // Upstash returns hash fields as strings; `quickMode` is written as
      // "true" or "false" and the composite deserialiser reads both forms.
      out[key] = String(value);
    } else {
      out[key] = value as string | number;
    }
  }
  return out;
}

/** Accepts both read shapes: a JSON string passed through, or a value the client already parsed. */
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

function parseHash(hash: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(hash)) out[key] = parseValue(key, raw);
  return out;
}

function emailStatusOf(value: unknown): "sent" | "failed" | null {
  return value === "sent" || value === "failed" ? value : null;
}

function deserialiseTool(hash: Record<string, unknown>): RunRecord {
  const r = parseHash(hash) as Partial<RunRecord>;
  return {
    id: String(r.id ?? ""),
    tool: r.tool as ToolSlug,
    createdAt: String(r.createdAt ?? ""),
    source: r.source === "built-to-scale" ? "built-to-scale" : "web",
    parentId: r.parentId ? String(r.parentId) : null,
    inputs: r.inputs ?? {},
    scores: r.scores ?? {},
    score: Number(r.score ?? 0),
    grade: Number(r.grade ?? 0),
    verdict: String(r.verdict ?? ""),
    confidence: (r.confidence as Confidence) ?? "low",
    confidenceReason: String(r.confidenceReason ?? ""),
    extras: r.extras ?? null,
    dimensionReasoning: r.dimensionReasoning ?? null,
    recommendations: r.recommendations ?? null,
    missingRecommendations: r.missingRecommendations ?? null,
    detailsAt: r.detailsAt ? String(r.detailsAt) : null,
    rubricVersion: Number(r.rubricVersion ?? 0),
    rubricHash: String(r.rubricHash ?? ""),
    detailsRubricHash: r.detailsRubricHash ? String(r.detailsRubricHash) : null,
    models: r.models ?? {},
    routes: r.routes ?? {},
    calibrated: r.calibrated ?? {},
    unlock: r.unlock ?? null,
    emailStatus: emailStatusOf(r.emailStatus),
    emailedAt: r.emailedAt ? String(r.emailedAt) : null,
  };
}

function deserialiseComposite(hash: Record<string, unknown>): CompositeRunRecord {
  const parsed = parseHash(hash);
  const r = parsed as Partial<CompositeRunRecord>;
  return {
    id: String(r.id ?? ""),
    tool: BUILT_TO_SCALE_TOOL,
    createdAt: String(r.createdAt ?? ""),
    source: r.source === "ask-summit" ? "ask-summit" : "web",
    quickMode: parsed.quickMode === true || parsed.quickMode === "true",
    inputs: r.inputs ?? {},
    children: r.children ?? {},
    absentTools: Array.isArray(r.absentTools) ? r.absentTools : [],
    rows: Array.isArray(r.rows) ? r.rows : [],
    total: Number(r.total ?? 0),
    bandKey: (r.bandKey as BandKey) ?? "hard",
    band: String(r.band ?? ""),
    verdict: String(r.verdict ?? ""),
    strongest: String(r.strongest ?? ""),
    weakest: String(r.weakest ?? ""),
    oneChange: String(r.oneChange ?? ""),
    confidence: (r.confidence as Confidence) ?? "low",
    confidenceReason: String(r.confidenceReason ?? ""),
    rubricVersion: Number(r.rubricVersion ?? 0),
    rubricHash: String(r.rubricHash ?? ""),
    models: r.models ?? {},
    routes: r.routes ?? {},
    calibrated: r.calibrated ?? {},
    detailsAt: r.detailsAt ? String(r.detailsAt) : null,
    unlock: r.unlock ?? null,
    emailStatus: emailStatusOf(r.emailStatus),
    emailedAt: r.emailedAt ? String(r.emailedAt) : null,
  };
}

function deserialise(hash: Record<string, unknown>): StoredRun {
  return hash.tool === BUILT_TO_SCALE_TOOL ? deserialiseComposite(hash) : deserialiseTool(hash);
}

async function saveHash(id: string, createdAt: string, fields: Record<string, string | number>): Promise<void> {
  const redis = getRedis();
  const key = runKey(id);
  await redis.hset(key, fields);
  await redis.expire(key, RUN_TTL_SECONDS);
  await redis.zadd(RUN_INDEX_KEY, { score: Date.parse(createdAt) || Date.now(), member: id });
}

export async function saveRun(run: RunRecord): Promise<void> {
  await saveHash(run.id, run.createdAt, serialise(run));
}

/** Mirrors saveRun: HSET, 30 day expiry, ZADD into the shared index. */
export async function saveCompositeRun(run: CompositeRunRecord): Promise<void> {
  await saveHash(run.id, run.createdAt, serialise(run));
}

async function readHash(id: string): Promise<Record<string, unknown> | null> {
  if (!isRunId(id)) return null;
  const hash = await getRedis().hgetall<Record<string, unknown>>(runKey(id));
  if (!hash || Object.keys(hash).length === 0) return null;
  return hash;
}

/** A tool run, or null for an unknown id or a composite. */
export async function getRun(id: string): Promise<RunRecord | null> {
  const hash = await readHash(id);
  if (!hash || hash.tool === BUILT_TO_SCALE_TOOL) return null;
  return deserialiseTool(hash);
}

/** A composite run, or null for an unknown id or a tool run. */
export async function getCompositeRun(id: string): Promise<CompositeRunRecord | null> {
  const hash = await readHash(id);
  if (!hash || hash.tool !== BUILT_TO_SCALE_TOOL) return null;
  return deserialiseComposite(hash);
}

/** One pipelined read; ids whose hash is gone are dropped. Order follows `ids`. Either kind. */
export async function getRuns(ids: string[]): Promise<StoredRun[]> {
  const valid = ids.filter((id) => isRunId(id));
  if (valid.length === 0) return [];
  const pipeline = getRedis().pipeline();
  for (const id of valid) pipeline.hgetall(runKey(id));
  const hashes = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
  const runs: StoredRun[] = [];
  hashes.forEach((hash) => {
    if (hash && Object.keys(hash).length > 0) runs.push(deserialise(hash));
  });
  return runs;
}

/** The tool runs among `ids`, in order; composites are dropped. */
export async function getToolRuns(ids: string[]): Promise<RunRecord[]> {
  return (await getRuns(ids)).filter((r): r is RunRecord => !isCompositeRun(r));
}

/** Patches either kind; the field names do not collide, so one serialiser serves both. */
export async function updateRun(id: string, patch: Partial<RunRecord> | Partial<CompositeRunRecord>): Promise<void> {
  const fields = serialise(patch);
  if (Object.keys(fields).length === 0) return;
  await getRedis().hset(runKey(id), fields);
}

/** Records the unlock on the run, removes its TTL and indexes the id under the email hash. */
export async function markUnlocked(id: string, unlock: RunUnlock): Promise<void> {
  const redis = getRedis();
  const key = runKey(id);
  await redis.hset(key, serialise({ unlock }));
  await redis.persist(key);
  await redis.sadd(emailIndexKey(unlock.emailHash), id);
}

/**
 * Records the unlock on the composite and on every child, PERSISTs them all
 * and indexes every id under the email hash, in one pipeline. The children
 * carry the parent's unlock so detailRun authorises them as "form" and the
 * delete flow removes them with the parent.
 */
export async function markCompositeUnlocked(id: string, childIds: string[], unlock: RunUnlock): Promise<void> {
  const redis = getRedis();
  const ids = [id, ...childIds.filter((c) => isRunId(c))];
  const fields = serialise({ unlock });
  const pipeline = redis.pipeline();
  for (const runId of ids) {
    pipeline.hset(runKey(runId), fields);
    pipeline.persist(runKey(runId));
  }
  pipeline.sadd(emailIndexKey(unlock.emailHash), ids[0], ...ids.slice(1));
  await pipeline.exec();
}

export async function listRunIdsByEmail(emailHash: string): Promise<string[]> {
  return getRedis().smembers(emailIndexKey(emailHash));
}

/**
 * The address for a cookie unlock, which stores the hash only: the newest
 * run under the hash (either kind, excluding `excludeId`) whose unlock
 * carries an address, or null when nothing is on record.
 */
export async function findAddressForHash(emailHash: string, excludeId: string): Promise<string | null> {
  const ids = await listRunIdsByEmail(emailHash);
  const siblings = await getRuns(ids.filter((id) => id !== excludeId));
  siblings.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const withAddress = siblings.find((r) => r.unlock?.email);
  return withAddress?.unlock?.email ?? null;
}

/**
 * Deletes every run under the hash: the run hashes, their entries in
 * `runs:by-time` and the per-email set itself. Returns how many run hashes
 * actually existed; zero when the set is empty.
 */
export async function deleteRunsByEmail(emailHash: string): Promise<number> {
  const redis = getRedis();
  const indexKey = emailIndexKey(emailHash);
  const ids = await redis.smembers(indexKey);
  if (ids.length === 0) return 0;
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.del(runKey(id));
  pipeline.zrem(RUN_INDEX_KEY, ...ids);
  pipeline.del(indexKey);
  const replies = (await pipeline.exec()) as unknown[];
  let count = 0;
  for (let i = 0; i < ids.length; i += 1) count += Number(replies[i] ?? 0);
  return count;
}

/** Records the outcome of the result email; `emailedAt` is set on a send. */
export async function recordEmailStatus(id: string, status: EmailStatus): Promise<void> {
  const patch: Partial<RunRecord> = { emailStatus: status };
  if (status === "sent") patch.emailedAt = new Date().toISOString();
  await getRedis().hset(runKey(id), serialise(patch));
}

export interface ListRunsOptions {
  /** A registry slug or `built-to-scale`. */
  tool?: string;
  limit: number;
  offset: number;
}

/**
 * Newest first, either kind. Ids whose hash has expired are dropped and
 * removed from the index as they are met.
 */
export async function listRuns(opts: ListRunsOptions): Promise<{ runs: StoredRun[]; total: number }> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(RUN_INDEX_KEY, 0, -1, { rev: true });
  const runs: StoredRun[] = [];
  const stale: string[] = [];
  let matched = 0;
  const batchSize = 100;

  for (let i = 0; i < ids.length && runs.length < opts.limit; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const pipeline = redis.pipeline();
    for (const id of batch) pipeline.hgetall(runKey(id));
    const hashes = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
    hashes.forEach((hash, j) => {
      if (!hash || Object.keys(hash).length === 0) {
        stale.push(batch[j]);
        return;
      }
      const run = deserialise(hash);
      if (opts.tool && run.tool !== opts.tool) return;
      if (matched >= opts.offset && runs.length < opts.limit) runs.push(run);
      matched += 1;
    });
  }

  if (stale.length > 0) {
    try {
      await redis.zrem(RUN_INDEX_KEY, ...stale);
    } catch {
      // pruning is best effort
    }
  }
  return { runs, total: ids.length - stale.length };
}

export async function countRuns(): Promise<number> {
  return getRedis().zcard(RUN_INDEX_KEY);
}
