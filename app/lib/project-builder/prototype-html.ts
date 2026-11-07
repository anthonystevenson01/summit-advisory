/**
 * The prototype document's string work: the search and replace edit applier
 * (a port of Summit Canvas `applyCanvasEdits`), the structural validator (a
 * port of Canvas `validateHtml` plus a screen count and a size cap), the
 * safety pass with the Content Security Policy, and the serve step that puts
 * the logo in place. Pure: no Redis, no network, no env.
 *
 * No HTML parser is allowed (no new dependencies), so the safety pass is a
 * best effort regex pass. The real boundary is the CSP meta it injects as
 * the first element of the head plus the iframe sandbox with scripts only:
 * together they stop network reads outside the two font hosts, frames, form
 * posts, base rewriting and any access to the builder's origin.
 */
import {
  PROTOTYPE_HTML_MAX_CHARS,
  PROTOTYPE_SCREENS_MAX,
  PROTOTYPE_SCREENS_MIN,
  styleNoteFor,
  type PrototypeRecord,
  type PrototypeView,
} from "./prototype.ts";
import type { HouseStyle } from "./house-style.ts";

/**
 * The model writes this as the logo's src. The stored document keeps the
 * placeholder; the serve step swaps in the data URI, so the record stays
 * small and the model never sees or repeats the logo bytes.
 */
export const LOGO_PLACEHOLDER = "{{LOGO}}";

/** The spec's five directives plus base-uri and form-action, which only tighten it. */
export const PROTOTYPE_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'";

/** The only hosts an http or https URL in the prototype may name; every other URL is stripped. */
export const ALLOWED_URL_HOSTS: readonly string[] = ["fonts.googleapis.com", "fonts.gstatic.com"];

/** The only stylesheet link the server ever injects starts with this. */
export const FONT_CSS_PREFIX = "https://fonts.googleapis.com/css2?";

/** Marker comments around the injected head block, so the pass is idempotent and the edit prompt can name it. */
export const SAFE_BLOCK_START = "<!--pb-safe-->";
export const SAFE_BLOCK_END = "<!--/pb-safe-->";

// ── Edits ────────────────────────────────────────────────────────────────────

/** One search and replace edit from the model, in the Summit Canvas shape. */
export interface PrototypeEdit {
  old_str: string;
  new_str: string;
}

/** An edit that did not apply. The run treats it as a reason to rebuild, not as a failure. */
export class EditApplyError extends Error {
  readonly editNumber: number;
  constructor(editNumber: number, message: string) {
    super(message);
    this.name = "EditApplyError";
    this.editNumber = editNumber;
  }
}

/**
 * Applies the edits in order against the document as it stands after the
 * previous edit. Each `old_str` must match exactly once. All or nothing: the
 * input string is never changed and a failure throws before anything is
 * returned.
 */
export function applyEdits(html: string, edits: readonly PrototypeEdit[]): string {
  let out = html;
  edits.forEach((edit, i) => {
    const n = i + 1;
    if (!edit.old_str) throw new EditApplyError(n, `Edit ${n}: old_str is empty. Nothing was changed.`);
    const first = out.indexOf(edit.old_str);
    if (first === -1) throw new EditApplyError(n, `Edit ${n}: old_str not found. Nothing was changed.`);
    if (out.indexOf(edit.old_str, first + edit.old_str.length) !== -1) {
      throw new EditApplyError(n, `Edit ${n}: old_str matches more than once. Nothing was changed.`);
    }
    out = out.slice(0, first) + edit.new_str + out.slice(first + edit.old_str.length);
  });
  return out;
}

// ── Validator ────────────────────────────────────────────────────────────────

const PROTOCOL_TAG_RE = /<\/?(edits|edit|search|replace|rewrite)>/i;

function count(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

/** Plain English issues, empty when the document passes; they go straight back to the model in the fix round. */
export function validatePrototypeHtml(html: string): string[] {
  const issues: string[] = [];
  if (PROTOCOL_TAG_RE.test(html)) {
    issues.push("The document contains edit markers (<edits>, <edit>, <search>, <replace> or <rewrite>) that must not appear in the page.");
  }
  const htmlOpens = count(html, /<html[\s>]/gi);
  if (htmlOpens !== 1) issues.push(`The document has ${htmlOpens} <html> tags. It must have exactly 1.`);
  const bodyOpens = count(html, /<body[\s>]/gi);
  if (bodyOpens !== 1) issues.push(`The document has ${bodyOpens} <body> tags. It must have exactly 1.`);
  const headOpens = count(html, /<head[\s>]/gi);
  if (headOpens > 1) issues.push(`The document has ${headOpens} <head> tags. It must have at most 1.`);
  const styleOpens = count(html, /<style[\s>]/gi);
  const styleCloses = count(html, /<\/style\s*>/gi);
  if (styleOpens !== styleCloses) issues.push(`The <style> tags are unbalanced: ${styleOpens} opening and ${styleCloses} closing.`);
  const scriptOpens = count(html, /<script[\s>]/gi);
  const scriptCloses = count(html, /<\/script\s*>/gi);
  if (scriptOpens !== scriptCloses) issues.push(`The <script> tags are unbalanced: ${scriptOpens} opening and ${scriptCloses} closing.`);
  const ids = new Map<string, number>();
  for (const m of html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)) ids.set(m[1], (ids.get(m[1]) ?? 0) + 1);
  const dupes = [...ids.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (dupes.length > 0) issues.push(`Some element ids are used more than once: ${dupes.slice(0, 8).join(", ")}. Every id must be unique.`);
  const screens = count(html, /<[a-z][a-z0-9-]*\b[^>]*\sdata-screen\s*=/gi);
  if (screens < PROTOTYPE_SCREENS_MIN || screens > PROTOTYPE_SCREENS_MAX) {
    issues.push(`The document has ${screens} screens marked with data-screen. It must have between ${PROTOTYPE_SCREENS_MIN} and ${PROTOTYPE_SCREENS_MAX}.`);
  }
  if (html.length > PROTOTYPE_HTML_MAX_CHARS) {
    issues.push(`The document is ${html.length} characters long. It must be at most ${PROTOTYPE_HTML_MAX_CHARS}; make it shorter.`);
  }
  return issues;
}

// ── Safety pass ──────────────────────────────────────────────────────────────

const FRAME_TAGS = "iframe|object|embed|frame|frameset|applet|portal";
// HTML accepts "/" as well as whitespace before an attribute name (`<form/action=...>`), so every attribute pattern takes either.
const BANNED_ATTRIBUTES = /[\s/](?:action|formaction|target|ping|srcset|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const SAFE_BLOCK_RE = new RegExp(`${escapeRegExp(SAFE_BLOCK_START)}[\\s\\S]*?${escapeRegExp(SAFE_BLOCK_END)}`, "g");

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttribute(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isAllowedUrl(url: string): boolean {
  const match = /^https:\/\/([a-z0-9.-]+)(?=[/?#:]|$)/i.exec(url);
  return match !== null && ALLOWED_URL_HOSTS.includes(match[1].toLowerCase());
}

/** A font stylesheet href the server may inject: the css2 endpoint and nothing else. */
export function isFontStylesheetHref(href: string): boolean {
  return href.startsWith(FONT_CSS_PREFIX) && !/["'<>\s]/.test(href);
}

function fontHrefFromBlock(html: string): string | null {
  const block = html.match(SAFE_BLOCK_RE)?.[0];
  if (!block) return null;
  const href = /<link\b[^>]*\bhref="([^"]*)"/i.exec(block)?.[1];
  if (!href) return null;
  const decoded = href.replace(/&amp;/g, "&");
  return isFontStylesheetHref(decoded) ? decoded : null;
}

function safeBlock(fontHref: string | null, needCharset: boolean): string {
  const parts = [
    SAFE_BLOCK_START,
    `<meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`,
    `<meta name="referrer" content="no-referrer">`,
  ];
  if (needCharset) parts.push(`<meta charset="utf-8">`);
  if (fontHref) parts.push(`<link rel="stylesheet" href="${escapeAttribute(fontHref)}">`);
  parts.push(SAFE_BLOCK_END);
  return parts.join("");
}

/**
 * The safety pass, in the design's order. `fontHref` undefined keeps the font
 * link a previous pass injected; null removes it. Idempotent: running it
 * twice gives the same document with one CSP.
 */
export function sanitisePrototypeHtml(html: string, fontHref?: string | null): string {
  const keptFont = fontHref === undefined ? fontHrefFromBlock(html) : fontHref && isFontStylesheetHref(fontHref) ? fontHref : null;
  let out = html.replace(SAFE_BLOCK_RE, "");

  // 1. External scripts, whole element.
  out = out.replace(/<script\b[^>]*[\s/]src\s*=[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  out = out.replace(/<script\b[^>]*[\s/]src\s*=[^>]*>/gi, "");
  // 2. Frames and embedded objects, with content where paired, then any stray tag.
  out = out.replace(new RegExp(`<(${FRAME_TAGS})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "");
  out = out.replace(new RegExp(`<\\/?(?:${FRAME_TAGS})\\b[^>]*>`, "gi"), "");
  // 3. Base.
  out = out.replace(/<base\b[^>]*>/gi, "");
  // 4. Every http-equiv meta (refresh, a model written CSP, set-cookie).
  out = out.replace(/<meta\b[^>]*\bhttp-equiv\b[^>]*>/gi, "");
  // 5. Every link tag; the one font stylesheet is injected below.
  out = out.replace(/<link\b[^>]*>/gi, "");
  // 6. Attributes that submit, navigate elsewhere or load other documents.
  out = out.replace(/<[a-z][^>]*>/gi, (tag) => tag.replace(BANNED_ATTRIBUTES, ""));
  // 7. CSS imports, then any URL outside the font hosts, absolute or protocol relative.
  out = out.replace(/@import\b[^;{}]*;?/gi, "");
  out = out.replace(/https?:\/\/[^\s"'()<>`\\]+/gi, (url) => (isAllowedUrl(url) ? url : "#"));
  out = out.replace(/([\s/](?:src|href|poster|data|xlink:href)\s*=\s*["']?)\/\/[^\s"'>]*/gi, "$1#");
  out = out.replace(/(url\(\s*["']?)\/\/[^\s"')]*/gi, "$1#");
  // 8. Script and data documents as link targets.
  out = out.replace(/([\s/]href\s*=\s*)(["']?)\s*(?:javascript|data|vbscript):[^"'\s>]*/gi, "$1$2#");
  out = out.replace(/([\s/](?:src|action)\s*=\s*)(["']?)\s*(?:javascript|vbscript):[^"'\s>]*/gi, "$1$2#");

  // 9. The injected block goes straight after the doctype, before anything
  // the model wrote. No search for <head>: a regex cannot tell the parser's
  // real head from one inside a comment, after a script or in <head-x>. A
  // <meta> as the first thing after the doctype makes the parser open the
  // implicit html and head and put the CSP first in that head; the model's
  // own <html> and <head> tags that follow are merged or ignored. No literal
  // <html> or <head> is added, so the validator's tag counts stay true.
  const needCharset = !/<meta\b[^>]*\bcharset\s*=/i.test(out);
  const block = safeBlock(keptFont, needCharset);
  let content = out.replace(/^\s*(?:<!--[\s\S]*?-->\s*)*<!doctype[^>]*>/i, "");
  if (!/<html[\s>]/i.test(content) && !/<body[\s>]/i.test(content)) content = `<body>${content}</body>`;
  return `<!DOCTYPE html>${block}${content}`;
}

// ── Serving ──────────────────────────────────────────────────────────────────

const LOGO_SRC_RE = new RegExp(`([\\s/]src\\s*=\\s*)(["'])${escapeRegExp(LOGO_PLACEHOLDER)}\\2`, "gi");
const LOGO_IMG_RE = new RegExp(`<img\\b[^>]*[\\s/]src\\s*=\\s*(["'])${escapeRegExp(LOGO_PLACEHOLDER)}\\1[^>]*>`, "gi");

/**
 * The document every reader serves: `{{LOGO}}` inside `src` becomes the data
 * URI, or without a logo the image becomes its alt text in a span; then the
 * safety pass runs again as defence in depth (the font link is kept).
 */
export function renderPrototypeDocument(storedHtml: string, logoDataUri: string | null | undefined): string {
  let out: string;
  if (logoDataUri && logoDataUri.startsWith("data:image/")) {
    out = storedHtml.replace(LOGO_SRC_RE, (_m, lead: string, quote: string) => `${lead}${quote}${logoDataUri}${quote}`);
  } else {
    out = storedHtml.replace(LOGO_IMG_RE, (tag) => {
      const alt = /\salt\s*=\s*(["'])([^"']*)\1/i.exec(tag)?.[2] ?? "";
      return alt ? `<span class="logo-text">${alt}</span>` : "";
    });
  }
  return sanitisePrototypeHtml(out);
}

/** What every reader sends to the browser: the served document plus the style note. */
export function prototypeView(record: PrototypeRecord, style: HouseStyle | null): PrototypeView {
  const status = style?.status ?? "none";
  return {
    html: renderPrototypeDocument(record.html, style?.logo?.dataUri),
    hash: record.hash,
    updatedAt: record.updatedAt,
    version: record.version,
    styleStatus: status,
    styleNote: styleNoteFor(style),
  };
}
