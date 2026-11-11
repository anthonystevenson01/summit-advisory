/**
 * The requirement catalogue format: parser, serialiser, canonical form,
 * validator and the size scale. Pure module, no env, no network.
 *
 * Exact values are asserted on the two fixtures only, which no catalogue
 * edit touches. Every file in docs/catalogue is held to rules instead (it
 * round trips byte for byte, is canonical, is sound, states the totals it
 * computes), and the list is read from the folder, so a correct catalogue
 * edit or a new category never needs a change here. Nothing is written.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import * as format from "../app/lib/project-builder/tool-catalogue.ts";
import {
  CATALOGUE_MARKS,
  CATALOGUE_SIZES,
  SIZE_SCALE,
  applyBaselineRule,
  buildDays,
  canonicalDifference,
  computeTotals,
  hasLongDash,
  isCellSafe,
  isOneSentence,
  parseCategory,
  serialiseCategory,
  sizeScaleSentence,
  validateCategory,
  type CatalogueProblem,
  type CatalogueProblemCode,
  type CatalogueSize,
  type StatedFigures,
  type ToolCategory,
} from "../app/lib/project-builder/tool-catalogue.ts";

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8");

/** Every category file as it stands, whatever it holds today. */
const REAL_FILES: { name: string; text: string }[] = readdirSync(new URL("../docs/catalogue/", import.meta.url))
  .filter((name) => name.endsWith(".md"))
  .sort()
  .map((name) => ({ name, text: read(`../docs/catalogue/${name}`) }));
const TINY = read("./fixtures/catalogue/tiny.md");
const UNMARKED = read("./fixtures/catalogue/tiny-unmarked.md");
const FIXTURES: { name: string; text: string }[] = [
  { name: "tiny.md", text: TINY },
  { name: "tiny-unmarked.md", text: UNMARKED },
];
const ALL_FILES = [...REAL_FILES, ...FIXTURES];
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

function parsed(text: string): { category: ToolCategory; stated: StatedFigures } {
  const result = parseCategory(text);
  if (!result.ok) throw new Error(`expected the text to parse: ${JSON.stringify(result.errors)}`);
  return { category: result.category, stated: result.stated };
}

/** A fresh copy of the fixture, free to alter. */
function tiny(): ToolCategory {
  return structuredClone(parsed(TINY).category);
}

/** Replaces one piece of text and fails when the piece is not there, so a case cannot pass by testing nothing. */
function edit(text: string, from: string, to: string): string {
  assert.ok(text.includes(from), `the text does not hold ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

function errorCode(text: string): string {
  const result = parseCategory(text);
  assert.equal(result.ok, false);
  if (result.ok) return "";
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].message.length > 0);
  return result.errors[0].code;
}

function codes(problems: CatalogueProblem[]): CatalogueProblemCode[] {
  return problems.map((problem) => problem.code);
}

function problemsOf(category: ToolCategory): CatalogueProblemCode[] {
  return codes(validateCategory(category, { fileName: `${category.type}.md` }));
}

function requirement(category: ToolCategory, id: string) {
  const found = category.groups.flatMap((group) => group.requirements).find((r) => r.id === id);
  if (!found) throw new Error(`no requirement ${id}`);
  return found;
}

describe("parseCategory", () => {
  test("the fixture gives every part the format has", () => {
    const { category, stated } = parsed(TINY);
    assert.equal(category.type, "tiny");
    assert.equal(category.title, "Tiny tools");
    assert.deepEqual(category.keys, ["contacts", "tasks"]);
    assert.equal(category.published, true);
    assert.equal(category.scope, "tools that exist only to test the catalogue format");
    assert.deepEqual(
      category.groups.map((group) => [group.name, group.requirements.map((r) => r.id)]),
      [
        ["Alpha records", ["A1", "A2", "A3"]],
        ["Beta work", ["B1", "B2"]],
      ],
    );
    assert.deepEqual(requirement(category, "A3"), {
      id: "A3",
      text: "Import from a spreadsheet with a preview before commit.",
      baseline: false,
      size: "L",
      key: "contacts",
    });
    assert.deepEqual(requirement(category, "A1"), { id: "A1", text: "One record per customer, with notes in one place.", baseline: true, size: "S", key: "contacts" });
    assert.equal(requirement(category, "B2").key, "none");
    assert.deepEqual(category.patterns, [
      { name: "Customer record", ids: ["A1", "A2"] },
      { name: "Task list", ids: ["B1"] },
    ]);
    assert.deepEqual(category.products, [
      { name: "Acme Desk", tier: "Standard", specification: "Yes", leaving: "Price steps between tiers; no import tool." },
      { name: "Borealis Suite", tier: "Team", specification: "Documentation only", leaving: "Slow support; single sign-on missing." },
    ]);
    assert.deepEqual(category.pendingProducts, []);
    assert.deepEqual(category.coverage, {
      products: ["Acme Desk", "Borealis Suite"],
      rows: [
        { id: "A1", marks: ["F", "F"] },
        { id: "A2", marks: ["F", "P"] },
        { id: "A3", marks: ["N", "P"] },
        { id: "B1", marks: ["F", "F"] },
        { id: "B2", marks: ["P", "N"] },
      ],
    });
    assert.deepEqual(category.comments, [
      { id: "A2", product: "Borealis Suite", text: "Pick lists need the higher tier." },
      { id: "A3", product: "all", text: "Neither product shows a preview before commit." },
    ]);
    assert.equal(category.evidence.length, 7);
    assert.deepEqual(category.evidence[0], { id: "A1", product: "Acme Desk", text: "Customers endpoint with notes." });
    assert.deepEqual(category.evidence[6], { id: "B2", product: "Borealis Suite", text: "No single sign-on in any tier." });
    assert.deepEqual(category.notes, [{ title: "Acme tiers", paragraphs: ["Standard: records, fields and tasks. Plus: single sign-on and audit."] }]);
    assert.equal(category.sources, "Acme Desk OpenAPI (example.test), Borealis Suite documentation. Both products are invented for the tests.");
    assert.deepEqual(stated.headerFields, ["type", "title", "keys", "published"]);
    assert.deepEqual(stated.intro, { requirements: 5, groups: 2 });
    assert.deepEqual(stated.totals, { requirements: 5, small: 1, medium: 3, large: 1, baseline: 2, allLow: 16, allHigh: 27, baselineLow: 4, baselineHigh: 7 });
  });

  test("the unmarked fixture has products named and none marked", () => {
    const { category, stated } = parsed(UNMARKED);
    assert.equal(category.type, "tiny-unmarked");
    assert.equal(category.title, "Tiny unmarked tools");
    assert.equal(category.published, false);
    assert.deepEqual(category.keys, ["contacts", "tasks"]);
    assert.equal(category.groups.length, 2);
    assert.equal(category.groups.flatMap((g) => g.requirements).length, 5);
    assert.equal(requirement(category, "A2").baseline, true);
    assert.equal(category.patterns.length, 2);
    assert.deepEqual(category.products, []);
    assert.equal(category.coverage, null);
    assert.deepEqual(category.pendingProducts, ["Cobalt Flow", "Delta Works (orders, stock and returns)"]);
    assert.deepEqual(category.comments, []);
    assert.deepEqual(category.evidence, []);
    assert.deepEqual(category.notes, []);
    assert.equal(category.sources, null);
    assert.deepEqual(stated.headerFields, ["type", "title", "keys", "published"]);
    assert.deepEqual(stated.intro, { requirements: 5, groups: 2 });
    assert.deepEqual(stated.totals, { requirements: 5, small: 1, medium: 3, large: 1, baseline: 3, allLow: 16, allHigh: 27, baselineLow: 7, baselineHigh: 12 });
  });

  test("every category file in docs/catalogue parses, and the two first categories are there", () => {
    const names = REAL_FILES.map((file) => file.name);
    assert.ok(names.includes("sales.md") && names.includes("ordering.md"));
    for (const file of REAL_FILES) {
      const { category } = parsed(file.text);
      assert.equal(`${category.type}.md`, file.name);
      assert.ok(category.groups.length > 0, file.name);
    }
  });

  test("a file it cannot read gives a named error, not an exception", () => {
    assert.equal(errorCode(""), "empty-file");
    assert.equal(errorCode("  \n\n"), "empty-file");
    assert.equal(errorCode("Tiny tools\n"), "missing-title");
    assert.equal(errorCode("# Tiny tools: requirement catalogue\n\n5 requirements in 2 groups for tools.\n"), "missing-header");
    assert.equal(errorCode("# Tiny tools: requirement catalogue\n\n```\ntype: tiny\n"), "missing-header");
    assert.equal(errorCode(edit(TINY, "type: tiny", "type tiny")), "bad-header-line");
    assert.equal(errorCode(edit(TINY, "title: Tiny tools", "owner: someone")), "bad-header-line");
    assert.equal(errorCode(edit(TINY, "published: true", "published: maybe")), "bad-header-value");
    assert.equal(errorCode(edit(TINY, "5 requirements in 2 groups for", "Five requirements for")), "intro-unreadable");
    assert.equal(errorCode(edit(TINY, "## Screen patterns", "## Screens")), "unknown-section");
    assert.equal(errorCode(edit(TINY, "## Evidence", "## Products")), "duplicate-section");
    assert.equal(errorCode(TINY.slice(0, TINY.indexOf("## Products"))), "missing-section");
    assert.equal(errorCode(edit(TINY, "| Screen | Serves |", "| Screen | For |")), "bad-table-header");
    assert.equal(errorCode(edit(TINY, "| A2 | Custom fields on a record, with types and pick lists. | no | M | contacts |", "| A2 | Custom fields. | no | M |")), "bad-table-row");
    assert.equal(errorCode(edit(TINY, "| A2 | F | P |", "| A2 | F |")), "bad-table-row");
    assert.equal(errorCode(edit(TINY, "with types and pick lists. | no |", "with types and pick lists. | maybe |")), "bad-baseline");
    assert.equal(errorCode(edit(TINY, "5 requirements: 1 small, 3 medium, 1 large. 2 baseline. The whole list is 16 to 27 build days; the baseline alone is 4 to 7 days.", "A few requirements.")), "totals-unreadable");
    assert.equal(errorCode(edit(TINY, "### Beta work\n", "- a stray list item\n\n### Beta work\n")), "unexpected-line");
    assert.equal(errorCode(edit(TINY, "## Product coverage\n\n| Id | Acme Desk | Borealis Suite |", "## Product coverage\n\n| Requirement | Acme Desk | Borealis Suite |")), "bad-table-header");
  });

  test("an error carries the line it was found on", () => {
    const result = parseCategory(edit(TINY, "## Screen patterns", "## Screens"));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0].line, TINY.split("\n").indexOf("## Screen patterns") + 1);
  });

  test("it never throws, whatever it is given", () => {
    const junk: unknown[] = [
      "#",
      "# ",
      "# T\n```",
      "```\n```",
      "| a | b |",
      "## Products",
      "# T\n\n```\n```\n\n1 requirements in 1 groups for x.\n\n## Products\n\n|",
      "# T\n\n```\n```\n\n1 requirements in 1 groups for x.\n\n## Groups and requirements\n\n### Totals",
      "\u0000\u0001\u0002",
      TINY.slice(0, 700),
      TINY.split("").reverse().join(""),
      TINY.replace(/\n/g, "\r\n"),
      null,
      undefined,
      42,
      {},
    ];
    for (const input of junk) {
      let result: ReturnType<typeof parseCategory> | undefined;
      assert.doesNotThrow(() => {
        result = parseCategory(input as string);
      });
      assert.ok(result);
      if (!result.ok) assert.ok(result.errors.length > 0);
    }
  });
});

describe("serialiseCategory", () => {
  test("serialise(parse(text)) is the text, byte for byte, for every file in docs/catalogue and both fixtures", () => {
    assert.ok(REAL_FILES.length >= 2);
    for (const { name, text } of ALL_FILES) {
      assert.equal(serialiseCategory(parsed(text).category), text, name);
    }
  });

  test("the intro count and the totals are computed from the data", () => {
    const category = tiny();
    category.groups[1].requirements.push({ id: "B3", text: "An audit log of changes.", baseline: false, size: "L", key: "none" });
    category.coverage?.rows.push({ id: "B3", marks: ["P", "P"] });
    const text = serialiseCategory(category);
    assert.ok(text.includes("6 requirements in 2 groups for tools that exist only to test the catalogue format."));
    assert.ok(text.includes("6 requirements: 1 small, 3 medium, 2 large. 2 baseline. The whole list is 22 to 37 build days; the baseline alone is 4 to 7 days."));
    assert.deepEqual(validateCategory(parsed(text).category, { fileName: "tiny.md", stated: parsed(text).stated }), []);
  });

  test("the legend follows the data: no Marks bullet without coverage, the short Key bullet without a none key", () => {
    const marked = serialiseCategory(tiny());
    assert.ok(marked.includes("- **Marks**: F covered in the assumed tier, P partly or only on a higher tier or add-on, N not covered."));
    assert.ok(marked.includes(`- **Size** is build effort: ${sizeScaleSentence()}.`));
    assert.ok(marked.includes("Connections and admin requirements have none; the builder holds them as connections and guardrails."));

    const unmarked = tiny();
    unmarked.products = [];
    unmarked.coverage = null;
    unmarked.comments = [];
    unmarked.evidence = [];
    unmarked.published = false;
    const withoutMarks = serialiseCategory(unmarked);
    assert.ok(!withoutMarks.includes("**Marks**"));
    assert.ok(!withoutMarks.includes("## Product coverage"));
    assert.ok(withoutMarks.includes("No product is marked yet. Coverage marks are added by the catalogue scripts."));

    const keyed = tiny();
    requirement(keyed, "B2").key = "tasks";
    const shortKey = serialiseCategory(keyed);
    assert.ok(shortKey.includes("- **Key** is the capability key the requirement sits under.\n"));
    assert.ok(!shortKey.includes("Connections and admin requirements have none"));
  });

  test("products named and not yet marked are a list beside the products table, and come back as written", () => {
    const category = tiny();
    category.published = false;
    category.pendingProducts = ["Cobalt Flow", "Delta Works (orders, stock and returns)"];
    const text = serialiseCategory(category);
    assert.ok(text.includes("Still to mark:\n\n- Cobalt Flow\n- Delta Works (orders, stock and returns)\n\n### Acme tiers"));
    assert.deepEqual(parsed(text).category, category);
    assert.equal(canonicalDifference(text, category), null);
  });

  test("it is the same text every time, with no trailing space and one final line end", () => {
    for (const { name, text } of ALL_FILES) {
      const category = parsed(text).category;
      const once = serialiseCategory(category);
      assert.equal(serialiseCategory(category), once, name);
      assert.ok(once.endsWith("\n") && !once.endsWith("\n\n"), name);
      assert.equal(/[ \t]\n/.test(once), false, name);
    }
  });

  test("it adds no long dash and no year of its own: the fixtures hold neither, and neither does their output", () => {
    for (const { name, text } of FIXTURES) {
      const once = serialiseCategory(parsed(text).category);
      assert.equal(hasLongDash(once), false, name);
      assert.equal(/\b(19|20)\d{2}\b/.test(once), false, name);
    }
  });
});

describe("canonicalDifference", () => {
  test("null for every file in docs/catalogue and both fixtures", () => {
    for (const { name, text } of ALL_FILES) assert.equal(canonicalDifference(text, parsed(text).category), null, name);
  });

  test("names the first line of fixed wording that drifted", () => {
    const altered = edit(TINY, "Connections and admin requirements have none; the builder holds them as connections and guardrails.", "Admin requirements have none.");
    const { category } = parsed(altered);
    const difference = canonicalDifference(altered, category);
    assert.equal(difference?.line, 14);
    assert.ok(difference?.expected.includes("Connections and admin requirements have none"));
    assert.ok(difference?.found.endsWith("Admin requirements have none."));
  });

  test("catches spacing and line ends the parser forgives", () => {
    const spaced = edit(TINY, "| A1 | F | F |", "| A1 |  F | F |");
    assert.equal(canonicalDifference(spaced, parsed(spaced).category)?.line, TINY.split("\n").indexOf("| A1 | F | F |") + 1);
    const noFinalNewline = TINY.slice(0, -1);
    assert.notEqual(canonicalDifference(noFinalNewline, parsed(noFinalNewline).category), null);
  });
});

describe("validateCategory", () => {
  test("every file in docs/catalogue and both fixtures are sound, with their stated figures and file names", () => {
    for (const { name, text } of ALL_FILES) {
      const { category, stated } = parsed(text);
      assert.deepEqual(validateCategory(category, { fileName: name, stated }), [], name);
    }
    assert.deepEqual(problemsOf(tiny()), []);
  });

  test("every problem names where it is and says what is wrong", () => {
    const category = tiny();
    requirement(category, "A2").size = "XL" as CatalogueSize;
    const [problem] = validateCategory(category);
    assert.deepEqual({ code: problem.code, where: problem.where }, { code: "bad-size", where: "A2" });
    assert.ok(problem.message.includes("XL"));
  });

  test("header: fields present, type against the file name, keys known and listed once", () => {
    const missing = parsed(edit(TINY, "keys: contacts, tasks\n", ""));
    assert.ok(codes(validateCategory(missing.category, { fileName: "tiny.md", stated: missing.stated })).includes("header-field-missing"));

    const untitled = tiny();
    untitled.title = "";
    assert.ok(problemsOf(untitled).includes("header-field-missing"));

    const shouting = tiny();
    shouting.type = "Tiny";
    assert.ok(problemsOf(shouting).includes("bad-type"));

    assert.deepEqual(codes(validateCategory(tiny(), { fileName: "other.md" })), ["type-file-mismatch"]);

    const unknown = tiny();
    (unknown.keys as string[]).push("nonsense");
    assert.deepEqual(problemsOf(unknown), ["header-key-unknown"]);

    const none = tiny();
    (none.keys as string[]).push("none");
    assert.deepEqual(problemsOf(none), ["header-key-unknown"]);

    const twice = tiny();
    twice.keys.push("tasks");
    assert.deepEqual(problemsOf(twice), ["header-key-unknown"]);
  });

  test("groups: at least one, none empty, names unique and not Totals", () => {
    const empty = tiny();
    empty.groups = [];
    assert.ok(problemsOf(empty).includes("no-requirements"));

    const hollow = tiny();
    hollow.groups.push({ name: "Gamma", requirements: [] });
    assert.deepEqual(problemsOf(hollow), ["no-requirements"]);

    const reserved = tiny();
    reserved.groups[1].name = "Totals";
    assert.deepEqual(problemsOf(reserved), ["group-name"]);

    const repeated = tiny();
    repeated.groups[1].name = "Alpha records";
    assert.deepEqual(problemsOf(repeated), ["group-name"]);
  });

  test("ids: one capital letter and one digit, unique, one letter per group, one group per letter", () => {
    for (const bad of ["A10", "a1", "AA", "1A", ""]) {
      const category = tiny();
      requirement(category, "A3").id = bad;
      assert.ok(problemsOf(category).includes("bad-id"), bad);
    }

    const duplicate = tiny();
    requirement(duplicate, "A3").id = "A1";
    assert.ok(problemsOf(duplicate).includes("duplicate-id"));

    const mixed = tiny();
    requirement(mixed, "A3").id = "C3";
    assert.ok(problemsOf(mixed).includes("group-letter-mixed"));

    const shared = tiny();
    requirement(shared, "B1").id = "A4";
    requirement(shared, "B2").id = "A5";
    const sharedCodes = problemsOf(shared);
    assert.ok(sharedCodes.includes("group-letter-shared"));
    assert.ok(!sharedCodes.includes("group-letter-mixed"));
  });

  test("sizes and keys", () => {
    const size = tiny();
    requirement(size, "A1").size = "XL" as CatalogueSize;
    assert.deepEqual(problemsOf(size), ["bad-size"]);

    const unknown = tiny();
    (requirement(unknown, "A1") as { key: string }).key = "nonsense";
    assert.deepEqual(problemsOf(unknown), ["unknown-key"]);

    const unlisted = tiny();
    requirement(unlisted, "A1").key = "pipeline";
    assert.deepEqual(problemsOf(unlisted), ["key-not-in-header"]);
  });

  test("a requirement is one sentence ending in a full stop, with no en or em dash", () => {
    for (const text of ["Two sentences. In one requirement.", "No full stop at the end", "Is this a requirement?.", "Stop! Now."]) {
      const category = tiny();
      requirement(category, "A1").text = text;
      assert.deepEqual(problemsOf(category), ["requirement-not-one-sentence"], text);
    }
    const colon = tiny();
    requirement(colon, "A1").text = "Activity timeline on every record: calls, emails, meetings; notes (and stage changes).";
    assert.deepEqual(problemsOf(colon), []);

    for (const dash of [EN_DASH, EM_DASH]) {
      const category = tiny();
      requirement(category, "A1").text = `Records ${dash} with notes in one place.`;
      assert.deepEqual(problemsOf(category), ["long-dash"]);
    }
    const dashed = tiny();
    dashed.notes[0].paragraphs[0] = `Standard ${EM_DASH} records only.`;
    dashed.sources = `Acme ${EN_DASH} documentation`;
    assert.deepEqual(problemsOf(dashed), ["long-dash", "long-dash"]);
  });

  test("text that would break the round trip is refused", () => {
    const pipe = tiny();
    requirement(pipe, "A1").text = "Records | with notes in one place.";
    assert.deepEqual(problemsOf(pipe), ["unsafe-text"]);

    const scope = tiny();
    scope.scope = "tools. And more";
    assert.deepEqual(problemsOf(scope), ["unsafe-text"]);

    const note = tiny();
    note.notes[0].paragraphs.push("- a list item");
    assert.deepEqual(problemsOf(note), ["unsafe-text"]);

    const heading = tiny();
    heading.notes[0].title = "Comments on marks";
    assert.deepEqual(problemsOf(heading), ["unsafe-text"]);

    const sources = tiny();
    sources.sources = "one line\nand another";
    assert.deepEqual(problemsOf(sources), ["unsafe-text"]);

    const cell = tiny();
    cell.products[0].tier = " Standard";
    assert.deepEqual(problemsOf(cell), ["unsafe-text"]);
  });

  test("screen patterns, comments and evidence name only ids that exist", () => {
    const pattern = tiny();
    pattern.patterns[0].ids.push("Z9");
    assert.deepEqual(problemsOf(pattern), ["pattern-unknown-id"]);

    const emptyPattern = tiny();
    emptyPattern.patterns[1].ids = [];
    assert.deepEqual(problemsOf(emptyPattern), ["pattern-unknown-id"]);

    const comment = tiny();
    comment.comments[0].id = "Z9";
    assert.deepEqual(problemsOf(comment), ["comment-reference"]);

    const stranger = tiny();
    stranger.comments[0].product = "Borealis";
    assert.deepEqual(problemsOf(stranger), ["comment-reference"]);

    const twice = tiny();
    twice.comments.push({ ...twice.comments[1] });
    assert.deepEqual(problemsOf(twice), ["comment-reference"]);

    const long = tiny();
    long.comments[0].text = "Pick lists need the higher tier. And a second sentence.";
    assert.deepEqual(problemsOf(long), ["comment-not-one-sentence"]);

    const evidence = tiny();
    evidence.published = false;
    evidence.evidence[0].id = "Z9";
    assert.deepEqual(problemsOf(evidence), ["evidence-reference"]);

    const evidenceForAll = tiny();
    evidenceForAll.published = false;
    evidenceForAll.evidence[0].product = "all";
    assert.deepEqual(problemsOf(evidenceForAll), ["evidence-reference"]);

    const evidenceTwice = tiny();
    evidenceTwice.evidence.push({ ...evidenceTwice.evidence[0] });
    assert.deepEqual(problemsOf(evidenceTwice), ["evidence-reference"]);
  });

  test("product names are unique across marked and pending products and none is all", () => {
    const clash = tiny();
    clash.published = false;
    clash.pendingProducts = ["Acme Desk"];
    assert.deepEqual(problemsOf(clash), ["product-name"]);

    const reserved = tiny();
    reserved.published = false;
    reserved.pendingProducts = ["all"];
    assert.deepEqual(problemsOf(reserved), ["product-name"]);
  });

  test("the coverage table has one column per product in the products table and one row per requirement", () => {
    const noTable = tiny();
    noTable.coverage = null;
    noTable.comments = [];
    assert.ok(problemsOf(noTable).includes("coverage-missing"));

    const noProducts = tiny();
    noProducts.products = [];
    assert.ok(problemsOf(noProducts).includes("coverage-missing"));

    const column = tiny();
    if (column.coverage) column.coverage.products[1] = "Borealis";
    assert.ok(problemsOf(column).includes("coverage-columns"));

    const swapped = tiny();
    swapped.coverage?.products.reverse();
    assert.ok(problemsOf(swapped).includes("coverage-columns"));

    const missingRow = tiny();
    missingRow.coverage?.rows.splice(2, 1);
    const missing = validateCategory(missingRow, { fileName: "tiny.md" }).filter((p) => p.code === "coverage-rows");
    assert.equal(missing.length, 1);
    assert.ok(missing[0].message.includes("A3"));

    const repeatedRow = tiny();
    repeatedRow.coverage?.rows.push({ id: "A1", marks: ["F", "F"] });
    assert.ok(problemsOf(repeatedRow).includes("coverage-rows"));

    const extraRow = tiny();
    extraRow.coverage?.rows.push({ id: "Z9", marks: ["F", "F"] });
    assert.ok(problemsOf(extraRow).includes("coverage-rows"));

    const outOfOrder = tiny();
    outOfOrder.coverage?.rows.reverse();
    assert.deepEqual(problemsOf(outOfOrder), ["coverage-rows"]);

    const mark = tiny();
    if (mark.coverage) (mark.coverage.rows[1].marks as string[])[1] = "X";
    assert.deepEqual(problemsOf(mark), ["bad-mark"]);
  });

  test("baseline is what every product covers fully, in both directions", () => {
    const flagged = tiny();
    requirement(flagged, "A2").baseline = true;
    assert.deepEqual(problemsOf(flagged), ["baseline-not-all-full"]);
    assert.equal(validateCategory(flagged)[0].where, "A2");

    const unflagged = tiny();
    requirement(unflagged, "A1").baseline = false;
    assert.deepEqual(problemsOf(unflagged), ["all-full-not-baseline"]);
  });

  test("while a product is still to mark the rule cannot be judged, so the stated flags stand", () => {
    const partMarked = tiny();
    partMarked.published = false;
    partMarked.pendingProducts = ["Cobalt Flow"];
    requirement(partMarked, "A2").baseline = true;
    requirement(partMarked, "A1").baseline = false;
    assert.deepEqual(problemsOf(partMarked), []);

    partMarked.pendingProducts = [];
    assert.deepEqual(problemsOf(partMarked).sort(), ["all-full-not-baseline", "baseline-not-all-full"]);
  });

  test("a category with no marks keeps the flags its file states", () => {
    const { category, stated } = parsed(UNMARKED);
    assert.equal(computeTotals(category).baseline, 3);
    assert.deepEqual(validateCategory(category, { fileName: "tiny-unmarked.md", stated }), []);
    const none = structuredClone(category);
    none.pendingProducts = [];
    assert.deepEqual(validateCategory(none, { fileName: "tiny-unmarked.md" }), []);
  });

  test("the stated counts and totals equal the computed ones, figure by figure", () => {
    for (const [from, to] of [
      ["5 requirements in 2 groups", "6 requirements in 2 groups"],
      ["5 requirements in 2 groups", "5 requirements in 3 groups"],
    ]) {
      const { category, stated } = parsed(edit(TINY, from, to));
      const problems = validateCategory(category, { fileName: "tiny.md", stated });
      assert.deepEqual(codes(problems), ["intro-count-mismatch"]);
      assert.ok(/states \d+ .*holds \d+/.test(problems[0].message));
    }

    const { category, stated } = parsed(TINY);
    assert.ok(stated.totals);
    const figures = Object.keys(stated.totals) as (keyof NonNullable<StatedFigures["totals"]>)[];
    assert.equal(figures.length, 9);
    for (const figure of figures) {
      const off: StatedFigures = { ...stated, totals: { ...stated.totals, [figure]: stated.totals[figure] + 1 } };
      const problems = validateCategory(category, { fileName: "tiny.md", stated: off });
      assert.deepEqual(codes(problems), ["totals-mismatch"], figure);
      assert.ok(problems[0].message.includes(String(stated.totals[figure])), figure);
    }

    const text = edit(TINY, "2 baseline.", "3 baseline.");
    assert.deepEqual(codes(validateCategory(parsed(text).category, { fileName: "tiny.md", stated: parsed(text).stated })), ["totals-mismatch"]);

    const withoutTotals = edit(TINY, "### Totals\n\n5 requirements: 1 small, 3 medium, 1 large. 2 baseline. The whole list is 16 to 27 build days; the baseline alone is 4 to 7 days.\n\n", "");
    assert.deepEqual(codes(validateCategory(parsed(withoutTotals).category, { fileName: "tiny.md", stated: parsed(withoutTotals).stated })), ["totals-missing"]);
  });

  test("a category built in memory has no stated figures and is not held to them", () => {
    assert.deepEqual(validateCategory(tiny()), []);
  });

  test("published: every F and N has evidence, a product is marked and none is still to mark", () => {
    const missing = tiny();
    const removed = missing.evidence.splice(0, 1)[0];
    const problems = validateCategory(missing, { fileName: "tiny.md" });
    assert.deepEqual(codes(problems), ["published-missing-evidence"]);
    assert.equal(problems[0].where, removed.id);
    assert.ok(problems[0].message.includes(removed.product));

    missing.published = false;
    assert.deepEqual(problemsOf(missing), []);

    const partly = tiny();
    partly.evidence = partly.evidence.filter((row) => !(row.id === "B2" && row.product === "Borealis Suite"));
    assert.deepEqual(problemsOf(partly), ["published-missing-evidence"]);

    const noProducts = tiny();
    noProducts.products = [];
    noProducts.coverage = null;
    noProducts.comments = [];
    noProducts.evidence = [];
    assert.deepEqual(problemsOf(noProducts), ["published-no-products"]);

    const pending = tiny();
    pending.pendingProducts = ["Cobalt Flow"];
    assert.deepEqual(problemsOf(pending), ["published-pending-products"]);
  });

  test("it never throws on a broken value", () => {
    const broken = { type: "tiny" } as unknown as ToolCategory;
    let problems: CatalogueProblem[] = [];
    assert.doesNotThrow(() => {
      problems = validateCategory(broken);
    });
    assert.deepEqual(codes(problems), ["internal"]);
    assert.equal(problems[0].where, "category");
    for (const junk of [null, undefined, 42, "text", []]) {
      assert.deepEqual(codes(validateCategory(junk as unknown as ToolCategory)), ["internal"]);
    }
  });
});

describe("applyBaselineRule", () => {
  test("flags exactly the requirements every product covers fully, and returns a copy", () => {
    const category = tiny();
    requirement(category, "A1").baseline = false;
    requirement(category, "B2").baseline = true;
    const ruled = applyBaselineRule(category);
    assert.deepEqual(
      ruled.groups.flatMap((g) => g.requirements).map((r) => [r.id, r.baseline]),
      [["A1", true], ["A2", false], ["A3", false], ["B1", true], ["B2", false]],
    );
    assert.equal(requirement(category, "A1").baseline, false);
    assert.notEqual(ruled.groups[0].requirements[0], category.groups[0].requirements[0]);
  });

  test("leaves the flags alone when nothing is marked", () => {
    const { category } = parsed(UNMARKED);
    assert.deepEqual(applyBaselineRule(category), category);
  });
});

describe("the size scale", () => {
  test("lives in one constant: S, M and L with their day ranges", () => {
    assert.deepEqual(SIZE_SCALE, {
      S: { word: "small", low: 1, high: 2 },
      M: { word: "medium", low: 3, high: 5 },
      L: { word: "large", low: 6, high: 10 },
    });
    assert.deepEqual(CATALOGUE_SIZES, ["S", "M", "L"]);
    assert.deepEqual(CATALOGUE_MARKS, ["F", "P", "N"]);
    assert.equal(sizeScaleSentence(), "S 1 to 2 days, M 3 to 5 days, L 6 to 10 days");
  });

  test("buildDays returns the low and high days for any list of requirements", () => {
    assert.deepEqual(buildDays([]), { low: 0, high: 0 });
    assert.deepEqual(buildDays([{ size: "S" }]), { low: 1, high: 2 });
    assert.deepEqual(buildDays([{ size: "S" }, { size: "M" }, { size: "M" }, { size: "L" }]), { low: 13, high: 22 });
    assert.deepEqual(buildDays([{ size: "XL" as CatalogueSize }, { size: "constructor" as CatalogueSize }, { size: "L" }]), { low: 6, high: 10 });
  });

  test("computeTotals counts the fixture exactly", () => {
    assert.deepEqual(computeTotals(parsed(TINY).category), {
      requirements: 5,
      groups: 2,
      small: 1,
      medium: 3,
      large: 1,
      baseline: 2,
      all: { low: 16, high: 27 },
      baselineDays: { low: 4, high: 7 },
    });
    assert.deepEqual(computeTotals(parsed(UNMARKED).category).baselineDays, { low: 7, high: 12 });
  });

  test("every file in docs/catalogue states the totals it computes", () => {
    for (const { name, text } of REAL_FILES) {
      const { category, stated } = parsed(text);
      const totals = computeTotals(category);
      assert.deepEqual(stated.intro, { requirements: totals.requirements, groups: totals.groups }, name);
      assert.deepEqual(
        stated.totals,
        {
          requirements: totals.requirements,
          small: totals.small,
          medium: totals.medium,
          large: totals.large,
          baseline: totals.baseline,
          allLow: totals.all.low,
          allHigh: totals.all.high,
          baselineLow: totals.baselineDays.low,
          baselineHigh: totals.baselineDays.high,
        },
        name,
      );
      assert.equal(totals.small + totals.medium + totals.large, totals.requirements, name);
      assert.deepEqual(totals.all, buildDays(category.groups.flatMap((group) => group.requirements)), name);
    }
  });

  test("no day range is written out in any new source file: the legend and the prompts build it from the scale", () => {
    const folder = (relative: string) =>
      readdirSync(new URL(relative, import.meta.url))
        .filter((name) => name.endsWith(".ts"))
        .map((name) => `${relative}${name}`);
    const sources = [
      "../app/lib/project-builder/tool-catalogue.ts",
      "../app/lib/project-builder/tool-catalogue.generated.ts",
      "../app/lib/project-builder/tool-catalogue-read.ts",
      ...folder("../scripts/catalogue/"),
      ...folder("../scripts/").filter((path) => path.includes("/catalogue-")),
    ];
    assert.ok(sources.length >= 12, `expected the twelve new source files, found ${sources.length}`);
    for (const path of sources) {
      const text = read(path);
      for (const phrase of ["1 to 2", "3 to 5", "6 to 10"]) assert.ok(!text.includes(phrase), `${path} holds "${phrase}"`);
      assert.equal(hasLongDash(text), false, `${path} holds an en or em dash`);
    }
  });
});

describe("the shared text rules", () => {
  test("isOneSentence, hasLongDash and isCellSafe", () => {
    assert.equal(isOneSentence("One sentence."), true);
    assert.equal(isOneSentence("One: with a colon; and a semicolon."), true);
    assert.equal(isOneSentence("Version 2.0 of the thing."), false);
    assert.equal(isOneSentence("No stop"), false);
    assert.equal(isOneSentence(""), false);
    assert.equal(hasLongDash(`a ${EN_DASH} b`), true);
    assert.equal(hasLongDash(`a ${EM_DASH} b`), true);
    assert.equal(hasLongDash("a - b"), false);
    assert.equal(isCellSafe("Plain text"), true);
    assert.equal(isCellSafe(""), false);
    assert.equal(isCellSafe(" padded"), false);
    assert.equal(isCellSafe("a | b"), false);
    assert.equal(isCellSafe("a\nb"), false);
  });

  test("no exported string of the format module and no line of any file in docs/catalogue holds a long dash", () => {
    const visit = (value: unknown, path: string, seen = new Set<unknown>()): void => {
      if (typeof value === "string") {
        assert.equal(hasLongDash(value), false, path);
        return;
      }
      if (value === null || typeof value !== "object" || value instanceof RegExp || seen.has(value)) return;
      seen.add(value);
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) visit(child, `${path}.${key}`, seen);
    };
    visit({ ...format }, "tool-catalogue");
    for (const { name, text } of REAL_FILES) {
      for (const [index, line] of text.split("\n").entries()) assert.equal(hasLongDash(line), false, `${name} line ${index + 1}`);
    }
  });
});
