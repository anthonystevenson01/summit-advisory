/**
 * The strict JSON schema for the one extraction call, its parser, and the
 * placeholder rule that lets a thin draft through the 3a validator. Pure:
 * imports the method module and the schema module's error class only, so
 * the extraction stage, the rerun route and the tests read one definition.
 */
import { BTS_PARTS, PART_MAX, PART_MIN, type BtsPartKey, type PartsRecord } from "../tools/built-to-scale-method.ts";
import { CONFIDENCE_LEVELS, SchemaError, type Confidence, type JsonSchema, type NamedSchema } from "../tools/schema.ts";

export const EVIDENCE_MAX = 2;
export const EVIDENCE_CHARS = 300;
export const SUMMARY_CHARS = 1_200;
export const COMPANY_NAME_CHARS = 120;

export interface DraftedPart {
  text: string;
  evidence: string[];
  confidence: Confidence;
  reason: string;
}

export interface ExtractionResult {
  companyName: string;
  summary: string;
  parts: Record<BtsPartKey, DraftedPart>;
}

function partSchema(prompt: string): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["text", "evidence", "confidence", "reason"],
    properties: {
      text: {
        type: "string",
        description: `The drafted part in the voice of a founder describing their own business, 40 to 2000 characters when the material supports it, or an empty string when it does not; ${prompt}`,
      },
      evidence: {
        type: "array",
        maxItems: EVIDENCE_MAX,
        items: { type: "string" },
        description: "One or two short snippets quoted verbatim from the material that support the text; empty when text is empty.",
      },
      confidence: { type: "string", enum: [...CONFIDENCE_LEVELS] },
      reason: { type: "string", description: "Under 25 words on why that confidence, naming what the material lacked when it is low." },
    },
  };
}

export function extractionSchema(): NamedSchema {
  const partProps: Record<string, JsonSchema> = {};
  for (const part of BTS_PARTS) partProps[part.key] = partSchema(part.prompt);
  return {
    name: "ask_summit_extraction",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["companyName", "summary", "parts"],
      properties: {
        companyName: { type: "string", description: "The company's name as the material gives it; empty when the material does not say." },
        summary: {
          type: "string",
          description: "Three to five sentences on what the company sells, to whom and how, drawn only from the material; British spelling; no dashes.",
        },
        parts: {
          type: "object",
          additionalProperties: false,
          required: BTS_PARTS.map((p) => p.key),
          properties: partProps,
        },
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Cuts to `max` at the last space inside the limit. */
function fitTo(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.lastIndexOf(" ", max);
  return (cut > 0 ? value.slice(0, cut) : value.slice(0, max)).trimEnd();
}

/**
 * The one validator for the extraction answer. Every one of the five parts
 * must be present as an object and no other key may sit under `parts`;
 * `text` may be empty (the material did not support it); `evidence` keeps
 * the first two string snippets, each cut to 300 characters; `confidence`
 * must be in the enum.
 */
export function parseExtraction(raw: unknown): ExtractionResult {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  if (!isRecord(raw.parts)) throw new SchemaError("parts is missing");
  const known = new Set<string>(BTS_PARTS.map((p) => p.key));
  for (const key of Object.keys(raw.parts)) {
    if (!known.has(key)) throw new SchemaError(`parts.${key} is not a part`);
  }
  const parts = {} as Record<BtsPartKey, DraftedPart>;
  for (const part of BTS_PARTS) {
    const value = raw.parts[part.key];
    if (!isRecord(value)) throw new SchemaError(`parts.${part.key} is missing`);
    if (typeof value.text !== "string") throw new SchemaError(`parts.${part.key}.text is not a string`);
    if (typeof value.confidence !== "string" || !(CONFIDENCE_LEVELS as readonly string[]).includes(value.confidence)) {
      throw new SchemaError(`parts.${part.key}.confidence is not low, medium or high`);
    }
    const evidence = (Array.isArray(value.evidence) ? value.evidence : [])
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .slice(0, EVIDENCE_MAX)
      .map((v) => fitTo(v, EVIDENCE_CHARS));
    parts[part.key] = {
      text: fitTo(value.text.trim(), PART_MAX),
      evidence,
      confidence: value.confidence as Confidence,
      reason: typeof value.reason === "string" ? value.reason.trim() : "",
    };
  }
  const companyName = typeof raw.companyName === "string" ? raw.companyName.trim().slice(0, COMPANY_NAME_CHARS) : "";
  const summary = typeof raw.summary === "string" ? fitTo(raw.summary.trim(), SUMMARY_CHARS) : "";
  return { companyName, summary, parts };
}

/** The line that stands in for a part the material did not cover, so the run can proceed and score it as absent. */
export function thinPlaceholder(part: BtsPartKey): string {
  const label = BTS_PARTS.find((p) => p.key === part)?.label ?? part;
  return `The material Summit was given did not cover ${label}. Treat this part as absent and score it as such.`;
}

/**
 * The placeholder rule (AC4 d): the edited text when given, else the
 * drafted text; a result under PART_MIN becomes the text (when non-empty)
 * plus a space plus the placeholder, or the placeholder alone; cut to
 * PART_MAX. Runs before `validateParts` so a blank part never fails it.
 */
export function partsForScoring(parts: Record<BtsPartKey, Pick<DraftedPart, "text">>, edits?: Partial<Record<BtsPartKey, string>>): PartsRecord {
  const out = {} as PartsRecord;
  for (const part of BTS_PARTS) {
    const edited = edits?.[part.key];
    const chosen = typeof edited === "string" ? edited : (parts[part.key]?.text ?? "");
    const trimmed = chosen.trim();
    let text = trimmed;
    if (trimmed.length < PART_MIN) {
      text = trimmed.length > 0 ? `${trimmed} ${thinPlaceholder(part.key)}` : thinPlaceholder(part.key);
    }
    out[part.key] = fitTo(text, PART_MAX);
  }
  return out;
}
