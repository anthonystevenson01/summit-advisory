import { NextRequest, NextResponse } from "next/server";
import { getBuiltToScaleLimiter, getClientIp } from "@/app/lib/ratelimit";
import { validateParts } from "@/app/lib/tools/built-to-scale-method";
import { scoreModel } from "@/app/lib/tools/built-to-scale";
import { UNLOCK_COOKIE, verifyUnlockCookie } from "@/app/lib/unlock";
import { errorResponse } from "@/app/api/tools/[tool]/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The deadline handed to the orchestration: the synthesis is refused or
 * abandoned against it so the route answers inside `maxDuration = 60` even
 * when the children and the synthesis both run long. The clock starts at
 * the top of the handler.
 */
const ROUTE_DEADLINE_MS = 57_000;

const RATE_LIMIT_MESSAGE =
  "Built to Scale? runs are limited to 2 an hour from one connection. Please try again later.";

type Body = { parts?: unknown; description?: unknown; website?: unknown };

/**
 * Order: parse, honeypot, validate the parts (400 with the message, before
 * the limiter so a malformed body spends no token), limiter, scoreModel with
 * the deadline, respond with the free view and `unlocked` from the cookie.
 *
 * The limiter is this route's own (`rl:bts`, 2 per IP per hour): one run is
 * every public tool's scoring call plus one synthesis, so it never spends a
 * tool token and the tool limits are unchanged. Errors go through the shared
 * errorResponse: InputError 400, a Draft composite row 503, and a
 * SynthesisFailedError 502 with the children already stored and a message to
 * try again (the token spent on that run is not refunded).
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();

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

  const validated = validateParts(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const ip = getClientIp(req);
  const limiter = getBuiltToScaleLimiter();
  if (limiter) {
    const { success, remaining } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: RATE_LIMIT_MESSAGE },
        { status: 429, headers: { "Retry-After": "3600", "X-RateLimit-Remaining": String(remaining) } },
      );
    }
  }

  try {
    const { free } = await scoreModel(
      { parts: body.parts, description: body.description },
      { source: "web", ip, deadlineAt: startedAt + ROUTE_DEADLINE_MS },
    );
    // A valid unlock cookie lets the page skip the gate; the unlock itself is
    // recorded at details time, so nothing is written to the run here.
    const claims = verifyUnlockCookie(req.cookies.get(UNLOCK_COOKIE)?.value);
    return NextResponse.json({ ...free, unlocked: free.unlocked || claims !== null });
  } catch (err) {
    return errorResponse(err, "built-to-scale score");
  }
}
