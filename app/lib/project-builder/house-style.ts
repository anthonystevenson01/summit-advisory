/**
 * The prospect's house style, read from their own website: the shape the
 * prototype prompt and the serve step use, the neutral fallback, the Google
 * Fonts allow list, and the pure extraction from page HTML and stylesheet
 * text (logo candidates, stylesheet links, colours, fonts, tagline), plus
 * the logo byte checks, the SVG sanitiser and the data URI builder. Pure: no
 * network, no Redis, no env. house-style-read.ts does the fetching through
 * the Ask Summit crawler and hands the text and bytes to these functions.
 */
import { cutAtWord, decodeEntities } from "../ask-summit/crawl-rules.ts";
import { isSameHost } from "../ask-summit/validation.ts";
import type { StyleStatus } from "./prototype.ts";

// ── Shape ────────────────────────────────────────────────────────────────────

/** Why the neutral style was used; empty when some of the look was found. Picks the one plain line the dock shows. */
export type StyleReason = "" | "no-website" | "unreadable" | "nothing-usable";

/** A font for the prototype: a Google Fonts family the CSP lets load, or none, plus the CSS stack to fall back on. */
export interface FontChoice {
  /** Only ever a family on GOOGLE_FONTS. */
  family: string | null;
  stack: string;
}

/** The logo as checked bytes in a data URI, so the prototype never loads anything from the company's site. */
export interface HouseLogo {
  dataUri: string;
  mime: string;
  bytes: number;
}

/**
 * What `brief-style:{id}` holds and the prompts read: the company's look as
 * found on its website, or the neutral style with a reason. `host` is the
 * website it was read from; a different host on a later press means the
 * site is read again and the prototype is rebuilt.
 */
export interface HouseStyle {
  status: StyleStatus;
  reason: StyleReason;
  host: string | null;
  readAt: string;
  siteName: string;
  tagline: string;
  colours: string[];
  background: string;
  text: string;
  headingFont: FontChoice;
  bodyFont: FontChoice;
  logo: HouseLogo | null;
}

/** The caps on the read: a 200 KB logo, a 160 character tagline, and how many logos, stylesheets and colours are tried or kept. */
export const LOGO_MAX_BYTES = 204_800;
export const TAGLINE_MAX = 160;
export const MAX_LOGO_CANDIDATES = 4;
export const MAX_STYLESHEETS = 3;
export const MAX_COLOURS = 3;

/** The generic stacks used when no allowed family is found, and after any allowed family as its fallback. */
export const SANS_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const SERIF_STACK = "Georgia, 'Times New Roman', serif";

/**
 * The allow list. A family found on the site is used only when it is on this
 * list, so the prototype loads fonts from fonts.googleapis.com and
 * fonts.gstatic.com and nowhere else. Anything else falls back to a stack.
 */
export const GOOGLE_FONTS: readonly string[] = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Source Sans 3", "Nunito", "Nunito Sans", "Raleway",
  "Work Sans", "DM Sans", "Manrope", "Rubik", "Noto Sans", "PT Sans", "Mulish", "Barlow", "IBM Plex Sans", "IBM Plex Serif",
  "Karla", "Figtree", "Plus Jakarta Sans", "Outfit", "Space Grotesk", "Oswald", "Playfair Display", "Merriweather", "Lora",
  "Libre Baskerville", "Source Serif 4", "Fraunces", "EB Garamond", "Crimson Pro", "Archivo", "Hind", "Quicksand",
  "Josefin Sans", "Cabin", "Bitter", "Roboto Slab", "Ubuntu", "Heebo", "Lexend", "Sora", "Urbanist", "Red Hat Display",
  "Cormorant Garamond",
];

const SERIF_FAMILIES = new Set([
  "IBM Plex Serif", "Playfair Display", "Merriweather", "Lora", "Libre Baskerville", "Source Serif 4", "Fraunces",
  "EB Garamond", "Crimson Pro", "Bitter", "Roboto Slab", "Cormorant Garamond",
]);

const FONT_BY_LOWER = new Map(GOOGLE_FONTS.map((f) => [f.toLowerCase(), f]));

/** Maps a family name (any case) onto the allow list, or returns the sans or serif stack alone. */
export function fontChoice(family: string | null, serif = false): FontChoice {
  if (family && FONT_BY_LOWER.has(family.toLowerCase())) {
    const name = FONT_BY_LOWER.get(family.toLowerCase()) as string;
    return { family: name, stack: `'${name}', ${SERIF_FAMILIES.has(name) ? SERIF_STACK : SANS_STACK}` };
  }
  return { family: null, stack: serif ? SERIF_STACK : SANS_STACK };
}

/** The plain look used when there is no website, it cannot be read or nothing usable is on it. Generation never fails for want of a style. */
export const NEUTRAL_HOUSE_STYLE: HouseStyle = {
  status: "none",
  reason: "no-website",
  host: null,
  readAt: "",
  siteName: "",
  tagline: "",
  colours: ["#2F5D7C"],
  background: "#FFFFFF",
  text: "#1F2A37",
  headingFont: fontChoice("Inter"),
  bodyFont: fontChoice("Inter"),
  logo: null,
};

/** The neutral style stamped with the reason, the host tried and the time, so the dock can say why the look is plain. */
export function neutralStyle(reason: Exclude<StyleReason, "">, host: string | null = null, readAt = new Date().toISOString()): HouseStyle {
  return { ...NEUTRAL_HOUSE_STYLE, reason, host, readAt, colours: [...NEUTRAL_HOUSE_STYLE.colours] };
}

// ── Small HTML helpers ───────────────────────────────────────────────────────

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const inner = tag.replace(/^<[a-z0-9-]+/i, "").replace(/\/?>$/, "");
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    const name = m[1].toLowerCase();
    if (!(name in out)) out[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function resolveUrl(href: string, pageUrl: string): string | null {
  const value = href.trim();
  if (!value) return null;
  if (/^data:image\//i.test(value)) return value;
  try {
    const url = new URL(value, pageUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

// ── Logo candidates ──────────────────────────────────────────────────────────

/** A logo to try: a URL to fetch through the crawler, or inline SVG markup taken from the page and sanitised. */
export type LogoCandidate = { kind: "url"; url: string } | { kind: "svg"; markup: string };

/**
 * In order: an `<img>` marked "logo" (one inside `<header>` first), an inline
 * `<svg>` marked "logo", the apple touch icon, an SVG or the largest icon
 * link, then og:image. og:image is last because it is usually a social
 * banner, not the mark. At most four, no repeats.
 */
export function findLogoCandidates(html: string, pageUrl: string): LogoCandidate[] {
  const doc = stripComments(html);
  const out: LogoCandidate[] = [];
  const seen = new Set<string>();
  const addUrl = (href: string | undefined) => {
    if (!href) return;
    const url = resolveUrl(href, pageUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ kind: "url", url });
  };

  const isLogo = (a: Record<string, string>, keys: string[]) => keys.some((k) => /logo/i.test(a[k] ?? ""));
  const header = /<header\b[\s\S]*?<\/header\s*>/i.exec(doc)?.[0] ?? "";
  const logoImg = (scope: string) => tags(scope, "img").map(attributes).find((a) => a.src && isLogo(a, ["src", "alt", "class", "id"]));
  const img = logoImg(header) ?? logoImg(doc);
  if (img) addUrl(img.src);

  for (const m of doc.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi)) {
    const open = /^<svg\b[^>]*>/i.exec(m[0])?.[0] ?? "";
    if (isLogo(attributes(open), ["class", "id", "aria-label"])) {
      out.push({ kind: "svg", markup: m[0] });
      break;
    }
  }

  const links = tags(doc, "link").map(attributes);
  const apple = links.find((a) => /apple-touch-icon/i.test(a.rel ?? "") && a.href);
  if (apple) addUrl(apple.href);
  const icons = links.filter((a) => /(^|\s)icon(\s|$)/i.test(a.rel ?? "") && a.href);
  const svgIcon = icons.find((a) => /svg/i.test(a.type ?? "") || /\.svg(\?|$)/i.test(a.href));
  const size = (a: Record<string, string>) => Math.max(0, ...(a.sizes ?? "").split(/\s+/).map((s) => Number.parseInt(s, 10) || 0));
  const largest = [...icons].sort((a, b) => size(b) - size(a))[0];
  addUrl((svgIcon ?? largest)?.href);

  const og = tags(doc, "meta").map(attributes).find((a) => (a.property ?? a.name ?? "").toLowerCase() === "og:image" && a.content);
  if (og) addUrl(og.content);
  return out.slice(0, MAX_LOGO_CANDIDATES);
}

/** `<link rel="stylesheet">` hrefs as absolute URLs, same host first, at most three. */
export function findStylesheetLinks(html: string, pageUrl: string): string[] {
  const host = new URL(pageUrl).hostname;
  const urls: string[] = [];
  for (const a of tags(stripComments(html), "link").map(attributes)) {
    if (!/(^|\s)stylesheet(\s|$)/i.test(a.rel ?? "") || !a.href) continue;
    const url = resolveUrl(a.href, pageUrl);
    if (url && !url.startsWith("data:") && !urls.includes(url)) urls.push(url);
  }
  const same = urls.filter((u) => isSameHost(new URL(u).hostname, host));
  const other = urls.filter((u) => !isSameHost(new URL(u).hostname, host));
  return [...same, ...other].slice(0, MAX_STYLESHEETS);
}

// ── CSS helpers ──────────────────────────────────────────────────────────────

function styleBlocks(html: string): string[] {
  return [...stripComments(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]);
}

function inlineStyles(html: string): string[] {
  return [...stripComments(html).matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => decodeEntities(m[1] ?? m[2] ?? ""));
}

function allCss(html: string, cssTexts: readonly string[]): string {
  return [...styleBlocks(html), ...cssTexts].join("\n").replace(/\/\*[\s\S]*?\*\//g, " ");
}

interface CssRule {
  selectors: string[];
  body: string;
}

function cssRules(css: string): CssRule[] {
  const out: CssRule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selectors: m[1].split(",").map((s) => s.trim().toLowerCase()), body: m[2] });
  }
  return out;
}

function declaration(body: string, property: string): string | null {
  const m = new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*([^;]+)`, "i").exec(body);
  return m ? m[1].replace(/!important/i, "").trim() : null;
}

// ── Colours ──────────────────────────────────────────────────────────────────

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** `#rrggbb` from a hex, rgb() or hsl() token; null for anything else. */
export function normaliseColour(token: string): string | null {
  const t = token.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(t);
  if (m) {
    const v = m[1];
    if (v.length === 3 || v.length === 4) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
    if (v.length === 6 || v.length === 8) return `#${v.slice(0, 6)}`;
    return null;
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(t);
  if (m) return `#${hex2(Number(m[1]))}${hex2(Number(m[2]))}${hex2(Number(m[3]))}`;
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(t);
  if (m) {
    const [r, g, b] = hslToRgb(Number(m[1]) % 360, Number(m[2]) / 100, Number(m[3]) / 100);
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }
  return null;
}

function rgbOf(hex: string): [number, number, number] {
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
}

/** White, black and low saturation greys say nothing about a brand. */
function isBrandish(hex: string): boolean {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (l > 0.94 || l < 0.08) return false;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  // Pale tints (borders, panel backgrounds) need a strong hue to count.
  if (l > 0.85 && s < 0.5) return false;
  return s >= 0.18;
}

function isNear(a: string, b: string): boolean {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 40;
}

const COLOUR_TOKEN_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
const BRAND_VAR_RE = /--([a-z0-9_-]*(?:primary|brand|accent|main|secondary)[a-z0-9_-]*)\s*:\s*([^;}]+)/gi;

/** theme-color first, then brand custom properties, then the most used colours; at most three, greys dropped, near twins merged. */
export function extractColours(html: string, cssTexts: readonly string[]): string[] {
  const ordered: string[] = [];
  const theme = tags(stripComments(html), "meta").map(attributes).find((a) => (a.name ?? "").toLowerCase() === "theme-color" && a.content);
  if (theme) {
    const c = normaliseColour(theme.content);
    if (c) ordered.push(c);
  }
  const css = [allCss(html, cssTexts), ...inlineStyles(html)].join("\n");
  for (const m of css.matchAll(BRAND_VAR_RE)) {
    const token = m[2].match(COLOUR_TOKEN_RE)?.[0];
    const c = token ? normaliseColour(token) : null;
    if (c) ordered.push(c);
  }
  const counts = new Map<string, { n: number; first: number }>();
  let index = 0;
  for (const m of css.matchAll(COLOUR_TOKEN_RE)) {
    const c = normaliseColour(m[0]);
    if (!c) continue;
    const entry = counts.get(c);
    if (entry) entry.n += 1;
    else counts.set(c, { n: 1, first: index });
    index += 1;
  }
  const byUse = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first).map(([c]) => c);
  const out: string[] = [];
  for (const c of [...ordered, ...byUse]) {
    if (!isBrandish(c) || out.some((o) => isNear(o, c))) continue;
    out.push(c);
    if (out.length >= MAX_COLOURS) break;
  }
  return out;
}

/** The page background and text colour from body, html or :root rules; defaults when absent or unreadable. */
export function extractPageColours(html: string, cssTexts: readonly string[]): { background: string; text: string } {
  let background = NEUTRAL_HOUSE_STYLE.background;
  let text = NEUTRAL_HOUSE_STYLE.text;
  for (const rule of cssRules(allCss(html, cssTexts))) {
    if (!rule.selectors.some((s) => s === "body" || s === "html" || s === ":root")) continue;
    const bg = declaration(rule.body, "background-color") ?? declaration(rule.body, "background");
    const bgColour = bg ? normaliseColour(bg.match(COLOUR_TOKEN_RE)?.[0] ?? "") : null;
    if (bgColour) background = bgColour;
    const fg = declaration(rule.body, "color");
    const fgColour = fg ? normaliseColour(fg.match(COLOUR_TOKEN_RE)?.[0] ?? "") : null;
    if (fgColour) text = fgColour;
  }
  return { background, text };
}

// ── Fonts ────────────────────────────────────────────────────────────────────

function familiesOf(value: string): string[] {
  return value.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "").trim()).filter(Boolean);
}

function googleLinkFamilies(html: string, cssTexts: readonly string[]): string[] {
  const hrefs: string[] = [];
  for (const a of tags(stripComments(html), "link").map(attributes)) {
    if (a.href && /fonts\.googleapis\.com\/css/i.test(a.href)) hrefs.push(a.href);
  }
  for (const m of allCss(html, cssTexts).matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/gi)) {
    if (/fonts\.googleapis\.com\/css/i.test(m[1])) hrefs.push(m[1]);
  }
  const out: string[] = [];
  for (const href of hrefs) {
    let url: URL;
    try {
      url = new URL(href, "https://fonts.googleapis.com/");
    } catch {
      continue;
    }
    for (const value of url.searchParams.getAll("family")) {
      for (const part of value.split("|")) {
        const name = part.split(":")[0].replace(/\+/g, " ").trim();
        if (name && !out.includes(name)) out.push(name);
      }
    }
  }
  return out;
}

function allowed(names: readonly string[]): string[] {
  return names.map((n) => FONT_BY_LOWER.get(n.toLowerCase())).filter((n): n is string => Boolean(n));
}

/**
 * A Google Fonts link on the page is the strongest signal, then font-family
 * on body, html, :root and h1 to h3, then `--font*` custom properties. Only
 * families on the allow list come back; otherwise the generic stack, serif
 * when the declaration falls back to serif.
 */
export function extractFonts(html: string, cssTexts: readonly string[]): { headingFont: FontChoice; bodyFont: FontChoice } {
  const linked = allowed(googleLinkFamilies(html, cssTexts));
  const bodyDecls: string[][] = [];
  const headingDecls: string[][] = [];
  const css = allCss(html, cssTexts);
  for (const rule of cssRules(css)) {
    const value = declaration(rule.body, "font-family");
    if (!value) continue;
    const families = familiesOf(value);
    if (rule.selectors.some((s) => s === "body" || s === "html" || s === ":root")) bodyDecls.push(families);
    if (rule.selectors.some((s) => /^h[1-3]$/.test(s))) headingDecls.push(families);
  }
  const headingVars: string[][] = [];
  const bodyVars: string[][] = [];
  for (const m of css.matchAll(/--([a-z0-9_-]*font[a-z0-9_-]*)\s*:\s*([^;}]+)/gi)) {
    const families = familiesOf(m[2]);
    if (/head|display|title/i.test(m[1])) headingVars.push(families);
    else bodyVars.push(families);
  }
  const bodyAllowed = allowed(bodyDecls.flat());
  const bodyFamily =
    bodyAllowed.find((f) => linked.includes(f)) ?? linked[0] ?? bodyAllowed[0] ?? allowed(bodyVars.flat())[0] ?? null;
  const headingAllowed = allowed([...headingDecls.flat(), ...headingVars.flat()]);
  const headingFamily = headingAllowed.find((f) => linked.includes(f)) ?? headingAllowed[0] ?? bodyFamily;
  const lastGeneric = (decls: string[][]) => decls.flat().map((f) => f.toLowerCase()).filter((f) => f === "serif" || f === "sans-serif").pop();
  const bodySerif = lastGeneric(bodyDecls) === "serif";
  const headingSerif = headingDecls.length > 0 ? lastGeneric(headingDecls) === "serif" : bodySerif;
  return { headingFont: fontChoice(headingFamily, headingSerif), bodyFont: fontChoice(bodyFamily, bodySerif) };
}

// ── Tagline and name ─────────────────────────────────────────────────────────

function plainText(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, " "))
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/** og:description, then the meta description, then the first `<h1>`; 160 characters at a word, dashes made plain. */
export function extractTagline(html: string): string {
  const doc = stripComments(html);
  const metas = tags(doc, "meta").map(attributes);
  const meta = (key: string) => metas.find((a) => (a.property ?? a.name ?? "").toLowerCase() === key && a.content)?.content;
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(doc)?.[1];
  const raw = meta("og:description") ?? meta("description") ?? h1 ?? "";
  return cutAtWord(plainText(raw), TAGLINE_MAX);
}

/** og:site_name, else the title before a separator. */
export function extractSiteName(html: string): string {
  const doc = stripComments(html);
  const og = tags(doc, "meta").map(attributes).find((a) => (a.property ?? "").toLowerCase() === "og:site_name" && a.content)?.content;
  if (og) return plainText(og).slice(0, 80);
  const title = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(doc)?.[1] ?? "";
  return plainText(title).split(/\s+[|:–—-]\s+|\s*,\s+/)[0].slice(0, 80).trim();
}

// ── Logo bytes ───────────────────────────────────────────────────────────────

const SVG_TYPES = ["image/svg+xml", "text/xml", "application/xml", "text/plain"];
const NEUTRAL_TYPES = ["", "application/octet-stream", "binary/octet-stream"];

function svgRootText(text: string): boolean {
  const rest = text
    .replace(/^﻿/, "")
    .replace(/^\s*<\?xml[\s\S]*?\?>/i, "")
    .replace(/^(?:\s*<!--[\s\S]*?-->|\s*<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)*/i, "")
    .trimStart();
  return /^<svg[\s/>]/i.test(rest);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * The magic bytes decide (PNG, JPEG, WebP, SVG); a content type that names a
 * different image type is refused; more than 200 KB is refused; GIF, ICO,
 * AVIF and anything else are refused.
 */
export function checkLogoBytes(bytes: Uint8Array, contentType: string): { mime: string } | null {
  if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return null;
  let mime: string | null = null;
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) mime = "image/png";
  else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = "image/jpeg";
  else if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) mime = "image/webp";
  else if (svgRootText(decodeUtf8(bytes.subarray(0, 4096)))) mime = "image/svg+xml";
  if (!mime) return null;
  const type = contentType.split(";")[0].trim().toLowerCase().replace("image/jpg", "image/jpeg");
  if (NEUTRAL_TYPES.includes(type)) return { mime };
  if (mime === "image/svg+xml") return SVG_TYPES.includes(type) ? { mime } : null;
  return type === mime ? { mime } : null;
}

/**
 * An SVG with nothing active left in it: no doctype or entities, scripts,
 * foreignObject, frames, external use or image references, event handlers,
 * external hrefs, CSS imports or external url(), or javascript: anywhere.
 * Null when over 200 KB or the root is not `<svg>`.
 */
export function sanitiseSvg(text: string): string | null {
  if (new TextEncoder().encode(text).length > LOGO_MAX_BYTES || !svgRootText(text)) return null;
  let out = text.replace(/<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>/gi, "").replace(/<!ENTITY[^>]*>/gi, "");
  for (const tag of ["script", "foreignObject", "iframe", "object", "embed"]) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
  }
  const external = /[\s/](?:xlink:)?href\s*=\s*(["'])(?!#)[^"']*\1/i;
  for (const tag of ["use", "image"]) {
    out = out.replace(new RegExp(`<${tag}\\b([^>]*[^/>])?>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), (el, attrs = "") => (external.test(attrs) ? "" : el));
    out = out.replace(new RegExp(`<${tag}\\b([^>]*)>`, "gi"), (el, attrs: string) => (external.test(attrs) ? "" : el));
  }
  out = out.replace(/[\s/]on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/[\s/](?:xlink:)?href\s*=\s*(["'])(?!#)[^"']*\1/gi, "");
  out = out.replace(/@import\b[^;]*;?/gi, "");
  out = out.replace(/url\(\s*(["']?)(?!#)[^)]*\)/gi, "none");
  out = out.replace(/javascript:/gi, "");
  return out;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/** A base64 data URI; SVG is sanitised first. Null when the SVG cannot be made safe. */
export function logoDataUri(bytes: Uint8Array, mime: string): HouseLogo | null {
  if (mime === "image/svg+xml") {
    const clean = sanitiseSvg(decodeUtf8(bytes));
    if (!clean) return null;
    const encoded = new TextEncoder().encode(clean);
    return { dataUri: `data:image/svg+xml;base64,${base64(encoded)}`, mime, bytes: encoded.length };
  }
  return { dataUri: `data:${mime};base64,${base64(bytes)}`, mime, bytes: bytes.length };
}

/** The Google Fonts css2 URL for the allow list families in use; null when both roles use system stacks. */
export function fontStylesheetUrl(style: Pick<HouseStyle, "headingFont" | "bodyFont">): string | null {
  const families: string[] = [];
  for (const f of [style.headingFont.family, style.bodyFont.family]) {
    const name = f ? FONT_BY_LOWER.get(f.toLowerCase()) : undefined;
    if (name && !families.includes(name)) families.push(name);
  }
  if (families.length === 0) return null;
  const params = families.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

// ── Assembly ─────────────────────────────────────────────────────────────────

/** What house-style-read.ts gathered, before buildHouseStyle decides found, partial or none. */
export interface HouseStyleParts {
  host: string | null;
  readAt?: string;
  siteName: string;
  tagline: string;
  colours: string[];
  background: string;
  text: string;
  headingFont: FontChoice;
  bodyFont: FontChoice;
  logo: HouseLogo | null;
}

/** "found": a logo and a colour or font came through; "partial": some of it did; "none": nothing usable. */
export function buildHouseStyle(parts: HouseStyleParts): HouseStyle {
  const hasFont = Boolean(parts.headingFont.family || parts.bodyFont.family);
  const hasColour = parts.colours.length > 0;
  const hasLogo = parts.logo !== null;
  const readAt = parts.readAt ?? new Date().toISOString();
  if (!hasLogo && !hasColour && !hasFont) {
    return { ...neutralStyle("nothing-usable", parts.host, readAt), siteName: parts.siteName, tagline: parts.tagline };
  }
  const status: StyleStatus = hasLogo && (hasColour || hasFont) ? "found" : "partial";
  return {
    status,
    reason: "",
    host: parts.host,
    readAt,
    siteName: parts.siteName,
    tagline: parts.tagline,
    colours: hasColour ? parts.colours.slice(0, MAX_COLOURS) : [...NEUTRAL_HOUSE_STYLE.colours],
    background: parts.background,
    text: parts.text,
    headingFont: hasFont ? parts.headingFont : NEUTRAL_HOUSE_STYLE.headingFont,
    bodyFont: hasFont ? parts.bodyFont : NEUTRAL_HOUSE_STYLE.bodyFont,
    logo: parts.logo,
  };
}
