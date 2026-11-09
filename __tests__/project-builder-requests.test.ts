/**
 * Change requests: the text clean, the caps and the Notion lines. Pure
 * module, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { REQUESTS_PER_BRIEF, REQUEST_MAX_CHARS, REQUEST_MIN_CHARS, cleanRequestText, requestLines, type ChangeRequest } from "../app/lib/project-builder/requests.ts";

describe("cleanRequestText", () => {
  test("trims, collapses whitespace, makes dashes plain and caps at 600", () => {
    assert.equal(cleanRequestText("  add   a column\n\nfor the – delivery date  "), "add a column for the, delivery date");
    assert.equal(cleanRequestText("rows 5–10 please"), "rows 5 to 10 please");
    assert.equal(cleanRequestText("x".repeat(700)).length, REQUEST_MAX_CHARS);
  });

  test("under four characters, a non string and blank are empty", () => {
    assert.equal(cleanRequestText("abc"), "");
    assert.equal(cleanRequestText("   "), "");
    assert.equal(cleanRequestText(42), "");
    assert.equal(cleanRequestText(null), "");
    assert.equal(cleanRequestText("abcd"), "abcd");
    assert.equal(REQUEST_MIN_CHARS, 4);
  });
});

describe("requestLines and the cap", () => {
  test("one line per request with the time and a mark on a declined one; the cap is 20", () => {
    const requests: ChangeRequest[] = [
      { id: "r1", text: "Add a column", at: "2026-11-08T10:05:00.000Z", screens: ["jobs"], model: "m", outcome: "built" },
      { id: "r2", text: "Email the customer", at: "2026-11-08T10:09:00.000Z", screens: [], model: "m", outcome: "declined" },
      { id: "r3", text: "No time", at: "not a date", screens: [], model: "m", outcome: "built" },
    ];
    const lines = requestLines(requests);
    assert.equal(lines.length, 3);
    assert.match(lines[0], /^8 November 2026.*10:05 UTC: Add a column$/);
    assert.ok(lines[1].endsWith("Email the customer (outside the prototype's remit, not built)"));
    assert.equal(lines[2], "No time");
    for (const line of lines) assert.doesNotMatch(line, /[–—]/);
    assert.equal(REQUESTS_PER_BRIEF, 20);
  });
});
