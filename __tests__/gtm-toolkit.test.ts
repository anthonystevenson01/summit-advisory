/**
 * GTM Toolkit: fallback prompts, hub tool cards, newsletter issues, palette.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 *
 * The former "Input validation helpers" suite was removed: it only asserted on
 * string literals built inside the test and exercised no production code.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { FALLBACK_PROMPTS } from "../app/components/toolkit/data/fallbackPrompts.ts";
import { TOOLS } from "../app/components/toolkit/data/toolConfig.ts";
import { ISSUES } from "../app/components/newsletter/data/issues.ts";
import { isToolPublic } from "../app/tools/[tool]/toolSlugs.ts";

// ─── fallbackPrompts ──────────────────────────────────────────────────────────

describe("FALLBACK_PROMPTS", () => {
  const REQUIRED_KEYS = ["positioning", "problem", "persona", "moat", "account"] as const;

  test("has all five required keys", () => {
    for (const key of REQUIRED_KEYS) {
      assert.notEqual(FALLBACK_PROMPTS[key], undefined, `missing prompt: ${key}`);
    }
  });

  test("all prompts are non-empty strings", () => {
    for (const key of REQUIRED_KEYS) {
      assert.equal(typeof FALLBACK_PROMPTS[key], "string");
      assert.ok(FALLBACK_PROMPTS[key].length > 50, `prompt too short: ${key}`);
    }
  });
});

// ─── toolConfig (hub cards 02–05; ICP card 01 and Account are rendered separately) ─

describe("TOOLS config", () => {
  test("contains exactly 4 tools", () => {
    assert.equal(TOOLS.length, 4);
  });

  test("each tool has required fields", () => {
    for (const tool of TOOLS) {
      assert.ok(tool.id);
      assert.ok(tool.num);
      assert.ok(tool.name);
      assert.ok(tool.tagline);
      assert.ok(tool.outputDescription);
      assert.match(tool.surface, /^#/);
      assert.match(tool.accent, /^#/);
    }
  });

  test("tool IDs are the expected set, in hub render order", () => {
    assert.deepEqual(
      TOOLS.map((t) => t.id),
      ["persona", "problem", "positioning", "moat"],
    );
  });

  test("tool numbers are 02–05", () => {
    assert.deepEqual(
      TOOLS.map((t) => t.num),
      ["02", "03", "04", "05"],
    );
  });

  test("every hub card links to a public tool route", () => {
    for (const tool of TOOLS) {
      assert.ok(isToolPublic(tool.id), `/tools/${tool.id} is not a public tool route`);
    }
  });

  test("ICP and Account are not duplicated in TOOLS", () => {
    const ids = TOOLS.map((t) => t.id);
    assert.ok(!ids.includes("icp"), "icp is rendered separately as card 01");
    assert.ok(!ids.includes("account"), "account is rendered as a separate section");
  });
});

// ─── newsletter issues ────────────────────────────────────────────────────────

describe("Newsletter ISSUES", () => {
  test("contains exactly 4 issues", () => {
    assert.equal(ISSUES.length, 4);
  });

  test("each issue has required fields", () => {
    for (const issue of ISSUES) {
      assert.ok(issue.id);
      assert.ok(issue.num);
      assert.ok(issue.date);
      assert.ok(issue.title);
      assert.ok(issue.subtitle);
      assert.ok(issue.tag);
      assert.ok(issue.readTime);
      assert.equal(Array.isArray(issue.body), true);
      assert.ok(issue.body.length > 0, `issue ${issue.id} has no body`);
    }
  });

  test("issue IDs are 001–004", () => {
    assert.deepEqual(
      ISSUES.map((i) => i.id),
      ["001", "002", "003", "004"],
    );
  });

  test("each body block has a valid type", () => {
    const validTypes = ["p", "h2", "pullquote", "rule"];
    for (const issue of ISSUES) {
      for (const block of issue.body) {
        assert.ok(validTypes.includes(block.type), `invalid block type: ${block.type}`);
        if (block.type !== "rule") {
          assert.ok((block as { text: string }).text);
        }
      }
    }
  });

  test("each issue has at least 4 body blocks", () => {
    for (const issue of ISSUES) {
      assert.ok(issue.body.length >= 4, `issue ${issue.id} has fewer than 4 body blocks`);
    }
  });
});

// ─── Brand palette values ──────────────────────────────────────────────────

describe("Brand palette", () => {
  test("tool surfaces match spec", () => {
    const surfaces: Record<string, string> = {
      persona: "#0a1a14",
      problem: "#0a1a14",
      positioning: "#0a1a14",
      moat: "#0a1a14",
    };
    for (const tool of TOOLS) {
      assert.equal(tool.surface.toLowerCase(), surfaces[tool.id]);
    }
  });

  test("tool accents match spec", () => {
    const accents: Record<string, string> = {
      persona: "#319a65",
      problem: "#319a65",
      positioning: "#319a65",
      moat: "#319a65",
    };
    for (const tool of TOOLS) {
      assert.equal(tool.accent.toLowerCase(), accents[tool.id]);
    }
  });
});
