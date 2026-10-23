/**
 * Input and unlock validation.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { getTool } from "../app/lib/tools/registry.ts";
import { renderInputs, validateInputs, validateUnlock } from "../app/lib/tools/validate.ts";

describe("validateUnlock", () => {
  test("missing company is rejected", () => {
    const r = validateUnlock({ name: "Ann", email: "ann@example.com" });
    assert.equal(r.ok, false);
  });

  test("a bad email is rejected", () => {
    const r = validateUnlock({ name: "Ann", email: "not-an-email", company: "Acme" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /valid email/);
  });

  test("the trimmed trio is returned", () => {
    const r = validateUnlock({ name: "  Ann ", email: " ann@example.com ", company: " Acme " });
    assert.deepEqual(r, { ok: true, name: "Ann", email: "ann@example.com", company: "Acme" });
  });

  test("a non-object body is rejected", () => {
    assert.equal(validateUnlock(null).ok, false);
    assert.equal(validateUnlock("x").ok, false);
  });
});

describe("validateInputs", () => {
  const moat = getTool("moat")!;
  const position = "A".repeat(60);

  test("a required input that is empty is rejected", () => {
    const r = validateInputs(moat, { competitors: "Acme" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /required/);
  });

  test("under minLength is rejected", () => {
    const r = validateInputs(moat, { position: "too short" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /at least 50/);
  });

  test("over maxLength is rejected", () => {
    const r = validateInputs(moat, { position: "A".repeat(6001) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /under/);
  });

  test("rubric and systemPrompt keys in the body are ignored", () => {
    const r = validateInputs(moat, { position, rubric: "secret", systemPrompt: "secret" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal("rubric" in r.inputs, false);
      assert.equal("systemPrompt" in r.inputs, false);
    }
  });

  test("unknown keys are dropped and values are trimmed", () => {
    const r = validateInputs(moat, { position: `  ${position}  `, foo: "bar", competitors: " Acme " });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(Object.keys(r.inputs).sort(), ["competitors", "position"]);
      assert.equal(r.inputs.position, position);
      assert.equal(r.inputs.competitors, "Acme");
    }
  });

  test("an optional empty input is accepted", () => {
    const r = validateInputs(moat, { position });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.inputs.competitors, "");
  });

  test("every public tool accepts its own examples", () => {
    for (const slug of ["icp", "persona", "problem", "positioning", "moat"]) {
      const tool = getTool(slug)!;
      const body: Record<string, string> = {};
      for (const input of tool.inputs) body[input.key] = input.example;
      assert.equal(validateInputs(tool, body).ok, true, slug);
    }
  });
});

describe("renderInputs", () => {
  test("labels each non-empty input and skips empty ones", () => {
    const moat = getTool("moat")!;
    const text = renderInputs(moat, { position: "We do X.", competitors: "" });
    assert.equal(text, "Your Competitive Position:\nWe do X.");
    const both = renderInputs(moat, { position: "We do X.", competitors: "Acme" });
    assert.equal(both, "Your Competitive Position:\nWe do X.\n\nKey Competitors:\nAcme");
  });
});
