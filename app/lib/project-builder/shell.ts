/**
 * The document shell the server writes around the planned screens: the
 * doctype, the head with the title and one base stylesheet (the CSS custom
 * properties from the house style, the spacing and type scales and the
 * shared component classes), the navigation bar with one button per screen
 * and the logo or wordmark, one empty section per screen, and the screen
 * switcher script. Pure string work; no model writes any of it, so the
 * Round 1 validator's skeleton checks pass by construction.
 *
 * The shell writes no link, no URL, no inline handler and no form; its two
 * metas are charset and viewport, which the safety pass keeps.
 */
import type { HouseStyle } from "./house-style.ts";
import { LOGO_PLACEHOLDER } from "./prototype-html.ts";
import { PROTOTYPE_HTML_MAX_CHARS } from "./prototype.ts";
import type { PlanScreen, PrototypePlan } from "./plan.ts";

/** The ids the shell itself uses; a screen may not reuse them. */
export const SHELL_IDS: readonly string[] = ["pb-base", "pb-switch"];

/** The most characters one screen's html, css and js may take together, whatever the shell leaves. */
export const SCREEN_BUDGET_MAX = 16_000;
/** Room left under the stored cap for the scoped style and script wrappers placement adds around each screen. */
const SHELL_HEADROOM = 1_000;

/** The class names every screen is told to use, one line each saying what it is for. */
export const SHELL_CLASSES: ReadonlyArray<{ name: string; use: string }> = [
  { name: "pb-container", use: "the centred content wrapper of a screen (max width 1280px, 24px side padding); wrap each screen's content in one" },
  { name: "pb-screen-title", use: "the h1 of a screen" },
  { name: "pb-grid", use: "a responsive grid of cards or figures (auto fit, 220px minimum)" },
  { name: "pb-card", use: "a white panel with padding, a border and the shared radius" },
  { name: "pb-card-title", use: "the heading inside a card" },
  { name: "pb-figure", use: "one figure card on a dashboard" },
  { name: "pb-figure-value", use: "the big number in a figure card" },
  { name: "pb-figure-label", use: "the label under the number" },
  { name: "pb-figure-delta", use: "the change against last month; add pb-figure-delta--up or pb-figure-delta--down" },
  { name: "pb-toolbar", use: "the row above a table that holds the search box, filters and buttons" },
  { name: "pb-search", use: "a search input" },
  { name: "pb-select", use: "a filter select" },
  { name: "pb-table", use: "a data table (sticky header, zebra rows); put it inside a pb-table-wrap for horizontal scrolling" },
  { name: "pb-table-wrap", use: "the scrolling wrapper around a table" },
  { name: "pb-label", use: "a small status label; add pb-label--ok, pb-label--warn, pb-label--bad or pb-label--info" },
  { name: "pb-button", use: "a primary button; add pb-button--secondary for a quiet one; always type=\"button\"" },
  { name: "pb-form", use: "a form layout of fields (a div, never a form element)" },
  { name: "pb-field", use: "one label and input pair" },
  { name: "pb-input", use: "a text input, textarea or select in a field" },
  { name: "pb-notice", use: "a short success or information message shown after a button press" },
  { name: "pb-detail", use: "a two column definition list of a record's fields" },
  { name: "pb-list", use: "a vertical list of items with dividers" },
  { name: "pb-chart", use: "the box around an inline SVG chart" },
  { name: "pb-muted", use: "secondary text" },
];

/** The class list as the screen prompt lists it, so every screen builds on the shell's styles instead of writing its own. */
export function shellClassLines(): string[] {
  return SHELL_CLASSES.map((c) => `${c.name}: ${c.use}`);
}

/** `min(16,000, floor((cap - shell - 1,000) / n))`: the characters each of n screens may use for html, css and js together. */
export function shellScreenBudget(shellChars: number, screenCount: number): number {
  const n = Math.max(1, screenCount);
  return Math.max(0, Math.min(SCREEN_BUDGET_MAX, Math.floor((PROTOTYPE_HTML_MAX_CHARS - shellChars - SHELL_HEADROOM) / n)));
}

/** For the shell's own attribute and text values (slugs, titles, the company name): nothing a prospect typed may close a tag or an attribute. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Only a six digit hex colour reaches the stylesheet; anything else from the style read falls back, so a value can never carry CSS. */
function colour(value: string | undefined, fallback: string): string {
  return value && HEX_RE.test(value) ? value : fallback;
}

/** A font stack for a CSS custom property: quotes become plain so the value cannot break out of the declaration. */
function fontValue(stack: string, fallback: string): string {
  const clean = stack.replace(/[;{}<>]/g, "").trim();
  return clean || fallback;
}

export interface ShellVariables {
  brand1: string;
  brand2: string;
  brand3: string;
  bg: string;
  text: string;
  navBg: string;
  navText: string;
  fontHeading: string;
  fontBody: string;
}

/** The accent of the neutral style, used when the site and Brandfetch gave no first colour. */
const NEUTRAL_ACCENT = "#2F5D7C";

/** The seven house style variables plus the nav pair; missing colours fall back to the first colour, then the neutral accent. */
export function shellVariables(style: HouseStyle): ShellVariables {
  const brand1 = colour(style.colours[0], NEUTRAL_ACCENT);
  const brand2 = colour(style.colours[1], brand1);
  const brand3 = colour(style.colours[2], brand2);
  return {
    brand1,
    brand2,
    brand3,
    bg: colour(style.background, "#FFFFFF"),
    text: colour(style.text, "#1F2A37"),
    navBg: colour(style.navBackground, brand1),
    navText: colour(style.navText, "#FFFFFF"),
    fontHeading: fontValue(style.headingFont.stack, "system-ui, sans-serif"),
    fontBody: fontValue(style.bodyFont.stack, "system-ui, sans-serif"),
  };
}

/**
 * The one base stylesheet: the custom properties first, then the shared
 * component classes. Fixed status and line colours sit beside the brand
 * variables so a screen's labels read the same whatever the palette; the
 * screen prompt names these classes and is told not to restyle them.
 */
export function baseCss(v: ShellVariables): string {
  return [
    `:root{--brand-1:${v.brand1};--brand-2:${v.brand2};--brand-3:${v.brand3};--bg:${v.bg};--text:${v.text};--nav-bg:${v.navBg};--nav-text:${v.navText};--font-heading:${v.fontHeading};--font-body:${v.fontBody};--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--space-7:48px;--text-1:12px;--text-2:14px;--text-3:16px;--text-4:20px;--text-5:24px;--text-6:32px;--radius:6px;--line:#DCE3E0;--surface:#FFFFFF;--ok:#1E7A46;--warn:#9A6400;--bad:#B3261E;--info:#1F5F8B}`,
    `*{box-sizing:border-box}`,
    `html,body{margin:0;padding:0}`,
    `body{background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:var(--text-2);line-height:1.5}`,
    `h1,h2,h3,h4{font-family:var(--font-heading);margin:0 0 var(--space-3);line-height:1.2}`,
    `h1{font-size:var(--text-5)}h2{font-size:var(--text-4)}h3{font-size:var(--text-3)}`,
    `p{margin:0 0 var(--space-3)}`,
    `.pb-nav{display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;background:var(--nav-bg);color:var(--nav-text);padding:var(--space-3) var(--space-5);width:100%}`,
    `.pb-nav-brand{display:flex;align-items:center;gap:var(--space-3);margin-right:var(--space-5)}`,
    `.pb-nav-logo{height:32px;width:auto;max-width:180px;display:block}`,
    `.pb-nav-wordmark{font-family:var(--font-heading);font-size:var(--text-4);font-weight:700;color:var(--nav-text)}`,
    `.pb-nav-button{font-family:var(--font-body);font-size:var(--text-2);background:transparent;color:var(--nav-text);border:1px solid transparent;border-radius:var(--radius);padding:var(--space-2) var(--space-3);cursor:pointer;opacity:.85}`,
    `.pb-nav-button:hover{opacity:1;border-color:rgba(255,255,255,.4)}`,
    `.pb-nav-button.is-active{background:var(--brand-1);color:#fff;opacity:1;border-color:transparent}`,
    `.pb-nav-button:focus-visible,.pb-button:focus-visible,.pb-input:focus-visible,.pb-search:focus-visible,.pb-select:focus-visible{outline:2px solid var(--brand-1);outline-offset:2px}`,
    `.pb-screen{display:none}`,
    `.pb-screen.is-visible{display:block}`,
    `.pb-container{max-width:1280px;margin:0 auto;padding:var(--space-5) var(--space-5) var(--space-7)}`,
    `.pb-screen-title{font-size:var(--text-5);margin-bottom:var(--space-4)}`,
    `.pb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-4);margin-bottom:var(--space-5)}`,
    `.pb-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:var(--space-4);margin-bottom:var(--space-4)}`,
    `.pb-card-title{font-size:var(--text-3);margin-bottom:var(--space-3)}`,
    `.pb-figure{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:var(--space-4)}`,
    `.pb-figure-value{font-family:var(--font-heading);font-size:var(--text-6);font-weight:700;line-height:1.1;color:var(--brand-1)}`,
    `.pb-figure-label{font-size:var(--text-2);color:#55636B;margin-top:var(--space-1)}`,
    `.pb-figure-delta{font-size:var(--text-1);margin-top:var(--space-2);color:#55636B}`,
    `.pb-figure-delta--up{color:var(--ok)}`,
    `.pb-figure-delta--down{color:var(--bad)}`,
    `.pb-toolbar{display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;margin-bottom:var(--space-3)}`,
    `.pb-search,.pb-select,.pb-input{font-family:var(--font-body);font-size:var(--text-2);padding:var(--space-2) var(--space-3);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--text);min-height:36px}`,
    `.pb-search{min-width:220px;flex:1}`,
    `.pb-table-wrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:var(--space-4)}`,
    `.pb-table{width:100%;border-collapse:collapse;font-size:var(--text-2)}`,
    `.pb-table th{position:sticky;top:0;background:#F4F6F5;text-align:left;font-weight:600;padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--line);white-space:nowrap}`,
    `.pb-table td{padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--line);vertical-align:top}`,
    `.pb-table tbody tr:nth-child(even){background:#FAFBFA}`,
    `.pb-table tbody tr:hover{background:#F0F4F2}`,
    `.pb-label{display:inline-block;font-size:var(--text-1);font-weight:600;padding:2px var(--space-2);border-radius:999px;background:#E8ECE9;color:#2F3B40;white-space:nowrap}`,
    `.pb-label--ok{background:#DDF3E6;color:var(--ok)}`,
    `.pb-label--warn{background:#FBEFD3;color:var(--warn)}`,
    `.pb-label--bad{background:#F9DEDC;color:var(--bad)}`,
    `.pb-label--info{background:#DCEBF5;color:var(--info)}`,
    `.pb-button{font-family:var(--font-body);font-size:var(--text-2);font-weight:600;background:var(--brand-1);color:#fff;border:1px solid var(--brand-1);border-radius:var(--radius);padding:var(--space-2) var(--space-4);cursor:pointer;min-height:36px}`,
    `.pb-button:hover{filter:brightness(.92)}`,
    `.pb-button--secondary{background:var(--surface);color:var(--brand-1)}`,
    `.pb-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-3) var(--space-4);margin-bottom:var(--space-4)}`,
    `.pb-field{display:flex;flex-direction:column;gap:var(--space-1)}`,
    `.pb-field label{font-size:var(--text-1);font-weight:600;color:#55636B}`,
    `.pb-input{width:100%}`,
    `.pb-notice{background:#DDF3E6;color:var(--ok);border-radius:var(--radius);padding:var(--space-2) var(--space-3);margin:var(--space-3) 0;font-size:var(--text-2)}`,
    `.pb-notice:empty{display:none}`,
    `.pb-detail{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:var(--space-2) var(--space-4);margin:0 0 var(--space-4)}`,
    `.pb-detail dt{font-weight:600;color:#55636B;margin:0}`,
    `.pb-detail dd{margin:0}`,
    `.pb-list{list-style:none;margin:0 0 var(--space-4);padding:0}`,
    `.pb-list li{padding:var(--space-3) 0;border-bottom:1px solid var(--line)}`,
    `.pb-chart{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:var(--space-4);margin-bottom:var(--space-4)}`,
    `.pb-chart svg{width:100%;height:auto;display:block}`,
    `.pb-muted{color:#55636B;font-size:var(--text-1)}`,
    `@media (max-width:720px){.pb-container{padding:var(--space-4)}.pb-nav{padding:var(--space-2) var(--space-3)}}`,
  ].join("\n");
}

/** The exact opening tag of a screen's section, shared with the placement step so the replace target is unique and known. */
export function screenSectionOpen(screen: Pick<PlanScreen, "slug" | "title">, visible: boolean): string {
  return `<section class="pb-screen${visible ? " is-visible" : ""}" data-screen="${escapeHtml(screen.slug)}" aria-label="${escapeHtml(screen.title)}">`;
}

/** The switcher: one click listener on the document that shows the `data-go` target and marks its nav button. */
export const SWITCHER_SCRIPT =
  "(function(){document.addEventListener('click',function(e){var t=e.target;while(t&&t.getAttribute&&!t.getAttribute('data-go')){t=t.parentNode;}if(!t||!t.getAttribute){return;}var slug=t.getAttribute('data-go');if(!slug){return;}var screens=document.querySelectorAll('.pb-screen');for(var i=0;i<screens.length;i++){var on=screens[i].getAttribute('data-screen')===slug;if(on){screens[i].classList.add('is-visible');}else{screens[i].classList.remove('is-visible');}}var buttons=document.querySelectorAll('.pb-nav-button[data-go]');for(var j=0;j<buttons.length;j++){if(buttons[j].getAttribute('data-go')===slug){buttons[j].classList.add('is-active');}else{buttons[j].classList.remove('is-active');}}window.scrollTo(0,0);});})();";

/**
 * The whole document skeleton for a plan: head, base stylesheet, nav, one
 * empty section per screen (the first visible), the switcher. `companyName`
 * is the wordmark and the logo's alt text.
 */
export function renderShell(plan: Pick<PrototypePlan, "screens">, style: HouseStyle, companyName: string, projectName = ""): string {
  const v = shellVariables(style);
  const name = companyName.trim() || style.siteName.trim() || "Prototype";
  const title = `${(projectName.trim() || name).slice(0, 80)} prototype`;
  const brand = style.logo
    ? `<img class="pb-nav-logo" src="${LOGO_PLACEHOLDER}" alt="${escapeHtml(name)}">`
    : `<span class="pb-nav-wordmark">${escapeHtml(name)}</span>`;
  const buttons = plan.screens
    .map((s, i) => `<button type="button" class="pb-nav-button${i === 0 ? " is-active" : ""}" data-go="${escapeHtml(s.slug)}">${escapeHtml(s.title)}</button>`)
    .join("");
  const sections = plan.screens.map((s, i) => `${screenSectionOpen(s, i === 0)}</section>`).join("\n");
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style id="pb-base">\n${baseCss(v)}\n</style>`,
    "</head>",
    "<body>",
    `<header class="pb-nav"><div class="pb-nav-brand">${brand}</div>${buttons}</header>`,
    "<main>",
    sections,
    "</main>",
    `<script id="pb-switch">${SWITCHER_SCRIPT}</script>`,
    "</body>",
    "</html>",
  ].join("\n");
}
