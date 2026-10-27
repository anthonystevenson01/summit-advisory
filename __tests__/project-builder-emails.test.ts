/**
 * The six Project Builder emails carry the right links and lines, escape
 * prospect text in the HTML, never put an address in a subject and never
 * emit an en or em dash. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { blank, type BriefState } from "../app/lib/project-builder/brief.ts";
import {
  NOTION_FAILED_LINE,
  renderAlertEmail,
  renderChangeRequestEmail,
  renderConfirmationEmail,
  renderReminderEmail,
  renderSaveLinkEmail,
  renderUnlockEmail,
} from "../app/lib/project-builder/emails.ts";

const DASH_RE = /[–—]/;
const RESUME = "https://summitstrategyadvisory.com/project-builder?b=brief_0123456789abcdef&t=abc.def";
const VIEW = RESUME;
const DELETE = "https://summitstrategyadvisory.com/api/project-builder/delete?e=0123&t=ghi.jkl";
const ADMIN = "https://summitstrategyadvisory.com/admin/briefs/brief_0123456789abcdef";
const CONTACT = { name: "Ann Example", company: "Acme <b>Ltd</b>", website: "acme.com" };

function fabricate(): BriefState {
  const s = blank();
  s.name = "Portal — phase one <b>bold</b>";
  s.problem = "Takes 3–5 days";
  s.step = 2;
  s.path = "idea";
  s.roles = ["Staff"];
  s.features = { accounts: "Must" };
  return s;
}

describe("Project Builder emails", () => {
  const state = fabricate();
  const all = [
    renderSaveLinkEmail({ state, contact: CONTACT, resumeUrl: RESUME, deleteUrl: DELETE }),
    renderSaveLinkEmail({ state, contact: CONTACT, resumeUrl: RESUME, deleteUrl: DELETE, locked: true }),
    renderConfirmationEmail({ state, contact: CONTACT, viewUrl: VIEW, deleteUrl: DELETE }),
    renderAlertEmail({ state, contact: CONTACT, sourceTag: "linkedin", adminUrl: ADMIN, notionFailed: true }),
    renderReminderEmail({ state, resumeUrl: RESUME, deleteUrl: DELETE }),
    renderChangeRequestEmail({ state, contact: CONTACT, message: "Please change 3–4 things", adminUrl: ADMIN }),
    renderUnlockEmail({ state, contact: CONTACT, resumeUrl: RESUME, deleteUrl: DELETE }),
  ];

  test("no subject carries an address; no text or html carries a dash; html escapes prospect markup", () => {
    for (const e of all) {
      assert.ok(!e.subject.includes("@"), e.subject);
      assert.doesNotMatch(e.subject, DASH_RE, e.subject);
      assert.doesNotMatch(e.text, DASH_RE);
      assert.doesNotMatch(e.html, DASH_RE);
      assert.ok(!e.html.includes("<b>bold</b>"), "html escapes the project name");
      assert.ok(!e.html.includes("<script"));
    }
    assert.ok(all[0].html.includes("&lt;b&gt;bold&lt;/b&gt;"));
  });

  test("the save link email", () => {
    const e = all[0];
    assert.equal(e.subject, "Pick up your project brief where you left off");
    assert.ok(e.text.includes("Portal, phase one <b>bold</b>"));
    assert.ok(e.text.includes(RESUME));
    assert.ok(e.text.includes(DELETE));
    assert.ok(e.text.includes("Delete my brief"));
    assert.ok(e.text.includes("What it does"), "names the step");
    assert.ok(e.html.includes(`href="${RESUME.replace(/&/g, "&amp;")}"`));
    assert.ok(e.html.includes("Delete my brief"));
    assert.equal(all[1].subject, "Your project brief: Portal, phase one <b>bold</b>");
  });

  test("the confirmation email", () => {
    const e = all[2];
    assert.ok(e.subject.startsWith("Your project brief is with Summit: Portal"));
    assert.ok(e.text.includes("Anthony will send your project brief within two working days"));
    assert.ok(e.text.includes(VIEW));
    assert.ok(e.text.includes(DELETE));
    assert.ok(e.text.includes("Thanks, Ann."));
  });

  test("the alert email", () => {
    const e = all[3];
    for (const part of ["Ann Example", "Acme <b>Ltd</b>", "Portal, phase one", "I just have an idea", "Must count: 1", "Source: linkedin", ADMIN, NOTION_FAILED_LINE]) {
      assert.ok(e.text.includes(part), part);
    }
    const ok = renderAlertEmail({ state, contact: CONTACT, sourceTag: "", adminUrl: ADMIN, notionFailed: false, notionUrl: "https://www.notion.so/abc" });
    assert.ok(!ok.text.includes(NOTION_FAILED_LINE));
    assert.ok(ok.text.includes("https://www.notion.so/abc"));
    assert.ok(ok.text.includes("Source: (none)"));
  });

  test("the reminder email", () => {
    const e = all[4];
    assert.equal(e.subject, "Your project brief is waiting");
    assert.ok(e.text.includes("40% complete"));
    assert.ok(e.text.includes("step 3, What it does"));
    assert.ok(e.text.includes(RESUME));
    assert.ok(e.text.includes("delete your brief and we will not write again"));
    assert.ok(e.text.includes(DELETE));
  });

  test("the change request and unlock emails", () => {
    assert.ok(all[5].text.includes("Please change 3 to 4 things"));
    assert.ok(all[5].text.includes(ADMIN));
    assert.ok(all[5].text.includes("Unlock the brief from admin"));
    assert.equal(all[6].subject, "Your project brief is open for changes");
    assert.ok(all[6].text.includes("Anthony has reopened your brief"));
    assert.ok(all[6].text.includes(RESUME));
    assert.ok(all[6].text.includes(DELETE));
  });
});
