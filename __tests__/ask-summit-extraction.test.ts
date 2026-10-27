/**
 * The extraction schema, parser and placeholder rule, and the extraction
 * prompt and its user content budget. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { BTS_PARTS, BTS_PART_KEYS, PART_MIN, validateParts, type BtsPartKey } from "../app/lib/tools/built-to-scale-method.ts";
import { SchemaError } from "../app/lib/tools/schema.ts";
import {
  EVIDENCE_CHARS,
  SUMMARY_CHARS,
  extractionSchema,
  parseExtraction,
  partsForScoring,
  thinPlaceholder,
  type DraftedPart,
} from "../app/lib/ask-summit/extraction-schema.ts";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TEXT_BUDGET, buildExtractionUser } from "../app/lib/ask-summit/extraction-prompt.ts";

const DASH_RE = /[–—]/;

type Props = Record<string, Record<string, unknown>>;

function fullAnswer(): Record<string, unknown> {
  const parts: Record<string, unknown> = {};
  for (const part of BTS_PARTS) {
    parts[part.key] = { text: `We ${part.key} `.repeat(6), evidence: [`quote for ${part.key}`], confidence: "medium", reason: "some numbers" };
  }
  return { companyName: " Acme ", summary: " Acme sells widgets. ", parts };
}

describe("extractionSchema", () => {
  test("is strict, names every part and every object closes additionalProperties", () => {
    const schema = extractionSchema();
    assert.equal(schema.name, "ask_summit_extraction");
    assert.equal(schema.strict, true);
    const root = schema.schema;
    assert.deepEqual(root.required, ["companyName", "summary", "parts"]);
    assert.equal(root.additionalProperties, false);
    const parts = (root.properties as Props).parts;
    assert.deepEqual(parts.required, [...BTS_PART_KEYS]);
    assert.equal(parts.additionalProperties, false);
    for (const key of BTS_PART_KEYS) {
      const part = (parts.properties as Props)[key];
      assert.equal(part.additionalProperties, false);
      assert.deepEqual(part.required, ["text", "evidence", "confidence", "reason"]);
      const props = part.properties as Props;
      assert.equal(props.evidence.type, "array");
      assert.equal(props.evidence.maxItems, 2);
      assert.deepEqual(props.confidence.enum, ["low", "medium", "high"]);
    }
  });
});

describe("parseExtraction", () => {
  test("a full answer round-trips with trimming", () => {
    const parsed = parseExtraction(fullAnswer());
    assert.equal(parsed.companyName, "Acme");
    assert.equal(parsed.summary, "Acme sells widgets.");
    assert.equal(parsed.parts.pain.confidence, "medium");
    assert.deepEqual(parsed.parts.pain.evidence, ["quote for pain"]);
  });

  test("empty text is allowed and kept as an empty string", () => {
    const answer = fullAnswer();
    (answer.parts as Props).pain = { text: "", evidence: [], confidence: "low", reason: "nothing on pain" };
    assert.equal(parseExtraction(answer).parts.pain.text, "");
  });

  test("an unknown part, a missing part, a bad confidence and a non-object throw SchemaError", () => {
    const unknown = fullAnswer();
    (unknown.parts as Props).tamSize = { text: "x", evidence: [], confidence: "low", reason: "" };
    assert.throws(() => parseExtraction(unknown), SchemaError);
    const missing = fullAnswer();
    delete (missing.parts as Props).routeToBuyer;
    assert.throws(() => parseExtraction(missing), SchemaError);
    const bad = fullAnswer();
    (bad.parts as Props).pain = { text: "x", evidence: [], confidence: "certain", reason: "" };
    assert.throws(() => parseExtraction(bad), SchemaError);
    assert.throws(() => parseExtraction("nope"), SchemaError);
    assert.throws(() => parseExtraction({ companyName: "x", summary: "y" }), SchemaError);
  });

  test("evidence keeps the first two snippets cut to 300; text is cut to 2000; the summary to 1200", () => {
    const answer = fullAnswer();
    const long = `${"word ".repeat(100)}end`;
    (answer.parts as Props).pain = { text: `${"text ".repeat(600)}tail`, evidence: ["one", long, "three"], confidence: "high", reason: "r" };
    answer.summary = "s ".repeat(1000);
    const parsed = parseExtraction(answer);
    assert.equal(parsed.parts.pain.evidence.length, 2);
    assert.equal(parsed.parts.pain.evidence[0], "one");
    assert.ok(parsed.parts.pain.evidence[1].length <= EVIDENCE_CHARS);
    assert.ok(!parsed.parts.pain.evidence[1].endsWith(" "));
    assert.ok(parsed.parts.pain.text.length <= 2000);
    assert.ok(parsed.summary.length <= SUMMARY_CHARS);
  });
});

describe("thinPlaceholder and partsForScoring", () => {
  test("each placeholder is at least 40 characters, names the part and carries no dash", () => {
    for (const part of BTS_PARTS) {
      const line = thinPlaceholder(part.key);
      assert.ok(line.length >= PART_MIN, part.key);
      assert.ok(line.includes(part.label), part.key);
      assert.doesNotMatch(line, DASH_RE);
    }
  });

  test("the placeholder rule fills, pads and respects edits, and the result passes validateParts", () => {
    const drafted = {} as Record<BtsPartKey, DraftedPart>;
    for (const part of BTS_PARTS) drafted[part.key] = { text: "", evidence: [], confidence: "low", reason: "" };
    drafted.pain.text = "x".repeat(40);
    drafted.routeToBuyer.text = "short part here.";
    const parts = partsForScoring(drafted);
    assert.equal(parts.pain, "x".repeat(40));
    assert.equal(parts.routeToBuyer, `short part here. ${thinPlaceholder("routeToBuyer")}`);
    assert.equal(parts.unitOfValue, thinPlaceholder("unitOfValue"));
    const validated = validateParts({ parts });
    assert.equal(validated.ok, true);

    const edited = partsForScoring(drafted, { pain: "y".repeat(50), unitOfValue: "" });
    assert.equal(edited.pain, "y".repeat(50));
    assert.equal(edited.unitOfValue, thinPlaceholder("unitOfValue"));
    assert.equal(validateParts({ parts: edited }).ok, true);
  });
});

describe("EXTRACTION_SYSTEM_PROMPT", () => {
  test("names the five parts and the house rules, with no dash", () => {
    for (const part of BTS_PARTS) assert.ok(EXTRACTION_SYSTEM_PROMPT.includes(`${part.key}: ${part.name}`), part.key);
    assert.ok(EXTRACTION_SYSTEM_PROMPT.includes("British"));
    assert.ok(/evidence/i.test(EXTRACTION_SYSTEM_PROMPT));
    assert.ok(/do not invent/i.test(EXTRACTION_SYSTEM_PROMPT));
    assert.doesNotMatch(EXTRACTION_SYSTEM_PROMPT, DASH_RE);
  });
});

describe("buildExtractionUser", () => {
  test("labels pages and documents in order and marks PDFs as attached", () => {
    const user = buildExtractionUser({
      host: "example.com",
      pages: [
        { url: "https://example.com/", title: "Home", text: "home text" },
        { url: "https://example.com/pricing", title: "Pricing", text: "pricing text" },
      ],
      docs: [
        { name: "deck.docx", kind: "text", text: "deck text" },
        { name: "deck.pdf", kind: "pdf" },
        { name: "notes.pptx", kind: "rejected", reason: "not a PPTX" },
      ],
    });
    assert.ok(user.startsWith("Company website: example.com"));
    assert.ok(user.includes("[Page 1: https://example.com/] Home"));
    assert.ok(user.includes("[Page 2: https://example.com/pricing] Pricing"));
    assert.ok(user.indexOf("[Page 1:") < user.indexOf("[Page 2:"));
    assert.ok(user.includes("[Document: deck.docx]\ndeck text"));
    assert.ok(user.includes("[Attached PDF: deck.pdf, sent as a file]"));
    assert.ok(user.includes("[Document: notes.pptx, not readable: not a PPTX]"));
  });

  test("a 1 MB page is cut so the whole output fits the budget, with a cut marker", () => {
    const user = buildExtractionUser({
      host: "example.com",
      pages: [
        { url: "https://example.com/", title: "Home", text: "word ".repeat(200_000) },
        { url: "https://example.com/about", title: "About", text: "small page" },
      ],
      docs: [{ name: "deck.docx", kind: "text", text: "doc ".repeat(50_000) }],
    });
    assert.ok(user.length <= EXTRACTION_TEXT_BUDGET, String(user.length));
    assert.ok(user.includes(" [cut]"));
    assert.ok(user.includes("small page"));
  });

  test("with nothing at all the output says the material was empty", () => {
    const user = buildExtractionUser({ host: "example.com", pages: [], docs: [] });
    assert.ok(user.includes("No material could be read"));
  });
});
