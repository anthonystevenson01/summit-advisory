/**
 * The Ask Summit request record as code: the types, the states, the one
 * hash reader (tolerant of both Upstash read shapes, as runs.ts is), the
 * confidence summary the queue and the alerts print, and the stale rule
 * for a processing record whose function died. Pure: no Redis, no Node built-in
 * module; store.ts reads and writes through it.
 */
import type { BtsPartKey } from "../tools/built-to-scale-method.ts";
import type { Confidence } from "../tools/schema.ts";
import type { AskFileType } from "./validation.ts";
import type { AskStage, AskTimings } from "./stage-clock.ts";
import type { DraftedPart } from "./extraction-schema.ts";

export type { AskStage, AskTimings };

export const ASK_STATES = ["queued", "processing", "done", "failed"] as const;

export type AskRequestState = (typeof ASK_STATES)[number];

export function isAskState(value: unknown): value is AskRequestState {
  return typeof value === "string" && (ASK_STATES as readonly string[]).includes(value);
}

export interface AskFile {
  name: string;
  pathname: string;
  url: string;
  size: number;
  contentType: string;
  type: AskFileType;
}

export type ConfirmationStatus = "sent" | "failed" | "unconfigured";

export interface AskRequestRecord {
  id: string;
  state: AskRequestState;
  url: string;
  host: string;
  email: string;
  emailHash: string;
  name: string;
  company: string;
  files: AskFile[];
  createdAt: string;
  consentAt: string;
  deleteAt: string;
  dataDeleted: boolean;
  dataDeletedAt: string | null;
  enqueuedAt: string | null;
  enqueueMessageId: string | null;
  enqueueError: string | null;
  attempts: number;
  processingStartedAt: string | null;
  finishedAt: string | null;
  failedStage: AskStage | null;
  failedMessage: string | null;
  runId: string | null;
  previousRunIds: string[];
  reportSlug: string | null;
  companyName: string;
  confidence: Record<BtsPartKey, Confidence> | null;
  pageCount: number;
  docCount: number;
  timings: AskTimings | null;
  extractionModel: string;
  confirmationStatus: ConfirmationStatus | null;
  pdfDropped: boolean;
}

/** One drafted part on the stored draft, with Anthony's edit when a rerun carried one. */
export interface AskDraftPart extends DraftedPart {
  editedText?: string;
  editedAt?: string;
}

/** `ask:{id}:draft`: the extraction's answer plus what it was built from. */
export interface AskDraft {
  requestId: string;
  createdAt: string;
  model: string;
  companyName: string;
  summary: string;
  parts: Record<BtsPartKey, AskDraftPart>;
  pdfDropped: boolean;
  sources: { pages: number; docs: number; pdfs: number };
  materialChars: number;
}

export type AskDocStatus = "text" | "pdf" | "rejected" | "skipped";

/** One entry in `ask:{id}:docs`. PDF bytes are never stored; the blob is the store. */
export interface AskDocEntry {
  name: string;
  pathname: string;
  size: number;
  type: AskFileType;
  status: AskDocStatus;
  chars: number;
  text?: string;
  reason?: string;
  parts?: number;
  truncated?: boolean;
}

export const STALE_PROCESSING_MS = 15 * 60 * 1000;

const STAGE_NAMES = new Set(["crawl", "documents", "extraction", "scoring", "report", "finish"]);
const CONFIDENCE_NAMES = new Set(["low", "medium", "high"]);

function parseMaybeJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  if (raw === "null") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function stringOf(raw: unknown): string {
  const parsed = raw === "null" ? null : raw;
  return parsed === null || parsed === undefined ? "" : String(parsed);
}

function nullableString(raw: unknown): string | null {
  const parsed = parseMaybeJson(raw);
  return parsed === null || parsed === undefined || parsed === "" ? null : String(parsed);
}

function numberOf(raw: unknown): number {
  const n = Number(parseMaybeJson(raw));
  return Number.isFinite(n) ? n : 0;
}

function booleanOf(raw: unknown): boolean {
  return raw === true || raw === "true";
}

function readFiles(raw: unknown): AskFile[] {
  const parsed = parseMaybeJson(raw);
  if (!Array.isArray(parsed)) return [];
  const out: AskFile[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const f = item as Partial<AskFile>;
    if (typeof f.name !== "string" || typeof f.pathname !== "string" || typeof f.url !== "string") continue;
    const type = f.type === "pdf" || f.type === "pptx" || f.type === "docx" ? f.type : null;
    if (!type) continue;
    out.push({ name: f.name, pathname: f.pathname, url: f.url, size: Number(f.size) || 0, contentType: String(f.contentType ?? ""), type });
  }
  return out;
}

function readStringList(raw: unknown): string[] {
  const parsed = parseMaybeJson(raw);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
}

function readConfidence(raw: unknown): Record<BtsPartKey, Confidence> | null {
  const parsed = parseMaybeJson(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const out: Partial<Record<BtsPartKey, Confidence>> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "string" && CONFIDENCE_NAMES.has(value)) out[key as BtsPartKey] = value as Confidence;
  }
  return Object.keys(out).length > 0 ? (out as Record<BtsPartKey, Confidence>) : null;
}

function readTimings(raw: unknown): AskTimings | null {
  const parsed = parseMaybeJson(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const source = parsed as Record<string, unknown>;
  const out = {} as AskTimings;
  for (const stage of ["crawl", "documents", "extraction", "scoring", "report", "finish"] as const) out[stage] = numberOf(source[stage]);
  out.total = numberOf(source.total);
  return out;
}

function readStage(raw: unknown): AskStage | null {
  const value = nullableString(raw);
  return value !== null && STAGE_NAMES.has(value) ? (value as AskStage) : null;
}

function readConfirmation(raw: unknown): ConfirmationStatus | null {
  const value = nullableString(raw);
  return value === "sent" || value === "failed" || value === "unconfigured" ? value : null;
}

/**
 * The one deserialiser for `ask:{id}`. Null without an `id` or an `email`,
 * or when `state` is not one of the four. Nested fields read as JSON
 * strings or as values the client already parsed.
 */
export function readAskRequestHash(hash: Record<string, unknown> | null | undefined): AskRequestRecord | null {
  if (!hash || typeof hash !== "object") return null;
  const id = stringOf(hash.id);
  const email = stringOf(hash.email);
  if (!id || !email || !isAskState(hash.state)) return null;
  return {
    id,
    state: hash.state,
    url: stringOf(hash.url),
    host: stringOf(hash.host),
    email,
    emailHash: stringOf(hash.emailHash),
    name: stringOf(hash.name),
    company: stringOf(hash.company),
    files: readFiles(hash.files),
    createdAt: stringOf(hash.createdAt),
    consentAt: stringOf(hash.consentAt),
    deleteAt: stringOf(hash.deleteAt),
    dataDeleted: booleanOf(hash.dataDeleted),
    dataDeletedAt: nullableString(hash.dataDeletedAt),
    enqueuedAt: nullableString(hash.enqueuedAt),
    enqueueMessageId: nullableString(hash.enqueueMessageId),
    enqueueError: nullableString(hash.enqueueError),
    attempts: numberOf(hash.attempts),
    processingStartedAt: nullableString(hash.processingStartedAt),
    finishedAt: nullableString(hash.finishedAt),
    failedStage: readStage(hash.failedStage),
    failedMessage: nullableString(hash.failedMessage),
    runId: nullableString(hash.runId),
    previousRunIds: readStringList(hash.previousRunIds),
    reportSlug: nullableString(hash.reportSlug),
    companyName: stringOf(hash.companyName),
    confidence: readConfidence(hash.confidence),
    pageCount: numberOf(hash.pageCount),
    docCount: numberOf(hash.docCount),
    timings: readTimings(hash.timings),
    extractionModel: stringOf(hash.extractionModel),
    confirmationStatus: readConfirmation(hash.confirmationStatus),
    pdfDropped: booleanOf(hash.pdfDropped),
  };
}

/** "{n} high, {n} medium, {n} low", or "no draft yet" before the extraction ran. */
export function confidenceSummary(record: Pick<AskRequestRecord, "confidence">): string {
  if (!record.confidence) return "no draft yet";
  const counts = { high: 0, medium: 0, low: 0 };
  for (const value of Object.values(record.confidence)) counts[value] += 1;
  return `${counts.high} high, ${counts.medium} medium, ${counts.low} low`;
}

/** A `processing` record whose start is older than 15 minutes: the function died and the lock has lapsed. */
export function isStaleProcessing(record: Pick<AskRequestRecord, "state" | "processingStartedAt">, nowMs: number): boolean {
  if (record.state !== "processing" || !record.processingStartedAt) return false;
  const started = Date.parse(record.processingStartedAt);
  return Number.isFinite(started) && nowMs - started >= STALE_PROCESSING_MS;
}
