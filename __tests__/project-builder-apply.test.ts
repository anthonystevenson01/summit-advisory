/**
 * Applying a model result: fill a blank field, add a missing item, never
 * overwrite a filled one, never switch a flag off, respect the caps, and
 * never mutate the argument. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank, type BriefState } from "../app/lib/project-builder/brief.ts";
import { applyIdeas, applyLookup, applyRead, applySuggest } from "../app/lib/project-builder/apply.ts";
import type { ReadResult } from "../app/lib/project-builder/schemas.ts";

function snapshot(s: BriefState): string {
  return JSON.stringify(s);
}

function readResult(overrides: Partial<ReadResult> = {}): ReadResult {
  return {
    name: "Reader name",
    problem: "Reader problem",
    audience: "Reader audience",
    success: "Reader success",
    signoff: "Reader signoff",
    roles: ["Staff", "Field teams"],
    features: [{ key: "accounts", priority: "Must" }, { key: "portal", priority: "Must" }],
    requirements: [
      { text: "Req one", priority: "Must", alreadyBuilt: true },
      { text: "Req two", priority: "Could", alreadyBuilt: false },
    ],
    integrations: ["Spreadsheets"],
    guardrails: { sso: false, perms: true, audit: false, personal: false, compliance: ["GDPR"] },
    unplaced: ["a line"],
    ...overrides,
  };
}

describe("applyRead", () => {
  test("fills blanks, keeps filled fields and prospect rows, replaces doc rows, never switches off, no duplicates", () => {
    const s = blank();
    s.name = "Mine";
    s.problem = "My problem";
    s.custom = [
      { text: "Old doc row", pri: "Should", cat: "Feature", src: "doc", built: false },
      { text: "My row", pri: "Must", cat: "Feature", src: "you", built: false },
    ];
    s.roles = ["Staff"];
    s.features = { accounts: "Could" };
    s.featSrc = { accounts: "you" };
    s.sso = true;
    s.compliance = ["GDPR"];
    s.unplaced = ["old line"];
    const before = snapshot(s);
    const { state, message } = applyRead(s, readResult(), true);
    assert.equal(snapshot(s), before, "argument not mutated");
    assert.equal(state.name, "Mine");
    assert.equal(state.problem, "My problem");
    assert.equal(state.audience, "Reader audience");
    assert.equal(state.success, "Reader success");
    assert.equal(state.signoff, "Reader signoff");
    assert.ok(!state.custom.some((c) => c.text === "Old doc row"), "previous doc rows replaced");
    assert.ok(state.custom.some((c) => c.text === "My row" && c.src === "you"), "prospect row kept");
    const doc = state.custom.filter((c) => c.src === "doc");
    assert.deepEqual(doc.map((c) => [c.text, c.pri, c.built]), [["Req one", "Must", true], ["Req two", "Could", false]]);
    assert.equal(state.features.accounts, "Could");
    assert.equal(state.featSrc.accounts, "you");
    assert.equal(state.features.portal, "Must");
    assert.equal(state.featSrc.portal, "doc");
    assert.deepEqual(state.roles, ["Staff", "Field teams"]);
    assert.equal(state.sso, true, "a flag the result says is false stays on");
    assert.equal(state.perms, true);
    assert.deepEqual(state.compliance, ["GDPR"], "added once");
    assert.deepEqual(state.integrations, ["Spreadsheets"]);
    assert.equal(state.intSrc.Spreadsheets, "doc");
    assert.deepEqual(state.unplaced, ["a line"]);
    assert.equal(message, "Found 2 requirements. They're under Features, marked as from your document. Check each one.");
  });

  test("alreadyBuilt is honoured only on the built path", () => {
    const { state } = applyRead(blank(), readResult(), false);
    assert.ok(state.custom.every((c) => c.built === false));
  });
});

describe("applySuggest", () => {
  test("goal leaves a filled problem, fills a blank audience, caps new roles at seven", () => {
    const s = blank();
    s.problem = "Mine";
    s.roles = ["Staff"];
    const before = snapshot(s);
    const roles = ["Staff", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9"];
    const { state } = applySuggest(s, { step: "goal", problem: "Theirs", audience: "Ops", success: "", roles });
    assert.equal(snapshot(s), before);
    assert.equal(state.problem, "Mine");
    assert.equal(state.audience, "Ops");
    assert.equal(state.success, "");
    assert.equal(state.roles.length, 8, "one existing plus seven new");
    assert.equal(state.roles.filter((r) => r === "Staff").length, 1);
  });

  test("features never changes a set feature, skips a duplicate row, caps at seven features and three rows", () => {
    const s = blank();
    s.features = { accounts: "Could" };
    s.featSrc = { accounts: "you" };
    s.custom = [{ text: "Same text", pri: "Must", cat: "Feature", src: "you", built: false }];
    const before = snapshot(s);
    const keys = ["accounts", "dashboard", "forms", "workflow", "notify", "search", "content", "files", "payments", "booking"] as const;
    const { state } = applySuggest(s, {
      step: "features",
      features: keys.map((key) => ({ key, priority: "Must" as const })),
      requirements: [
        { text: "Same text", priority: "Should" },
        { text: "A", priority: "Should" },
        { text: "B", priority: "Should" },
        { text: "C", priority: "Should" },
        { text: "D", priority: "Should" },
      ],
    });
    assert.equal(snapshot(s), before);
    assert.equal(state.features.accounts, "Could");
    assert.equal(state.featSrc.accounts, "you");
    assert.equal(Object.keys(state.features).length, 8, "one kept plus seven added");
    assert.ok(Object.entries(state.featSrc).filter(([k]) => k !== "accounts").every(([, v]) => v === "suggested"));
    assert.equal(state.custom.filter((c) => c.text === "Same text").length, 1);
    assert.equal(state.custom.length, 4, "one kept plus three added");
  });

  test("connections ignores an unknown label and adds at most two new other systems", () => {
    const s = blank();
    s.integrations = ["Spreadsheets"];
    s.intOther = "Our warehouse system";
    const before = snapshot(s);
    const { state } = applySuggest(s, { step: "connections", integrations: ["Spreadsheets", "Nope", "Payment provider"], other: ["Our warehouse system", "Shopify", "Odoo", "Sage"] });
    assert.equal(snapshot(s), before);
    assert.deepEqual(state.integrations, ["Spreadsheets", "Payment provider"]);
    assert.equal(state.intSrc["Payment provider"], "suggested");
    assert.equal(state.intSrc.Spreadsheets, undefined, "an existing label keeps its source");
    assert.equal(state.intOther, "Our warehouse system, Shopify, Odoo");
  });

  test("guardrails never switches a flag off and sets residency, scale and uptime only when blank", () => {
    const s = blank();
    s.sso = true;
    s.residency = "the UK";
    s.scale = "50 to 500 people";
    const before = snapshot(s);
    const r = { step: "guardrails" as const, sso: false, perms: true, audit: false, personal: false, compliance: ["GDPR", "GDPR"], residency: "the US", scale: "More than 5,000 people", uptime: "Around the clock", why: "w" };
    const { state } = applySuggest(s, r);
    assert.equal(snapshot(s), before);
    assert.equal(state.sso, true);
    assert.equal(state.perms, true);
    assert.equal(state.residency, "the UK");
    assert.equal(state.scale, "50 to 500 people");
    assert.equal(state.uptime, "Around the clock");
    assert.deepEqual(state.compliance, ["GDPR"]);
    const fresh = applySuggest(blank(), r).state;
    assert.equal(fresh.residency, "the US");
    assert.equal(fresh.scale, "More than 5,000 people");
  });

  test("running sets run only when blank, adds handover without duplicates, skills only when blank and run is team or mix", () => {
    const s = blank();
    s.run = "summit";
    s.handover = ["docs"];
    const before = snapshot(s);
    const r = { step: "running" as const, run: "team" as const, handover: ["docs", "train"] as ("docs" | "train")[], skills: "Python", why: "" };
    const { state } = applySuggest(s, r);
    assert.equal(snapshot(s), before);
    assert.equal(state.run, "summit");
    assert.deepEqual(state.handover, ["docs", "train"]);
    assert.equal(state.skills, "", "run is summit so skills stay blank");
    const fresh = applySuggest(blank(), r).state;
    assert.equal(fresh.run, "team");
    assert.equal(fresh.skills, "Python");
    const kept = blank();
    kept.skills = "Go";
    assert.equal(applySuggest(kept, r).state.skills, "Go");
  });
});

describe("applyIdeas", () => {
  test("keeps picked ideas, drops unpicked, skips a fresh title already kept, assigns ids from ideaSeq, sets ideasKey", () => {
    const s = blank();
    s.ideas = [
      { id: "i1", title: "Kept idea", what: "w", buildsOn: "", kind: "Predict", size: "Moderate", helps: "", human: false },
      { id: "i2", title: "Dropped idea", what: "w", buildsOn: "", kind: "Predict", size: "Moderate", helps: "", human: false },
      { id: "i3", title: "Passed idea", what: "w", buildsOn: "", kind: "Predict", size: "Moderate", helps: "", human: false },
    ];
    s.ideaPick = { i1: "Should", i3: "no" };
    s.ideaSeq = 3;
    const before = snapshot(s);
    const { state, message } = applyIdeas(s, {
      note: "n",
      ideas: [
        { title: "KEPT IDEA", what: "dup", buildsOn: "", kind: "Predict", size: "Quick win", helps: "", human: false },
        { title: "New one", what: "w", buildsOn: "", kind: "Spot problems", size: "Bigger build", helps: "h", human: true },
      ],
    });
    assert.equal(snapshot(s), before);
    assert.deepEqual(state.ideas.map((i) => [i.id, i.title]), [["i1", "Kept idea"], ["i4", "New one"]]);
    assert.deepEqual(state.ideaPick, { i1: "Should" });
    assert.equal(state.ideaSeq, 4);
    assert.ok(state.ideasKey.length > 0);
    assert.equal(message, "n");
  });
});

describe("applyLookup", () => {
  test("sets rep.extra keyed x0 to x8, the name, clears caps, and the general set message when empty", () => {
    const s = blank();
    s.rep.caps = { contacts: "Must" };
    s.rep.cat = "CRM and sales";
    const before = snapshot(s);
    const caps = Array.from({ length: 12 }, (_, i) => ({ title: `T${i}`, requirement: `R${i}` }));
    const { state, message } = applyLookup(s, "Odoo", { caps });
    assert.equal(snapshot(s), before);
    assert.deepEqual(Object.keys(state.rep.extra), ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8"]);
    assert.deepEqual(state.rep.extra.x0, { title: "T0", requirement: "R0" });
    assert.equal(state.rep.sys, "Odoo");
    assert.equal(state.rep.other, "Odoo");
    assert.equal(state.rep.cat, "");
    assert.deepEqual(state.rep.caps, {});
    assert.equal(message, "Here's what teams usually use Odoo for. Pick the parts you rely on.");
    const empty = applyLookup(blank(), "Odoo", { caps: [] });
    assert.deepEqual(empty.state.rep.extra, {});
    assert.equal(empty.message, "Here's a general set to choose from.");
  });
});
