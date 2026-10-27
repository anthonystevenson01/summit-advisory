/**
 * The Built to Scale? orchestration: scoreModel and detailModel. The only
 * file that builds the synthesis prompt. The score and details routes wrap
 * it; the calibration script imports it directly.
 *
 * scoreModel: validate the five parts (or the one description), load the
 * `built-to-scale` rubric row first (a Draft row fails fast and spends no
 * child calls), compose each public tool's inputs from the parts through the
 * registry mapping, run scoreRun for every public tool in parallel, then one
 * synthesis call on the `synthesis` routing key with the row's system prompt
 * and body, the parts and every child's free view grouped by the dimension
 * it feeds. The total out of 25 and the band are computed in code from the
 * five grades the model returns; the schema has no total or band field.
 *
 * Hidden tool rule, stated once: a hidden tool is never a candidate; its slug
 * goes into `absentTools` and the system prompt lists it as unavailable, so
 * a dimension with no feeding tool is graded from the visitor's own text with
 * lowered confidence. A child whose Notion row is Draft is treated the same
 * way at run time. Any other child failure fails the run: a scorecard built
 * on fewer tools without saying so would be dishonest.
 *
 * Time: children overlap (worst about 55 s together) and the synthesis is
 * another call (worst about 55 s), so with `deadlineAt` set the synthesis is
 * refused with under 15 s left and raced against the remaining budget. A
 * synthesis that loses the race is logged by llm.ts whenever it settles; the
 * children are already stored and the route answers 502.
 *
 * detailModel: authorise as detailRun does (record, cookie, link), serve the
 * stored full view when every child's working exists, otherwise produce each
 * child's full view through detailRun in parallel and cache it on the child.
 * Comments and the one change are stored on the composite at score time and
 * are gated behind the unlock in the view projection, not in the store.
 */
import { PUBLIC_TOOLS, TOOLS, getTool, type ToolEntry } from "./registry.ts";
import {
  InputError,
  RunNotFoundError,
  UnlockRequiredError,
  detailRun,
  scoreRun,
  toFullView,
  type PipelineContext,
  type UnlockVia,
} from "./pipeline.ts";
import { gradeFor } from "./scoring.ts";
import { callModel } from "../llm.ts";
import { RubricNotPublishedError, getRubric, type Rubric } from "../rubrics.ts";
import {
  getCompositeRun,
  getToolRuns,
  markCompositeUnlocked,
  newRunId,
  saveCompositeRun,
  updateRun,
  type CompositeRunRecord,
  type RunRecord,
} from "../runs.ts";
import { track } from "../events.ts";
import {
  BTS_PARTS,
  BUILT_TO_SCALE_TOOL,
  absentToolsInstruction,
  bandFor,
  composeToolInputs,
  quickModeInstruction,
  totalOf,
  validateParts,
  type BtsPartKey,
  type CompositeFreeView,
  type CompositeFullRow,
  type CompositeFullView,
  type CompositeRow,
  type FeedingTool,
  type PartsRecord,
  type WorkingEntry,
} from "./built-to-scale-method.ts";
import { parseSynthesis, synthesisSchema } from "./built-to-scale-schema.ts";

export class SynthesisFailedError extends Error {
  constructor(message: string) {
    super(`synthesis failed: ${message}`);
    this.name = "SynthesisFailedError";
  }
}

export class NoToolsAvailableError extends Error {
  constructor() {
    super("no tool rubric is published");
    this.name = "NoToolsAvailableError";
  }
}

export interface ScoreModelContext {
  /** "ask-summit" persists and tracks as "web" does and stamps the record so its result surfaces stay admin only. */
  source: "web" | "calibration" | "ask-summit";
  ip?: string;
  /** The Ask Summit request behind a processing call; passed to every callModel as a log tag. */
  requestId?: string;
  /** Epoch ms by which the route must have answered; the synthesis is refused or abandoned against it. */
  deadlineAt?: number;
}

export interface ScoreModelResult {
  run: CompositeRunRecord;
  free: CompositeFreeView;
  children: RunRecord[];
}

export interface DetailModelResult {
  full: CompositeFullView;
  run: CompositeRunRecord;
  /** True when this call produced every child's working; false on the stored early return or a partial result. */
  generated: boolean;
}

/** Below this remaining budget the synthesis is not started. */
const SYNTHESIS_MIN_BUDGET_MS = 15_000;
/** The synthesis is abandoned this long before the deadline so the 502 still goes out. */
const SYNTHESIS_MARGIN_MS = 1_000;

const ABSENT_REASON_HIDDEN = "hidden";
const ABSENT_REASON_NOT_PUBLISHED = "rubric not published";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function feedingTool(entry: ToolEntry): FeedingTool {
  return { tool: entry.slug, name: entry.name, number: entry.number };
}

/** The scored tools, in registry order, that ran in this composite and feed the key. */
function feedersOf(run: CompositeRunRecord, key: BtsPartKey): ToolEntry[] {
  return TOOLS.filter((t) => t.slug in run.children && t.feeds.includes(key));
}

// ── Views ────────────────────────────────────────────────────────────────────

/**
 * What anyone with the link sees: total, band, verdict, strongest, weakest,
 * confidence and the five grades with the tools that fed each. No comment,
 * no one change and no child run id, so a shared result page cannot lead to
 * a child's inputs through the prefill endpoint.
 */
export function toCompositeFreeView(run: CompositeRunRecord): CompositeFreeView {
  const rows: CompositeRow[] = BTS_PARTS.map((part) => {
    const stored = run.rows.find((r) => r.key === part.key);
    return {
      key: part.key,
      name: part.name,
      grade: stored?.grade ?? 0,
      feeds: feedersOf(run, part.key).map(feedingTool),
    };
  });
  return {
    runId: run.id,
    tool: BUILT_TO_SCALE_TOOL,
    total: run.total,
    band: run.band,
    bandKey: run.bandKey,
    verdict: run.verdict,
    strongest: run.strongest,
    weakest: run.weakest,
    confidence: run.confidence,
    confidenceReason: run.confidenceReason,
    quickMode: run.quickMode,
    createdAt: run.createdAt,
    rows,
    absentTools: run.absentTools,
    unlocked: run.unlock !== null,
  };
}

/**
 * The gated view: the free view plus each row's comment and cited sources,
 * the one change and, per feeding tool, the child's full view when its
 * working exists (`detailsAt` set) or null when it does not, so a partial
 * working renders a fallback line in one row rather than failing the page.
 */
export function toCompositeFullView(run: CompositeRunRecord, children: RunRecord[]): CompositeFullView {
  const free = toCompositeFreeView(run);
  const byId = new Map(children.map((c) => [c.id, c]));
  const rows: CompositeFullRow[] = free.rows.map((row) => {
    const stored = run.rows.find((r) => r.key === row.key);
    const working: WorkingEntry[] = feedersOf(run, row.key).map((entry) => {
      const childId = run.children[entry.slug];
      const child = byId.get(childId);
      return {
        ...feedingTool(entry),
        runId: childId,
        full: child && child.detailsAt ? toFullView(child) : null,
      };
    });
    return { ...row, comment: stored?.comment ?? "", sources: stored?.sources ?? [], working };
  });
  return { ...free, rows, oneChange: run.oneChange };
}

// ── Synthesis prompt ─────────────────────────────────────────────────────────

function toolNamesFor(key: BtsPartKey, ran: ToolEntry[]): string {
  const names = ran.filter((t) => t.feeds.includes(key)).map((t) => t.name);
  return names.length > 0 ? names.join(", ") : "no tool in this run";
}

/**
 * The system prompt: the row's own system prompt first, then the dimensions
 * with the tools that fed each in this run, the rules the schema cannot
 * express (grades only, cite by run id), the absent-tool and quick-mode
 * instructions when they apply, and the row's body as the method. Nothing
 * in it comes from the request.
 */
function buildSynthesisSystem(rubric: Rubric, ran: ToolEntry[], absentNames: string[], quickMode: boolean): string {
  const dimensionLines = BTS_PARTS.map((p) => `${p.key}: ${p.name}. Fed by: ${toolNamesFor(p.key, ran)}`).join("\n");
  const parts = [
    rubric.systemPrompt,
    `The five dimensions, in order, with the tools that feed each:\n${dimensionLines}`,
    "Grades are integers from 1 to 5. The total out of 25 and the band are computed by the code; do not return them. Cite a row's sources by run id from the list in the results.",
    absentNames.length > 0 ? absentToolsInstruction(absentNames) : "",
    quickMode ? quickModeInstruction() : "",
    "Only the scoring results are available here; the full working is produced later.",
    "Return the JSON object only.",
    `Method\n\n${rubric.rubric}`,
  ];
  return parts.filter((p) => p && p.trim().length > 0).join("\n\n");
}

/** One child's free view as the synthesis reads it, headed by its run id so the model can cite it. */
function childResultBlock(entry: ToolEntry, child: RunRecord): string {
  const grade = gradeFor(child.score);
  const dims = entry.dimensions
    .map((d) => {
      const s = child.scores[d.key];
      const level = d.levels[s as 1 | 2 | 3 | 4 | 5] ?? "";
      return `${d.name} ${s ?? "?"} (${level})`;
    })
    .join("; ");
  return [
    `Tool ${entry.number} ${entry.name} (run ${child.id})`,
    `Score ${child.score} of 100, grade ${child.grade} of 5 (${grade.label}), confidence ${child.confidence}: ${child.confidenceReason}`,
    `Verdict: ${child.verdict}`,
    `Dimension scores: ${dims}`,
  ].join("\n");
}

/**
 * The user content: the visitor's parts (the one description in quick mode),
 * then every child result under the dimension it feeds, in the method's
 * order. A dimension with no feeding tool says so; the absent-tool
 * instruction tells the model to grade that one from the text.
 */
function buildSynthesisUser(parts: PartsRecord, quickMode: boolean, children: Array<{ entry: ToolEntry; run: RunRecord }>): string {
  const lines: string[] = ["## The visitor's five parts", ""];
  if (quickMode) {
    lines.push("### Business description (unstructured, used for every part)", parts.pain, "");
  } else {
    for (const part of BTS_PARTS) lines.push(`### ${part.name}`, parts[part.key], "");
  }
  lines.push("## Tool results by dimension", "");
  for (const part of BTS_PARTS) {
    lines.push(`### ${part.name}`);
    const feeding = children.filter(({ entry }) => entry.feeds.includes(part.key));
    if (feeding.length === 0) {
      lines.push("No tool result for this dimension in this run.", "");
      continue;
    }
    for (const { entry, run } of feeding) lines.push(childResultBlock(entry, run), "");
  }
  return lines.join("\n").trimEnd();
}

// ── scoreModel ───────────────────────────────────────────────────────────────

/**
 * Stages, in order:
 *   1. validate the body (InputError before any spend);
 *   2. load the `built-to-scale` row: a Draft row throws here, before any
 *      child call is made;
 *   3. compose each public tool's inputs and run scoreRun for all of them in
 *      parallel; each child that fulfils is stored with `parentId` before the
 *      synthesis starts;
 *   4. refuse the synthesis with under 15 s of the route's budget left,
 *      otherwise race it against the deadline;
 *   5. total and band from the five grades, in code; save the composite; track.
 *
 * `ctx.source` "calibration" gives a `cal_` id (not a run id, so nothing can
 * read it back) and skips persisting and tracking, as scoreRun does.
 */
export async function scoreModel(body: unknown, ctx: ScoreModelContext): Promise<ScoreModelResult> {
  const validated = validateParts(body);
  if (!validated.ok) throw new InputError(validated.error);
  const { parts, quickMode } = validated;

  const isWeb = ctx.source !== "calibration";
  const runId = isWeb ? newRunId() : `cal_${newRunId().slice(4)}`;
  if (isWeb) void track("bts_started", { quickMode, source: ctx.source });

  // The composite row first: a Draft row fails fast and spends no child calls.
  const rubric = await getRubric(BUILT_TO_SCALE_TOOL);

  // Candidates are the public tools; hidden scored tools are absent by rule.
  const candidates = PUBLIC_TOOLS;
  const absent: Array<{ slug: string; reason: string }> = TOOLS.filter((t) => t.hidden && t.dimensions.length > 0).map((t) => ({
    slug: t.slug,
    reason: ABSENT_REASON_HIDDEN,
  }));

  const childSource: PipelineContext["source"] = ctx.source === "calibration" ? "calibration" : "built-to-scale";
  // allSettled rather than all: every child must settle so a Draft child row
  // (absent) can be told apart from a real failure (the run fails), and so a
  // failure never leaves a sibling call unobserved.
  const settled = await Promise.allSettled(
    candidates.map((entry) =>
      scoreRun(entry.slug, composeToolInputs(entry, parts, quickMode), { source: childSource, ip: ctx.ip, parentId: runId, requestId: ctx.requestId }),
    ),
  );

  const children: Array<{ entry: ToolEntry; run: RunRecord }> = [];
  let failure: unknown = null;
  settled.forEach((result, i) => {
    const entry = candidates[i];
    if (result.status === "fulfilled") {
      children.push({ entry, run: result.value.run });
    } else if (result.reason instanceof RubricNotPublishedError) {
      absent.push({ slug: entry.slug, reason: ABSENT_REASON_NOT_PUBLISHED });
    } else if (failure === null) {
      failure = result.reason;
    }
  });
  if (failure !== null) throw failure;
  if (children.length === 0) throw new NoToolsAvailableError();

  const absentTools = absent.map((a) => a.slug);
  const absentNames = absent.map((a) => `${getTool(a.slug)?.name ?? a.slug} (${a.reason})`);
  const ran = children.map((c) => c.entry);
  const childIds = children.map((c) => c.run.id);

  if (ctx.deadlineAt !== undefined && ctx.deadlineAt - Date.now() < SYNTHESIS_MIN_BUDGET_MS) {
    throw new SynthesisFailedError("no time left for the synthesis");
  }

  const modelCall = callModel({
    routingKey: "synthesis",
    runId,
    requestId: ctx.requestId ?? null,
    system: buildSynthesisSystem(rubric, ran, absentNames, quickMode),
    user: buildSynthesisUser(parts, quickMode, children),
    schema: synthesisSchema(),
    parse: (raw) => parseSynthesis(raw, childIds),
    temperature: 0,
  });

  let call: Awaited<typeof modelCall>;
  if (ctx.deadlineAt === undefined) {
    try {
      call = await modelCall;
    } catch (err) {
      throw new SynthesisFailedError(errorMessage(err));
    }
  } else {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const budget = Math.max(0, ctx.deadlineAt - SYNTHESIS_MARGIN_MS - Date.now());
    const abandoned = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SynthesisFailedError("the synthesis overran the route's deadline")), budget);
    });
    // The model call keeps running until the function freezes; llm.ts logs it
    // whenever it settles. The catch keeps a late rejection from being unhandled.
    modelCall.catch(() => {});
    try {
      call = await Promise.race([modelCall, abandoned]);
    } catch (err) {
      throw err instanceof SynthesisFailedError ? err : new SynthesisFailedError(errorMessage(err));
    } finally {
      clearTimeout(timer);
    }
  }

  const rows = call.data.rows.map((r) => ({ key: r.dimension, grade: r.grade, comment: r.comment, sources: r.sources }));
  const total = totalOf(rows);
  const band = bandFor(total);

  const run: CompositeRunRecord = {
    id: runId,
    tool: BUILT_TO_SCALE_TOOL,
    createdAt: new Date().toISOString(),
    source: ctx.source === "ask-summit" ? "ask-summit" : "web",
    quickMode,
    inputs: quickMode ? { description: parts.pain } : { ...parts },
    children: Object.fromEntries(children.map((c) => [c.entry.slug, c.run.id])),
    absentTools,
    rows,
    total,
    bandKey: band.key,
    band: band.label,
    verdict: call.data.verdict,
    strongest: call.data.strongest,
    weakest: call.data.weakest,
    oneChange: call.data.oneChange,
    confidence: call.data.confidence,
    confidenceReason: call.data.confidenceReason,
    rubricVersion: rubric.version,
    rubricHash: rubric.hash,
    models: { synthesis: call.model },
    routes: { synthesis: call.resolvedKey },
    calibrated: { synthesis: call.calibrated },
    detailsAt: null,
    unlock: null,
    emailStatus: null,
    emailedAt: null,
  };

  if (isWeb) {
    try {
      await saveCompositeRun(run);
    } catch (err) {
      console.error("built-to-scale score: run persist failed", errorMessage(err));
    }
    void track("bts_result_shown", {
      runId,
      total,
      band: band.key,
      confidence: run.confidence,
      quickMode,
      children: children.length,
      absent: absentTools,
    });
  }

  return { run, free: toCompositeFreeView(run), children: children.map((c) => c.run) };
}

// ── detailModel ──────────────────────────────────────────────────────────────

/**
 * The full view. Authorisation mirrors detailRun: an unlock on record, the
 * cookie (recorded onto the composite and every child, so the working lives
 * as long as the scorecard), or the saved-link token; anything else throws
 * UnlockRequiredError. With `detailsAt` set the stored children are read and
 * nothing is generated. Otherwise every child's full view is produced in
 * parallel through detailRun, which caches it on the child. `detailsAt` is
 * set and the event tracked only when every child succeeded: a partial
 * working is served, with null working for the failed child, but is not
 * treated as complete and is never emailed.
 */
export async function detailModel(runId: string, ctx: PipelineContext): Promise<DetailModelResult> {
  let run = await getCompositeRun(runId);
  if (!run) throw new RunNotFoundError(runId);
  const childIds = Object.values(run.children);

  let via: UnlockVia;
  if (run.unlock) {
    via = "form";
  } else if (ctx.cookieUnlock) {
    const unlock = { emailHash: ctx.cookieUnlock.emailHash, email: "", name: "", company: "", at: new Date().toISOString() };
    await markCompositeUnlocked(run.id, childIds, unlock);
    run = { ...run, unlock };
    via = "cookie";
  } else if (ctx.linkVerified) {
    via = "link";
  } else {
    throw new UnlockRequiredError();
  }

  if (run.detailsAt) {
    const children = await getToolRuns(childIds);
    return { full: toCompositeFullView(run, children), run, generated: false };
  }

  // Each child carries the parent's unlock, so detailRun authorises it as
  // "form" and serves stored details on repeat. The link flag is passed for
  // the one case where the composite was authorised by link alone.
  const settled = await Promise.allSettled(
    childIds.map((childId) => detailRun(childId, { source: "web", ip: ctx.ip, linkVerified: via === "link" })),
  );
  const children: RunRecord[] = [];
  let failed = 0;
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      children.push(result.value.run);
    } else {
      failed += 1;
      console.error(`built-to-scale details: child ${childIds[i]} failed: ${errorMessage(result.reason)}`);
    }
  });

  if (failed === 0) {
    const detailsAt = new Date().toISOString();
    await updateRun(run.id, { detailsAt });
    run = { ...run, detailsAt };
    void track("bts_full_view_opened", { runId: run.id, via });
    return { full: toCompositeFullView(run, children), run, generated: true };
  }

  return { full: toCompositeFullView(run, children), run, generated: false };
}
