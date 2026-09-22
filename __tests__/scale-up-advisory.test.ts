/**
 * Scale-Up Advisory: two routes (fractional executive + outsourced sales).
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import * as content from "../app/scale-up-advisory/scale-up-content.ts";
import {
  DATE_MODIFIED,
  FRACTIONAL_EXEC_PATH,
  FRACTIONAL_FAQS,
  LEAD_ENGINE,
  OUTSOURCED_ANCHOR_ID,
  OUTSOURCED_FAQS,
  PACKAGE_COUNT,
  PACKAGE_STAGES,
  ROUTES,
  TOOL_STAGE_MAP,
  fractionalFaqSchema,
  fractionalServiceSchema,
  scaleUpFaqSchema,
  scaleUpServiceSchema,
} from "../app/scale-up-advisory/scale-up-content.ts";
import { TOOL_SEO, TOOL_SLUGS, isToolPublic } from "../app/tools/[tool]/toolSlugs.ts";
import sitemap from "../app/sitemap.ts";

const BASE = "https://summitstrategyadvisory.com";

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);

  test("includes both scale-up pages", () => {
    assert.ok(urls.includes(`${BASE}/scale-up-advisory`));
    assert.ok(urls.includes(`${BASE}/scale-up-advisory/fractional-executive`));
  });

  test("has no duplicate URLs", () => {
    assert.equal(new Set(urls).size, urls.length);
  });
});

describe("routes", () => {
  test("there are exactly two routes", () => {
    assert.equal(ROUTES.length, 2);
  });

  test("route 1 links to the fractional executive page", () => {
    assert.equal(ROUTES[0].id, "fractional-executive");
    assert.equal(ROUTES[0].href, FRACTIONAL_EXEC_PATH);
    assert.equal(FRACTIONAL_EXEC_PATH, "/scale-up-advisory/fractional-executive");
  });

  test("route 2 links to the outsourced sales anchor", () => {
    assert.equal(ROUTES[1].id, "outsource-sales");
    assert.equal(ROUTES[1].href, `#${OUTSOURCED_ANCHOR_ID}`);
  });
});

describe("tool-to-stage map", () => {
  const slugs = TOOL_STAGE_MAP.map((t) => t.slug);
  const stageIds = PACKAGE_STAGES.map((s) => s.id);

  test("has five entries with unique slugs", () => {
    assert.equal(TOOL_STAGE_MAP.length, 5);
    assert.equal(new Set(slugs).size, 5);
  });

  test("every tool is public and links to its tool page", () => {
    for (const t of TOOL_STAGE_MAP) {
      assert.ok(isToolPublic(t.slug), `${t.slug} is not public`);
      assert.equal(t.href, `/tools/${t.slug}`);
    }
  });

  test("tool names match the tool SEO titles", () => {
    for (const t of TOOL_STAGE_MAP) {
      assert.equal(t.name, TOOL_SEO[t.slug].title.split(" —")[0]);
    }
  });

  test("every stage is a real package stage", () => {
    for (const t of TOOL_STAGE_MAP) {
      assert.ok(stageIds.includes(t.stage), `${t.stage} is not a package stage`);
    }
  });

  test("every public tool is mapped", () => {
    const publicSlugs = TOOL_SLUGS.filter((s) => isToolPublic(s));
    assert.deepEqual([...publicSlugs].sort(), [...slugs].sort());
  });
});

describe("packages", () => {
  test("stages are MAP, REACH, WIN, ONBOARD, KEEP, GROW in order", () => {
    assert.deepEqual(
      PACKAGE_STAGES.map((s) => s.id),
      ["MAP", "REACH", "WIN", "ONBOARD", "KEEP", "GROW"],
    );
  });

  test("there are nineteen packages", () => {
    assert.equal(PACKAGE_COUNT, 19);
  });

  test("the Lead Engine Build has six walk-away items", () => {
    assert.equal(LEAD_ENGINE.walkAway.length, 6);
  });
});

describe("service schemas", () => {
  const schemas = [
    ["scale-up", scaleUpServiceSchema],
    ["fractional", fractionalServiceSchema],
  ] as const;

  for (const [name, schema] of schemas) {
    test(`${name} schema is a schema.org Service`, () => {
      assert.equal(schema["@context"], "https://schema.org");
      assert.equal(schema["@type"], "Service");
    });

    test(`${name} schema is dated ${DATE_MODIFIED}`, () => {
      assert.equal(schema.dateModified, "2026-09-22");
    });

    test(`${name} schema url is absolute on the Summit domain`, () => {
      assert.ok(schema.url.startsWith(`${BASE}/`), schema.url);
    });
  }

  test("scale-up service type is not Management Consulting", () => {
    assert.notEqual(scaleUpServiceSchema.serviceType, "Management Consulting");
  });

  test("urls point at the right pages", () => {
    assert.equal(scaleUpServiceSchema.url, `${BASE}/scale-up-advisory`);
    assert.equal(fractionalServiceSchema.url, `${BASE}/scale-up-advisory/fractional-executive`);
  });
});

describe("FAQ schemas", () => {
  const cases = [
    ["outsourced", scaleUpFaqSchema, OUTSOURCED_FAQS],
    ["fractional", fractionalFaqSchema, FRACTIONAL_FAQS],
  ] as const;

  for (const [name, schema, faqs] of cases) {
    test(`${name} FAQPage mirrors its FAQ list`, () => {
      assert.equal(schema["@type"], "FAQPage");
      assert.equal(schema.mainEntity.length, faqs.length);
      schema.mainEntity.forEach((item, i) => {
        assert.equal(item["@type"], "Question");
        assert.ok(item.name.length > 0);
        assert.equal(item.name, faqs[i].q);
        assert.equal(item.acceptedAnswer["@type"], "Answer");
        assert.ok(item.acceptedAnswer.text.length > 0);
        assert.equal(item.acceptedAnswer.text, faqs[i].a);
      });
    });
  }
});

describe("copy hygiene", () => {
  const copy = JSON.stringify(content);

  test("deck typos are fixed", () => {
    for (const bad of ["guide by", "motion's", "rouge", "small team covers", "Management Consulting"]) {
      assert.ok(!copy.includes(bad), `copy contains "${bad}"`);
    }
  });

  test("em-dashes are kept to a minimum", () => {
    const count = (copy.match(/—/g) ?? []).length;
    assert.ok(count <= 3, `found ${count} em-dashes`);
  });
});
