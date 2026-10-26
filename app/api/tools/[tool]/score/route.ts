import { NextRequest, NextResponse } from "next/server";
import { getEvaluateLimiter, getClientIp } from "@/app/lib/ratelimit";
import { getTool, isToolPublic } from "@/app/lib/tools/registry";
import { validateInputs } from "@/app/lib/tools/validate";
import { scoreRun } from "@/app/lib/tools/pipeline";
import { track } from "@/app/lib/events";
import { UNLOCK_COOKIE, verifyUnlockCookie } from "@/app/lib/unlock";
import { RATE_LIMIT_MESSAGE, errorResponse } from "../errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = { inputs?: unknown; website?: unknown; rerunOf?: unknown };

export async function POST(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Honeypot: bots fill the hidden field. Answer as if it worked, without a run.
  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const entry = getTool(tool);
  if (!entry || !isToolPublic(tool)) {
    return NextResponse.json({ error: "This tool is not available." }, { status: 404 });
  }

  const validated = validateInputs(entry, body.inputs);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const ip = getClientIp(req);
  const limiter = getEvaluateLimiter();
  if (limiter) {
    const { success, limit, remaining } = await limiter.limit(`${ip}:${tool}`);
    if (!success) {
      return NextResponse.json(
        { error: RATE_LIMIT_MESSAGE(limit) },
        { status: 429, headers: { "Retry-After": "3600", "X-RateLimit-Remaining": String(remaining) } },
      );
    }
  }

  try {
    const { free } = await scoreRun(tool, validated.inputs, { source: "web", ip });
    if (typeof body.rerunOf === "string" && body.rerunOf.length > 0) {
      void track("re_run", { tool, runId: free.runId, rerunOf: body.rerunOf });
    }
    // A valid unlock cookie lets the page skip the gate; the unlock itself is
    // recorded at details time, so nothing is written to the run here.
    const claims = verifyUnlockCookie(req.cookies.get(UNLOCK_COOKIE)?.value);
    return NextResponse.json({ ...free, unlocked: free.unlocked || claims !== null });
  } catch (err) {
    return errorResponse(err, `${tool} score`);
  }
}
