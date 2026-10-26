/**
 * The emailed result: subject, plain text and a text-first HTML body in the
 * house style. Pure: takes the full view, the registry dimensions and extras
 * for the tool and the two links, and returns strings. Nothing here reads
 * env, Redis or the network, so the template is unit tested offline.
 *
 * Text-first HTML: one column, system font stack, inline style attributes,
 * no images, no external CSS, and a plain text part carrying the same
 * content in the same order. Mail clients strip or block most of what a
 * designed template relies on, the text part is what a reader on a locked
 * down client or a screen reader gets, and the visitor is reading a
 * result, not a campaign. Keeping both parts in step also means the test
 * can assert on the text and trust the HTML says the same.
 *
 * Two rules every string goes through before it is rendered. Model supplied
 * text is HTML-escaped in the HTML body. En and em dashes are normalised in
 * both bodies (a dash between digits becomes " to ", any other becomes ", ")
 * so the email never carries U+2013 or U+2014 whatever the model wrote; the
 * prompts are out of scope for this release, so the template is the one
 * place that can guarantee it.
 */
import { BRAND } from "../brand.ts";
import { CEILING_INPUT_KEYS, CEILING_INPUT_LABELS, computeCeiling, isCeilingInputs, isSupportedCeilingValue, unsupportedCeilingInputs, type CeilingInputs } from "../ceiling.ts";
import type { Level, ToolDimension, ToolExtra } from "./registry.ts";
import type { ExtraValue } from "./schema.ts";

export interface ResultEmailRecommendation {
  dim: string;
  name: string;
  score: number;
  gap: string;
  consequence: string;
  action: string;
}

/** The FullView fields the email needs; structurally compatible with pipeline FullView. */
export interface ResultEmailView {
  score: number;
  grade: number;
  gradeLabel: string;
  legacyLabel?: string;
  verdict: string;
  confidence: string;
  confidenceReason: string;
  scores: Record<string, number>;
  reasoning: Record<string, string>;
  recommendations: ResultEmailRecommendation[];
  extras: Record<string, ExtraValue>;
}

export interface ResultEmailArgs {
  toolName: string;
  toolNumber: string;
  full: ResultEmailView;
  dimensions: Array<Pick<ToolDimension, "key" | "name" | "levels">>;
  extrasMeta: Array<Pick<ToolExtra, "key" | "label" | "kind">>;
  savedUrl: string;
  deleteUrl: string;
}

export interface ResultEmail {
  subject: string;
  text: string;
  html: string;
}

const AUTOMATED_LINE = "This result was produced automatically against Summit Strategy Advisory's rubrics.";
const NO_RECOMMENDATIONS = "Every dimension scored 4 or above.";
const DELETE_LINE = "This removes every result stored under your email address.";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** A dash between digits becomes " to "; any other en or em dash becomes ", ". */
export function plainDashes(value: string): string {
  return value
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[–—]\s*/g, ", ");
}

/**
 * Replaces anything shaped like an email address with "[address]". Mail
 * servers echo the recipient in rejection text ("550 5.1.1 <ann@example.com>:
 * Recipient address rejected"), so logging a raw transport error would log
 * the visitor's address in full, against the rule that only the hash is
 * ever logged. The details route passes every send error through this
 * before it reaches console.error.
 */
export function redactAddresses(message: string): string {
  return message.replace(/[^\s<>@"'()]+@[^\s<>@"'()]+/g, "[address]");
}

/** Shared with the Built to Scale? template so model text has one escaping path. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Dash normalised then HTML-escaped: the one path for model text into the HTML body. */
function safe(value: string): string {
  return escapeHtml(plainDashes(value));
}

function levelLabel(dim: Pick<ToolDimension, "levels">, score: number): string {
  return dim.levels[score as Level] ?? "";
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * The lines the email prints for a ceiling extra, mirroring the Ceiling
 * renderer in extras.tsx: the figure (or why it cannot be computed), then
 * one line per assumption in key order.
 */
function ceilingLines(inputs: CeilingInputs): string[] {
  const result = computeCeiling(inputs);
  const lines: string[] = [];
  if (result) {
    lines.push(`${result.formatted} per person per year`);
    for (const a of result.assumptions) {
      lines.push(a.text ? `${a.label}: ${a.value.toLocaleString("en-GB")}, ${a.text}` : `${a.label}: ${a.value.toLocaleString("en-GB")}`);
    }
    return lines;
  }
  const missing = unsupportedCeilingInputs(inputs).map((key) => CEILING_INPUT_LABELS[key].toLowerCase());
  lines.push(`The ceiling cannot be computed because the text did not give ${joinLabels(missing)}.`);
  for (const key of CEILING_INPUT_KEYS) {
    const input = inputs[key];
    const figure = isSupportedCeilingValue(input.value) ? input.value.toLocaleString("en-GB") : "not supported by the text";
    const text = input.assumption.trim();
    lines.push(text ? `${CEILING_INPUT_LABELS[key]}: ${figure}, ${text}` : `${CEILING_INPUT_LABELS[key]}: ${figure}`);
  }
  return lines;
}

/** A string or list as is; a ceiling object as its printed lines; any other object as nothing. */
function extraValues(value: ExtraValue | undefined): string[] {
  if (value === undefined) return [];
  let list: string[];
  if (typeof value === "string") list = [value];
  else if (Array.isArray(value)) list = value;
  else if (isCeilingInputs(value)) list = ceilingLines(value);
  else return [];
  return list.map((v) => plainDashes(String(v)).trim()).filter((v) => v.length > 0);
}

export function renderResultEmail(args: ResultEmailArgs): ResultEmail {
  const { toolName, toolNumber, full, dimensions, extrasMeta, savedUrl, deleteUrl } = args;
  const subject = plainDashes(`Your ${toolName} result: ${full.score} out of 100, grade ${full.grade} of 5`);

  const gradeLine = full.legacyLabel
    ? `Grade ${full.grade} of 5, ${full.gradeLabel} (${full.legacyLabel})`
    : `Grade ${full.grade} of 5, ${full.gradeLabel}`;

  // ── Plain text ───────────────────────────────────────────────────────────
  const t: string[] = [];
  t.push(`${toolName} (Tool ${toolNumber}, Summit GTM Toolkit)`);
  t.push("");
  t.push(`Score: ${full.score} out of 100`);
  t.push(plainDashes(gradeLine));
  t.push("");
  t.push(`Verdict: ${plainDashes(full.verdict)}`);
  t.push(`Confidence: ${full.confidence}. ${plainDashes(full.confidenceReason)}`);
  t.push("");
  t.push("Dimension breakdown");
  for (const dim of dimensions) {
    const score = full.scores[dim.key] ?? 0;
    t.push("");
    t.push(`${dim.name}: ${score} of 5, ${plainDashes(levelLabel(dim, score))}`);
    const reasoning = full.reasoning[dim.key];
    if (reasoning) t.push(plainDashes(reasoning));
  }
  t.push("");
  t.push("Recommendations");
  if (full.recommendations.length === 0) {
    t.push(NO_RECOMMENDATIONS);
  } else {
    for (const rec of full.recommendations) {
      t.push("");
      t.push(`${plainDashes(rec.name)} (${rec.score} of 5)`);
      t.push(`Gap: ${plainDashes(rec.gap)}`);
      t.push(`Consequence: ${plainDashes(rec.consequence)}`);
      t.push(`Next action: ${plainDashes(rec.action)}`);
    }
  }
  for (const extra of extrasMeta) {
    const values = extraValues(full.extras[extra.key]);
    if (values.length === 0) continue;
    t.push("");
    t.push(plainDashes(extra.label));
    if (extra.kind === "list") {
      for (const v of values) t.push(`- ${v}`);
    } else {
      t.push(values.join("\n"));
    }
  }
  t.push("");
  t.push("Your saved result");
  t.push(savedUrl);
  t.push("");
  t.push("Delete my data");
  t.push(DELETE_LINE);
  t.push(deleteUrl);
  t.push("");
  t.push(AUTOMATED_LINE);
  const text = t.join("\n");

  // ── HTML ─────────────────────────────────────────────────────────────────
  const p = (inner: string, colour: string = BRAND.dark, size = 15) =>
    `<p style="margin:0 0 12px;font-size:${size}px;line-height:1.6;color:${colour};">${inner}</p>`;
  const h2 = (inner: string) =>
    `<h2 style="margin:28px 0 12px;font-size:17px;font-weight:600;color:${BRAND.darkGreen};">${inner}</h2>`;
  const link = (url: string) =>
    `<a href="${escapeHtml(url)}" style="color:${BRAND.teal};">${escapeHtml(url)}</a>`;

  const h: string[] = [];
  h.push(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(subject)}</title></head>`);
  h.push(`<body style="margin:0;padding:0;background:${BRAND.white};font-family:${FONT};color:${BRAND.dark};">`);
  h.push(`<div style="max-width:600px;margin:0 auto;padding:24px 20px;">`);
  h.push(`<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.brandGreen};font-weight:600;">Tool ${escapeHtml(toolNumber)}, Summit GTM Toolkit</p>`);
  h.push(`<h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:${BRAND.darkGreen};">${escapeHtml(toolName)}</h1>`);
  h.push(`<div style="padding:16px 18px;background:${BRAND.lightBg};border:1px solid ${BRAND.border};border-radius:8px;margin-bottom:20px;">`);
  h.push(`<p style="margin:0 0 6px;font-size:28px;font-weight:700;color:${BRAND.darkGreen};">${full.score} <span style="font-size:14px;font-weight:400;color:${BRAND.mid};">out of 100</span></p>`);
  h.push(p(safe(gradeLine), BRAND.teal, 14));
  h.push(p(`<strong>Verdict:</strong> ${safe(full.verdict)}`));
  h.push(p(`<strong>Confidence:</strong> ${safe(full.confidence)}. ${safe(full.confidenceReason)}`, BRAND.mid, 13));
  h.push(`</div>`);

  h.push(h2("Dimension breakdown"));
  for (const dim of dimensions) {
    const score = full.scores[dim.key] ?? 0;
    h.push(p(`<strong>${safe(dim.name)}:</strong> ${score} of 5, ${safe(levelLabel(dim, score))}`, BRAND.darkGreen, 14));
    const reasoning = full.reasoning[dim.key];
    if (reasoning) h.push(p(safe(reasoning), BRAND.mid, 13));
  }

  h.push(h2("Recommendations"));
  if (full.recommendations.length === 0) {
    h.push(p(NO_RECOMMENDATIONS, BRAND.mid, 14));
  } else {
    for (const rec of full.recommendations) {
      h.push(`<div style="padding:12px 14px;border-left:3px solid ${BRAND.amber};margin:0 0 14px;background:${BRAND.white};">`);
      h.push(p(`<strong>${safe(rec.name)}</strong> (${rec.score} of 5)`, BRAND.darkGreen, 14));
      h.push(p(`<strong>Gap:</strong> ${safe(rec.gap)}`, BRAND.dark, 13));
      h.push(p(`<strong>Consequence:</strong> ${safe(rec.consequence)}`, BRAND.mid, 13));
      h.push(p(`<strong>Next action:</strong> ${safe(rec.action)}`, BRAND.teal, 13));
      h.push(`</div>`);
    }
  }

  for (const extra of extrasMeta) {
    const values = extraValues(full.extras[extra.key]);
    if (values.length === 0) continue;
    h.push(h2(safe(extra.label)));
    if (extra.kind === "list") {
      h.push(`<ul style="margin:0 0 12px;padding-left:20px;">`);
      for (const v of values) h.push(`<li style="font-size:14px;line-height:1.6;color:${BRAND.dark};margin-bottom:6px;">${escapeHtml(v)}</li>`);
      h.push(`</ul>`);
    } else {
      for (const v of values) h.push(p(escapeHtml(v), BRAND.dark, 14));
    }
  }

  h.push(h2("Your saved result"));
  h.push(p(link(savedUrl), BRAND.dark, 14));
  h.push(h2("Delete my data"));
  h.push(p(DELETE_LINE, BRAND.mid, 13));
  h.push(p(link(deleteUrl), BRAND.dark, 14));
  h.push(`<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.6;color:${BRAND.mid};">${AUTOMATED_LINE}</p>`);
  h.push(`</div></body></html>`);
  const html = h.join("\n");

  return { subject, text, html };
}
