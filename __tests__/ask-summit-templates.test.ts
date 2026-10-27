/**
 * The Ask Summit emails: the confirmation to the prospect and the queue
 * notifications to Anthony. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { CONTACT_EMAIL } from "../app/lib/brand.ts";
import { renderConfirmationEmail, renderQueueNotification } from "../app/lib/ask-summit/templates.ts";
import { PREPARATION_LINE } from "../app/lib/ask-summit/copy.ts";

const DASH_RE = /[–—]/;
const DELETE = "https://summitstrategyadvisory.com/api/tools/data/delete?e=0123&t=ghi.jkl";
const QUEUE = "https://summitstrategyadvisory.com/admin/ask-summit";

describe("renderConfirmationEmail", () => {
  const email = renderConfirmationEmail({ name: "Ann", siteUrl: "https://example.com/", fileNames: ["deck.pdf", "plan <b>2026</b>.docx"], deleteUrl: DELETE });

  test("subject, greeting, the received line, the promises and the delete link", () => {
    assert.equal(email.subject, "Summit has your Built to Scale? request");
    assert.ok(email.text.startsWith("Hello Ann,"));
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("https://example.com/"));
      assert.ok(body.includes("deck.pdf"));
      assert.ok(body.includes("two working days"));
      assert.ok(body.includes("30 days"));
      assert.ok(body.includes("not used to train"));
      assert.ok(body.includes("checks it, edits the scores and writes the commentary"));
      assert.doesNotMatch(body, DASH_RE);
    }
    assert.ok(email.text.includes(PREPARATION_LINE));
    assert.ok(email.text.includes("2 files: deck.pdf, plan <b>2026</b>.docx"));
    assert.ok(email.text.includes(DELETE));
    assert.ok(email.html.includes(`href="${DELETE.replace("&", "&amp;")}"`));
    assert.ok(email.html.includes("plan &lt;b&gt;2026&lt;/b&gt;.docx"));
    assert.ok(!email.html.includes("<b>2026</b>"));
  });

  test("without a delete URL the text carries the contact fallback; without a name the greeting is Hello", () => {
    const fallback = renderConfirmationEmail({ name: "", siteUrl: "https://example.com/", fileNames: [], deleteUrl: null });
    assert.ok(fallback.text.startsWith("Hello,"));
    assert.ok(fallback.text.includes(`write to ${CONTACT_EMAIL}`));
    assert.ok(!fallback.text.includes("api/tools/data/delete"));
    assert.ok(fallback.text.includes("We have your website https://example.com/."));
    assert.ok(!fallback.text.includes("files:") && !fallback.text.includes("1 file"));
  });
});

describe("renderQueueNotification", () => {
  test("done names the host, the counts, the confidence, the time and both links", () => {
    const { subject, text } = renderQueueNotification({
      kind: "done",
      requestId: "ask_0123456789abcdef",
      host: "example.com",
      companyName: "Acme",
      pageCount: 12,
      docCount: 2,
      confidence: "2 high, 2 medium, 1 low",
      totalMs: 83_400,
      queueUrl: QUEUE,
      editorUrl: `${QUEUE.replace("ask-summit", "reports")}/draft-89abcdef`,
    });
    assert.equal(subject, "Ask Summit: example.com is ready to review");
    assert.ok(text.includes("Acme (example.com)"));
    assert.ok(text.includes("ask_0123456789abcdef"));
    assert.ok(text.includes("12 pages, 2 documents, confidence 2 high, 2 medium, 1 low, 83 s"));
    assert.ok(text.includes(`Queue: ${QUEUE}`));
    assert.ok(text.includes("Edit the report: https://summitstrategyadvisory.com/admin/reports/draft-89abcdef"));
    assert.doesNotMatch(text, DASH_RE);
  });

  test("failed names the stage and the redacted reason; stuck says Process now", () => {
    const failed = renderQueueNotification({
      kind: "failed",
      requestId: "ask_0123456789abcdef",
      host: "example.com",
      companyName: "",
      stage: "crawl",
      message: "550 <ann@example.com> rejected — retry",
      queueUrl: QUEUE,
    });
    assert.equal(failed.subject, "Ask Summit: example.com failed at crawl");
    assert.ok(failed.text.includes("Stage: crawl"));
    assert.ok(failed.text.includes("Reason: 550 <[address]> rejected, retry"));
    assert.ok(!failed.text.includes("ann@example.com"));
    assert.doesNotMatch(failed.text, DASH_RE);

    const stuck = renderQueueNotification({ kind: "stuck", requestId: "ask_0123456789abcdef", host: "example.com", companyName: "", message: "QSTASH_TOKEN is not set", queueUrl: QUEUE });
    assert.equal(stuck.subject, "Ask Summit: example.com needs Process now");
    assert.ok(stuck.text.includes("QStash did not accept the message: QSTASH_TOKEN is not set"));
    assert.ok(stuck.text.includes("npm run process-ask"));
  });
});
