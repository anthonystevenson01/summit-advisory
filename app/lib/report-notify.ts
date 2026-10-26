/**
 * The alert to Anthony when a report is opened for the first time or a tool
 * is re-run from it. Never throws: when NOTIFY_EMAIL is unset or SMTP is not
 * configured it logs once per instance and returns; a transport failure is
 * logged through `redactAddresses`. Callers run it inside `after()` so the
 * response is sent first and the platform keeps the function alive until the
 * send settles; the body carries the same guard as `track`.
 */
import { isMailConfigured, resultFromAddress, sendMail } from "./mail.ts";
import { redactAddresses } from "./tools/result-email.ts";
import { renderReportNotification } from "./tools/report-notification.ts";
import type { ReportRecord } from "./tools/report-model.ts";

export interface ReportNotifyArgs {
  kind: "opened" | "rerun";
  report: ReportRecord;
  /** The scheme and host the links are built on. */
  origin: string;
  openCount?: number;
  rerunCount?: number;
  /** The tool name for a re-run. */
  tool?: string;
}

const SEND_TIMEOUT_MS = 10_000;

let warned = false;

/** `{scheme}://{host}` from the forwarded headers, http for a local host. */
export function originFromHeaders(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "summitstrategyadvisory.com";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = headers.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

export async function notifyReportEvent(args: ReportNotifyArgs): Promise<void> {
  try {
    const to = process.env.NOTIFY_EMAIL?.trim();
    if (!to || !isMailConfigured()) {
      if (!warned) {
        warned = true;
        console.warn("report notifications are off: NOTIFY_EMAIL or the SMTP variables are not set");
      }
      return;
    }
    const { report } = args;
    const { subject, text } = renderReportNotification({
      company: report.company,
      slug: report.slug,
      event: args.kind,
      atIso: new Date().toISOString(),
      openCount: args.openCount ?? report.openCount,
      rerunCount: args.rerunCount ?? report.rerunCount,
      reportUrl: `${args.origin}/report/${report.slug}`,
      adminUrl: `${args.origin}/admin/reports/${report.slug}`,
      tool: args.tool,
    });
    await sendMail({ from: resultFromAddress() || to, to, subject, text, timeoutMs: SEND_TIMEOUT_MS });
  } catch (err) {
    console.error(`report notification (${args.kind}, ${args.report.slug}) failed:`, redactAddresses(err instanceof Error ? err.message : String(err)));
  }
}
