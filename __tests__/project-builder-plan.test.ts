/**
 * The screen plan: the coverage items (ids matching requirementsForNotion
 * plus one per role), the parse and cap of a plan answer, the coverage check
 * (a missing Must or role is caught, a complete plan passes, a Should does
 * not gate, a Running it row does not gate), the plan diff and the rebuild
 * rule. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank, type BriefState } from "../app/lib/project-builder/brief.ts";
import { requirementsForNotion } from "../app/lib/project-builder/requirements.ts";
import {
  applyPlanDiff,
  checkPlanCoverage,
  coverageItems,
  diffOutcome,
  gatingItems,
  parsePlanAnswer,
  parsePlanDiffAnswer,
  screensToRebuild,
  screenItemLines,
  type PrototypePlan,
} from "../app/lib/project-builder/plan.ts";
import { PROTOTYPE_SCREENS_MAX } from "../app/lib/project-builder/prototype.ts";
import { SchemaError } from "../app/lib/tools/schema.ts";

function sample(): BriefState {
  const s = blank();
  s.name = "Garage CRM";
  s.idea = "A CRM for our garages";
  s.roles = ["Staff", "Managers", "Site managers"];
  s.features = { accounts: "Must", dashboard: "Should" };
  s.custom = [{ text: "Managers approve refunds over 500", pri: "Must", cat: "Feature", src: "you", built: false }];
  s.integrations = ["Spreadsheets"];
  s.handover = ["docs"];
  s.sso = true;
  return s;
}

const META = { version: 1, builtFrom: "p1-abc", model: "m", builtAt: "2026-11-08T10:00:00.000Z" };

function screen(slug: string, kind: "table" | "figures" | "form" | "detail" | "list" | "chart" = "table") {
  return { slug, title: slug[0].toUpperCase() + slug.slice(1), purpose: "p", role: "Staff", components: [{ kind, title: `${slug} main`, entity: "job", note: "" }], entities: ["job"] };
}

describe("coverageItems", () => {
  test("one REQ item per requirement row with the Notion id, then one ROLE item per role", () => {
    const s = sample();
    const items = coverageItems(s);
    const rows = requirementsForNotion(s);
    const reqs = items.filter((i) => i.kind === "requirement");
    assert.deepEqual(reqs.map((i) => i.id), rows.map((r) => r.id));
    assert.deepEqual(reqs.map((i) => i.label), rows.map((r) => r.text));
    assert.deepEqual(reqs.map((i) => i.pri), rows.map((r) => r.pri));
    assert.ok(reqs.some((i) => i.key === "accounts"));
    assert.ok(reqs.some((i) => i.key === "Spreadsheets"));
    assert.deepEqual(items.filter((i) => i.kind === "role").map((i) => i.id), ["ROLE-staff", "ROLE-managers", "ROLE-site-managers"]);
  });

  test("the gate is every role plus every Must feature, idea, integration and guardrail; Running it and Should rows are out", () => {
    const s = sample();
    const items = coverageItems(s);
    const gate = gatingItems(items);
    assert.ok(gate.every((i) => i.kind === "role" || i.pri === "Must"));
    assert.ok(!gate.some((i) => i.cat === "Running it"));
    assert.ok(gate.some((i) => i.cat === "Guardrail"));
    assert.ok(gate.some((i) => i.cat === "Integration"));
    assert.ok(!gate.some((i) => i.key === "dashboard"));
  });
});

describe("parsePlanAnswer", () => {
  const items = coverageItems(sample());

  test("keeps 3 to 5 screens, dedupes slugs, drops unknown ids and screens, moves a table screen to the front", () => {
    const raw = {
      screens: [
        { ...screen("settings", "form"), slug: "Settings!" },
        screen("jobs"),
        { ...screen("jobs"), title: "Jobs again" },
        screen("reports", "chart"),
        screen("people", "list"),
        screen("extra", "detail"),
        screen("more", "detail"),
      ],
      coverage: [
        { id: items[0].id, screen: "jobs", component: "jobs main" },
        { id: "REQ-999", screen: "jobs", component: "" },
        { id: items[0].id, screen: "nowhere", component: "" },
        { id: items[0].id, screen: "jobs", component: "dupe" },
      ],
      unplaced: [{ id: "ROLE-staff", reason: "no screen" }, { id: "REQ-999", reason: "x" }],
    };
    const plan = parsePlanAnswer(raw, items, META);
    assert.equal(plan.screens.length, PROTOTYPE_SCREENS_MAX);
    assert.equal(plan.screens[0].slug, "jobs");
    assert.deepEqual(plan.screens.map((s) => s.slug), ["jobs", "settings", "jobs-2", "reports", "people"]);
    assert.deepEqual(plan.coverage, [{ id: items[0].id, screen: "jobs", component: "jobs main" }]);
    assert.deepEqual(plan.unplaced, [{ id: "ROLE-staff", reason: "no screen" }]);
    assert.equal(plan.version, 1);
    assert.equal(plan.builtFrom, "p1-abc");
    assert.deepEqual(plan.accepted, []);
  });

  test("fewer than three usable screens, a missing screens array or a non object throws", () => {
    assert.throws(() => parsePlanAnswer({ screens: [screen("a"), screen("b")], coverage: [], unplaced: [] }, items, META), SchemaError);
    assert.throws(() => parsePlanAnswer({ coverage: [] }, items, META), SchemaError);
    assert.throws(() => parsePlanAnswer("x", items, META), SchemaError);
  });

  test("components keep the six kinds only, at most eight, and entities at most eight", () => {
    const comps = [...Array.from({ length: 10 }, (_, i) => ({ kind: "table", title: `T${i}`, entity: "e", note: "n" })), { kind: "widget", title: "no", entity: "", note: "" }];
    const plan = parsePlanAnswer({ screens: [{ ...screen("a"), components: comps, entities: Array.from({ length: 12 }, (_, i) => `E${i}`) }, screen("b"), screen("c")], coverage: [], unplaced: [] }, items, META);
    assert.equal(plan.screens[0].components.length, 8);
    assert.equal(plan.screens[0].entities.length, 8);
  });
});

describe("checkPlanCoverage", () => {
  const s = sample();
  const items = coverageItems(s);
  const base = (): PrototypePlan => parsePlanAnswer({ screens: [screen("dashboard", "figures"), screen("jobs"), screen("settings", "form")], coverage: [], unplaced: [] }, items, META);
  const full = (): PrototypePlan => ({ ...base(), coverage: gatingItems(items).map((i) => ({ id: i.id, screen: "jobs", component: "jobs main" })) });

  test("a complete plan passes", () => {
    const check = checkPlanCoverage(full(), items);
    assert.equal(check.ok, true);
    assert.deepEqual(check.gaps, []);
  });

  test("a missing Must feature is caught with a line naming it; a missing role too", () => {
    const must = items.find((i) => i.label === "Managers approve refunds over 500")!;
    const plan = full();
    plan.coverage = plan.coverage.filter((c) => c.id !== must.id && c.id !== "ROLE-managers");
    const check = checkPlanCoverage(plan, items);
    assert.equal(check.ok, false);
    assert.equal(check.gaps.length, 2);
    assert.ok(check.gaps.some((g) => g.startsWith(`${must.id} (Must): Managers approve refunds over 500 is not placed`)));
    assert.ok(check.gaps.some((g) => g === "ROLE-managers (role): Managers has no screen"));
  });

  test("an unmapped Should does not gate but lands in unplaced; a Must Running it row does not gate", () => {
    const withRunning = sample();
    withRunning.custom.push({ text: "Existing data is moved across", pri: "Must", cat: "Running it", src: "you", built: false });
    const items2 = coverageItems(withRunning);
    const plan = parsePlanAnswer({ screens: [screen("dashboard", "figures"), screen("jobs"), screen("settings", "form")], coverage: gatingItems(items2).map((i) => ({ id: i.id, screen: "jobs", component: "" })), unplaced: [] }, items2, META);
    const check = checkPlanCoverage(plan, items2);
    assert.equal(check.ok, true);
    const should = items2.find((i) => i.key === "dashboard")!;
    assert.ok(check.plan.unplaced.some((u) => u.id === should.id && u.reason === "not placed"));
    const running = items2.find((i) => i.cat === "Running it" && i.pri === "Must")!;
    assert.ok(!check.gaps.some((g) => g.includes(running.id)));
  });
});

describe("applyPlanDiff and screensToRebuild", () => {
  const items = coverageItems(sample());
  const current: PrototypePlan = {
    ...parsePlanAnswer({ screens: [screen("dashboard", "figures"), screen("jobs"), screen("people", "list"), screen("reports", "chart"), screen("settings", "form")], coverage: [], unplaced: [] }, items, META),
    accepted: [{ requestId: "r1", text: "earlier request", at: "2026-11-08T09:00:00.000Z" }],
    reviewApplied: ["Approvals view"],
    reviewSuggested: ["Bigger thing"],
  };

  test("carries accepted forward with the new request, bumps the version, keeps the review lists and lists the changed slugs", () => {
    const answer = parsePlanDiffAnswer({ screens: current.screens, coverage: [], unplaced: [], changedScreens: ["jobs", "nowhere"], outOfRemit: { refused: false, reason: "" } }, items);
    const diff = applyPlanDiff(current, answer, { builtFrom: "p1-def", model: "m2" }, { requestId: "r2", text: "new request", at: "2026-11-08T10:00:00.000Z" });
    assert.equal(diff.plan.version, 2);
    assert.equal(diff.plan.builtFrom, "p1-def");
    assert.deepEqual(diff.plan.accepted.map((a) => a.text), ["earlier request", "new request"]);
    assert.deepEqual(diff.plan.reviewApplied, ["Approvals view"]);
    assert.deepEqual(diff.changed, ["jobs"]);
    assert.equal(diff.outOfRemit.refused, false);
  });

  test("a refused diff keeps the current plan and changes nothing; added and removed slugs count as changed", () => {
    const refused = parsePlanDiffAnswer({ screens: [], coverage: [], unplaced: [], changedScreens: [], outOfRemit: { refused: true, reason: "It would send email." } }, items);
    const kept = applyPlanDiff(current, refused, { builtFrom: "x", model: "m" });
    assert.equal(kept.plan, current);
    assert.deepEqual(kept.changed, []);
    assert.equal(kept.outOfRemit.reason, "It would send email.");
    const moved = parsePlanDiffAnswer({ screens: [screen("dashboard", "figures"), screen("jobs"), screen("people", "list"), screen("reports", "chart"), screen("audit", "list")], coverage: [], unplaced: [], changedScreens: [], outOfRemit: { refused: false, reason: "" } }, items);
    const diff = applyPlanDiff(current, moved, { builtFrom: "x", model: "m" });
    assert.deepEqual(diff.changed.sort(), ["audit", "settings"]);
  });

  test("one screen gives that screen; three of five, the first screen, or an added screen gives all", () => {
    assert.deepEqual(screensToRebuild(current, ["jobs"], current), { slugs: ["jobs"], whole: false });
    assert.deepEqual(screensToRebuild(current, ["jobs", "people"], current), { slugs: ["jobs", "people"], whole: false });
    assert.equal(screensToRebuild(current, ["jobs", "people", "reports"], current).whole, true);
    assert.equal(screensToRebuild(current, ["dashboard"], current).whole, true);
    const added = { ...current, screens: [...current.screens.slice(0, 4), screen("audit", "list")] };
    assert.equal(screensToRebuild(added, ["audit"], current).whole, true);
    assert.deepEqual(screensToRebuild(added, ["audit"], current).slugs, added.screens.map((s) => s.slug));
    assert.deepEqual(screensToRebuild(current, [], current), { slugs: [], whole: false });
  });

  test("diffOutcome: refused is declined, accepted with no changed screen is unchanged, else changed", () => {
    const sameScreens = parsePlanDiffAnswer({ screens: current.screens, coverage: [], unplaced: [], changedScreens: [], outOfRemit: { refused: false, reason: "" } }, items);
    assert.equal(diffOutcome(applyPlanDiff(current, sameScreens, { builtFrom: "x", model: "m" })), "unchanged");
    const refused = parsePlanDiffAnswer({ screens: [], coverage: [], unplaced: [], changedScreens: [], outOfRemit: { refused: true, reason: "no" } }, items);
    assert.equal(diffOutcome(applyPlanDiff(current, refused, { builtFrom: "x", model: "m" })), "declined");
    const one = parsePlanDiffAnswer({ screens: current.screens, coverage: [], unplaced: [], changedScreens: ["jobs"], outOfRemit: { refused: false, reason: "" } }, items);
    assert.equal(diffOutcome(applyPlanDiff(current, one, { builtFrom: "x", model: "m" })), "changed");
  });

  test("screenItemLines names what the plan mapped to a screen", () => {
    const plan = { ...current, coverage: [{ id: items[0].id, screen: "jobs", component: "jobs main" }, { id: "ROLE-staff", screen: "jobs", component: "" }] };
    const lines = screenItemLines(plan, "jobs", items);
    assert.deepEqual(lines, [`${items[0].pri}: ${items[0].label} (on: jobs main)`, "User type: Staff"]);
    assert.deepEqual(screenItemLines(plan, "people", items), []);
  });
});
