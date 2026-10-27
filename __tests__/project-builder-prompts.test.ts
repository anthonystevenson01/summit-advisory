/**
 * The context block carries every answer; the four prompt builders carry
 * the head, the data guard and the context; the schemas are strict at every
 * level; the parsers accept a valid reply and reject a malformed one.
 * Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank, type BriefState } from "../app/lib/project-builder/brief.ts";
import { HEAD, DATA_GUARD, MATERIAL_GUARD, contextBlock, ideasPrompt, lookupPrompt, readPrompt, suggestPrompt } from "../app/lib/project-builder/prompts.ts";
import { ideasSchema, lookupSchema, parseIdeas, parseLookup, parseRead, parseSuggest, readSchema, suggestSchema } from "../app/lib/project-builder/schemas.ts";
import { SUGGEST_STEPS } from "../app/lib/project-builder/brief.ts";
import { IDEA_KINDS, IDEA_SIZES } from "../app/lib/project-builder/catalogue.ts";
import { SchemaError } from "../app/lib/tools/schema.ts";

function everything(): BriefState {
  const s = blank();
  s.biz = { website: "acme.com", notes: "We sell widgets to garages." };
  s.path = "replace";
  s.rep = { cat: "CRM and sales", sys: "Salesforce", other: "", caps: { contacts: "Must", pipeline: "Should", reports: "Could" }, extra: {}, reasons: ["Too expensive", "Too slow"], migrate: true, parallel: true };
  s.name = "Garage CRM";
  s.idea = "Replace Salesforce with something ours";
  s.problem = "Sales reps key everything twice.";
  s.audience = "Our 12 reps";
  s.success = "Half the admin time within six months";
  s.signoff = "Our MD";
  s.timing = "Within 3 months";
  s.budget = "25k to 75k";
  s.roles = ["Staff", "Managers", "Admins"];
  s.features = { accounts: "Must", dashboard: "Should", notify: "Could" };
  s.custom = [
    { text: "Doc row", pri: "Must", cat: "Feature", src: "doc", built: true },
    { text: "System row", pri: "Should", cat: "Feature", src: "system", built: false },
  ];
  s.integrations = ["Finance or ERP", "Spreadsheets"];
  s.intOther = "Our warehouse system";
  s.ideas = [
    { id: "i1", title: "Weekly summary", what: "A note.", buildsOn: "Dashboards", kind: "Summarise or draft", size: "Quick win", helps: "", human: false },
    { id: "i2", title: "Draft replies", what: "Drafts.", buildsOn: "Messaging", kind: "Summarise or draft", size: "Quick win", helps: "", human: true },
    { id: "i3", title: "Predict churn", what: "Predicts.", buildsOn: "Pipeline", kind: "Predict", size: "Bigger build", helps: "", human: false },
  ];
  s.ideaPick = { i1: "Should", i2: "no" };
  s.sso = true;
  s.perms = true;
  s.audit = true;
  s.personal = true;
  s.compliance = ["GDPR", "SOC 2"];
  s.residency = "the UK";
  s.scale = "50 to 500 people";
  s.uptime = "Business hours";
  s.run = "mix";
  s.skills = "Python, AWS";
  s.handover = ["docs", "train"];
  return s;
}

const LABELS = [
  "Website: acme.com", "In their own words: We sell widgets", "Company name they gave: Acme Ltd", "Starting point: We're replacing a system", "Replacing: Salesforce",
  "Parts of Salesforce they use: Contacts and companies (Must)", "Why they are moving: Too expensive, Too slow", "Switch-over: bring existing data across, run both side by side for a while",
  "Project name: Garage CRM", "Idea: Replace Salesforce", "Their document or notes (excerpt): The pasted text", "Problem: Sales reps", "Who has it: Our 12 reps", "Success measure: Half the admin time",
  "Signs off the scope: Our MD", "Timing: Within 3 months", "Budget: 25k to 75k", "Users: Staff, Managers, Admins", "Features chosen: Accounts and sign-in (Must), Dashboards and reporting (Should), Notifications (Could)",
  "Their own requirements: Doc row (Must, already built, from their document); System row (Should, from their current system)", "Connections: Finance or ERP, Spreadsheets, Our warehouse system",
  "AI ideas they added: Weekly summary (Should)", "AI ideas they turned down (don't suggest these again): Draft replies", "Guardrails switched on: single sign-on, roles and permissions, audit trail, handles personal data",
  "Standards: GDPR, SOC 2", "Data must be stored in the UK", "Number of users: 50 to 500 people", "Needs to be up: Business hours", "Who runs it after launch: A mix", "Their team's skills: Python, AWS", "Handover should include: Documentation, Training for our team",
];

describe("contextBlock", () => {
  test("carries every answer under the prototype's labels, including the turned down ideas", () => {
    const block = contextBlock(everything(), { companyName: "Acme Ltd", source: "The pasted text" });
    for (const line of LABELS) assert.ok(block.includes(line), line);
    assert.ok(block.indexOf("turned down") < block.indexOf("Draft replies"));
  });

  test("caps the source excerpt at 6,000 characters and is empty on blank", () => {
    const block = contextBlock(blank(), { source: "x".repeat(7000) });
    const excerpt = block.split("(excerpt): ")[1].split("\n")[0];
    assert.equal(excerpt.length, 6000);
    assert.equal(contextBlock(blank()), "");
  });
});

describe("prompt builders", () => {
  const s = everything();
  const ctx = { companyName: "Acme Ltd", source: "Material here" };

  test("each system starts with HEAD or the consultant line and carries the data guard; each user carries the context", () => {
    for (const p of [lookupPrompt(s, "Odoo", ctx), ideasPrompt(s, ctx), ...SUGGEST_STEPS.map((step) => suggestPrompt(s, step, ctx))]) {
      assert.ok(p.system.startsWith(HEAD));
      assert.ok(p.system.includes(DATA_GUARD));
      assert.ok(p.user.includes("Project name: Garage CRM"));
    }
    const r = readPrompt(s, "Material here", ctx);
    assert.ok(r.system.includes(DATA_GUARD));
    assert.ok(r.system.includes(MATERIAL_GUARD));
    assert.ok(r.user.includes("Project name: Garage CRM"));
  });

  test("the read user turn fences the material and the alreadyBuilt instruction follows the path", () => {
    const doc = { ...everything(), path: "doc" as const };
    const built = { ...everything(), path: "built" as const };
    const rd = readPrompt(doc, "THE MATERIAL", ctx);
    assert.ok(rd.user.includes('"""\nTHE MATERIAL\n"""'));
    assert.ok(rd.system.includes("Set alreadyBuilt to false."));
    assert.ok(readPrompt(built, "x", ctx).system.includes("Mark requirements that already exist with alreadyBuilt true."));
    assert.notEqual(rd.system, readPrompt(built, "x", ctx).system);
  });

  test("the suggest system names each shape's keys; the ideas system lists kinds and sizes", () => {
    assert.ok(suggestPrompt(s, "goal").system.includes('"problem":"","audience":"","success":"","roles"'));
    assert.ok(suggestPrompt(s, "features").system.includes('"features":[{"key":"","priority":"Must"}],"requirements"'));
    assert.ok(suggestPrompt(s, "connections").system.includes('"integrations":[""],"other":[""]'));
    assert.ok(suggestPrompt(s, "guardrails").system.includes('"residency":"","scale":"","uptime":"","why"'));
    assert.ok(suggestPrompt(s, "running").system.includes('"run":"","handover":[""],"skills"'));
    const ideas = ideasPrompt(s).system;
    for (const k of IDEA_KINDS) assert.ok(ideas.includes(k), k);
    for (const z of IDEA_SIZES) assert.ok(ideas.includes(z), z);
  });
});

function checkStrict(schema: Record<string, unknown>, path: string): void {
  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false, `${path}: additionalProperties`);
    const props = schema.properties as Record<string, Record<string, unknown>>;
    assert.deepEqual(schema.required, Object.keys(props), `${path}: required`);
    for (const [k, v] of Object.entries(props)) checkStrict(v, `${path}.${k}`);
  }
  if (schema.type === "array") checkStrict(schema.items as Record<string, unknown>, `${path}[]`);
}

describe("schemas", () => {
  test("every schema is strict with unique names and required equal to the property keys at every level", () => {
    const all = [readSchema(), lookupSchema(), ideasSchema(), ...SUGGEST_STEPS.map((s) => suggestSchema(s))];
    assert.equal(new Set(all.map((s) => s.name)).size, all.length);
    for (const s of all) {
      assert.equal(s.strict, true, s.name);
      checkStrict(s.schema, s.name);
    }
  });
});

describe("parsers", () => {
  test("parseRead accepts a valid reply, drops unknown enums, defaults priorities, caps and throws on bad shapes", () => {
    const r = parseRead({
      name: " Portal ", problem: "p", audience: "a", success: "s", signoff: "me", roles: ["Staff", "Staff", ""],
      features: [{ key: "accounts", priority: "Must" }, { key: "banana", priority: "Must" }, { key: "portal", priority: "Maybe" }],
      requirements: Array.from({ length: 30 }, (_, i) => ({ text: `r${i}`, priority: "Could", alreadyBuilt: true })),
      integrations: ["Spreadsheets", "Nope"], guardrails: { sso: true, perms: "yes", audit: false, personal: true, compliance: ["GDPR", "Nope"] }, unplaced: ["line"],
    });
    assert.equal(r.name, "Portal");
    assert.deepEqual(r.roles, ["Staff"]);
    assert.deepEqual(r.features, [{ key: "accounts", priority: "Must" }, { key: "portal", priority: "Should" }]);
    assert.equal(r.requirements.length, 25);
    assert.equal(r.requirements[0].alreadyBuilt, true);
    assert.deepEqual(r.integrations, ["Spreadsheets"]);
    assert.deepEqual(r.guardrails, { sso: true, perms: false, audit: false, personal: true, compliance: ["GDPR"] });
    assert.throws(() => parseRead("x"), SchemaError);
    assert.throws(() => parseRead({ requirements: "none" }), SchemaError);
  });

  test("parseLookup keeps complete entries up to nine and throws on a non object", () => {
    const caps = Array.from({ length: 12 }, (_, i) => ({ title: `T${i}`, requirement: `R${i}` })).concat([{ title: "only" } as { title: string; requirement: string }]);
    const r = parseLookup({ caps });
    assert.equal(r.caps.length, 9);
    assert.throws(() => parseLookup(null), SchemaError);
    assert.throws(() => parseLookup({}), SchemaError);
  });

  test("parseSuggest for each step accepts the valid shape, coerces enums and rejects a non object", () => {
    const goal = parseSuggest("goal", { problem: "p", audience: "a", success: "s", roles: ["Staff"] });
    assert.ok(goal.step === "goal" && goal.roles[0] === "Staff");
    const feats = parseSuggest("features", { features: [{ key: "accounts", priority: "Must" }], requirements: [{ text: "x", priority: "Z" }, { text: "" }] });
    assert.ok(feats.step === "features" && feats.requirements.length === 1 && feats.requirements[0].priority === "Should");
    const conn = parseSuggest("connections", { integrations: ["Spreadsheets", "bad"], other: ["A", "B", "C"] });
    assert.ok(conn.step === "connections" && conn.integrations.length === 1 && conn.other.length === 2);
    const guard = parseSuggest("guardrails", { sso: "true", perms: true, audit: false, personal: false, compliance: [], residency: "Mars", scale: "", uptime: "Around the clock", why: "w" });
    assert.ok(guard.step === "guardrails" && guard.sso === false && guard.perms === true && guard.residency === "" && guard.uptime === "Around the clock");
    const run = parseSuggest("running", { run: "nobody", handover: ["docs", "x"], skills: "", why: "" });
    assert.ok(run.step === "running" && run.run === "" && run.handover.length === 1);
    for (const step of SUGGEST_STEPS) assert.throws(() => parseSuggest(step, 42), SchemaError);
  });

  test("parseIdeas accepts six, drops incomplete, defaults kind and size, coerces human, caps at six", () => {
    const ideas = Array.from({ length: 8 }, (_, i) => ({ title: `I${i}`, what: `W${i}`, buildsOn: "", kind: "Nope", size: "Nope", helps: "", human: "yes" }));
    const r = parseIdeas({ note: "n", ideas: [...ideas, { title: "no what" }, { what: "no title" }] });
    assert.equal(r.ideas.length, 6);
    assert.equal(r.ideas[0].kind, "Automate a step");
    assert.equal(r.ideas[0].size, "Moderate");
    assert.equal(r.ideas[0].human, false);
    assert.equal(r.note, "n");
    assert.throws(() => parseIdeas([]), SchemaError);
  });
});
