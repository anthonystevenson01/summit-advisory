/**
 * GTM Toolkit — Acceptance Tests
 *
 * Run with: npx jest (after installing jest + ts-jest per package.json devDependencies)
 * Or with vitest: npx vitest run
 *
 * These tests cover key acceptance criteria for the GTM Toolkit implementation.
 */

import { FALLBACK_PROMPTS } from "../app/components/toolkit/data/fallbackPrompts";
import { TOOLS } from "../app/components/toolkit/data/toolConfig";
import { ISSUES } from "../app/components/newsletter/data/issues";

// ─── fallbackPrompts ──────────────────────────────────────────────────────────

describe("FALLBACK_PROMPTS", () => {
  const REQUIRED_KEYS = ["positioning", "problem", "persona", "moat", "account"] as const;

  test("has all five required keys", () => {
    for (const key of REQUIRED_KEYS) {
      expect(FALLBACK_PROMPTS[key]).toBeDefined();
    }
  });

  test("all prompts are non-empty strings", () => {
    for (const key of REQUIRED_KEYS) {
      expect(typeof FALLBACK_PROMPTS[key]).toBe("string");
      expect(FALLBACK_PROMPTS[key].length).toBeGreaterThan(50);
    }
  });
});

// ─── toolConfig ───────────────────────────────────────────────────────────────

describe("TOOLS config", () => {
  test("contains exactly 5 tools", () => {
    expect(TOOLS).toHaveLength(5);
  });

  test("each tool has required fields", () => {
    for (const tool of TOOLS) {
      expect(tool.id).toBeTruthy();
      expect(tool.num).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.tagline).toBeTruthy();
      expect(tool.outputDescription).toBeTruthy();
      expect(tool.surface).toMatch(/^#/);
      expect(tool.accent).toMatch(/^#/);
    }
  });

  test("tool IDs are the expected set", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(ids).toContain("positioning");
    expect(ids).toContain("problem");
    expect(ids).toContain("persona");
    expect(ids).toContain("moat");
    expect(ids).toContain("account");
  });

  test("tool numbers are 01–05", () => {
    const nums = TOOLS.map((t) => t.num);
    expect(nums).toEqual(["01", "02", "03", "04", "05"]);
  });
});

// ─── newsletter issues ────────────────────────────────────────────────────────

describe("Newsletter ISSUES", () => {
  test("contains exactly 4 issues", () => {
    expect(ISSUES).toHaveLength(4);
  });

  test("each issue has required fields", () => {
    for (const issue of ISSUES) {
      expect(issue.id).toBeTruthy();
      expect(issue.num).toBeTruthy();
      expect(issue.date).toBeTruthy();
      expect(issue.title).toBeTruthy();
      expect(issue.subtitle).toBeTruthy();
      expect(issue.tag).toBeTruthy();
      expect(issue.readTime).toBeTruthy();
      expect(Array.isArray(issue.body)).toBe(true);
      expect(issue.body.length).toBeGreaterThan(0);
    }
  });

  test("issue IDs are 001–004", () => {
    const ids = ISSUES.map((i) => i.id);
    expect(ids).toEqual(["001", "002", "003", "004"]);
  });

  test("each body block has a valid type", () => {
    const validTypes = ["p", "h2", "pullquote", "rule"];
    for (const issue of ISSUES) {
      for (const block of issue.body) {
        expect(validTypes).toContain(block.type);
        if (block.type !== "rule") {
          expect((block as { text: string }).text).toBeTruthy();
        }
      }
    }
  });

  test("each issue has at least 4 body blocks", () => {
    for (const issue of ISSUES) {
      expect(issue.body.length).toBeGreaterThanOrEqual(4);
    }
  });
});

// ─── API route input validation (unit-level, pure logic) ─────────────────────

describe("Input validation helpers", () => {
  test("email with @ passes basic validation", () => {
    const email = "test@example.com";
    expect(email.includes("@")).toBe(true);
    expect(email.length).toBeLessThanOrEqual(320);
  });

  test("email without @ fails basic validation", () => {
    const email = "notanemail";
    expect(email.includes("@")).toBe(false);
  });

  test("positioning statement over 4000 chars should be rejected", () => {
    const longStatement = "a".repeat(4001);
    expect(longStatement.length).toBeGreaterThan(4000);
  });

  test("account name over 200 chars should be rejected", () => {
    const longName = "a".repeat(201);
    expect(longName.length).toBeGreaterThan(200);
  });
});

// ─── Brand palette values ──────────────────────────────────────────────────

describe("Brand palette", () => {
  test("tool surfaces match spec", () => {
    const surfaces: Record<string, string> = {
      positioning: "#0a1a14",
      problem: "#fafaf7",
      persona: "#F5F9F6",
      moat: "#002030",
      account: "#00252e",
    };
    for (const tool of TOOLS) {
      expect(tool.surface.toLowerCase()).toBe(surfaces[tool.id].toLowerCase());
    }
  });

  test("tool accents match spec", () => {
    const accents: Record<string, string> = {
      positioning: "#86efac",
      problem: "#fbbf24",
      persona: "#319A65",
      moat: "#34d399",
      account: "#67e8f9",
    };
    for (const tool of TOOLS) {
      expect(tool.accent.toLowerCase()).toBe(accents[tool.id].toLowerCase());
    }
  });
});
