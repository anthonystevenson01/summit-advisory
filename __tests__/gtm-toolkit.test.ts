/**
 * GTM Toolkit: hub tool cards from the registry, newsletter issues.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  PUBLIC_TOOLS,
  PUBLIC_TOOL_COUNT_WORD,
  PUBLIC_TOOL_COUNT_WORD_CAPITALISED,
  TOOLS,
  isToolPublic,
} from "../app/lib/tools/registry.ts";
import { BUILDER_BLOCK, CONTACT_EMAIL, ENTRY_PATHS, HOW_IT_WORKS, HUB_INTRO, HUB_LEAD, HUB_TAG, HUB_TITLE, itemListSchema } from "../app/tools/hub-copy.ts";
import { HUB_TOOLS } from "../app/scale-up-advisory/scale-up-content.ts";
import sitemap from "../app/sitemap.ts";
import { ISSUES } from "../app/components/newsletter/data/issues.ts";

// ─── hub cards (public tools from the registry; Account is a separate hidden section) ─

describe("Hub cards", () => {
  test("come from PUBLIC_TOOLS, the registry entries that are not hidden, in order", () => {
    assert.deepEqual(
      PUBLIC_TOOLS.map((t) => t.slug),
      TOOLS.filter((t) => !t.hidden).map((t) => t.slug),
    );
  });

  test("are numbered contiguously from 01", () => {
    assert.deepEqual(
      PUBLIC_TOOLS.map((t) => t.number),
      PUBLIC_TOOLS.map((_, i) => String(i + 1).padStart(2, "0")),
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

  test("Unit of Value is in PUBLIC_TOOLS and Route to Buyer is not", () => {
    assert.ok(PUBLIC_TOOLS.some((t) => t.slug === "unit-of-value"), "unit-of-value is a public tool");
    assert.ok(!PUBLIC_TOOLS.some((t) => t.slug === "route-to-buyer"), "route-to-buyer is hidden pending calibration");
  });
});

// ─── count copy ───────────────────────────────────────────────────────────────

describe("Count copy derives from the registry", () => {
  test("the hub lead, tag and title carry the capitalised count word", () => {
    assert.ok(HUB_LEAD.startsWith(PUBLIC_TOOL_COUNT_WORD_CAPITALISED), HUB_LEAD);
    assert.equal(HUB_TAG, `${PUBLIC_TOOL_COUNT_WORD_CAPITALISED} Free Tools`);
    assert.ok(HUB_TITLE.includes(PUBLIC_TOOL_COUNT_WORD_CAPITALISED), HUB_TITLE);
  });

  test("the ItemList counts and lists the public tools", () => {
    assert.equal(itemListSchema.numberOfItems, PUBLIC_TOOLS.length);
    assert.equal(itemListSchema.itemListElement.length, PUBLIC_TOOLS.length);
    assert.ok(itemListSchema.description.startsWith(PUBLIC_TOOL_COUNT_WORD_CAPITALISED));
  });

  test("the sitemap lists every public tool and no hidden one", () => {
    const urls = sitemap().map((e) => e.url);
    for (const tool of PUBLIC_TOOLS) {
      assert.ok(urls.includes(tool.seo.canonical), `${tool.slug} is missing from the sitemap`);
    }
    for (const tool of TOOLS.filter((t) => t.hidden)) {
      assert.ok(!urls.includes(`https://summitstrategyadvisory.com/tools/${tool.slug}`), `${tool.slug} is hidden but in the sitemap`);
    }
  });

  test("the scale-up hub copy carries the count word", () => {
    assert.ok(HUB_TOOLS.body.includes(PUBLIC_TOOL_COUNT_WORD), HUB_TOOLS.body);
    assert.ok(HUB_TOOLS.hubLink.includes(PUBLIC_TOOL_COUNT_WORD), HUB_TOOLS.hubLink);
  });
});

// ─── three paths and method copy ─────────────────────────────────────────────

describe("Three paths and method copy", () => {
  const DASH_RE = /[\u2013\u2014]| - /;

  test("ENTRY_PATHS has the three titles, hrefs and the coming next flag", () => {
    assert.deepEqual(ENTRY_PATHS.map((p) => p.title), ["Use a tool", "Score your own model", "Ask Summit to score it"]);
    assert.equal(ENTRY_PATHS[0].href, "#tools");
    assert.equal(ENTRY_PATHS[1].href, "/tools/built-to-scale");
    assert.ok(ENTRY_PATHS[2].href.startsWith(`mailto:${CONTACT_EMAIL}`), ENTRY_PATHS[2].href);
    assert.equal(ENTRY_PATHS[2].comingNext, true);
    assert.equal(ENTRY_PATHS[0].comingNext, undefined);
    assert.equal(ENTRY_PATHS[1].comingNext, undefined);
    assert.ok(ENTRY_PATHS[0].body.startsWith(PUBLIC_TOOL_COUNT_WORD_CAPITALISED), ENTRY_PATHS[0].body);
    for (const p of ENTRY_PATHS) assert.ok(p.cta.length > 0);
  });

  test("HOW_IT_WORKS has three steps numbered 01 to 03", () => {
    assert.deepEqual(HOW_IT_WORKS.map((s) => s.num), ["01", "02", "03"]);
    for (const step of HOW_IT_WORKS) assert.ok(step.title.length > 0 && step.body.length > 0);
  });

  test("the hub copy carries no dashes and the lead still opens with the count word", () => {
    for (const text of [HUB_LEAD, HUB_INTRO, ...HOW_IT_WORKS.map((s) => s.body), ...ENTRY_PATHS.map((p) => p.body)]) {
      assert.doesNotMatch(text, DASH_RE, text);
    }
    assert.ok(HUB_LEAD.startsWith(PUBLIC_TOOL_COUNT_WORD_CAPITALISED));
  });

  test("the sitemap lists the Built to Scale? page and its method page", () => {
    const urls = sitemap().map((e) => e.url);
    assert.ok(urls.includes("https://summitstrategyadvisory.com/tools/built-to-scale"));
    assert.ok(urls.includes("https://summitstrategyadvisory.com/tools/built-to-scale/method"));
  });
});

// ─── Project Builder block ────────────────────────────────────────────────────

describe("Project Builder block", () => {
  const DASH_RE = /[\u2013\u2014]| - /;

  test("links to the builder and carries no dash", () => {
    assert.equal(BUILDER_BLOCK.href, "/project-builder");
    assert.doesNotMatch(BUILDER_BLOCK.title, DASH_RE);
    assert.doesNotMatch(BUILDER_BLOCK.body, DASH_RE);
    assert.ok(BUILDER_BLOCK.cta.length > 0);
  });

  test("the sitemap lists the builder at its own address and not the old one", () => {
    const entries = sitemap();
    const entry = entries.find((e) => e.url === "https://summitstrategyadvisory.com/project-builder");
    assert.ok(entry, "the sitemap does not list /project-builder");
    assert.equal(entry.priority, 0.8);
    assert.ok(!entries.some((e) => e.url === "https://summitstrategyadvisory.com/tools/project-builder"));
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
