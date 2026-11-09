/**
 * The server written shell: the CSS variables from the house style, one nav
 * button per screen, the logo or the wordmark, one empty section per screen
 * in order with the first visible, the switcher, nothing the safety pass
 * would strip, and the budget arithmetic. The shell alone passes the Round 1
 * validator after the safety pass. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { NEUTRAL_HOUSE_STYLE, fontChoice, type HouseStyle } from "../app/lib/project-builder/house-style.ts";
import { PROTOTYPE_HTML_MAX_CHARS } from "../app/lib/project-builder/prototype.ts";
import { PROTOTYPE_CSP, sanitisePrototypeHtml, validatePrototypeHtml } from "../app/lib/project-builder/prototype-html.ts";
import { SCREEN_BUDGET_MAX, SHELL_CLASSES, SHELL_IDS, renderShell, shellClassLines, shellScreenBudget, shellVariables } from "../app/lib/project-builder/shell.ts";

const style: HouseStyle = {
  ...NEUTRAL_HOUSE_STYLE,
  status: "found",
  reason: "",
  host: "acme.com",
  siteName: "Acme Garages",
  colours: ["#c0392b", "#123456"],
  background: "#fafafa",
  text: "#101010",
  navBackground: "#0a1f44",
  navText: "#ffffff",
  headingFont: fontChoice("Lora"),
  bodyFont: fontChoice("Inter"),
  logo: { dataUri: "data:image/png;base64,AA==", mime: "image/png", bytes: 1 },
};

const plan = {
  screens: [
    { slug: "dashboard", title: "Dashboard", purpose: "", role: "", components: [], entities: [] },
    { slug: "jobs", title: "Job cards & \"quotes\"", purpose: "", role: "", components: [], entities: [] },
    { slug: "settings", title: "Settings", purpose: "", role: "", components: [], entities: [] },
  ],
};

describe("renderShell", () => {
  const html = renderShell(plan, style, "Acme Ltd", "Garage CRM");

  test("the seven variables carry the style's values, the third colour falls back to the second, and the scales are there", () => {
    for (const v of ["--brand-1:#c0392b", "--brand-2:#123456", "--brand-3:#123456", "--bg:#fafafa", "--text:#101010", "--nav-bg:#0a1f44", "--nav-text:#ffffff", "--font-heading:", "--font-body:", "--space-7:48px", "--text-6:32px", "--radius:6px"]) {
      assert.ok(html.includes(v), v);
    }
    assert.ok(html.includes("Lora"));
    const neutral = shellVariables(NEUTRAL_HOUSE_STYLE);
    assert.equal(neutral.brand2, neutral.brand1);
    assert.equal(neutral.brand3, neutral.brand1);
  });

  test("one nav button per screen with data-go, the first active, titles escaped, the logo image with the placeholder", () => {
    assert.equal((html.match(/class="pb-nav-button[^"]*" data-go="/g) ?? []).length, 3);
    assert.ok(html.includes('class="pb-nav-button is-active" data-go="dashboard">Dashboard</button>'));
    assert.ok(html.includes('data-go="jobs">Job cards &amp; &quot;quotes&quot;</button>'));
    assert.ok(html.includes('<img class="pb-nav-logo" src="{{LOGO}}" alt="Acme Ltd">'));
    assert.ok(!html.includes('<span class="pb-nav-wordmark"'));
    assert.ok(html.includes("<title>Garage CRM prototype</title>"));
  });

  test("without a logo the wordmark is the company name, else the site name", () => {
    const noLogo = renderShell(plan, { ...style, logo: null }, "Acme Ltd");
    assert.ok(noLogo.includes('<span class="pb-nav-wordmark">Acme Ltd</span>'));
    assert.ok(!noLogo.includes("{{LOGO}}"));
    assert.ok(renderShell(plan, { ...style, logo: null }, "").includes('<span class="pb-nav-wordmark">Acme Garages</span>'));
  });

  test("exactly one empty section per screen in order, the first visible, and the switcher with addEventListener", () => {
    const sections = [...html.matchAll(/<section class="pb-screen( is-visible)?" data-screen="([a-z-]+)" aria-label="[^"]*"><\/section>/g)];
    assert.deepEqual(sections.map((m) => m[2]), ["dashboard", "jobs", "settings"]);
    assert.deepEqual(sections.map((m) => Boolean(m[1])), [true, false, false]);
    assert.equal((html.match(/data-screen=/g) ?? []).length, 3);
    assert.ok(html.includes('<script id="pb-switch">'));
    assert.ok(html.includes("document.addEventListener('click'"));
    assert.equal((html.match(/<script[\s>]/g) ?? []).length, 1);
    assert.equal((html.match(/<style[\s>]/g) ?? []).length, 1);
    assert.ok(html.includes('<style id="pb-base">'));
    assert.deepEqual(SHELL_IDS, ["pb-base", "pb-switch"]);
  });

  test("no link, no URL, no inline handler, no form; only the charset and viewport metas", () => {
    assert.ok(!/<link\b/i.test(html));
    assert.ok(!/https?:\/\//i.test(html));
    assert.ok(!/\son[a-z]+\s*=/i.test(html));
    assert.ok(!/<form\b/i.test(html));
    assert.deepEqual([...html.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]), ['<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">']);
  });

  test("the shell alone passes the Round 1 safety pass and validator, with the CSP first", () => {
    const safe = sanitisePrototypeHtml(html, "https://fonts.googleapis.com/css2?family=Lora&display=swap");
    assert.deepEqual(validatePrototypeHtml(safe), []);
    assert.ok(safe.startsWith(`<!DOCTYPE html><!--pb-safe--><meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`));
    assert.ok(safe.includes('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora&amp;display=swap">'));
    assert.ok(safe.includes("{{LOGO}}"));
  });

  test("every shared class has a use line and no dash", () => {
    assert.ok(SHELL_CLASSES.length >= 20);
    for (const line of shellClassLines()) {
      assert.match(line, /^pb-[a-z-]+: .+/);
      assert.doesNotMatch(line, /[–—]/);
    }
  });
});

describe("shellScreenBudget", () => {
  test("the smaller of 16,000 and the room left split across the screens, never negative", () => {
    assert.equal(shellScreenBudget(8_000, 5), SCREEN_BUDGET_MAX);
    assert.equal(shellScreenBudget(8_000, 3), SCREEN_BUDGET_MAX);
    assert.equal(shellScreenBudget(60_000, 5), Math.floor((PROTOTYPE_HTML_MAX_CHARS - 60_000 - 1_000) / 5));
    assert.equal(shellScreenBudget(PROTOTYPE_HTML_MAX_CHARS, 3), 0);
    assert.equal(shellScreenBudget(8_000, 0), SCREEN_BUDGET_MAX);
  });
});
