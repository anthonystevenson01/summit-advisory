/**
 * The Ask Summit sends: the confirmation to the prospect and the alerts to
 * Anthony. Addresses never reach a log (every transport error goes through
 * `redactAddresses`); the delete link is signed with UNLOCK_SECRET through
 * unlock.ts and falls back to the contact line when the secret is unset.
 * `notifyAnthony` never throws and warns once per instance when NOTIFY_EMAIL
 * or SMTP is missing, as report-notify.ts does.
 */
import { isMailConfigured, resultFromAddress, sendMail } from "../mail.ts";
import { redactAddresses } from "../tools/result-email.ts";
import { getUnlockSecret, issueDeleteToken } from "../unlock.ts";
import { renderConfirmationEmail, renderQueueNotification, type QueueNotificationArgs } from "./templates.ts";
import type { AskRequestRecord, ConfirmationStatus } from "./request-model.ts";

const ALERT_TIMEOUT_MS = 10_000;

let warned = false;

/** `{origin}/api/tools/data/delete?e={hash}&t={token}`, or null when UNLOCK_SECRET is unset. */
export function deleteUrlFor(origin: string, emailHash: string): string | null {
  if (!getUnlockSecret()) return null;
  const token = issueDeleteToken(emailHash);
  return token ? `${origin}/api/tools/data/delete?e=${encodeURIComponent(emailHash)}&t=${encodeURIComponent(token)}` : null;
}

/** Sends the confirmation; "unconfigured" when SMTP is missing, "failed" on a transport error (logged, redacted). */
export async function sendConfirmation(record: AskRequestRecord, opts: { origin: string; timeoutMs: number }): Promise<ConfirmationStatus> {
  if (!isMailConfigured()) return "unconfigured";
  const email = renderConfirmationEmail({
    name: record.name,
    siteUrl: record.url,
    fileNames: record.files.map((f) => f.name),
    deleteUrl: deleteUrlFor(opts.origin, record.emailHash),
  });
  try {
    await sendMail({ from: resultFromAddress(), to: record.email, subject: email.subject, text: email.text, html: email.html, timeoutMs: Math.max(1_000, opts.timeoutMs) });
    return "sent";
  } catch (err) {
    console.error(`ask-summit: confirmation failed for ${record.id}: ${redactAddresses(err instanceof Error ? err.message : String(err))}`);
    return "failed";
  }
}

/** The alert to Anthony: done, failed or stuck. Never throws. */
export async function notifyAnthony(args: QueueNotificationArgs): Promise<void> {
  try {
    const to = process.env.NOTIFY_EMAIL?.trim();
    if (!to || !isMailConfigured()) {
      if (!warned) {
        warned = true;
        console.warn("ask-summit alerts are off: NOTIFY_EMAIL or the SMTP variables are not set");
      }
      return;
    }
    const { subject, text } = renderQueueNotification({ ...args, message: args.message ? redactAddresses(args.message) : args.message });
    await sendMail({ from: resultFromAddress() || to, to, subject, text, timeoutMs: ALERT_TIMEOUT_MS });
  } catch (err) {
    console.error(`ask-summit alert (${args.kind}, ${args.requestId}) failed:`, redactAddresses(err instanceof Error ? err.message : String(err)));
  }
}
