/**
 * The emailed Built to Scale? scorecard: subject, plain text and a text-first
 * HTML body in the 1b house style. Pure: takes the full view and the two
 * links and returns strings, so the template is unit tested offline. Every
 * model string goes through plainDashes (both bodies) and escapeHtml (HTML),
 * the one escaping path shared with the tool result email. The working is
 * not in the email; the saved link opens it.
 */
import { BRAND } from "../brand.ts";
import { AUTOMATED_LABEL, QUICK_NOTE, type CompositeFullView } from "./built-to-scale-method.ts";
import { escapeHtml, plainDashes } from "./result-email.ts";

export interface BuiltToScaleEmailArgs {
  full: CompositeFullView;
  savedUrl: string;
  deleteUrl: string;
}

export interface BuiltToScaleEmail {
  subject: string;
  text: string;
  html: string;
}

const DELETE_LINE = "This removes every result stored under your email address.";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Five text circles, filled to the grade, so the row reads in plain text too. */
export function dotsText(grade: number): string {
  return Array.from({ length: 5 }, (_, i) => (i < grade ? "●" : "○")).join("");
}

function safe(value: string): string {
  return escapeHtml(plainDashes(value));
}

export function renderBuiltToScaleEmail(args: BuiltToScaleEmailArgs): BuiltToScaleEmail {
  const { full, savedUrl, deleteUrl } = args;
  const band = plainDashes(full.band);
  const subject = plainDashes(`Your Built to Scale? score: ${full.total} of 25, ${band}`);

  // ── Plain text ───────────────────────────────────────────────────────────
  const t: string[] = [];
  t.push("Built to Scale? scorecard, Summit GTM Toolkit");
  t.push("");
  t.push(`${full.total} of 25`);
  t.push(band);
  t.push("");
  t.push(`Verdict: ${plainDashes(full.verdict)}`);
  t.push(`Confidence: ${full.confidence}. ${plainDashes(full.confidenceReason)}`);
  if (full.quickMode) {
    t.push("");
    t.push(QUICK_NOTE);
  }
  t.push("");
  t.push("Five dimensions");
  for (const row of full.rows) {
    t.push("");
    t.push(`${dotsText(row.grade)} ${plainDashes(row.name)}: ${row.grade} of 5`);
    if (row.comment) t.push(plainDashes(row.comment));
  }
  t.push("");
  t.push(`Strongest: ${plainDashes(full.strongest)}`);
  t.push(`Weakest: ${plainDashes(full.weakest)}`);
  t.push("");
  t.push(`The one change: ${plainDashes(full.oneChange)}`);
  t.push("");
  t.push("Your saved result");
  t.push(savedUrl);
  t.push("");
  t.push("Delete my data");
  t.push(DELETE_LINE);
  t.push(deleteUrl);
  t.push("");
  t.push(AUTOMATED_LABEL);
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
  h.push(`<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.brandGreen};font-weight:600;">Summit GTM Toolkit</p>`);
  h.push(`<h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:${BRAND.darkGreen};">Built to Scale? scorecard</h1>`);
  h.push(`<div style="padding:16px 18px;background:${BRAND.lightBg};border:1px solid ${BRAND.border};border-radius:8px;margin-bottom:20px;">`);
  h.push(`<p style="margin:0 0 6px;font-size:28px;font-weight:700;color:${BRAND.darkGreen};">${full.total} <span style="font-size:14px;font-weight:400;color:${BRAND.mid};">of 25</span></p>`);
  h.push(p(safe(full.band), BRAND.teal, 14));
  h.push(p(`<strong>Verdict:</strong> ${safe(full.verdict)}`));
  h.push(p(`<strong>Confidence:</strong> ${safe(full.confidence)}. ${safe(full.confidenceReason)}`, BRAND.mid, 13));
  if (full.quickMode) h.push(p(escapeHtml(QUICK_NOTE), BRAND.mid, 13));
  h.push(`</div>`);

  h.push(h2("Five dimensions"));
  for (const row of full.rows) {
    h.push(`<div style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">`);
    h.push(p(`<span style="color:${BRAND.brandGreen};letter-spacing:2px;">${dotsText(row.grade)}</span> <strong>${safe(row.name)}:</strong> ${row.grade} of 5`, BRAND.darkGreen, 14));
    if (row.comment) h.push(p(safe(row.comment), BRAND.dark, 13));
    h.push(`</div>`);
  }

  h.push(h2("Strongest and weakest"));
  h.push(p(`<strong>Strongest:</strong> ${safe(full.strongest)}`, BRAND.dark, 14));
  h.push(p(`<strong>Weakest:</strong> ${safe(full.weakest)}`, BRAND.dark, 14));

  h.push(h2("The one change"));
  h.push(`<div style="padding:12px 14px;border-left:3px solid ${BRAND.brandGreen};margin:0 0 14px;background:${BRAND.white};">`);
  h.push(p(safe(full.oneChange), BRAND.darkGreen, 15));
  h.push(`</div>`);

  h.push(h2("Your saved result"));
  h.push(p(link(savedUrl), BRAND.dark, 14));
  h.push(h2("Delete my data"));
  h.push(p(DELETE_LINE, BRAND.mid, 13));
  h.push(p(link(deleteUrl), BRAND.dark, 14));
  h.push(`<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.6;color:${BRAND.mid};">${escapeHtml(AUTOMATED_LABEL)}</p>`);
  h.push(`</div></body></html>`);
  const html = h.join("\n");

  return { subject, text, html };
}
