/**
 * The senior review: the parse caps and demotes, the merge applies what it
 * may (a component on its screen, a new screen under the cap, a coverage
 * entry from a gap), a suggest item changes nothing, a turned down idea is
 * dropped and marked, and nothing the review says can add an integration or
 * a role. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank } from "../app/lib/project-builder/brief.ts";
import { coverageItems, parsePlanAnswer, type PrototypePlan } from "../app/lib/project-builder/plan.ts";
import { TURNED_DOWN_SUFFIX, mergeReviewIntoPlan, parseReviewAnswer, suggestionLines, type PlanReview } from "../app/lib/project-builder/review.ts";
import { PROTOTYPE_SCREENS_MAX } from "../app/lib/project-builder/prototype.ts";
import { SchemaError } from "../app/lib/tools/schema.ts";

const s = blank();
s.idea = "A CRM";
s.roles = ["Staff", "Managers"];
s.features = { accounts: "Must" };
s.integrations = ["Spreadsheets"];
const items = coverageItems(s);
const META = { version: 1, builtFrom: "p1-abc", model: "m" };

function screen(slug: string, kind: "table" | "figures" | "form" = "table") {
  return { slug, title: slug, purpose: "p", role: "Staff", components: [{ kind, title: `${slug} main`, entity: "e", note: "" }], entities: ["e"] };
}

function plan(count = 3): PrototypePlan {
  const slugs = ["dashboard", "jobs", "settings", "people", "reports"].slice(0, count);
  return parsePlanAnswer({ screens: slugs.map((slug, i) => screen(slug, i === 0 ? "figures" : "table")), coverage: [], unplaced: [] }, items, META);
}

const component = { kind: "table", title: "Approvals", entity: "refund", note: "Managers approve" };
const empty = { kind: "", title: "", entity: "", note: "" };
const noScreen = { slug: "", title: "", purpose: "", role: "", components: [], entities: [] };

describe("parseReviewAnswer", () => {
  test("caps gaps at eight and recommendations at five, requires basedOn, filters ids and slugs, demotes an apply with no valid screen", () => {
    const raw = {
      gaps: Array.from({ length: 10 }, (_, i) => ({ text: `gap ${i}`, itemId: i === 0 ? items[0].id : "REQ-999", screen: i === 0 ? "jobs" : "nowhere" })),
      recommendations: [
        { title: "Approvals", why: "w", basedOn: "Managers approve refunds", mode: "apply", screen: "jobs", component, newScreen: noScreen },
        { title: "No basis", why: "w", basedOn: "", mode: "apply", screen: "jobs", component, newScreen: noScreen },
        { title: "Nowhere", why: "w", basedOn: "x", mode: "apply", screen: "nowhere", component, newScreen: noScreen },
        { title: "New", why: "w", basedOn: "x", mode: "apply", screen: "", component: empty, newScreen: screen("audit") },
        { title: "Clash", why: "w", basedOn: "x", mode: "apply", screen: "", component: empty, newScreen: screen("jobs") },
        { title: "S1", why: "w", basedOn: "x", mode: "suggest", screen: "", component: empty, newScreen: noScreen },
        { title: "S2", why: "w", basedOn: "x", mode: "suggest", screen: "", component: empty, newScreen: noScreen },
      ],
    };
    const r = parseReviewAnswer(raw, plan(), items, { model: "m", builtAt: "t" });
    assert.equal(r.gaps.length, 8);
    assert.deepEqual(r.gaps[0], { text: "gap 0", itemId: items[0].id, screen: "jobs" });
    assert.deepEqual(r.gaps[1], { text: "gap 1", itemId: "", screen: "" });
    assert.equal(r.recommendations.length, 5);
    assert.deepEqual(r.recommendations.map((x) => x.title), ["Approvals", "Nowhere", "New", "Clash", "S1"]);
    assert.equal(r.recommendations[0].mode, "apply");
    assert.equal(r.recommendations[1].mode, "suggest");
    assert.equal(r.recommendations[2].newScreen?.slug, "audit");
    assert.notEqual(r.recommendations[3].newScreen?.slug, "jobs");
    assert.equal(r.model, "m");
    assert.throws(() => parseReviewAnswer(null, plan(), items, { model: "m" }), SchemaError);
  });
});

describe("mergeReviewIntoPlan", () => {
  const review = (recs: PlanReview["recommendations"], gaps: PlanReview["gaps"] = []): PlanReview => ({ builtAt: "t", model: "m", gaps, recommendations: recs });
  const apply = (title: string, extra: Partial<PlanReview["recommendations"][number]>): PlanReview["recommendations"][number] => ({ title, why: "w", basedOn: "the brief", mode: "apply", screen: "", component: null, newScreen: null, ...extra });

  test("an apply component lands on its screen; a suggest item changes nothing and is listed", () => {
    const before = plan();
    const r = review([apply("Approvals", { screen: "jobs", component: { kind: "table", title: "Approvals", entity: "refund", note: "" } }), { ...apply("Bigger", {}), mode: "suggest" }]);
    const { plan: after } = mergeReviewIntoPlan(before, r, []);
    assert.deepEqual(after.screens.find((x) => x.slug === "jobs")!.components.map((c) => c.title), ["jobs main", "Approvals"]);
    assert.deepEqual(after.reviewApplied, ["Approvals"]);
    assert.deepEqual(after.reviewSuggested, ["Bigger"]);
    assert.equal(before.screens.find((x) => x.slug === "jobs")!.components.length, 1);
    assert.equal(after.version, before.version);
  });

  test("an apply new screen is added under the cap and demoted to suggest over it", () => {
    const under = mergeReviewIntoPlan(plan(3), review([apply("Audit log", { newScreen: screen("audit") })]), []);
    assert.equal(under.plan.screens.length, 4);
    assert.deepEqual(under.plan.reviewApplied, ["Audit log"]);
    const over = mergeReviewIntoPlan(plan(PROTOTYPE_SCREENS_MAX), review([apply("Audit log", { newScreen: screen("audit") })]), []);
    assert.equal(over.plan.screens.length, PROTOTYPE_SCREENS_MAX);
    assert.deepEqual(over.plan.reviewSuggested, ["Audit log"]);
    assert.equal(over.review.recommendations[0].mode, "suggest");
  });

  test("a recommendation naming a turned down idea is dropped before merging and marked", () => {
    const r = review([apply("Draft replies with AI", { screen: "jobs", component: { kind: "form", title: "Draft replies", entity: "e", note: "" } }), apply("Approvals", { screen: "jobs", component: { kind: "table", title: "Approvals", entity: "e", note: "" } })]);
    const { plan: after, dropped } = mergeReviewIntoPlan(plan(), r, ["draft replies"]);
    assert.deepEqual(dropped, ["Draft replies with AI"]);
    assert.deepEqual(after.reviewApplied, ["Approvals"]);
    assert.deepEqual(after.reviewSuggested, [`Draft replies with AI${TURNED_DOWN_SUFFIX}`]);
    assert.ok(!after.screens.some((x) => x.components.some((c) => c.title === "Draft replies")));
  });

  test("a gap with an item and a screen adds a coverage entry; the item set is unchanged by any merge", () => {
    const r = review([apply("Approvals", { screen: "jobs", component: { kind: "table", title: "Approvals", entity: "e", note: "" } }), apply("New", { newScreen: screen("audit") })], [{ text: "Staff need a list", itemId: "ROLE-staff", screen: "jobs" }, { text: "general", itemId: "", screen: "" }]);
    const { plan: after } = mergeReviewIntoPlan(plan(), r, []);
    assert.deepEqual(after.coverage, [{ id: "ROLE-staff", screen: "jobs", component: "" }]);
    assert.deepEqual(coverageItems(s), items);
    assert.ok(after.coverage.every((c) => items.some((i) => i.id === c.id)));
  });

  test("suggestionLines gives the suggest only items as title: why", () => {
    const r = review([apply("Approvals", { screen: "jobs" }), { ...apply("Bigger", {}), mode: "suggest", why: "It matters." }, { ...apply("Plain", {}), mode: "suggest", why: "" }]);
    assert.deepEqual(suggestionLines(r), ["Bigger: It matters.", "Plain"]);
    assert.deepEqual(suggestionLines(null), []);
  });
});
