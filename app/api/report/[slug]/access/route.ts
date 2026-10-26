import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getReportAccessLimiter } from "@/app/lib/ratelimit";
import { getReport } from "@/app/lib/reports";
import { verifyAccessCode } from "@/app/lib/tools/report-access";
import { REPORT_LIFETIME_DAYS, isExpired, isValidSlug } from "@/app/lib/tools/report-model";
import { REPORT_ACCESS_COOKIE, issueReportAccessCookie, reportAccessCookieOptions } from "@/app/lib/unlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_COOKIE_AGE_SECONDS = REPORT_LIFETIME_DAYS * 24 * 60 * 60;

/**
 * The access-code form's target. Order: slug, the limiter (before any read
 * of the report, so a guessing loop costs one limiter call per attempt and
 * never a Redis read of the record), the report's state, the code, then
 * the cookie. Every outcome is a 303 back to the report (with
 * `?access=wrong` or `?access=limited`), to the expired page, or with the
 * cookie set; an unknown slug is 404 JSON. The code is never logged and
 * never echoed.
 *
 * 303 only, never a rendered body: a form POST answered with 303 makes the
 * browser GET the report, so a refresh never resubmits the code, the code
 * never appears in a URL or the history, and the outcome reaches the page
 * as a one-word query the page turns into its own line. The cookie's
 * Max-Age is the time left until the report expires (at least a minute,
 * at most 30 days), so access ends with the report.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  const back = (query: string) => NextResponse.redirect(new URL(`/report/${slug}${query}`, req.url), 303);

  const limiter = getReportAccessLimiter();
  if (limiter) {
    const { success } = await limiter.limit(getClientIp(req));
    if (!success) return back("?access=limited");
  }

  let report;
  try {
    report = await getReport(slug);
  } catch (err) {
    console.error("report access: report read failed", err instanceof Error ? err.message : err);
    return back("?access=wrong");
  }
  if (!report || report.state !== "published") {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  if (isExpired(report)) return NextResponse.redirect(new URL(`/report/${slug}/expired`, req.url), 303);
  if (!report.accessCode) return back("");

  let code = "";
  try {
    const form = await req.formData();
    const value = form.get("code");
    if (typeof value === "string") code = value;
  } catch {
    code = "";
  }
  if (!verifyAccessCode(code, report.accessCode)) return back("?access=wrong");

  const token = issueReportAccessCookie(slug, report.accessCode.hash.slice(0, 8));
  if (!token) {
    console.warn("report access: UNLOCK_SECRET is not set, so no access cookie can be issued");
    return back("?access=wrong");
  }
  const untilExpiry = report.expiresAt ? Math.floor((Date.parse(report.expiresAt) - Date.now()) / 1000) : MAX_COOKIE_AGE_SECONDS;
  const maxAge = Math.max(60, Math.min(MAX_COOKIE_AGE_SECONDS, untilExpiry));
  const res = back("");
  res.cookies.set(REPORT_ACCESS_COOKIE, token, reportAccessCookieOptions(slug, maxAge));
  return res;
}
