/**
 * The catalogue build as a pure function of file names and texts, shared by
 * scripts/catalogue-build.ts and the test that holds the generated module in
 * step with docs/catalogue. Nothing here reads a file, the clock or the
 * machine, so the output is the same bytes everywhere.
 */
import {
  canonicalDifference,
  parseCategory,
  validateCategory,
  type CanonicalDifference,
  type CatalogueParseError,
  type CatalogueProblem,
  type CatalogueTotals,
  type ToolCategory,
} from "../../app/lib/project-builder/tool-catalogue.ts";

export const CATALOGUE_DIR = "docs/catalogue";
export const GENERATED_MODULE_PATH = "app/lib/project-builder/tool-catalogue.generated.ts";

export interface CatalogueSourceFile {
  name: string;
  text: string;
}
/** What stopped one file: its parse errors, or its validator problems and the first line that is not canonical. */
export interface CatalogueFileFailure {
  file: string;
  errors: CatalogueParseError[];
  problems: CatalogueProblem[];
  difference: CanonicalDifference | null;
}
/** Every category with the module text to write, or the failures. Never part of each: one bad file stops the whole build. */
export type CatalogueBuildResult =
  | { ok: true; categories: ToolCategory[]; moduleText: string }
  | { ok: false; failures: CatalogueFileFailure[] };

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const quote = (value: unknown): string => JSON.stringify(value);
const quoteList = (values: readonly string[]): string => `[${values.map(quote).join(", ")}]`;

function listBlock(indent: string, name: string, items: readonly string[]): string[] {
  if (items.length === 0) return [`${indent}${name}: [],`];
  return [`${indent}${name}: [`, ...items.map((item) => `${indent}  ${item},`), `${indent}],`];
}

function renderCategory(category: ToolCategory): string[] {
  const lines: string[] = ["  {"];
  lines.push(`    type: ${quote(category.type)},`);
  lines.push(`    title: ${quote(category.title)},`);
  lines.push(`    keys: ${quoteList(category.keys)},`);
  lines.push(`    published: ${category.published ? "true" : "false"},`);
  lines.push(`    scope: ${quote(category.scope)},`);
  if (category.groups.length === 0) {
    lines.push("    groups: [],");
  } else {
    lines.push("    groups: [");
    for (const group of category.groups) {
      lines.push("      {");
      lines.push(`        name: ${quote(group.name)},`);
      lines.push(
        ...listBlock(
          "        ",
          "requirements",
          group.requirements.map(
            (r) => `{ id: ${quote(r.id)}, text: ${quote(r.text)}, baseline: ${r.baseline ? "true" : "false"}, size: ${quote(r.size)}, key: ${quote(r.key)} }`,
          ),
        ),
      );
      lines.push("      },");
    }
    lines.push("    ],");
  }
  lines.push(
    ...listBlock(
      "    ",
      "patterns",
      category.patterns.map((p) => `{ name: ${quote(p.name)}, ids: ${quoteList(p.ids)} }`),
    ),
  );
  lines.push(
    ...listBlock(
      "    ",
      "products",
      category.products.map(
        (p) => `{ name: ${quote(p.name)}, tier: ${quote(p.tier)}, specification: ${quote(p.specification)}, leaving: ${quote(p.leaving)} }`,
      ),
    ),
  );
  lines.push(`    pendingProducts: ${quoteList(category.pendingProducts)},`);
  if (category.coverage === null) {
    lines.push("    coverage: null,");
  } else {
    lines.push("    coverage: {");
    lines.push(`      products: ${quoteList(category.coverage.products)},`);
    lines.push(
      ...listBlock(
        "      ",
        "rows",
        category.coverage.rows.map((row) => `{ id: ${quote(row.id)}, marks: ${quoteList(row.marks)} }`),
      ),
    );
    lines.push("    },");
  }
  lines.push(
    ...listBlock(
      "    ",
      "comments",
      category.comments.map((c) => `{ id: ${quote(c.id)}, product: ${quote(c.product)}, text: ${quote(c.text)} }`),
    ),
  );
  lines.push(
    ...listBlock(
      "    ",
      "evidence",
      category.evidence.map((e) => `{ id: ${quote(e.id)}, product: ${quote(e.product)}, text: ${quote(e.text)} }`),
    ),
  );
  lines.push(
    ...listBlock(
      "    ",
      "notes",
      category.notes.map((n) => `{ title: ${quote(n.title)}, paragraphs: ${quoteList(n.paragraphs)} }`),
    ),
  );
  lines.push(`    sources: ${category.sources === null ? "null" : quote(category.sources)},`);
  lines.push("  },");
  return lines;
}

function sourceList(names: readonly string[]): string {
  const paths = [...names].sort(byText).map((name) => `${CATALOGUE_DIR}/${name}`);
  if (paths.length === 0) return `${CATALOGUE_DIR}, which holds no category file`;
  if (paths.length === 1) return paths[0];
  return `${paths.slice(0, -1).join(", ")} and ${paths[paths.length - 1]}`;
}

/**
 * The generated module's text. Categories are written in `type` order and
 * every object property by property in the order of the interfaces, so the
 * output does not depend on how the parser built the value. One row of a
 * table is one line, so a one row change in the markdown is a one line
 * change here. No date, path or machine name.
 */
export function renderGeneratedModule(categories: readonly ToolCategory[], sourceNames: readonly string[]): string {
  const ordered = [...categories].sort((a, b) => byText(a.type, b.type));
  const lines: string[] = [
    "/**",
    ` * Generated by scripts/catalogue-build.ts from ${sourceList(sourceNames)}.`,
    " * Do not edit. Change the markdown, then run `npm run catalogue:build`.",
    " */",
    'import type { ToolCategory } from "./tool-catalogue.ts";',
    "",
  ];
  if (ordered.length === 0) {
    lines.push("export const TOOL_CATEGORIES: readonly ToolCategory[] = [];");
  } else {
    lines.push("export const TOOL_CATEGORIES: readonly ToolCategory[] = [");
    for (const category of ordered) lines.push(...renderCategory(category));
    lines.push("];");
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Parses, validates and holds every file to the canonical form. Any parse
 * error, validator problem or canonical difference fails the build and
 * nothing is rendered. A sound file that is not canonical is refused too:
 * the fixed wording is regenerated, not stored, so this is what stops a hand
 * edit to it from being silently dropped.
 */
export function buildCatalogue(files: readonly CatalogueSourceFile[]): CatalogueBuildResult {
  const sorted = [...files].sort((a, b) => byText(a.name, b.name));
  const categories: ToolCategory[] = [];
  const failures: CatalogueFileFailure[] = [];
  for (const file of sorted) {
    const parsed = parseCategory(file.text);
    if (!parsed.ok) {
      failures.push({ file: file.name, errors: parsed.errors, problems: [], difference: null });
      continue;
    }
    const problems = validateCategory(parsed.category, { fileName: file.name, stated: parsed.stated });
    const difference = canonicalDifference(file.text, parsed.category);
    if (problems.length > 0 || difference) {
      failures.push({ file: file.name, errors: [], problems, difference });
      continue;
    }
    categories.push(parsed.category);
  }
  if (failures.length > 0) return { ok: false, failures };
  return {
    ok: true,
    categories: categories.sort((a, b) => byText(a.type, b.type)),
    moduleText: renderGeneratedModule(
      categories,
      sorted.map((file) => file.name),
    ),
  };
}

/** One line per parse error, problem and canonical difference, each starting with the file name. */
export function describeFailures(failures: readonly CatalogueFileFailure[]): string[] {
  const lines: string[] = [];
  for (const failure of failures) {
    for (const error of failure.errors) {
      lines.push(`${failure.file}: [${error.code}]${error.line > 0 ? ` line ${error.line}:` : ""} ${error.message}`);
    }
    for (const problem of failure.problems) lines.push(`${failure.file}: [${problem.code}] ${problem.where}: ${problem.message}`);
    if (failure.difference) {
      const d = failure.difference;
      lines.push(`${failure.file}: [not-canonical] line ${d.line}: expected ${JSON.stringify(d.expected)}, found ${JSON.stringify(d.found)}`);
    }
  }
  return lines;
}

function counted(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The one line the build prints per category. */
export function summaryLine(type: string, totals: CatalogueTotals, marked: number, pending: number, published: boolean): string {
  return (
    `${type}: ${counted(totals.requirements, "requirement")} in ${counted(totals.groups, "group")}, ${totals.baseline} baseline, ` +
    `${counted(marked, "product")} marked, ${pending} still to mark, ${published ? "published" : "not published"}.`
  );
}
