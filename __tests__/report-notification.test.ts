/**
 * The notification email to Anthony on a first open and on a re-run. Pure module, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { renderReportNotification } from "../app/lib/tools/report-notification.ts";

const DASH_RE = /[–—]/;

const base = {
  company: "Gradeshow",
  slug: "gradeshow",
  atIso: "2026-10-26T10:05:00.000Z",
  openCount: 1,
  rerunCount: 0,
  reportUrl: "https://summitstrategyadvisory.com/report/gradeshow",
  adminUrl: "https://summitstrategyadvisory.com/admin/reports/gradeshow",
};

describe("renderReportNotification", () => {
  test("an open names the company, the slug, both URLs, the time and the counts", () => {
    const { subject, text } = renderReportNotification({ ...base, event: "opened" });
    assert.equal(subject, "Report opened: Gradeshow");
    assert.ok(text.includes("Gradeshow (gradeshow)"));
    assert.ok(text.includes("What happened: opened for the first time"));
    assert.ok(text.includes("When: 26 October 2026, 10:05 UTC"));
    assert.ok(text.includes("Opens so far: 1"));
    assert.ok(text.includes("Re-runs so far: 0"));
    assert.ok(text.includes(`Report: ${base.reportUrl}`));
    assert.ok(text.includes(`Edit: ${base.adminUrl}`));
  });

  test("a re-run names the tool and the re-run count", () => {
    const { subject, text } = renderReportNotification({ ...base, event: "rerun", tool: "Moat Rater", rerunCount: 2 });
    assert.equal(subject, "Report re-run: Gradeshow (Moat Rater)");
    assert.ok(text.includes("What happened: Moat Rater re-run from the report"));
    assert.ok(text.includes("Re-runs so far: 2"));
  });

  test("dashes in caller strings are normalised and never appear", () => {
    const { subject, text } = renderReportNotification({ ...base, event: "opened", company: "Grade—show – Ltd" });
    assert.doesNotMatch(subject, DASH_RE);
    assert.doesNotMatch(text, DASH_RE);
    assert.ok(subject.includes("Grade, show, Ltd"));
  });
});
