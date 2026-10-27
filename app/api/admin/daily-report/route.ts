import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";
import { isMailConfigured, resultFromAddress, sendMail } from "@/app/lib/mail";
import { getMonthSpend, getSpendThreshold, markSpendAlerted, monthKey, wasSpendAlerted } from "@/app/lib/ask-summit/admin";
import { spendAlertDue } from "@/app/lib/ask-summit/spend";
import { originFromHeaders } from "@/app/lib/report-notify";
import { deleteBrief, listBriefsUpdatedBetween, listStaleDrafts, updateBrief, type BriefRecord } from "@/app/lib/briefs";
import { getUnlockSecret, issueBriefDeleteToken, issueBriefLinkToken } from "@/app/lib/unlock";
import { archiveBriefPage } from "@/app/lib/project-builder-notion";
import { BRIEF_DRAFT_TTL_SECONDS, statusLabel } from "@/app/lib/project-builder/brief";
import { renderReminderEmail } from "@/app/lib/project-builder/emails";
import { buildRequirements, countByPriority, projectName } from "@/app/lib/project-builder/requirements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Invoked by Vercel Cron once per day at 00:00 UTC.
// Reads the last 24h of ICP + GTM unlocks and the Project Builder briefs saved
// or submitted in the same window, and emails a digest to NOTIFY_EMAIL. Skips
// sending when there is nothing to report. Then, outside the digest, sends one
// reminder to each draft brief untouched for three days that has not had one,
// and purges drafts untouched for six months whose TTL has not removed them.

type IcpUnlock = {
  id: string | null;
  name: string;
  email: string;
  company: string;
  unlockedAt: string;
};

type GtmUnlock = {
  id: string | null;
  tool: string | null;
  name: string;
  email: string;
  company: string;
  unlockedAt: string;
};

const TOOL_LABELS: Record<string, string> = {
  persona: "Persona",
  problem: "Problem",
  positioning: "Positioning",
  moat: "Moat",
};

/** "Name <email>, Company" with absent parts dropped; a missing name prints the email alone. */
function formatLead(u: { name?: unknown; email?: unknown; company?: unknown }): string {
  const name = typeof u.name === "string" ? u.name.trim() : "";
  const email = typeof u.email === "string" ? u.email.trim() : "";
  const company = typeof u.company === "string" ? u.company.trim() : "";
  const who = name ? `${name} <${email}>` : email;
  return company ? `${who}, ${company}` : who;
}

type SpendAlertOutcome = "sent" | "failed" | "not-due" | "unconfigured";

/**
 * The monthly spend alert (Release 3b): once per UTC month, when this
 * month's spend from `ai:calls` has reached the threshold set on
 * /admin/models, one plain text email to NOTIFY_EMAIL. The flag is set
 * only after a send, so a failed send retries the next day. Runs before
 * the zero-lead early return so a quiet day still alerts.
 */
async function spendAlert(origin: string): Promise<SpendAlertOutcome> {
  const now = Date.now();
  const month = monthKey(now);
  const [spend, threshold, alerted] = await Promise.all([getMonthSpend(now), getSpendThreshold(), wasSpendAlerted(month)]);
  if (!spendAlertDue({ spend, threshold, alerted })) return "not-due";
  const to = process.env.NOTIFY_EMAIL?.trim();
  if (!to || !isMailConfigured()) return "unconfigured";
  const text = [
    `Spend so far in ${month}: $${spend.toFixed(2)}`,
    `Threshold: $${(threshold ?? 0).toFixed(2)}`,
    `Pause Ask Summit at ${origin}/admin/ask-summit if this is unexpected.`,
    `Routing table: ${origin}/admin/models`,
    "The figure comes from the last 2000 logged model calls; calls whose cost the provider did not report count as zero, so it is a lower bound.",
  ].join("\n");
  try {
    await sendMail({ from: to, to, subject: "Summit: model spend this month passed the threshold", text });
  } catch (err) {
    console.error("daily-report: spend alert failed", err instanceof Error ? err.message : err);
    return "failed";
  }
  await markSpendAlerted(month);
  return "sent";
}

const REMINDER_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const PURGE_AFTER_MS = BRIEF_DRAFT_TTL_SECONDS * 1000;
const REMINDER_CAP = 50;
const REMINDER_TIMEOUT_MS = 10_000;

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "https://summitstrategyadvisory.com";
}

function briefLine(b: BriefRecord): string {
  const must = countByPriority(buildRequirements(b.state)).Must;
  return `${projectName(b.state)}, ${b.contact.company}, ${b.contact.name}, ${statusLabel(b.status)}, Must ${must}, ${siteOrigin()}/admin/briefs/${b.id}`;
}

/** One reminder per stale draft that has not had one; `lastRemindedAt` is set only on a successful send and never moves `updatedAt`. */
async function sendReminders(now: number): Promise<number> {
  if (!getUnlockSecret() || !isMailConfigured()) return 0;
  const drafts = (await listStaleDrafts(now - REMINDER_AFTER_MS)).filter((b) => b.lastRemindedAt === null).slice(0, REMINDER_CAP);
  let sent = 0;
  for (const b of drafts) {
    const token = issueBriefLinkToken(b.id);
    const deleteToken = issueBriefDeleteToken(b.contact.emailHash);
    if (!token || !deleteToken || !b.contact.email) continue;
    const origin = siteOrigin();
    const email = renderReminderEmail({
      state: b.state,
      resumeUrl: `${origin}/tools/project-builder?b=${encodeURIComponent(b.id)}&t=${encodeURIComponent(token)}`,
      deleteUrl: `${origin}/api/project-builder/delete?e=${encodeURIComponent(b.contact.emailHash)}&t=${encodeURIComponent(deleteToken)}`,
    });
    try {
      await sendMail({ from: resultFromAddress(), to: b.contact.email, subject: email.subject, text: email.text, html: email.html, timeoutMs: REMINDER_TIMEOUT_MS });
      await updateBrief(b.id, { lastRemindedAt: new Date().toISOString() });
      sent += 1;
    } catch (err) {
      console.error(`daily-report: reminder failed for ${b.contact.emailHash.slice(0, 12)}`, err instanceof Error ? err.message.replace(/[^\s@]+@[^\s@]+/g, "[address]") : err);
    }
  }
  return sent;
}

/** Drafts untouched for six months: the index entries and any hash whose TTL was lost. */
async function purgeStaleDrafts(now: number): Promise<number> {
  const stale = await listStaleDrafts(now - PURGE_AFTER_MS);
  let purged = 0;
  for (const b of stale) {
    const deleted = await deleteBrief(b.id);
    if (!deleted) continue;
    purged += 1;
    if (deleted.notionPageId) await archiveBriefPage(deleted.notionPageId);
  }
  return purged;
}

function formatStamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";
  } catch {
    return iso;
  }
}

export async function GET(req: NextRequest) {
  // Auth: Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}` automatically
  // when CRON_SECRET is defined as an env var in the Vercel project.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let spendAlertOutcome: SpendAlertOutcome = "not-due";
  try {
    spendAlertOutcome = await spendAlert(originFromHeaders(req.headers));
  } catch (err) {
    console.error("daily-report: spend check failed", err instanceof Error ? err.message : err);
    spendAlertOutcome = "failed";
  }

  // Read both unlock lists in parallel
  let icpUnlocks: IcpUnlock[] = [];
  let gtmUnlocks: GtmUnlock[] = [];

  try {
    const redis = getRedis();
    const [rawIcp, rawGtm] = await Promise.all([
      redis.lrange("icp-unlocks", 0, -1),
      redis.lrange("gtm-unlocks", 0, -1),
    ]);
    icpUnlocks = rawIcp.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as IcpUnlock);
    gtmUnlocks = rawGtm.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as GtmUnlock);
  } catch (err) {
    console.error("daily-report: Redis read failed", err);
    return NextResponse.json({ error: "Redis unavailable" }, { status: 500 });
  }

  // Filter to last 24h. At 00:00 UTC this covers the calendar day that just ended.
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentIcp = icpUnlocks.filter((u) => {
    const t = Date.parse(u.unlockedAt);
    return Number.isFinite(t) && t >= cutoff;
  });
  const recentGtm = gtmUnlocks.filter((u) => {
    const t = Date.parse(u.unlockedAt);
    return Number.isFinite(t) && t >= cutoff;
  });

  const total = recentIcp.length + recentGtm.length;

  // Project Builder briefs saved or submitted in the window.
  let recentBriefs: BriefRecord[] = [];
  try {
    recentBriefs = (await listBriefsUpdatedBetween(cutoff, Date.now())).filter(
      (b) => Date.parse(b.savedAt) >= cutoff || (b.submittedAt !== null && Date.parse(b.submittedAt) >= cutoff),
    );
  } catch (err) {
    console.error("daily-report: brief read failed", err instanceof Error ? err.message : err);
  }

  /** The reminder and purge passes run after the digest and never fail the response. */
  const housekeeping = async () => {
    const now = Date.now();
    let reminders = 0;
    let purged = 0;
    try {
      reminders = await sendReminders(now);
    } catch (err) {
      console.error("daily-report: reminder pass failed", err instanceof Error ? err.message : err);
    }
    try {
      purged = await purgeStaleDrafts(now);
    } catch (err) {
      console.error("daily-report: purge pass failed", err instanceof Error ? err.message : err);
    }
    return { reminders, purged };
  };

  if (total === 0 && recentBriefs.length === 0) {
    // Nothing to report: no digest, but the reminders and the purge still run.
    const { reminders, purged } = await housekeeping();
    return NextResponse.json({ ok: true, count: 0, briefs: 0, reminders, purged, skipped: "nothing to report in last 24h", spendAlert: spendAlertOutcome });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;
  const smtpConfigured = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && NOTIFY_EMAIL;
  if (!smtpConfigured) {
    console.error("daily-report: SMTP not configured");
    return NextResponse.json(
      { error: "SMTP not configured", count: total },
      { status: 500 }
    );
  }

  // Build plain-text digest
  const lines: string[] = [];
  lines.push("Summit Daily Lead Report");
  lines.push("─".repeat(30));
  lines.push("");
  lines.push(
    `${total} new lead${total === 1 ? "" : "s"} in the last 24h (ICP: ${recentIcp.length}, GTM: ${recentGtm.length})`
  );
  lines.push("");

  if (recentIcp.length > 0) {
    lines.push("──── ICP Unlocks ────");
    lines.push("");
    recentIcp.forEach((u, i) => {
      lines.push(`${i + 1}. ${formatLead(u)}`);
      lines.push(`   ${formatStamp(u.unlockedAt)}`);
      lines.push("");
    });
  }

  if (recentGtm.length > 0) {
    lines.push("──── GTM Unlocks ────");
    lines.push("");
    recentGtm.forEach((u, i) => {
      const toolLabel = u.tool && TOOL_LABELS[u.tool] ? TOOL_LABELS[u.tool] : (u.tool ?? "Unknown");
      lines.push(`${i + 1}. ${formatLead(u)}`);
      lines.push(`   Tool: ${toolLabel} | ${formatStamp(u.unlockedAt)}`);
      lines.push("");
    });
  }

  if (recentBriefs.length > 0) {
    lines.push("──── Project briefs ────");
    lines.push("");
    recentBriefs.forEach((b, i) => {
      lines.push(`${i + 1}. ${briefLine(b)}`);
      lines.push("");
    });
  }

  lines.push("─".repeat(30));
  lines.push("View all: https://summitstrategyadvisory.com/admin");

  const text = lines.join("\n");

  try {
    await sendMail({
      from: NOTIFY_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `Summit: ${total} new lead${total === 1 ? "" : "s"} and ${recentBriefs.length} brief${recentBriefs.length === 1 ? "" : "s"} yesterday`,
      text,
    });
  } catch (mailErr) {
    console.error("daily-report: email failed", mailErr);
    return NextResponse.json(
      { error: "Email send failed", count: total },
      { status: 500 }
    );
  }

  const { reminders, purged } = await housekeeping();
  return NextResponse.json({ ok: true, count: total, icp: recentIcp.length, gtm: recentGtm.length, briefs: recentBriefs.length, reminders, purged, spendAlert: spendAlertOutcome });
}
