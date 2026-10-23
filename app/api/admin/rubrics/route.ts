import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/app/lib/auth";
import { clearRubricCache } from "@/app/lib/rubrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Refresh button on /admin/rubrics: clears `rubric:*` and returns to the page. */
export async function POST(req: NextRequest) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    await clearRubricCache();
  } catch (err) {
    console.error("admin rubrics refresh", err instanceof Error ? err.message : err);
  }
  return NextResponse.redirect(new URL("/admin/rubrics", req.url), 303);
}
