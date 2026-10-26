/**
 * The emailed result template renders every full view field and both links,
 * escapes model text in the HTML and never emits an en or em dash.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { getTool } from "../app/lib/tools/registry.ts";
import { plainDashes, redactAddresses, renderResultEmail, type ResultEmailView } from "../app/lib/tools/result-email.ts";

const moat = getTool("moat")!;
const SAVED = "https://summitstrategyadvisory.com/tools/moat?run=run_0123456789abcdef&t=abc.def";
const DELETE = "https://summitstrategyadvisory.com/api/tools/data/delete?e=0123&t=ghi.jkl";
const DASH_RE = /[–—]/;

const dims = moat.dimensions;
const listExtra = moat.extras.find((x) => x.kind === "list");
const textExtra = moat.extras.find((x) => x.kind === "text");

function fabricate(): ResultEmailView {
  const scores: Record<string, number> = {};
  const reasoning: Record<string, string> = {};
  dims.forEach((d, i) => {
    scores[d.key] = i < 2 ? 2 : 4;
    reasoning[d.key] = `Reasoning for ${d.name}: the input cites 3–5 named accounts.`;
  });
  const extras: Record<string, string | string[]> = {};
  if (listExtra) extras[listExtra.key] = ["First list item", "Second list item"];
  if (textExtra) extras[textExtra.key] = "A single text extra.";
  return {
    score: 58,
    grade: 3,
    gradeLabel: "Developing",
    legacyLabel: "Contestable",
    verdict: "The position is <b>credible</b> — but the moat is thin.",
    confidence: "medium",
    confidenceReason: "The input named competitors but not switching costs.",
    scores,
    reasoning,
    recommendations: dims.slice(0, 2).map((d) => ({
      dim: d.key,
      name: d.name,
      score: 2,
      gap: `Gap for ${d.key}`,
      consequence: `Consequence for ${d.key}`,
      action: `Action for ${d.key}`,
    })),
    extras,
  };
}

describe("renderResultEmail", () => {
  const full = fabricate();
  const email = renderResultEmail({
    toolName: moat.name,
    toolNumber: moat.number,
    full,
    dimensions: dims,
    extrasMeta: moat.extras,
    savedUrl: SAVED,
    deleteUrl: DELETE,
  });

  test("subject names the tool, score and grade", () => {
    assert.equal(email.subject, `Your ${moat.name} result: 58 out of 100, grade 3 of 5`);
  });

  test("text carries every full view field, both links and the automated line", () => {
    const { text } = email;
    assert.ok(text.includes(moat.name));
    assert.ok(text.includes("58 out of 100"));
    assert.ok(text.includes("Developing"));
    assert.ok(text.includes("Contestable"));
    assert.ok(text.includes("credible"));
    assert.ok(text.includes("The input named competitors but not switching costs."));
    assert.ok(text.includes("Confidence: medium"));
    for (const d of dims) {
      assert.ok(text.includes(d.name), d.name);
      assert.ok(text.includes(d.levels[full.scores[d.key] as 1 | 2 | 3 | 4 | 5]), `${d.name} level`);
      assert.ok(text.includes(`Reasoning for ${d.name}`), `${d.name} reasoning`);
    }
    for (const rec of full.recommendations) {
      assert.ok(text.includes(rec.gap));
      assert.ok(text.includes(rec.consequence));
      assert.ok(text.includes(rec.action));
    }
    if (listExtra) {
      assert.ok(text.includes(listExtra.label));
      assert.ok(text.includes("- First list item"));
    }
    if (textExtra) {
      assert.ok(text.includes(textExtra.label));
      assert.ok(text.includes("A single text extra."));
    }
    assert.ok(text.includes(SAVED));
    assert.ok(text.includes(DELETE));
    assert.ok(text.includes("This result was produced automatically against Summit Strategy Advisory's rubrics."));
  });

  test("html carries both links inside href and escapes model markup", () => {
    const { html } = email;
    assert.ok(html.includes(`href="${SAVED.replace(/&/g, "&amp;")}"`));
    assert.ok(html.includes(`href="${DELETE.replace(/&/g, "&amp;")}"`));
    assert.ok(html.includes("&lt;b&gt;credible&lt;/b&gt;"));
    assert.equal(html.includes("<b>credible</b>"), false);
    assert.equal(html.includes("<script"), false);
  });

  test("neither subject, text nor html contains an en or em dash", () => {
    assert.doesNotMatch(email.subject, DASH_RE);
    assert.doesNotMatch(email.text, DASH_RE);
    assert.doesNotMatch(email.html, DASH_RE);
  });

  test("a dashed range becomes a to range and a free dash becomes a comma", () => {
    assert.ok(email.text.includes("3 to 5 named accounts"));
    assert.ok(email.text.includes("</b>, but the moat is thin"));
    assert.equal(plainDashes("2020—2024"), "2020 to 2024");
    assert.equal(plainDashes("fast – and cheap"), "fast, and cheap");
  });

  test("no recommendations renders the scored 4 or above line", () => {
    const none = renderResultEmail({
      toolName: moat.name,
      toolNumber: moat.number,
      full: { ...full, recommendations: [] },
      dimensions: dims,
      extrasMeta: moat.extras,
      savedUrl: SAVED,
      deleteUrl: DELETE,
    });
    assert.ok(none.text.includes("Every dimension scored 4 or above."));
    assert.ok(none.html.includes("Every dimension scored 4 or above."));
  });
});

describe("redactAddresses", () => {
  test("replaces an address inside a transport error and leaves other text alone", () => {
    assert.equal(
      redactAddresses("550 5.1.1 <ann@example.com>: Recipient address rejected"),
      "550 5.1.1 <[address]>: Recipient address rejected",
    );
    assert.equal(redactAddresses("connect ECONNREFUSED 127.0.0.1:587"), "connect ECONNREFUSED 127.0.0.1:587");
  });
});
