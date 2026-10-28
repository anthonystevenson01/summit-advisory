/**
 * Product Studio: the hub page and its two option pages (startups,
 * enterprise), and the redirects that retired /ai-studio and the homepage
 * ?page=ai view.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping
 * (Node >= 22.18 / 23.6). No extra dependencies: `npm test`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  ENTERPRISE_PATH,
  OPTIONS,
  PRODUCT_STUDIO_PATH,
  STARTUPS_PATH,
  STARTUP_FAQS,
  startupFaqSchema,
} from "../app/product-studio/product-studio-content.ts";
import nextConfig from "../next.config.ts";

describe("options", () => {
  test("two options, each its own page under the hub", () => {
    assert.equal(OPTIONS.length, 2);
    assert.equal(OPTIONS[0].href, STARTUPS_PATH);
    assert.equal(OPTIONS[1].href, ENTERPRISE_PATH);
    for (const o of OPTIONS) {
      assert.ok(o.href.startsWith(`${PRODUCT_STUDIO_PATH}/`), o.href);
    }
  });
});

describe("startup FAQ schema", () => {
  test("is an FAQPage with one Question per FAQ", () => {
    assert.equal(startupFaqSchema["@type"], "FAQPage");
    assert.equal(startupFaqSchema.mainEntity.length, STARTUP_FAQS.length);
    startupFaqSchema.mainEntity.forEach((q, i) => {
      assert.equal(q["@type"], "Question");
      assert.equal(q.name, STARTUP_FAQS[i].q);
      assert.equal(q.acceptedAnswer.text, STARTUP_FAQS[i].a);
    });
  });
});

describe("redirects", () => {
  const pageQuery = (value: string) => (r: { source: string; has?: { type: string; key?: string; value?: string }[] }) =>
    r.source === "/" && (r.has ?? []).some((h) => h.type === "query" && h.key === "page" && h.value === value);

  test("/ai-studio redirects permanently to the hub", async () => {
    assert.ok(nextConfig.redirects, "next.config.ts defines redirects()");
    const redirects = await nextConfig.redirects();
    const entries = redirects.filter((r) => r.source === "/ai-studio");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].destination, PRODUCT_STUDIO_PATH);
    assert.equal(entries[0].permanent, true);
  });

  test("/?page=ai redirects permanently to the hub", async () => {
    const redirects = await nextConfig.redirects!();
    const entry = redirects.find(pageQuery("ai"));
    assert.ok(entry, "no redirect for /?page=ai");
    assert.equal(entry.destination, PRODUCT_STUDIO_PATH);
    assert.equal(entry.permanent, true);
  });

  test("?page=ai and ?page=sme are separate entries", async () => {
    const redirects = await nextConfig.redirects!();
    const ai = redirects.find(pageQuery("ai"));
    const sme = redirects.find(pageQuery("sme"));
    assert.ok(ai && sme);
    assert.notEqual(ai, sme);
    assert.notEqual(ai.destination, sme.destination);
  });
});
