/**
 * The run store: every scored run as a Redis hash at `run:{id}` plus the
 * index sorted set `runs:by-time` (score: createdAt in ms) and, for unlocked
 * runs, the per-email set `runs:by-email:{emailHash}` that the emailed result
 * and the delete-my-data flow read.
 *
 * TTL rule: a run is saved with a 30 day expiry and an unlock removes it
 * (PERSIST). A run without an unlock is an anonymous score nobody asked to
 * keep; a run with one is a lead record that the daily digest, /admin/runs
 * and the Release 1b per-email lookup and deletion all depend on. The index
 * does not expire with the hash: listRuns prunes ids whose hash is gone.
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

export interface RunRecord {
  id: string;
  tool: ToolSlug;
  createdAt: string;
  source: "web";
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

export type EmailStatus = NonNullable<RunRecord["emailStatus"]>;

export const RUN_INDEX_KEY = "runs:by-time";
const RUN_TTL_SECONDS = 30 * 24 * 60 * 60;

export function runKey(id: string): string {
  return `run:${id}`;
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
  "models", "routes", "calibrated", "unlock",
]);

/** Nested values are stored as JSON strings; scalars as themselves. */
function serialise(patch: Partial<RunRecord>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (JSON_FIELDS.has(key) || (typeof value === "object" && value !== null)) {
      out[key] = JSON.stringify(value);
    } else if (value === null) {
      out[key] = "null";
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
  if (JSON_FIELDS.has(key) || key === "score" || key === "grade" || key === "rubricVersion") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function deserialise(hash: Record<string, unknown>): RunRecord {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(hash)) out[key] = parseValue(key, raw);
  const r = out as Partial<RunRecord>;
  return {
    id: String(r.id ?? ""),
    tool: r.tool as ToolSlug,
    createdAt: String(r.createdAt ?? ""),
    source: "web",
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
    emailStatus: r.emailStatus === "sent" || r.emailStatus === "failed" ? r.emailStatus : null,
    emailedAt: r.emailedAt ? String(r.emailedAt) : null,
  };
}

export async function saveRun(run: RunRecord): Promise<void> {
  const redis = getRedis();
  const key = runKey(run.id);
  await redis.hset(key, serialise(run));
  await redis.expire(key, RUN_TTL_SECONDS);
  await redis.zadd(RUN_INDEX_KEY, { score: Date.parse(run.createdAt) || Date.now(), member: run.id });
}

export async function getRun(id: string): Promise<RunRecord | null> {
  if (!/^run_[0-9a-f]{16}$/.test(id)) return null;
  const hash = await getRedis().hgetall<Record<string, unknown>>(runKey(id));
  if (!hash || Object.keys(hash).length === 0) return null;
  return deserialise(hash);
}

/** One pipelined read; ids whose hash is gone are dropped. Order follows `ids`. */
export async function getRuns(ids: string[]): Promise<RunRecord[]> {
  const valid = ids.filter((id) => /^run_[0-9a-f]{16}$/.test(id));
  if (valid.length === 0) return [];
  const pipeline = getRedis().pipeline();
  for (const id of valid) pipeline.hgetall(runKey(id));
  const hashes = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
  const runs: RunRecord[] = [];
  hashes.forEach((hash) => {
    if (hash && Object.keys(hash).length > 0) runs.push(deserialise(hash));
  });
  return runs;
}

export async function updateRun(id: string, patch: Partial<RunRecord>): Promise<void> {
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

export async function listRunIdsByEmail(emailHash: string): Promise<string[]> {
  return getRedis().smembers(emailIndexKey(emailHash));
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
  tool?: ToolSlug;
  limit: number;
  offset: number;
}

/**
 * Newest first. Ids whose hash has expired are dropped and removed from the
 * index as they are met.
 */
export async function listRuns(opts: ListRunsOptions): Promise<{ runs: RunRecord[]; total: number }> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(RUN_INDEX_KEY, 0, -1, { rev: true });
  const runs: RunRecord[] = [];
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
