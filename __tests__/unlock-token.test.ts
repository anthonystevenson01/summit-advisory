/**
 * Signed tokens: sign, verify, tamper, expiry, purpose and the email hash.
 * Pure module, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { hashEmail, signToken, verifyToken } from "../app/lib/tools/unlock-token.ts";

const SECRET = "test-secret-0123456789abcdef";
const NOW = 1_800_000_000;
const MAX_AGE = 30 * 24 * 60 * 60;

describe("signToken and verifyToken", () => {
  test("a signed token verifies with the same secret and purpose and returns the claims", () => {
    const token = signToken(SECRET, "unlock-cookie", { eh: "abc" }, NOW);
    const r = verifyToken(SECRET, "unlock-cookie", token, { nowSeconds: NOW, maxAgeSeconds: MAX_AGE });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.claims, { iat: NOW, eh: "abc" });
  });

  test("the same inputs always produce the same token", () => {
    assert.equal(
      signToken(SECRET, "saved-link", { run: "run_0123456789abcdef" }, NOW),
      signToken(SECRET, "saved-link", { run: "run_0123456789abcdef" }, NOW),
    );
  });

  test("a changed payload character fails with signature", () => {
    const token = signToken(SECRET, "unlock-cookie", { eh: "abc" }, NOW);
    const [payload, sig] = token.split(".");
    // Flip the last payload character to another base64url character.
    const last = payload[payload.length - 1];
    const changed = payload.slice(0, -1) + (last === "A" ? "B" : "A");
    const r = verifyToken(SECRET, "unlock-cookie", `${changed}.${sig}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.reason === "signature" || r.reason === "malformed");
  });

  test("a changed signature character fails with signature", () => {
    const token = signToken(SECRET, "unlock-cookie", { eh: "abc" }, NOW);
    const [payload, sig] = token.split(".");
    const last = sig[sig.length - 1];
    const changed = sig.slice(0, -1) + (last === "A" ? "B" : "A");
    const r = verifyToken(SECRET, "unlock-cookie", `${payload}.${changed}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "signature");
  });

  test("verifies at iat plus maxAge and fails with expired one second later", () => {
    const token = signToken(SECRET, "unlock-cookie", { eh: "abc" }, NOW);
    const atLimit = verifyToken(SECRET, "unlock-cookie", token, { nowSeconds: NOW + MAX_AGE, maxAgeSeconds: MAX_AGE });
    assert.equal(atLimit.ok, true);
    const after = verifyToken(SECRET, "unlock-cookie", token, { nowSeconds: NOW + MAX_AGE + 1, maxAgeSeconds: MAX_AGE });
    assert.equal(after.ok, false);
    if (!after.ok) assert.equal(after.reason, "expired");
  });

  test("another secret fails with signature", () => {
    const token = signToken(SECRET, "unlock-cookie", { eh: "abc" }, NOW);
    const r = verifyToken("other-secret", "unlock-cookie", token);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "signature");
  });

  test("a saved-link token fails for unlock-cookie with purpose", () => {
    const token = signToken(SECRET, "saved-link", { run: "run_0123456789abcdef" }, NOW);
    const r = verifyToken(SECRET, "unlock-cookie", token);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "purpose");
  });

  test("no maxAgeSeconds accepts a token ten years old", () => {
    const tenYears = 10 * 365 * 24 * 60 * 60;
    const token = signToken(SECRET, "delete", { eh: "abc" }, NOW - tenYears);
    const r = verifyToken(SECRET, "delete", token, { nowSeconds: NOW });
    assert.equal(r.ok, true);
  });

  test("malformed for no dot, empty string, non-JSON payload and a non-string", () => {
    for (const bad of ["nodot", "", ".", "abc.", ".abc", `${Buffer.from("not json").toString("base64url")}.sig`]) {
      const r = verifyToken(SECRET, "unlock-cookie", bad);
      assert.equal(r.ok, false, JSON.stringify(bad));
      if (!r.ok) assert.equal(r.reason, "malformed", JSON.stringify(bad));
    }
    const r = verifyToken(SECRET, "unlock-cookie", 42);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "malformed");
  });

  test("a payload with the wrong version or a non-integer iat is malformed even when signed", () => {
    const mk = (obj: Record<string, unknown>) => {
      const payload = Buffer.from(JSON.stringify(obj));
      const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
      return `${payload.toString("base64url")}.${sig}`;
    };
    const wrongV = verifyToken(SECRET, "unlock-cookie", mk({ v: 2, p: "unlock-cookie", iat: NOW }));
    assert.equal(wrongV.ok, false);
    if (!wrongV.ok) assert.equal(wrongV.reason, "malformed");
    const badIat = verifyToken(SECRET, "unlock-cookie", mk({ v: 1, p: "unlock-cookie", iat: "soon" }));
    assert.equal(badIat.ok, false);
    if (!badIat.ok) assert.equal(badIat.reason, "malformed");
  });
});

describe("hashEmail", () => {
  test("is case and whitespace insensitive and 64 hex characters", () => {
    const a = hashEmail("Ann@Example.com");
    const b = hashEmail("  ann@example.com \n");
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.notEqual(a, hashEmail("bob@example.com"));
  });
});
