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
  PUBLIC_TOOL_COUNT,
  PUBLIC_TOOL_COUNT_WORD,
  PUBLIC_TOOL_COUNT_WORD_CAPITALISED,
  TOOLS,
  TOOL_SLUGS,
  countWord,
  getTool,
  isToolHidden,
  isToolPublic,
  isToolSlug,
} from "../app/lib/tools/registry.ts";

/** Every entry that is scored: hidden entries are held to the same invariants as public ones. */
const SCORED_TOOLS = TOOLS.filter((t) => t.dimensions.length > 0);

describe("registry", () => {
  test("slugs are unique", () => {
    assert.equal(new Set(TOOL_SLUGS).size, TOOL_SLUGS.length);
  });

  test("public tools are numbered contiguously from 01 in array order", () => {
    // Flipping one Release 2 tool alone would leave a gap (01 to 05 then 07) and fail here on purpose:
    // flip both, or renumber, rather than ship a card that reads Tool 07 with no 06.
    assert.deepEqual(
      PUBLIC_TOOLS.map((t) => t.number),
      PUBLIC_TOOLS.map((_, i) => String(i + 1).padStart(2, "0")),
      "public tool numbers must run 01, 02, ... with no gap",
    );
    assert.deepEqual(
      PUBLIC_TOOLS.map((t) => t.slug),
      TOOLS.filter((t) => !t.hidden).map((t) => t.slug),
    );
  });

  test("TOOLS is in the agreed order", () => {
    assert.deepEqual(
      TOOLS.map((t) => t.slug),
      ["icp", "persona", "problem", "positioning", "moat", "route-to-buyer", "unit-of-value", "account"],
    );
  });

  test("the Release 2 tools are hidden and numbered 06 and 07", () => {
    const expected = [
      {
        slug: "route-to-buyer",
        number: "06",
        dims: ["bi", "ch", "gk", "ba", "sc", "cw"],
        weights: [0.2, 0.2, 0.15, 0.1, 0.15, 0.2],
        inputs: ["buyer", "route", "cycle", "channels"],
        extras: ["gatekeeperRisk", "channelMove"],
        feeds: ["routeToBuyer"],
      },
      {
        slug: "unit-of-value",
        number: "07",
        dims: ["ud", "cu", "mv", "rr", "vg", "cb"],
        weights: [0.2, 0.2, 0.2, 0.15, 0.1, 0.15],
        inputs: ["delivery", "pricing", "cost", "renewal"],
        extras: ["ceilingInputs", "lever"],
        feeds: ["unitOfValue"],
      },
    ] as const;

    for (const want of expected) {
      const tool = getTool(want.slug);
      assert.ok(tool, `${want.slug} is in the registry`);
      assert.equal(tool.hidden, true);
      assert.equal(isToolHidden(want.slug), true);
      assert.equal(isToolPublic(want.slug), false);
      assert.ok(!PUBLIC_TOOLS.some((t) => t.slug === want.slug), `${want.slug} is absent from PUBLIC_TOOLS`);
      assert.equal(tool.number, want.number);
      assert.equal(tool.dimensions.length, 6);
      assert.deepEqual(tool.dimensions.map((d) => d.key), [...want.dims]);
      assert.deepEqual(tool.dimensions.map((d) => d.weight), [...want.weights]);
      const sum = tool.dimensions.reduce((s, d) => s + d.weight, 0);
      assert.ok(Math.abs(sum - 1) < 0.001, `${want.slug} weights sum to ${sum}`);
      for (const d of tool.dimensions) {
        for (const level of [1, 2, 3, 4, 5] as const) {
          assert.ok(d.levels[level]?.length > 0, `${want.slug}.${d.key} level ${level} is missing`);
        }
        assert.ok(d.standard.length > 0, `${want.slug}.${d.key} has no standard`);
      }
      assert.deepEqual(tool.inputs.map((i) => i.key), [...want.inputs]);
      for (const input of tool.inputs) {
        assert.ok(input.example.length >= input.minLength && input.example.length <= input.maxLength, `${want.slug}.${input.key} example is out of bounds`);
      }
      assert.deepEqual(tool.extras.map((x) => x.key), [...want.extras]);
      assert.deepEqual(tool.feeds, [...want.feeds]);
      assert.ok(tool.role.length > 0);
      assert.ok(tool.seo.title.length > 0 && tool.seo.description.length > 0 && tool.seo.about.length > 0);
      assert.ok(tool.seo.howItWorks.length > 0 && tool.seo.faqs.length > 0);
      assert.equal(tool.seo.canonical, `https://summitstrategyadvisory.com/tools/${want.slug}`);
    }

    const ceiling = getTool("unit-of-value")?.extras.find((x) => x.key === "ceilingInputs");
    assert.equal(ceiling?.kind, "ceiling");
    assert.equal(getTool("route-to-buyer")?.extras.every((x) => x.kind === "text"), true);
  });

  test("count helpers derive from PUBLIC_TOOLS", () => {
    assert.equal(countWord(5), "five");
    assert.equal(countWord(7, true), "Seven");
    assert.equal(countWord(0), "zero");
    assert.equal(countWord(13), "13");
    assert.equal(PUBLIC_TOOL_COUNT, PUBLIC_TOOLS.length);
    assert.equal(PUBLIC_TOOL_COUNT_WORD, countWord(PUBLIC_TOOL_COUNT));
    assert.equal(PUBLIC_TOOL_COUNT_WORD_CAPITALISED, countWord(PUBLIC_TOOL_COUNT, true));
  });

  test("account is hidden and absent from the public list", () => {
    assert.equal(isToolHidden("account"), true);
    assert.equal(isToolPublic("account"), false);
    assert.ok(!PUBLIC_TOOLS.some((t) => t.slug === "account"));
  });

  test("weights per scored tool sum to 1 within 0.001", () => {
    for (const tool of SCORED_TOOLS) {
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

  test("every scored tool has inputs with examples, a role and a full seo block", () => {
    for (const tool of SCORED_TOOLS) {
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
    for (const tool of SCORED_TOOLS) {
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
