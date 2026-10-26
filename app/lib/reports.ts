/**
 * The report store: one Redis hash per prospect report at `report:{slug}`
 * (no TTL) plus the index sorted set `reports:by-updated` (score: updatedAt
 * in ms, member: slug). The slug is the public URL and the report's only
 * identity, so it is the key itself: uniqueness is then a property of the
 * key space and needs no second index to enforce. Creation claims the key
 * with HSETNX and a rename moves it with RENAMENX; both refuse an existing
 * destination atomically, where an EXISTS followed by a write would not.
 * `readReportHash` in the pure model is the one deserialiser, shared with
 * the edge image.
 *
 * Serialisation follows runs.ts: nested values (`rows`, `accessCode`) as
 * JSON strings, null as the string "null", numbers as themselves. The
 * counters (`openCount`, `rerunCount`, `firstOpenedAt`, `lastOpenedAt`) are
 * written with HINCRBY and HSETNX so they never touch `updatedAt`.
 *
 * `persistRunForReport` removes the 30 day TTL from the composite and its
 * children so the working outlives the report; it records no unlock and
 * touches no index, so the delete flow and the digest are unaffected.
 */
import { getRedis } from "./redis.ts";
import { isRunId, runKey } from "./runs.ts";
import { isValidSlug, readReportHash, recomputeTotal, type ReportRecord, type ReportRow } from "./tools/report-model.ts";

export const REPORT_INDEX_KEY = "reports:by-updated";

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`slug already in use: ${slug}`);
    this.name = "SlugTakenError";
  }
}

export class ReportNotFoundError extends Error {
  constructor(slug: string) {
    super(`report not found: ${slug}`);
    this.name = "ReportNotFoundError";
  }
}

export function reportKey(slug: string): string {
  return `report:${slug}`;
}

const JSON_FIELDS = new Set(["rows", "accessCode"]);

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

export interface CreateReportInput {
  slug: string;
  company: string;
  runId: string;
  asOf: string;
  rows: ReportRow[];
  opening: string;
  productThoughts: string;
  moonshot: string;
}

/**
 * Claims the slug with HSETNX on the `slug` field, then writes the rest and
 * indexes it. Throws SlugTakenError (and writes nothing else) when the slug
 * exists. The store fills the state, the null fields, the timestamps, the
 * counters and the total and band.
 *
 * The rows arrive with the run's originals inside them and are stored in
 * full rather than as a diff against the run: the 1b delete flow can remove
 * an unlocked composite and its children at any time, and the report must
 * keep rendering its scorecard (and the editor its "from the run" column)
 * with the run gone. The run is read later only for the working.
 *
 * A crash between the HSETNX and the HSET leaves a key holding only `slug`.
 * `readReportHash` rejects it (no run id, no rows), so the report reads as
 * missing while the slug stays claimed; the fix is a DEL of that key.
 */
export async function createReport(input: CreateReportInput): Promise<ReportRecord> {
  if (!isValidSlug(input.slug)) throw new Error(`invalid slug: ${input.slug}`);
  const redis = getRedis();
  const key = reportKey(input.slug);
  const claimed = await redis.hsetnx(key, "slug", input.slug);
  if (claimed === 0) throw new SlugTakenError(input.slug);

  const now = new Date().toISOString();
  const { total, bandKey, band } = recomputeTotal(input.rows);
  const report: ReportRecord = {
    slug: input.slug,
    company: input.company,
    runId: input.runId,
    state: "draft",
    asOf: input.asOf,
    expiresAt: null,
    accessCode: null,
    opening: input.opening,
    productThoughts: input.productThoughts,
    moonshot: input.moonshot,
    rows: input.rows,
    total,
    bandKey,
    band,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    firstOpenedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    rerunCount: 0,
  };
  // The two open timestamps are left unwritten: recordOpen sets the first
  // with HSETNX, which a stored "null" would defeat, and the reader treats a
  // missing field as null.
  const { slug: _slug, firstOpenedAt: _first, lastOpenedAt: _last, ...rest } = report;
  await redis.hset(key, serialise(rest));
  await redis.zadd(REPORT_INDEX_KEY, { score: Date.parse(now), member: input.slug });
  return report;
}

/** Null for an invalid slug (checked before the read), an empty hash or a malformed one. */
export async function getReport(slug: string): Promise<ReportRecord | null> {
  if (!isValidSlug(slug)) return null;
  const hash = await getRedis().hgetall<Record<string, unknown>>(reportKey(slug));
  if (!hash || Object.keys(hash).length === 0) return null;
  return readReportHash(hash);
}

/** Newest updated first. Members whose hash is gone are dropped and pruned from the index, best effort. */
export async function listReports(): Promise<ReportRecord[]> {
  const redis = getRedis();
  const slugs = await redis.zrange<string[]>(REPORT_INDEX_KEY, 0, -1, { rev: true });
  const reports: ReportRecord[] = [];
  const stale: string[] = [];
  const batchSize = 100;
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const pipeline = redis.pipeline();
    for (const slug of batch) pipeline.hgetall(reportKey(slug));
    const hashes = (await pipeline.exec()) as Array<Record<string, unknown> | null>;
    hashes.forEach((hash, j) => {
      const report = hash && Object.keys(hash).length > 0 ? readReportHash(hash) : null;
      if (report) reports.push(report);
      else stale.push(batch[j]);
    });
  }
  if (stale.length > 0) {
    try {
      await redis.zrem(REPORT_INDEX_KEY, ...stale);
    } catch {
      // pruning is best effort
    }
  }
  return reports;
}

export type ReportPatch = Partial<Omit<ReportRecord, "slug">>;

/** HSET the patch and move the index score to the new `updatedAt` (or now). Renames go through renameReport, never here. */
export async function saveReport(slug: string, patch: ReportPatch): Promise<void> {
  const redis = getRedis();
  const updatedAt = patch.updatedAt ?? new Date().toISOString();
  const fields = serialise({ ...patch, updatedAt });
  await redis.hset(reportKey(slug), fields);
  await redis.zadd(REPORT_INDEX_KEY, { score: Date.parse(updatedAt) || Date.now(), member: slug });
}

/**
 * RENAMENX the hash, then in one pipeline set the stored `slug`, remove the
 * old index member and add the new. Throws SlugTakenError when the new slug
 * exists (nothing moved) and ReportNotFoundError when the old one is gone.
 *
 * A rename is a move, not a copy: the old slug 404s at once, and any access
 * cookie issued under it stops matching because the cookie is path scoped.
 * The index move after the RENAMENX is not atomic with it; a crash between
 * the two leaves a stale member that `listReports` prunes on its next read.
 */
export async function renameReport(oldSlug: string, newSlug: string): Promise<void> {
  const redis = getRedis();
  let moved: number;
  try {
    moved = await redis.renamenx(reportKey(oldSlug), reportKey(newSlug));
  } catch (err) {
    if (err instanceof Error && /no such key/i.test(err.message)) throw new ReportNotFoundError(oldSlug);
    throw err;
  }
  if (moved === 0) throw new SlugTakenError(newSlug);
  const pipeline = redis.pipeline();
  pipeline.hset(reportKey(newSlug), { slug: newSlug });
  pipeline.zrem(REPORT_INDEX_KEY, oldSlug);
  pipeline.zadd(REPORT_INDEX_KEY, { score: Date.now(), member: newSlug });
  await pipeline.exec();
}

/** DEL the hash and ZREM the index member; nothing else. Returns whether the hash existed. */
export async function deleteReport(slug: string): Promise<boolean> {
  const pipeline = getRedis().pipeline();
  pipeline.del(reportKey(slug));
  pipeline.zrem(REPORT_INDEX_KEY, slug);
  const replies = (await pipeline.exec()) as unknown[];
  return Number(replies[0] ?? 0) > 0;
}

/**
 * HSETNX firstOpenedAt, HINCRBY openCount, HSET lastOpenedAt in one
 * pipeline. The counters bypass `saveReport` on purpose: an open is not an
 * edit, so it must not move `updatedAt` or the report's place in the admin
 * list. The HSETNX reply is `first`, which is how the page learns in the
 * same round trip that this open was the first one and the alert is due.
 */
export async function recordOpen(slug: string, nowIso: string): Promise<{ first: boolean; openCount: number }> {
  const key = reportKey(slug);
  const pipeline = getRedis().pipeline();
  pipeline.hsetnx(key, "firstOpenedAt", nowIso);
  pipeline.hincrby(key, "openCount", 1);
  pipeline.hset(key, { lastOpenedAt: nowIso });
  const replies = (await pipeline.exec()) as unknown[];
  return { first: Number(replies[0] ?? 0) === 1, openCount: Number(replies[1] ?? 0) };
}

/** HINCRBY rerunCount; returns the new count. */
export async function recordRerun(slug: string): Promise<number> {
  return getRedis().hincrby(reportKey(slug), "rerunCount", 1);
}

/**
 * PERSIST the composite and each valid child id in one pipeline. A run
 * that was never unlocked expires 30 days after it was made, while a report
 * defaults to 30 days from publish and can be extended, so without this the
 * working would vanish under a live report. PERSIST only drops the TTL: no
 * unlock record, no email index entry, so the delete flow and the digest are
 * unaffected. Deleting a report does not restore the TTL.
 */
export async function persistRunForReport(runId: string, childIds: string[]): Promise<void> {
  const ids = [runId, ...childIds].filter((id) => isRunId(id));
  if (ids.length === 0) return;
  const pipeline = getRedis().pipeline();
  for (const id of ids) pipeline.persist(runKey(id));
  await pipeline.exec();
}
