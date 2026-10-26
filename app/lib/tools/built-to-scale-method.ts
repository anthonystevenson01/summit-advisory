/**
 * The Built to Scale? method as code: the five parts in the method's order,
 * the bands, the total, part validation, the composition of each tool's
 * inputs from the parts (and the reverse for the hand-off), the view types
 * and the copy constants every surface shares. Pure: imports only types from
 * the registry and the schema module, so the page, the server pages, the
 * routes, the email, the image and the tests all read one definition.
 *
 * What is code and what is Notion: the dimension names, the bands and the
 * total live here (they are maths and labels the scorecard must agree with);
 * the dimension definitions, the 1 and 5 descriptions, the synthesis steps
 * and the comment rules live in the Notion `built-to-scale` row and are read
 * at run time by the orchestration and rendered by the method page. A change
 * to the band table or the dimension names in Notion needs a matching edit
 * here.
 */
import type { BuiltToScaleDimension, ToolEntry, ToolSlug } from "./registry.ts";
import type { Confidence, ExtraValue } from "./schema.ts";

export const BUILT_TO_SCALE_TOOL = "built-to-scale";

export type BtsPartKey = BuiltToScaleDimension;

export interface BtsPart {
  key: BtsPartKey;
  /** The Notion dimension name, used on the scorecard, the image and the method. */
  name: string;
  /** The form label. */
  label: string;
  /** The one line under the label. */
  prompt: string;
  /** The line that prefixes the part inside a composed tool input. */
  heading: string;
  /** The "Show an example" text: one invented business throughout. */
  example: string;
}

export const PART_MIN = 40;
export const PART_MAX = 2000;

/**
 * The five parts in the method's order. The keys are the registry's
 * `BuiltToScaleDimension` values, so the mapping on each tool, the synthesis
 * schema's enum, the stored rows and the scorecard share one spelling; the
 * order here is the order of the form, the rows and the image.
 */
export const BTS_PARTS: readonly BtsPart[] = [
  {
    key: "pain",
    name: "Pain",
    label: "Pain",
    prompt: "The problem, who owns it, what it costs them and the proof they will pay.",
    heading: "Pain, the problem and who owns it:",
    example:
      "Mid-sized hospitals in Ontario and British Columbia have to run an incident response exercise every year to keep accreditation, and most run a poor one the week before the audit. The Director of Emergency Preparedness owns it and has a training budget of around 40,000 CAD. Twenty eight of the thirty hospitals we have run one for booked it again within eighteen months, so the pain is real and paid for.",
  },
  {
    key: "routeToBuyer",
    name: "Route to buyer",
    label: "Route to buyer",
    prompt: "Who signs, how you reach them today, the channels and gatekeepers, the cycle and what a win costs.",
    heading: "Route to buyer, who signs and how you reach them:",
    example:
      "The buyer is the Director of Emergency Preparedness, with the CFO signing anything over 25,000 CAD. There are about 190 such hospitals in Canada. Most first conversations start with a referral from a director we already serve, or at the two provincial emergency management conferences we sponsor. The founder runs every first call. From first contact to a signed order takes three to five months.",
  },
  {
    key: "unitOfValue",
    name: "Unit of value constraints",
    label: "Unit of value",
    prompt: "What one sale consumes, how it is priced, whether margin holds, how revenue repeats and what could break the ceiling.",
    heading: "Unit of value, what one sale consumes and how it is priced:",
    example:
      "One unit is a one day on site tabletop exercise run by one facilitator, with two days of preparation from templates and one day of write up. Priced per exercise at 9,500 CAD, or 25,000 CAD for a programme of three. A facilitator runs one exercise a week for forty weeks. Margin per exercise is about 55 percent and does not change with volume. Half of hospitals buy again. We are building a self serve scenario library that would sell as an annual licence.",
  },
  {
    key: "valueEvidence",
    name: "Value evidence",
    label: "Value evidence",
    prompt: "How a customer sees that it worked, how fast, and the number they could show their board.",
    heading: "Value evidence, how the customer sees the result:",
    example:
      "After the exercise the hospital gets a written gap report with the five actions it must take before the next audit, and the accreditation body accepts it as evidence. Directors tell us the report is the thing they show the board. We do not yet measure time to close the gaps, and the result shows up at the next audit, nine to twelve months later.",
  },
  {
    key: "abilityToProtect",
    name: "Ability to protect",
    label: "Ability to protect",
    prompt: "What stops someone copying it once it works, and whether each win makes the next easier.",
    heading: "Ability to protect, what stops a copy:",
    example:
      "The scenarios are ours and are refined after every exercise, and the two provincial emergency management associations list us as the only vendor they have reviewed. A competitor could hire a former emergency manager and start, but would not have the library of 60 hospital specific scenarios or the audit history. Each exercise adds a scenario and a referral.",
  },
];

export const BTS_PART_KEYS: readonly BtsPartKey[] = BTS_PARTS.map((p) => p.key);

export function isPartKey(value: string): value is BtsPartKey {
  return (BTS_PART_KEYS as readonly string[]).includes(value);
}

export function getPart(key: BtsPartKey): BtsPart {
  return BTS_PARTS.find((p) => p.key === key) as BtsPart;
}

/** Cuts at the last full stop inside the limit, so an example never ends mid sentence. */
function sliceAtFullStop(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(".", limit - 1);
  return cut > 0 ? text.slice(0, cut + 1) : text.slice(0, limit);
}

/** The quick check box: one description in place of the five parts. */
export const QUICK_BOX = {
  key: "description",
  label: "Describe the business",
  prompt:
    "What you sell, to whom, how you reach them, how you deliver and price it, how a customer sees the result, and what protects it. Numbers where you have them.",
  example: sliceAtFullStop(BTS_PARTS.map((p) => p.example).join("\n\n"), PART_MAX),
} as const;

// ── Copy ─────────────────────────────────────────────────────────────────────

/** The automated label, verbatim from the plan updates (section 7.3). */
export const AUTOMATED_LABEL =
  "This score was produced automatically. The rubrics behind it come from Summit's advisory work, so the questions and the standards are ours, but the reading of your answers was done by a model, not a person. It will miss context it was not given and it cannot check your claims. Treat it as a structured first opinion. If you want a person to look, ask Summit to score it.";

export const AUTOMATED_LINE = "Produced automatically against Summit's rubrics. A structured first opinion, not advice.";

export const QUICK_NOTE = "Quick check from one description: confidence is one step lower than a five part run would earn.";

export const LOCKED_COMMENT = "Unlock the full view to read the comment.";

/**
 * Prefixed to every composed input in quick mode. The tool scoring prompts
 * are fixed, so this is the only way to tell a tool it is reading one
 * unstructured description; without it an absent answer would read as a
 * middling one, so the note says absence scores 1.
 */
export const QUICK_MODE_INPUT_NOTE =
  "Note: this is one unstructured description of the business, written for a quick Built to Scale? check, not an answer to this field. Score only what it supports; what it does not mention scores 1, not 3.";

const QUICK_MODE_HEADING = "Business description:";

/** For the synthesis system prompt in quick mode. The lower confidence is by instruction, not code: the model knows what the evidence alone would justify. */
export function quickModeInstruction(): string {
  return "This run was made from one unstructured description, not the five parts. Return confidence one step lower than the evidence alone would justify, never high, and in confidenceReason name which of the five parts, written out properly, would raise it most.";
}

/** For the synthesis system prompt when a tool is hidden or its row is Draft, so the scorecard is honest about what did not run. */
export function absentToolsInstruction(absent: readonly string[]): string {
  return `These tools were not available for this run: ${absent.join(", ")}. Where a dimension lists no tool, grade it from the visitor's own text for that part and lower confidence one step.`;
}

// ── Total and band ───────────────────────────────────────────────────────────

export type BandKey = "built" | "work" | "engine" | "hard";

export interface Band {
  key: BandKey;
  label: string;
  min: number;
  max: number;
}

/** The four bands, highest first. Labels are the Notion row's wording. */
export const BANDS: readonly Band[] = [
  { key: "built", label: "Built to scale", min: 20, max: 25 },
  { key: "work", label: "Built to scale, with work to do", min: 15, max: 19 },
  { key: "engine", label: "A good idea with an engine still to build", min: 10, max: 14 },
  { key: "hard", label: "A hard model", min: 5, max: 9 },
];

export const TOTAL_MIN = 5;
export const TOTAL_MAX = 25;

/** The band for a total 5 to 25. Throws outside the range so a bug can never show a blank band. */
export function bandFor(total: number): Band {
  if (!Number.isInteger(total) || total < TOTAL_MIN || total > TOTAL_MAX) {
    throw new RangeError(`total out of range: ${total}`);
  }
  return BANDS.find((b) => total >= b.min && total <= b.max) as Band;
}

/** The sum of the five grades. */
export function totalOf(rows: readonly { grade: number }[]): number {
  return rows.reduce((sum, r) => sum + r.grade, 0);
}

// ── Validation ───────────────────────────────────────────────────────────────

export type PartsRecord = Record<BtsPartKey, string>;

export type PartsValidation =
  | { ok: true; parts: PartsRecord; quickMode: boolean }
  | { ok: false; error: string };

function lengthError(label: string, value: string): string | null {
  if (value.length === 0) return `${label} is required.`;
  if (value.length < PART_MIN) return `${label} must be at least ${PART_MIN} characters.`;
  if (value.length > PART_MAX) return `${label} must be under ${PART_MAX.toLocaleString("en-GB")} characters.`;
  return null;
}

/**
 * Reads `parts` (an object keyed by part key) and `description` (a string)
 * from the request body. Parts with at least one non-empty value win and
 * must all be 40 to 2000 characters; otherwise a description of the same
 * length runs in quick mode as every part. Unknown keys are dropped and
 * values trimmed.
 */
export function validateParts(body: unknown): PartsValidation {
  const source = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const rawParts = typeof source.parts === "object" && source.parts !== null ? (source.parts as Record<string, unknown>) : null;

  const trimmed: Partial<PartsRecord> = {};
  if (rawParts) {
    for (const part of BTS_PARTS) {
      const raw = rawParts[part.key];
      trimmed[part.key] = typeof raw === "string" ? raw.trim() : "";
    }
  }
  const anyPart = BTS_PARTS.some((p) => (trimmed[p.key] ?? "").length > 0);

  if (anyPart) {
    const parts = {} as PartsRecord;
    for (const part of BTS_PARTS) {
      const value = trimmed[part.key] ?? "";
      const error = lengthError(part.label, value);
      if (error) return { ok: false, error };
      parts[part.key] = value;
    }
    return { ok: true, parts, quickMode: false };
  }

  const description = typeof source.description === "string" ? source.description.trim() : "";
  if (description.length > 0) {
    const error = lengthError("The description", description);
    if (error) return { ok: false, error };
    const parts = {} as PartsRecord;
    for (const part of BTS_PARTS) parts[part.key] = description;
    return { ok: true, parts, quickMode: true };
  }

  return { ok: false, error: "Fill in the five parts or describe the business." };
}

// ── Composition ──────────────────────────────────────────────────────────────

/** Cuts to `max` at the last space before the limit; nothing is padded. */
function fitTo(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.lastIndexOf(" ", max);
  return (cut > 0 ? value.slice(0, cut) : value.slice(0, max)).trimEnd();
}

/**
 * Builds every input of a tool from the parts. Five-part mode renders each
 * mapped part as its heading on one line then the text, parts separated by a
 * blank line. Quick mode renders the note, a blank line, the business
 * description heading and the description once, however many parts the
 * mapping names. An input with an empty mapping is "".
 *
 * Why headings and no padding: the tool scoring prompts are fixed, so the
 * only place to tell a tool what it is reading is inside its input. Each
 * heading names the part and is long enough that a 40 character part clears
 * every input's minLength. An input is cut at its maxLength on a word
 * boundary, so a part near 2000 characters can lose its tail where the
 * heading pushes it over. A part that feeds two inputs of one tool is
 * repeated in both, which the rubrics read as the same paragraph pasted
 * twice.
 */
export function composeToolInputs(entry: ToolEntry, parts: PartsRecord, quickMode: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const input of entry.inputs) {
    const mapping = entry.builtToScale[input.key] ?? [];
    if (mapping.length === 0) {
      out[input.key] = "";
      continue;
    }
    let value: string;
    if (quickMode) {
      const description = parts[mapping[0]] ?? "";
      value = `${QUICK_MODE_INPUT_NOTE}\n\n${QUICK_MODE_HEADING}\n${description}`;
    } else {
      const seen = new Set<string>();
      const blocks: string[] = [];
      for (const key of mapping) {
        const text = (parts[key] ?? "").trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);
        blocks.push(`${getPart(key).heading}\n${text}`);
      }
      value = blocks.join("\n\n");
    }
    out[input.key] = fitTo(value, input.maxLength);
  }
  return out;
}

/**
 * The reverse, for the hand-off from a tool result: each non-empty input is
 * placed into every part its mapping names, appended after a blank line when
 * another input already filled that part (identical text is not repeated).
 * Values are sliced to the part limit. Parts no input names stay "".
 */
export function expandPartsFromInputs(entry: ToolEntry, inputs: Record<string, string>): PartsRecord {
  const parts = {} as PartsRecord;
  for (const part of BTS_PARTS) parts[part.key] = "";
  for (const input of entry.inputs) {
    const text = (inputs[input.key] ?? "").trim();
    if (!text) continue;
    for (const key of entry.builtToScale[input.key] ?? []) {
      const current = parts[key];
      if (current === text || current.split("\n\n").includes(text)) continue;
      parts[key] = (current ? `${current}\n\n${text}` : text).slice(0, PART_MAX);
    }
  }
  return parts;
}

// ── View types ───────────────────────────────────────────────────────────────

export interface FeedingTool {
  tool: ToolSlug;
  name: string;
  number: string;
}

/** A structural copy of the pipeline's recommendation shape so this module imports no store. */
export interface WorkingRecommendation {
  dim: string;
  name: string;
  score: number;
  gap: string;
  consequence: string;
  action: string;
}

/** A structural copy of the pipeline's FullView: a child tool's full result. */
export interface WorkingFullView {
  runId: string;
  tool: ToolSlug;
  score: number;
  grade: number;
  gradeLabel: string;
  gradeDescription: string;
  legacyLabel?: string;
  verdict: string;
  confidence: Confidence;
  confidenceReason: string;
  scores: Record<string, number>;
  unlocked: boolean;
  reasoning: Record<string, string>;
  recommendations: WorkingRecommendation[];
  extras: Record<string, ExtraValue>;
}

export interface WorkingEntry extends FeedingTool {
  runId: string;
  /** Null when the child's details have not been produced or could not be loaded. */
  full: WorkingFullView | null;
}

export interface CompositeRow {
  key: BtsPartKey;
  name: string;
  grade: number;
  feeds: FeedingTool[];
  /** Full view only. */
  comment?: string;
  /** Full view only: child run ids the model cited. */
  sources?: string[];
  /** Full view only: one entry per feeding child, registry order. */
  working?: WorkingEntry[];
}

export interface CompositeFullRow extends CompositeRow {
  comment: string;
  sources: string[];
  working: WorkingEntry[];
}

export interface CompositeFreeView {
  runId: string;
  tool: typeof BUILT_TO_SCALE_TOOL;
  total: number;
  band: string;
  bandKey: BandKey;
  verdict: string;
  strongest: string;
  weakest: string;
  confidence: Confidence;
  confidenceReason: string;
  quickMode: boolean;
  createdAt: string;
  rows: CompositeRow[];
  absentTools: string[];
  unlocked: boolean;
}

export interface CompositeFullView extends CompositeFreeView {
  rows: CompositeFullRow[];
  oneChange: string;
}

/** The full view is the one carrying oneChange; the routes return either shape under one type. */
export function isCompositeFullView(view: CompositeFreeView | CompositeFullView): view is CompositeFullView {
  return typeof (view as CompositeFullView).oneChange === "string";
}
