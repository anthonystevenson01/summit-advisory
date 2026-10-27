/**
 * The brief state validator, the domain normaliser, the free mail check,
 * the contact validator, the status machine, the source tag and the two
 * token purposes. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  BRIEF_DELETE_PURPOSE,
  BRIEF_LINK_MAX_AGE_SECONDS,
  BRIEF_LINK_PURPOSE,
  BriefStateError,
  blank,
  canTransition,
  isFreeMailAddress,
  isLocked,
  normaliseDomain,
  normaliseSourceTag,
  parseBriefState,
  validateContact,
} from "../app/lib/project-builder/brief.ts";
import { signToken, verifyToken } from "../app/lib/tools/unlock-token.ts";

describe("blank and parseBriefState", () => {
  test("blank has the prototype's defaults", () => {
    const s = blank();
    assert.equal(s.step, 0);
    assert.equal(s.name, "");
    assert.deepEqual(s.roles, []);
    assert.equal(s.timing, "No fixed date");
    assert.equal(s.budget, "Not set yet");
    assert.equal(s.residency, "No preference");
    assert.equal(s.rep.migrate, true);
    assert.equal(s.rep.parallel, false);
  });

  test("round trips blank, {} is blank, a non object throws", () => {
    assert.deepEqual(parseBriefState(blank()), blank());
    assert.deepEqual(parseBriefState({}), blank());
    assert.throws(() => parseBriefState("nope"), BriefStateError);
    assert.throws(() => parseBriefState(null), BriefStateError);
    assert.throws(() => parseBriefState([]), BriefStateError);
  });

  test("drops unknown keys, coerces and caps", () => {
    const raw = {
      ...blank(),
      extra: "dropped",
      name: 42,
      problem: "x".repeat(5000),
      custom: Array.from({ length: 70 }, (_, i) => ({ text: `r${i}` })),
      roles: Array.from({ length: 30 }, (_, i) => `role${i}`),
      ideas: Array.from({ length: 25 }, (_, i) => ({ id: `i${i + 1}`, title: `t${i}`, what: `w${i}` })),
      step: 9,
      features: { accounts: "Maybe", portal: "Must", banana: "Must" },
      run: "nobody",
      path: "elsewhere",
    };
    const s = parseBriefState(raw) as unknown as Record<string, unknown>;
    assert.ok(!("extra" in s));
    assert.equal(s.name, "");
    assert.equal((s.problem as string).length, 4000);
    assert.equal((s.custom as unknown[]).length, 60);
    assert.equal((s.roles as unknown[]).length, 20);
    assert.equal((s.ideas as unknown[]).length, 18);
    assert.equal(s.step, 0);
    assert.deepEqual(s.features, { portal: "Must" });
    assert.equal(s.run, "");
    assert.equal(s.path, "");
  });

  test("custom rows missing text are dropped and a missing priority becomes Should; sources are mapped", () => {
    const s = parseBriefState({ custom: [{ pri: "Must" }, { text: "Keep", src: "user" }, { text: "Old", src: "replace", built: "true" }] });
    assert.deepEqual(s.custom, [
      { text: "Keep", pri: "Should", cat: "Feature", src: "you", built: false },
      { text: "Old", pri: "Should", cat: "Feature", src: "system", built: true },
    ]);
  });
});

describe("normaliseDomain and isFreeMailAddress", () => {
  test("accepts bare domains and full URLs, rejects junk", () => {
    assert.equal(normaliseDomain("acme.com"), "acme.com");
    assert.equal(normaliseDomain("https://www.Acme.com/path?x"), "acme.com");
    assert.equal(normaliseDomain("  ACME.COM/ "), "acme.com");
    for (const bad of ["acme", "", "not a domain", "http://"]) assert.equal(normaliseDomain(bad), null, bad);
  });

  test("free mail domains in any case; company domains are not", () => {
    for (const d of ["gmail", "googlemail", "hotmail", "outlook", "yahoo", "icloud", "live", "aol", "proton"]) {
      assert.equal(isFreeMailAddress(`ann@${d.toUpperCase()}.com`), true, d);
    }
    assert.equal(isFreeMailAddress("ann@acme.com"), false);
    assert.equal(isFreeMailAddress("nothing"), false);
  });
});

describe("validateContact", () => {
  test("requires all four, checks the email and website, normalises the domain", () => {
    assert.deepEqual(validateContact({ name: "Ann", email: "ann@acme.com", company: "Acme" }), { ok: false, error: "Please fill in all four details." });
    assert.deepEqual(validateContact({ name: "Ann", email: "not-an-email", company: "Acme", website: "acme.com" }), { ok: false, error: "That email address doesn't look right." });
    assert.deepEqual(validateContact({ name: "Ann", email: "ann@acme.com", company: "Acme", website: "acme" }), { ok: false, error: "That website doesn't look right. Try something like acme.com." });
    const ok = validateContact({ name: " Ann ", email: "ann@acme.com", company: "Acme", website: "https://www.acme.com/about", marketing: "true" });
    assert.deepEqual(ok, { ok: true, contact: { name: "Ann", email: "ann@acme.com", company: "Acme", website: "acme.com", marketing: true } });
    const off = validateContact({ name: "Ann", email: "ann@acme.com", company: "Acme", website: "acme.com" });
    assert.ok(off.ok && off.contact.marketing === false);
  });
});

describe("status machine", () => {
  test("prospect may only submit a draft; admin may move between any statuses", () => {
    assert.equal(canTransition("draft", "submitted", "prospect"), true);
    assert.equal(canTransition("submitted", "draft", "prospect"), false);
    assert.equal(canTransition("draft", "draft", "prospect"), false);
    assert.equal(canTransition("submitted", "draft", "admin"), true);
    assert.equal(canTransition("submitted", "quoted", "admin"), true);
    assert.equal(canTransition("draft", "won", "admin"), true);
    assert.equal(canTransition("draft", "banana", "admin"), false);
    assert.equal(canTransition("banana", "draft", "admin"), false);
  });

  test("isLocked is false only for draft", () => {
    assert.equal(isLocked("draft"), false);
    for (const s of ["submitted", "with-summit", "quoted", "won", "lost"]) assert.equal(isLocked(s), true, s);
  });
});

describe("token purposes", () => {
  const SECRET = "test-secret";
  const NOW = 1_800_000_000;

  test("a brief-link token round trips, fails on another purpose, and expires after 30 days", () => {
    const token = signToken(SECRET, BRIEF_LINK_PURPOSE, { b: "brief_0123456789abcdef" }, NOW);
    const ok = verifyToken(SECRET, BRIEF_LINK_PURPOSE, token, { nowSeconds: NOW, maxAgeSeconds: BRIEF_LINK_MAX_AGE_SECONDS });
    assert.ok(ok.ok && ok.claims.b === "brief_0123456789abcdef");
    for (const purpose of [BRIEF_DELETE_PURPOSE, "saved-link", "unlock-cookie"]) {
      const r = verifyToken(SECRET, purpose, token);
      assert.ok(!r.ok && r.reason === "purpose", purpose);
    }
    const atLimit = verifyToken(SECRET, BRIEF_LINK_PURPOSE, token, { nowSeconds: NOW + BRIEF_LINK_MAX_AGE_SECONDS, maxAgeSeconds: BRIEF_LINK_MAX_AGE_SECONDS });
    assert.equal(atLimit.ok, true);
    const after = verifyToken(SECRET, BRIEF_LINK_PURPOSE, token, { nowSeconds: NOW + BRIEF_LINK_MAX_AGE_SECONDS + 1, maxAgeSeconds: BRIEF_LINK_MAX_AGE_SECONDS });
    assert.ok(!after.ok && after.reason === "expired");
  });

  test("a brief-delete token round trips, fails as the 1b delete purpose, and never expires", () => {
    const tenYears = 10 * 365 * 24 * 60 * 60;
    const token = signToken(SECRET, BRIEF_DELETE_PURPOSE, { eh: "abc" }, NOW - tenYears);
    const ok = verifyToken(SECRET, BRIEF_DELETE_PURPOSE, token, { nowSeconds: NOW });
    assert.ok(ok.ok && ok.claims.eh === "abc");
    const r = verifyToken(SECRET, "delete", token);
    assert.ok(!r.ok && r.reason === "purpose");
  });
});

describe("normaliseSourceTag", () => {
  test("lowercases, allows [a-z0-9_-] up to 40, else empty", () => {
    assert.equal(normaliseSourceTag("LinkedIn-Ad_1"), "linkedin-ad_1");
    assert.equal(normaliseSourceTag("has space"), "");
    assert.equal(normaliseSourceTag("x".repeat(41)), "");
    assert.equal(normaliseSourceTag(undefined), "");
  });
});
