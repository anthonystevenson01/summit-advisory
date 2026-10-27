/**
 * The six Project Builder emails: the save link, the confirmation, the
 * alert to Anthony, the reminder, the change request and the unlock. Each
 * returns subject, plain text and a text first HTML body in the 1b style
 * (one column, system font stack, inline BRAND hex values, no images, no
 * script). Pure: the engine, the catalogue, BRAND and the two string
 * helpers from the result email.
 *
 * Every prospect supplied string goes through `plainDashes` in the text
 * and `plainDashes` then `escapeHtml` in the HTML, so no email carries an
 * en or em dash and nothing a prospect typed can become markup. No subject
 * carries an address. Links use whatever origin the caller built them with.
 */
import { BRAND } from "../brand.ts";
import { escapeHtml, plainDashes } from "../tools/result-email.ts";
import { PATHS, STEPS } from "./catalogue.ts";
import { buildRequirements, completeness, countByPriority, projectName } from "./requirements.ts";
import type { BriefState } from "./brief.ts";

export interface BriefEmail {
  subject: string;
  text: string;
  html: string;
}

export interface EmailContact {
  name: string;
  company: string;
  website: string;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const FOOTER_LINE = "You are receiving this because you saved a project brief on summitstrategyadvisory.com.";
export const DELETE_LABEL = "Delete my brief";
export const DELETE_LINE = "To remove every brief, every pasted document and every saved link under your address, open this link:";
export const CONFIRMATION_LINE = "Anthony will send your project brief within two working days. If anything needs clarifying, he will be in touch first.";
export const NOTION_FAILED_LINE = "The Notion page could not be written.";
export const RESUME_LINE = "Open the link on any device to carry on. It works for 30 days; you can ask for a fresh one from the builder.";
export const VIEW_LINE = "Open the link on any device to see what you sent and to ask for a change.";
export const REMINDER_OPT_OUT = "If you would rather we did not keep it, delete your brief and we will not write again.";
export const UNLOCK_LINE = "Anthony has reopened your brief. Make your changes and submit it again when you are ready.";

const safe = (value: string) => escapeHtml(plainDashes(value));

interface Section {
  heading?: string;
  lines: string[];
  link?: string;
}

/** The one layout: eyebrow, heading, sections of paragraphs with an optional link, the footer. */
function render(subject: string, heading: string, sections: Section[]): BriefEmail {
  const t: string[] = [plainDashes(heading), ""];
  for (const s of sections) {
    if (s.heading) t.push(plainDashes(s.heading));
    for (const line of s.lines) t.push(plainDashes(line));
    if (s.link) t.push(s.link);
    t.push("");
  }
  t.push(FOOTER_LINE);

  const p = (inner: string, colour: string = BRAND.dark, size = 15) =>
    `<p style="margin:0 0 12px;font-size:${size}px;line-height:1.6;color:${colour};">${inner}</p>`;
  const h2 = (inner: string) => `<h2 style="margin:24px 0 10px;font-size:17px;font-weight:600;color:${BRAND.darkGreen};">${inner}</h2>`;
  const link = (url: string) => `<a href="${escapeHtml(url)}" style="color:${BRAND.teal};">${escapeHtml(url)}</a>`;
  const h: string[] = [];
  h.push(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(subject)}</title></head>`);
  h.push(`<body style="margin:0;padding:0;background:${BRAND.white};font-family:${FONT};color:${BRAND.dark};">`);
  h.push(`<div style="max-width:600px;margin:0 auto;padding:24px 20px;">`);
  h.push(`<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.brandGreen};font-weight:600;">Summit Project Builder</p>`);
  h.push(`<h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:${BRAND.darkGreen};">${safe(heading)}</h1>`);
  for (const s of sections) {
    if (s.heading) h.push(h2(safe(s.heading)));
    for (const line of s.lines) h.push(p(safe(line)));
    if (s.link) h.push(p(link(s.link), BRAND.dark, 14));
  }
  h.push(`<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.6;color:${BRAND.mid};">${FOOTER_LINE}</p>`);
  h.push(`</div></body></html>`);
  return { subject: plainDashes(subject), text: t.join("\n"), html: h.join("\n") };
}

function deleteSection(deleteUrl: string): Section {
  return { heading: DELETE_LABEL, lines: [DELETE_LINE], link: deleteUrl };
}

function stepName(state: BriefState): string {
  return STEPS[state.step] ?? STEPS[0];
}

export interface SaveLinkArgs {
  state: BriefState;
  contact: EmailContact;
  resumeUrl: string;
  deleteUrl: string;
  /** A submitted brief: the view wording and subject. */
  locked?: boolean;
}

export function renderSaveLinkEmail(args: SaveLinkArgs): BriefEmail {
  const name = projectName(args.state);
  if (args.locked) {
    return render(`Your project brief: ${name}`, name, [
      { lines: ["Your brief has been submitted and is with Summit.", VIEW_LINE], link: args.resumeUrl },
      deleteSection(args.deleteUrl),
    ]);
  }
  return render("Pick up your project brief where you left off", name, [
    { lines: [`Your brief is saved and is on the step "${stepName(args.state)}".`, RESUME_LINE], link: args.resumeUrl },
    deleteSection(args.deleteUrl),
  ]);
}

export interface ConfirmationArgs {
  state: BriefState;
  contact: EmailContact;
  viewUrl: string;
  deleteUrl: string;
}

export function renderConfirmationEmail(args: ConfirmationArgs): BriefEmail {
  const name = projectName(args.state);
  const reqs = buildRequirements(args.state);
  const c = countByPriority(reqs);
  const summary = `What you sent: ${reqs.length} requirement${reqs.length === 1 ? "" : "s"} (${c.Must} must have), ${args.state.roles.length} user type${args.state.roles.length === 1 ? "" : "s"}.`;
  return render(`Your project brief is with Summit: ${name}`, `Thanks, ${args.contact.name.trim().split(/\s+/)[0] || "and well done"}. Your brief is with Summit.`, [
    { lines: [CONFIRMATION_LINE, summary] },
    { heading: "Your brief", lines: ["Open the link to see what you sent and to ask for a change."], link: args.viewUrl },
    deleteSection(args.deleteUrl),
  ]);
}

export interface AlertArgs {
  state: BriefState;
  contact: EmailContact;
  sourceTag: string;
  adminUrl: string;
  notionFailed: boolean;
  notionUrl?: string | null;
}

export function renderAlertEmail(args: AlertArgs): BriefEmail {
  const name = projectName(args.state);
  const reqs = buildRequirements(args.state);
  const c = countByPriority(reqs);
  const path = PATHS.find((p) => p.key === args.state.path)?.title ?? "not chosen";
  const lines = [
    `Name: ${args.contact.name}`,
    `Company: ${args.contact.company}`,
    `Website: ${args.contact.website}`,
    `Project: ${name}`,
    `Starting point: ${path}`,
    `Must count: ${c.Must}`,
    `Requirements: ${reqs.length}`,
    `Source: ${args.sourceTag || "(none)"}`,
  ];
  if (args.notionFailed) lines.push(NOTION_FAILED_LINE);
  const sections: Section[] = [{ lines }, { heading: "Open in admin", lines: [], link: args.adminUrl }];
  if (args.notionUrl) sections.push({ heading: "Notion page", lines: [], link: args.notionUrl });
  return render(`New project brief: ${name} from ${args.contact.company}`, `New project brief: ${name}`, sections);
}

export interface ReminderArgs {
  state: BriefState;
  resumeUrl: string;
  deleteUrl: string;
}

export function renderReminderEmail(args: ReminderArgs): BriefEmail {
  const name = projectName(args.state);
  const pct = completeness(args.state);
  return render("Your project brief is waiting", name, [
    { lines: [`Your brief is ${pct}% complete and is on step ${args.state.step + 1}, ${stepName(args.state)}.`, RESUME_LINE], link: args.resumeUrl },
    { heading: DELETE_LABEL, lines: [REMINDER_OPT_OUT], link: args.deleteUrl },
  ]);
}

export interface ChangeRequestArgs {
  state: BriefState;
  contact: EmailContact;
  message: string;
  adminUrl: string;
}

export function renderChangeRequestEmail(args: ChangeRequestArgs): BriefEmail {
  const name = projectName(args.state);
  return render(`Change requested on a brief: ${name}`, `Change requested: ${name}`, [
    { lines: [`Name: ${args.contact.name}`, `Company: ${args.contact.company}`] },
    { heading: "Their message", lines: [`"${args.message.trim()}"`] },
    { heading: "Open in admin", lines: ["Unlock the brief from admin to let them edit it."], link: args.adminUrl },
  ]);
}

export interface UnlockArgs {
  state: BriefState;
  contact: EmailContact;
  resumeUrl: string;
  deleteUrl: string;
}

export function renderUnlockEmail(args: UnlockArgs): BriefEmail {
  const name = projectName(args.state);
  return render("Your project brief is open for changes", name, [
    { lines: [UNLOCK_LINE, RESUME_LINE], link: args.resumeUrl },
    deleteSection(args.deleteUrl),
  ]);
}
