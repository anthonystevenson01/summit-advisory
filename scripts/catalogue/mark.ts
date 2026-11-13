/**
 * The mark script's pure half: the JSON schema, the prompt, the parser that
 * holds the answer to the rules, the merge of one product's marks into a
 * category, and the lines the dry run prints. No file, network or model
 * access.
 *
 * The merge writes one product's column, product row, comments and evidence
 * and nothing else. It never changes a requirement's id, text, size or key,
 * another product's column, or the published flag. Baseline is what every
 * product covers fully, so the flags are recomputed from the marks only when
 * the product just marked leaves no product still to mark; until then the
 * flags the file states stand.
 */
import { DATA_GUARD } from "../../app/lib/project-builder/prompts.ts";
import {
  CATALOGUE_MARKS,
  CATEGORY_TYPE_RE,
  MARK_MEANINGS,
  applyBaselineRule,
  hasLongDash,
  isCellSafe,
  isOneSentence,
  type CatalogueCoverage,
  type CatalogueMark,
  type CatalogueProduct,
  type ToolCategory,
} from "../../app/lib/project-builder/tool-catalogue.ts";
import type { JsonSchema, NamedSchema } from "../../app/lib/tools/schema.ts";
import { fenced, fencedPage, rejection } from "./draft.ts";
import type { FetchedPage, ScriptArgSpec } from "./io.ts";

/** The longest evidence or comment the parser accepts, in characters. It keeps a table row readable and a full answer inside the key's token cap. */
export const MARK_TEXT_CAP = 300;
export const MARK_URLS_MAX = 6;

/** A type, a product name, then the documentation URLs, which may be left out when `--answer` gives a saved answer to apply. */
export const MARK_ARG_SPEC: ScriptArgSpec = {
  positionals: [
    { name: "type", pattern: CATEGORY_TYPE_RE, hint: "lower case letters, digits and hyphens, starting with a letter." },
    { name: "product name" },
  ],
  rest: { name: "documentation URLs", min: 1, max: MARK_URLS_MAX, kind: "url", optionalWith: "answer" },
  switches: ["dry-run"],
  options: ["spec", "tier", "answer"],
};

export const MARK_USAGE =
  'Usage: npm run catalogue:mark -- <type> "<product name>" <url> [<url> ...] [--spec <path>] [--tier "<tier>"] [--dry-run] [--answer <path>]';

// ── Schema ───────────────────────────────────────────────────────────────────

function obj(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

function text(description: string): JsonSchema {
  return { type: "string", description };
}

/** Every property is required, as strict mode asks; evidence and comment are empty strings when there is nothing to say. */
export function markSchema(ids: readonly string[]): NamedSchema {
  return {
    name: "catalogue_mark",
    strict: true,
    schema: obj({
      tier: text("The tier the marks assume."),
      specification: text("A few words on what the product publishes about its API."),
      leaving: text("The two or three usual reasons people leave the product, in one sentence."),
      marks: {
        type: "array",
        description: "One row per requirement id, each exactly once.",
        items: obj({
          id: { type: "string", enum: [...ids], description: "The requirement id." },
          mark: { type: "string", enum: [...CATALOGUE_MARKS], description: "F, P or N." },
          evidence: text("One or two short sentences; required for F and N, otherwise empty when there is none."),
          comment: text("One sentence, only when the mark needs qualifying; otherwise empty."),
        }),
      },
    }),
  };
}

// ── Prompt ───────────────────────────────────────────────────────────────────

export interface MarkPromptInput {
  category: ToolCategory;
  productName: string;
  /** The tier given on the command line, or null. */
  tier: string | null;
  /** The product's row when it is already in the file, or null. */
  stored: CatalogueProduct | null;
  pages: readonly FetchedPage[];
  /** The spec check listing, or null. */
  specListing: string | null;
}

const CHOOSE_TIER = "choose and state it";

/** The system turn holds the rules; the category, the product, the requirements, the listing and the pages sit in the user turn. */
export function buildMarkPrompt(input: MarkPromptInput): { system: string; user: string } {
  const system = [
    "You mark one product against every requirement of a category of business software, from the product's own documentation.",
    "",
    "Marks:",
    ...CATALOGUE_MARKS.map((mark) => `- ${mark}: ${MARK_MEANINGS[mark]}.`),
    "",
    "Tier: state the tier the marks assume in the tier field. When a tier to assume is given below, use it.",
    "",
    'Evidence: an endpoint, a documentation page or "product knowledge", in one or two short sentences. It is required for every F and every N. For a P it is welcome and may be left empty.',
    "",
    "Specification: when a specification listing is given, an endpoint present supports F. An endpoint absent is a reason to check the documentation, never proof of N.",
    "",
    "Sources, in order of trust: the product's public API specification or index; its documentation; its pricing page for tiers; its feature pages last. Review sites are not sources.",
    "",
    "Comment: only when the mark needs qualifying, in one sentence that ends with a full stop and holds no other full stop, question mark or exclamation mark. Leave it empty otherwise. Aim for fewer than 20 comments for the product.",
    "",
    "Product fields: tier is the tier the marks assume; specification is a few words on what the product publishes about its API; leaving is the two or three usual reasons people leave the product, in one sentence, with no opinion words.",
    "",
    "Give one row for every requirement id below, each exactly once.",
    "",
    `Keep every evidence and comment under ${MARK_TEXT_CAP} characters. British spelling. No em or en dashes. Reply with only JSON in the given shape.`,
    "",
    DATA_GUARD,
  ].join("\n");

  const tier = input.tier ?? input.stored?.tier ?? CHOOSE_TIER;
  const requirementLines: string[] = [];
  for (const group of input.category.groups) {
    requirementLines.push("", group.name);
    for (const requirement of group.requirements) requirementLines.push(`${requirement.id}: ${requirement.text}`);
  }
  const parts = [
    `Category: ${input.category.title}`,
    `Product: ${input.productName}`,
    `Tier to assume: ${tier}`,
    "",
    "Requirements:",
    ...requirementLines,
  ];
  if (input.specListing !== null) {
    parts.push("", fenced("Specification listing:", input.specListing));
  }
  if (input.pages.length > 0) {
    parts.push("", "Documentation pages:", "", input.pages.map(fencedPage).join("\n\n"));
  }
  return { system, user: parts.join("\n") };
}

// ── Answer parser ────────────────────────────────────────────────────────────

/** One requirement's mark as the parser hands it on: an empty evidence or comment has become null. */
export interface MarkRow {
  id: string;
  mark: CatalogueMark;
  evidence: string | null;
  comment: string | null;
}
/** An accepted answer: the product's three header fields and one row per requirement, in requirement order. The product name is not in it; that comes from the command line. */
export interface MarkAnswer {
  tier: string;
  specification: string;
  leaving: string;
  marks: MarkRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Holds the model's answer to the rules and returns the rows in requirement
 * order, with an empty evidence or comment turned to null. Throws one
 * SchemaError listing every violation.
 */
export function parseMarkAnswer(raw: unknown, ids: readonly string[]): MarkAnswer {
  if (!isRecord(raw)) throw rejection("Mark answer", ["the answer is not an object"]);
  const violations: string[] = [];
  const field = (name: "tier" | "specification" | "leaving"): string => {
    const value = typeof raw[name] === "string" ? (raw[name] as string).trim() : "";
    if (!isCellSafe(value)) violations.push(`${name} is empty or holds a pipe or a line break`);
    if (hasLongDash(value)) violations.push(`${name} holds an en or em dash`);
    return value;
  };
  const tier = field("tier");
  const specification = field("specification");
  const leaving = field("leaving");

  if (!Array.isArray(raw.marks)) {
    violations.push("marks is missing");
    throw rejection("Mark answer", violations);
  }
  const known = new Set(ids);
  const rows = new Map<string, MarkRow>();
  const free = (value: unknown, at: string, what: string): string | null => {
    const cleaned = typeof value === "string" ? value.trim() : "";
    if (cleaned === "") return null;
    if (/[|\r\n]/.test(cleaned)) violations.push(`${at} has ${what} that holds a pipe or a line break`);
    if (hasLongDash(cleaned)) violations.push(`${at} has ${what} that holds an en or em dash`);
    if (cleaned.length > MARK_TEXT_CAP) violations.push(`${at} has ${what} longer than ${MARK_TEXT_CAP} characters`);
    return cleaned;
  };

  (raw.marks as unknown[]).forEach((rawRow, index) => {
    if (!isRecord(rawRow)) {
      violations.push(`row ${index + 1} is not an object`);
      return;
    }
    const id = typeof rawRow.id === "string" ? rawRow.id.trim() : "";
    const at = id === "" ? `row ${index + 1}` : id;
    if (!known.has(id)) {
      violations.push(`${at} is not a requirement id of this category`);
      return;
    }
    if (rows.has(id)) {
      violations.push(`${id} is given more than once`);
      return;
    }
    const mark = rawRow.mark;
    const markOk = typeof mark === "string" && (CATALOGUE_MARKS as readonly string[]).includes(mark);
    if (!markOk) violations.push(`${id} has a mark outside ${CATALOGUE_MARKS.join(", ")}`);
    const evidence = free(rawRow.evidence, id, "evidence");
    const comment = free(rawRow.comment, id, "a comment");
    if (markOk && (mark === "F" || mark === "N") && evidence === null) violations.push(`${id} is marked ${mark} with no evidence`);
    if (comment !== null && !isOneSentence(comment)) violations.push(`${id} has a comment that is not one sentence ending in a full stop`);
    rows.set(id, { id, mark: mark as CatalogueMark, evidence, comment });
  });
  const missing = ids.filter((id) => !rows.has(id));
  if (missing.length > 0) violations.push(`no row for ${missing.join(", ")}`);

  if (violations.length > 0) throw rejection("Mark answer", violations);
  return { tier, specification, leaving, marks: ids.map((id) => rows.get(id) as MarkRow) };
}

// ── Merge ────────────────────────────────────────────────────────────────────

/**
 * A new category with one product's marks written in. The product row is
 * replaced in place or appended (and its name taken off the still to mark
 * list); its coverage column is replaced or appended last; its comments and
 * evidence rows are replaced, in requirement order, after the rows that
 * stay. Baseline flags are recomputed only when no product is left to mark.
 */
export function applyProductMarks(category: ToolCategory, productName: string, answer: MarkAnswer): ToolCategory {
  const markOf = new Map(answer.marks.map((row) => [row.id, row.mark]));
  const mark = (id: string): CatalogueMark => {
    const value = markOf.get(id);
    if (value === undefined) throw new Error(`The answer has no mark for ${id}.`);
    return value;
  };

  const row: CatalogueProduct = { name: productName, tier: answer.tier, specification: answer.specification, leaving: answer.leaving };
  const existing = category.products.findIndex((product) => product.name === productName);
  const products = existing >= 0 ? category.products.map((product, i) => (i === existing ? row : { ...product })) : [...category.products.map((p) => ({ ...p })), row];
  const pendingProducts = existing >= 0 ? [...category.pendingProducts] : category.pendingProducts.filter((name) => name !== productName);

  const requirementIds = category.groups.flatMap((group) => group.requirements.map((requirement) => requirement.id));
  let coverage: CatalogueCoverage;
  if (category.coverage === null) {
    coverage = { products: [productName], rows: requirementIds.map((id) => ({ id, marks: [mark(id)] })) };
  } else {
    const column = category.coverage.products.indexOf(productName);
    coverage =
      column >= 0
        ? {
            products: [...category.coverage.products],
            rows: category.coverage.rows.map((r) => ({ id: r.id, marks: r.marks.map((m, i) => (i === column ? mark(r.id) : m)) })),
          }
        : {
            products: [...category.coverage.products, productName],
            rows: category.coverage.rows.map((r) => ({ id: r.id, marks: [...r.marks, mark(r.id)] })),
          };
  }

  const comments = [
    ...category.comments.filter((comment) => comment.product !== productName).map((comment) => ({ ...comment })),
    ...answer.marks.filter((r) => r.comment !== null).map((r) => ({ id: r.id, product: productName, text: r.comment as string })),
  ];
  const evidence = [
    ...category.evidence.filter((e) => e.product !== productName).map((e) => ({ ...e })),
    ...answer.marks.filter((r) => r.evidence !== null).map((r) => ({ id: r.id, product: productName, text: r.evidence as string })),
  ];

  const next: ToolCategory = {
    ...category,
    keys: [...category.keys],
    groups: category.groups.map((group) => ({ name: group.name, requirements: group.requirements.map((requirement) => ({ ...requirement })) })),
    patterns: category.patterns.map((pattern) => ({ name: pattern.name, ids: [...pattern.ids] })),
    products,
    pendingProducts,
    coverage,
    comments,
    evidence,
    notes: category.notes.map((note) => ({ title: note.title, paragraphs: [...note.paragraphs] })),
  };
  return pendingProducts.length === 0 ? applyBaselineRule(next) : next;
}

/**
 * A warning when `productName` is the only product marked and no product is
 * still to mark, or null. Baseline is what every product covers fully, so
 * with one product and an empty list every flag has just been set from that
 * product alone. The fix is to name the others in the still to mark list.
 */
export function soleProductWarning(after: ToolCategory, productName: string): string | null {
  if (after.pendingProducts.length > 0) return null;
  if (after.products.length !== 1 || after.products[0].name !== productName) return null;
  return (
    `Warning: ${productName} is the only product marked and no product is still to mark, so every baseline flag is set from this one product alone. ` +
    "Name the category's other products in the still to mark list before the baseline is relied on."
  );
}

// ── The dry run's lines ──────────────────────────────────────────────────────

function flagsOf(category: ToolCategory): Map<string, boolean> {
  return new Map(category.groups.flatMap((group) => group.requirements.map((requirement) => [requirement.id, requirement.baseline] as const)));
}

function flagChanges(from: ToolCategory, to: ToolCategory): string[] {
  const before = flagsOf(from);
  const lines: string[] = [];
  for (const [id, flag] of flagsOf(to)) {
    const was = before.get(id);
    if (was !== undefined && was !== flag) lines.push(`  ${id}  ${was ? "yes" : "no"} to ${flag ? "yes" : "no"}`);
  }
  return lines;
}

function columnOf(category: ToolCategory, productName: string): Map<string, string> | null {
  const coverage = category.coverage;
  const column = coverage ? coverage.products.indexOf(productName) : -1;
  if (!coverage || column < 0) return null;
  return new Map(coverage.rows.map((row) => [row.id, row.marks[column]]));
}

function textsOf(rows: readonly { id: string; product: string; text: string }[], productName: string): Map<string, string> {
  return new Map(rows.filter((row) => row.product === productName).map((row) => [row.id, row.text]));
}

function compare(before: Map<string, string>, after: Map<string, string>): { added: string[]; removed: string[]; changed: string[] } {
  const added = [...after.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const changed = [...after.keys()].filter((id) => before.has(id) && before.get(id) !== after.get(id));
  return { added, removed, changed };
}

/**
 * What marking `productName` changes, as the lines the script prints with or
 * without `--dry-run`. `after` is `applyProductMarks(before, productName, answer)`.
 */
export function diffProductMarks(before: ToolCategory, after: ToolCategory, productName: string): string[] {
  const lines: string[] = [`catalogue-mark: ${after.type}, ${productName}`];

  const was = before.products.find((product) => product.name === productName) ?? null;
  const now = after.products.find((product) => product.name === productName) ?? null;
  if (was === null) {
    lines.push("Product row: new");
  } else if (now !== null) {
    const fields = (["tier", "specification", "leaving"] as const).filter((name) => was[name] !== now[name]);
    lines.push(
      fields.length === 0 ? "Product row: unchanged" : `Product row: changed (${fields.map((name) => `${name}: "${was[name]}" to "${now[name]}"`).join("; ")})`,
    );
  }

  const marksBefore = columnOf(before, productName);
  const marksAfter = columnOf(after, productName) ?? new Map<string, string>();
  const count = (mark: CatalogueMark) => [...marksAfter.values()].filter((value) => value === mark).length;
  const counts = CATALOGUE_MARKS.map((mark) => `${count(mark)} ${mark}`).join(", ");
  if (marksBefore === null) {
    lines.push(`Marks: ${counts}. New column.`);
  } else {
    const moved = [...marksAfter.entries()].filter(([id, mark]) => marksBefore.get(id) !== mark);
    lines.push(`Marks: ${counts}. ${moved.length} changed.`);
    for (const [id, mark] of moved) lines.push(`  ${id}  ${marksBefore.get(id) ?? "none"} to ${mark}`);
  }

  const commentsBefore = textsOf(before.comments, productName);
  const commentsAfter = textsOf(after.comments, productName);
  const comments = compare(commentsBefore, commentsAfter);
  lines.push(`Comments: ${comments.added.length} added, ${comments.removed.length} removed, ${comments.changed.length} changed.`);
  for (const id of comments.added) lines.push(`  + ${id}  ${commentsAfter.get(id)}`);
  for (const id of comments.removed) lines.push(`  - ${id}  ${commentsBefore.get(id)}`);
  for (const id of comments.changed) lines.push(`  ~ ${id}  ${commentsAfter.get(id)}`);

  const evidence = compare(textsOf(before.evidence, productName), textsOf(after.evidence, productName));
  lines.push(`Evidence: ${evidence.added.length} added, ${evidence.removed.length} removed, ${evidence.changed.length} changed.`);

  if (after.pendingProducts.length === 0) {
    const changes = flagChanges(before, after);
    lines.push(`Baseline flags: ${changes.length} changed.`, ...changes);
  } else {
    const changes = flagChanges(after, applyBaselineRule(after));
    lines.push(
      `Baseline flags: not applied yet, ${after.pendingProducts.length} still to mark (${after.pendingProducts.join(", ")}). ` +
        `If the remaining products agreed with the marks so far, ${changes.length} would change.`,
      ...changes,
    );
  }

  if (before.pendingProducts.includes(productName) && !after.pendingProducts.includes(productName)) {
    lines.push(`Still to mark: ${productName} removed from the list.`);
  }
  const warning = soleProductWarning(after, productName);
  if (warning !== null) lines.push(warning);
  return lines;
}
