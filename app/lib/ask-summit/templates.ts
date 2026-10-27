/**
 * The Ask Summit emails: the confirmation to the prospect (subject, plain
 * text and a text-first HTML body in the 1b house style) and the two
 * notifications to Anthony (plain text only). Pure: every caller string
 * goes through `plainDashes`, model and visitor text through `escapeHtml`
 * in the HTML body, and nothing reads env, Redis or the network, so the
 * templates are unit tested offline.
 */
import { BRAND, CONTACT_EMAIL } from "../brand.ts";
import { escapeHtml, plainDashes, redactAddresses } from "../tools/result-email.ts";
import { DELETE_FALLBACK_LINE, PREPARATION_LINE } from "./copy.ts";

export interface ConfirmationEmailArgs {
  name: string;
  siteUrl: string;
  fileNames: string[];
  /** Null when UNLOCK_SECRET is unset; the email then carries the contact fallback. */
  deleteUrl: string | null;
  contactEmail?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export const CONFIRMATION_SUBJECT = "Summit has your Built to Scale? request";

const TURNAROUND_LINE =
  "A person at Summit reads the output, checks it, edits the scores and writes the commentary, usually within two working days. You will hear from Anthony directly.";
const RETENTION_LINE =
  "The pages we read and the files you sent are kept for 30 days to prepare the report, then deleted. They are not used to train any model.";
const DELETE_LINE = "This removes the pages we read and the files you sent, and the request itself.";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function safe(value: string): string {
  return escapeHtml(plainDashes(value));
}

function receivedLine(siteUrl: string, fileNames: string[]): string {
  const n = fileNames.length;
  if (n === 0) return `We have your website ${siteUrl}.`;
  return `We have your website ${siteUrl}, and ${n} file${n === 1 ? "" : "s"}: ${fileNames.join(", ")}.`;
}

export function renderConfirmationEmail(args: ConfirmationEmailArgs): RenderedEmail {
  const contact = args.contactEmail ?? CONTACT_EMAIL;
  const name = plainDashes(args.name).trim();
  const siteUrl = plainDashes(args.siteUrl);
  const fileNames = args.fileNames.map((f) => plainDashes(f).trim()).filter((f) => f.length > 0);
  const greeting = name ? `Hello ${name},` : "Hello,";
  const received = receivedLine(siteUrl, fileNames);
  const closing = `Questions in the meantime: write to ${contact}.`;

  // ── Plain text ───────────────────────────────────────────────────────────
  const t: string[] = [];
  t.push(greeting);
  t.push("");
  t.push(received);
  t.push("");
  t.push(TURNAROUND_LINE);
  t.push("");
  t.push(PREPARATION_LINE);
  t.push("");
  t.push(RETENTION_LINE);
  t.push("");
  t.push("Delete my data");
  if (args.deleteUrl) {
    t.push(DELETE_LINE);
    t.push(args.deleteUrl);
  } else {
    t.push(DELETE_FALLBACK_LINE);
  }
  t.push("");
  t.push(closing);
  t.push("Summit Strategy Advisory");
  const text = t.join("\n");

  // ── HTML ─────────────────────────────────────────────────────────────────
  const p = (inner: string, colour: string = BRAND.dark, size = 15) =>
    `<p style="margin:0 0 12px;font-size:${size}px;line-height:1.6;color:${colour};">${inner}</p>`;
  const h2 = (inner: string) => `<h2 style="margin:28px 0 12px;font-size:17px;font-weight:600;color:${BRAND.darkGreen};">${inner}</h2>`;
  const link = (url: string) => `<a href="${escapeHtml(url)}" style="color:${BRAND.teal};">${escapeHtml(url)}</a>`;

  const h: string[] = [];
  h.push(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(CONFIRMATION_SUBJECT)}</title></head>`);
  h.push(`<body style="margin:0;padding:0;background:${BRAND.white};font-family:${FONT};color:${BRAND.dark};">`);
  h.push(`<div style="max-width:600px;margin:0 auto;padding:24px 20px;">`);
  h.push(`<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.brandGreen};font-weight:600;">Summit GTM Toolkit</p>`);
  h.push(`<h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:${BRAND.darkGreen};">${escapeHtml(CONFIRMATION_SUBJECT)}</h1>`);
  h.push(p(escapeHtml(greeting)));
  h.push(p(escapeHtml(received)));
  h.push(p(escapeHtml(TURNAROUND_LINE)));
  h.push(p(escapeHtml(PREPARATION_LINE), BRAND.mid, 13));
  h.push(p(escapeHtml(RETENTION_LINE), BRAND.mid, 13));
  h.push(h2("Delete my data"));
  if (args.deleteUrl) {
    h.push(p(escapeHtml(DELETE_LINE), BRAND.mid, 13));
    h.push(p(link(args.deleteUrl), BRAND.dark, 14));
  } else {
    h.push(p(escapeHtml(DELETE_FALLBACK_LINE), BRAND.mid, 13));
  }
  h.push(`<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.6;color:${BRAND.mid};">${escapeHtml(closing)}<br>Summit Strategy Advisory</p>`);
  h.push(`</div></body></html>`);
  const html = h.join("\n");

  return { subject: CONFIRMATION_SUBJECT, text, html };
}

export type QueueNotificationKind = "done" | "failed" | "stuck";

export interface QueueNotificationArgs {
  kind: QueueNotificationKind;
  requestId: string;
  host: string;
  companyName: string;
  stage?: string;
  message?: string;
  pageCount?: number;
  docCount?: number;
  confidence?: string;
  totalMs?: number;
  queueUrl: string;
  editorUrl?: string;
}

export interface QueueNotification {
  subject: string;
  text: string;
}

/** The one-line-per-fact alert to Anthony: ready to review, failed at a stage, or stuck before QStash took it. */
export function renderQueueNotification(args: QueueNotificationArgs): QueueNotification {
  const host = plainDashes(args.host).trim() || "unknown host";
  const company = plainDashes(args.companyName).trim() || host;
  const stage = plainDashes(args.stage ?? "").trim() || "unknown stage";
  const message = plainDashes(redactAddresses(args.message ?? "")).trim();
  let subject: string;
  if (args.kind === "done") subject = `Ask Summit: ${host} is ready to review`;
  else if (args.kind === "failed") subject = `Ask Summit: ${host} failed at ${stage}`;
  else subject = `Ask Summit: ${host} needs Process now`;

  const lines: string[] = [`${company} (${host})`, `Request: ${plainDashes(args.requestId)}`];
  if (args.kind === "done") {
    const seconds = Math.round((args.totalMs ?? 0) / 1000);
    lines.push(`Done: ${args.pageCount ?? 0} pages, ${args.docCount ?? 0} documents, confidence ${plainDashes(args.confidence ?? "no draft yet")}, ${seconds} s`);
  } else if (args.kind === "failed") {
    lines.push(`Stage: ${stage}`);
    lines.push(`Reason: ${message || "no message"}`);
  } else {
    lines.push(`QStash did not accept the message: ${message || "not configured"}. Open the queue and press Process now, or run npm run process-ask.`);
  }
  lines.push(`Queue: ${plainDashes(args.queueUrl)}`);
  if (args.editorUrl) lines.push(`Edit the report: ${plainDashes(args.editorUrl)}`);
  return { subject, text: lines.join("\n") };
}
