import { NextRequest, NextResponse } from "next/server";
import { BRAND, CONTACT_EMAIL } from "@/app/lib/brand";
import { getReport } from "@/app/lib/reports";
import { EXPIRED_BODY, EXPIRED_HEADING, isExpired, isValidSlug } from "@/app/lib/tools/report-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * The 410 page. An App Router page can answer 404 or redirect, not 410, so
 * the report page redirects here and this handler re-reads the report: a
 * published report whose expiry has passed gets a plain HTML 410 (no
 * script, noindex, no-store); anything else is 404 JSON so the URL cannot
 * be used to tell drafts from unknown slugs. The page helper mirrors the
 * delete route's; the duplication is noted in the design.
 */
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderPage({ title, body }: { title: string; body: string }): string {
  return [
    "<!doctype html>",
    `<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHtml(title)}</title></head>`,
    `<body style="margin:0;padding:0;background:${BRAND.lightBg};font-family:${FONT};color:${BRAND.dark};">`,
    `<div style="background:${BRAND.darkGreen};padding:18px 24px;"><span style="color:${BRAND.white};font-size:14px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Summit Strategy Advisory</span></div>`,
    `<main style="max-width:560px;margin:40px auto;padding:32px 28px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;">`,
    body,
    "</main>",
    "</body></html>",
  ].join("");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const notFound = NextResponse.json({ error: "Report not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isValidSlug(slug)) return notFound;
  let report;
  try {
    report = await getReport(slug);
  } catch (err) {
    console.error("report expired page: report read failed", err instanceof Error ? err.message : err);
    return notFound;
  }
  if (!report || report.state !== "published" || !isExpired(report)) return notFound;

  const body =
    `<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${BRAND.darkGreen};">${escapeHtml(EXPIRED_HEADING)}</h1>` +
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.dark};">${escapeHtml(EXPIRED_BODY)}</p>` +
    `<p style="margin:20px 0 0;font-size:14px;">Write to <a href="mailto:${escapeHtml(CONTACT_EMAIL)}" style="color:${BRAND.teal};">${escapeHtml(CONTACT_EMAIL)}</a></p>`;
  return new NextResponse(renderPage({ title: EXPIRED_HEADING, body }), {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
