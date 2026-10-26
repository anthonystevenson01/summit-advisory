/**
 * The /admin/stats aggregation: event rows and call log rows in, the plain
 * tables out. Pure: the step names and the status list only, so the page
 * is a thin reader and the numbers are tested with a fixture.
 *
 * Counts are events, not sessions (events carry no session id), so the
 * funnel percentages are event ratios. Model rows are filtered to the
 * builder routing keys inside the window; a call whose cost OpenRouter did
 * not report counts as zero and sets `costIncomplete`.
 */
import { STEPS } from "./catalogue.ts";
import { BRIEF_STATUSES, SUGGEST_STEPS, type BriefStatus } from "./brief.ts";

export interface EventRow {
  name: string;
  ts: string;
  props: Record<string, unknown>;
}

/** The `AiCallLog` shape as a structural type, so this module never imports llm.ts. */
export interface CallRow {
  ts: string;
  key: string;
  model: string;
  runId: string | null;
  promptTokens: number;
  completionTokens: number;
  cost: number | null;
  ok: boolean;
}

export interface BriefSummaryRow {
  id: string;
  status: string;
  submittedAt: string | null;
  firstStatusChangeAt: string | null;
}

export type StatsDays = 7 | 30 | 90;

export interface StatsWindow {
  days: StatsDays;
  start: number;
  end: number;
}

export function parseWindow(daysParam: string | undefined, now: number): StatsWindow {
  const days: StatsDays = daysParam === "7" ? 7 : daysParam === "90" ? 90 : 30;
  return { days, start: now - days * 24 * 60 * 60 * 1000, end: now };
}

export interface FunnelRow {
  key: string;
  label: string;
  count: number;
  drop: number | null;
  dropPct: number | null;
}

export interface SourceRow {
  source: string;
  saves: number;
  submits: number;
}

export interface HelperRow {
  step: string;
  uses: number;
  fallbacks: number;
}

export interface ModelRow {
  key: string;
  calls: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}

export interface StatsTables {
  window: StatsWindow;
  funnel: FunnelRow[];
  bySource: SourceRow[];
  helpers: HelperRow[];
  reads: { uses: number; fallbacks: number };
  ideasRuns: { uses: number; fallbacks: number };
  models: ModelRow[];
  modelsTotal: ModelRow;
  costIncomplete: boolean;
  costPerSubmittedBrief: number | null;
  briefsByStatus: Array<{ status: BriefStatus; label: string; count: number }>;
  medianHoursToFirstStatusChange: number | null;
}

export interface StatsInput {
  events: EventRow[];
  calls: CallRow[];
  briefs: BriefSummaryRow[];
  window: StatsWindow;
}

function inWindow(ts: string, w: StatsWindow): boolean {
  const t = Date.parse(ts);
  return Number.isFinite(t) && t >= w.start && t <= w.end;
}

function stepOf(props: Record<string, unknown>): number | null {
  const n = typeof props.step === "number" ? props.step : Number(props.step);
  return Number.isInteger(n) ? n : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function aggregateStats(input: StatsInput): StatsTables {
  const { window } = input;
  const events = input.events.filter((e) => typeof e.name === "string" && inWindow(e.ts, window) && typeof e.props === "object" && e.props !== null);

  const count = (name: string, pred: (p: Record<string, unknown>) => boolean = () => true) =>
    events.filter((e) => e.name === name && pred(e.props)).length;

  const funnelCounts: Array<[string, string, number]> = [
    ["started", "Started", count("builder_started")],
    ...[1, 2, 3, 4, 5].map((n): [string, string, number] => [`step${n}`, `Completed step ${n}: ${STEPS[n - 1]}`, count("builder_step_completed", (p) => stepOf(p) === n)]),
    ["saved", "Saved", count("builder_saved")],
    ["submitted", "Submitted", count("builder_submitted")],
  ];
  const funnel: FunnelRow[] = funnelCounts.map(([key, label, c], i) => {
    if (i === 0) return { key, label, count: c, drop: null, dropPct: null };
    const prev = funnelCounts[i - 1][2];
    const drop = prev - c;
    return { key, label, count: c, drop, dropPct: prev > 0 ? Math.round((drop / prev) * 100) : null };
  });

  const sources = new Map<string, SourceRow>();
  for (const e of events) {
    if (e.name !== "builder_saved" && e.name !== "builder_submitted") continue;
    const tag = typeof e.props.source === "string" && e.props.source ? e.props.source : "(none)";
    const row = sources.get(tag) ?? { source: tag, saves: 0, submits: 0 };
    if (e.name === "builder_saved") row.saves += 1;
    else row.submits += 1;
    sources.set(tag, row);
  }
  const bySource = [...sources.values()].sort((a, b) => b.saves + b.submits - (a.saves + a.submits) || a.source.localeCompare(b.source));

  const helperSteps: string[] = [...SUGGEST_STEPS, "lookup"];
  const helpers: HelperRow[] = helperSteps.map((step) => ({
    step,
    uses: count("builder_suggest_used", (p) => p.step === step),
    fallbacks: count("builder_suggest_used", (p) => p.step === step && p.fallback === true),
  }));
  const reads = { uses: count("builder_doc_read"), fallbacks: count("builder_doc_read", (p) => p.fallback === true) };
  const ideasRuns = { uses: count("builder_ideas_run"), fallbacks: count("builder_ideas_run", (p) => p.fallback === true) };

  const calls = input.calls.filter((c) => typeof c.key === "string" && c.key.startsWith("builder-") && inWindow(c.ts, window));
  const byKey = new Map<string, ModelRow>();
  let costIncomplete = false;
  for (const c of calls) {
    const row = byKey.get(c.key) ?? { key: c.key, calls: 0, failed: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
    row.calls += 1;
    if (!c.ok) row.failed += 1;
    row.promptTokens += Number(c.promptTokens) || 0;
    row.completionTokens += Number(c.completionTokens) || 0;
    if (typeof c.cost === "number" && Number.isFinite(c.cost)) row.cost += c.cost;
    else costIncomplete = true;
    byKey.set(c.key, row);
  }
  const models = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  const modelsTotal: ModelRow = models.reduce(
    (t, r) => ({ key: "total", calls: t.calls + r.calls, failed: t.failed + r.failed, promptTokens: t.promptTokens + r.promptTokens, completionTokens: t.completionTokens + r.completionTokens, cost: t.cost + r.cost }),
    { key: "total", calls: 0, failed: 0, promptTokens: 0, completionTokens: 0, cost: 0 },
  );

  const submits = count("builder_submitted");
  const costPerSubmittedBrief = submits > 0 ? modelsTotal.cost / submits : null;

  const briefsByStatus = BRIEF_STATUSES.map((s) => ({ status: s.key, label: s.label, count: input.briefs.filter((b) => b.status === s.key).length }));

  const hours: number[] = [];
  for (const b of input.briefs) {
    if (!b.submittedAt || !b.firstStatusChangeAt) continue;
    const a = Date.parse(b.submittedAt);
    const z = Date.parse(b.firstStatusChangeAt);
    if (Number.isFinite(a) && Number.isFinite(z) && z >= a) hours.push((z - a) / 3_600_000);
  }

  return {
    window,
    funnel,
    bySource,
    helpers,
    reads,
    ideasRuns,
    models,
    modelsTotal,
    costIncomplete,
    costPerSubmittedBrief,
    briefsByStatus,
    medianHoursToFirstStatusChange: median(hours),
  };
}
