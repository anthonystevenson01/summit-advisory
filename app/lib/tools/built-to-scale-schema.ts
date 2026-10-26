/**
 * The synthesis call's strict JSON schema and the one validator for its
 * answer. Pure: no Redis, no network. The schema has no total, band or name
 * field: the code computes the total and labels the band, and the parser
 * would drop one if the model sent it.
 */
import { BTS_PARTS, BTS_PART_KEYS, type BtsPartKey } from "./built-to-scale-method.ts";
import { CONFIDENCE_LEVELS, SchemaError, type Confidence, type JsonSchema, type NamedSchema } from "./schema.ts";

export interface SynthesisRow {
  dimension: BtsPartKey;
  grade: number;
  comment: string;
  sources: string[];
}

export interface SynthesisResult {
  rows: SynthesisRow[];
  verdict: string;
  strongest: string;
  weakest: string;
  oneChange: string;
  confidence: Confidence;
  confidenceReason: string;
}

/**
 * Why five fixed rows with an enum dimension: the scorecard has exactly one
 * row per part in the method's order, so the model may neither add a
 * dimension nor leave one out; `strict` with `additionalProperties: false`
 * keeps a total, a band or any other field out of the answer. `sources` is
 * loosely typed here on purpose; the parser checks each id against the
 * children that actually ran.
 */
export function synthesisSchema(): NamedSchema {
  const rowSchema: JsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["dimension", "grade", "comment", "sources"],
    properties: {
      dimension: { type: "string", enum: [...BTS_PART_KEYS] },
      grade: { type: "integer", minimum: 1, maximum: 5, description: "1 to 5, scoring the model's potential, not the current team" },
      comment: {
        type: "string",
        description: "Two sentences at most, naming the constraint and its cause, fitting a scorecard row; no numbers that were not in the input or the tool results",
      },
      sources: {
        type: "array",
        items: { type: "string" },
        description: "Run ids of the tool results this row relied on, from the list given; may be empty",
      },
    },
  };
  return {
    name: "built_to_scale_synthesis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["rows", "verdict", "strongest", "weakest", "oneChange", "confidence", "confidenceReason"],
      properties: {
        rows: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          description: `Exactly five rows, one per dimension, in this order: ${BTS_PART_KEYS.join(", ")}.`,
          items: rowSchema,
        },
        verdict: { type: "string", description: "One line, under 15 words, that a founder would repeat to a co-founder" },
        strongest: { type: "string", description: "One line on the highest dimension, naming it" },
        weakest: { type: "string", description: "One line on the lowest dimension, naming it" },
        oneChange: { type: "string", description: "The single change that would lift the total most, one sentence, specific to this business" },
        confidence: { type: "string", enum: [...CONFIDENCE_LEVELS] },
        confidenceReason: { type: "string", description: "Under 25 words; name the input that would raise it" },
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates the answer: exactly five rows, each dimension once, grades
 * rounded and clamped 1 to 5, sources filtered to the allowed child ids with
 * order kept and duplicates removed, rows returned in the method's order
 * whatever order the model used. Sources are checked against the child ids
 * the model was shown so a working link can never point at a run outside
 * this composite.
 */
export function parseSynthesis(raw: unknown, allowedSources: readonly string[]): SynthesisResult {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  if (!Array.isArray(raw.rows)) throw new SchemaError("rows is not an array");
  if (raw.rows.length !== BTS_PARTS.length) throw new SchemaError(`rows has ${raw.rows.length} entries, expected ${BTS_PARTS.length}`);

  const allowed = new Set(allowedSources);
  const byKey = new Map<BtsPartKey, SynthesisRow>();
  for (const item of raw.rows) {
    if (!isRecord(item)) throw new SchemaError("a row is not an object");
    const dimension = item.dimension;
    if (typeof dimension !== "string" || !(BTS_PART_KEYS as readonly string[]).includes(dimension)) {
      throw new SchemaError(`rows.dimension is unknown: ${String(dimension)}`);
    }
    const key = dimension as BtsPartKey;
    if (byKey.has(key)) throw new SchemaError(`rows.dimension appears twice: ${key}`);
    if (typeof item.grade !== "number" || !Number.isFinite(item.grade)) {
      throw new SchemaError(`rows.${key}.grade is not a number`);
    }
    const grade = Math.min(5, Math.max(1, Math.round(item.grade)));
    const sources: string[] = [];
    if (Array.isArray(item.sources)) {
      for (const s of item.sources) {
        if (typeof s === "string" && allowed.has(s) && !sources.includes(s)) sources.push(s);
      }
    }
    byKey.set(key, { dimension: key, grade, comment: stringOrEmpty(item.comment), sources });
  }

  const rows = BTS_PART_KEYS.map((key) => byKey.get(key) as SynthesisRow);

  const verdict = stringOrEmpty(raw.verdict);
  if (!verdict) throw new SchemaError("verdict is missing");
  if (typeof raw.confidence !== "string" || !(CONFIDENCE_LEVELS as readonly string[]).includes(raw.confidence)) {
    throw new SchemaError("confidence is not low, medium or high");
  }

  return {
    rows,
    verdict,
    strongest: stringOrEmpty(raw.strongest),
    weakest: stringOrEmpty(raw.weakest),
    oneChange: stringOrEmpty(raw.oneChange),
    confidence: raw.confidence as Confidence,
    confidenceReason: stringOrEmpty(raw.confidenceReason),
  };
}
