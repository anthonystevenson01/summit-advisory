import { NextRequest, NextResponse } from "next/server";
import { getBuilderEventLimiter } from "@/app/lib/ratelimit";
import { track } from "@/app/lib/events";
import { honeypotResponse, isHoneypotFilled, limit, readJson } from "../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * The two client fired events, `builder_started` and `builder_step_completed`
 * (with a step 1 to 6), and nothing else: the route cannot be used to write
 * arbitrary events. The page sends it with keepalive and ignores the result.
 */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();

  const limited = await limit(req, getBuilderEventLimiter(), "event", 3600);
  if (limited) return limited;

  if (body.name === "builder_started") {
    void track("builder_started");
    return NextResponse.json({ ok: true });
  }
  if (body.name === "builder_step_completed") {
    const step = typeof body.step === "number" ? body.step : Number(body.step);
    if (!Number.isInteger(step) || step < 1 || step > 6) return NextResponse.json({ error: "Unknown step." }, { status: 400 });
    void track("builder_step_completed", { step });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown event." }, { status: 400 });
}
