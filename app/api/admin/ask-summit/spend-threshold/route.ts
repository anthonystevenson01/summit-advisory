import { NextRequest, NextResponse } from "next/server";
import { setSpendThreshold } from "@/app/lib/ask-summit/admin";
import { parseThreshold } from "@/app/lib/ask-summit/spend";
import { validateSession } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Writes the monthly spend threshold from /admin/models: a number of dollars, or blank to clear. */
export async function POST(req: NextRequest) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  let body: { threshold?: unknown };
  try {
    body = (await req.json()) as { threshold?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const threshold = parseThreshold(body.threshold);
  if (threshold === undefined) {
    return NextResponse.json({ error: "Threshold must be a number of dollars, or blank to clear." }, { status: 400 });
  }
  try {
    await setSpendThreshold(threshold);
  } catch (err) {
    console.error("admin spend threshold", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save the threshold." }, { status: 500 });
  }
  return NextResponse.json({ threshold });
}
