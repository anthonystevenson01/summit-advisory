/**
 * One screen at a time: the parse, the per screen check (nested screen, ids,
 * each banned construct by name, size), the placement (html in its section,
 * css scoped, js wrapped before the switcher) and the assembly through the
 * Round 1 safety pass and validator unchanged. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { NEUTRAL_HOUSE_STYLE, type HouseStyle } from "../app/lib/project-builder/house-style.ts";
import { PROTOTYPE_CSP, validatePrototypeHtml } from "../app/lib/project-builder/prototype-html.ts";
import { coverageItems, parsePlanAnswer } from "../app/lib/project-builder/plan.ts";
import { blank } from "../app/lib/project-builder/brief.ts";
import { assembleDocument, checkScreen, collectIds, parseScreenBuild, placeScreens, scopeCss, wrapScreenScript, type ScreenBuild } from "../app/lib/project-builder/screens.ts";
import { SHELL_IDS, renderShell } from "../app/lib/project-builder/shell.ts";
import { SchemaError } from "../app/lib/tools/schema.ts";

const style: HouseStyle = { ...NEUTRAL_HOUSE_STYLE, siteName: "Acme" };
const s = blank();
s.idea = "A CRM";
s.features = { accounts: "Must" };
const items = coverageItems(s);
const plan = parsePlanAnswer(
  {
    screens: [
      { slug: "dashboard", title: "Dashboard", purpose: "", role: "", components: [{ kind: "figures", title: "Figures", entity: "", note: "" }], entities: [] },
      { slug: "jobs", title: "Jobs", purpose: "", role: "", components: [{ kind: "table", title: "Jobs", entity: "", note: "" }], entities: [] },
      { slug: "settings", title: "Settings", purpose: "", role: "", components: [{ kind: "form", title: "Roles", entity: "", note: "" }], entities: [] },
    ],
    coverage: [],
    unplaced: [],
  },
  items,
  { version: 1, builtFrom: "p1-x", model: "m" },
);

const clean = (slug: string): ScreenBuild => ({
  html: `<div class="pb-container"><h1 class="pb-screen-title" id="${slug}-title">${slug}</h1><input class="pb-search" id="${slug}-search"><table class="pb-table" id="${slug}-table"><tr><td>Row</td></tr></table><p class="pb-notice" id="${slug}-notice"></p><button type="button" class="pb-button" data-go="dashboard">Back</button></div>`,
  css: `.${slug}-wide { width: 100% } @media (max-width: 600px) { .${slug}-wide { width: auto } }`,
  js: `var box = root.querySelector('#${slug}-search'); if (box) { box.addEventListener('input', function () { root.querySelector('#${slug}-notice').textContent = 'Searching'; }); }`,
});

const taken = new Set(SHELL_IDS);

describe("parseScreenBuild", () => {
  test("html is required; css and js default to empty strings", () => {
    assert.deepEqual(parseScreenBuild({ html: " <p>x</p> ", css: 1, js: null }), { html: "<p>x</p>", css: "", js: "" });
    assert.throws(() => parseScreenBuild({ html: "   " }), SchemaError);
    assert.throws(() => parseScreenBuild("x"), SchemaError);
  });
});

describe("checkScreen", () => {
  test("a clean screen passes", () => {
    assert.deepEqual(checkScreen(clean("jobs"), "jobs", 16_000, taken), []);
  });

  test("a nested data-screen, an unprefixed id, a duplicate id and an id that collides with the shell are caught", () => {
    const b = clean("jobs");
    const nested = checkScreen({ ...b, html: `${b.html}<section data-screen="inner"></section>` }, "jobs", 16_000, taken);
    assert.ok(nested.some((i) => i.includes("data-screen")));
    const unprefixed = checkScreen({ ...b, html: b.html.replace('id="jobs-table"', 'id="table"') }, "jobs", 16_000, taken);
    assert.ok(unprefixed.some((i) => i.includes("every id must start with jobs-") && i.includes("table")));
    const dupe = checkScreen({ ...b, html: `${b.html}<p id="jobs-title"></p>` }, "jobs", 16_000, taken);
    assert.ok(dupe.some((i) => i.includes("more than once") && i.includes("jobs-title")));
    const collide = checkScreen({ ...b, html: `${b.html}<p id="pb-base"></p>` }, "jobs", 16_000, taken);
    assert.ok(collide.some((i) => i.includes("already used elsewhere") && i.includes("pb-base")));
    assert.ok(collide.some((i) => i.includes("every id must start with jobs-")));
  });

  test("each banned construct is caught by name in html, css and js", () => {
    const b = clean("jobs");
    const cases: Array<[Partial<ScreenBuild>, string]> = [
      [{ html: `${b.html}<script>1</script>` }, "<script>"],
      [{ html: `${b.html}<style>p{}</style>` }, "<style>"],
      [{ html: `${b.html}<link rel="stylesheet">` }, "<link>"],
      [{ html: `${b.html}<form></form>` }, "No form elements"],
      [{ html: `${b.html}<img src="x">` }, "<img>"],
      [{ html: `${b.html}<iframe></iframe>` }, "<iframe>"],
      [{ html: `${b.html}<meta charset="utf-8">` }, "<meta>"],
      [{ html: `${b.html}<body>` }, "<body>"],
      [{ html: `${b.html}<a href="https://example.com">x</a>` }, "no URLs"],
      [{ css: `${b.css} .x { background: url(//cdn.example.com/a.png) }` }, "no URLs"],
      [{ css: `${b.css} @import "x.css";` }, "no @import"],
      [{ css: `${b.css} .x { background: url(a.png) }` }, "no url()"],
      [{ js: `${b.js} fetch('/x')` }, "fetch("],
      [{ js: `${b.js} localStorage.setItem('a', 1)` }, "localStorage"],
      [{ js: `${b.js} window.open('x')` }, "window.open"],
      [{ js: `${b.js} alert('x')` }, "alert("],
      [{ js: `${b.js} var s = '</script>'` }, "</script"],
      [{ js: `${b.js} document.getElementById('other-thing').innerHTML = ''` }, "reaches outside its screen"],
      [{ js: `${b.js} top.location = 'x'` }, "top. or parent."],
      [{ js: `${b.js} location.href = 'x'` }, "do not use location"],
      [{ js: `${b.js} window.location.reload()` }, "window.location"],
    ];
    for (const [patch, expected] of cases) {
      const issues = checkScreen({ ...b, ...patch }, "jobs", 16_000, taken);
      assert.ok(issues.some((i) => i.includes(expected)), `${expected}: ${issues.join(" | ")}`);
    }
    // A data field called location, an element's top and a parentNode are not the page's location, top or parent.
    const own = checkScreen({ ...b, js: `${b.js} var rect = el.getBoundingClientRect(); var y = rect.top.toFixed(0); var p = node.parentNode; var where = order.location.name; var allocation = 3;` }, "jobs", 16_000, taken);
    assert.deepEqual(own, []);
  });

  test("over budget is caught with the numbers", () => {
    const b = clean("jobs");
    const issues = checkScreen({ ...b, html: b.html + "x".repeat(2_000) }, "jobs", 1_000, taken);
    const size = b.html.length + 2_000 + b.css.length + b.js.length;
    assert.ok(issues.some((i) => i === `The screen is ${size} characters; it must be at most 1000. Shorten the sample data, not the components.`));
  });

  test("no issue line carries an en or em dash", () => {
    const b = clean("jobs");
    const issues = checkScreen({ html: `${b.html}<form><img><script><link>`, css: "@import x; .a{background:url(x)}", js: "fetch(); alert(); top.location" }, "jobs", 10, taken);
    assert.ok(issues.length >= 6, issues.join(" | "));
    for (const i of issues) assert.doesNotMatch(i, /[–—]/, i);
  });

  test("collectIds lists every id in order, duplicates included", () => {
    assert.deepEqual(collectIds('<p id="a"></p><p id="b"></p><p id="a"></p>'), ["a", "b", "a"]);
  });
});

describe("scopeCss and the placement", () => {
  test("every rule is prefixed, media queries keep their inner rules prefixed, keyframes pass through, body becomes the screen", () => {
    const css = `/* note */ .a, .b { color: red } @media (max-width: 600px) { .c { width: 1px } } @keyframes spin { from { opacity: 0 } to { opacity: 1 } } body { margin: 0 } body .d { x: y }`;
    const out = scopeCss(css, "jobs");
    assert.ok(out.includes('[data-screen="jobs"] .a, [data-screen="jobs"] .b {'));
    assert.ok(out.includes("@media (max-width: 600px) {"));
    assert.ok(out.includes('[data-screen="jobs"] .c {'));
    assert.ok(out.includes("@keyframes spin {"));
    assert.ok(out.includes("from {"));
    assert.ok(!out.includes('[data-screen="jobs"] from'));
    assert.ok(out.includes('[data-screen="jobs"] {margin: 0}'));
    assert.ok(out.includes('[data-screen="jobs"] .d {'));
    assert.ok(!out.includes("note"));
  });

  test("html lands in its section, css is scoped in the head, js is wrapped in an IIFE before the switcher", () => {
    const shell = renderShell(plan, style, "Acme");
    const builds = plan.screens.map((screen) => ({ screen, build: clean(screen.slug) }));
    const out = placeScreens(shell, builds);
    assert.ok(out.includes('<section class="pb-screen is-visible" data-screen="dashboard" aria-label="Dashboard">\n<div class="pb-container"><h1 class="pb-screen-title" id="dashboard-title">'));
    assert.ok(out.includes('<section class="pb-screen" data-screen="jobs" aria-label="Jobs">\n<div class="pb-container">'));
    assert.ok(out.includes('<style data-screen-style="jobs">\n[data-screen="jobs"] .jobs-wide {'));
    assert.ok(out.indexOf('<style data-screen-style="jobs">') < out.indexOf("</head>"));
    const wrapped = wrapScreenScript(clean("jobs").js, "jobs");
    assert.ok(out.includes(wrapped));
    assert.ok(wrapped.startsWith(`<script data-screen-script="jobs">\n(function(){var root=document.querySelector('[data-screen="jobs"]');if(!root){return;}`));
    assert.ok(out.indexOf('<script data-screen-script="settings">') < out.indexOf('<script id="pb-switch">'));
    assert.equal((out.match(/<script[\s>]/g) ?? []).length, 4);
    assert.equal((out.match(/<\/script\s*>/g) ?? []).length, 4);
    // The validator's count: elements carrying data-screen, not the scoped selectors or the script's lookup.
    assert.equal((out.match(/<[a-z][a-z0-9-]*\b[^>]*\sdata-screen\s*=/gi) ?? []).length, 3);
  });

  test("replacement patterns in a screen's text are inserted literally: $' in html, $& in css, '$' in js", () => {
    const builds = Object.fromEntries(plan.screens.map((sc) => [sc.slug, clean(sc.slug)]));
    builds.dashboard = {
      // Built with a function so the test's own replace does not expand the patterns it is checking.
      html: builds.dashboard.html.replace("<tr><td>Row</td></tr>", () => "<tr><td>$'000</td><td>$`</td></tr>"),
      css: `${builds.dashboard.css} .dashboard-money::before { content: "$&" }`,
      js: `${builds.dashboard.js} var total = 12; var label = '$'+total;`,
    };
    const { html, issues } = assembleDocument(plan, style, null, builds, "Acme");
    assert.deepEqual(issues, []);
    assert.equal(html.split("$'000").length - 1, 1);
    assert.equal(html.split("'$'+total").length - 1, 1);
    assert.equal(html.split('content: "$&"').length - 1, 1);
    assert.equal((html.match(/<[a-z][a-z0-9-]*\b[^>]*\sdata-screen\s*=/gi) ?? []).length, 3);
    assert.equal(html.split("</head>").length - 1, 1);
    assert.equal(html.split('id="pb-switch"').length - 1, 1);
  });

  test("an id that belongs to a longer planned slug is refused on the shorter slug's screen, so jobs and jobs-list cannot collide", () => {
    const b = clean("jobs");
    const slugs = ["dashboard", "jobs", "jobs-list"];
    const refused = checkScreen({ ...b, html: `${b.html}<p id="jobs-list-total"></p>` }, "jobs", 16_000, taken, slugs);
    assert.ok(refused.some((i) => i.includes("ids starting with jobs-list- belong to the jobs-list screen") && i.includes("jobs-list-total")));
    assert.deepEqual(checkScreen(clean("jobs-list"), "jobs-list", 16_000, taken, slugs), []);
    assert.deepEqual(checkScreen(b, "jobs", 16_000, taken, slugs), []);
  });

  test("a missing screen leaves its section empty; empty css or js adds nothing", () => {
    const shell = renderShell(plan, style, "Acme");
    const out = placeScreens(shell, [{ screen: plan.screens[1], build: { html: "<p>only jobs</p>", css: "", js: "" } }]);
    assert.ok(out.includes('data-screen="dashboard" aria-label="Dashboard"></section>'));
    assert.ok(out.includes("<p>only jobs</p>"));
    assert.ok(!out.includes("data-screen-style"));
    assert.ok(!out.includes("data-screen-script"));
  });
});

describe("assembleDocument", () => {
  test("three clean screens pass the safety pass and validator with the CSP first and the font link kept", () => {
    const builds = Object.fromEntries(plan.screens.map((sc) => [sc.slug, clean(sc.slug)]));
    const { html, issues } = assembleDocument(plan, style, "https://fonts.googleapis.com/css2?family=Inter&display=swap", builds, "Acme", "Garage CRM");
    assert.deepEqual(issues, []);
    assert.ok(html.startsWith(`<!DOCTYPE html><!--pb-safe--><meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`));
    assert.ok(html.includes('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&amp;display=swap">'));
    assert.ok(html.includes('id="jobs-table"'));
    assert.ok(html.includes("<title>Garage CRM prototype</title>"));
    assert.deepEqual(validatePrototypeHtml(html), []);
  });

  test("a screen that sneaks a second body past the check is reported by the validator, so nothing is stored", () => {
    const builds = Object.fromEntries(plan.screens.map((sc) => [sc.slug, clean(sc.slug)]));
    builds.jobs = { ...builds.jobs, html: `${builds.jobs.html}<body>` };
    const { issues } = assembleDocument(plan, style, null, builds, "Acme");
    assert.ok(issues.some((i) => i.includes("<body> tags")));
  });

  test("a duplicate id across screens is reported by the validator", () => {
    const builds = Object.fromEntries(plan.screens.map((sc) => [sc.slug, clean(sc.slug)]));
    builds.settings = { ...builds.settings, html: builds.settings.html.replace('id="settings-title"', 'id="jobs-title"') };
    const { issues } = assembleDocument(plan, style, null, builds, "Acme");
    assert.ok(issues.some((i) => i.includes("jobs-title")));
  });
});
