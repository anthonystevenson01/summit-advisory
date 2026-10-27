/**
 * The crawler's rules: robots parsing and the allow check, link
 * normalising, the page scorer and the visible text stripper. Pure module,
 * no network.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CRAWL_MAX_PAGES,
  CRAWL_TEXT_CAP,
  DEFAULT_USER_AGENT,
  PAGE_TEXT_CAP,
  PAGE_TIMEOUT_MS,
  ROBOTS_TOKEN,
  START_PAGE_SCORE,
  extractLinks,
  isAllowed,
  normaliseLink,
  parseRobots,
  scorePage,
  stripVisibleText,
} from "../app/lib/ask-summit/crawl-rules.ts";

const DASH_RE = /[–—]/;
const BASE = "https://example.com/";

describe("parseRobots and isAllowed", () => {
  test("the SummitBot group wins over *; only * is used when alone; no robots allows everything", () => {
    const both = parseRobots("User-agent: *\nDisallow: /private\n\nUser-agent: SummitBot\nDisallow: /bot-only\nCrawl-delay: 2\n");
    assert.deepEqual(both.disallow, ["/bot-only"]);
    assert.equal(both.crawlDelayMs, 2000);
    const star = parseRobots("User-agent: *\nDisallow: /private\n");
    assert.deepEqual(star.disallow, ["/private"]);
    const none = parseRobots(null);
    assert.deepEqual(none, { allow: [], disallow: [], crawlDelayMs: 0 });
    assert.equal(isAllowed(none, "/anything"), true);
    assert.equal(ROBOTS_TOKEN, "SummitBot");
    assert.ok(DEFAULT_USER_AGENT.startsWith("SummitBot/"));
  });

  test("an empty Disallow allows everything; comments and case are handled", () => {
    const rules = parseRobots("# comment\nuser-agent: *\ndisallow:\nDISALLOW: /x # trailing\n");
    assert.deepEqual(rules.disallow, ["/x"]);
    assert.equal(isAllowed(rules, "/"), true);
    assert.equal(isAllowed(rules, "/x/y"), false);
  });

  test("the longest matching prefix decides and allow wins a tie", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /docs\nAllow: /docs/public\n");
    assert.equal(isAllowed(rules, "/docs/private"), false);
    assert.equal(isAllowed(rules, "/docs/public/page"), true);
    const tie = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a\n");
    assert.equal(isAllowed(tie, "/a/b"), true);
  });

  test("a pattern with * matches as the prefix before it; crawl delay is capped at 5 s", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /search*\nCrawl-delay: 30\n");
    assert.deepEqual(rules.disallow, ["/search"]);
    assert.equal(isAllowed(rules, "/search/results"), false);
    assert.equal(rules.crawlDelayMs, 5000);
  });

  test("several agent lines open one group", () => {
    const rules = parseRobots("User-agent: Googlebot\nUser-agent: summitbot/1.0\nDisallow: /both\n\nUser-agent: *\nDisallow: /star\n");
    assert.deepEqual(rules.disallow, ["/both"]);
  });
});

describe("normaliseLink", () => {
  test("resolves relative links, drops the fragment and the query, strips a trailing slash", () => {
    assert.equal(normaliseLink("/pricing#plans", BASE), "https://example.com/pricing");
    assert.equal(normaliseLink("about/?utm=1", BASE), "https://example.com/about");
    assert.equal(normaliseLink("/", BASE), "https://example.com/");
    assert.equal(normaliseLink("https://www.example.com/team", BASE), "https://www.example.com/team");
  });

  test("rejects non-page schemes, off-host links and file links", () => {
    for (const bad of ["mailto:a@example.com", "tel:+441234", "javascript:void(0)", "data:text/plain,hi", "https://other.com/", "https://blog.example.com/", "/deck.pdf", "/hero.jpg", "/archive.zip", "ftp://example.com/x", ""]) {
      assert.equal(normaliseLink(bad, BASE), null, bad);
    }
  });
});

describe("scorePage", () => {
  test("preferred paths outrank the rest; the start page scores highest", () => {
    assert.ok(scorePage("/pricing", "") > scorePage("/blog/post", ""));
    assert.ok(scorePage("/customers/acme", "") > scorePage("/news/acme", ""));
    assert.ok(scorePage("/about", "Case study") > scorePage("/about", ""));
    assert.ok(scorePage("/legal/privacy", "") < 0);
    assert.ok(START_PAGE_SCORE > scorePage("/pricing/products/customers", ""));
  });

  test("depth beyond two segments costs one per segment", () => {
    assert.equal(scorePage("/a/b/c", ""), -1);
    assert.equal(scorePage("/a/b/c/d", ""), -2);
    assert.equal(scorePage("/a/b", ""), 0);
  });
});

describe("stripVisibleText", () => {
  const html = readFileSync(new URL("./fixtures/ask-summit-page.html", import.meta.url), "utf8");

  test("drops hidden blocks, keeps headings and paragraphs, decodes entities and returns the title", () => {
    const { title, text } = stripVisibleText(html);
    assert.equal(title, "Acme & Co: Pricing");
    assert.ok(!text.includes("SCRIPT_TEXT"));
    assert.ok(!text.includes("STYLE_TEXT"));
    assert.ok(!text.includes("NOSCRIPT_TEXT"));
    assert.ok(!text.includes("TEMPLATE_TEXT"));
    assert.ok(!text.includes("SVG_TEXT"));
    assert.ok(!text.includes("IFRAME_TEXT"));
    assert.ok(!text.includes("NAV_TEXT"));
    assert.ok(!text.includes("FOOTER_TEXT"));
    assert.ok(!text.includes("ROLE_NAV_TEXT"));
    assert.ok(!text.includes("HIDDEN_TEXT"));
    assert.ok(text.includes("Plans & pricing"));
    assert.ok(text.includes("It's 9 per seat"));
    assert.ok(text.includes("Starter plan\n\nTeam plan"));
    assert.ok(!text.includes("  "));
    assert.doesNotMatch(text, DASH_RE);
  });

  test("caps at PAGE_TEXT_CAP on a word boundary", () => {
    const long = `<html><body><p>${"word ".repeat(20_000)}</p></body></html>`;
    const { text } = stripVisibleText(long);
    assert.ok(text.length <= PAGE_TEXT_CAP);
    assert.ok(text.endsWith("word"));
  });

  test("the caps are the brief's", () => {
    assert.equal(CRAWL_MAX_PAGES, 40);
    assert.equal(CRAWL_TEXT_CAP, 1_500_000);
    assert.equal(PAGE_TIMEOUT_MS, 10_000);
  });
});

describe("extractLinks", () => {
  test("returns hrefs from <a> only, in order, deduplicated", () => {
    const html = `<a href="/one">1</a><link href="/style.css"><a class="x" href='/two'>2</a><a href="/one">again</a><a href=/three>3</a><a href="/q?a=1&amp;b=2">q</a>`;
    assert.deepEqual(extractLinks(html), ["/one", "/two", "/three", "/q?a=1&b=2"]);
  });
});
