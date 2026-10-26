import { NextRequest, NextResponse, after } from "next/server";
import { getEvaluateLimiter, getClientIp } from "@/app/lib/ratelimit";
import { getTool, isToolPublic, type ToolEntry } from "@/app/lib/tools/registry";
import { validateInputs } from "@/app/lib/tools/validate";
import { scoreRun } from "@/app/lib/tools/pipeline";
import { track } from "@/app/lib/events";
import { getReport, recordRerun } from "@/app/lib/reports";
import { notifyReportEvent, originFromHeaders } from "@/app/lib/report-notify";
import { isExpired, isValidSlug } from "@/app/lib/tools/report-model";
import { UNLOCK_COOKIE, verifyUnlockCookie } from "@/app/lib/unlock";
import { RATE_LIMIT_MESSAGE, errorResponse } from "../errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = { inputs?: unknown; website?: unknown; rerunOf?: unknown; report?: unknown };

/**
 * The Release 4 re-run hook: a score made from a report's re-run link
 * (`rerunOf` plus a `report` slug) counts on that report when it is
 * published and not expired. The slug is validated, looked up once, used
 * to increment one counter and name one event, and never written to the
 * run or echoed; a draft, unpublished, expired or unknown slug does
 * nothing, so a report Anthony has withdrawn or let lapse stops collecting
 * counts and alerts. Any failure is logged and the response is unchanged:
 * the visitor's score must never depend on the report store.
 */
async function countReportRerun(req: NextRequest, entry: ToolEntry, runId: string, rerunOf: string, slug: string): Promise<void> {
  try {
    const report = await getReport(slug);
    if (!report || report.state !== "published" || isExpired(report)) return;
    const rerunCount = await recordRerun(slug);
    void track("report_tool_rerun", { tool: entry.slug, runId, rerunOf, report: slug });
    const origin = originFromHeaders(req.headers);
    after(() => notifyReportEvent({ kind: "rerun", report, origin, rerunCount, tool: entry.name }));
  } catch (err) {
    console.error(`${entry.slug} score: report re-run hook failed for ${slug}`, err instanceof Error ? err.message : err);
  }
}

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
      // Only inside the rerunOf branch: a `report` slug on a plain first
      // run means nothing and must not move a report's counter.
      if (isValidSlug(body.report)) await countReportRerun(req, entry, free.runId, body.rerunOf, body.report);
    }
    // A valid unlock cookie lets the page skip the gate; the unlock itself is
    // recorded at details time, so nothing is written to the run here.
    const claims = verifyUnlockCookie(req.cookies.get(UNLOCK_COOKIE)?.value);
    return NextResponse.json({ ...free, unlocked: free.unlocked || claims !== null });
  } catch (err) {
    return errorResponse(err, `${tool} score`);
  }
}
