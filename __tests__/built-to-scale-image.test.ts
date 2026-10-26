/**
 * The score card image data: the raw hash reader and the dots per row.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { BTS_PARTS } from "../app/lib/tools/built-to-scale-method.ts";
import { IMAGE_LINE, readCompositeSummary, scorecardImageData } from "../app/lib/tools/built-to-scale-image.ts";

const ROWS = [
  { key: "pain", grade: 3, comment: "c", sources: [] },
  { key: "routeToBuyer", grade: 2, comment: "c", sources: [] },
  { key: "unitOfValue", grade: 1, comment: "c", sources: [] },
  { key: "valueEvidence", grade: 2, comment: "c", sources: [] },
  { key: "abilityToProtect", grade: 2, comment: "c", sources: [] },
];

describe("scorecardImageData", () => {
  test("returns five rows in order with the Notion names and dots filled to the grade", () => {
    const data = scorecardImageData({ total: 10, band: "A good idea with an engine still to build", rows: ROWS.map(({ key, grade }) => ({ key: key as never, grade })) });
    assert.equal(data.total, 10);
    assert.equal(data.band, "A good idea with an engine still to build");
    assert.equal(data.line, IMAGE_LINE);
    assert.deepEqual(data.rows.map((r) => r.name), BTS_PARTS.map((p) => p.name));
    assert.deepEqual(data.rows[0].dots, [true, true, true, false, false]);
    assert.deepEqual(data.rows[2].dots, [true, false, false, false, false]);
    assert.equal(data.rows.every((r) => r.dots.length === 5), true);
  });
});

describe("readCompositeSummary", () => {
  const base = { tool: "built-to-scale", band: "A good idea with an engine still to build" };

  test("accepts rows as a JSON string and total as a string", () => {
    const summary = readCompositeSummary({ ...base, total: "10", rows: JSON.stringify(ROWS) });
    assert.ok(summary);
    assert.equal(summary.total, 10);
    assert.deepEqual(summary.rows.map((r) => r.grade), [3, 2, 1, 2, 2]);
  });

  test("accepts rows as an array and total as a number", () => {
    const summary = readCompositeSummary({ ...base, total: 10, rows: ROWS });
    assert.ok(summary);
    assert.equal(summary.total, 10);
    assert.equal(summary.band, base.band);
  });

  test("returns null for a tool run and when rows are missing", () => {
    assert.equal(readCompositeSummary({ tool: "moat", total: 10, rows: ROWS, band: "x" }), null);
    assert.equal(readCompositeSummary({ ...base, total: 10 }), null);
    assert.equal(readCompositeSummary(null), null);
  });
});
