/**
 * Weighted score maths, grade bands and legacy labels.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { getTool } from "../app/lib/tools/registry.ts";
import { calcScore, getGrade, gradeFor, legacyLabelFor } from "../app/lib/tools/scoring.ts";

describe("grade bands", () => {
  test("boundaries at 29/30, 49/50, 69/70, 84/85", () => {
    assert.equal(gradeFor(29).grade, 1);
    assert.equal(gradeFor(30).grade, 2);
    assert.equal(gradeFor(49).grade, 2);
    assert.equal(gradeFor(50).grade, 3);
    assert.equal(gradeFor(69).grade, 3);
    assert.equal(gradeFor(70).grade, 4);
    assert.equal(gradeFor(84).grade, 4);
    assert.equal(gradeFor(85).grade, 5);
    assert.equal(gradeFor(100).grade, 5);
    assert.equal(gradeFor(0).grade, 1);
  });

  test("labels follow the bands", () => {
    assert.equal(gradeFor(90).label, "Elite");
    assert.equal(gradeFor(75).label, "Strong");
    assert.equal(gradeFor(55).label, "Developing");
    assert.equal(gradeFor(35).label, "Early-Stage");
    assert.equal(gradeFor(10).label, "Starting Point");
  });

  test("getGrade is an alias of gradeFor", () => {
    assert.equal(getGrade, gradeFor);
  });
});

describe("weighted score", () => {
  test("moat all 3s is 60", () => {
    const moat = getTool("moat")!;
    assert.equal(calcScore({ sc: 3, pd: 3, ne: 3, br: 3, sd: 3, pr: 3 }, moat.dimensions), 60);
  });

  test("ICP known vector is 72", () => {
    const icp = getTool("icp")!;
    assert.equal(calcScore({ bca: 5, pa: 4, usp: 3, it: 2, cd: 1, nf: 5, fs: 5 }, icp.dimensions), 72);
  });

  test("all 5s is 100 and all 1s is 20 for every public tool", () => {
    for (const slug of ["icp", "persona", "problem", "positioning", "moat"]) {
      const tool = getTool(slug)!;
      const fives: Record<string, number> = {};
      const ones: Record<string, number> = {};
      for (const d of tool.dimensions) {
        fives[d.key] = 5;
        ones[d.key] = 1;
      }
      assert.equal(calcScore(fives, tool.dimensions), 100, slug);
      assert.equal(calcScore(ones, tool.dimensions), 20, slug);
    }
  });

  test("a missing key defaults to 3", () => {
    const moat = getTool("moat")!;
    assert.equal(calcScore({}, moat.dimensions), 60);
  });
});

describe("legacy labels", () => {
  test("moat grades 2 and 3 are both Thin", () => {
    const moat = getTool("moat")!;
    assert.equal(legacyLabelFor(moat, 3), "Thin");
    assert.equal(legacyLabelFor(moat, 2), "Thin");
    assert.equal(legacyLabelFor(moat, 5), "Strong");
    assert.equal(legacyLabelFor(moat, 1), "Exposed");
  });

  test("tools without a legacy label return undefined", () => {
    assert.equal(legacyLabelFor(getTool("icp")!, 4), undefined);
  });
});
