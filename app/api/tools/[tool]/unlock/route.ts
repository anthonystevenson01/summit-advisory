import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";
import { isToolPublic } from "@/app/lib/tools/registry";
import { validateUnlock } from "@/app/lib/tools/validate";
import { hashEmail } from "@/app/lib/tools/unlock-token";
import { getCompositeRun, getRun, markCompositeUnlocked, markUnlocked } from "@/app/lib/runs";
import { BUILT_TO_SCALE_TOOL } from "@/app/lib/tools/built-to-scale-method";
import { track } from "@/app/lib/events";
import { UNLOCK_COOKIE, getUnlockSecret, issueUnlockCookie, unlockCookieOptions } from "@/app/lib/unlock";
import { errorResponse } from "../errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { runId?: unknown; name?: unknown; email?: unknown; company?: unknown; website?: unknown };

/**
 * Email-first unlock. Records the unlock on the run (which also indexes it
 * by email hash), appends to the digest list with empty name and company
 * when absent, and sets the 30 day unlock cookie when UNLOCK_SECRET is set.
 * Without the secret the unlock still records per run and no cookie goes out.
 *
 * `tool` is a public registry slug or `built-to-scale`. For a composite the
 * unlock is written onto the composite and every child run together.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }
  const isComposite = tool === BUILT_TO_SCALE_TOOL;
  if (!isComposite && !isToolPublic(tool)) {
    return NextResponse.json({ error: "This tool is not available." }, { status: 404 });
  }

  const validated = validateUnlock(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";

  try {
    const run = isComposite ? await getCompositeRun(runId) : await getRun(runId);
    if (!run || run.tool !== tool) {
      return NextResponse.json({ error: "Run not found. It may have expired." }, { status: 404 });
    }

    const { name, email, company } = validated;
    const emailHash = hashEmail(email);
    const at = new Date().toISOString();

    const unlock = { emailHash, email, name, company, at };
    if (run.tool === BUILT_TO_SCALE_TOOL) {
      await markCompositeUnlocked(run.id, Object.values(run.children), unlock);
    } else {
      await markUnlocked(run.id, unlock);
    }

    // The daily digest reads this list; same keys as before, empty strings where absent.
    try {
      await getRedis().rpush(
        "gtm-unlocks",
        JSON.stringify({ id: run.id, tool, name, email, company, unlockedAt: at }),
      );
    } catch (err) {
      console.error(`${tool} unlock: digest append failed`, err instanceof Error ? err.message : err);
    }

    void track("email_given", { tool, runId: run.id, emailHash });

    const cookieValue = getUnlockSecret() ? issueUnlockCookie(emailHash) : null;
    const res = NextResponse.json({ ok: true, unlocked: cookieValue !== null });
    if (cookieValue) res.cookies.set(UNLOCK_COOKIE, cookieValue, unlockCookieOptions());
    return res;
  } catch (err) {
    return errorResponse(err, `${tool} unlock`);
  }
}
