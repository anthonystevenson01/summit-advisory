/**
 * The report access code: salt, hash, verify. Pure module, node:crypto only, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  ACCESS_CODE_MAX,
  ACCESS_CODE_MIN,
  hashAccessCode,
  isAcceptableAccessCode,
  newAccessCodeSalt,
  normaliseAccessCode,
  verifyAccessCode,
} from "../app/lib/tools/report-access.ts";

const SALT = "0123456789abcdef0123456789abcdef";

describe("hashAccessCode and verifyAccessCode", () => {
  test("a code hashed with a salt verifies; a different code or a different salt fails", () => {
    const hash = hashAccessCode("Gradeshow2026", SALT);
    assert.equal(verifyAccessCode("Gradeshow2026", { salt: SALT, hash }), true);
    assert.equal(verifyAccessCode("Gradeshow2027", { salt: SALT, hash }), false);
    assert.equal(verifyAccessCode("Gradeshow2026", { salt: "fedcba9876543210fedcba9876543210", hash }), false);
  });

  test("the hash is 64 hex characters and never equals or contains the code", () => {
    const hash = hashAccessCode("Gradeshow2026", SALT);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.notEqual(hash, "Gradeshow2026");
    assert.ok(!hash.includes("gradeshow2026"));
  });

  test("trim and case do not matter", () => {
    const hash = hashAccessCode(" Gradeshow2026 ", SALT);
    assert.equal(verifyAccessCode("gradeshow2026", { salt: SALT, hash }), true);
    assert.equal(hashAccessCode("gradeshow2026", SALT), hash);
    assert.equal(normaliseAccessCode("  AbC "), "abc");
  });

  test("an empty code never verifies and a malformed stored value fails without throwing", () => {
    const hash = hashAccessCode("", SALT);
    assert.equal(verifyAccessCode("", { salt: SALT, hash }), false);
    assert.equal(verifyAccessCode("   ", { salt: SALT, hash }), false);
    assert.equal(verifyAccessCode("Gradeshow2026", { hash }), false);
    assert.equal(verifyAccessCode("Gradeshow2026", { salt: SALT }), false);
    assert.equal(verifyAccessCode("Gradeshow2026", null), false);
    assert.equal(verifyAccessCode("Gradeshow2026", { salt: SALT, hash: "zz" }), false);
    assert.equal(verifyAccessCode(42, { salt: SALT, hash }), false);
  });
});

describe("isAcceptableAccessCode and newAccessCodeSalt", () => {
  test("4 to 64 characters", () => {
    assert.equal(ACCESS_CODE_MIN, 4);
    assert.equal(ACCESS_CODE_MAX, 64);
    assert.equal(isAcceptableAccessCode("abc"), false);
    assert.equal(isAcceptableAccessCode("abcd"), true);
    assert.equal(isAcceptableAccessCode("a".repeat(64)), true);
    assert.equal(isAcceptableAccessCode("a".repeat(65)), false);
    assert.equal(isAcceptableAccessCode(1234), false);
  });

  test("a salt is 32 hex characters and two calls differ", () => {
    const a = newAccessCodeSalt();
    const b = newAccessCodeSalt();
    assert.match(a, /^[0-9a-f]{32}$/);
    assert.notEqual(a, b);
  });
});
