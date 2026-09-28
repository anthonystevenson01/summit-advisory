/**
 * Scale-Up Advisory: the hub page and its two option pages (fractional
 * executive, outsourced sales).
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
  HUB_TOOLS,
  LEAD_ENGINE,
  OPTIONS,
  OUTSOURCED_FAQS,
  OUTSOURCED_SALES_PATH,
  PACKAGE_COUNT,
  PACKAGE_STAGES,
  SCALE_UP_PATH,
  TOOL_STAGE_MAP,
  fractionalFaqSchema,
  fractionalServiceSchema,
  outsourcedFaqSchema,
  outsourcedServiceSchema,
  scaleUpServiceSchema,
} from "../app/scale-up-advisory/scale-up-content.ts";
import { TOOL_SEO, TOOL_SLUGS, isToolPublic } from "../app/tools/[tool]/toolSlugs.ts";
import sitemap from "../app/sitemap.ts";
import nextConfig from "../next.config.ts";

const BASE = "https://summitstrategyadvisory.com";

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);

  test("includes the hub and both option pages", () => {
    assert.ok(urls.includes(`${BASE}/scale-up-advisory`));
    assert.ok(urls.includes(`${BASE}/scale-up-advisory/fractional-executive`));
    assert.ok(urls.includes(`${BASE}/scale-up-advisory/outsourced-sales`));
  });

  test("has no duplicate URLs", () => {
    assert.equal(new Set(urls).size, urls.length);
  });
});

describe("options", () => {
  test("there are exactly two options", () => {
    assert.equal(OPTIONS.length, 2);
  });

  test("option 1 links to the fractional executive page", () => {
    assert.equal(OPTIONS[0].id, "fractional-executive");
    assert.equal(OPTIONS[0].href, FRACTIONAL_EXEC_PATH);
    assert.equal(FRACTIONAL_EXEC_PATH, "/scale-up-advisory/fractional-executive");
  });

  test("option 2 links to the outsourced sales page", () => {
    assert.equal(OPTIONS[1].id, "outsource-sales");
    assert.equal(OPTIONS[1].href, OUTSOURCED_SALES_PATH);
    assert.equal(OUTSOURCED_SALES_PATH, "/scale-up-advisory/outsourced-sales");
  });

  test("every option is a page under the hub, not an in-page anchor", () => {
    assert.equal(SCALE_UP_PATH, "/scale-up-advisory");
    for (const o of OPTIONS) {
      assert.ok(o.href.startsWith(`${SCALE_UP_PATH}/`), o.href);
      assert.ok(!o.href.includes("#"), o.href);
    }
  });
});

describe("hub tools copy", () => {
  test("says Summit knows AI and that the tools are free", () => {
    const text = `${HUB_TOOLS.heading} ${HUB_TOOLS.body}`;
    assert.match(text, /\bAI\b/);
    assert.match(text, /\bfree\b/i);
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

  test("every tool has a summary and a stage note that names its stage", () => {
    for (const t of TOOL_STAGE_MAP) {
      assert.ok(t.summary.length > 0, `${t.slug} has no summary`);
      assert.ok(t.stageNote.length > 0, `${t.slug} has no stage note`);
      assert.ok(t.stageNote.includes(t.stage), `${t.slug} stage note does not name ${t.stage}`);
    }
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
    ["outsourced", outsourcedServiceSchema],
    ["fractional", fractionalServiceSchema],
  ] as const;

  for (const [name, schema] of schemas) {
    test(`${name} schema is a schema.org Service`, () => {
      assert.equal(schema["@context"], "https://schema.org");
      assert.equal(schema["@type"], "Service");
    });

    test(`${name} schema is dated ${DATE_MODIFIED}`, () => {
      assert.equal(schema.dateModified, "2026-09-24");
    });

    test(`${name} schema url is absolute on the Summit domain`, () => {
      assert.ok(schema.url.startsWith(`${BASE}/`), schema.url);
    });

    test(`${name} service type is not Management Consulting`, () => {
      assert.notEqual(schema.serviceType, "Management Consulting");
    });
  }

  test("urls point at the right pages", () => {
    assert.equal(scaleUpServiceSchema.url, `${BASE}/scale-up-advisory`);
    assert.equal(outsourcedServiceSchema.url, `${BASE}/scale-up-advisory/outsourced-sales`);
    assert.equal(fractionalServiceSchema.url, `${BASE}/scale-up-advisory/fractional-executive`);
  });

  test("hub offer catalog lists the two options with their page URLs", () => {
    const items = scaleUpServiceSchema.hasOfferCatalog.itemListElement;
    assert.equal(items.length, 2);
    items.forEach((item, i) => {
      assert.equal(item.itemOffered.name, OPTIONS[i].title);
      assert.equal(item.itemOffered.url, `${BASE}${OPTIONS[i].href}`);
    });
  });
});

describe("FAQ schemas", () => {
  const cases = [
    ["outsourced", outsourcedFaqSchema, OUTSOURCED_FAQS],
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

describe("homepage deep link", () => {
  test("/?page=sme redirects permanently to the hub", async () => {
    assert.ok(nextConfig.redirects, "next.config.ts defines redirects()");
    const redirects = await nextConfig.redirects();
    const entry = redirects.find(
      (r) =>
        r.source === "/" &&
        (r.has ?? []).some((h) => h.type === "query" && h.key === "page" && h.value === "sme"),
    );
    assert.ok(entry, "no redirect for /?page=sme");
    assert.equal(entry.destination, "/scale-up-advisory");
    assert.equal(entry.permanent, true);
  });
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

  test("the options are never called routes (copy or export names)", () => {
    assert.doesNotMatch(copy, /\broutes?\b/i);
  });
});
