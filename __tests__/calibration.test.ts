/**
 * Calibration comparison: pass, one-point move passes, two-point move fails,
 * TO FILL cases are skipped.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  SKIP_REASON_HIDDEN,
  SKIP_REASON_NO_ENTRY,
  SKIP_REASON_NOT_PUBLISHED,
  SKIP_REASON_TO_FILL,
  compareCase,
  compareCompositeCase,
  formatTable,
  isCaseFillable,
  type CalibrationCase,
  type CaseResult,
} from "../app/lib/tools/calibration.ts";

const EXPECTED = { grade: 2, dimensions: { sc: 2, pd: 2, ne: 1, br: 2, sd: 3, pr: 2 } };

describe("compareCase", () => {
  test("an exact match passes", () => {
    const result = compareCase(EXPECTED, { grade: 2, scores: EXPECTED.dimensions });
    assert.equal(result.pass, true);
    assert.equal(result.rows.length, 7);
    assert.ok(result.rows.every((r) => r.delta === 0));
  });

  test("a one-point move on one dimension passes", () => {
    const result = compareCase(EXPECTED, { grade: 2, scores: { ...EXPECTED.dimensions, ne: 2 } });
    assert.equal(result.pass, true);
    assert.equal(result.rows.find((r) => r.key === "ne")?.delta, 1);
  });

  test("a two-point move on the overall grade fails", () => {
    const result = compareCase(EXPECTED, { grade: 4, scores: EXPECTED.dimensions });
    assert.equal(result.pass, false);
    assert.equal(result.rows.find((r) => r.key === "overall")?.delta, 2);
  });

  test("a two-point move on a dimension fails", () => {
    const result = compareCase(EXPECTED, { grade: 2, scores: { ...EXPECTED.dimensions, sd: 1 } });
    assert.equal(result.pass, false);
  });

  test("a dimension the run did not score fails", () => {
    const { pr: _pr, ...scores } = EXPECTED.dimensions;
    const result = compareCase(EXPECTED, { grade: 2, scores });
    assert.equal(result.pass, false);
    assert.equal(result.rows.find((r) => r.key === "pr")?.actual, null);
  });
});

describe("TO FILL cases", () => {
  const filled: CalibrationCase = {
    tool: "moat",
    name: "Example",
    input: { position: "A real description of the position.", competitors: "Acme" },
    expected: EXPECTED,
  };

  test("a filled case is fillable", () => {
    assert.equal(isCaseFillable(filled), true);
  });

  test("a case with TO FILL in any input is not fillable", () => {
    assert.equal(isCaseFillable({ ...filled, input: { ...filled.input, competitors: "TO FILL: later" } }), false);
  });

  test("a case with no inputs is not fillable", () => {
    assert.equal(isCaseFillable({ ...filled, input: {} }), false);
  });

  test("a skipped case is reported and not compared", () => {
    const results: CaseResult[] = [
      { tool: "moat", name: "Gradeshow", status: "skipped", reason: SKIP_REASON_TO_FILL },
      { tool: "moat", name: "Example", status: "run", comparison: compareCase(EXPECTED, { grade: 2, scores: EXPECTED.dimensions }) },
    ];
    const table = formatTable(results);
    assert.match(table, /Gradeshow\s+skipped\s+input contains TO FILL/);
    assert.match(table, /Example\s+pass/);
    assert.ok(results[0].comparison === undefined);
  });
});

describe("skip reasons", () => {
  test("a hidden entry reads differently from a missing one and names the gate", () => {
    assert.notEqual(SKIP_REASON_HIDDEN, SKIP_REASON_NO_ENTRY);
    assert.match(SKIP_REASON_HIDDEN, /hidden/);
    assert.match(SKIP_REASON_HIDDEN, /Published/);
    assert.equal(SKIP_REASON_TO_FILL, "input contains TO FILL");
  });

  test("formatTable prints the hidden reason for a skipped row", () => {
    const table = formatTable([{ tool: "unit-of-value", name: "Oakridge", status: "skipped", reason: SKIP_REASON_HIDDEN }]);
    assert.ok(table.includes(`skipped   ${SKIP_REASON_HIDDEN}`), table);
  });
});

describe("compareCompositeCase", () => {
  const EXPECTED_COMPOSITE = {
    total: 10,
    rows: { pain: 3, routeToBuyer: 2, unitOfValue: 1, valueEvidence: 2, abilityToProtect: 2 },
  };

  test("an exact match passes with six rows", () => {
    const result = compareCompositeCase(EXPECTED_COMPOSITE, { total: 10, rows: EXPECTED_COMPOSITE.rows });
    assert.equal(result.pass, true);
    assert.equal(result.rows.length, 6);
    assert.equal(result.rows[0].key, "overall");
    assert.ok(result.rows.every((r) => r.delta === 0));
  });

  test("a total off by one passes", () => {
    const result = compareCompositeCase(EXPECTED_COMPOSITE, { total: 11, rows: { ...EXPECTED_COMPOSITE.rows, pain: 4 } });
    assert.equal(result.pass, true);
    assert.equal(result.rows.find((r) => r.key === "overall")?.delta, 1);
  });

  test("a total off by two fails", () => {
    const result = compareCompositeCase(EXPECTED_COMPOSITE, { total: 12, rows: EXPECTED_COMPOSITE.rows });
    assert.equal(result.pass, false);
  });

  test("a row off by two fails", () => {
    const result = compareCompositeCase(EXPECTED_COMPOSITE, { total: 10, rows: { ...EXPECTED_COMPOSITE.rows, unitOfValue: 3 } });
    assert.equal(result.pass, false);
    assert.equal(result.rows.find((r) => r.key === "unitOfValue")?.delta, 2);
  });

  test("a missing row fails with a null actual", () => {
    const { abilityToProtect: _dropped, ...rows } = EXPECTED_COMPOSITE.rows;
    const result = compareCompositeCase(EXPECTED_COMPOSITE, { total: 10, rows });
    assert.equal(result.pass, false);
    assert.equal(result.rows.find((r) => r.key === "abilityToProtect")?.actual, null);
  });

  test("the not published skip reason prints and differs from the other three", () => {
    assert.notEqual(SKIP_REASON_NOT_PUBLISHED, SKIP_REASON_HIDDEN);
    assert.notEqual(SKIP_REASON_NOT_PUBLISHED, SKIP_REASON_NO_ENTRY);
    assert.notEqual(SKIP_REASON_NOT_PUBLISHED, SKIP_REASON_TO_FILL);
    const table = formatTable([{ tool: "built-to-scale", name: "Gradeshow", status: "skipped", reason: SKIP_REASON_NOT_PUBLISHED }]);
    assert.ok(table.includes(`skipped   ${SKIP_REASON_NOT_PUBLISHED}`), table);
  });
});
