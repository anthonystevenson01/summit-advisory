/**
 * The requirement catalogue format: one markdown file per tool category in
 * docs/catalogue, read into a typed structure, checked, and written back in
 * one canonical form. Pure: no file, network or env access, and the only
 * import is the capability list in catalogue.ts.
 *
 * The parser fails only when it cannot build the structure and returns named
 * errors, never an exception. Everything else is read as it stands and left
 * to the validator, so a hand editor sees every problem in one run. The
 * serialiser writes fixed wording plus the structure's fields and computes
 * the counts, the totals and the legend from the data; `canonicalDifference`
 * holds a file to that form line by line.
 *
 * The size scale below is the only place the build day figures appear in
 * code. Baseline means every product in the category covers the requirement
 * fully. It is never a count, a share or a threshold, and it is only checked
 * once every product named in the file has been marked.
 *
 * This module must not import the generated data: the build script needs the
 * parser to produce that file, so the read API lives in tool-catalogue-read.ts.
 */
import { CAPABILITIES, type CapabilityKey } from "./catalogue.ts";

// ── Types ────────────────────────────────────────────────────────────────────

export type CatalogueSize = "S" | "M" | "L";
export type CatalogueMark = "F" | "P" | "N";
export type CatalogueKey = CapabilityKey | "none";

/** One row of a group's table. `baseline` is true when every product in the category covers the requirement fully; `key` is the capability it sits under, or `none`. */
export interface CatalogueRequirement {
  id: string;
  text: string;
  baseline: boolean;
  size: CatalogueSize;
  key: CatalogueKey;
}
export interface CatalogueGroup {
  name: string;
  requirements: CatalogueRequirement[];
}
/** A screen every tool of this type has, with the ids of the requirements it serves. */
export interface ScreenPattern {
  name: string;
  ids: string[];
}
/**
 * A marked product: one row of the products table and one coverage column,
 * joined by the exact name. `tier` is the tier the marks assume,
 * `specification` says what the product publishes about its API, and
 * `leaving` gives the usual reasons people leave it.
 */
export interface CatalogueProduct {
  name: string;
  tier: string;
  specification: string;
  leaving: string;
}
/** One mark per coverage column. */
export interface CatalogueCoverageRow {
  id: string;
  marks: CatalogueMark[];
}
/** Column names and rows as the table gives them, so a missing row or a misnamed column stays visible to the validator. */
export interface CatalogueCoverage {
  products: string[];
  rows: CatalogueCoverageRow[];
}
/** `product` is a product's exact name or the reserved word `all`. */
export interface CatalogueComment {
  id: string;
  product: string;
  text: string;
}
/** What supports one product's mark for one requirement. `product` is a marked product's exact name; `all` is not allowed here. */
export interface CatalogueEvidence {
  id: string;
  product: string;
  text: string;
}
/** A free text note under Products, written back character for character: a title and its paragraphs, each one line. */
export interface CatalogueNote {
  title: string;
  paragraphs: string[];
}

/**
 * One category file as data. The serialiser writes exactly these fields
 * plus fixed wording, so anything a file should keep has to live here.
 */
export interface ToolCategory {
  type: string;
  title: string;
  keys: CapabilityKey[];
  published: boolean;
  /** The phrase after "for" in the intro sentence, with no full stop. */
  scope: string;
  groups: CatalogueGroup[];
  patterns: ScreenPattern[];
  /** The marked products, in coverage column order. */
  products: CatalogueProduct[];
  /** Names still to mark. While any remain, the baseline flags stand as the file states them and the category cannot be published. */
  pendingProducts: string[];
  /** Null until the first product is marked. */
  coverage: CatalogueCoverage | null;
  comments: CatalogueComment[];
  evidence: CatalogueEvidence[];
  notes: CatalogueNote[];
  /** The text after the sources label under Evidence, or null when the file has no such line. */
  sources: string | null;
}

/** The figures the intro and the Totals paragraph state, computed from the data. `all` and `baselineDays` are build day ranges from the size scale. */
export interface CatalogueTotals {
  requirements: number;
  groups: number;
  small: number;
  medium: number;
  large: number;
  baseline: number;
  all: { low: number; high: number };
  baselineDays: { low: number; high: number };
}

/** What the file said, kept beside the category so the validator can hold it against the computed figures. Never serialised, never generated. */
export interface StatedFigures {
  /** The header lines seen, in order. */
  headerFields: string[];
  intro: { requirements: number; groups: number };
  totals: {
    requirements: number;
    small: number;
    medium: number;
    large: number;
    baseline: number;
    allLow: number;
    allHigh: number;
    baselineLow: number;
    baselineHigh: number;
  } | null;
}

export type CatalogueParseErrorCode =
  | "empty-file"
  | "missing-title"
  | "missing-header"
  | "bad-header-line"
  | "bad-header-value"
  | "intro-unreadable"
  | "unknown-section"
  | "duplicate-section"
  | "missing-section"
  | "bad-table-header"
  | "bad-table-row"
  | "bad-baseline"
  | "totals-unreadable"
  | "unexpected-line"
  | "internal";
/** `line` is 1 based; 0 when no line applies. */
export interface CatalogueParseError {
  code: CatalogueParseErrorCode;
  line: number;
  message: string;
}
/** The category with the figures its file stated, or the named errors; `errors` is never empty. */
export type CatalogueParseResult =
  | { ok: true; category: ToolCategory; stated: StatedFigures }
  | { ok: false; errors: CatalogueParseError[] };

export type CatalogueProblemCode =
  | "header-field-missing"
  | "bad-type"
  | "type-file-mismatch"
  | "header-key-unknown"
  | "no-requirements"
  | "group-name"
  | "bad-id"
  | "duplicate-id"
  | "group-letter-mixed"
  | "group-letter-shared"
  | "bad-size"
  | "unknown-key"
  | "key-not-in-header"
  | "requirement-not-one-sentence"
  | "long-dash"
  | "unsafe-text"
  | "pattern-unknown-id"
  | "product-name"
  | "coverage-missing"
  | "coverage-columns"
  | "coverage-rows"
  | "bad-mark"
  | "baseline-not-all-full"
  | "all-full-not-baseline"
  | "comment-reference"
  | "comment-not-one-sentence"
  | "evidence-reference"
  | "intro-count-mismatch"
  | "totals-missing"
  | "totals-mismatch"
  | "published-no-products"
  | "published-pending-products"
  | "published-missing-evidence"
  | "internal";
/** `where` names the place: "header", "R3", "pattern Pipeline board", "product Pipedrive". */
export interface CatalogueProblem {
  code: CatalogueProblemCode;
  where: string;
  message: string;
}
/** `fileName` turns on the check of the type against the file name; `stated` turns on the checks of the file's own counts and totals. */
export interface ValidateContext {
  fileName?: string;
  stated?: StatedFigures;
}
/** The first line that differs from the canonical form; an absent line reads as an empty string. */
export interface CanonicalDifference {
  line: number;
  expected: string;
  found: string;
}

// ── The size scale: the one place the day figures live ───────────────────────

export const SIZE_SCALE = {
  S: { word: "small", low: 1, high: 2 },
  M: { word: "medium", low: 3, high: 5 },
  L: { word: "large", low: 6, high: 10 },
} as const;

export const CATALOGUE_SIZES: readonly CatalogueSize[] = ["S", "M", "L"];
export const CATALOGUE_MARKS: readonly CatalogueMark[] = ["F", "P", "N"];

/** What each mark means, in the words the legend and the mark prompt both use. */
export const MARK_MEANINGS: Record<CatalogueMark, string> = {
  F: "covered in the assumed tier",
  P: "partly or only on a higher tier or add-on",
  N: "not covered",
};

/** The scale as the legend and the draft prompt state it, built from SIZE_SCALE. */
export function sizeScaleSentence(): string {
  return CATALOGUE_SIZES.map((size) => `${size} ${SIZE_SCALE[size].low} to ${SIZE_SCALE[size].high} days`).join(", ");
}

function sizeBand(size: unknown): { low: number; high: number } | null {
  if (typeof size !== "string" || !Object.prototype.hasOwnProperty.call(SIZE_SCALE, size)) return null;
  return SIZE_SCALE[size as CatalogueSize];
}

/** The low and high build days for any list of requirements. A size outside the scale adds nothing; the validator reports it. */
export function buildDays(requirements: readonly { size: CatalogueSize }[]): { low: number; high: number } {
  let low = 0;
  let high = 0;
  for (const requirement of requirements) {
    const band = sizeBand(requirement.size);
    if (!band) continue;
    low += band.low;
    high += band.high;
  }
  return { low, high };
}

function allRequirements(category: ToolCategory): CatalogueRequirement[] {
  return category.groups.flatMap((group) => group.requirements);
}

/** The counts and build day ranges of a category. The serialiser writes these and the validator holds a file's stated figures to them, so the two cannot drift. */
export function computeTotals(category: ToolCategory): CatalogueTotals {
  const all = allRequirements(category);
  const baseline = all.filter((requirement) => requirement.baseline);
  const count = (size: CatalogueSize) => all.filter((requirement) => requirement.size === size).length;
  return {
    requirements: all.length,
    groups: category.groups.length,
    small: count("S"),
    medium: count("M"),
    large: count("L"),
    baseline: baseline.length,
    all: buildDays(all),
    baselineDays: buildDays(baseline),
  };
}

// ── Shared text rules ────────────────────────────────────────────────────────

/** One capital letter and one digit. */
export const REQUIREMENT_ID_RE = /^[A-Z][0-9]$/;
/** A category type, which is also its file name without the extension. */
export const CATEGORY_TYPE_RE = /^[a-z][a-z0-9-]*$/;
/** The Product cell of a comment that applies to every product. */
export const ALL_PRODUCTS = "all";
/** The Key cell of a requirement that sits under no capability. */
export const NO_KEY = "none";

/** Ends with a full stop and holds no other full stop, question mark or exclamation mark. */
export function isOneSentence(text: string): boolean {
  if (typeof text !== "string" || !text.endsWith(".")) return false;
  return !/[.?!]/.test(text.slice(0, -1));
}

/** True when the text holds an en dash (U+2013) or an em dash (U+2014). */
export function hasLongDash(text: string): boolean {
  return typeof text === "string" && /[\u2013\u2014]/.test(text);
}

/** Fit for a table cell or a list item: not empty, trimmed, no pipe, no line break. */
export function isCellSafe(text: string): boolean {
  return typeof text === "string" && text.length > 0 && text === text.trim() && !/[|\r\n]/.test(text);
}

function isCapabilityKey(value: unknown): value is CapabilityKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CAPABILITIES, value);
}

// ── Fixed wording: written by the serialiser, never kept by the parser ───────

const TITLE_SUFFIX = ": requirement catalogue";
const FENCE = "```";
const HEADER_FIELDS = ["type", "title", "keys", "published"] as const;
const INTRO_TAIL =
  "Each requirement is one level below the module: a behaviour a client recognises and a developer can turn into a screen or a rule.";
const LEGEND_BASELINE =
  "- **Baseline** yes means every product in this category covers it fully. It is what the category has in common, so a replacement must match it and the builder ticks it by default.";
const LEGEND_KEY = "- **Key** is the capability key the requirement sits under.";
const LEGEND_KEY_NONE = " Connections and admin requirements have none; the builder holds them as connections and guardrails.";

const SECTION_GROUPS = "Groups and requirements";
const SECTION_PATTERNS = "Screen patterns";
const SECTION_COVERAGE = "Product coverage";
const SECTION_PRODUCTS = "Products";
const SECTION_EVIDENCE = "Evidence";
const SECTIONS: readonly string[] = [SECTION_GROUPS, SECTION_PATTERNS, SECTION_COVERAGE, SECTION_PRODUCTS, SECTION_EVIDENCE];
const TOTALS_HEADING = "Totals";
const COMMENTS_HEADING = "Comments on marks";
const FIXED_HEADINGS: readonly string[] = [...SECTIONS, TOTALS_HEADING, COMMENTS_HEADING];

const PATTERNS_PARAGRAPH =
  "The screens every tool of this type has, each naming the requirements it serves. The prototype planner starts from these.";
const COMMENTS_PARAGRAPH = "Only where a mark needs qualifying.";
const NO_PRODUCTS_PARAGRAPH = "No product is marked yet. Coverage marks are added by the catalogue scripts.";
const PENDING_PARAGRAPH = "Still to mark:";
const EVIDENCE_PARAGRAPH =
  "From each product's public API specification. An endpoint present supports F; an endpoint absent is checked against documentation before a mark of N.";
const SOURCES_LABEL = "Sources:";

const REQUIREMENT_COLUMNS: readonly string[] = ["Id", "Requirement", "Baseline", "Size", "Key"];
const PATTERN_COLUMNS: readonly string[] = ["Screen", "Serves"];
const COMMENT_COLUMNS: readonly string[] = ["Id", "Product", "Comment"];
const PRODUCT_COLUMNS: readonly string[] = ["Product", "Tier assumed", "Public API specification", "Usual reasons for leaving"];
const EVIDENCE_COLUMNS: readonly string[] = ["Id", "Product", "Evidence"];
const COVERAGE_ID_COLUMN = "Id";

// ── Parser ───────────────────────────────────────────────────────────────────

/** Thrown inside the parser and caught at its door; never leaves this module. */
class ParseStop {
  error: CatalogueParseError;
  constructor(error: CatalogueParseError) {
    this.error = error;
  }
}

function stop(code: CatalogueParseErrorCode, index: number, message: string): never {
  throw new ParseStop({ code, line: index + 1, message });
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

function splitRow(line: string, index: number): string[] {
  const trimmed = line.trim();
  if (trimmed.length < 2 || !trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    stop("bad-table-row", index, "A table row must start and end with a pipe.");
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

interface ParsedTable {
  header: string[];
  rows: { cells: string[]; index: number }[];
  next: number;
}

/** Reads the table that starts at `start`. `columns` is the header expected at this place, or null when the header is data. */
function readTable(lines: readonly string[], start: number, end: number, columns: readonly string[] | null): ParsedTable {
  const header = splitRow(lines[start], start);
  if (columns && (header.length !== columns.length || header.some((cell, i) => cell !== columns[i]))) {
    stop("bad-table-header", start, `Expected the table header "| ${columns.join(" | ")} |".`);
  }
  const separatorIndex = start + 1;
  const separator = separatorIndex < end ? lines[separatorIndex].trim() : "";
  if (!/^\|(\s*:?-+:?\s*\|)+$/.test(separator) || splitRow(separator, separatorIndex).length !== header.length) {
    stop("bad-table-header", separatorIndex, "The table header must be followed by a separator row with one cell per column.");
  }
  const rows: { cells: string[]; index: number }[] = [];
  let next = separatorIndex + 1;
  while (next < end && lines[next].trim().startsWith("|")) {
    const cells = splitRow(lines[next], next);
    if (cells.length !== header.length) {
      stop("bad-table-row", next, `Expected ${header.length} cells in this row and found ${cells.length}.`);
    }
    rows.push({ cells, index: next });
    next += 1;
  }
  return { header, rows, next };
}

type LineKind = "blank" | "heading" | "table" | "list" | "prose";

function kindOf(line: string): LineKind {
  if (isBlank(line)) return "blank";
  if (line.startsWith("### ") || line.trim() === "###") return "heading";
  if (line.trim().startsWith("|")) return "table";
  if (line.startsWith("- ")) return "list";
  return "prose";
}

function splitIds(cell: string): string[] {
  return cell
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function parseText(text: string): CatalogueParseResult {
  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, errors: [{ code: "empty-file", line: 0, message: "The file is empty." }] };
  }
  const lines = text.split("\n");
  let i = 0;
  const skipBlank = () => {
    while (i < lines.length && isBlank(lines[i])) i += 1;
  };

  // Title line: its text is computed from the header, so only its presence is read.
  skipBlank();
  if (!lines[i].startsWith("# ")) stop("missing-title", i, "The file must start with a title line: # {title}: requirement catalogue.");
  i += 1;

  // Header block.
  skipBlank();
  if (i >= lines.length || !lines[i].startsWith(FENCE)) {
    stop("missing-header", Math.min(i, lines.length - 1), "The title must be followed by a fenced header block.");
  }
  const headerStart = i;
  i += 1;
  const header: Record<string, string> = {};
  const headerFields: string[] = [];
  while (i < lines.length && !lines[i].startsWith(FENCE)) {
    if (!isBlank(lines[i])) {
      const match = /^([A-Za-z][A-Za-z0-9_-]*):(.*)$/.exec(lines[i]);
      if (!match) stop("bad-header-line", i, "A header line must read name: value.");
      const name = match[1];
      if (!(HEADER_FIELDS as readonly string[]).includes(name)) {
        stop("bad-header-line", i, `Unknown header field "${name}". The fields are ${HEADER_FIELDS.join(", ")}.`);
      }
      if (headerFields.includes(name)) stop("bad-header-line", i, `The header field "${name}" appears twice.`);
      const value = match[2].trim();
      if (name === "published" && value !== "true" && value !== "false") {
        stop("bad-header-value", i, "published must be true or false.");
      }
      header[name] = value;
      headerFields.push(name);
    }
    i += 1;
  }
  if (i >= lines.length) stop("missing-header", headerStart, "The header block is not closed.");
  i += 1;

  // Intro: the two counts and the scope phrase.
  skipBlank();
  const intro = i < lines.length ? /^(\d+) requirements? in (\d+) groups? for ([^.]*)\./.exec(lines[i]) : null;
  if (!intro) {
    stop(
      "intro-unreadable",
      Math.min(i, lines.length - 1),
      "The intro must read: {count} requirements in {count} groups for {scope}. followed by the fixed sentence.",
    );
  }
  const stated: StatedFigures = {
    headerFields,
    intro: { requirements: Number(intro[1]), groups: Number(intro[2]) },
    totals: null,
  };
  i += 1;

  // The legend and any other prose before the first section are fixed wording.
  while (i < lines.length && !lines[i].startsWith("## ")) {
    const kind = kindOf(lines[i]);
    if (kind === "table") stop("unexpected-line", i, "A table row appears before the first section.");
    if (kind === "heading") stop("unknown-section", i, "A sub heading appears before the first section.");
    i += 1;
  }

  const groups: CatalogueGroup[] = [];
  const patterns: ScreenPattern[] = [];
  const products: CatalogueProduct[] = [];
  const pendingProducts: string[] = [];
  let coverage: CatalogueCoverage | null = null;
  const comments: CatalogueComment[] = [];
  const evidence: CatalogueEvidence[] = [];
  const notes: CatalogueNote[] = [];
  let sources: string | null = null;
  const seen = new Set<string>();

  while (i < lines.length) {
    const sectionIndex = i;
    const section = lines[i].slice(3).trim();
    if (!SECTIONS.includes(section)) stop("unknown-section", i, `Unknown section "${section}". The sections are ${SECTIONS.join(", ")}.`);
    if (seen.has(section)) stop("duplicate-section", i, `The section "${section}" appears twice.`);
    seen.add(section);
    i += 1;
    let end = i;
    while (end < lines.length && !lines[end].startsWith("## ")) end += 1;

    if (section === SECTION_GROUPS) {
      let current: CatalogueGroup | null = null;
      let currentHasTable = false;
      let inTotals = false;
      let totalsIndex = -1;
      while (i < end) {
        const line = lines[i];
        const kind = kindOf(line);
        if (kind === "heading") {
          const name = line.slice(3).trim();
          if (name === TOTALS_HEADING) {
            if (totalsIndex >= 0) stop("duplicate-section", i, "The Totals heading appears twice.");
            totalsIndex = i;
            inTotals = true;
            current = null;
          } else {
            inTotals = false;
            current = { name, requirements: [] };
            currentHasTable = false;
            groups.push(current);
          }
          i += 1;
        } else if (kind === "table") {
          if (!current || currentHasTable) stop("unexpected-line", i, "A requirements table must follow its own group heading.");
          const table = readTable(lines, i, end, REQUIREMENT_COLUMNS);
          for (const row of table.rows) {
            const [id, requirementText, baseline, size, key] = row.cells;
            if (baseline !== "yes" && baseline !== "no") stop("bad-baseline", row.index, "The Baseline cell must be yes or no.");
            // Size and key are carried as written; the validator checks them.
            current.requirements.push({
              id,
              text: requirementText,
              baseline: baseline === "yes",
              size: size as CatalogueSize,
              key: key as CatalogueKey,
            });
          }
          currentHasTable = true;
          i = table.next;
        } else if (kind === "list") {
          stop("unexpected-line", i, "A list does not belong in the groups section.");
        } else {
          if (kind === "prose" && inTotals && stated.totals === null) {
            const numbers = line.match(/\d+/g);
            if (!numbers || numbers.length !== 9) {
              stop("totals-unreadable", i, "The Totals paragraph must hold nine figures: the count, small, medium, large, baseline and the two day ranges.");
            }
            const [requirements, small, medium, large, baseline, allLow, allHigh, baselineLow, baselineHigh] = numbers.map(Number);
            stated.totals = { requirements, small, medium, large, baseline, allLow, allHigh, baselineLow, baselineHigh };
          }
          i += 1;
        }
      }
      if (totalsIndex >= 0 && stated.totals === null) stop("totals-unreadable", totalsIndex, "The Totals heading has no paragraph under it.");
    } else if (section === SECTION_PATTERNS) {
      let hasTable = false;
      while (i < end) {
        const kind = kindOf(lines[i]);
        if (kind === "heading") stop("unknown-section", i, "The screen patterns section has no sub headings.");
        if (kind === "list") stop("unexpected-line", i, "A list does not belong in the screen patterns section.");
        if (kind === "table") {
          if (hasTable) stop("unexpected-line", i, "The screen patterns section holds one table.");
          const table = readTable(lines, i, end, PATTERN_COLUMNS);
          for (const row of table.rows) patterns.push({ name: row.cells[0], ids: splitIds(row.cells[1]) });
          hasTable = true;
          i = table.next;
        } else {
          i += 1;
        }
      }
    } else if (section === SECTION_COVERAGE) {
      let inComments = false;
      let commentsSeen = false;
      let commentsTable = false;
      while (i < end) {
        const line = lines[i];
        const kind = kindOf(line);
        if (kind === "heading") {
          const name = line.slice(3).trim();
          if (name !== COMMENTS_HEADING) stop("unknown-section", i, `Unknown sub heading "${name}" in the product coverage section.`);
          if (commentsSeen) stop("duplicate-section", i, "The Comments on marks heading appears twice.");
          commentsSeen = true;
          inComments = true;
          i += 1;
        } else if (kind === "list") {
          stop("unexpected-line", i, "A list does not belong in the product coverage section.");
        } else if (kind === "table") {
          if (!inComments) {
            if (coverage) stop("unexpected-line", i, "The product coverage section holds one coverage table.");
            const table = readTable(lines, i, end, null);
            if (table.header.length < 2 || table.header[0] !== COVERAGE_ID_COLUMN) {
              stop("bad-table-header", i, "The coverage table header must be Id followed by one column per product.");
            }
            // Marks are carried as written; the validator checks them.
            coverage = {
              products: table.header.slice(1),
              rows: table.rows.map((row) => ({ id: row.cells[0], marks: row.cells.slice(1) as CatalogueMark[] })),
            };
            i = table.next;
          } else {
            if (commentsTable) stop("unexpected-line", i, "Comments on marks holds one table.");
            const table = readTable(lines, i, end, COMMENT_COLUMNS);
            for (const row of table.rows) comments.push({ id: row.cells[0], product: row.cells[1], text: row.cells[2] });
            commentsTable = true;
            i = table.next;
          }
        } else {
          i += 1;
        }
      }
      if (!coverage) stop("bad-table-header", sectionIndex, "The product coverage section has no coverage table.");
    } else if (section === SECTION_PRODUCTS) {
      let note: CatalogueNote | null = null;
      let hasTable = false;
      while (i < end) {
        const line = lines[i];
        const kind = kindOf(line);
        if (kind === "heading") {
          note = { title: line.slice(3).trim(), paragraphs: [] };
          notes.push(note);
          i += 1;
        } else if (kind === "table") {
          if (note || hasTable) stop("unexpected-line", i, "The products table comes once, before any note.");
          const table = readTable(lines, i, end, PRODUCT_COLUMNS);
          for (const row of table.rows) {
            products.push({ name: row.cells[0], tier: row.cells[1], specification: row.cells[2], leaving: row.cells[3] });
          }
          hasTable = true;
          i = table.next;
        } else if (kind === "list") {
          if (note) stop("unexpected-line", i, "A list does not belong in a note.");
          pendingProducts.push(line.slice(2).trim());
          i += 1;
        } else {
          if (kind === "prose" && note) note.paragraphs.push(line);
          i += 1;
        }
      }
    } else {
      let hasTable = false;
      while (i < end) {
        const line = lines[i];
        const kind = kindOf(line);
        if (kind === "heading") stop("unknown-section", i, "The evidence section has no sub headings.");
        if (kind === "list") stop("unexpected-line", i, "A list does not belong in the evidence section.");
        if (kind === "table") {
          if (hasTable) stop("unexpected-line", i, "The evidence section holds one table.");
          const table = readTable(lines, i, end, EVIDENCE_COLUMNS);
          for (const row of table.rows) evidence.push({ id: row.cells[0], product: row.cells[1], text: row.cells[2] });
          hasTable = true;
          i = table.next;
        } else {
          if (kind === "prose" && line.startsWith(SOURCES_LABEL)) {
            if (sources !== null) stop("unexpected-line", i, "The sources line appears twice.");
            sources = line.slice(SOURCES_LABEL.length).trim();
          }
          i += 1;
        }
      }
    }
    i = end;
  }

  for (const required of [SECTION_GROUPS, SECTION_PRODUCTS]) {
    if (!seen.has(required)) {
      return { ok: false, errors: [{ code: "missing-section", line: 0, message: `The section "${required}" is missing.` }] };
    }
  }

  const keys = (header.keys ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  const category: ToolCategory = {
    type: header.type ?? "",
    title: header.title ?? "",
    // Header keys are carried as written; the validator checks them.
    keys: keys as CapabilityKey[],
    published: header.published === "true",
    scope: intro[3],
    groups,
    patterns,
    products,
    pendingProducts,
    coverage,
    comments,
    evidence,
    notes,
    sources,
  };
  return { ok: true, category, stated };
}

/** Reads a category file. Never throws: a file it cannot read gives named errors, and `errors` is never empty. */
export function parseCategory(text: string): CatalogueParseResult {
  try {
    return parseText(text);
  } catch (err) {
    if (err instanceof ParseStop) return { ok: false, errors: [err.error] };
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [{ code: "internal", line: 0, message: `The parser stopped on something it did not foresee: ${detail}` }] };
  }
}

// ── Serialiser ───────────────────────────────────────────────────────────────

function tableRow(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function table(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  return [tableRow(columns), `|${"---|".repeat(columns.length)}`, ...rows.map(tableRow)].join("\n");
}

function totalsParagraph(totals: CatalogueTotals): string {
  return (
    `${totals.requirements} requirements: ${totals.small} ${SIZE_SCALE.S.word}, ${totals.medium} ${SIZE_SCALE.M.word}, ${totals.large} ${SIZE_SCALE.L.word}. ` +
    `${totals.baseline} baseline. ` +
    `The whole list is ${totals.all.low} to ${totals.all.high} build days; the baseline alone is ${totals.baselineDays.low} to ${totals.baselineDays.high} days.`
  );
}

/** Writes a category in the one canonical form. The counts, the totals and the legend are computed from the data. */
export function serialiseCategory(category: ToolCategory): string {
  const totals = computeTotals(category);
  const requirements = allRequirements(category);
  const blocks: string[] = [];

  blocks.push(`# ${category.title}${TITLE_SUFFIX}`);
  blocks.push(
    [
      FENCE,
      `type: ${category.type}`,
      `title: ${category.title}`,
      category.keys.length > 0 ? `keys: ${category.keys.join(", ")}` : "keys:",
      `published: ${category.published ? "true" : "false"}`,
      FENCE,
    ].join("\n"),
  );
  blocks.push(`${totals.requirements} requirements in ${totals.groups} groups for ${category.scope}. ${INTRO_TAIL}`);

  const legend = [
    LEGEND_BASELINE,
    `- **Size** is build effort: ${sizeScaleSentence()}.`,
    LEGEND_KEY + (requirements.some((requirement) => requirement.key === NO_KEY) ? LEGEND_KEY_NONE : ""),
  ];
  if (category.coverage) {
    legend.push(`- **Marks**: ${CATALOGUE_MARKS.map((mark) => `${mark} ${MARK_MEANINGS[mark]}`).join(", ")}.`);
  }
  blocks.push(legend.join("\n"));

  blocks.push(`## ${SECTION_GROUPS}`);
  for (const group of category.groups) {
    blocks.push(`### ${group.name}`);
    blocks.push(
      table(
        REQUIREMENT_COLUMNS,
        group.requirements.map((requirement) => [
          requirement.id,
          requirement.text,
          requirement.baseline ? "yes" : "no",
          requirement.size,
          requirement.key,
        ]),
      ),
    );
  }
  blocks.push(`### ${TOTALS_HEADING}`);
  blocks.push(totalsParagraph(totals));

  if (category.patterns.length > 0) {
    blocks.push(`## ${SECTION_PATTERNS}`);
    blocks.push(PATTERNS_PARAGRAPH);
    blocks.push(
      table(
        PATTERN_COLUMNS,
        category.patterns.map((pattern) => [pattern.name, pattern.ids.join(", ")]),
      ),
    );
  }

  if (category.coverage) {
    blocks.push(`## ${SECTION_COVERAGE}`);
    blocks.push(
      table(
        [COVERAGE_ID_COLUMN, ...category.coverage.products],
        category.coverage.rows.map((row) => [row.id, ...row.marks]),
      ),
    );
    if (category.comments.length > 0) {
      blocks.push(`### ${COMMENTS_HEADING}`);
      blocks.push(COMMENTS_PARAGRAPH);
      blocks.push(
        table(
          COMMENT_COLUMNS,
          category.comments.map((comment) => [comment.id, comment.product, comment.text]),
        ),
      );
    }
  }

  blocks.push(`## ${SECTION_PRODUCTS}`);
  if (category.products.length > 0) {
    blocks.push(
      table(
        PRODUCT_COLUMNS,
        category.products.map((product) => [product.name, product.tier, product.specification, product.leaving]),
      ),
    );
  } else {
    blocks.push(NO_PRODUCTS_PARAGRAPH);
  }
  if (category.pendingProducts.length > 0) {
    blocks.push(PENDING_PARAGRAPH);
    blocks.push(category.pendingProducts.map((name) => `- ${name}`).join("\n"));
  }
  for (const note of category.notes) {
    blocks.push(`### ${note.title}`);
    for (const paragraph of note.paragraphs) blocks.push(paragraph);
  }

  if (category.evidence.length > 0 || category.sources !== null) {
    blocks.push(`## ${SECTION_EVIDENCE}`);
    blocks.push(EVIDENCE_PARAGRAPH);
    if (category.evidence.length > 0) {
      blocks.push(
        table(
          EVIDENCE_COLUMNS,
          category.evidence.map((row) => [row.id, row.product, row.text]),
        ),
      );
    }
    if (category.sources !== null) blocks.push(`${SOURCES_LABEL} ${category.sources}`);
  }

  return `${blocks.join("\n\n")}\n`;
}

/** Null when `text` is exactly the canonical form of `category`; otherwise the first line that differs. */
export function canonicalDifference(text: string, category: ToolCategory): CanonicalDifference | null {
  const canonical = serialiseCategory(category);
  if (canonical === text) return null;
  const expected = canonical.split("\n");
  const found = text.split("\n");
  const length = Math.max(expected.length, found.length);
  for (let i = 0; i < length; i += 1) {
    if (expected[i] !== found[i]) return { line: i + 1, expected: expected[i] ?? "", found: found[i] ?? "" };
  }
  return { line: length, expected: "", found: "" };
}

// ── Baseline ─────────────────────────────────────────────────────────────────

function marksById(coverage: CatalogueCoverage): Map<string, readonly string[]> {
  const map = new Map<string, readonly string[]>();
  for (const row of coverage.rows) if (!map.has(row.id)) map.set(row.id, row.marks);
  return map;
}

function isFullForEvery(marks: readonly string[], columns: number): boolean {
  return columns > 0 && marks.length === columns && marks.every((mark) => mark === "F");
}

/**
 * A copy in which a requirement is baseline exactly when every marked
 * product covers it fully. The same flags when nothing is marked. It does
 * not look at the products still to mark: the caller decides whether the
 * rule can be applied yet.
 */
export function applyBaselineRule(category: ToolCategory): ToolCategory {
  const coverage = category.coverage;
  if (!coverage || coverage.products.length === 0) {
    return { ...category, groups: category.groups.map((group) => ({ ...group, requirements: group.requirements.map((r) => ({ ...r })) })) };
  }
  const marks = marksById(coverage);
  return {
    ...category,
    groups: category.groups.map((group) => ({
      ...group,
      requirements: group.requirements.map((requirement) => {
        const row = marks.get(requirement.id);
        return row ? { ...requirement, baseline: isFullForEvery(row, coverage.products.length) } : { ...requirement };
      }),
    })),
  };
}

// ── Validator ────────────────────────────────────────────────────────────────

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function checkCategory(category: ToolCategory, context: ValidateContext, problems: CatalogueProblem[]): void {
  const add = (code: CatalogueProblemCode, where: string, message: string) => problems.push({ code, where, message });
  const dash = (text: string, where: string, what: string) => {
    if (hasLongDash(text)) add("long-dash", where, `${what} holds an en or em dash.`);
  };
  const cell = (text: string, where: string, what: string) => {
    if (!isCellSafe(text)) add("unsafe-text", where, `${what} must not be empty, start or end with a space, or hold a pipe or a line break.`);
    dash(text, where, what);
  };
  const stated = context.stated;
  const totals = computeTotals(category);
  const requirements = allRequirements(category);
  const ids = new Set(requirements.map((requirement) => requirement.id));

  // Header.
  if (stated) {
    for (const field of HEADER_FIELDS) {
      if (!stated.headerFields.includes(field)) add("header-field-missing", "header", `The header has no ${field} line.`);
    }
  }
  if (category.type === "") add("header-field-missing", "header", "type is empty.");
  else if (!CATEGORY_TYPE_RE.test(category.type)) {
    add("bad-type", "header", `type "${category.type}" must be lower case letters, digits and hyphens, starting with a letter.`);
  }
  if (category.title === "") add("header-field-missing", "header", "title is empty.");
  else {
    if (category.title !== category.title.trim() || /[\r\n]/.test(category.title)) add("unsafe-text", "header", "title must be one trimmed line.");
    dash(category.title, "header", "The title");
  }
  if (context.fileName !== undefined && context.fileName !== `${category.type}.md`) {
    add("type-file-mismatch", "header", `type "${category.type}" does not match the file name ${context.fileName}; the file must be ${category.type}.md.`);
  }
  for (const key of category.keys) {
    if (!isCapabilityKey(key)) add("header-key-unknown", "header", `The header key "${key}" is not a capability key in catalogue.ts.`);
  }
  for (const key of duplicates(category.keys)) add("header-key-unknown", "header", `The header key "${key}" is listed more than once.`);

  // Intro.
  if (category.scope === "" || category.scope !== category.scope.trim() || /[\r\n.]/.test(category.scope)) {
    add("unsafe-text", "intro", "The scope phrase must be one trimmed line with no full stop.");
  }
  dash(category.scope, "intro", "The scope phrase");
  if (stated) {
    if (stated.intro.requirements !== totals.requirements) {
      add("intro-count-mismatch", "intro", `The intro states ${stated.intro.requirements} requirements; the file holds ${totals.requirements}.`);
    }
    if (stated.intro.groups !== totals.groups) {
      add("intro-count-mismatch", "intro", `The intro states ${stated.intro.groups} groups; the file holds ${totals.groups}.`);
    }
  }

  // Groups and requirements.
  if (category.groups.length === 0) add("no-requirements", "groups", "The file has no group.");
  for (const name of duplicates(category.groups.map((group) => group.name))) {
    add("group-name", `group ${name}`, `The group name "${name}" is used more than once.`);
  }
  for (const id of duplicates(requirements.map((requirement) => requirement.id))) {
    add("duplicate-id", id, `The id ${id} is used more than once.`);
  }
  const letterOwner = new Map<string, string>();
  for (const group of category.groups) {
    const where = `group ${group.name}`;
    if (!isCellSafe(group.name)) add("group-name", where, "A group name must not be empty, start or end with a space, or hold a pipe or a line break.");
    if (group.name === TOTALS_HEADING) add("group-name", where, `"${TOTALS_HEADING}" is reserved and cannot be a group name.`);
    dash(group.name, where, "The group name");
    if (group.requirements.length === 0) add("no-requirements", where, "The group has no requirement.");

    const letters = new Set<string>();
    for (const requirement of group.requirements) {
      const at = requirement.id === "" ? where : requirement.id;
      if (!REQUIREMENT_ID_RE.test(requirement.id)) {
        add("bad-id", at, `The id "${requirement.id}" must be one capital letter and one digit.`);
      } else {
        letters.add(requirement.id[0]);
      }
      if (sizeBand(requirement.size) === null) add("bad-size", at, `The size "${requirement.size}" must be ${CATALOGUE_SIZES.join(", ")}.`);
      if (requirement.key !== NO_KEY) {
        if (!isCapabilityKey(requirement.key)) {
          add("unknown-key", at, `The key "${requirement.key}" is neither ${NO_KEY} nor a capability key in catalogue.ts.`);
        } else if (!category.keys.includes(requirement.key)) {
          add("key-not-in-header", at, `The key "${requirement.key}" is not listed in the header keys.`);
        }
      }
      if (!isOneSentence(requirement.text)) {
        add(
          "requirement-not-one-sentence",
          at,
          "A requirement is one sentence: it ends with a full stop and holds no other full stop, question mark or exclamation mark.",
        );
      }
      cell(requirement.text, at, "The requirement");
    }
    if (letters.size > 1) add("group-letter-mixed", where, `The ids in this group use more than one letter: ${[...letters].join(", ")}.`);
    for (const letter of letters) {
      const owner = letterOwner.get(letter);
      if (owner !== undefined && owner !== group.name) {
        add("group-letter-shared", where, `The letter ${letter} is already used by the group "${owner}".`);
      } else {
        letterOwner.set(letter, group.name);
      }
    }
  }

  // Totals.
  if (stated) {
    if (stated.totals === null) {
      add("totals-missing", "totals", "The file has no Totals paragraph.");
    } else {
      const figures: [string, number, number][] = [
        ["requirements", stated.totals.requirements, totals.requirements],
        [SIZE_SCALE.S.word, stated.totals.small, totals.small],
        [SIZE_SCALE.M.word, stated.totals.medium, totals.medium],
        [SIZE_SCALE.L.word, stated.totals.large, totals.large],
        ["baseline", stated.totals.baseline, totals.baseline],
        ["whole list low days", stated.totals.allLow, totals.all.low],
        ["whole list high days", stated.totals.allHigh, totals.all.high],
        ["baseline low days", stated.totals.baselineLow, totals.baselineDays.low],
        ["baseline high days", stated.totals.baselineHigh, totals.baselineDays.high],
      ];
      for (const [name, said, computed] of figures) {
        if (said !== computed) add("totals-mismatch", "totals", `Totals: ${name} is stated as ${said}; the computed figure is ${computed}.`);
      }
    }
  }

  // Screen patterns.
  for (const name of duplicates(category.patterns.map((pattern) => pattern.name))) {
    add("pattern-unknown-id", `pattern ${name}`, `The screen pattern "${name}" appears more than once.`);
  }
  for (const pattern of category.patterns) {
    const where = `pattern ${pattern.name}`;
    cell(pattern.name, where, "The screen pattern name");
    if (pattern.ids.length === 0) add("pattern-unknown-id", where, "The screen pattern names no requirement.");
    for (const id of pattern.ids) {
      if (!ids.has(id)) add("pattern-unknown-id", where, `The screen pattern names ${id}, which is not a requirement.`);
    }
    for (const id of duplicates(pattern.ids)) add("pattern-unknown-id", where, `The screen pattern names ${id} more than once.`);
  }

  // Products and coverage.
  const productNames = category.products.map((product) => product.name);
  const marked = new Set(productNames);
  for (const name of duplicates([...productNames, ...category.pendingProducts])) {
    add("product-name", `product ${name}`, `The product name "${name}" is used more than once.`);
  }
  for (const product of category.products) {
    const where = `product ${product.name}`;
    if (product.name === ALL_PRODUCTS) add("product-name", where, `"${ALL_PRODUCTS}" is reserved and cannot be a product name.`);
    cell(product.name, where, "The product name");
    cell(product.tier, where, "The tier");
    cell(product.specification, where, "The specification cell");
    cell(product.leaving, where, "The reasons for leaving");
  }
  for (const name of category.pendingProducts) {
    const where = `product ${name}`;
    if (name === ALL_PRODUCTS) add("product-name", where, `"${ALL_PRODUCTS}" is reserved and cannot be a product name.`);
    cell(name, where, "The name of a product still to mark");
  }

  const coverage = category.coverage;
  if (coverage === null && category.products.length > 0) {
    add("coverage-missing", "coverage", "The products table has rows but there is no coverage table.");
  }
  if (coverage !== null && category.products.length === 0) {
    add("coverage-missing", "coverage", "There is a coverage table but the products table has no rows.");
  }
  if (coverage !== null) {
    const columns = coverage.products;
    if (columns.length !== productNames.length || columns.some((name, i) => name !== productNames[i])) {
      add(
        "coverage-columns",
        "coverage",
        `The coverage columns (${columns.join(", ")}) must be the products table's names in its order (${productNames.join(", ")}).`,
      );
    }
    const rowIds = coverage.rows.map((row) => row.id);
    const rowSet = new Set(rowIds);
    const missing = requirements.filter((requirement) => !rowSet.has(requirement.id)).map((requirement) => requirement.id);
    const extra = [...new Set(rowIds.filter((id) => !ids.has(id)))];
    const repeated = duplicates(rowIds);
    if (missing.length > 0) add("coverage-rows", "coverage", `The coverage table has no row for ${missing.join(", ")}.`);
    if (extra.length > 0) add("coverage-rows", "coverage", `The coverage table has rows for ids that are not requirements: ${extra.join(", ")}.`);
    if (repeated.length > 0) add("coverage-rows", "coverage", `The coverage table has more than one row for ${repeated.join(", ")}.`);
    if (missing.length === 0 && extra.length === 0 && repeated.length === 0) {
      const firstOut = requirements.findIndex((requirement, i) => rowIds[i] !== requirement.id);
      if (firstOut >= 0) {
        add("coverage-rows", "coverage", `The coverage rows are out of order: row ${firstOut + 1} is ${rowIds[firstOut]} and should be ${requirements[firstOut].id}.`);
      }
    }
    for (const row of coverage.rows) {
      if (row.marks.length !== columns.length) {
        add("coverage-rows", row.id, `The coverage row has ${row.marks.length} marks for ${columns.length} products.`);
      }
      row.marks.forEach((mark, i) => {
        if (!(CATALOGUE_MARKS as readonly string[]).includes(mark)) {
          add("bad-mark", row.id, `The mark "${mark}" for ${columns[i] ?? `column ${i + 1}`} must be ${CATALOGUE_MARKS.join(", ")}.`);
        }
      });
    }

    // Baseline is what every product covers fully, so it is only held to the marks once no product is still to mark.
    if (category.products.length > 0 && category.pendingProducts.length === 0) {
      const marks = marksById(coverage);
      for (const requirement of requirements) {
        const row = marks.get(requirement.id);
        if (!row) continue;
        const full = isFullForEvery(row, columns.length);
        if (requirement.baseline && !full) {
          add("baseline-not-all-full", requirement.id, "Flagged baseline, but not every product is marked F.");
        }
        if (!requirement.baseline && full) {
          add("all-full-not-baseline", requirement.id, "Every product is marked F, but the requirement is not flagged baseline.");
        }
      }
    }
  }

  // Comments.
  const commentPairs = new Set<string>();
  for (const comment of category.comments) {
    const where = `comment ${comment.id} ${comment.product}`;
    if (coverage === null) add("comment-reference", where, "There is a comment but no coverage table.");
    if (!ids.has(comment.id)) add("comment-reference", where, `The comment names ${comment.id}, which is not a requirement.`);
    if (comment.product !== ALL_PRODUCTS && !marked.has(comment.product)) {
      add("comment-reference", where, `The comment names "${comment.product}", which is neither a product in the products table nor ${ALL_PRODUCTS}.`);
    }
    const pair = `${comment.id}\n${comment.product}`;
    if (commentPairs.has(pair)) add("comment-reference", where, "There is more than one comment for this id and product.");
    commentPairs.add(pair);
    if (!isOneSentence(comment.text)) {
      add("comment-not-one-sentence", where, "A comment is one sentence: it ends with a full stop and holds no other full stop, question mark or exclamation mark.");
    }
    cell(comment.text, where, "The comment");
  }

  // Notes.
  for (const title of duplicates(category.notes.map((note) => note.title))) {
    add("unsafe-text", `note ${title}`, `The note title "${title}" is used more than once.`);
  }
  for (const note of category.notes) {
    const where = `note ${note.title}`;
    cell(note.title, where, "The note title");
    if (FIXED_HEADINGS.includes(note.title)) add("unsafe-text", where, `"${note.title}" is a fixed heading and cannot be a note title.`);
    for (const paragraph of note.paragraphs) {
      const oneLine = paragraph.length > 0 && paragraph === paragraph.trim() && !/[\r\n]/.test(paragraph);
      const startsLikeMarkup =
        paragraph.startsWith("#") || paragraph.startsWith("|") || paragraph.startsWith("- ") || paragraph.startsWith(FENCE) || paragraph.startsWith(`${SOURCES_LABEL} `);
      if (!oneLine || startsLikeMarkup) {
        add("unsafe-text", where, "A note paragraph must be one trimmed line that does not start like a heading, a table row, a list item, a code fence or the sources line.");
      }
      dash(paragraph, where, "A note paragraph");
    }
  }

  // Evidence.
  const evidencePairs = new Set<string>();
  for (const row of category.evidence) {
    const where = `evidence ${row.id} ${row.product}`;
    if (!ids.has(row.id)) add("evidence-reference", where, `The evidence row names ${row.id}, which is not a requirement.`);
    if (!marked.has(row.product)) {
      add("evidence-reference", where, `The evidence row names "${row.product}", which is not a product in the products table.`);
    }
    const pair = `${row.id}\n${row.product}`;
    if (evidencePairs.has(pair)) add("evidence-reference", where, "There is more than one evidence row for this id and product.");
    evidencePairs.add(pair);
    cell(row.text, where, "The evidence");
  }
  if (category.sources !== null) {
    const sources = category.sources;
    if (sources === "" || sources !== sources.trim() || /[\r\n]/.test(sources)) add("unsafe-text", "sources", "The sources line must be one trimmed line.");
    dash(sources, "sources", "The sources line");
  }

  // Published.
  if (category.published) {
    if (category.products.length === 0) add("published-no-products", "header", "A published category needs at least one marked product.");
    if (category.pendingProducts.length > 0) {
      add("published-pending-products", "header", `A published category has no product still to mark; ${category.pendingProducts.join(", ")} remain.`);
    }
    if (coverage !== null) {
      for (const row of coverage.rows) {
        row.marks.forEach((mark, i) => {
          if (mark !== "F" && mark !== "N") return;
          const product = coverage.products[i];
          if (product === undefined || evidencePairs.has(`${row.id}\n${product}`)) return;
          add("published-missing-evidence", row.id, `A published category needs an evidence row for the ${mark} mark of ${product}.`);
        });
      }
    }
  }
}

/**
 * Every problem in a category, empty when it is sound. Never throws: a
 * value it cannot walk gives one `internal` problem. The rules that hold the
 * file's stated figures against the computed ones run only when
 * `context.stated` is given; a category built in memory has none.
 */
export function validateCategory(category: ToolCategory, context: ValidateContext = {}): CatalogueProblem[] {
  const problems: CatalogueProblem[] = [];
  try {
    checkCategory(category, context, problems);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    problems.push({ code: "internal", where: "category", message: `The category could not be checked: ${detail}` });
  }
  return problems;
}
