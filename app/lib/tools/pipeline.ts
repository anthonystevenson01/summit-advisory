/**
 * The pipeline: scoreRun and detailRun. The only code that builds prompts or
 * calls llm.ts. The three generic routes wrap it; the calibration script
 * imports it directly.
 *
 * Stage order, identical for every tool:
 *   1. validate the inputs against the registry (unknown keys are dropped)
 *   2. load the rubric and system prompt server side (Notion via rubrics.ts)
 *   3. call the scoring model with a JSON schema generated from the registry
 *   4. compute the score out of 100 and the 1 to 5 grade; carry the verdict
 *      and confidence the model returned
 *   5. persist the run with the rubric hash and the model that answered
 *   6. return the free view
 * detailRun repeats 2, 3 and 5 with the details model after an unlock check.
 * A run is unlocked when the record carries an unlock, when the route passes
 * verified cookie claims (the pipeline then records the unlock from the
 * cookie, hash only), or when the saved-link token verified for this run.
 * The pipeline never reads a cookie, header or env; the routes verify and
 * pass plain claims in.
 *
 * The rubric is loaded here rather than sent by the page so that the text a
 * visitor is scored against is always the Published Notion row, can never be
 * supplied or edited through a request body, and never reaches the browser.
 * Its hash is written onto every run so a stored score can be traced to the
 * exact rubric version that produced it after the row changes.
 */
import { getTool, type ToolEntry, type ToolSlug } from "./registry.ts";
import { renderInputs, validateInputs } from "./validate.ts";
import { detailsSchema, parseDetails, parseScoring, type ExtraValue } from "./schema.ts";
import { scoringSchema } from "./schema.ts";
import { calcScore, gradeFor, legacyLabelFor, type Grade } from "./scoring.ts";
import { getRubric, type Rubric } from "../rubrics.ts";
import { callModel } from "../llm.ts";
import { getRun, markUnlocked, newRunId, saveRun, updateRun, type Recommendation, type RunRecord } from "../runs.ts";
import { track } from "../events.ts";

export class ToolNotFoundError extends Error {
  constructor(slug: string) {
    super(`tool not found: ${slug}`);
    this.name = "ToolNotFoundError";
  }
}

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export class RunNotFoundError extends Error {
  constructor(id: string) {
    super(`run not found: ${id}`);
    this.name = "RunNotFoundError";
  }
}

export class UnlockRequiredError extends Error {
  constructor() {
    super("unlock required");
    this.name = "UnlockRequiredError";
  }
}

export interface PipelineContext {
  source: "web" | "calibration" | "built-to-scale";
  ip?: string;
  /** The composite run this child belongs to, set by the Built to Scale? orchestration. */
  parentId?: string;
  /** Verified claims from the unlock cookie, passed in by the route. */
  cookieUnlock?: { emailHash: string };
  /** True when the saved-link token verified for this run id. */
  linkVerified?: boolean;
}

export type UnlockVia = "form" | "cookie" | "link";

export interface DetailResult {
  full: FullView;
  run: RunRecord;
  /** True when this call produced the details; false on the stored early return. */
  generated: boolean;
}

export interface FreeView {
  runId: string;
  tool: ToolSlug;
  score: number;
  grade: number;
  gradeLabel: string;
  gradeDescription: string;
  legacyLabel?: string;
  verdict: string;
  confidence: RunRecord["confidence"];
  confidenceReason: string;
  scores: Record<string, number>;
  /** True when the run record carries an unlock. The score route may also set it from the cookie. */
  unlocked: boolean;
}

export interface FullView extends FreeView {
  reasoning: Record<string, string>;
  recommendations: Recommendation[];
  extras: Record<string, ExtraValue>;
}

export function toFreeView(run: RunRecord): FreeView {
  const entry = getTool(run.tool);
  const grade = gradeFor(run.score);
  const legacyLabel = entry ? legacyLabelFor(entry, run.grade as Grade) : undefined;
  return {
    runId: run.id,
    tool: run.tool,
    score: run.score,
    grade: run.grade,
    gradeLabel: grade.label,
    gradeDescription: grade.desc,
    ...(legacyLabel ? { legacyLabel } : {}),
    verdict: run.verdict,
    confidence: run.confidence,
    confidenceReason: run.confidenceReason,
    scores: run.scores,
    unlocked: run.unlock !== null,
  };
}

export function toFullView(run: RunRecord): FullView {
  return {
    ...toFreeView(run),
    reasoning: run.dimensionReasoning ?? {},
    recommendations: run.recommendations ?? [],
    extras: run.extras ?? {},
  };
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const SCORING_GUIDE =
  "Scoring guide: 1 means absent or missing, 2 means vague or minimal, 3 means partial or named, 4 means solid and specific, 5 means exceptional and evidenced.\n" +
  "Score accurately. Missing elements score 1, not 3. Vague mentions score 2. Be strict.";

function dimensionList(entry: ToolEntry): string {
  return entry.dimensions
    .map((d) => {
      const levels = ([1, 2, 3, 4, 5] as const).map((l) => `${l} ${d.levels[l]}`).join(", ");
      return `- ${d.key}: ${d.name} (weight ${Math.round(d.weight * 100)}%). Levels: ${levels}`;
    })
    .join("\n");
}

function buildScoringSystem(entry: ToolEntry, rubric: Rubric): string {
  const parts = [
    `You are ${entry.role}.`,
    rubric.systemPrompt,
    `Score the input across these ${entry.dimensions.length} dimensions, each an integer from 1 to 5:\n${dimensionList(entry)}`,
    SCORING_GUIDE,
    "Also return:\n- verdict: one sentence, the single most important finding.\n- confidence: low, medium or high, reflecting how much evidence the input gave for the scores.\n- confidenceReason: why that confidence level, under 20 words.",
    `Scoring criteria\n\n${rubric.rubric}`,
  ];
  return parts.filter((p) => p && p.trim().length > 0).join("\n\n");
}

function buildScoringUser(entry: ToolEntry, inputs: Record<string, string>): string {
  return `Score this input. Return the JSON object only.\n\n<user_input>\n${renderInputs(entry, inputs)}\n</user_input>`;
}

function buildDetailsSystem(entry: ToolEntry, rubric: Rubric, scores: Record<string, number>): string {
  const scoreLines = entry.dimensions
    .map((d) => {
      const s = scores[d.key] ?? 3;
      return `- ${d.key}: ${d.name}: ${s} (${d.levels[s as 1 | 2 | 3 | 4 | 5] ?? ""})`;
    })
    .join("\n");
  const keys = entry.dimensions.map((d) => d.key).join(", ");
  const low = entry.dimensions.filter((d) => (scores[d.key] ?? 3) <= 3).map((d) => d.key);
  const extrasAsk = entry.extras.length
    ? `3. extras: ${entry.extras.map((x) => `${x.key} (${x.label}): ${x.ask}`).join(" ")}`
    : "3. extras: none for this tool; return an empty object.";
  const parts = [
    `You are ${entry.role}.`,
    rubric.systemPrompt,
    `The input has already been scored. The scores are:\n${scoreLines}`,
    `Provide:\n1. reasoning: for each dimension (${keys}), two or three sentences explaining what evidence you found or did not find in the input. Quote specific phrases where possible.\n2. recommendations: one entry for each dimension scoring 3 or below (${low.length ? low.join(", ") : "none"}), each with dim (the dimension key), gap (one or two sentences describing the specific gap, referencing concrete details from the input), consequence (one sentence on what this gap means for selling into a finite market) and action (one concrete next step tailored to their market).\n${extrasAsk}`,
    "Tone: constructive and advisory. Focus on what to improve and how. Avoid harsh language; frame gaps as opportunities.",
    `Scoring criteria\n\n${rubric.rubric}`,
  ];
  return parts.filter((p) => p && p.trim().length > 0).join("\n\n");
}

function buildDetailsUser(entry: ToolEntry, inputs: Record<string, string>): string {
  return `Provide reasoning, recommendations and the extras for this input. Return the JSON object only.\n\n<user_input>\n${renderInputs(entry, inputs)}\n</user_input>`;
}

// ── scoreRun ─────────────────────────────────────────────────────────────────

export async function scoreRun(
  slug: string,
  rawInputs: unknown,
  ctx: PipelineContext,
): Promise<{ run: RunRecord; free: FreeView }> {
  const entry = getTool(slug);
  if (!entry || entry.hidden) throw new ToolNotFoundError(slug);

  const validated = validateInputs(entry, rawInputs);
  if (!validated.ok) throw new InputError(validated.error);
  const inputs = validated.inputs;

  // Calibration runs go through the same stages but are never persisted or
  // tracked: the admin runs table stays clean and only ai:calls (with a cal_
  // id) records the spend. Web runs and Built to Scale? children are both
  // persisted; the source and parentId on the record tell them apart.
  const persisted = ctx.source !== "calibration";
  const runId = persisted ? newRunId() : `cal_${newRunId().slice(4)}`;
  if (persisted) void track("tool_started", { tool: entry.slug, source: ctx.source });

  const rubric = await getRubric(entry.slug);

  const call = await callModel({
    routingKey: `scoring:${entry.slug}`,
    runId,
    system: buildScoringSystem(entry, rubric),
    user: buildScoringUser(entry, inputs),
    schema: scoringSchema(entry),
    parse: (raw) => parseScoring(entry, raw),
  });

  const score = calcScore(call.data.scores, entry.dimensions);
  const grade = gradeFor(score);

  const run: RunRecord = {
    id: runId,
    tool: entry.slug,
    createdAt: new Date().toISOString(),
    source: ctx.source === "calibration" ? "web" : ctx.source,
    parentId: ctx.parentId ?? null,
    inputs,
    scores: call.data.scores,
    score,
    grade: grade.grade,
    verdict: call.data.verdict,
    confidence: call.data.confidence,
    confidenceReason: call.data.confidenceReason,
    extras: null,
    dimensionReasoning: null,
    recommendations: null,
    missingRecommendations: null,
    detailsAt: null,
    rubricVersion: rubric.version,
    rubricHash: rubric.hash,
    detailsRubricHash: null,
    models: { scoring: call.model },
    routes: { scoring: call.resolvedKey },
    calibrated: { scoring: call.calibrated },
    unlock: null,
    emailStatus: null,
    emailedAt: null,
  };

  if (persisted) {
    try {
      await saveRun(run);
    } catch (err) {
      console.error(`${entry.slug} score: run persist failed`, err instanceof Error ? err.message : err);
    }
    void track("result_shown", { tool: entry.slug, runId, score, grade: grade.grade, confidence: run.confidence, source: ctx.source });
  }

  return { run, free: toFreeView(run) };
}

// ── detailRun ────────────────────────────────────────────────────────────────

export async function detailRun(runId: string, ctx: PipelineContext): Promise<DetailResult> {
  let run = await getRun(runId);
  if (!run) throw new RunNotFoundError(runId);

  let via: UnlockVia;
  if (run.unlock) {
    via = "form";
  } else if (ctx.cookieUnlock) {
    // A cookie unlock is recorded on the run from the cookie: hash only, no
    // name or company, so the run persists and is indexed by email hash.
    const unlock = { emailHash: ctx.cookieUnlock.emailHash, email: "", name: "", company: "", at: new Date().toISOString() };
    await markUnlocked(run.id, unlock);
    run = { ...run, unlock };
    via = "cookie";
  } else if (ctx.linkVerified) {
    via = "link";
  } else {
    throw new UnlockRequiredError();
  }

  // Details are generated once per run. Re-opening serves the stored full
  // view, so a second request costs nothing and cannot drift from the first.
  if (run.detailsAt) return { full: toFullView(run), run, generated: false };

  const entry = getTool(run.tool);
  if (!entry) throw new ToolNotFoundError(run.tool);

  const rubric = await getRubric(entry.slug);

  const call = await callModel({
    routingKey: `details:${entry.slug}`,
    runId: run.id,
    system: buildDetailsSystem(entry, rubric, run.scores),
    user: buildDetailsUser(entry, run.inputs),
    schema: detailsSchema(entry),
    parse: (raw) => parseDetails(entry, raw),
  });

  const seen = new Set<string>();
  const recommendations: Recommendation[] = [];
  for (const rec of call.data.recommendations) {
    const score = run.scores[rec.dim] ?? 3;
    if (score > 3 || seen.has(rec.dim)) continue;
    seen.add(rec.dim);
    const name = entry.dimensions.find((d) => d.key === rec.dim)?.name ?? rec.dim;
    recommendations.push({ dim: rec.dim, name, score, gap: rec.gap, consequence: rec.consequence, action: rec.action });
  }
  const missingRecommendations = entry.dimensions
    .filter((d) => (run.scores[d.key] ?? 3) <= 3 && !seen.has(d.key))
    .map((d) => d.key);

  const patch: Partial<RunRecord> = {
    dimensionReasoning: call.data.reasoning,
    recommendations,
    missingRecommendations,
    extras: call.data.extras,
    detailsAt: new Date().toISOString(),
    // Set only when the rubric changed between the score and the details
    // call, so a run that mixes two rubric versions is visible in admin.
    detailsRubricHash: rubric.hash !== run.rubricHash ? rubric.hash : null,
    models: { ...run.models, details: call.model },
    routes: { ...run.routes, details: call.resolvedKey },
    calibrated: { ...run.calibrated, details: call.calibrated },
  };
  await updateRun(run.id, patch);
  void track("full_view_opened", { tool: entry.slug, runId: run.id, via });

  const updated = { ...run, ...patch } as RunRecord;
  return { full: toFullView(updated), run: updated, generated: true };
}
