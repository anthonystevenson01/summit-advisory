/**
 * The stage clock for the processing route: six stages in order, a cap and
 * a minimum for each, and a 290 second budget so the route always answers
 * inside `maxDuration = 300`. A stage's allowance is its cap, or what is
 * left of the budget after the minimums of every later stage, whichever is
 * smaller; when that is below the stage's own minimum the clock refuses
 * to start it and names it, which is how the route reports which stage ran
 * out of time rather than hanging. Pure: the clock is given its start time
 * and reads Date.now() only as a default.
 */

export const STAGES = ["crawl", "documents", "extraction", "scoring", "report", "finish"] as const;

export type AskStage = (typeof STAGES)[number];

/**
 * Caps and minimums per stage. The minimums sum to 150 s, so every stage
 * is guaranteed a start when the earlier ones use their caps. The
 * extraction minimum sits 4 s under its cap on purpose: the text-only
 * fallback in extraction.ts needs a full minimum left, so it only fires
 * when the provider rejects the PDFs almost at once; a slow failure is
 * reported as the stage running out of time. Raise the extraction cap if
 * the fallback never fires.
 */
export const STAGE_PLAN: Record<AskStage, { capMs: number; minMs: number }> = {
  crawl: { capMs: 100_000, minMs: 20_000 },
  documents: { capMs: 40_000, minMs: 10_000 },
  extraction: { capMs: 60_000, minMs: 56_000 },
  scoring: { capMs: 120_000, minMs: 60_000 },
  report: { capMs: 5_000, minMs: 3_000 },
  finish: { capMs: 3_000, minMs: 1_000 },
};

export const PROCESS_BUDGET_MS = 290_000;

export type AskTimings = Record<AskStage, number> & { total: number };

export class StageTimedOutError extends Error {
  readonly stage: AskStage;
  constructor(stage: AskStage, reason: string) {
    super(reason);
    this.name = "StageTimedOutError";
    this.stage = stage;
  }
}

export interface StageClock {
  /** The milliseconds the stage may use from `nowMs`; throws StageTimedOutError when below the stage's minimum. */
  allowance(stage: AskStage, nowMs?: number): number;
  /** `nowMs` plus the allowance. */
  deadlineFor(stage: AskStage, nowMs?: number): number;
  start(stage: AskStage, nowMs?: number): void;
  finish(stage: AskStage, nowMs?: number): void;
  timings(nowMs?: number): AskTimings;
}

function laterMinimums(stage: AskStage): number {
  const index = STAGES.indexOf(stage);
  return STAGES.slice(index + 1).reduce((sum, s) => sum + STAGE_PLAN[s].minMs, 0);
}

export function createStageClock(startedAtMs: number): StageClock {
  const started: Partial<Record<AskStage, number>> = {};
  const finished: Partial<Record<AskStage, number>> = {};

  function allowance(stage: AskStage, nowMs: number = Date.now()): number {
    const elapsed = Math.max(0, nowMs - startedAtMs);
    const remaining = PROCESS_BUDGET_MS - elapsed - laterMinimums(stage);
    const allowed = Math.min(STAGE_PLAN[stage].capMs, remaining);
    if (allowed < STAGE_PLAN[stage].minMs) {
      throw new StageTimedOutError(
        stage,
        `ran out of time before ${stage}: ${Math.max(0, Math.round(remaining / 1000))} s left, ${Math.round(STAGE_PLAN[stage].minMs / 1000)} s needed`,
      );
    }
    return allowed;
  }

  return {
    allowance,
    deadlineFor(stage, nowMs = Date.now()) {
      return nowMs + allowance(stage, nowMs);
    },
    start(stage, nowMs = Date.now()) {
      started[stage] = nowMs;
    },
    finish(stage, nowMs = Date.now()) {
      if (started[stage] === undefined) started[stage] = nowMs;
      finished[stage] = nowMs;
    },
    timings(nowMs = Date.now()) {
      const out = {} as AskTimings;
      let total = 0;
      for (const stage of STAGES) {
        const from = started[stage];
        const to = finished[stage];
        const ms = from === undefined ? 0 : Math.max(0, (to ?? nowMs) - from);
        out[stage] = ms;
        total += ms;
      }
      out.total = total;
      return out;
    },
  };
}
