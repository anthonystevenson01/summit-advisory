/**
 * The prototype model: readiness and its line, the hash and what moves it,
 * the change lines, the large change rule, the website resolution and the
 * sandbox value. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank, type BriefState } from "../app/lib/project-builder/brief.ts";
import { PROTOTYPE } from "../app/lib/project-builder/copy.ts";
import {
  LARGE_CHANGE_LINES,
  PROTOTYPE_SANDBOX,
  describeChanges,
  isLargeChange,
  prototypeHash,
  prototypeReadiness,
  prototypeSnapshot,
  readinessLine,
  resolvePrototypeWebsite,
} from "../app/lib/project-builder/prototype.ts";

function sample(): BriefState {
  const s = blank();
  s.name = "Garage CRM";
  s.idea = "A CRM for our garages";
  s.path = "idea";
  s.problem = "Bookings are on paper.";
  s.roles = ["Staff", "Managers"];
  s.features = { accounts: "Must", dashboard: "Should" };
  s.custom = [{ text: "Managers approve refunds", pri: "Must", cat: "Feature", src: "you", built: false }];
  s.integrations = ["Spreadsheets"];
  s.ideas = [{ id: "i1", title: "Weekly summary", what: "A weekly note.", buildsOn: "", kind: "Summarise or draft", size: "Quick win", helps: "", human: false }];
  s.ideaPick = { i1: "Should" };
  s.biz = { website: "acme.com", notes: "We fix cars." };
  return s;
}

describe("prototypeReadiness", () => {
  test("blank misses both, with the both line", () => {
    const r = prototypeReadiness(blank());
    assert.equal(r.ready, false);
    assert.deepEqual(r.missing, ["description", "goalOrFeature"]);
    assert.equal(readinessLine(r.missing), PROTOTYPE.needs.both);
  });

  test("an idea alone misses a goal or feature", () => {
    const s = blank();
    s.idea = "A portal";
    const r = prototypeReadiness(s);
    assert.deepEqual(r.missing, ["goalOrFeature"]);
    assert.equal(readinessLine(r.missing), PROTOTYPE.needs.goalOrFeature);
  });

  test("a feature alone misses a description", () => {
    const s = blank();
    s.features = { accounts: "Must" };
    const r = prototypeReadiness(s);
    assert.deepEqual(r.missing, ["description"]);
    assert.equal(readinessLine(r.missing), PROTOTYPE.needs.description);
  });

  test("business notes and a problem are ready, with no line", () => {
    const s = blank();
    s.biz.notes = "We fix cars.";
    s.problem = "Bookings are on paper.";
    const r = prototypeReadiness(s);
    assert.equal(r.ready, true);
    assert.equal(readinessLine(r.missing), "");
  });

  test("the replace path with a system and one capability is ready", () => {
    const s = blank();
    s.path = "replace";
    s.rep.sys = "Salesforce";
    s.rep.caps = { contacts: "Must" };
    assert.equal(prototypeReadiness(s).ready, true);
  });
});

describe("prototypeHash", () => {
  test("equal states hash the same whatever the key order", () => {
    const a = sample();
    const b = sample();
    b.features = { dashboard: "Should", accounts: "Must" };
    b.roles = ["Managers", "Staff"];
    assert.equal(prototypeHash(a), prototypeHash(b));
    assert.match(prototypeHash(a), /^p1-[0-9a-f]{14}$/);
  });

  test("step, sources, idea bookkeeping, timing and budget do not move it", () => {
    const a = sample();
    const b = sample();
    b.step = 4;
    b.featSrc = { accounts: "ai" };
    b.ideasKey = "something";
    b.ideaSeq = 9;
    b.timing = "Within 3 months";
    b.budget = "25k to 75k";
    assert.equal(prototypeHash(a), prototypeHash(b));
  });

  test("a priority, a role, a custom row, a picked idea and a website all move it", () => {
    const base = prototypeHash(sample());
    const changes: Array<(s: BriefState) => void> = [
      (s) => (s.features.accounts = "Could"),
      (s) => s.roles.push("Admins"),
      (s) => s.custom.push({ text: "Another", pri: "Should", cat: "Feature", src: "you", built: false }),
      (s) => (s.ideaPick.i1 = "Must"),
      (s) => (s.biz.website = "other.com"),
      (s) => (s.ideaPick.i1 = "no"),
    ];
    for (const change of changes) {
      const s = sample();
      change(s);
      assert.notEqual(prototypeHash(s), base);
    }
  });
});

describe("the resolved website in the hash", () => {
  test("a contact website or company email domain moves the hash when Step 1 has none", () => {
    const s = sample();
    s.biz.website = "";
    const none = prototypeHash(s, { email: "ann@gmail.com", website: "" });
    assert.notEqual(prototypeHash(s, { email: "ann@gmail.com", website: "acme.com" }), none);
    assert.notEqual(prototypeHash(s, { email: "ann@acme.com", website: "" }), none);
    assert.equal(prototypeSnapshot(s, { email: "ann@acme.com" }).website, "acme.com");
  });

  test("Step 1's website wins, so the contact does not move it then", () => {
    const s = sample();
    assert.equal(prototypeHash(s, { website: "other.com" }), prototypeHash(s));
    assert.equal(prototypeSnapshot(s, { website: "other.com" }).website, "acme.com");
  });
});

describe("describeChanges and isLargeChange", () => {
  test("added and removed features, a priority change, a role and the name", () => {
    const before = prototypeSnapshot(sample());
    const s = sample();
    s.features = { dashboard: "Must", approvals: "Must" };
    s.roles.push("Admins");
    s.name = "Garage Hub";
    const lines = describeChanges(before, prototypeSnapshot(s));
    assert.ok(lines.some((l) => l.startsWith("Added feature:") && l.endsWith("(Must)")), lines.join("\n"));
    assert.ok(lines.some((l) => l.startsWith("Removed feature:")), lines.join("\n"));
    assert.ok(lines.some((l) => l.startsWith("Changed priority:") && l.includes("from Should to Must")), lines.join("\n"));
    assert.ok(lines.includes("Added user type: Admins"));
    assert.ok(lines.includes("Project name is now Garage Hub"));
  });

  test("no lines when equal", () => {
    assert.deepEqual(describeChanges(prototypeSnapshot(sample()), prototypeSnapshot(sample())), []);
  });

  test("large when there is no snapshot, the path or website moved, or there are many lines", () => {
    const before = prototypeSnapshot(sample());
    assert.equal(isLargeChange(null, before), true);
    const path = sample();
    path.path = "doc";
    assert.equal(isLargeChange(before, prototypeSnapshot(path)), true);
    const site = sample();
    site.biz.website = "other.com";
    assert.equal(isLargeChange(before, prototypeSnapshot(site)), true);
    const many = sample();
    many.roles = Array.from({ length: LARGE_CHANGE_LINES }, (_, i) => `Role ${i}`);
    assert.equal(isLargeChange(before, prototypeSnapshot(many)), true);
    const small = sample();
    small.roles.push("Admins");
    assert.equal(isLargeChange(before, prototypeSnapshot(small)), false);
  });
});

describe("resolvePrototypeWebsite", () => {
  test("Step 1 website wins, then the contact website, then a company email domain", () => {
    const s = blank();
    s.biz.website = "https://www.Acme.com/about";
    assert.deepEqual(resolvePrototypeWebsite(s, { website: "other.com", email: "a@third.com" }), { url: "https://acme.com/", host: "acme.com" });
    s.biz.website = "";
    assert.equal(resolvePrototypeWebsite(s, { website: "other.com", email: "a@third.com" })?.host, "other.com");
    assert.equal(resolvePrototypeWebsite(s, { website: "", email: "a@third.com" })?.host, "third.com");
  });

  test("free mail gives null, as do local and internal hosts", () => {
    const s = blank();
    assert.equal(resolvePrototypeWebsite(s, { website: "", email: "a@gmail.com" }), null);
    assert.equal(resolvePrototypeWebsite(s, null), null);
    for (const bad of ["localhost", "10.0.0.1", "intranet.internal", "printer.local"]) {
      s.biz.website = bad;
      assert.equal(resolvePrototypeWebsite(s, null), null, bad);
    }
  });
});

describe("PROTOTYPE_SANDBOX", () => {
  test("scripts only", () => {
    assert.equal(PROTOTYPE_SANDBOX, "allow-scripts");
    for (const banned of ["allow-same-origin", "allow-forms", "allow-popups", "allow-top-navigation"]) {
      assert.ok(!PROTOTYPE_SANDBOX.includes(banned), banned);
    }
  });
});
