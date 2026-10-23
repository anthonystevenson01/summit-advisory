/**
 * GTM Toolkit: hub tool cards from the registry, newsletter issues.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { PUBLIC_TOOLS, isToolPublic } from "../app/lib/tools/registry.ts";
import { ISSUES } from "../app/components/newsletter/data/issues.ts";

// ─── hub cards (01 to 05 from the registry; Account is a separate hidden section) ─

describe("Hub cards", () => {
  test("come from PUBLIC_TOOLS in order icp, persona, problem, positioning, moat", () => {
    assert.deepEqual(
      PUBLIC_TOOLS.map((t) => t.slug),
      ["icp", "persona", "problem", "positioning", "moat"],
    );
  });

  test("are numbered 01 to 05", () => {
    assert.deepEqual(
      PUBLIC_TOOLS.map((t) => t.number),
      ["01", "02", "03", "04", "05"],
    );
  });

  test("each card has a name, tagline and output description", () => {
    for (const tool of PUBLIC_TOOLS) {
      assert.ok(tool.name);
      assert.ok(tool.tagline);
      assert.ok(tool.outputDescription);
    }
  });

  test("every hub card links to a public tool route", () => {
    for (const tool of PUBLIC_TOOLS) {
      assert.ok(isToolPublic(tool.slug), `/tools/${tool.slug} is not a public tool route`);
    }
  });

  test("account is absent from PUBLIC_TOOLS", () => {
    assert.ok(!PUBLIC_TOOLS.some((t) => t.slug === "account"), "account is a hidden tool");
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
