/**
 * The Built to Scale? method module: the five parts, validation, input
 * composition and its reverse, the total and the bands, and the prompt
 * instructions.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { TOOLS, getTool } from "../app/lib/tools/registry.ts";
import {
  AUTOMATED_LABEL,
  AUTOMATED_LINE,
  BANDS,
  BTS_PARTS,
  BTS_PART_KEYS,
  LOCKED_COMMENT,
  PART_MAX,
  PART_MIN,
  QUICK_BOX,
  QUICK_MODE_INPUT_NOTE,
  QUICK_NOTE,
  absentToolsInstruction,
  bandFor,
  composeToolInputs,
  expandPartsFromInputs,
  isPartKey,
  quickModeInstruction,
  totalOf,
  validateParts,
  type PartsRecord,
} from "../app/lib/tools/built-to-scale-method.ts";

const DASH_RE = /[–—]/;
const SCORED_TOOLS = TOOLS.filter((t) => t.dimensions.length > 0);

function partsOf(length: number): PartsRecord {
  const parts = {} as PartsRecord;
  for (const p of BTS_PARTS) parts[p.key] = `${p.key} `.repeat(Math.ceil(length / (p.key.length + 1))).slice(0, length).trimEnd().padEnd(length, "x");
  return parts;
}

describe("BTS_PARTS", () => {
  test("five parts in the method's order with full copy", () => {
    assert.deepEqual(BTS_PART_KEYS, ["pain", "routeToBuyer", "unitOfValue", "valueEvidence", "abilityToProtect"]);
    assert.equal(BTS_PARTS.length, 5);
    for (const part of BTS_PARTS) {
      assert.ok(part.label.length > 0 && part.prompt.length > 0 && part.heading.length > 0 && part.name.length > 0, part.key);
      assert.ok(part.example.length >= PART_MIN && part.example.length <= PART_MAX, `${part.key} example length ${part.example.length}`);
      assert.ok(part.example.length >= 200 && part.example.length <= 600, `${part.key} example is ${part.example.length} characters`);
      assert.doesNotMatch(`${part.label} ${part.prompt} ${part.heading} ${part.example}`, DASH_RE);
    }
    assert.equal(isPartKey("pain"), true);
    assert.equal(isPartKey("tamSize"), false);
    assert.equal(PART_MIN, 40);
    assert.equal(PART_MAX, 2000);
  });

  test("the quick box carries one example within the part limit, ending on a full stop", () => {
    assert.ok(QUICK_BOX.example.length >= PART_MIN && QUICK_BOX.example.length <= PART_MAX);
    assert.ok(QUICK_BOX.example.endsWith("."));
    assert.doesNotMatch(`${QUICK_BOX.label} ${QUICK_BOX.prompt}`, DASH_RE);
  });

  test("the copy constants carry no dashes", () => {
    for (const text of [AUTOMATED_LABEL, AUTOMATED_LINE, QUICK_NOTE, LOCKED_COMMENT, QUICK_MODE_INPUT_NOTE]) {
      assert.doesNotMatch(text, DASH_RE);
    }
    assert.ok(AUTOMATED_LABEL.startsWith("This score was produced automatically."));
  });
});

describe("validateParts", () => {
  const good = partsOf(40);

  test("five parts of 40 characters pass in five-part mode", () => {
    const r = validateParts({ parts: good });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.quickMode, false);
      assert.deepEqual(Object.keys(r.parts).sort(), [...BTS_PART_KEYS].sort());
    }
  });

  test("a 39 character part is rejected naming the part", () => {
    const r = validateParts({ parts: { ...good, routeToBuyer: "x".repeat(39) } });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "Route to buyer must be at least 40 characters.");
  });

  test("a 2001 character part is rejected", () => {
    const r = validateParts({ parts: { ...good, pain: "x".repeat(2001) } });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "Pain must be under 2,000 characters.");
  });

  test("a missing part is rejected", () => {
    const { abilityToProtect: _dropped, ...partial } = good;
    const r = validateParts({ parts: partial });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "Ability to protect is required.");
  });

  test("a description alone passes in quick mode as every part", () => {
    const description = "  A business that sells tabletop exercises to hospitals in Canada.  ";
    const r = validateParts({ description });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.quickMode, true);
      for (const key of BTS_PART_KEYS) assert.equal(r.parts[key], description.trim());
    }
  });

  test("a short description is rejected with its own label", () => {
    const r = validateParts({ description: "Too short." });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "The description must be at least 40 characters.");
  });

  test("parts and a description together use the parts", () => {
    const r = validateParts({ parts: good, description: "x".repeat(50) });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.quickMode, false);
  });

  test("unknown keys are dropped and whitespace is trimmed", () => {
    const r = validateParts({ parts: { ...good, pain: `  ${good.pain}  `, rubric: "x".repeat(50), extra: "y" } });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.parts.pain, good.pain);
      assert.equal("rubric" in r.parts, false);
      assert.equal("extra" in r.parts, false);
    }
  });

  test("nothing at all is rejected with the fill in message", () => {
    const r = validateParts({});
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "Fill in the five parts or describe the business.");
  });
});

describe("composeToolInputs", () => {
  const parts = partsOf(60);

  test("moat: position holds the heading line and the ability to protect text; competitors is empty", () => {
    const moat = getTool("moat")!;
    const inputs = composeToolInputs(moat, parts, false);
    assert.deepEqual(Object.keys(inputs).sort(), ["competitors", "position"]);
    assert.equal(inputs.position, `Ability to protect, what stops a copy:\n${parts.abilityToProtect}`);
    assert.equal(inputs.competitors, "");
  });

  test("icp: pain then route to buyer, each under its heading, a blank line between", () => {
    const icp = getTool("icp")!;
    const inputs = composeToolInputs(icp, parts, false);
    assert.equal(
      inputs.icp,
      `Pain, the problem and who owns it:\n${parts.pain}\n\nRoute to buyer, who signs and how you reach them:\n${parts.routeToBuyer}`,
    );
  });

  test("40 character parts clear every mapped input's minLength for every scored tool", () => {
    const short = partsOf(40);
    for (const tool of SCORED_TOOLS) {
      const inputs = composeToolInputs(tool, short, false);
      const quick = composeToolInputs(tool, { ...short, ...Object.fromEntries(BTS_PART_KEYS.map((k) => [k, short.pain])) } as PartsRecord, true);
      for (const input of tool.inputs) {
        const mapped = (tool.builtToScale[input.key] ?? []).length > 0;
        if (!mapped) {
          assert.equal(inputs[input.key], "", `${tool.slug}.${input.key} should be empty`);
          assert.equal(quick[input.key], "", `${tool.slug}.${input.key} should be empty in quick mode`);
          continue;
        }
        assert.ok(inputs[input.key].length >= input.minLength, `${tool.slug}.${input.key} composed ${inputs[input.key].length} < ${input.minLength}`);
        assert.ok(quick[input.key].length >= input.minLength, `${tool.slug}.${input.key} quick composed too short`);
      }
    }
  });

  test("2000 character parts never exceed maxLength and cut at a space", () => {
    const long = partsOf(2000);
    for (const tool of SCORED_TOOLS) {
      const inputs = composeToolInputs(tool, long, false);
      for (const input of tool.inputs) {
        assert.ok(inputs[input.key].length <= input.maxLength, `${tool.slug}.${input.key} exceeds ${input.maxLength}`);
        if ((tool.builtToScale[input.key] ?? []).length > 0) {
          assert.ok(!inputs[input.key].endsWith(" "), `${tool.slug}.${input.key} ends with a space`);
        }
      }
    }
    const icp = getTool("icp")!;
    const composed = composeToolInputs(icp, long, false).icp;
    assert.ok(composed.length <= 8000);
  });

  test("quick mode places the description once per input under its heading, preceded by the note", () => {
    const description = "One unstructured description of the business, long enough to score.";
    const quick = {} as PartsRecord;
    for (const key of BTS_PART_KEYS) quick[key] = description;
    const icp = getTool("icp")!;
    const value = composeToolInputs(icp, quick, true).icp;
    assert.ok(value.startsWith(QUICK_MODE_INPUT_NOTE));
    assert.ok(value.includes("\n\nBusiness description:\n"));
    assert.equal(value.split(description).length - 1, 1, "the description appears once");
    assert.equal(value.includes("Pain, the problem"), false);
  });
});

describe("totalOf and bandFor", () => {
  test("totalOf sums five grades", () => {
    assert.equal(totalOf([{ grade: 3 }, { grade: 2 }, { grade: 1 }, { grade: 2 }, { grade: 2 }]), 10);
  });

  test("bandFor at every boundary returns the four exact labels", () => {
    assert.equal(bandFor(5).label, "A hard model");
    assert.equal(bandFor(9).label, "A hard model");
    assert.equal(bandFor(10).label, "A good idea with an engine still to build");
    assert.equal(bandFor(14).label, "A good idea with an engine still to build");
    assert.equal(bandFor(15).label, "Built to scale, with work to do");
    assert.equal(bandFor(19).label, "Built to scale, with work to do");
    assert.equal(bandFor(20).label, "Built to scale");
    assert.equal(bandFor(25).label, "Built to scale");
    assert.deepEqual(BANDS.map((b) => b.key), ["built", "work", "engine", "hard"]);
    assert.equal(bandFor(12).key, "engine");
  });

  test("bandFor throws below 5 and above 25", () => {
    assert.throws(() => bandFor(4), RangeError);
    assert.throws(() => bandFor(26), RangeError);
    assert.throws(() => bandFor(10.5), RangeError);
  });
});

describe("expandPartsFromInputs", () => {
  test("problem: problem lands in pain and evidence in value evidence, three parts empty", () => {
    const problem = getTool("problem")!;
    const parts = expandPartsFromInputs(problem, { problem: "The problem text.", evidence: "The evidence text.", tamSize: "500" });
    assert.equal(parts.pain, "The problem text.");
    assert.equal(parts.valueEvidence, "The evidence text.");
    assert.equal(parts.routeToBuyer, "");
    assert.equal(parts.unitOfValue, "");
    assert.equal(parts.abilityToProtect, "");
  });

  test("icp: the same text lands in pain and route to buyer", () => {
    const icp = getTool("icp")!;
    const parts = expandPartsFromInputs(icp, { icp: "Who has the problem and how they buy." });
    assert.equal(parts.pain, "Who has the problem and how they buy.");
    assert.equal(parts.routeToBuyer, "Who has the problem and how they buy.");
  });

  test("values are sliced to 2000 and two inputs feeding one part are joined without repeats", () => {
    const route = getTool("route-to-buyer")!;
    const parts = expandPartsFromInputs(route, { buyer: "x".repeat(1500), route: "y".repeat(1500) });
    assert.equal(parts.routeToBuyer.length, 2000);
    const same = expandPartsFromInputs(route, { buyer: "Same text.", route: "Same text." });
    assert.equal(same.routeToBuyer, "Same text.");
  });
});

describe("prompt instructions", () => {
  test("quickModeInstruction and absentToolsInstruction name the tool and contain no dashes", () => {
    const quick = quickModeInstruction();
    assert.ok(quick.includes("one step lower"));
    assert.doesNotMatch(quick, DASH_RE);
    const absent = absentToolsInstruction(["unit-of-value"]);
    assert.ok(absent.includes("unit-of-value"));
    assert.doesNotMatch(absent, DASH_RE);
  });
});
