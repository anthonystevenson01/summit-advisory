import { NextRequest, NextResponse } from "next/server";
import { track } from "@/app/lib/events";
import { getReport } from "@/app/lib/reports";
import { isValidSlug } from "@/app/lib/tools/report-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * The beacon behind the report's call to action. The body is read as text
 * and parsed leniently (sendBeacon sends a text body); the event must be
 * `book_call_clicked` and the slug must name a published report; then the
 * event is tracked with the slug and nothing else. Always 204: a beacon has
 * no reader. Nothing is read from cookies or headers.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const res = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  const { slug } = await params;
  if (!isValidSlug(slug)) return res;

  let event = "";
  try {
    const parsed = JSON.parse(await req.text()) as { event?: unknown };
    if (typeof parsed?.event === "string") event = parsed.event;
  } catch {
    return res;
  }
  if (event !== "book_call_clicked") return res;

  try {
    const report = await getReport(slug);
    if (report && report.state === "published") void track("book_call_clicked", { slug });
  } catch (err) {
    console.error("report event: report read failed", err instanceof Error ? err.message : err);
  }
  return res;
}
