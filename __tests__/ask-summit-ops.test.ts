/**
 * Ask Summit operations maths: retention dates, the spend threshold, the
 * stage clock and the request model's hash reader. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ORPHAN_AGE_MS, deleteAtFor, isDue, isOrphanCandidate, requestIdFromPathname } from "../app/lib/ask-summit/retention.ts";
import { monthKey, monthSpend, parseThreshold, spendAlertDue } from "../app/lib/ask-summit/spend.ts";
import { PROCESS_BUDGET_MS, STAGES, STAGE_PLAN, StageTimedOutError, createStageClock } from "../app/lib/ask-summit/stage-clock.ts";
import { STALE_PROCESSING_MS, confidenceSummary, isStaleProcessing, readAskRequestHash } from "../app/lib/ask-summit/request-model.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const ID = "ask_0123456789abcdef";

describe("retention", () => {
  test("deleteAtFor is exactly 30 days after createdAt; isDue flips at the instant", () => {
    const created = "2026-10-26T10:00:00.000Z";
    const deleteAt = deleteAtFor(created);
    assert.equal(Date.parse(deleteAt) - Date.parse(created), 30 * DAY_MS);
    assert.equal(isDue(deleteAt, Date.parse(deleteAt) - 1), false);
    assert.equal(isDue(deleteAt, Date.parse(deleteAt)), true);
    assert.equal(isDue("not a date", Date.now()), false);
  });

  test("requestIdFromPathname reads the folder; isOrphanCandidate is true at 48 hours", () => {
    assert.equal(requestIdFromPathname(`ask-summit/${ID}/deck-x9.pdf`), ID);
    assert.equal(requestIdFromPathname("other/x.pdf"), null);
    assert.equal(requestIdFromPathname(`ask-summit/${ID}`), null);
    const uploaded = "2026-10-26T10:00:00.000Z";
    assert.equal(isOrphanCandidate(uploaded, Date.parse(uploaded) + ORPHAN_AGE_MS), true);
    assert.equal(isOrphanCandidate(uploaded, Date.parse(uploaded) + ORPHAN_AGE_MS - 1), false);
  });
});

describe("spend", () => {
  const now = Date.parse("2026-10-26T12:00:00.000Z");

  test("monthKey is YYYY-MM in UTC", () => {
    assert.equal(monthKey(now), "2026-10");
    assert.equal(monthKey(Date.parse("2026-10-31T23:59:59.000Z")), "2026-10");
    assert.equal(monthKey(Date.parse("2026-11-01T00:00:00.000Z")), "2026-11");
  });

  test("monthSpend sums the month's costs and ignores null, malformed and earlier entries", () => {
    const entries = [
      { ts: "2026-10-01T00:00:00.000Z", cost: 0.5 },
      { ts: "2026-10-25T00:00:00.000Z", cost: 0.25 },
      { ts: "2026-10-25T00:00:00.000Z", cost: null },
      { ts: "garbage", cost: 9 },
      { ts: "2026-09-30T23:59:59.000Z", cost: 9 },
      "not an object",
      { cost: 9 },
    ];
    assert.equal(monthSpend(entries, now), 0.75);
  });

  test("spendAlertDue at the boundary", () => {
    assert.equal(spendAlertDue({ spend: 10, threshold: null, alerted: false }), false);
    assert.equal(spendAlertDue({ spend: 10, threshold: 0, alerted: false }), false);
    assert.equal(spendAlertDue({ spend: 24.99, threshold: 25, alerted: false }), false);
    assert.equal(spendAlertDue({ spend: 25, threshold: 25, alerted: false }), true);
    assert.equal(spendAlertDue({ spend: 30, threshold: 25, alerted: false }), true);
    assert.equal(spendAlertDue({ spend: 30, threshold: 25, alerted: true }), false);
  });

  test("parseThreshold accepts decimals, clears on blank, rejects the rest", () => {
    assert.equal(parseThreshold("25"), 25);
    assert.equal(parseThreshold("25.50"), 25.5);
    assert.equal(parseThreshold(40), 40);
    assert.equal(parseThreshold(""), null);
    assert.equal(parseThreshold(null), null);
    assert.equal(parseThreshold("-1"), undefined);
    assert.equal(parseThreshold("abc"), undefined);
  });
});

describe("stage clock", () => {
  test("the stage order and the budget", () => {
    assert.deepEqual([...STAGES], ["crawl", "documents", "extraction", "scoring", "report", "finish"]);
    assert.equal(PROCESS_BUDGET_MS, 290_000);
    for (const stage of STAGES) assert.ok(STAGE_PLAN[stage].capMs >= STAGE_PLAN[stage].minMs, stage);
  });

  test("the crawl gets its full cap at the start; a late extraction is refused by name", () => {
    const t0 = 1_000_000;
    const clock = createStageClock(t0);
    assert.equal(clock.allowance("crawl", t0), 100_000);
    assert.equal(clock.deadlineFor("crawl", t0), t0 + 100_000);
    assert.throws(
      () => clock.allowance("extraction", t0 + 200_000),
      (err: unknown) => err instanceof StageTimedOutError && err.stage === "extraction" && /extraction/.test(err.message),
    );
  });

  test("finish records a timing per stage and total is the elapsed sum", () => {
    const t0 = 1_000_000;
    const clock = createStageClock(t0);
    clock.start("crawl", t0);
    clock.finish("crawl", t0 + 15_000);
    clock.start("documents", t0 + 15_000);
    clock.finish("documents", t0 + 18_000);
    const timings = clock.timings(t0 + 18_000);
    assert.equal(timings.crawl, 15_000);
    assert.equal(timings.documents, 3_000);
    assert.equal(timings.extraction, 0);
    assert.equal(timings.total, 18_000);
  });
});

describe("request model", () => {
  const base = {
    id: ID,
    state: "done",
    url: "https://example.com/",
    host: "example.com",
    email: "ann@acme.io",
    emailHash: "ab".repeat(32),
    createdAt: "2026-10-26T10:00:00.000Z",
    deleteAt: "2026-11-25T10:00:00.000Z",
  };
  const files = [{ name: "deck.pdf", pathname: `ask-summit/${ID}/deck.pdf`, url: "https://blob/x", size: 10, contentType: "application/pdf", type: "pdf" }];

  test("reads files as a JSON string and as an array, booleans as strings and values, attempts as a string", () => {
    const fromStrings = readAskRequestHash({ ...base, files: JSON.stringify(files), dataDeleted: "true", attempts: "2", confidence: JSON.stringify({ pain: "high" }), previousRunIds: "null" });
    assert.ok(fromStrings);
    assert.equal(fromStrings.files.length, 1);
    assert.equal(fromStrings.files[0].type, "pdf");
    assert.equal(fromStrings.dataDeleted, true);
    assert.equal(fromStrings.attempts, 2);
    assert.deepEqual(fromStrings.confidence, { pain: "high" });
    assert.deepEqual(fromStrings.previousRunIds, []);
    const fromValues = readAskRequestHash({ ...base, files, dataDeleted: true, attempts: 3, runId: "null" });
    assert.ok(fromValues);
    assert.equal(fromValues.files.length, 1);
    assert.equal(fromValues.dataDeleted, true);
    assert.equal(fromValues.attempts, 3);
    assert.equal(fromValues.runId, null);
  });

  test("returns null without an id or an email or with an unknown state", () => {
    assert.equal(readAskRequestHash({ ...base, id: "" }), null);
    assert.equal(readAskRequestHash({ ...base, email: "" }), null);
    assert.equal(readAskRequestHash({ ...base, state: "lost" }), null);
    assert.equal(readAskRequestHash(null), null);
  });

  test("confidenceSummary and isStaleProcessing", () => {
    assert.equal(confidenceSummary({ confidence: { pain: "high", routeToBuyer: "high", unitOfValue: "medium", valueEvidence: "medium", abilityToProtect: "low" } }), "2 high, 2 medium, 1 low");
    assert.equal(confidenceSummary({ confidence: null }), "no draft yet");
    const started = "2026-10-26T10:00:00.000Z";
    assert.equal(isStaleProcessing({ state: "processing", processingStartedAt: started }, Date.parse(started) + STALE_PROCESSING_MS), true);
    assert.equal(isStaleProcessing({ state: "processing", processingStartedAt: started }, Date.parse(started) + STALE_PROCESSING_MS - 1), false);
    assert.equal(isStaleProcessing({ state: "queued", processingStartedAt: started }, Date.parse(started) + STALE_PROCESSING_MS), false);
  });
});
