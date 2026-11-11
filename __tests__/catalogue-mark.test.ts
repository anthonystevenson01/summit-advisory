/**
 * The mark script's pure half: the prompt, the schema, the answer parser,
 * the merge of one product's marks into a category, and the lines the dry
 * run prints. No network, no model call, nothing written.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DATA_GUARD } from "../app/lib/project-builder/prompts.ts";
import {
  hasLongDash,
  parseCategory,
  serialiseCategory,
  validateCategory,
  type CatalogueMark,
  type CatalogueRequirement,
  type ToolCategory,
} from "../app/lib/project-builder/tool-catalogue.ts";
import { SchemaError } from "../app/lib/tools/schema.ts";
import { applyProductMarks, buildMarkPrompt, diffProductMarks, markSchema, parseMarkAnswer, soleProductWarning, type MarkAnswer } from "../scripts/catalogue/mark.ts";

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8");
const EM_DASH = String.fromCharCode(0x2014);
const IDS = ["A1", "A2", "A3", "B1", "B2"];

function load(relative: string): ToolCategory {
  const result = parseCategory(read(relative));
  if (!result.ok) throw new Error(`${relative} must parse`);
  return structuredClone(result.category);
}

const tiny = (): ToolCategory => load("./fixtures/catalogue/tiny.md");

/** The fixture with products named and not yet marked. A category with a product still to mark cannot be published. */
function tinyWithPending(...names: string[]): ToolCategory {
  const category = tiny();
  category.published = false;
  category.pendingProducts = names;
  return category;
}

/** The fixture before any product is marked: the names are still to mark and there is no coverage, comment or evidence. */
function tinyUnmarked(...names: string[]): ToolCategory {
  const category = tinyWithPending(...names);
  category.products = [];
  category.coverage = null;
  category.comments = [];
  category.evidence = [];
  return category;
}

function requirements(category: ToolCategory): CatalogueRequirement[] {
  return category.groups.flatMap((group) => group.requirements);
}

function flags(category: ToolCategory): Record<string, boolean> {
  return Object.fromEntries(requirements(category).map((r) => [r.id, r.baseline]));
}

function withoutBaseline(category: ToolCategory) {
  return requirements(category).map(({ id, text, size, key }) => ({ id, text, size, key }));
}

function column(category: ToolCategory, productName: string): Record<string, string> {
  const index = category.coverage?.products.indexOf(productName) ?? -1;
  assert.ok(index >= 0, `no column for ${productName}`);
  return Object.fromEntries((category.coverage?.rows ?? []).map((row) => [row.id, row.marks[index]]));
}

interface RawRow {
  id: unknown;
  mark: unknown;
  evidence: unknown;
  comment: unknown;
}
interface RawAnswer {
  tier: unknown;
  specification: unknown;
  leaving: unknown;
  marks: RawRow[];
}

function raw(marks: string, overrides: Partial<Record<string, Partial<RawRow>>> = {}): RawAnswer {
  return {
    tier: "Business",
    specification: "Yes, with webhooks",
    leaving: "Cost at scale; reports are limited.",
    marks: IDS.map((id, i) => ({
      id,
      mark: marks[i],
      evidence: marks[i] === "P" ? "" : `Endpoint for ${id} in the public specification.`,
      comment: "",
      ...overrides[id],
    })),
  };
}

function rejects(answer: unknown, pattern: RegExp, ids: readonly string[] = IDS): void {
  assert.throws(
    () => parseMarkAnswer(answer, ids),
    (err: unknown) => {
      assert.ok(err instanceof SchemaError, "expected a SchemaError");
      assert.match(err.message, pattern);
      return true;
    },
  );
}

describe("buildMarkPrompt", () => {
  const category = tiny();
  const pages = [{ url: "https://docs.example.test/api", text: "PAGE TEXT about the product." }];
  const prompt = buildMarkPrompt({ category, productName: "Cobalt Flow", tier: "Business", stored: null, pages, specListing: "Specification listing: Cobalt Flow\n\nDeals\n  GET /deals  List deals\n" });

  test("the system turn defines the three marks and carries the evidence rule, the specification rule and the data guard", () => {
    assert.ok(prompt.system.includes("- F: covered in the assumed tier."));
    assert.ok(prompt.system.includes("- P: partly or only on a higher tier or add-on."));
    assert.ok(prompt.system.includes("- N: not covered."));
    assert.ok(prompt.system.includes("It is required for every F and every N."));
    assert.ok(prompt.system.includes('"product knowledge"'));
    assert.ok(prompt.system.includes("an endpoint present supports F. An endpoint absent is a reason to check the documentation, never proof of N."));
    assert.ok(prompt.system.includes("Sources, in order of trust:"));
    assert.ok(prompt.system.includes("Review sites are not sources."));
    assert.ok(prompt.system.includes("Give one row for every requirement id below, each exactly once."));
    assert.ok(prompt.system.includes("British spelling. No em or en dashes."));
    assert.ok(prompt.system.endsWith(DATA_GUARD));
  });

  test("the user turn names the product and the tier, lists every requirement under its group, and holds the listing and the pages", () => {
    assert.ok(prompt.user.startsWith("Category: Tiny tools\nProduct: Cobalt Flow\nTier to assume: Business\n"));
    assert.ok(prompt.user.includes("\nAlpha records\nA1: One record per customer, with notes in one place.\n"));
    for (const requirement of requirements(category)) assert.ok(prompt.user.includes(`${requirement.id}: ${requirement.text}`), requirement.id);
    assert.ok(prompt.user.includes("Specification listing:\n```\nSpecification listing: Cobalt Flow"));
    assert.ok(prompt.user.includes("Page: https://docs.example.test/api\n```\nPAGE TEXT about the product.\n```"));
    assert.ok(!prompt.system.includes("Cobalt Flow"));
    assert.ok(!prompt.system.includes("PAGE TEXT"));
    assert.ok(!prompt.system.includes("One record per customer"));
  });

  test("the tier falls back to the stored row, then to the model's choice; the listing and pages are left out when absent", () => {
    const stored = buildMarkPrompt({ category, productName: "Acme Desk", tier: null, stored: category.products[0], pages: [], specListing: null });
    assert.ok(stored.user.includes("Tier to assume: Standard\n"));
    assert.ok(!stored.user.includes("Specification listing:"));
    assert.ok(!stored.user.includes("Documentation pages:"));
    const given = buildMarkPrompt({ category, productName: "Acme Desk", tier: "Plus", stored: category.products[0], pages: [], specListing: null });
    assert.ok(given.user.includes("Tier to assume: Plus\n"));
    const open = buildMarkPrompt({ category, productName: "Cobalt Flow", tier: null, stored: null, pages, specListing: null });
    assert.ok(open.user.includes("Tier to assume: choose and state it\n"));
  });

  test("neither turn holds a long dash", () => {
    assert.equal(hasLongDash(prompt.system), false);
    assert.equal(hasLongDash(prompt.user), false);
  });
});

describe("markSchema", () => {
  test("is strict, requires every property, and limits the id to the category's ids and the mark to F, P and N", () => {
    const schema = markSchema(IDS);
    assert.equal(schema.name, "catalogue_mark");
    assert.equal(schema.strict, true);
    const root = schema.schema as {
      required: string[];
      additionalProperties: boolean;
      properties: { marks: { items: { required: string[]; additionalProperties: boolean; properties: Record<string, { enum?: string[] }> } } };
    };
    assert.deepEqual(root.required, ["tier", "specification", "leaving", "marks"]);
    assert.equal(root.additionalProperties, false);
    const row = root.properties.marks.items;
    assert.deepEqual(row.required, ["id", "mark", "evidence", "comment"]);
    assert.equal(row.additionalProperties, false);
    assert.deepEqual(row.properties.id.enum, IDS);
    assert.deepEqual(row.properties.mark.enum, ["F", "P", "N"]);
  });
});

describe("parseMarkAnswer", () => {
  test("accepts a sound answer, returns the rows in requirement order and turns an empty evidence or comment to null", () => {
    const answer = raw("FPNFP", { A2: { comment: " Pick lists are on the higher tier. " } });
    answer.marks.reverse();
    const parsed = parseMarkAnswer(answer, IDS);
    assert.deepEqual(
      parsed.marks.map((row) => row.id),
      IDS,
    );
    assert.deepEqual(parsed.marks[1], { id: "A2", mark: "P", evidence: null, comment: "Pick lists are on the higher tier." });
    assert.deepEqual(parsed.marks[0], { id: "A1", mark: "F", evidence: "Endpoint for A1 in the public specification.", comment: null });
    assert.deepEqual([parsed.tier, parsed.specification, parsed.leaving], ["Business", "Yes, with webhooks", "Cost at scale; reports are limited."]);
  });

  test("a P with no evidence is accepted", () => {
    assert.doesNotThrow(() => parseMarkAnswer(raw("PPPPP"), IDS));
  });

  test("rejects a mark outside F, P and N", () => {
    rejects(raw("FXNFP"), /A2 has a mark outside F, P, N/);
    rejects(raw("FPNFP", { B1: { mark: "f" } }), /B1 has a mark outside F, P, N/);
  });

  test("rejects an F and an N with no evidence", () => {
    rejects(raw("FPNFP", { A1: { evidence: "" } }), /A1 is marked F with no evidence/);
    rejects(raw("FPNFP", { A3: { evidence: "   " } }), /A3 is marked N with no evidence/);
  });

  test("rejects an unknown id, a duplicate id and a missing id", () => {
    rejects(raw("FPNFP", { B2: { id: "Z9" } }), /Z9 is not a requirement id of this category.*no row for B2/);
    rejects(raw("FPNFP", { B2: { id: "A1" } }), /A1 is given more than once.*no row for B2/);
    const short = raw("FPNFP");
    short.marks.pop();
    rejects(short, /no row for B2/);
  });

  test("rejects a comment of two sentences, and evidence or a comment with a dash, a pipe or too many characters", () => {
    rejects(raw("FPNFP", { A2: { comment: "Pick lists are on the higher tier. So are types." } }), /A2 has a comment that is not one sentence/);
    rejects(raw("FPNFP", { A1: { evidence: `Customers endpoint ${EM_DASH} with notes.` } }), /A1 has evidence that holds an en or em dash/);
    rejects(raw("FPNFP", { A1: { evidence: "Customers | notes." } }), /A1 has evidence that holds a pipe or a line break/);
    rejects(raw("FPNFP", { A1: { evidence: `${"Long evidence ".repeat(30)}.` } }), /A1 has evidence longer than 300 characters/);
    rejects(raw("FPNFP", { A2: { comment: `Higher tier ${EM_DASH} only.` } }), /A2 has a comment that holds an en or em dash/);
  });

  test("rejects a header field that is empty or unsafe, and a shape that is not the schema's", () => {
    const empty = raw("FPNFP");
    empty.tier = "";
    rejects(empty, /tier is empty/);
    const dashed = raw("FPNFP");
    dashed.leaving = `Cost ${EM_DASH} and support.`;
    rejects(dashed, /leaving holds an en or em dash/);
    rejects("FPNFP", /the answer is not an object/);
    rejects({ tier: "T", specification: "S", leaving: "L" }, /marks is missing/);
  });

  test("names every violation at once", () => {
    rejects(raw("FXNFP", { A1: { evidence: "" }, A3: { evidence: "" } }), /3 problems: A1 is marked F with no evidence; A2 has a mark outside F, P, N; A3 is marked N with no evidence/);
  });
});

describe("applyProductMarks", () => {
  test("a new product, the last still to mark: a column and a row are added last, its name leaves the list, and baseline is recomputed", () => {
    const before = tinyWithPending("Cobalt Flow");
    const snapshot = structuredClone(before);
    const answer = parseMarkAnswer(raw("PFFFN", { A1: { comment: "Notes are a paid add-on." } }), IDS);
    const after = applyProductMarks(before, "Cobalt Flow", answer);

    assert.deepEqual(before, snapshot, "the input is not changed");
    assert.deepEqual(after.products.map((p) => p.name), ["Acme Desk", "Borealis Suite", "Cobalt Flow"]);
    assert.deepEqual(after.products[2], { name: "Cobalt Flow", tier: "Business", specification: "Yes, with webhooks", leaving: "Cost at scale; reports are limited." });
    assert.deepEqual(after.products.slice(0, 2), before.products);
    assert.deepEqual(after.pendingProducts, []);
    assert.deepEqual(after.coverage?.products, ["Acme Desk", "Borealis Suite", "Cobalt Flow"]);
    assert.deepEqual(column(after, "Cobalt Flow"), { A1: "P", A2: "F", A3: "F", B1: "F", B2: "N" });
    assert.deepEqual(column(after, "Acme Desk"), column(before, "Acme Desk"));
    assert.deepEqual(column(after, "Borealis Suite"), column(before, "Borealis Suite"));

    assert.deepEqual(after.comments, [...before.comments, { id: "A1", product: "Cobalt Flow", text: "Notes are a paid add-on." }]);
    assert.deepEqual(after.evidence.slice(0, before.evidence.length), before.evidence);
    assert.deepEqual(
      after.evidence.slice(before.evidence.length).map((row) => [row.id, row.product]),
      [["A2", "Cobalt Flow"], ["A3", "Cobalt Flow"], ["B1", "Cobalt Flow"], ["B2", "Cobalt Flow"]],
    );

    assert.deepEqual(withoutBaseline(after), withoutBaseline(before));
    assert.deepEqual([after.type, after.title, after.keys, after.published, after.scope], [before.type, before.title, before.keys, before.published, before.scope]);
    assert.deepEqual([after.patterns, after.notes, after.sources], [before.patterns, before.notes, before.sources]);

    assert.deepEqual(flags(before), { A1: true, A2: false, A3: false, B1: true, B2: false });
    assert.deepEqual(flags(after), { A1: false, A2: false, A3: false, B1: true, B2: false });
    for (const requirement of requirements(after)) {
      const everyFull = (after.coverage?.rows.find((row) => row.id === requirement.id)?.marks ?? []).every((mark: CatalogueMark) => mark === "F");
      assert.equal(requirement.baseline, everyFull, requirement.id);
    }
    assert.deepEqual(validateCategory(after, { fileName: "tiny.md" }), []);

    const text = serialiseCategory(after);
    const back = parseCategory(text);
    assert.ok(back.ok);
    if (back.ok) assert.deepEqual(back.category, after);
  });

  test("a product marked while another is still to mark changes no baseline flag; the last one recomputes them", () => {
    const before = tinyWithPending("Cobalt Flow", "Delta Works");
    const first = applyProductMarks(before, "Cobalt Flow", parseMarkAnswer(raw("PFFFN"), IDS));
    assert.deepEqual(first.pendingProducts, ["Delta Works"]);
    assert.deepEqual(flags(first), flags(before));
    assert.deepEqual(column(first, "Cobalt Flow"), { A1: "P", A2: "F", A3: "F", B1: "F", B2: "N" });
    assert.deepEqual(validateCategory(first, { fileName: "tiny.md" }), [], "the stated flags stand while a product is pending");

    const second = applyProductMarks(first, "Delta Works", parseMarkAnswer(raw("FFFFF"), IDS));
    assert.deepEqual(second.pendingProducts, []);
    assert.deepEqual(second.coverage?.products, ["Acme Desk", "Borealis Suite", "Cobalt Flow", "Delta Works"]);
    assert.deepEqual(flags(second), { A1: false, A2: false, A3: false, B1: true, B2: false });
    assert.deepEqual(validateCategory(second, { fileName: "tiny.md" }), []);
  });

  test("a name that is not on the list by exact match leaves the list as it is", () => {
    const before = tinyWithPending("Cobalt Flow (cloud)");
    const after = applyProductMarks(before, "Cobalt Flow", parseMarkAnswer(raw("PFFFN"), IDS));
    assert.deepEqual(after.pendingProducts, ["Cobalt Flow (cloud)"]);
    assert.deepEqual(flags(after), flags(before));
  });

  test("an existing product: its column, row, comments and evidence are replaced; the other product's and the all comments are untouched", () => {
    const before = tiny();
    const answer = parseMarkAnswer(
      raw("FFPFN", {
        A1: { evidence: "Accounts endpoint; notes are a sub resource." },
        A3: { comment: "A preview is on the roadmap only." },
        B1: { evidence: "Tasks endpoint." },
        B2: { evidence: "No single sign-on in any tier." },
      }),
      IDS,
    );
    const after = applyProductMarks(before, "Borealis Suite", answer);

    assert.deepEqual(after.products.map((p) => p.name), ["Acme Desk", "Borealis Suite"]);
    assert.deepEqual(after.products[0], before.products[0]);
    assert.equal(after.products[1].tier, "Business");
    assert.deepEqual(after.coverage?.products, ["Acme Desk", "Borealis Suite"]);
    assert.deepEqual(column(after, "Borealis Suite"), { A1: "F", A2: "F", A3: "P", B1: "F", B2: "N" });
    assert.deepEqual(column(after, "Acme Desk"), column(before, "Acme Desk"));
    assert.deepEqual(after.comments, [
      { id: "A3", product: "all", text: "Neither product shows a preview before commit." },
      { id: "A3", product: "Borealis Suite", text: "A preview is on the roadmap only." },
    ]);
    assert.deepEqual(
      after.evidence.filter((row) => row.product === "Acme Desk"),
      before.evidence.filter((row) => row.product === "Acme Desk"),
    );
    assert.deepEqual(
      after.evidence.filter((row) => row.product === "Borealis Suite").map((row) => row.id),
      ["A1", "A2", "B1", "B2"],
    );
    assert.equal(after.published, true);
    assert.deepEqual(withoutBaseline(after), withoutBaseline(before));
    assert.deepEqual(flags(after), { A1: true, A2: true, A3: false, B1: true, B2: false });
    assert.deepEqual(validateCategory(after, { fileName: "tiny.md" }), []);
  });

  test("the first mark on a category with none creates the coverage table and leaves the stated flags while others are pending", () => {
    const before = tinyUnmarked("Acme Desk", "Borealis Suite");
    assert.deepEqual(validateCategory(before, { fileName: "tiny.md" }), []);
    const after = applyProductMarks(before, "Acme Desk", parseMarkAnswer(raw("PFFFN"), IDS));
    assert.deepEqual(after.coverage, {
      products: ["Acme Desk"],
      rows: [
        { id: "A1", marks: ["P"] },
        { id: "A2", marks: ["F"] },
        { id: "A3", marks: ["F"] },
        { id: "B1", marks: ["F"] },
        { id: "B2", marks: ["N"] },
      ],
    });
    assert.deepEqual(after.products.map((p) => p.name), ["Acme Desk"]);
    assert.deepEqual(after.pendingProducts, ["Borealis Suite"]);
    assert.deepEqual(flags(after), flags(before));
    assert.equal(after.published, false);
    assert.deepEqual(validateCategory(after, { fileName: "tiny.md" }), []);
    assert.ok(serialiseCategory(after).includes("## Product coverage\n\n| Id | Acme Desk |\n|---|---|\n| A1 | P |\n"));
    assert.ok(serialiseCategory(after).includes("- **Marks**: F covered in the assumed tier"));
  });

  test("the only product of a category sets the baseline alone once nothing is left to mark", () => {
    const before = tinyUnmarked("Acme Desk");
    const after = applyProductMarks(before, "Acme Desk", parseMarkAnswer(raw("PFFFN"), IDS));
    assert.deepEqual(after.pendingProducts, []);
    assert.deepEqual(flags(after), { A1: false, A2: true, A3: true, B1: true, B2: false });
    assert.deepEqual(validateCategory(after, { fileName: "tiny.md" }), []);
  });

  test("it warns when the baseline has been set from one product alone, and only then", () => {
    const alone = applyProductMarks(tinyUnmarked("Acme Desk"), "Acme Desk", parseMarkAnswer(raw("PFFFN"), IDS));
    const warning = soleProductWarning(alone, "Acme Desk");
    assert.ok(warning);
    assert.match(warning, /^Warning: Acme Desk is the only product marked and no product is still to mark, so every baseline flag is set from this one product alone\./);
    assert.match(warning, /still to mark list/);
    assert.equal(hasLongDash(warning), false);

    const freshDraft = applyProductMarks(tinyUnmarked(), "Acme Desk", parseMarkAnswer(raw("PFFFN"), IDS));
    assert.ok(soleProductWarning(freshDraft, "Acme Desk"), "a draft with no still to mark list at all");

    const othersPending = applyProductMarks(tinyUnmarked("Acme Desk", "Borealis Suite"), "Acme Desk", parseMarkAnswer(raw("PFFFN"), IDS));
    assert.equal(soleProductWarning(othersPending, "Acme Desk"), null);
    const twoMarked = applyProductMarks(tiny(), "Borealis Suite", parseMarkAnswer(raw("FFPFN"), IDS));
    assert.equal(soleProductWarning(twoMarked, "Borealis Suite"), null);
    const third = applyProductMarks(tinyWithPending("Cobalt Flow"), "Cobalt Flow", parseMarkAnswer(raw("PFFFN"), IDS));
    assert.equal(soleProductWarning(third, "Cobalt Flow"), null);
  });

  test("the real ordering file takes a first product and stays sound", () => {
    const before = load("../docs/catalogue/ordering.md");
    const ids = requirements(before).map((r) => r.id);
    const answer: MarkAnswer = {
      tier: "Standard",
      specification: "Yes",
      leaving: "Cost of the licence; needs a partner for changes.",
      marks: ids.map((id, i) => ({ id, mark: i % 3 === 0 ? "P" : "F", evidence: i % 3 === 0 ? null : "Product knowledge.", comment: null })),
    };
    const after = applyProductMarks(before, "A product not in the file", answer);
    assert.equal(after.coverage?.rows.length, ids.length);
    assert.equal(after.coverage?.products.length, (before.coverage?.products.length ?? 0) + 1);
    assert.deepEqual(after.pendingProducts, before.pendingProducts);
    assert.deepEqual(withoutBaseline(after), withoutBaseline(before));
    if (after.pendingProducts.length > 0) assert.deepEqual(flags(after), flags(before));
    assert.deepEqual(validateCategory({ ...after, published: false }, { fileName: "ordering.md" }), []);
    const back = parseCategory(serialiseCategory(after));
    assert.ok(back.ok);
    if (back.ok) assert.deepEqual(back.category, after);
  });
});

describe("diffProductMarks", () => {
  test("a changed mark, an added and a removed comment and a changed baseline flag", () => {
    const before = tiny();
    const answer = parseMarkAnswer(
      raw("FFPFN", {
        A1: { evidence: "Accounts endpoint; notes are a sub resource." },
        A3: { comment: "A preview is on the roadmap only." },
        B1: { evidence: "Tasks endpoint." },
        B2: { evidence: "No single sign-on in any tier." },
      }),
      IDS,
    );
    const after = applyProductMarks(before, "Borealis Suite", answer);
    assert.deepEqual(diffProductMarks(before, after, "Borealis Suite"), [
      "catalogue-mark: tiny, Borealis Suite",
      'Product row: changed (tier: "Team" to "Business"; specification: "Documentation only" to "Yes, with webhooks"; leaving: "Slow support; single sign-on missing." to "Cost at scale; reports are limited.")',
      "Marks: 3 F, 1 P, 1 N. 1 changed.",
      "  A2  P to F",
      "Comments: 1 added, 1 removed, 0 changed.",
      "  + A3  A preview is on the roadmap only.",
      "  - A2  Pick lists need the higher tier.",
      "Evidence: 1 added, 0 removed, 0 changed.",
      "Baseline flags: 1 changed.",
      "  A2  no to yes",
    ]);
  });

  test("an answer equal to what is stored changes nothing", () => {
    const before = tiny();
    const stored = before.products[1];
    const answer: MarkAnswer = {
      tier: stored.tier,
      specification: stored.specification,
      leaving: stored.leaving,
      marks: IDS.map((id) => ({
        id,
        mark: column(before, "Borealis Suite")[id] as CatalogueMark,
        evidence: before.evidence.find((row) => row.id === id && row.product === "Borealis Suite")?.text ?? null,
        comment: before.comments.find((row) => row.id === id && row.product === "Borealis Suite")?.text ?? null,
      })),
    };
    const after = applyProductMarks(before, "Borealis Suite", answer);
    assert.deepEqual(diffProductMarks(before, after, "Borealis Suite"), [
      "catalogue-mark: tiny, Borealis Suite",
      "Product row: unchanged",
      "Marks: 2 F, 2 P, 1 N. 0 changed.",
      "Comments: 0 added, 0 removed, 0 changed.",
      "Evidence: 0 added, 0 removed, 0 changed.",
      "Baseline flags: 0 changed.",
    ]);
  });

  test("a new product that is the last to mark: a new column, the flags applied, and its name off the list", () => {
    const before = tinyWithPending("Cobalt Flow");
    const after = applyProductMarks(before, "Cobalt Flow", parseMarkAnswer(raw("PFFFN", { A1: { comment: "Notes are a paid add-on." } }), IDS));
    assert.deepEqual(diffProductMarks(before, after, "Cobalt Flow"), [
      "catalogue-mark: tiny, Cobalt Flow",
      "Product row: new",
      "Marks: 3 F, 1 P, 1 N. New column.",
      "Comments: 1 added, 0 removed, 0 changed.",
      "  + A1  Notes are a paid add-on.",
      "Evidence: 4 added, 0 removed, 0 changed.",
      "Baseline flags: 1 changed.",
      "  A1  yes to no",
      "Still to mark: Cobalt Flow removed from the list.",
    ]);
  });

  test("the first product marked on a draft with no still to mark list: the lines end with the warning", () => {
    const before = tinyUnmarked();
    const after = applyProductMarks(before, "Acme Desk", parseMarkAnswer(raw("PFFFN"), IDS));
    assert.deepEqual(diffProductMarks(before, after, "Acme Desk"), [
      "catalogue-mark: tiny, Acme Desk",
      "Product row: new",
      "Marks: 3 F, 1 P, 1 N. New column.",
      "Comments: 0 added, 0 removed, 0 changed.",
      "Evidence: 4 added, 0 removed, 0 changed.",
      "Baseline flags: 3 changed.",
      "  A1  yes to no",
      "  A2  no to yes",
      "  A3  no to yes",
      "Warning: Acme Desk is the only product marked and no product is still to mark, so every baseline flag is set from this one product alone. Name the category's other products in the still to mark list before the baseline is relied on.",
    ]);
  });

  test("while a product is still to mark, the flags are shown as what they would become and are not applied", () => {
    const before = tinyWithPending("Cobalt Flow", "Delta Works");
    const after = applyProductMarks(before, "Cobalt Flow", parseMarkAnswer(raw("PFFFN"), IDS));
    const lines = diffProductMarks(before, after, "Cobalt Flow");
    assert.deepEqual(lines.slice(-3), [
      "Baseline flags: not applied yet, 1 still to mark (Delta Works). If the remaining products agreed with the marks so far, 1 would change.",
      "  A1  yes to no",
      "Still to mark: Cobalt Flow removed from the list.",
    ]);
    assert.deepEqual(flags(after), flags(before));
  });
});
