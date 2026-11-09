/**
 * The Notion page builder produces every property with the right type
 * wrapper and the body blocks in order, with no dash in any text. Pure
 * modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank, type BriefState } from "../app/lib/project-builder/brief.ts";
import { CHANGE_REQUESTS_HEADING, PROTOTYPE_LINK_LABEL, REVIEW_SUGGESTIONS_HEADING, briefPageBlocks, briefPageProperties, chunkBlocks, notionPageUrl, type BriefPageArgs } from "../app/lib/project-builder/notion-brief.ts";

const DASH_RE = /[–—]/;

function state(): BriefState {
  const s = blank();
  s.name = "Portal — one";
  s.path = "replace";
  s.rep.sys = "Salesforce";
  s.rep.reasons = ["Too slow"];
  s.problem = "Keyed twice";
  s.success = "Half the time";
  s.roles = ["Staff"];
  s.features = { accounts: "Must", notify: "Could" };
  s.custom = [{ text: "Doc row", pri: "Should", cat: "Feature", src: "doc", built: true }];
  s.integrations = ["Spreadsheets"];
  s.ideas = [
    { id: "i1", title: "Added idea", what: "Does a thing.", buildsOn: "", kind: "Predict", size: "Moderate", helps: "", human: false },
    { id: "i2", title: "Passed idea", what: "Does another.", buildsOn: "", kind: "Predict", size: "Moderate", helps: "", human: false },
  ];
  s.ideaPick = { i1: "Should", i2: "no" };
  s.biz.notes = "We make – widgets";
  s.unplaced = ["A line we could not place"];
  s.budget = "Under 25k";
  s.timing = "Within 3 months";
  return s;
}

function args(overrides: Partial<BriefPageArgs> = {}): BriefPageArgs {
  return {
    id: "brief_0123456789abcdef",
    state: state(),
    source: null,
    contact: { name: "Ann", email: "ann@acme.com", company: "Acme", website: "acme.com" },
    sourceTag: "linkedin",
    status: "submitted",
    submittedAt: "2026-10-26T10:00:00.000Z",
    adminUrl: "https://summitstrategyadvisory.com/admin/briefs/brief_0123456789abcdef",
    ...overrides,
  };
}

function texts(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) texts(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) if (k !== "type" && k !== "object") texts(v, out);
  }
  return out;
}

describe("briefPageProperties", () => {
  test("every property with its Notion wrapper for a submitted brief", () => {
    const p = briefPageProperties(args()) as Record<string, Record<string, unknown>>;
    assert.deepEqual(Object.keys(p).sort(), ["Admin link", "Budget", "Company", "Contact name", "Could", "Email", "Must", "Project name", "Should", "Source", "Starting point", "Status", "Submitted", "System replaced", "Timing", "Website"].sort());
    assert.deepEqual(p["Project name"], { title: [{ type: "text", text: { content: "Portal, one" } }] });
    assert.deepEqual(p.Company, { rich_text: [{ type: "text", text: { content: "Acme" } }] });
    assert.deepEqual(p["Contact name"], { rich_text: [{ type: "text", text: { content: "Ann" } }] });
    assert.deepEqual(p.Email, { email: "ann@acme.com" });
    assert.deepEqual(p.Website, { url: "https://acme.com" });
    assert.deepEqual(p.Source, { rich_text: [{ type: "text", text: { content: "linkedin" } }] });
    assert.deepEqual(p["Starting point"], { select: { name: "We're replacing a system" } });
    assert.deepEqual(p["System replaced"], { rich_text: [{ type: "text", text: { content: "Salesforce" } }] });
    assert.deepEqual(p.Must, { number: 2 });
    assert.deepEqual(p.Should, { number: 2 });
    assert.deepEqual(p.Could, { number: 1 });
    assert.deepEqual(p.Budget, { select: { name: "Under 25k" } });
    assert.deepEqual(p.Timing, { select: { name: "Within 3 months" } });
    assert.deepEqual(p.Status, { select: { name: "Submitted" } });
    assert.deepEqual(p.Submitted, { date: { start: "2026-10-26T10:00:00.000Z" } });
    assert.deepEqual(p["Admin link"], { url: "https://summitstrategyadvisory.com/admin/briefs/brief_0123456789abcdef" });
  });

  test("a draft has a null Submitted and the Draft label", () => {
    const p = briefPageProperties(args({ status: "draft", submittedAt: null })) as Record<string, Record<string, unknown>>;
    assert.deepEqual(p.Submitted, { date: null });
    assert.deepEqual(p.Status, { select: { name: "Draft" } });
  });
});

describe("briefPageBlocks", () => {
  test("a heading per step, the requirements table, the ideas, the notes, and no dash", () => {
    const blocks = briefPageBlocks(args()) as Array<Record<string, unknown>>;
    const headings = blocks.filter((b) => b.type === "heading_2").map((b) => texts(b.heading_2)[0]);
    assert.deepEqual(headings, ["Your business", "The goal", "What it does", "Rules and running it", "Requirements", "AI ideas added", "AI ideas passed on", "Their own notes"]);
    assert.equal(blocks[0].type, "heading_1");
    assert.ok(texts(blocks[0])[0].startsWith("Submitted on 26 October 2026"));
    const table = blocks.find((b) => b.type === "table") as { table: { children: Array<Record<string, unknown>> } };
    assert.ok(table);
    const rows = table.table.children;
    assert.equal(rows.length, 6);
    assert.deepEqual(texts(rows[0]), ["ID", "Requirement", "Type", "Priority", "Source"]);
    const first = texts(rows[1]);
    assert.equal(first[0], "REQ-001");
    assert.equal(first[3], "Must");
    assert.ok(rows.some((r) => texts(r).includes("From your document, already built")));
    const all = texts(blocks);
    assert.ok(all.includes("Added idea (Should)"));
    assert.ok(all.includes("Passed idea"));
    assert.ok(all.includes("We make, widgets"));
    assert.ok(all.includes("A line we could not place"));
    assert.ok(all.some((t) => t.startsWith("Problem: Keyed twice")));
    for (const t of all) assert.doesNotMatch(t, DASH_RE, t);
  });

  test("a pasted source is split into paragraphs of at most 2,000 characters", () => {
    const blocks = briefPageBlocks(args({ source: "y".repeat(4500) })) as Array<Record<string, unknown>>;
    const idx = blocks.findIndex((b) => b.type === "heading_2" && texts(b)[0] === "Pasted material");
    assert.ok(idx > 0);
    const paras = blocks.slice(idx + 1).map((b) => texts(b)[0]);
    assert.deepEqual(paras.map((p) => p.length), [2000, 2000, 500]);
  });

  test("a Prototype section with linked rich text only when a prototype URL is given", () => {
    const none = briefPageBlocks(args()) as Array<Record<string, unknown>>;
    assert.ok(!none.some((b) => b.type === "heading_2" && texts(b)[0] === "Prototype"));
    const proto = "https://summitstrategyadvisory.com/project-builder?b=brief_0123456789abcdef&t=a.b&view=prototype";
    const admin = "https://summitstrategyadvisory.com/admin/briefs/brief_0123456789abcdef/prototype";
    const blocks = briefPageBlocks(args({ prototypeUrl: proto, prototypeAdminUrl: admin })) as Array<Record<string, unknown>>;
    const idx = blocks.findIndex((b) => b.type === "heading_2" && texts(b)[0] === "Prototype");
    assert.ok(idx > 0);
    const link = blocks[idx + 1] as { paragraph: { rich_text: Array<{ text: { content: string; link: { url: string } } }> } };
    assert.equal(link.paragraph.rich_text[0].text.content, PROTOTYPE_LINK_LABEL);
    assert.equal(link.paragraph.rich_text[0].text.link.url, proto);
    const adminLink = blocks[idx + 3] as { paragraph: { rich_text: Array<{ text: { link: { url: string } } }> } };
    assert.equal(adminLink.paragraph.rich_text[0].text.link.url, admin);
    assert.ok(!JSON.stringify(blocks).includes("<html"));
  });

  test("the two staged build headings sit under Prototype with bullets, or None, and only when a prototype URL exists", () => {
    const proto = "https://summitstrategyadvisory.com/project-builder?b=brief_0123456789abcdef&t=a.b&view=prototype";
    const none = briefPageBlocks(args({ reviewSuggestions: ["Approvals view: managers need one"], changeRequests: [{ text: "Add a column", at: "2026-11-08T10:05:00.000Z" }] })) as Array<Record<string, unknown>>;
    assert.ok(!none.some((b) => b.type === "heading_2" && texts(b)[0] === REVIEW_SUGGESTIONS_HEADING));
    assert.ok(!none.some((b) => b.type === "heading_2" && texts(b)[0] === CHANGE_REQUESTS_HEADING));

    const blocks = briefPageBlocks(args({ prototypeUrl: proto, reviewSuggestions: ["Approvals view: managers need one", "Reporting – weekly"], changeRequests: [{ text: "Add a column", at: "2026-11-08T10:05:00.000Z" }, { text: "Email the customer", at: "2026-11-08T10:09:00.000Z", declined: true }] })) as Array<Record<string, unknown>>;
    const headings = blocks.map((b) => (b.type === "heading_2" ? texts(b)[0] : ""));
    const protoAt = headings.indexOf("Prototype");
    assert.ok(protoAt > 0);
    assert.equal(headings.indexOf(REVIEW_SUGGESTIONS_HEADING) > protoAt, true);
    assert.equal(headings.indexOf(CHANGE_REQUESTS_HEADING) > headings.indexOf(REVIEW_SUGGESTIONS_HEADING), true);
    const bullets = blocks.filter((b) => b.type === "bulleted_list_item").map((b) => texts(b)[0]);
    assert.ok(bullets.includes("Approvals view: managers need one"));
    assert.ok(bullets.includes("Reporting, weekly"));
    assert.ok(bullets.some((b) => /^8 November 2026.*10:05 UTC: Add a column$/.test(b)), bullets.join(" | "));
    assert.ok(bullets.some((b) => /^8 November 2026.*10:09 UTC: Email the customer \(outside the prototype's remit, not built\)$/.test(b)));
    assert.ok(!JSON.stringify(blocks).includes("<html"));
    assert.ok(!JSON.stringify(blocks).includes('"slug"'));
    for (const t of texts(blocks)) assert.doesNotMatch(t, DASH_RE, t);

    const empty = briefPageBlocks(args({ prototypeUrl: proto })) as Array<Record<string, unknown>>;
    const at = empty.findIndex((b) => b.type === "heading_2" && texts(b)[0] === REVIEW_SUGGESTIONS_HEADING);
    assert.equal(texts(empty[at + 1])[0], "None");
    const at2 = empty.findIndex((b) => b.type === "heading_2" && texts(b)[0] === CHANGE_REQUESTS_HEADING);
    assert.equal(texts(empty[at2 + 1])[0], "None");
  });

  test("chunkBlocks and notionPageUrl", () => {
    assert.deepEqual(chunkBlocks(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length), [100, 100, 50]);
    assert.equal(notionPageUrl("12345678-abcd-1234-abcd-123456789abc"), "https://www.notion.so/12345678abcd1234abcd123456789abc");
  });
});
