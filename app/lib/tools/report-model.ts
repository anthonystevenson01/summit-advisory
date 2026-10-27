/**
 * The prospect report model as code: the record shape, the slug rules, the
 * row merge with the `edited` flag, the total and band through the 3a
 * method, expiry, the state transitions, the one hash reader, and the view
 * builders for the public page, the slide and the OpenGraph image. Pure and
 * edge safe: it imports the method module (types and maths) and the brand
 * constants only, no `node:` module, no registry, no store, so the edge
 * image, the server pages, the admin routes, the seed script and the tests
 * all read one definition.
 *
 * What is not here: the access-code hashing (`report-access.ts`, which
 * needs `node:crypto` and so cannot load on the edge) and the Redis store
 * (`app/lib/reports.ts`).
 */
import { BOOK_CALL_URL, CONTACT_EMAIL } from "../brand.ts";
import {
  BTS_PARTS,
  BUILT_TO_SCALE_TOOL,
  bandFor,
  totalOf,
  type BandKey,
  type BtsPartKey,
  type CompositeFullRow,
  type CompositeFullView,
  type WorkingEntry,
} from "./built-to-scale-method.ts";

// ── Types ────────────────────────────────────────────────────────────────────

export type ReportState = "draft" | "published" | "unpublished";

export const REPORT_STATES: readonly ReportState[] = ["draft", "published", "unpublished"];

export function isReportState(value: unknown): value is ReportState {
  return typeof value === "string" && (REPORT_STATES as readonly string[]).includes(value);
}

export interface ReportRowOriginal {
  grade: number;
  comment: string;
}

/** One dimension on a report: the edited grade and comment beside the run's original, in method order. */
export interface ReportRow {
  key: BtsPartKey;
  grade: number;
  comment: string;
  original: ReportRowOriginal;
  /** True when the grade or the trimmed comment differs from the original. */
  edited: boolean;
}

/** The stored access code: a per-report salt and the scrypt hash, never the code. */
export interface ReportAccessCode {
  salt: string;
  hash: string;
}

export interface ReportRecord {
  slug: string;
  company: string;
  runId: string;
  state: ReportState;
  /** YYYY-MM-DD, the London calendar date the report speaks as of. */
  asOf: string;
  /** ISO, or null until publish. */
  expiresAt: string | null;
  accessCode: ReportAccessCode | null;
  opening: string;
  productThoughts: string;
  moonshot: string;
  rows: ReportRow[];
  total: number;
  bandKey: BandKey;
  band: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  rerunCount: number;
  /** The Ask Summit request this report was drafted from, or null for a report made by hand. */
  askRequestId: string | null;
}

/** A partial edit per dimension, as the editor form and the seed script supply it. */
export type ReportEdits = Partial<Record<BtsPartKey, { grade?: number; comment?: string }>>;

export interface OriginalRow {
  key: BtsPartKey;
  grade: number;
  comment: string;
}

// ── Copy ─────────────────────────────────────────────────────────────────────

export const CAVEAT_LINE = "Prepared by Summit Strategy Advisory from public information.";
export const EDITED_NOTE = "Scores and comments edited by Summit.";
export const CORRECTION_LINE = "If anything here is out of date or wrong, tell us and we will correct it.";
export const CTA_LABEL = "Book 30 minutes";
export const PLACEHOLDER_TEXT = "Anthony to write";
export const WORKING_MISSING_LINE = "The tool results behind this scorecard are no longer stored. Ask Summit for a fresh run.";
export const WORKING_NOT_STORED_LINE = "The full working for this tool was not stored for this run.";
export const EXPIRED_HEADING = "This report has expired";
export const EXPIRED_BODY = "Reports are kept for a limited time. Ask Summit for a fresh one.";
export const ACCESS_HEADING = "This report needs an access code";
export const ACCESS_PROMPT = "Enter the code Summit sent you.";
export const ACCESS_WRONG = "That code did not match. Check the message from Summit and try again.";
export const ACCESS_LIMITED = "Too many attempts from this connection. Try again in an hour.";
export const SLIDE_MARK = "Summit Strategy Advisory";

export const REPORT_COPY = {
  CAVEAT_LINE,
  EDITED_NOTE,
  CORRECTION_LINE,
  CTA_LABEL,
  PLACEHOLDER_TEXT,
  WORKING_MISSING_LINE,
  WORKING_NOT_STORED_LINE,
  EXPIRED_HEADING,
  EXPIRED_BODY,
  ACCESS_HEADING,
  ACCESS_PROMPT,
  ACCESS_WRONG,
  ACCESS_LIMITED,
  SLIDE_MARK,
} as const;

// ── Slugs ────────────────────────────────────────────────────────────────────

export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

/** Lowercase letters, digits and single hyphens between them, 3 to 60 characters. */
export const SLUG_PATTERN = /^(?=.{3,60}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

const PLACEHOLDER_PATTERN = /^draft-[0-9a-f]{8}$/;
const SLUG_PAD = "report";

/**
 * Lowercase, diacritics stripped, every run of other characters one hyphen,
 * trimmed, cut to 60 at the last hyphen inside the limit, and padded with
 * "report" when shorter than 3.
 */
export function slugify(text: string): string {
  let slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > SLUG_MAX) {
    const cut = slug.lastIndexOf("-", SLUG_MAX);
    slug = (cut > 0 ? slug.slice(0, cut) : slug.slice(0, SLUG_MAX)).replace(/-+$/g, "");
  }
  if (slug.length < SLUG_MIN) slug = slug ? `${slug}-${SLUG_PAD}` : SLUG_PAD;
  return slug;
}

/** `draft-` plus the last 8 hex characters of the run id: the key a new report has until it is named. */
export function placeholderSlugFor(runId: string): string {
  return `draft-${runId.slice(-8)}`;
}

export function isPlaceholderSlug(slug: string): boolean {
  return PLACEHOLDER_PATTERN.test(slug);
}

// ── Rows, total, band ────────────────────────────────────────────────────────

function clampGrade(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, n));
}

/**
 * The run's rows (or the report's stored originals) plus a partial map of
 * edits, in method order. A missing original becomes grade 1 and an empty
 * comment; a missing edit keeps the original; `edited` is true when the
 * grade or the trimmed comment differs from the original.
 *
 * The comparison trims because the editor's textarea returns the comment
 * with a trailing newline the run never had, and the flag is what puts
 * "Scores and comments edited by Summit" on the public page: a whitespace
 * difference must not label an untouched report as edited. The flag is
 * derived here on every save rather than stored by the editor, so it can
 * never disagree with the row it describes.
 */
export function mergeRows(originals: readonly OriginalRow[], edits: ReportEdits = {}): ReportRow[] {
  return BTS_PARTS.map((part) => {
    const found = originals.find((r) => r.key === part.key);
    const original: ReportRowOriginal = { grade: found ? clampGrade(found.grade) : 1, comment: found ? String(found.comment ?? "") : "" };
    const edit = edits[part.key];
    const grade = edit && edit.grade !== undefined ? clampGrade(edit.grade) : original.grade;
    const comment = edit && edit.comment !== undefined ? edit.comment.trim() : original.comment;
    const edited = grade !== original.grade || comment.trim() !== original.comment.trim();
    return { key: part.key, grade, comment, original, edited };
  });
}

/** Total and band from the five grades through the 3a method. Five clamped grades can never fall outside 5 to 25. */
export function recomputeTotal(rows: readonly { grade: number }[]): { total: number; bandKey: BandKey; band: string } {
  const total = totalOf(rows);
  const band = bandFor(total);
  return { total, bandKey: band.key, band: band.label };
}

// ── Dates, expiry, state ─────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
export const REPORT_LIFETIME_DAYS = 30;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `expiresAt` is set and has passed. A null expiry (a draft) never expires. */
export function isExpired(report: { expiresAt: string | null }, nowMs: number = Date.now()): boolean {
  if (!report.expiresAt) return false;
  const t = Date.parse(report.expiresAt);
  return Number.isFinite(t) && t <= nowMs;
}

/** 30 days after publish, as ISO. */
export function defaultExpiry(publishedAtMs: number): string {
  return new Date(publishedAtMs + REPORT_LIFETIME_DAYS * DAY_MS).toISOString();
}

/** The end of the given day in UTC as ISO, or null for a malformed or impossible date. */
export function expiryFromDate(yyyyMmDd: string): string | null {
  if (!DATE_PATTERN.test(yyyyMmDd)) return null;
  const t = Date.parse(`${yyyyMmDd}T23:59:59.999Z`);
  if (!Number.isFinite(t)) return null;
  const iso = new Date(t).toISOString();
  return iso.startsWith(yyyyMmDd) ? iso : null;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && expiryFromDate(value) !== null;
}

const londonDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

/** The London calendar date as YYYY-MM-DD (en-CA prints ISO order). */
export function todayIso(nowMs: number = Date.now()): string {
  return londonDate.format(new Date(nowMs));
}

/** "26 October 2026" from YYYY-MM-DD; the value itself when it does not parse. */
export function longDateLabel(yyyyMmDd: string): string {
  const t = Date.parse(`${yyyyMmDd}T12:00:00Z`);
  if (!Number.isFinite(t)) return yyyyMmDd;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export type ReportStateEvent = "report_published" | "report_unpublished";

export interface StateChange {
  patch: Partial<ReportRecord> & { state: ReportState; updatedAt: string };
  event: ReportStateEvent | null;
}

/**
 * To `published` from another state: `publishedAt` is set when null, a null
 * or past `expiresAt` becomes 30 days out, event `report_published`. To
 * `unpublished` from `published`: event `report_unpublished`. Any other
 * transition carries no event. The patch always carries the state and
 * `updatedAt`.
 */
export function applyStateChange(report: ReportRecord, nextState: ReportState, nowMs: number = Date.now()): StateChange {
  const now = new Date(nowMs).toISOString();
  const patch: StateChange["patch"] = { state: nextState, updatedAt: now };
  if (nextState === "published" && report.state !== "published") {
    if (!report.publishedAt) patch.publishedAt = now;
    if (!report.expiresAt || isExpired(report, nowMs)) patch.expiresAt = defaultExpiry(nowMs);
    return { patch, event: "report_published" };
  }
  if (nextState === "unpublished" && report.state === "published") {
    return { patch, event: "report_unpublished" };
  }
  return { patch, event: null };
}

// ── The hash reader ──────────────────────────────────────────────────────────

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
  return raw === null || raw === undefined ? "" : String(raw);
}

function nullableString(raw: unknown): string | null {
  const parsed = parseMaybeJson(raw);
  return parsed === null || parsed === undefined || parsed === "" ? null : String(parsed);
}

function numberOf(raw: unknown): number {
  const n = Number(parseMaybeJson(raw));
  return Number.isFinite(n) ? n : 0;
}

function readAccessCode(raw: unknown): ReportAccessCode | null {
  const parsed = parseMaybeJson(raw);
  if (typeof parsed !== "object" || parsed === null) return null;
  const { salt, hash } = parsed as { salt?: unknown; hash?: unknown };
  if (typeof salt !== "string" || typeof hash !== "string" || !salt || !hash) return null;
  return { salt, hash };
}

function readRows(raw: unknown): ReportRow[] | null {
  const parsed = parseMaybeJson(raw);
  if (!Array.isArray(parsed) || parsed.length !== BTS_PARTS.length) return null;
  const rows: ReportRow[] = [];
  for (const part of BTS_PARTS) {
    const found = parsed.find((r) => typeof r === "object" && r !== null && (r as { key?: unknown }).key === part.key) as
      | { grade?: unknown; comment?: unknown; original?: { grade?: unknown; comment?: unknown }; edited?: unknown }
      | undefined;
    if (!found) return null;
    const original: ReportRowOriginal = { grade: clampGrade(found.original?.grade), comment: stringOf(found.original?.comment) };
    const grade = clampGrade(found.grade);
    const comment = stringOf(found.comment);
    rows.push({ key: part.key, grade, comment, original, edited: found.edited === true || found.edited === "true" });
  }
  return rows;
}

/**
 * The one deserialiser for `report:{slug}`, tolerant of both Upstash read
 * shapes (JSON strings and already parsed values). Null when the slug or the
 * run id is missing or the rows are not the five dimensions; grades clamped
 * to 1 to 5.
 *
 * The total and band are recomputed from the five grades on every read and
 * the stored `total`, `bandKey` and `band` are ignored. The grades are the
 * source of truth; the stored values are a convenience that every save
 * rewrites, and recomputing means a hand edit to the hash, a partial write
 * or a later change to the band table can never show a total that disagrees
 * with the rows on the page, the slide and the image.
 */
export function readReportHash(hash: Record<string, unknown> | null | undefined): ReportRecord | null {
  if (!hash || typeof hash !== "object") return null;
  const slug = stringOf(hash.slug);
  const runId = stringOf(hash.runId);
  if (!slug || !runId) return null;
  const rows = readRows(hash.rows);
  if (!rows) return null;
  const { total, bandKey, band } = recomputeTotal(rows);
  const state = isReportState(hash.state) ? hash.state : "draft";
  return {
    slug,
    company: stringOf(hash.company),
    runId,
    state,
    asOf: stringOf(hash.asOf),
    expiresAt: nullableString(hash.expiresAt),
    accessCode: readAccessCode(hash.accessCode),
    opening: stringOf(hash.opening),
    productThoughts: stringOf(hash.productThoughts),
    moonshot: stringOf(hash.moonshot),
    rows,
    total,
    bandKey,
    band,
    createdAt: stringOf(hash.createdAt),
    updatedAt: stringOf(hash.updatedAt),
    publishedAt: nullableString(hash.publishedAt),
    firstOpenedAt: nullableString(hash.firstOpenedAt),
    lastOpenedAt: nullableString(hash.lastOpenedAt),
    openCount: numberOf(hash.openCount),
    rerunCount: numberOf(hash.rerunCount),
    askRequestId: nullableString(hash.askRequestId),
  };
}

// ── Text ─────────────────────────────────────────────────────────────────────

/** Paragraphs separated by blank lines, trimmed, empties dropped. */
export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Cuts at the last space inside the limit and appends an ellipsis character, never a dash. */
export function clampText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(" ", limit);
  return `${(cut > 0 ? text.slice(0, cut) : text.slice(0, limit)).trimEnd()}…`;
}

// ── The public view ──────────────────────────────────────────────────────────

export interface ReportWorkingEntry extends WorkingEntry {
  rerunHref: string;
}

export interface ReportWorkingRow {
  key: BtsPartKey;
  name: string;
  grade: number;
  entries: ReportWorkingEntry[];
}

export interface ReportPublicView {
  company: string;
  slug: string;
  asOf: string;
  asOfLabel: string;
  caveat: string;
  opening: string[];
  productThoughts: string[];
  moonshot: string[];
  /** A full-view-shaped projection for the 3a Scorecard: filler strings in the fields a report does not have. */
  scorecard: CompositeFullView;
  label: string;
  anyEdited: boolean;
  working: ReportWorkingRow[];
  workingAvailable: boolean;
  correction: string;
  contactEmail: string;
  ctaLabel: string;
  ctaUrl: string;
}

/** `/tools/{tool}?prefill={childRunId}&via=report&report={slug}`: the one place that knows the shape. */
export function reportRerunHref(tool: string, childRunId: string, slug: string): string {
  return `/tools/${encodeURIComponent(tool)}?prefill=${encodeURIComponent(childRunId)}&via=report&report=${encodeURIComponent(slug)}`;
}

/**
 * The public page's view. The scorecard is a `CompositeFullView`-shaped
 * projection so the 3a `Scorecard` renders it with no new prop: an empty
 * `label` hides the automated line (the page passes `EDITED_NOTE` or ""),
 * `compact` hides strongest, weakest and the one change, an empty verdict
 * is hidden by the one rule added to the component, `unlocked: true` lets
 * every comment render, and `sources` is empty because the run's sources
 * described grades the report may since have changed. The filler values
 * live here, in one tested place, rather than in the page.
 */
export function publicViewOf(report: ReportRecord, composite: CompositeFullView | null): ReportPublicView {
  const rows: CompositeFullRow[] = report.rows.map((row) => {
    const part = BTS_PARTS.find((p) => p.key === row.key);
    const source = composite?.rows.find((r) => r.key === row.key);
    return {
      key: row.key,
      name: part?.name ?? row.key,
      grade: row.grade,
      comment: row.comment,
      sources: [],
      feeds: source?.feeds ?? [],
      working: source?.working ?? [],
    };
  });
  const scorecard: CompositeFullView = {
    runId: report.runId,
    tool: BUILT_TO_SCALE_TOOL,
    total: report.total,
    band: report.band,
    bandKey: report.bandKey,
    verdict: "",
    strongest: "",
    weakest: "",
    oneChange: "",
    confidence: "medium",
    confidenceReason: "",
    quickMode: false,
    createdAt: report.asOf,
    rows,
    absentTools: [],
    unlocked: true,
  };
  const working: ReportWorkingRow[] = rows.map((row) => ({
    key: row.key,
    name: row.name,
    grade: row.grade,
    entries: row.working.map((entry) => ({ ...entry, rerunHref: reportRerunHref(entry.tool, entry.runId, report.slug) })),
  }));
  const anyEdited = report.rows.some((r) => r.edited);
  return {
    company: report.company,
    slug: report.slug,
    asOf: report.asOf,
    asOfLabel: longDateLabel(report.asOf),
    caveat: CAVEAT_LINE,
    opening: paragraphsOf(report.opening),
    productThoughts: paragraphsOf(report.productThoughts),
    moonshot: paragraphsOf(report.moonshot),
    scorecard,
    label: anyEdited ? EDITED_NOTE : "",
    anyEdited,
    working,
    workingAvailable: composite !== null && working.some((w) => w.entries.length > 0),
    correction: CORRECTION_LINE,
    contactEmail: CONTACT_EMAIL,
    ctaLabel: CTA_LABEL,
    ctaUrl: BOOK_CALL_URL,
  };
}

// ── The slide view and the image data ────────────────────────────────────────

export interface SlideScorecardRow {
  name: string;
  grade: number;
  dots: boolean[];
}

export type ReportSlideBox =
  | { kind: "text"; title: string; paragraphs: string[] }
  | { kind: "scorecard"; title: string; total: number; band: string; rows: SlideScorecardRow[] };

export interface ReportSlideView {
  company: string;
  asOfLabel: string;
  /** The first paragraph of the opening, or the placeholder when empty. */
  opening: string;
  mark: string;
  caveat: string;
  boxes: [ReportSlideBox, ReportSlideBox, ReportSlideBox];
}

export const SLIDE_TITLES = { productThoughts: "Product thoughts", scorecard: "Built to Scale?", moonshot: "Moonshot" } as const;

/** Three boxes in order: product thoughts, the scorecard with dots per row, moonshot. */
export function slideViewOf(report: ReportRecord): ReportSlideView {
  const rows: SlideScorecardRow[] = BTS_PARTS.map((part) => {
    const grade = report.rows.find((r) => r.key === part.key)?.grade ?? 0;
    return { name: part.name, grade, dots: Array.from({ length: 5 }, (_, i) => i < grade) };
  });
  const opening = paragraphsOf(report.opening)[0] ?? PLACEHOLDER_TEXT;
  return {
    company: report.company,
    asOfLabel: longDateLabel(report.asOf),
    opening,
    mark: SLIDE_MARK,
    caveat: CAVEAT_LINE,
    boxes: [
      { kind: "text", title: SLIDE_TITLES.productThoughts, paragraphs: paragraphsOf(report.productThoughts) },
      { kind: "scorecard", title: SLIDE_TITLES.scorecard, total: report.total, band: report.band, rows },
      { kind: "text", title: SLIDE_TITLES.moonshot, paragraphs: paragraphsOf(report.moonshot) },
    ],
  };
}

export const IMAGE_OPENING_MAX = 240;
export const IMAGE_BOX_MAX = 200;

/** The slide view with the opening clamped to 240 characters and each text box joined and clamped to 200; the dots are kept. */
export function reportImageData(slide: ReportSlideView): ReportSlideView {
  const boxes = slide.boxes.map((box) =>
    box.kind === "text" ? { ...box, paragraphs: [clampText(box.paragraphs.join(" "), IMAGE_BOX_MAX)] } : box,
  ) as ReportSlideView["boxes"];
  return { ...slide, opening: clampText(slide.opening, IMAGE_OPENING_MAX), boxes };
}

// ── Gradeshow and preview fetchers ───────────────────────────────────────────

const GRADESHOW_GRADES: Record<BtsPartKey, number> = {
  pain: 3,
  routeToBuyer: 2,
  unitOfValue: 1,
  valueEvidence: 2,
  abilityToProtect: 2,
};

/** The spec's worked example: the grades moved, each original comment kept for Anthony to rewrite in the editor. */
export function gradeshowEdits(originals: readonly OriginalRow[]): { company: string; slug: string; edits: ReportEdits } {
  const edits: ReportEdits = {};
  for (const part of BTS_PARTS) {
    const original = originals.find((r) => r.key === part.key);
    edits[part.key] = { grade: GRADESHOW_GRADES[part.key], comment: original?.comment ?? "" };
  }
  return { company: "Gradeshow", slug: "gradeshow", edits };
}

const PREVIEW_AGENTS = [
  "linkedinbot",
  "googleimageproxy",
  "facebookexternalhit",
  "slackbot",
  "twitterbot",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "skypeuripreview",
  "bingpreview",
  "embedly",
  "bot/",
  "crawler",
  "preview",
];

/** A link preview fetcher, by user agent. A heuristic used only to skip open counting. */
export function isPreviewFetcher(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return PREVIEW_AGENTS.some((needle) => ua.includes(needle));
}
