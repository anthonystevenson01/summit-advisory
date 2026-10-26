/**
 * The Built to Scale? result email renders every field and both links,
 * escapes model text in the HTML and never emits an en or em dash.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { BTS_PARTS, QUICK_NOTE, type CompositeFullView } from "../app/lib/tools/built-to-scale-method.ts";
import { dotsText, renderBuiltToScaleEmail } from "../app/lib/tools/built-to-scale-email.ts";

const SAVED = "https://summitstrategyadvisory.com/tools/built-to-scale/r/run_0123456789abcdef?t=abc.def";
const DELETE = "https://summitstrategyadvisory.com/api/tools/data/delete?e=0123&t=ghi.jkl";
const DASH_RE = /[–—]/;

function fabricate(quickMode: boolean): CompositeFullView {
  const grades = [3, 2, 1, 4, 3];
  return {
    runId: "run_0123456789abcdef",
    tool: "built-to-scale",
    total: 13,
    band: "A good idea with an engine still to build",
    bandKey: "engine",
    verdict: "The pain is real — but the <b>engine</b> is a person.",
    strongest: "Value evidence: the gap report is accepted as audit evidence.",
    weakest: "Unit of value constraints: one facilitator, one day, one exercise.",
    confidence: "medium",
    confidenceReason: "Unit of value carries numbers; route to buyer does not.",
    quickMode,
    createdAt: "2026-10-26T10:00:00.000Z",
    rows: BTS_PARTS.map((p, i) => ({
      key: p.key,
      name: p.name,
      grade: grades[i],
      feeds: [],
      comment: `Comment for ${p.name} covering 3–5 points.`,
      sources: [],
      working: [],
    })),
    absentTools: [],
    unlocked: true,
    oneChange: "Price the scenario library as an annual licence before hiring a second facilitator.",
  };
}

describe("renderBuiltToScaleEmail", () => {
  const full = fabricate(true);
  const email = renderBuiltToScaleEmail({ full, savedUrl: SAVED, deleteUrl: DELETE });

  test("subject names the total and band", () => {
    assert.equal(email.subject, "Your Built to Scale? score: 13 of 25, A good idea with an engine still to build");
  });

  test("text carries every field, both links, the quick note and the automated paragraph", () => {
    const { text } = email;
    assert.ok(text.includes("13 of 25"));
    assert.ok(text.includes("A good idea with an engine still to build"));
    assert.ok(text.includes("engine</b> is a person"));
    assert.ok(text.includes("Confidence: medium. Unit of value carries numbers"));
    for (const row of full.rows) {
      assert.ok(text.includes(`${row.name}: ${row.grade} of 5`), row.name);
      assert.ok(text.includes(`Comment for ${row.name} covering 3 to 5 points.`), `${row.name} comment`);
    }
    assert.ok(text.includes(`Strongest: ${full.strongest}`));
    assert.ok(text.includes(`Weakest: ${full.weakest}`));
    assert.ok(text.includes(`The one change: ${full.oneChange}`));
    assert.ok(text.includes(SAVED));
    assert.ok(text.includes(DELETE));
    assert.ok(text.includes(QUICK_NOTE));
    assert.ok(text.includes("This score was produced automatically."));
    assert.ok(text.includes(dotsText(3)));
  });

  test("html carries both links inside href, every field and escapes model markup", () => {
    const { html } = email;
    assert.ok(html.includes(`href="${SAVED.replace(/&/g, "&amp;")}"`));
    assert.ok(html.includes(`href="${DELETE.replace(/&/g, "&amp;")}"`));
    assert.ok(html.includes("&lt;b&gt;engine&lt;/b&gt;"));
    assert.equal(html.includes("<b>engine</b>"), false);
    assert.ok(html.includes("13 <span"));
    for (const row of full.rows) {
      assert.ok(html.includes(`${row.name}:</strong> ${row.grade} of 5`), row.name);
      assert.ok(html.includes(`Comment for ${row.name} covering 3 to 5 points.`));
    }
    assert.ok(html.includes(full.strongest));
    assert.ok(html.includes(full.weakest));
    assert.ok(html.includes(full.oneChange));
    assert.ok(html.includes(QUICK_NOTE));
    assert.ok(html.includes("This score was produced automatically."));
  });

  test("neither subject, text nor html contains an en or em dash", () => {
    assert.doesNotMatch(email.subject, DASH_RE);
    assert.doesNotMatch(email.text, DASH_RE);
    assert.doesNotMatch(email.html, DASH_RE);
  });

  test("a five-part run carries no quick note", () => {
    const plain = renderBuiltToScaleEmail({ full: fabricate(false), savedUrl: SAVED, deleteUrl: DELETE });
    assert.equal(plain.text.includes(QUICK_NOTE), false);
    assert.equal(plain.html.includes(QUICK_NOTE), false);
  });

  test("dotsText fills to the grade", () => {
    assert.equal(dotsText(2), "●●○○○");
    assert.equal(dotsText(5), "●●●●●");
  });
});
