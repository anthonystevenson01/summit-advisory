/**
 * JSON schemas generated from a registry entry, and the one validator for
 * model answers. Pure: no Redis, no network. Nothing anywhere else searches
 * model text for braces.
 */
import type { ToolEntry } from "./registry.ts";
import {
  CEILING_INPUT_KEYS,
  CEILING_INPUT_LABELS,
  type CeilingInput,
  type CeilingInputKey,
  type CeilingInputs,
} from "../ceiling.ts";

export type Confidence = "low" | "medium" | "high";

export const CONFIDENCE_LEVELS: readonly Confidence[] = ["low", "medium", "high"];

export interface ScoringResult {
  scores: Record<string, number>;
  verdict: string;
  confidence: Confidence;
  confidenceReason: string;
}

export interface RecommendationDraft {
  dim: string;
  gap: string;
  consequence: string;
  action: string;
}

/** A text extra, a list extra, or the three structured ceiling inputs (kind "ceiling"). */
export type ExtraValue = string | string[] | CeilingInputs;

export interface DetailsResult {
  reasoning: Record<string, string>;
  recommendations: RecommendationDraft[];
  extras: Record<string, ExtraValue>;
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

export type JsonSchema = Record<string, unknown>;

export interface NamedSchema {
  name: string;
  strict: true;
  schema: JsonSchema;
}

export function scoringSchema(entry: ToolEntry): NamedSchema {
  const scoreProps: Record<string, JsonSchema> = {};
  for (const d of entry.dimensions) {
    scoreProps[d.key] = {
      type: "integer",
      minimum: 1,
      maximum: 5,
      description: `${d.name}: 1 ${d.levels[1]}, 2 ${d.levels[2]}, 3 ${d.levels[3]}, 4 ${d.levels[4]}, 5 ${d.levels[5]}`,
    };
  }
  return {
    name: `${entry.slug}_scoring`,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["scores", "verdict", "confidence", "confidenceReason"],
      properties: {
        scores: {
          type: "object",
          additionalProperties: false,
          required: entry.dimensions.map((d) => d.key),
          properties: scoreProps,
        },
        verdict: {
          type: "string",
          description: "One sentence: the single most important finding.",
        },
        confidence: {
          type: "string",
          enum: [...CONFIDENCE_LEVELS],
          description: "How much evidence the input gave for the scores.",
        },
        confidenceReason: {
          type: "string",
          description: "Why that confidence level, under 20 words.",
        },
      },
    },
  };
}

const CEILING_VALUE_DESCRIPTIONS: Record<CeilingInputKey, string> = {
  unitsPerPersonPerPeriod: "Units one person delivers in one period, as a number, or null when the text does not say.",
  pricePerUnit: "Price of one unit in the currency the text uses, as a number, or null when the text does not say.",
  periodsPerYear: "Periods in a year, as a number, or null when the text does not say.",
};

const CEILING_ASSUMPTION_DESCRIPTION =
  "One sentence naming the figure and where in the text it comes from, or, when value is null, why the text does not support it.";

/**
 * The strict object schema for a "ceiling" extra: three required inputs,
 * each a nullable number with the assumption behind it. The figure itself is
 * computed in code (app/lib/ceiling.ts), never asked of the model.
 */
function ceilingSchema(ask: string): JsonSchema {
  const inputProps: Record<string, JsonSchema> = {};
  for (const key of CEILING_INPUT_KEYS) {
    inputProps[key] = {
      type: "object",
      additionalProperties: false,
      required: ["value", "assumption"],
      description: CEILING_INPUT_LABELS[key],
      properties: {
        value: { type: ["number", "null"], description: CEILING_VALUE_DESCRIPTIONS[key] },
        assumption: { type: "string", description: CEILING_ASSUMPTION_DESCRIPTION },
      },
    };
  }
  return {
    type: "object",
    additionalProperties: false,
    required: [...CEILING_INPUT_KEYS],
    description: ask,
    properties: inputProps,
  };
}

export function detailsSchema(entry: ToolEntry): NamedSchema {
  const reasoningProps: Record<string, JsonSchema> = {};
  for (const d of entry.dimensions) {
    reasoningProps[d.key] = {
      type: "string",
      description: `${d.name}: two or three sentences quoting the input where possible.`,
    };
  }
  const extraProps: Record<string, JsonSchema> = {};
  for (const x of entry.extras) {
    if (x.kind === "ceiling") {
      extraProps[x.key] = ceilingSchema(x.ask);
    } else if (x.kind === "list") {
      extraProps[x.key] = { type: "array", minItems: 1, maxItems: 5, items: { type: "string" }, description: x.ask };
    } else {
      extraProps[x.key] = { type: "string", description: x.ask };
    }
  }
  return {
    name: `${entry.slug}_details`,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["reasoning", "recommendations", "extras"],
      properties: {
        reasoning: {
          type: "object",
          additionalProperties: false,
          required: entry.dimensions.map((d) => d.key),
          properties: reasoningProps,
        },
        recommendations: {
          type: "array",
          description: "One entry per dimension scoring 3 or below.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["dim", "gap", "consequence", "action"],
            properties: {
              dim: { type: "string", enum: entry.dimensions.map((d) => d.key) },
              gap: { type: "string", description: "One or two sentences describing the specific gap, referencing concrete details from the input." },
              consequence: { type: "string", description: "One sentence on what this gap means for selling into a finite market." },
              action: { type: "string", description: "One concrete next step tailored to their market." },
            },
          },
        },
        extras: {
          type: "object",
          additionalProperties: false,
          required: entry.extras.map((x) => x.key),
          properties: extraProps,
        },
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampScore(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SchemaError(`scores.${key} is not a number`);
  }
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function parseScoring(entry: ToolEntry, raw: unknown): ScoringResult {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  if (!isRecord(raw.scores)) throw new SchemaError("scores is missing");
  const scores: Record<string, number> = {};
  for (const d of entry.dimensions) {
    if (!(d.key in raw.scores)) throw new SchemaError(`scores.${d.key} is missing`);
    scores[d.key] = clampScore(raw.scores[d.key], d.key);
  }
  if (typeof raw.verdict !== "string" || raw.verdict.trim().length === 0) {
    throw new SchemaError("verdict is missing");
  }
  if (typeof raw.confidence !== "string" || !(CONFIDENCE_LEVELS as readonly string[]).includes(raw.confidence)) {
    throw new SchemaError("confidence is not low, medium or high");
  }
  const confidenceReason = typeof raw.confidenceReason === "string" ? raw.confidenceReason.trim() : "";
  return {
    scores,
    verdict: raw.verdict.trim(),
    confidence: raw.confidence as Confidence,
    confidenceReason,
  };
}

/**
 * Validates a "ceiling" extra. A value that is null or a finite number is
 * kept as returned (zero and negatives included, so the run shows what the
 * model said; the calculator treats them as unsupported). Anything else
 * becomes null. A missing sub-object is a schema error.
 */
function parseCeilingInputs(key: string, raw: unknown): CeilingInputs {
  if (!isRecord(raw)) throw new SchemaError(`extras.${key} is not an object`);
  const parsed: Partial<Record<CeilingInputKey, CeilingInput>> = {};
  for (const inputKey of CEILING_INPUT_KEYS) {
    const input = raw[inputKey];
    if (!isRecord(input)) throw new SchemaError(`extras.${key}.${inputKey} is missing`);
    const value = typeof input.value === "number" && Number.isFinite(input.value) ? input.value : null;
    const assumption = typeof input.assumption === "string" ? input.assumption.trim() : "";
    parsed[inputKey] = { value, assumption };
  }
  return parsed as CeilingInputs;
}

export function parseDetails(entry: ToolEntry, raw: unknown): DetailsResult {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  if (!isRecord(raw.reasoning)) throw new SchemaError("reasoning is missing");
  const reasoning: Record<string, string> = {};
  for (const d of entry.dimensions) {
    const text = raw.reasoning[d.key];
    if (typeof text !== "string") throw new SchemaError(`reasoning.${d.key} is missing`);
    reasoning[d.key] = text.trim();
  }

  if (!Array.isArray(raw.recommendations)) throw new SchemaError("recommendations is not an array");
  const dimKeys = new Set(entry.dimensions.map((d) => d.key));
  const recommendations: RecommendationDraft[] = [];
  for (const item of raw.recommendations) {
    if (!isRecord(item)) continue;
    const { dim, gap, consequence, action } = item;
    if (typeof dim !== "string" || !dimKeys.has(dim)) continue;
    if (typeof gap !== "string" || typeof consequence !== "string" || typeof action !== "string") continue;
    recommendations.push({ dim, gap: gap.trim(), consequence: consequence.trim(), action: action.trim() });
  }

  const extrasRaw = isRecord(raw.extras) ? raw.extras : {};
  const extras: Record<string, ExtraValue> = {};
  for (const x of entry.extras) {
    const value = extrasRaw[x.key];
    if (x.kind === "ceiling") {
      extras[x.key] = parseCeilingInputs(x.key, value);
    } else if (x.kind === "list") {
      if (!Array.isArray(value)) throw new SchemaError(`extras.${x.key} is not a list`);
      extras[x.key] = value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
    } else {
      if (typeof value !== "string") throw new SchemaError(`extras.${x.key} is missing`);
      extras[x.key] = value.trim();
    }
  }

  return { reasoning, recommendations, extras };
}
