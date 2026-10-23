/**
 * Registry invariants: the single description of every tool.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  PUBLIC_TOOLS,
  TOOLS,
  TOOL_SLUGS,
  getTool,
  isToolHidden,
  isToolPublic,
  isToolSlug,
} from "../app/lib/tools/registry.ts";

describe("registry", () => {
  test("slugs are unique", () => {
    assert.equal(new Set(TOOL_SLUGS).size, TOOL_SLUGS.length);
  });

  test("public tools are numbered 01 to 05 in array order", () => {
    assert.deepEqual(
      PUBLIC_TOOLS.map((t) => t.number),
      ["01", "02", "03", "04", "05"],
    );
    assert.deepEqual(
      PUBLIC_TOOLS.map((t) => t.slug),
      ["icp", "persona", "problem", "positioning", "moat"],
    );
  });

  test("account is hidden and absent from the public list", () => {
    assert.equal(isToolHidden("account"), true);
    assert.equal(isToolPublic("account"), false);
    assert.ok(!PUBLIC_TOOLS.some((t) => t.slug === "account"));
  });

  test("weights per public tool sum to 1 within 0.001", () => {
    for (const tool of PUBLIC_TOOLS) {
      const sum = tool.dimensions.reduce((s, d) => s + d.weight, 0);
      assert.ok(Math.abs(sum - 1) < 0.001, `${tool.slug} weights sum to ${sum}`);
    }
  });

  test("dimension keys are unique within each tool", () => {
    for (const tool of TOOLS) {
      const keys = tool.dimensions.map((d) => d.key);
      assert.equal(new Set(keys).size, keys.length, `${tool.slug} has duplicate dimension keys`);
    }
  });

  test("ICP carries its seven dimensions and weights", () => {
    const icp = getTool("icp");
    assert.ok(icp);
    assert.deepEqual(
      icp.dimensions.map((d) => [d.key, d.weight]),
      [["bca", 0.25], ["pa", 0.18], ["usp", 0.15], ["it", 0.15], ["cd", 0.12], ["nf", 0.1], ["fs", 0.05]],
    );
  });

  test("every public tool has inputs with examples, a role and a full seo block", () => {
    for (const tool of PUBLIC_TOOLS) {
      assert.ok(tool.inputs.length > 0, `${tool.slug} has no inputs`);
      for (const input of tool.inputs) {
        assert.ok(input.example.length > 0, `${tool.slug}.${input.key} has no example`);
        assert.ok(input.example.length <= input.maxLength, `${tool.slug}.${input.key} example is too long`);
        assert.ok(input.example.length >= input.minLength, `${tool.slug}.${input.key} example is too short`);
      }
      assert.ok(tool.role.length > 0, `${tool.slug} has no role`);
      assert.ok(tool.seo.title.length > 0);
      assert.ok(tool.seo.description.length > 0);
      assert.ok(tool.seo.about.length > 0);
      assert.ok(tool.seo.howItWorks.length > 0);
      assert.ok(tool.seo.faqs.length > 0);
      assert.equal(tool.seo.canonical, `https://summitstrategyadvisory.com/tools/${tool.slug}`);
      assert.ok(tool.buttonLabel.length > 0);
      assert.ok(tool.cta.heading.length > 0 && tool.cta.body.length > 0);
    }
  });

  test("every dimension has five level labels and a standard", () => {
    for (const tool of PUBLIC_TOOLS) {
      for (const d of tool.dimensions) {
        for (const level of [1, 2, 3, 4, 5] as const) {
          assert.ok(d.levels[level]?.length > 0, `${tool.slug}.${d.key} level ${level} is missing`);
        }
        assert.ok(d.standard.length > 0, `${tool.slug}.${d.key} has no standard`);
      }
    }
  });

  test("every legacyLabel map has keys 1 to 5", () => {
    for (const tool of TOOLS) {
      if (!tool.legacyLabel) continue;
      assert.deepEqual(Object.keys(tool.legacyLabel).sort(), ["1", "2", "3", "4", "5"]);
    }
    const moat = getTool("moat");
    assert.deepEqual(moat?.legacyLabel, { 5: "Strong", 4: "Moderate", 3: "Thin", 2: "Thin", 1: "Exposed" });
  });

  test("extra keys are unique within each tool", () => {
    for (const tool of TOOLS) {
      const keys = tool.extras.map((x) => x.key);
      assert.equal(new Set(keys).size, keys.length, `${tool.slug} has duplicate extras`);
    }
  });

  test("slug helpers", () => {
    assert.equal(isToolSlug("moat"), true);
    assert.equal(isToolSlug("banana"), false);
    assert.equal(isToolPublic("moat"), true);
    assert.equal(getTool("banana"), undefined);
  });
});
