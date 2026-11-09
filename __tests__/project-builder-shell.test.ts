/**
 * The server written shell: the CSS variables from the house style, one nav
 * button per screen, the logo or the wordmark, one empty section per screen
 * in order with the first visible, the switcher, nothing the safety pass
 * would strip, and the budget arithmetic. The shell alone passes the Round 1
 * validator after the safety pass. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { NEUTRAL_HOUSE_STYLE, contrastRatio, fontChoice, type HouseStyle } from "../app/lib/project-builder/house-style.ts";
import { PROTOTYPE_HTML_MAX_CHARS } from "../app/lib/project-builder/prototype.ts";
import { PROTOTYPE_CSP, sanitisePrototypeHtml, validatePrototypeHtml } from "../app/lib/project-builder/prototype-html.ts";
import { ACCENT_MIN_CONTRAST, ACCENT_SURFACE, SCREEN_BUDGET_MAX, SHELL_CLASSES, SHELL_IDS, TEXT_MUTED, baseCss, renderShell, resolveAccent, shellClassLines, shellScreenBudget, shellVariables } from "../app/lib/project-builder/shell.ts";

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

  test("every shared class has a use line and no dash, and the three design round classes are listed", () => {
    assert.ok(SHELL_CLASSES.length >= 23);
    const names = SHELL_CLASSES.map((c) => c.name);
    for (const name of ["pb-num", "pb-empty", "pb-field-error"]) assert.ok(names.includes(name), name);
    for (const line of shellClassLines()) {
      assert.match(line, /^pb-[a-z-]+: .+/);
      assert.doesNotMatch(line, /[–—]/);
    }
    assert.ok(shellClassLines().some((l) => l.startsWith("pb-num: ")));
  });
});

describe("resolveAccent", () => {
  const TEXT = "#1F2A37";

  test("a light first colour alone is darkened until it reads at 4.5:1 on white, keeping its hue, and the fill takes the text colour", () => {
    const { accent, onAccent } = resolveAccent(["#F5D000", "#F5D000", "#F5D000"], TEXT);
    assert.notEqual(accent.toUpperCase(), "#F5D000");
    assert.ok(contrastRatio(accent, ACCENT_SURFACE) >= ACCENT_MIN_CONTRAST);
    assert.equal(accent.slice(5, 7), "00");
    assert.ok(parseInt(accent.slice(1, 3), 16) > parseInt(accent.slice(3, 5), 16));
    assert.equal(onAccent, TEXT);
  });

  test("a light first colour with a dark second takes the second as the accent; the fill is still the first", () => {
    const { accent, onAccent } = resolveAccent(["#F5D000", "#123456", "#123456"], TEXT);
    assert.equal(accent, "#123456");
    assert.equal(onAccent, TEXT);
  });

  test("a dark first colour is the accent and carries white", () => {
    const { accent, onAccent } = resolveAccent(["#123456", "#F5D000", "#F5D000"], TEXT);
    assert.equal(accent, "#123456");
    assert.equal(onAccent, "#FFFFFF");
  });

  test("the neutral style keeps its first colour as the accent with white on it", () => {
    const v = shellVariables(NEUTRAL_HOUSE_STYLE);
    assert.equal(v.brand1, "#2F5D7C");
    assert.equal(v.accent, v.brand1);
    assert.equal(v.onAccent, "#FFFFFF");
  });

  test("a mid tone brand is darkened for text and gets the better of white or the text colour on the fill", () => {
    const { accent, onAccent } = resolveAccent(["#808080", "#808080", "#808080"], TEXT);
    assert.ok(contrastRatio(accent, ACCENT_SURFACE) >= ACCENT_MIN_CONTRAST);
    assert.equal(onAccent, "#FFFFFF");
  });

  test("the rendered :root carries the accent pair and the muted token, which reads at 4.5:1 on white", () => {
    const html = renderShell(plan, { ...style, colours: ["#F5D000"] }, "Acme Ltd");
    assert.ok(html.includes("--accent:#816c00;--on-accent:#101010;"));
    assert.ok(html.includes(`--text-muted:${TEXT_MUTED};`));
    assert.ok(contrastRatio(TEXT_MUTED, "#FFFFFF") >= 4.5);
  });
});

describe("baseCss", () => {
  const css = baseCss(shellVariables(style));
  const rule = (selector: string) => {
    const i = css.indexOf(`${selector}{`);
    assert.ok(i >= 0, selector);
    return css.slice(i, css.indexOf("}", i) + 1);
  };

  test("pointer cursors, 150 ms transitions on four properties only, hover and focus states, no filter", () => {
    assert.ok(rule(".pb-button,.pb-nav-button,[data-go],.pb-select").includes("cursor:pointer"));
    const transitions = css.match(/transition:[^;}]*/g) ?? [];
    assert.ok(transitions.length >= 1);
    for (const t of transitions) {
      if (t === "transition:none!important") continue;
      assert.equal(t, "transition:color .15s,background-color .15s,border-color .15s,box-shadow .15s");
    }
    assert.ok(rule(".pb-button:hover").includes("box-shadow:inset"));
    assert.ok(!css.includes("filter:"));
    for (const sel of [".pb-list li:hover", ".pb-table tbody tr:hover", ".pb-search:hover,.pb-select:hover,.pb-input:hover", ".pb-search:focus-visible,.pb-select:focus-visible,.pb-input:focus-visible"]) rule(sel);
    const focus = rule(".pb-nav-button:focus-visible,.pb-button:focus-visible,.pb-input:focus-visible,.pb-search:focus-visible,.pb-select:focus-visible,[data-go]:focus-visible");
    assert.ok(focus.includes("var(--accent)"));
    assert.equal(rule(".pb-nav-button:focus-visible"), ".pb-nav-button:focus-visible{outline-color:var(--nav-text)}");
    assert.ok(rule(".pb-table tbody tr:focus-visible,.pb-list li:focus-visible").includes("outline:2px solid var(--accent)"));
  });

  test("reduced motion removes transitions", () => {
    assert.ok(css.includes("@media (prefers-reduced-motion:reduce){*{transition:none!important"));
  });

  test("24px minimum on every interactive class before the component rules, 36px on buttons, nav buttons and inputs", () => {
    const sizes = ".pb-button,.pb-nav-button,.pb-search,.pb-select,.pb-input,[data-go]{min-width:24px;min-height:24px}";
    assert.ok(css.includes(sizes));
    assert.ok(css.indexOf(sizes) < css.indexOf(".pb-button{"));
    assert.ok(rule(".pb-button").includes("min-height:36px"));
    assert.ok(rule(".pb-search,.pb-select,.pb-input").includes("min-height:36px"));
    assert.ok(rule(".pb-nav-button").includes("min-height:36px"));
  });

  test("tabular figures on tables and figure values, and pb-num right aligned on cells and headers", () => {
    assert.ok(css.includes(".pb-table,.pb-figure-value{font-variant-numeric:tabular-nums}"));
    assert.ok(css.includes(".pb-num,.pb-table th.pb-num{text-align:right;font-variant-numeric:tabular-nums"));
  });

  test("the empty state, the field error and links", () => {
    const empty = rule(".pb-empty");
    assert.ok(empty.includes("dashed") && empty.includes("var(--text-muted)"));
    assert.ok(rule(".pb-field-error").includes("var(--bad)"));
    assert.ok(css.includes(".pb-field-error:empty{display:none}"));
    assert.ok(css.includes("a{color:var(--accent)}"));
  });

  test("one muted token: the literal appears once and the five muted rules use it", () => {
    assert.equal(css.split(TEXT_MUTED).length - 1, 1);
    for (const sel of [".pb-figure-label", ".pb-figure-delta", ".pb-field label", ".pb-detail dt", ".pb-muted"]) assert.ok(rule(sel).includes("var(--text-muted)"), sel);
  });

  test("the accent pair is used where the brand colour used to be", () => {
    assert.ok(rule(".pb-figure-value").includes("color:var(--accent)"));
    const button = rule(".pb-button");
    assert.ok(button.includes("color:var(--on-accent)") && button.includes("background:var(--brand-1)"));
    assert.ok(rule(".pb-nav-button.is-active").includes("color:var(--on-accent)"));
    const secondary = rule(".pb-button--secondary");
    assert.ok(secondary.includes("color:var(--accent)") && secondary.includes("border-color:var(--accent)"));
    assert.doesNotMatch(css, /[–—]/);
  });
});

describe("shell size", () => {
  // renderShell on this fixture measured on main at 4cd7254, before the design rules round.
  const ROUND_3_SHELL_CHARS = 7_922;
  const fixture = { screens: Array.from({ length: 5 }, (_, i) => ({ slug: `screen-${i}`, title: `Screen ${i}`, purpose: "", role: "", components: [], entities: [] })) };

  test("the shell grew by at most 3,000 characters and five screens still get at least 12,000 each", () => {
    const length = renderShell(fixture, NEUTRAL_HOUSE_STYLE, "Ocado", "Orders").length;
    assert.ok(length <= ROUND_3_SHELL_CHARS + 3_000, `shell is ${length}`);
    assert.ok(shellScreenBudget(length, 5) >= 12_000, `budget is ${shellScreenBudget(length, 5)}`);
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
