/**
 * One screen at a time: the parse of a screen call's answer (`html`, `css`,
 * `js` as separate fields), the per screen check the server runs before
 * assembly (no nested screen, ids prefixed by the slug and unique, no banned
 * construct, a size cap), the placement of each screen's parts into the
 * shell, and the assembly that then runs the Round 1 safety pass and
 * validator unchanged. Pure string work on markers the shell wrote.
 *
 * Issue lines are plain English so they go straight into the retry prompt.
 */
import { SchemaError } from "../tools/schema.ts";
import type { HouseStyle } from "./house-style.ts";
import { sanitisePrototypeHtml, validatePrototypeHtml } from "./prototype-html.ts";
import type { PlanScreen, PrototypePlan } from "./plan.ts";
import type { ScreenBuild } from "./prototype.ts";
import { PROTOTYPE_REPLY_CHARS } from "./schemas.ts";
import { SHELL_IDS, renderShell, screenSectionOpen } from "./shell.ts";

export type { ScreenBuild };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The parser `callModel` runs: `html` must be non empty; `css` and `js` may be empty; each is capped before the check. */
export function parseScreenBuild(raw: unknown): ScreenBuild {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  if (typeof raw.html !== "string" || !raw.html.trim()) throw new SchemaError("html is missing");
  return {
    html: raw.html.trim().slice(0, PROTOTYPE_REPLY_CHARS),
    css: typeof raw.css === "string" ? raw.css.trim().slice(0, PROTOTYPE_REPLY_CHARS) : "",
    js: typeof raw.js === "string" ? raw.js.trim().slice(0, PROTOTYPE_REPLY_CHARS) : "",
  };
}

// ── Checks ───────────────────────────────────────────────────────────────────

// The constructs the Round 1 safety pass would strip or the validator would
// fail on the whole document. Catching them per screen means one screen is
// retried with the reason named, instead of the whole press failing after
// every build call was spent. Each entry's line is written for the model.
const BANNED_TAGS: ReadonlyArray<{ re: RegExp; line: string }> = [
  { re: /<\/?script\b/i, line: "Return scripts in js and styles in css, not inside html; no <script> tag anywhere." },
  { re: /<\/?style\b/i, line: "Return styles in css, not inside html; no <style> tag anywhere." },
  { re: /<link\b/i, line: "No <link> tags: the shell already loads the fonts." },
  { re: /<(?:iframe|object|embed)\b/i, line: "No <iframe>, <object> or <embed>." },
  { re: /<base\b/i, line: "No <base> tag." },
  { re: /<meta\b/i, line: "No <meta> tags: the shell writes the head." },
  { re: /<form\b/i, line: "No form elements: use inputs and a button of type button." },
  { re: /<\/?(?:html|head|body)\b/i, line: "No <html>, <head> or <body> tags: return the inner content of the section only." },
  { re: /<img\b/i, line: "No <img> tags: draw icons and charts with CSS or inline SVG." },
];

// Any absolute URL is refused outright: the CSP would block the load anyway, and a broken image or link looks like a bug to the prospect.
const URL_RE = /https?:\/\//i;
/** A protocol relative URL where a URL would be read: after an attribute equals sign, a quote or `url(`. */
const PROTOCOL_RELATIVE_RE = /(?:=\s*["']?|url\(\s*["']?|["'])\/\/[a-z0-9]/i;

// Script that would reach outside the document: network, storage, dialogs,
// navigation and the parent frame. The sandbox and CSP already stop most of
// these; refusing them here keeps the screen from failing silently at run
// time and gives the retry a plain reason.
const BANNED_JS: ReadonlyArray<{ re: RegExp; what: string }> = [
  { re: /\bfetch\s*\(/, what: "fetch(" },
  { re: /\bXMLHttpRequest\b/, what: "XMLHttpRequest" },
  { re: /\bWebSocket\b/, what: "WebSocket" },
  { re: /\blocalStorage\b/, what: "localStorage" },
  { re: /\bsessionStorage\b/, what: "sessionStorage" },
  { re: /\bdocument\.cookie\b/, what: "document.cookie" },
  { re: /\bwindow\.open\s*\(/, what: "window.open" },
  { re: /\balert\s*\(/, what: "alert(" },
  { re: /\bconfirm\s*\(/, what: "confirm(" },
  { re: /\bprompt\s*\(/, what: "prompt(" },
  { re: /\beval\s*\(/, what: "eval(" },
  { re: /\bimport\s*\(/, what: "import(" },
  // The page's location, not a data field called location (`order.location.name` is fine): bare `location.` or `location =`, or off window, document, self or globalThis.
  { re: /(?<![\w$.])location\s*(?:\.|=(?!=))/, what: "location" },
  { re: /\b(?:window|document|self|globalThis)\s*\.\s*location\b/, what: "window.location" },
  { re: /\bdocument\.write\b/, what: "document.write" },
  { re: /(?<![\w$.])(?:top|parent)\s*\./, what: "top. or parent." },
  { re: /\bnavigator\.sendBeacon\b/, what: "navigator.sendBeacon" },
];

// Quoted ids only, as the Round 1 validator reads them; an unquoted id=foo is invisible to both (a known limit, inside the sandbox).
const ID_RE = /\sid\s*=\s*["']([^"']*)["']/gi;
// Document wide lookups by id: a screen's script must stay inside its own section, so a lookup of another screen's id is refused.
const SELECTOR_RE = /document\s*\.\s*(?:getElementById\s*\(\s*["']([^"']+)["']|querySelector(?:All)?\s*\(\s*["']#([a-zA-Z0-9_-]+))/g;

// ── Design checks ────────────────────────────────────────────────────────────
// The two failures seen on the 9 November 2026 live build: a chart whose marks
// were left to script that did not run, and a coloured table row for status.
// Both go through the one retry like every other check; after the retry the
// run treats them as advisory (`isDesignIssue`), so they never fail a press.

/** The exact lines the design checks produce, so the run can tell them from a blocking line. */
export const DESIGN_ISSUE_LINES = {
  emptyChart: "html: a chart in a pb-chart box has an svg with no marks drawn (no rect, path, polyline, circle or polygon, and at most two line elements). Draw every bar, line and point as svg elements in the html; js may only filter them.",
  colouredRowCss: "css: a rule on tr or td sets a background. Coloured rows and cells are not allowed; show the state with a pb-label in a cell and remove the background.",
  colouredRowHtml: "html: a tr or td carries an inline background style. Coloured rows and cells are not allowed; show the state with a pb-label in a cell and remove the style.",
} as const;

const DESIGN_ISSUE_SET: ReadonlySet<string> = new Set(Object.values(DESIGN_ISSUE_LINES));

/** True for a line one of the two design checks wrote; every other check line is blocking. Exact string match, so a blocking line can never be read as advisory. */
export function isDesignIssue(line: string): boolean {
  return DESIGN_ISSUE_SET.has(line);
}

const CHART_OPEN_RE = /<([a-z][a-z0-9-]*)\b[^>]*\bclass\s*=\s*["'][^"']*\bpb-chart\b[^"']*["'][^>]*>/gi;
const SVG_RE = /<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi;
const MARK_RE = /<(?:rect|path|polyline|circle|polygon)\b/i;
const LINE_RE = /<line\b/gi;

/** The html inside a `pb-chart` element: from the end of its opening tag to the matching close, counting tags of the same name, or to the end. */
function chartInner(html: string, from: number, tag: string): string {
  const tagRe = new RegExp(`<(\\/?)${tag}\\b`, "gi");
  let depth = 1;
  for (const m of html.slice(from).matchAll(tagRe)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(from, from + m.index);
  }
  return html.slice(from);
}

/**
 * True when a `pb-chart` box holds an svg with nothing drawn: no rect, path,
 * polyline, circle or polygon, and at most two line elements. Two lines are
 * the axes, so a chart that drew axes and a legend with no bars (the 9
 * November case) is caught; three or more lines count as a drawn line chart.
 */
function hasEmptyChart(html: string): boolean {
  for (const open of html.matchAll(CHART_OPEN_RE)) {
    const inner = chartInner(html, open.index + open[0].length, open[1]);
    for (const svg of inner.match(SVG_RE) ?? []) {
      if (MARK_RE.test(svg)) continue;
      if ((svg.match(LINE_RE) ?? []).length >= 3) continue;
      return true;
    }
  }
  return false;
}

const CSS_RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
const ROW_SELECTOR_RE = /(^|[\s>+~])(tr|td)(?![\w-])/i;
const BACKGROUND_SET_RE = /(^|[;\s])background(-color)?\s*:\s*(?!(none|transparent|inherit|unset|initial)\b)/i;
const ROW_STYLE_RE = /<(tr|td)\b[^>]*\sstyle\s*=\s*["'][^"']*\bbackground(-color)?\s*:/i;

/**
 * True when a css rule whose selector reaches a tr or td sets a background to
 * something; rules inside at-rules are reached too. A value of none,
 * transparent, inherit, unset or initial is a reset, not a colour, and passes;
 * anything else (a hover, a selected row, a zebra cancel to white) is flagged,
 * because the shell's own row styles are the only row backgrounds allowed.
 */
function colouredRowCss(css: string): boolean {
  for (const m of css.matchAll(CSS_RULE_RE)) {
    const selectors = m[1].split(",").map((part) => part.trim());
    if (selectors.some((part) => ROW_SELECTOR_RE.test(part)) && BACKGROUND_SET_RE.test(m[2])) return true;
  }
  return false;
}

/** Every `id="..."` value in a fragment, in order, duplicates included. */
export function collectIds(html: string): string[] {
  return [...html.matchAll(ID_RE)].map((m) => m[1].trim()).filter(Boolean);
}

/**
 * The issue lines for one screen; empty means it passes. `takenIds` holds
 * the shell's ids and those of every screen accepted so far. `plannedSlugs`
 * lets the prefix rule refuse an id that belongs to a longer planned slug
 * (`jobs` may not write `jobs-list-x` when `jobs-list` is a screen), so two
 * screens can never share an id by construction.
 */
export function checkScreen(build: ScreenBuild, slug: string, budget: number, takenIds: ReadonlySet<string> = new Set(SHELL_IDS), plannedSlugs: readonly string[] = []): string[] {
  const issues: string[] = [];
  const fields: Array<[string, string]> = [
    ["html", build.html],
    ["css", build.css],
    ["js", build.js],
  ];
  const prefix = `${slug}-`;

  if (fields.some(([, text]) => /data-screen/i.test(text))) {
    issues.push("The screen contains data-screen. Only the server writes screen sections; remove it from html, css and js.");
  }
  for (const [name, text] of fields) {
    for (const banned of BANNED_TAGS) {
      if (banned.re.test(text)) {
        issues.push(`${name}: ${banned.line}`);
        break;
      }
    }
    if (URL_RE.test(text) || PROTOCOL_RELATIVE_RE.test(text)) issues.push(`${name}: no URLs of any kind (http, https or protocol relative); everything is drawn in the document.`);
  }
  for (const [name, text] of fields.slice(0, 2)) {
    if (/@import\b/i.test(text)) issues.push(`${name}: no @import.`);
    if (/\burl\s*\(/i.test(text)) issues.push(`${name}: no url() in styles.`);
  }
  for (const banned of BANNED_JS) {
    if (banned.re.test(build.js)) issues.push(`js: do not use ${banned.what} in the script.`);
  }
  if (/<\/\s*script/i.test(build.js)) issues.push("js: the text </script must not appear in the script.");
  if (/<\/\s*style/i.test(build.css)) issues.push("css: the text </style must not appear in the styles.");
  for (const m of build.js.matchAll(SELECTOR_RE)) {
    const id = m[1] ?? m[2] ?? "";
    if (id && !id.startsWith(prefix)) {
      issues.push(`js: the script reaches outside its screen (document lookup of #${id}); use root.querySelector and ids that start with ${prefix}.`);
      break;
    }
  }

  const ids = collectIds(build.html);
  const unprefixed = ids.filter((id) => !id.startsWith(prefix));
  if (unprefixed.length > 0) issues.push(`html: every id must start with ${prefix}; these do not: ${[...new Set(unprefixed)].slice(0, 8).join(", ")}.`);
  for (const other of plannedSlugs) {
    if (other === slug || !other.startsWith(prefix)) continue;
    const theirs = ids.filter((id) => id.startsWith(`${other}-`));
    if (theirs.length > 0) issues.push(`html: ids starting with ${other}- belong to the ${other} screen; on this screen use ${prefix} followed by something else: ${[...new Set(theirs)].slice(0, 8).join(", ")}.`);
  }
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const id of ids) {
    if (seen.has(id) && !dupes.includes(id)) dupes.push(id);
    seen.add(id);
  }
  if (dupes.length > 0) issues.push(`html: these ids are used more than once: ${dupes.slice(0, 8).join(", ")}. Every id must be unique.`);
  const collisions = [...seen].filter((id) => takenIds.has(id));
  if (collisions.length > 0) issues.push(`html: these ids are already used elsewhere in the document: ${collisions.slice(0, 8).join(", ")}.`);

  if (hasEmptyChart(build.html)) issues.push(DESIGN_ISSUE_LINES.emptyChart);
  if (colouredRowCss(build.css)) issues.push(DESIGN_ISSUE_LINES.colouredRowCss);
  if (ROW_STYLE_RE.test(build.html)) issues.push(DESIGN_ISSUE_LINES.colouredRowHtml);

  const size = build.html.length + build.css.length + build.js.length;
  if (size > budget) issues.push(`The screen is ${size} characters; it must be at most ${budget}. Shorten the sample data, not the components.`);

  return issues;
}

// ── Placement ────────────────────────────────────────────────────────────────

/**
 * Scopes every rule under `[data-screen="slug"]` with a small brace walker:
 * at-rules are kept, their inner rules are prefixed, keyframes and font
 * faces pass through, and body, html or :root selectors become the screen
 * itself. Comments are removed first. Cosmetic only: the shell's own rules
 * come first and the whole document runs inside the sandbox.
 */
export function scopeCss(css: string, slug: string): string {
  const scope = `[data-screen="${slug}"]`;
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let buf = "";
  const stack: string[] = [];
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === "{") {
      const sel = buf.trim();
      const passThrough = stack.some((s) => /^@(?:-webkit-)?keyframes\b|^@font-face\b/i.test(s)) || /^@font-face\b/i.test(sel);
      let text = sel;
      if (sel && !sel.startsWith("@") && !passThrough) {
        text = sel
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => (/^(?:body|html|:root)$/i.test(s) ? scope : /^(?:body|html|:root)\b/i.test(s) ? `${scope} ${s.replace(/^(?:body|html|:root)\s*/i, "")}` : `${scope} ${s}`))
          .join(", ");
      }
      out += `${text} {`;
      stack.push(sel);
      buf = "";
    } else if (ch === "}") {
      out += `${buf.trim()}}\n`;
      buf = "";
      stack.pop();
    } else {
      buf += ch;
    }
  }
  return (out + buf.trim()).trim();
}

/** The script wrapper: an IIFE with `root` bound to the screen's section, placed before the switcher. */
export function wrapScreenScript(js: string, slug: string): string {
  return `<script data-screen-script="${slug}">\n(function(){var root=document.querySelector('[data-screen="${slug}"]');if(!root){return;}\n${js}\n})();\n</script>`;
}

export interface PlacedScreen {
  screen: PlanScreen;
  build: ScreenBuild;
}

/** Each screen's html into its empty section, its css scoped into the head, its js wrapped before `#pb-switch`. */
export function placeScreens(shell: string, placed: readonly PlacedScreen[]): string {
  let out = shell;
  const styles: string[] = [];
  const scripts: string[] = [];
  for (const { screen, build } of placed) {
    // The shell wrote the first planned screen visible and the rest hidden; whichever empty section exists is the target.
    for (const visible of [true, false]) {
      const open = screenSectionOpen(screen, visible);
      const target = `${open}</section>`;
      if (!out.includes(target)) continue;
      // A function replacement, so `$'`, `` $` `` and `$&` in a screen's text are inserted literally, not expanded.
      out = out.replace(target, () => `${open}\n${build.html}\n</section>`);
      break;
    }
    if (build.css.trim()) styles.push(`<style data-screen-style="${screen.slug}">\n${scopeCss(build.css, screen.slug)}\n</style>`);
    if (build.js.trim()) scripts.push(wrapScreenScript(build.js, screen.slug));
  }
  if (styles.length > 0) out = out.replace("</head>", () => `${styles.join("\n")}\n</head>`);
  if (scripts.length > 0) out = out.replace('<script id="pb-switch">', () => `${scripts.join("\n")}\n<script id="pb-switch">`);
  return out;
}

export interface AssembledDocument {
  html: string;
  /** The Round 1 validator's issues; the run stores nothing while any remain. */
  issues: string[];
}

/** Shell, placement, then the Round 1 safety pass and validator unchanged. */
export function assembleDocument(plan: PrototypePlan, style: HouseStyle, fontHref: string | null, builds: Record<string, ScreenBuild>, companyName: string, projectName = ""): AssembledDocument {
  const shell = renderShell(plan, style, companyName, projectName);
  const placed: PlacedScreen[] = plan.screens.filter((s) => builds[s.slug]).map((s) => ({ screen: s, build: builds[s.slug] }));
  const html = sanitisePrototypeHtml(placeScreens(shell, placed), fontHref);
  return { html, issues: validatePrototypeHtml(html) };
}
