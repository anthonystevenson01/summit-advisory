/**
 * The synthesis JSON schema and its parser.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { SchemaError } from "../app/lib/tools/schema.ts";
import { parseSynthesis, synthesisSchema } from "../app/lib/tools/built-to-scale-schema.ts";

type Obj = Record<string, unknown>;

const KEYS = ["pain", "routeToBuyer", "unitOfValue", "valueEvidence", "abilityToProtect"];

function walkObjects(node: unknown, visit: (o: Obj) => void): void {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    node.forEach((n) => walkObjects(n, visit));
    return;
  }
  const o = node as Obj;
  if (o.type === "object") visit(o);
  for (const v of Object.values(o)) walkObjects(v, visit);
}

describe("synthesisSchema", () => {
  const named = synthesisSchema();
  const schema = named.schema as Obj;
  const props = schema.properties as Obj;
  const rows = props.rows as Obj;
  const rowProps = (rows.items as Obj).properties as Obj;

  test("is strict, named and requires the seven top level fields", () => {
    assert.equal(named.name, "built_to_scale_synthesis");
    assert.equal(named.strict, true);
    assert.deepEqual(schema.required, ["rows", "verdict", "strongest", "weakest", "oneChange", "confidence", "confidenceReason"]);
  });

  test("rows is exactly five with the dimensions enumerated in order", () => {
    assert.equal(rows.minItems, 5);
    assert.equal(rows.maxItems, 5);
    assert.deepEqual((rowProps.dimension as Obj).enum, KEYS);
    assert.equal((rowProps.grade as Obj).type, "integer");
    assert.equal((rowProps.grade as Obj).minimum, 1);
    assert.equal((rowProps.grade as Obj).maximum, 5);
    assert.equal((rowProps.sources as Obj).type, "array");
    assert.equal(((rowProps.sources as Obj).items as Obj).type, "string");
  });

  test("every object forbids additional properties and there is no total or band", () => {
    let count = 0;
    walkObjects(schema, (o) => {
      count += 1;
      assert.equal(o.additionalProperties, false);
    });
    assert.ok(count >= 2);
    assert.equal("total" in props, false);
    assert.equal("band" in props, false);
    assert.deepEqual((props.confidence as Obj).enum, ["low", "medium", "high"]);
  });
});

describe("parseSynthesis", () => {
  const sources = ["run_0000000000000001", "run_0000000000000002"];
  const row = (dimension: string, grade = 3) => ({ dimension, grade, comment: `  Comment for ${dimension}.  `, sources: [sources[0]] });
  const good = {
    rows: [row("unitOfValue"), row("pain"), row("abilityToProtect"), row("valueEvidence"), row("routeToBuyer")],
    verdict: "  A hard model with one real asset.  ",
    strongest: " Pain is real and paid for. ",
    weakest: " Unit of value is a facilitator day. ",
    oneChange: " Price the scenario library as a licence. ",
    confidence: "medium",
    confidenceReason: " Route to buyer would raise it. ",
  };

  test("a good answer with the rows out of order comes back in method order, trimmed", () => {
    const parsed = parseSynthesis(good, sources);
    assert.deepEqual(parsed.rows.map((r) => r.dimension), KEYS);
    assert.equal(parsed.rows[0].comment, "Comment for pain.");
    assert.equal(parsed.verdict, "A hard model with one real asset.");
    assert.equal(parsed.strongest, "Pain is real and paid for.");
    assert.equal(parsed.weakest, "Unit of value is a facilitator day.");
    assert.equal(parsed.oneChange, "Price the scenario library as a licence.");
    assert.equal(parsed.confidenceReason, "Route to buyer would raise it.");
    assert.equal(parsed.confidence, "medium");
  });

  test("four rows throws, six rows throws", () => {
    assert.throws(() => parseSynthesis({ ...good, rows: good.rows.slice(0, 4) }, sources), SchemaError);
    assert.throws(() => parseSynthesis({ ...good, rows: [...good.rows, row("pain")] }, sources), SchemaError);
  });

  test("a duplicate dimension throws and an unknown dimension throws", () => {
    const dup = [row("pain"), row("pain"), row("abilityToProtect"), row("valueEvidence"), row("routeToBuyer")];
    assert.throws(() => parseSynthesis({ ...good, rows: dup }, sources), SchemaError);
    const unknown = [row("pain"), row("moat"), row("abilityToProtect"), row("valueEvidence"), row("routeToBuyer")];
    assert.throws(() => parseSynthesis({ ...good, rows: unknown }, sources), SchemaError);
  });

  test("grade 7 clamps to 5 and 0 to 1", () => {
    const rows = [row("pain", 7), row("routeToBuyer", 0), row("unitOfValue"), row("valueEvidence"), row("abilityToProtect")];
    const parsed = parseSynthesis({ ...good, rows }, sources);
    assert.equal(parsed.rows[0].grade, 5);
    assert.equal(parsed.rows[1].grade, 1);
  });

  test("sources not in the allowed list are dropped, valid ones kept in the model's order without duplicates", () => {
    const rows = [
      { ...row("pain"), sources: [sources[1], "run_bad", sources[0], sources[1]] },
      row("routeToBuyer"),
      row("unitOfValue"),
      row("valueEvidence"),
      row("abilityToProtect"),
    ];
    const parsed = parseSynthesis({ ...good, rows }, sources);
    assert.deepEqual(parsed.rows[0].sources, [sources[1], sources[0]]);
  });

  test("an empty or missing verdict throws", () => {
    assert.throws(() => parseSynthesis({ ...good, verdict: "   " }, sources), SchemaError);
    const { verdict: _v, ...noVerdict } = good;
    assert.throws(() => parseSynthesis(noVerdict, sources), SchemaError);
  });

  test("a confidence outside the enum throws", () => {
    assert.throws(() => parseSynthesis({ ...good, confidence: "sure" }, sources), SchemaError);
  });

  test("a non-object answer throws", () => {
    assert.throws(() => parseSynthesis("nope", sources), SchemaError);
  });
});
