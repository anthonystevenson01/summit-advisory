/**
 * The stats aggregation over a fixture of a few dozen events, twelve call
 * rows and five brief summaries. Pure module, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { BRIEF_STATUSES } from "../app/lib/project-builder/brief.ts";
import { aggregateStats, parseWindow, type BriefSummaryRow, type CallRow, type EventRow } from "../app/lib/project-builder/stats.ts";

const NOW = Date.parse("2026-10-26T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const window = parseWindow("30", NOW);

function at(daysAgo: number): string {
  return new Date(NOW - daysAgo * DAY).toISOString();
}

function ev(name: string, props: Record<string, unknown> = {}, daysAgo = 3): EventRow {
  return { name, ts: at(daysAgo), props };
}

function events(): EventRow[] {
  const out: EventRow[] = [];
  for (let i = 0; i < 10; i += 1) out.push(ev("builder_started"));
  const perStep = [8, 7, 5, 4, 3];
  perStep.forEach((n, i) => {
    for (let k = 0; k < n; k += 1) out.push(ev("builder_step_completed", { step: i + 1 }));
  });
  out.push(ev("builder_saved", { source: "linkedin", path: "idea" }));
  out.push(ev("builder_saved", { source: "linkedin", path: "doc" }));
  out.push(ev("builder_saved", { source: "", path: "idea" }));
  out.push(ev("builder_saved", { source: "newsletter", path: "replace" }));
  out.push(ev("builder_submitted", { source: "linkedin", path: "idea", mustCount: 4 }));
  out.push(ev("builder_submitted", { source: "", path: "doc", mustCount: 6 }));
  out.push(ev("builder_suggest_used", { step: "goal", fallback: false }));
  out.push(ev("builder_suggest_used", { step: "goal", fallback: true }));
  out.push(ev("builder_suggest_used", { step: "features", fallback: false }));
  out.push(ev("builder_suggest_used", { step: "guardrails", fallback: true }));
  out.push(ev("builder_suggest_used", { step: "lookup", fallback: false }));
  out.push(ev("builder_suggest_used", { step: "running", fallback: false }));
  out.push(ev("builder_doc_read", { path: "doc", found: 5, fallback: false }));
  out.push(ev("builder_doc_read", { path: "built", found: 2, fallback: false }));
  out.push(ev("builder_ideas_run", { fallback: false }));
  out.push(ev("builder_ideas_run", { fallback: true }));
  out.push(ev("builder_ideas_run", { fallback: false }));
  out.push(ev("builder_started", {}, 45));
  out.push({ name: "builder_step_completed", ts: at(2), props: null as unknown as Record<string, unknown> });
  return out;
}

function call(key: string, cost: number | null, daysAgo = 2, ok = true, extra: Partial<CallRow> = {}): CallRow {
  return { ts: at(daysAgo), key, model: "m", runId: null, promptTokens: 100, completionTokens: 10, cost, ok, ...extra };
}

function calls(): CallRow[] {
  return [
    call("builder-suggest", 0.01), call("builder-suggest", 0.01), call("builder-suggest", 0.02, 2, false), call("builder-suggest", null),
    call("builder-ideas", 0.1), call("builder-ideas", 0.1), call("builder-read", 0.05), call("builder-read", 0.05),
    call("builder-read", 0.05), call("builder-ideas", 0.1), call("scoring", 0.5), call("builder-suggest", 0.01, 40),
  ];
}

function briefs(): BriefSummaryRow[] {
  return [
    { id: "a", status: "draft", submittedAt: null, firstStatusChangeAt: null },
    { id: "b", status: "submitted", submittedAt: at(5), firstStatusChangeAt: null },
    { id: "c", status: "quoted", submittedAt: at(6), firstStatusChangeAt: at(5) },
    { id: "d", status: "quoted", submittedAt: at(10), firstStatusChangeAt: at(7) },
    { id: "e", status: "draft", submittedAt: null, firstStatusChangeAt: null },
  ];
}

describe("parseWindow", () => {
  test("7, 30 and 90; anything else is 30", () => {
    assert.equal(parseWindow("7", NOW).days, 7);
    assert.equal(parseWindow("90", NOW).days, 90);
    assert.equal(parseWindow("x", NOW).days, 30);
    assert.equal(parseWindow(undefined, NOW).days, 30);
    assert.equal(parseWindow("90", NOW).start, NOW - 90 * DAY);
  });
});

describe("aggregateStats", () => {
  const t = aggregateStats({ events: events(), calls: calls(), briefs: briefs(), window });

  test("the funnel has eight rows with drops and percentages; out of window and malformed rows ignored", () => {
    assert.deepEqual(t.funnel.map((r) => r.count), [10, 8, 7, 5, 4, 3, 4, 2]);
    assert.equal(t.funnel[0].drop, null);
    assert.equal(t.funnel[0].dropPct, null);
    assert.equal(t.funnel[1].drop, 2);
    assert.equal(t.funnel[1].dropPct, 20);
    assert.equal(t.funnel[3].drop, 2);
    assert.equal(t.funnel[3].dropPct, 29);
    assert.equal(t.funnel[6].drop, -1);
    assert.equal(t.funnel[7].dropPct, 50);
  });

  test("saves and submits by source with (none) for an empty tag", () => {
    assert.deepEqual(t.bySource, [
      { source: "linkedin", saves: 2, submits: 1 },
      { source: "(none)", saves: 1, submits: 1 },
      { source: "newsletter", saves: 1, submits: 0 },
    ]);
  });

  test("helper use by step with fallbacks; reads and ideas runs", () => {
    assert.deepEqual(t.helpers, [
      { step: "goal", uses: 2, fallbacks: 1 },
      { step: "features", uses: 1, fallbacks: 0 },
      { step: "connections", uses: 0, fallbacks: 0 },
      { step: "guardrails", uses: 1, fallbacks: 1 },
      { step: "running", uses: 1, fallbacks: 0 },
      { step: "lookup", uses: 1, fallbacks: 0 },
    ]);
    assert.deepEqual(t.reads, { uses: 2, fallbacks: 0 });
    assert.deepEqual(t.ideasRuns, { uses: 3, fallbacks: 1 });
  });

  test("model rows for builder keys only, null cost as zero and costIncomplete, cost per submitted brief", () => {
    assert.deepEqual(t.models.map((m) => m.key), ["builder-ideas", "builder-read", "builder-suggest"]);
    const suggest = t.models.find((m) => m.key === "builder-suggest")!;
    assert.equal(suggest.calls, 4);
    assert.equal(suggest.failed, 1);
    assert.equal(suggest.promptTokens, 400);
    assert.ok(Math.abs(suggest.cost - 0.04) < 1e-9);
    assert.equal(t.modelsTotal.calls, 10);
    assert.ok(Math.abs(t.modelsTotal.cost - 0.49) < 1e-9);
    assert.equal(t.costIncomplete, true);
    assert.ok(Math.abs((t.costPerSubmittedBrief ?? 0) - 0.245) < 1e-9);
    const none = aggregateStats({ events: [], calls: calls(), briefs: [], window });
    assert.equal(none.costPerSubmittedBrief, null);
    assert.equal(none.medianHoursToFirstStatusChange, null);
  });

  test("briefs by status in order and the median hours to the first status change", () => {
    assert.deepEqual(t.briefsByStatus.map((b) => b.status), BRIEF_STATUSES.map((s) => s.key));
    assert.equal(t.briefsByStatus.find((b) => b.status === "draft")?.count, 2);
    assert.equal(t.briefsByStatus.find((b) => b.status === "quoted")?.count, 2);
    assert.equal(t.medianHoursToFirstStatusChange, 48);
  });

  test("prototype counts by mode, failures, corrected runs and style status", () => {
    const protoEvents: EventRow[] = [
      ev("builder_prototype_run", { mode: "created", path: "create", ok: true, corrected: false, style: "found" }),
      ev("builder_prototype_run", { mode: "created", path: "create", ok: true, corrected: true, style: "none" }),
      ev("builder_prototype_run", { mode: "updated", path: "edits", ok: true, corrected: false, style: "found" }),
      ev("builder_prototype_run", { mode: "updated", path: "rebuild", ok: false, reason: "invalid" }),
      ev("builder_prototype_run", { mode: "created", path: "create", ok: true, corrected: false }, 45),
      ev("builder_prototype_style", { status: "found", reason: "", source: "site", brand: "not-needed" }),
      ev("builder_prototype_style", { status: "partial", reason: "", source: "site+brand", brand: "hit" }),
      ev("builder_prototype_style", { status: "none", reason: "no-website", source: "neutral", brand: "no-website" }),
      ev("builder_prototype_style", { status: "none", reason: "unreadable", source: "neutral", brand: "miss" }),
      ev("builder_prototype_style", { status: "found", reason: "", source: "brand", brand: "cached-hit" }),
      ev("builder_prototype_style", { status: "none", reason: "unreadable", source: "neutral", brand: "cached-miss" }),
      ev("builder_prototype_style", { status: "none", reason: "unreadable", source: "neutral", brand: "error" }),
      ev("builder_prototype_style", { status: "none", reason: "unreadable", source: "neutral", brand: "cap" }),
    ];
    const p = aggregateStats({ events: protoEvents, calls: [], briefs: [], window }).prototypes;
    assert.deepEqual(p, {
      created: 2,
      updated: 1,
      failed: 1,
      corrected: 1,
      styleFound: 2,
      stylePartial: 1,
      styleNone: 5,
      brandLookups: 3,
      brandHits: 2,
      brandCached: 2,
      brandMisses: 2,
      brandErrors: 1,
      brandCapped: 1,
      sourceSite: 1,
      sourceBrand: 1,
      sourceSiteBrand: 1,
      sourceNeutral: 5,
    });
    assert.ok(Object.values(t.prototypes).every((n) => n === 0));
  });

  test("the prototype pipeline rows: one per key with median and p95 ms, fix retries from tags, fallbacks, cost reported or from the price table", () => {
    const rows: CallRow[] = [
      call("builder-prototype-plan", 0.02, 2, true, { ms: 100, tag: "plan", model: "anthropic/x" }),
      call("builder-prototype-plan", 0.03, 2, true, { ms: 300, tag: "gap", model: "anthropic/x" }),
      call("builder-prototype-plan", null, 2, false, { ms: 1_000, tag: "diff", model: "anthropic/x", fallbackUsed: true }),
      call("builder-prototype-build", 0.1, 2, true, { ms: 20_000, tag: "screen:dashboard", model: "openai/y" }),
      call("builder-prototype-build", 0.1, 2, true, { ms: 25_000, tag: "screen:jobs", model: "openai/y" }),
      call("builder-prototype-build", null, 2, true, { ms: 30_000, tag: "retry", model: "openai/y", fallbackUsed: true }),
      call("builder-prototype-build", 0.1, 2, true, { ms: 40_000, tag: "screen:settings", model: "openai/y", costSource: "reported" }),
      call("builder-prototype-audit", 0.001, 40, true, { ms: 5_000, tag: "audit" }),
    ];
    const prices = { "openai/y": { input: 10, output: 50 } };
    const t2 = aggregateStats({ events: [], calls: rows, briefs: [], window, prices });
    assert.deepEqual(t2.prototypeKeys.map((r) => r.key), ["builder-prototype-research", "builder-prototype-plan", "builder-prototype-review", "builder-prototype-build", "builder-prototype-audit"]);
    const planRow = t2.prototypeKeys.find((r) => r.key === "builder-prototype-plan")!;
    assert.equal(planRow.calls, 3);
    assert.equal(planRow.failed, 1);
    assert.equal(planRow.medianMs, 300);
    assert.equal(planRow.p95Ms, 1_000);
    assert.equal(planRow.fixRetries, 1);
    assert.equal(planRow.fallbacks, 1);
    assert.ok(Math.abs(planRow.cost - 0.05) < 1e-9);
    assert.equal(planRow.costEstimated, false);
    assert.equal(planRow.promptTokens, 300);
    const buildRow = t2.prototypeKeys.find((r) => r.key === "builder-prototype-build")!;
    assert.equal(buildRow.calls, 4);
    assert.equal(buildRow.medianMs, 27_500);
    assert.equal(buildRow.p95Ms, 40_000);
    assert.equal(buildRow.fixRetries, 1);
    assert.equal(buildRow.fallbacks, 1);
    // Three reported at 0.1 plus one estimated: 100 prompt tokens at $10 per M and 10 completion tokens at $50 per M.
    assert.ok(Math.abs(buildRow.cost - (0.3 + (100 * 10 + 10 * 50) / 1e6)) < 1e-9);
    assert.equal(buildRow.costEstimated, true);
    const research = t2.prototypeKeys.find((r) => r.key === "builder-prototype-research")!;
    assert.deepEqual(research, { key: "builder-prototype-research", label: "Research", calls: 0, failed: 0, medianMs: null, p95Ms: null, promptTokens: 0, completionTokens: 0, cost: 0, costEstimated: false, fixRetries: 0, fallbacks: 0 });
    assert.equal(t2.prototypeKeys.find((r) => r.key === "builder-prototype-audit")!.calls, 0);
    // The price table also fills the per key model rows, so the unpriced build call is no longer incomplete.
    const build = t2.models.find((m) => m.key === "builder-prototype-build")!;
    assert.ok(Math.abs(build.cost - buildRow.cost) < 1e-9);
    assert.equal(t2.costIncomplete, true);
  });

  test("the change requests row counts requests, declined ones and the median screens changed", () => {
    const reqEvents: EventRow[] = [
      ev("builder_prototype_request", { ok: true, declined: false, screens: 1 }),
      ev("builder_prototype_request", { ok: true, declined: false, screens: 3 }),
      ev("builder_prototype_request", { ok: true, declined: false, screens: 2 }),
      ev("builder_prototype_request", { ok: true, declined: true, screens: 0 }),
      ev("builder_prototype_request", { ok: false, reason: "time" }),
      ev("builder_prototype_request", { ok: true, declined: false, screens: 5 }, 45),
    ];
    const t3 = aggregateStats({ events: reqEvents, calls: [], briefs: [], window });
    assert.deepEqual(t3.changeRequests, { count: 5, declined: 1, medianScreens: 2 });
    assert.deepEqual(t.changeRequests, { count: 0, declined: 0, medianScreens: null });
  });
});
