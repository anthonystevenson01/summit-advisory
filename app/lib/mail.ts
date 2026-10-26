/**
 * The one nodemailer transport. The emailed result and the daily digest
 * both send through sendMail, so SMTP configuration is read in one place
 * and a change of provider is one edit. (Three older routes, ai-studio-request,
 * admin/reset-request and crm-interest, still create their own transports;
 * routing them through here is a follow-up.)
 *
 * A transport is created per call rather than cached at module scope: on
 * Vercel each invocation may be a fresh instance anyway, and a per-call
 * transport means a stale connection can never be reused across calls.
 *
 * Timeout budget: when the caller gives `timeoutMs`, it is applied to each of
 * nodemailer's three stages (connection, greeting, socket). The stages run
 * one after another, so a host that stalls at every stage could take up to
 * three times the budget; in practice a stall is at one stage. The daily
 * digest passes no budget and keeps nodemailer's defaults. Never logs
 * credentials. Throws on failure: callers decide what a failed send means.
 */
import nodemailer from "nodemailer";

export interface SendMailArgs {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Applied to each of the connection, greeting and socket timeouts in ms. Omit for nodemailer's defaults. */
  timeoutMs?: number;
}

export function isMailConfigured(): boolean {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

/** The From address on the emailed result: RESULT_FROM_EMAIL, else SMTP_USER. */
export function resultFromAddress(): string {
  return process.env.RESULT_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim() || "";
}

/** Throws "SMTP not configured" before touching the network when any SMTP variable is missing. */
export async function sendMail(args: SendMailArgs): Promise<void> {
  if (!isMailConfigured()) throw new Error("SMTP not configured");
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    ...(args.timeoutMs !== undefined
      ? { connectionTimeout: args.timeoutMs, greetingTimeout: args.timeoutMs, socketTimeout: args.timeoutMs }
      : {}),
  });
  await transporter.sendMail({
    from: args.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    ...(args.html ? { html: args.html } : {}),
  });
}
