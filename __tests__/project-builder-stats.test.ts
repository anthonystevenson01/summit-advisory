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

function call(key: string, cost: number | null, daysAgo = 2, ok = true): CallRow {
  return { ts: at(daysAgo), key, model: "m", runId: null, promptTokens: 100, completionTokens: 10, cost, ok };
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
});
