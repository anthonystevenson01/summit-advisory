/**
 * The rule based helpers: fill blanks, add, never overwrite; the quick
 * question; the rule ideas and the ideas key. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank, type BriefState } from "../app/lib/project-builder/brief.ts";
import { IDEA_KINDS, IDEA_SIZES } from "../app/lib/project-builder/catalogue.ts";
import { RUNNING_NO_RULE_MESSAGE, devAnswer, ideasKey, ruleIdeas, ruleSuggest, wordsOf } from "../app/lib/project-builder/suggestions.ts";

function withIdea(idea: string): BriefState {
  const s = blank();
  s.idea = idea;
  return s;
}

describe("ruleSuggest goal", () => {
  test("drafts the problem from the idea, the success measure and Me, adds matched roles and Admins", () => {
    const { state, message } = ruleSuggest(withIdea("A portal where our franchisees order stock"), "goal");
    assert.equal(state.problem, "Today there's no single place for this. We want a portal where our franchisees order stock.");
    assert.equal(state.success, "Cut the time spent on this by half within six months of launch");
    assert.equal(state.signoff, "Me");
    assert.deepEqual(state.roles, ["Partners or suppliers", "Admins"]);
    assert.ok(message.startsWith("Drafted the problem, a success measure and sign-off as a starting point."));
    assert.ok(message.includes("Added Partners or suppliers and Admins."));
  });

  test("never overwrites a filled problem and adds Staff when nothing matches", () => {
    const s = blank();
    s.problem = "Mine";
    s.success = "Done";
    s.signoff = "Me";
    const { state, message } = ruleSuggest(s, "goal");
    assert.equal(state.problem, "Mine");
    assert.deepEqual(state.roles, ["Staff", "Admins"]);
    assert.ok(message.startsWith("Everything here is filled in already."));
    assert.equal(s.roles.length, 0, "argument untouched");
  });

  test("a complete state answers both nothing-to-add lines joined", () => {
    const s = blank();
    s.problem = "p";
    s.success = "s";
    s.signoff = "me";
    s.roles = ["Staff", "Admins"];
    const { message } = ruleSuggest(s, "goal");
    assert.equal(message, "Everything here is filled in already. Nothing new to add from what you've told us.");
  });
});

describe("ruleSuggest features", () => {
  test("adds matching features, the first four at Must, the rest at Should, marked suggested", () => {
    const { state, message } = ruleSuggest(withIdea("A portal where franchisees order stock and see their sales, with search, approvals and files"), "features");
    assert.equal(state.features.accounts, "Must");
    assert.equal(state.features.portal, "Should");
    const pris = Object.values(state.features);
    assert.equal(pris.filter((p) => p === "Must").length, 4);
    assert.ok(pris.filter((p) => p === "Should").length > 0);
    for (const key of Object.keys(state.features)) assert.equal(state.featSrc[key as keyof typeof state.featSrc], "suggested");
    assert.ok(message.startsWith("Added "));
  });

  test("the default three when nothing matches and nothing is set; a set feature is never changed", () => {
    const { state } = ruleSuggest(blank(), "features");
    assert.deepEqual(state.features, { accounts: "Must", dashboard: "Should", notify: "Could" });
    const s = withIdea("A portal");
    s.features = { portal: "Could" };
    s.featSrc = { portal: "you" };
    const r = ruleSuggest(s, "features");
    assert.equal(r.state.features.portal, "Could");
    assert.equal(r.state.featSrc.portal, "you");
  });
});

describe("ruleSuggest connections", () => {
  test("adds the payment provider, CRM, SSO provider with suggested sources", () => {
    const s = withIdea("Sync leads from our CRM");
    s.features = { payments: "Must", accounts: "Must" };
    s.roles = ["Staff"];
    const { state } = ruleSuggest(s, "connections");
    assert.ok(state.integrations.includes("Payment provider"));
    assert.ok(state.integrations.includes("CRM (Salesforce, HubSpot)"));
    assert.ok(state.integrations.includes("Single sign-on provider"));
    for (const label of state.integrations) assert.equal(state.intSrc[label], "suggested");
    assert.equal(s.integrations.length, 0);
  });
});

describe("ruleSuggest guardrails", () => {
  test("switches on perms, sso, audit, personal, PCI DSS, accessibility and uptime, never off", () => {
    const s = blank();
    s.roles = ["Staff", "Customers"];
    s.features = { accounts: "Must", payments: "Must", portal: "Should" };
    s.sso = true;
    const { state } = ruleSuggest(s, "guardrails");
    assert.equal(state.perms, true);
    assert.equal(state.sso, true);
    assert.equal(state.audit, true);
    assert.equal(state.personal, true);
    assert.ok(state.compliance.includes("PCI DSS"));
    assert.ok(state.compliance.includes("Accessibility (WCAG 2.2 AA)"));
    assert.equal(state.uptime, "Around the clock");
    const internal = blank();
    internal.roles = ["Staff"];
    assert.equal(ruleSuggest(internal, "guardrails").state.uptime, "Business hours");
    const kept = blank();
    kept.uptime = "Business hours";
    kept.roles = ["Customers"];
    assert.equal(ruleSuggest(kept, "guardrails").state.uptime, "Business hours");
  });
});

describe("ruleSuggest running and devAnswer", () => {
  test("running has no rule and points at the quick question", () => {
    const s = blank();
    const r = ruleSuggest(s, "running");
    assert.equal(r.state, s);
    assert.equal(r.message, RUNNING_NO_RULE_MESSAGE);
  });

  test("devAnswer sets run and handover for the three answers", () => {
    assert.deepEqual(devAnswer(blank(), "yes").state.handover, ["docs", "train", "repos", "cloud", "support"]);
    assert.equal(devAnswer(blank(), "yes").state.run, "team");
    assert.equal(devAnswer(blank(), "some").state.run, "mix");
    assert.deepEqual(devAnswer(blank(), "some").state.handover, ["docs", "train", "support"]);
    assert.equal(devAnswer(blank(), "no").state.run, "summit");
    assert.deepEqual(devAnswer(blank(), "no").state.handover, ["support"]);
  });
});

describe("ruleIdeas and ideasKey", () => {
  test("between three and six ideas with known kinds and sizes; forms gives the document idea with a person in charge", () => {
    const s = blank();
    s.features = { forms: "Must", dashboard: "Should" };
    const ideas = ruleIdeas(s);
    assert.ok(ideas.length >= 3 && ideas.length <= 6);
    for (const i of ideas) {
      assert.ok(IDEA_KINDS.includes(i.kind));
      assert.ok(IDEA_SIZES.includes(i.size));
    }
    const forms = ideas.find((i) => i.title === "Fill forms from documents");
    assert.ok(forms);
    assert.equal(forms.human, true);
    const all = blank();
    all.features = { forms: "Must", dashboard: "Must", content: "Must", workflow: "Must", messaging: "Must", payments: "Must", booking: "Must", import: "Must" };
    assert.equal(ruleIdeas(all).length, 6);
  });

  test("an empty state gives the three generic ideas", () => {
    assert.deepEqual(ruleIdeas(blank()).map((i) => i.title), ["Answer common questions", "Spot what needs attention", "Write the first draft"]);
  });

  test("ideasKey changes with a feature and not with the name", () => {
    const s = blank();
    const before = ideasKey(s);
    s.name = "Renamed";
    assert.equal(ideasKey(s), before);
    s.features = { accounts: "Must" };
    assert.notEqual(ideasKey(s), before);
  });

  test("wordsOf includes the source excerpt", () => {
    assert.ok(wordsOf(blank(), "Franchisees ORDER stock").includes("franchisees order stock"));
  });
});
