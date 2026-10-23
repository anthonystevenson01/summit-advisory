/**
 * JSON schema generation from a registry entry and the single validator.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { getTool } from "../app/lib/tools/registry.ts";
import { SchemaError, detailsSchema, parseDetails, parseScoring, scoringSchema } from "../app/lib/tools/schema.ts";

type Obj = Record<string, unknown>;

describe("scoringSchema", () => {
  const moat = getTool("moat")!;
  const named = scoringSchema(moat);
  const schema = named.schema as Obj;
  const props = schema.properties as Obj;
  const scores = props.scores as Obj;

  test("is strict and named after the tool", () => {
    assert.equal(named.name, "moat_scoring");
    assert.equal(named.strict, true);
    assert.equal(schema.additionalProperties, false);
  });

  test("six dimensions in, six required score keys out", () => {
    assert.equal(Object.keys(scores.properties as Obj).length, 6);
    assert.deepEqual(scores.required, ["sc", "pd", "ne", "br", "sd", "pr"]);
    assert.equal(scores.additionalProperties, false);
  });

  test("confidence enum and verdict are required", () => {
    assert.deepEqual((props.confidence as Obj).enum, ["low", "medium", "high"]);
    assert.deepEqual(schema.required, ["scores", "verdict", "confidence", "confidenceReason"]);
  });
});

describe("detailsSchema", () => {
  const positioning = getTool("positioning")!;
  const schema = detailsSchema(positioning).schema as Obj;
  const props = schema.properties as Obj;

  test("has one extras property named rewrite", () => {
    const extras = props.extras as Obj;
    assert.deepEqual(Object.keys(extras.properties as Obj), ["rewrite"]);
    assert.deepEqual(extras.required, ["rewrite"]);
  });

  test("reasoning keys match the dimensions", () => {
    const reasoning = props.reasoning as Obj;
    assert.deepEqual(Object.keys(reasoning.properties as Obj), positioning.dimensions.map((d) => d.key));
  });

  test("a list extra becomes an array schema", () => {
    const problem = getTool("problem")!;
    const extras = ((detailsSchema(problem).schema as Obj).properties as Obj).extras as Obj;
    const moves = (extras.properties as Obj).validationMoves as Obj;
    assert.equal(moves.type, "array");
  });

  test("a tool with no extras gets an empty extras object", () => {
    const icp = getTool("icp")!;
    const extras = ((detailsSchema(icp).schema as Obj).properties as Obj).extras as Obj;
    assert.deepEqual(extras.properties, {});
    assert.deepEqual(extras.required, []);
  });
});

describe("parseScoring", () => {
  const moat = getTool("moat")!;
  const good = {
    scores: { sc: 2, pd: 3, ne: 1, br: 2, sd: 1, pr: 3 },
    verdict: "The moat rests on switching cost alone.",
    confidence: "medium",
    confidenceReason: "Detail on the product, little on the market.",
  };

  test("accepts a complete answer", () => {
    const parsed = parseScoring(moat, good);
    assert.deepEqual(parsed.scores, good.scores);
    assert.equal(parsed.confidence, "medium");
  });

  test("rejects a missing key", () => {
    const { pr: _pr, ...scores } = good.scores;
    assert.throws(() => parseScoring(moat, { ...good, scores }), SchemaError);
  });

  test("clamps 7 to 5 and 0 to 1", () => {
    const parsed = parseScoring(moat, { ...good, scores: { ...good.scores, sc: 7, pd: 0 } });
    assert.equal(parsed.scores.sc, 5);
    assert.equal(parsed.scores.pd, 1);
  });

  test("rejects an unknown confidence and drops unknown keys", () => {
    assert.throws(() => parseScoring(moat, { ...good, confidence: "sure" }), SchemaError);
    const parsed = parseScoring(moat, { ...good, extra: "ignored" }) as unknown as Record<string, unknown>;
    assert.equal("extra" in parsed, false);
  });
});

describe("parseDetails", () => {
  const positioning = getTool("positioning")!;
  const reasoning: Record<string, string> = {};
  for (const d of positioning.dimensions) reasoning[d.key] = `About ${d.name}.`;

  test("accepts a complete answer and keeps only known recommendation dims", () => {
    const parsed = parseDetails(positioning, {
      reasoning,
      recommendations: [
        { dim: "di", gap: "g", consequence: "c", action: "a" },
        { dim: "zz", gap: "g", consequence: "c", action: "a" },
      ],
      extras: { rewrite: "We help ..." },
    });
    assert.equal(parsed.recommendations.length, 1);
    assert.equal(parsed.extras.rewrite, "We help ...");
  });

  test("rejects a missing reasoning key", () => {
    const { di: _di, ...partial } = reasoning;
    assert.throws(
      () => parseDetails(positioning, { reasoning: partial, recommendations: [], extras: { rewrite: "x" } }),
      SchemaError,
    );
  });

  test("rejects a missing extra", () => {
    assert.throws(() => parseDetails(positioning, { reasoning, recommendations: [], extras: {} }), SchemaError);
  });
});
