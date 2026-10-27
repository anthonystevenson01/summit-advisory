import { NextRequest, NextResponse } from "next/server";
import { setPaused } from "@/app/lib/ask-summit/admin";
import { validateSession } from "@/app/lib/auth";
import { track } from "@/app/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** The pause switch: `action=pause` or `action=resume`, a 303 back to the queue. */
export async function POST(req: NextRequest) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const redirectTo = (query: string) => NextResponse.redirect(new URL(`/admin/ask-summit?${query}`, req.url), 303);
  let action = "";
  try {
    const form = await req.formData();
    const value = form.get("action");
    if (typeof value === "string") action = value;
  } catch {
    action = "";
  }
  if (action !== "pause" && action !== "resume") return redirectTo("error=failed");
  try {
    await setPaused(action === "pause");
  } catch (err) {
    console.error("admin ask-summit pause", err instanceof Error ? err.message : err);
    return redirectTo("error=failed");
  }
  void track(action === "pause" ? "ask_paused" : "ask_resumed");
  return redirectTo(`status=${action === "pause" ? "paused" : "resumed"}`);
}
