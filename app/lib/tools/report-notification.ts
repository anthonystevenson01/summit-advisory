/**
 * The one-line alert to Anthony when a report is opened for the first time
 * or a tool is re-run from it: subject and plain text only. Pure: every
 * caller string goes through `plainDashes`, nothing reads env or the
 * network, so the template is unit tested offline.
 */
import { plainDashes } from "./result-email.ts";

export type ReportNotificationEvent = "opened" | "rerun";

export interface ReportNotificationArgs {
  company: string;
  slug: string;
  event: ReportNotificationEvent;
  atIso: string;
  openCount: number;
  rerunCount: number;
  reportUrl: string;
  adminUrl: string;
  /** The tool name for a re-run. */
  tool?: string;
}

export interface ReportNotification {
  subject: string;
  text: string;
}

function whenLabel(atIso: string): string {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return atIso;
  const d = new Date(t);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

export function renderReportNotification(args: ReportNotificationArgs): ReportNotification {
  const company = plainDashes(args.company).trim() || "Untitled report";
  const slug = plainDashes(args.slug);
  const tool = plainDashes(args.tool ?? "").trim() || "a tool";
  const subject = args.event === "opened" ? `Report opened: ${company}` : `Report re-run: ${company} (${tool})`;
  const happened = args.event === "opened" ? "opened for the first time" : `${tool} re-run from the report`;
  const lines = [
    `${company} (${slug})`,
    `What happened: ${happened}`,
    `When: ${whenLabel(args.atIso)}`,
    `Opens so far: ${args.openCount}`,
    `Re-runs so far: ${args.rerunCount}`,
    `Report: ${plainDashes(args.reportUrl)}`,
    `Edit: ${plainDashes(args.adminUrl)}`,
  ];
  return { subject, text: lines.join("\n") };
}
