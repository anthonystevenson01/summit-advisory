/**
 * The requirements engine: rows per source and category in the prototype's
 * order, counts, essentials, completeness, reason sentences and the
 * replacement build. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank, type BriefState } from "../app/lib/project-builder/brief.ts";
import { FEATURES, HANDOVER_REQUIREMENTS } from "../app/lib/project-builder/catalogue.ts";
import {
  buildReplacementRequirements,
  buildRequirements,
  completeness,
  countByPriority,
  essentials,
  projectName,
  reasonSentence,
  requirementKey,
  requirementsForNotion,
} from "../app/lib/project-builder/requirements.ts";

function full(): BriefState {
  const s = blank();
  s.features = { accounts: "Must" };
  s.featSrc = { accounts: "you" };
  s.custom = [
    { text: "Managers approve orders over 5,000", pri: "Should", cat: "Feature", src: "doc", built: true },
    { text: "Stock levels sync nightly", pri: "Could", cat: "Running it", src: "system", built: false },
  ];
  s.ideas = [{ id: "i1", title: "Draft replies", what: "Draft replies for a person to send.", buildsOn: "Messaging", kind: "Summarise or draft", size: "Quick win", helps: "", human: true }];
  s.ideaPick = { i1: "Should" };
  s.integrations = ["Payment provider", "Spreadsheets"];
  s.intSrc = { "Payment provider": "suggested" };
  s.intOther = "A, B";
  s.sso = true;
  s.perms = true;
  s.audit = true;
  s.personal = true;
  s.compliance = ["GDPR"];
  s.handover = ["docs", "support"];
  return s;
}

describe("buildRequirements", () => {
  test("is empty on a blank state", () => {
    assert.deepEqual(buildRequirements(blank()), []);
  });

  test("produces every row kind with the prototype's priorities, sources and order", () => {
    const rows = buildRequirements(full());
    const accounts = FEATURES.find((f) => f.key === "accounts")!;
    assert.deepEqual(rows.map((r) => r.cat), [
      "Feature", "Feature", "Running it", "AI idea", "Integration", "Integration", "Integration", "Integration",
      "Guardrail", "Guardrail", "Guardrail", "Guardrail", "Guardrail", "Running it", "Running it",
    ]);
    assert.deepEqual(rows[0], { text: accounts.requirement, cat: "Feature", pri: "Must", src: "you", built: false, ref: { kind: "feature", key: "accounts" } });
    assert.equal(rows[1].src, "doc");
    assert.equal(rows[1].built, true);
    assert.deepEqual(rows[1].ref, { kind: "custom", index: 0 });
    assert.equal(rows[2].src, "system");
    assert.deepEqual(rows[3], { text: "Draft replies for a person to send.", cat: "AI idea", pri: "Should", src: "ai", built: false, ref: { kind: "idea", id: "i1" } });
    assert.deepEqual(rows[4], { text: "Connects to Payment provider.", cat: "Integration", pri: "Must", src: "suggested", built: false, ref: { kind: "integration", label: "Payment provider" } });
    assert.equal(rows[5].src, "you");
    assert.deepEqual(rows[6], { text: "Connects to A.", cat: "Integration", pri: "Must", src: "you", built: false, ref: { kind: "step", step: 2 } });
    assert.equal(rows[7].text, "Connects to B.");
    assert.deepEqual(rows.slice(8, 13).map((r) => [r.text, r.pri]), [
      ["People sign in with single sign-on.", "Must"],
      ["Access is controlled by role.", "Must"],
      ["Important changes are logged with who and when.", "Should"],
      ["Personal data is protected and can be deleted on request.", "Must"],
      ["Meets GDPR.", "Must"],
    ]);
    assert.deepEqual(rows[8].ref, { kind: "step", step: 3 });
    assert.deepEqual(rows.slice(13).map((r) => [r.text, r.pri, r.src]), [
      [HANDOVER_REQUIREMENTS.docs, "Should", "you"],
      [HANDOVER_REQUIREMENTS.support, "Should", "you"],
    ]);
  });

  test("countByPriority counts the set", () => {
    assert.deepEqual(countByPriority(buildRequirements(full())), { Must: 9, Should: 5, Could: 1 });
  });

  test("requirementKey and requirementsForNotion", () => {
    const rows = buildRequirements(full());
    assert.equal(requirementKey(rows[0]), `Feature|${rows[0].text}`);
    const notion = requirementsForNotion(full());
    assert.equal(notion.length, rows.length);
    assert.equal(notion[0].id, "REQ-001");
    assert.equal(notion[14].id, "REQ-015");
    assert.deepEqual(notion.map((r) => r.pri), [...Array(9).fill("Must"), ...Array(5).fill("Should"), "Could"]);
    assert.equal(notion[0].source, "Added by you");
    assert.ok(notion.some((r) => r.source === "From your document" && r.built));
  });
});

describe("essentials and completeness", () => {
  test("six unmet on blank, six met once answered, with the step indices", () => {
    const e0 = essentials(blank());
    assert.equal(e0.length, 6);
    assert.ok(e0.every((e) => !e.met));
    assert.deepEqual(e0.map((e) => e.step), [1, 1, 1, 1, 2, 3]);
    const s = blank();
    s.problem = "Orders are keyed twice.";
    s.success = "Half the time within six months";
    s.signoff = "Me";
    s.roles = ["Staff"];
    s.features = { accounts: "Must" };
    s.run = "team";
    assert.ok(essentials(s).every((e) => e.met));
  });

  test("completeness at the boundaries and rounding", () => {
    assert.equal(completeness(blank()), 0);
    const s = blank();
    s.problem = "p";
    s.success = "s";
    s.signoff = "me";
    s.roles = ["Staff"];
    s.features = { accounts: "Must" };
    s.run = "team";
    assert.equal(completeness(s), 60);
    s.path = "idea";
    assert.equal(completeness(s), 70);
    s.audience = "ops";
    s.scale = "50 to 500 people";
    s.ideas = [{ id: "i1", title: "T", what: "W", buildsOn: "", kind: "Predict", size: "Moderate", helps: "", human: false }];
    s.ideaPick = { i1: "Could" };
    assert.equal(completeness(s), 100);
    s.ideaPick = { i1: "no" };
    assert.equal(completeness(s), 90);
  });

  test("projectName falls back to the idea's first 60 characters, then Untitled project", () => {
    const s = blank();
    assert.equal(projectName(s), "Untitled project");
    s.idea = "x".repeat(80);
    assert.equal(projectName(s), "x".repeat(60));
    s.name = "  Portal ";
    assert.equal(projectName(s), "Portal");
  });
});

describe("reasonSentence", () => {
  test("substitutes the system name wherever SYS appears", () => {
    assert.ok(reasonSentence("Too expensive", "Xero").includes("Xero licences"));
    assert.equal(reasonSentence("We want to own it", "Xero"), "We own the code and the data.");
    assert.equal(reasonSentence("Contract ending", "Sage"), "Live before our Sage contract ends.");
    assert.equal("Costs less to run than our current SYS licences and SYS support.".replace(/SYS/g, "Xero").match(/Xero/g)?.length, 2);
    assert.equal(reasonSentence("Unknown", "Xero"), "");
  });
});

describe("buildReplacementRequirements", () => {
  function salesforce(): BriefState {
    const s = blank();
    s.path = "replace";
    s.rep = { cat: "CRM and sales", sys: "Salesforce", other: "", caps: { contacts: "Must", pipeline: "Should", reports: "Could" }, extra: {}, reasons: ["Too slow", "Too expensive"], migrate: true, parallel: true };
    s.custom = [{ text: "Old row", pri: "Must", cat: "Feature", src: "system", built: false }, { text: "Mine", pri: "Must", cat: "Feature", src: "you", built: false }];
    return s;
  }

  test("adds one row per capability and reason, the switch over rows, names, roles and the note", () => {
    const { state, note } = buildReplacementRequirements(salesforce());
    const system = state.custom.filter((c) => c.src === "system");
    assert.ok(!state.custom.some((c) => c.text === "Old row"), "previous system rows are removed");
    assert.ok(state.custom.some((c) => c.text === "Mine"), "the prospect's rows stay");
    assert.deepEqual(system.map((c) => [c.pri, c.cat]), [
      ["Must", "Feature"], ["Should", "Feature"], ["Could", "Feature"],
      ["Should", "Feature"], ["Must", "Feature"],
      ["Must", "Running it"], ["Should", "Running it"],
    ]);
    assert.ok(system[3].text.startsWith("Everyday screens load"));
    assert.ok(system[4].text.includes("Salesforce licences"));
    assert.ok(system[5].text.startsWith("Existing data from Salesforce"));
    assert.ok(system[6].text.startsWith("Salesforce and the new tool"));
    assert.equal(state.name, "Salesforce replacement");
    assert.equal(state.idea, "Replace Salesforce with something built around how we work");
    assert.equal(state.problem, "We use Salesforce today for contacts and companies, deals and pipeline and reports and dashboards. We want to move because: too slow and too expensive.");
    assert.deepEqual(state.roles, ["Staff", "Managers", "Admins"]);
    assert.equal(note, "Built 7 requirements from your Salesforce setup. They're under Features, and the problem and users are drafted for you. Next, check the outcome.");
  });

  test("keeps a filled name, idea and problem and never duplicates roles", () => {
    const s = salesforce();
    s.name = "Ours";
    s.idea = "Our idea";
    s.problem = "Our problem";
    s.roles = ["Admins", "Customers"];
    const { state } = buildReplacementRequirements(s);
    assert.equal(state.name, "Ours");
    assert.equal(state.idea, "Our idea");
    assert.equal(state.problem, "Our problem");
    assert.deepEqual(state.roles, ["Admins", "Customers", "Staff", "Managers"]);
    assert.notEqual(state, s, "a new state is returned");
    assert.equal(s.custom.length, 2, "the argument is not mutated");
  });

  test("returns the unchanged state and the prompt note when nothing is picked", () => {
    const s = salesforce();
    s.rep.caps = {};
    const { state, note } = buildReplacementRequirements(s);
    assert.equal(state, s);
    assert.equal(note, 'Pick at least one part of Salesforce you use, or tap "Select what most teams use".');
  });
});
