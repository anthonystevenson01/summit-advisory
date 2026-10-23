/**
 * Every calibration case file for a registry tool is internally consistent:
 * its inputs match the tool's registry inputs, its expected dimensions match
 * the tool's dimension keys, and its overall grade is the band of the
 * weighted dimension grades. Whether the grades are right is Anthony's call;
 * this only checks the file agrees with itself and with the registry.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { getTool, type ToolEntry } from "../app/lib/tools/registry.ts";
import { calcScore, gradeFor } from "../app/lib/tools/scoring.ts";
import { isCaseFillable, type CalibrationCase } from "../app/lib/tools/calibration.ts";

const CALIBRATION_DIR = resolve(process.cwd(), "calibration");

function caseFolders(): { folder: string; tool: ToolEntry }[] {
  return readdirSync(CALIBRATION_DIR)
    .filter((name) => !name.startsWith("_") && !name.startsWith(".") && statSync(join(CALIBRATION_DIR, name)).isDirectory())
    .map((folder) => ({ folder, tool: getTool(folder) }))
    .filter((x): x is { folder: string; tool: ToolEntry } => x.tool !== undefined && x.tool.dimensions.length > 0);
}

function caseFiles(folder: string): string[] {
  return readdirSync(join(CALIBRATION_DIR, folder)).filter((f) => f.endsWith(".json")).sort();
}

function isGrade(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

describe("calibration case files", () => {
  for (const { folder, tool } of caseFolders()) {
    for (const file of caseFiles(folder)) {
      const path = join(CALIBRATION_DIR, folder, file);

      test(`${folder}/${file} is consistent with the registry`, () => {
        const data = JSON.parse(readFileSync(path, "utf8")) as CalibrationCase;
        assert.equal(data.tool, folder, "tool matches the folder");
        assert.ok(typeof data.name === "string" && data.name.length > 0, "name is non-empty");

        const inputKeys = new Set(tool.inputs.map((i) => i.key));
        for (const key of Object.keys(data.input)) {
          assert.ok(inputKeys.has(key), `input.${key} is not a registry input of ${tool.slug}`);
        }
        for (const input of tool.inputs) {
          const value = data.input[input.key];
          if (input.required) assert.ok(typeof value === "string", `input.${input.key} is required`);
          if (typeof value !== "string") continue;
          assert.ok(value.length >= input.minLength, `input.${input.key} is shorter than ${input.minLength}`);
          assert.ok(value.length <= input.maxLength, `input.${input.key} is longer than ${input.maxLength}`);
        }
        assert.equal(isCaseFillable(data), true, "input contains no TO FILL");

        const dimKeys = tool.dimensions.map((d) => d.key);
        assert.deepEqual(Object.keys(data.expected.dimensions).sort(), [...dimKeys].sort());
        for (const [key, value] of Object.entries(data.expected.dimensions)) {
          assert.ok(isGrade(value), `expected.dimensions.${key} is not an integer 1 to 5`);
        }
        assert.ok(isGrade(data.expected.grade), "expected.grade is an integer 1 to 5");
        assert.equal(
          gradeFor(calcScore(data.expected.dimensions, tool.dimensions)).grade,
          data.expected.grade,
          "expected.grade is the band of the weighted dimension grades",
        );

        assert.ok(typeof data.agreedBy === "string" && data.agreedBy.length > 0, "agreedBy is non-empty");
        assert.ok(typeof data.note === "string" && data.note.length > 0, "note is non-empty");
      });
    }
  }

  test("the Release 2 folders exist and hold at least three cases each", () => {
    for (const folder of ["route-to-buyer", "unit-of-value"]) {
      assert.ok(getTool(folder), `${folder} has a registry entry`);
      assert.ok(caseFiles(folder).length >= 3, `${folder} has fewer than three cases`);
    }
  });
});
