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
import { DESIGN_ISSUE_LINES, SIZE_OVERRUN_TOLERANCE, SIZE_SOFT_MAX, assembleDocument, checkScreen, collectIds, isDesignIssue, isSoftSizeIssue, parseScreenBuild, placeScreens, scopeCss, wrapScreenScript, type ScreenBuild } from "../app/lib/project-builder/screens.ts";
import { SCREEN_BUDGET_MAX, SHELL_IDS, renderShell } from "../app/lib/project-builder/shell.ts";
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
    const issues = checkScreen({ html: `${b.html}<form><img><script><link><div class="pb-chart"><svg><text>x</text></svg></div><tr style="background:red">`, css: "@import x; .a{background:url(x)} tr{background:red}", js: "fetch(); alert(); top.location" }, "jobs", 10, taken);
    assert.ok(issues.length >= 9, issues.join(" | "));
    for (const i of issues) assert.doesNotMatch(i, /[–—]/, i);
  });

  test("collectIds lists every id in order, duplicates included", () => {
    assert.deepEqual(collectIds('<p id="a"></p><p id="b"></p><p id="a"></p>'), ["a", "b", "a"]);
  });
});

describe("isSoftSizeIssue", () => {
  const line = (size: number, budget: number) => `The screen is ${size} characters; it must be at most ${budget}. Shorten the sample data, not the components.`;
  const budget = 15_872;
  const limit = Math.floor(budget * (1 + SIZE_OVERRUN_TOLERANCE));

  test("the 9 November 2026 preview line (16,037 against 15,872) is soft", () => {
    assert.equal(SIZE_OVERRUN_TOLERANCE, 0.1);
    assert.ok(isSoftSizeIssue(line(16_037, budget), budget));
  });

  test("just under, exactly at and over the tolerance", () => {
    assert.ok(isSoftSizeIssue(line(limit - 1, budget), budget));
    assert.ok(isSoftSizeIssue(line(limit, budget), budget));
    assert.ok(!isSoftSizeIssue(line(limit + 1, budget), budget));
    assert.ok(!isSoftSizeIssue(line(budget * 2, budget), budget));
  });

  test("never past SCREEN_BUDGET_MAX plus the tolerance, whatever share is passed", () => {
    assert.equal(SIZE_SOFT_MAX, 17_600);
    assert.ok(isSoftSizeIssue(line(SIZE_SOFT_MAX, SCREEN_BUDGET_MAX), SCREEN_BUDGET_MAX));
    assert.ok(!isSoftSizeIssue(line(SIZE_SOFT_MAX + 1, SCREEN_BUDGET_MAX), SCREEN_BUDGET_MAX));
    // A share above the clamp cannot come from shellScreenBudget; the ceiling still holds if one is passed.
    assert.ok(!isSoftSizeIssue(line(SIZE_SOFT_MAX + 1, 20_000), 20_000));
  });

  test("a line that is not the size line, or names another budget, is not soft", () => {
    assert.ok(!isSoftSizeIssue("", budget));
    for (const design of Object.values(DESIGN_ISSUE_LINES)) assert.ok(!isSoftSizeIssue(design, budget));
    const b = clean("jobs");
    for (const blocking of checkScreen({ ...b, html: `${b.html}<form></form><p id="title"></p>` }, "jobs", 16_000, taken)) assert.ok(!isSoftSizeIssue(blocking, 16_000), blocking);
    assert.ok(!isSoftSizeIssue(line(16_037, budget), budget + 1));
    assert.ok(!isSoftSizeIssue(line(budget, budget), budget), "at the budget there is no overrun to call soft");
  });

  test("the line checkScreen writes for a small overrun is the line isSoftSizeIssue reads", () => {
    const b = clean("jobs");
    const size = b.html.length + b.css.length + b.js.length;
    const small = checkScreen(b, "jobs", size - 1, taken);
    assert.equal(small.length, 1);
    assert.ok(isSoftSizeIssue(small[0], size - 1), small[0]);
    assert.ok(!isDesignIssue(small[0]));
    const large = checkScreen(b, "jobs", Math.floor(size / 2), taken);
    assert.equal(large.length, 1);
    assert.ok(!isSoftSizeIssue(large[0], Math.floor(size / 2)), large[0]);
  });
});

describe("checkScreen design checks", () => {
  const chart = (svgInner: string, attrs = "") => `<div class="pb-chart" id="jobs-chart"><svg viewBox="0 0 100 50"${attrs}>${svgInner}</svg></div>`;
  const withHtml = (html: string) => checkScreen({ ...clean("jobs"), html: `${clean("jobs").html}${html}` }, "jobs", 16_000, taken);
  const withCss = (css: string) => checkScreen({ ...clean("jobs"), css: `${clean("jobs").css} ${css}` }, "jobs", 16_000, taken);
  const axes = '<line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="0" x2="0" y2="50"/>';

  test("an svg in a pb-chart box with nothing drawn is flagged: axes and text, text only, empty groups", () => {
    for (const inner of [`${axes}<text x="1" y="1">Jan</text><text x="2" y="2">Feb</text>`, '<text x="1" y="1">Jobs by day</text>', "<g></g><g><g></g></g>"]) {
      const issues = withHtml(chart(inner));
      assert.deepEqual(issues, [DESIGN_ISSUE_LINES.emptyChart], inner);
      assert.ok(issues[0].includes("pb-chart") && issues[0].includes("no marks drawn"));
    }
  });

  test("an svg with a mark drawn passes: rect, path, polyline, circle, polygon, four lines, a legend before the svg, nested boxes", () => {
    for (const inner of [`${axes}<rect x="1" y="1" width="5" height="40"/>`, '<path d="M0 50 L10 20"/>', '<polyline points="0,50 10,20"/>', '<circle cx="5" cy="5" r="2"/>', '<polygon points="0,50 10,20 20,50"/>', `${axes}<line x1="0" y1="40" x2="10" y2="20"/><line x1="10" y1="20" x2="20" y2="30"/>`]) {
      assert.deepEqual(withHtml(chart(inner)), [], inner);
    }
    const nested = `<div class="pb-card"><div class="pb-chart"><div class="jobs-legend"><span>Done</span></div>${`<svg viewBox="0 0 100 50"><rect x="1" y="1" width="5" height="40"/></svg>`}</div><p class="pb-muted">Note</p></div>`;
    assert.deepEqual(withHtml(nested), []);
  });

  test("an svg outside a pb-chart box, a pb-chart with no svg, and a second drawn chart beside an empty one", () => {
    assert.deepEqual(withHtml('<span class="jobs-icon"><svg viewBox="0 0 10 10"><text>i</text></svg></span>'), []);
    assert.deepEqual(withHtml('<div class="pb-chart"><div class="jobs-bar"></div></div>'), []);
    const two = `${chart('<rect x="1" y="1" width="5" height="40"/>')}<div class="pb-chart"><svg><text>x</text></svg></div>`;
    assert.deepEqual(withHtml(two), [DESIGN_ISSUE_LINES.emptyChart]);
    // Svgs after the chart box closes are not examined: the depth walk stops at the matching close.
    assert.deepEqual(withHtml(`${chart('<rect x="1" y="1" width="5" height="40"/>')}<svg><text>x</text></svg>`), []);
  });

  test("a css rule on tr or td that sets a background is flagged, including inside a media query", () => {
    for (const css of [".jobs-table tr.amended{background:#EEE}", ".jobs-table td{background-color:#fff}", "@media (max-width:600px){.jobs-table tr.amended{background:#EEE}}", "tbody tr:nth-child(3){background:red}", ".jobs-a, .jobs-table > td{ background : var(--brand-2) }"]) {
      assert.deepEqual(withCss(css), [DESIGN_ISSUE_LINES.colouredRowCss], css);
    }
    assert.ok(DESIGN_ISSUE_LINES.colouredRowCss.startsWith("css:"));
  });

  test("an inline background style on a tr or td is flagged", () => {
    for (const html of ['<table class="pb-table"><tr style="background:#f3e8ff"><td>x</td></tr></table>', '<table class="pb-table"><tr><td style="color:red;background-color:red">x</td></tr></table>']) {
      assert.deepEqual(withHtml(html), [DESIGN_ISSUE_LINES.colouredRowHtml], html);
    }
    assert.ok(DESIGN_ISSUE_LINES.colouredRowHtml.startsWith("html:"));
  });

  test("backgrounds that are not on a row or cell, or set to nothing, pass", () => {
    for (const css of [".jobs-row{background:#fff}", ".tr-strip{background:red}", "#td{background:red}", ".jobs-table th{background:#eee}", ".jobs-table tr{background:transparent}", ".jobs-table tr{background:none}", ".jobs-table td{border-color:red}", ".jobs-table tr-x{background:red}"]) {
      assert.deepEqual(withCss(css), [], css);
    }
    for (const html of ['<table class="pb-table"><tr class="x" data-go="dashboard"><td>x</td></tr></table>', '<table class="pb-table"><tr><td style="text-align:right">1</td></tr></table>', '<p style="background:red">x</p>']) {
      assert.deepEqual(withHtml(html), [], html);
    }
    assert.deepEqual(checkScreen(clean("jobs"), "jobs", 16_000, taken), []);
  });

  test("isDesignIssue knows the three design lines and no other check line", () => {
    for (const line of Object.values(DESIGN_ISSUE_LINES)) assert.ok(isDesignIssue(line), line);
    const b = clean("jobs");
    const blocking = checkScreen({ ...b, html: `${b.html}<form></form><p id="title"></p>` }, "jobs", 10, taken);
    assert.ok(blocking.length >= 3);
    for (const line of blocking) assert.ok(!isDesignIssue(line), line);
    assert.ok(!isDesignIssue(""));
  });

  test("a screen flagged by a design check still assembles: the checks are per screen, not in the validator", () => {
    const builds = Object.fromEntries(plan.screens.map((sc) => [sc.slug, clean(sc.slug)]));
    builds.dashboard = { ...builds.dashboard, html: `${builds.dashboard.html}${chart("<text>x</text>").replace("jobs-chart", "dashboard-chart")}`, css: `${builds.dashboard.css} .dashboard-table tr{background:red}` };
    assert.ok(checkScreen(builds.dashboard, "dashboard", 16_000, taken).length === 2);
    const { html, issues } = assembleDocument(plan, style, null, builds, "Acme");
    assert.deepEqual(issues, []);
    assert.ok(html.includes('id="dashboard-chart"'));
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
