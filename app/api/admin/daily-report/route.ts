import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getRedis } from "@/app/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Invoked by Vercel Cron once per day at 00:00 UTC.
// Reads the last 24h of ICP + GTM unlocks and emails a digest to NOTIFY_EMAIL.
// Skips sending entirely on zero-lead days.

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

  if (total === 0) {
    // Silent on zero-lead days — per the user's spec.
    return NextResponse.json({ ok: true, count: 0, skipped: "no leads in last 24h" });
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
      lines.push(`${i + 1}. ${u.name} <${u.email}> — ${u.company}`);
      lines.push(`   ${formatStamp(u.unlockedAt)}`);
      lines.push("");
    });
  }

  if (recentGtm.length > 0) {
    lines.push("──── GTM Unlocks ────");
    lines.push("");
    recentGtm.forEach((u, i) => {
      const toolLabel = u.tool && TOOL_LABELS[u.tool] ? TOOL_LABELS[u.tool] : (u.tool ?? "Unknown");
      lines.push(`${i + 1}. ${u.name} <${u.email}> — ${u.company}`);
      lines.push(`   Tool: ${toolLabel} | ${formatStamp(u.unlockedAt)}`);
      lines.push("");
    });
  }

  lines.push("─".repeat(30));
  lines.push("View all: https://summitstrategyadvisory.com/admin");

  const text = lines.join("\n");

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: NOTIFY_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `Summit — ${total} new lead${total === 1 ? "" : "s"} yesterday`,
      text,
    });
  } catch (mailErr) {
    console.error("daily-report: email failed", mailErr);
    return NextResponse.json(
      { error: "Email send failed", count: total },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, count: total, icp: recentIcp.length, gtm: recentGtm.length });
}
