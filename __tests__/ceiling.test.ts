/**
 * The revenue ceiling per head calculator: happy path, null and unsupported
 * inputs, currency switch, assumption text and the type guard.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  CEILING_INPUT_KEYS,
  CEILING_INPUT_LABELS,
  DEFAULT_CURRENCY,
  computeCeiling,
  isCeilingInputs,
  unsupportedCeilingInputs,
  type CeilingInputKey,
  type CeilingInputs,
} from "../app/lib/ceiling.ts";

function inputs(units: number | null, price: number | null, periods: number | null): CeilingInputs {
  return {
    unitsPerPersonPerPeriod: { value: units, assumption: "  One exercise a week per facilitator.  " },
    pricePerUnit: { value: price, assumption: "9,500 CAD per exercise, from the pricing text." },
    periodsPerYear: { value: periods, assumption: "Forty working weeks a year." },
  };
}

describe("computeCeiling", () => {
  test("multiplies the three inputs and formats in CAD by default", () => {
    const result = computeCeiling(inputs(1, 9500, 40));
    assert.ok(result);
    assert.equal(result.value, 380000);
    assert.equal(result.currency, DEFAULT_CURRENCY);
    assert.equal(result.currency, "CAD");
    assert.equal(result.formatted, "CAD 380,000");
  });

  test("returns three assumptions in key order with the fixed labels and trimmed text", () => {
    const result = computeCeiling(inputs(1, 9500, 40));
    assert.ok(result);
    assert.deepEqual(result.assumptions.map((a) => a.key), [...CEILING_INPUT_KEYS]);
    assert.deepEqual(result.assumptions.map((a) => a.label), CEILING_INPUT_KEYS.map((k) => CEILING_INPUT_LABELS[k]));
    assert.deepEqual(result.assumptions.map((a) => a.value), [1, 9500, 40]);
    assert.equal(result.assumptions[0].text, "One exercise a week per facilitator.");
    assert.equal(result.assumptions[1].text, "9,500 CAD per exercise, from the pricing text.");
  });

  test("rounds to the nearest whole unit of currency", () => {
    const result = computeCeiling(inputs(12.5, 99.99, 3));
    assert.ok(result);
    assert.equal(result.value, 3750);
    assert.equal(result.formatted, "CAD 3,750");
  });

  test("returns null when any one input is null and names that key only", () => {
    const cases: [CeilingInputs, CeilingInputKey][] = [
      [inputs(null, 9500, 40), "unitsPerPersonPerPeriod"],
      [inputs(1, null, 40), "pricePerUnit"],
      [inputs(1, 9500, null), "periodsPerYear"],
    ];
    for (const [value, key] of cases) {
      assert.equal(computeCeiling(value), null);
      assert.deepEqual(unsupportedCeilingInputs(value), [key]);
    }
  });

  test("treats zero, a negative, NaN and Infinity as unsupported in any position", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(computeCeiling(inputs(bad, 9500, 40)), null, `units ${bad}`);
      assert.equal(computeCeiling(inputs(1, bad, 40)), null, `price ${bad}`);
      assert.equal(computeCeiling(inputs(1, 9500, bad)), null, `periods ${bad}`);
    }
    assert.deepEqual(unsupportedCeilingInputs(inputs(0, null, 40)), ["unitsPerPersonPerPeriod", "pricePerUnit"]);
    assert.deepEqual(unsupportedCeilingInputs(inputs(1, 9500, 40)), []);
  });

  test("switches currency on a three letter code and falls back to CAD otherwise", () => {
    const usd = computeCeiling(inputs(1, 9500, 40), "usd");
    assert.ok(usd);
    assert.equal(usd.currency, "USD");
    assert.equal(usd.formatted, "USD 380,000");
    const dollars = computeCeiling(inputs(1, 9500, 40), "dollars");
    assert.ok(dollars);
    assert.equal(dollars.currency, "CAD");
  });

  test("never mutates its input", () => {
    const value = inputs(1, 9500, 40);
    const before = JSON.parse(JSON.stringify(value));
    computeCeiling(value, "gbp");
    assert.deepEqual(value, before);
  });
});

describe("isCeilingInputs", () => {
  test("accepts a well formed object, with null values allowed", () => {
    assert.equal(isCeilingInputs(inputs(1, 9500, 40)), true);
    assert.equal(isCeilingInputs(inputs(null, null, null)), true);
  });

  test("rejects a string, an array, a missing key and a string value", () => {
    assert.equal(isCeilingInputs("CAD 380,000"), false);
    assert.equal(isCeilingInputs([1, 9500, 40]), false);
    const { periodsPerYear: _dropped, ...missing } = inputs(1, 9500, 40);
    assert.equal(isCeilingInputs(missing), false);
    const stringValue = { ...inputs(1, 9500, 40), pricePerUnit: { value: "9500", assumption: "text" } };
    assert.equal(isCeilingInputs(stringValue), false);
  });
});
