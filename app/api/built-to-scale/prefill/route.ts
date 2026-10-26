import { NextRequest, NextResponse } from "next/server";
import { getRun, isRunId } from "@/app/lib/runs";
import { isToolPublic } from "@/app/lib/tools/registry";
import { track } from "@/app/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The hand-off endpoint: a tool run's inputs and slug, nothing else (no
 * scores, reasoning, extras, unlock or email fields), for the Built to
 * Scale? form (`via=tool`) and for a tool page re-run from a scorecard row
 * (`via=scorecard`). A composite id, an unknown id or a hidden tool's run is
 * 404. The response is never cached. Inputs only, because the hand-off needs
 * the text and nothing else, and a free view must never become a way to read
 * a stranger's scores. No token: the links that reach here (`?from=` and
 * `?prefill=`) are built on a page that already holds the run id, run ids
 * are 64 bits of entropy, and the text returned is the visitor's own, as the
 * 1a design accepted for stored views; a signed prefill token is the
 * follow-up if the owner wants one.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const runId = params.get("runId") ?? "";
  const via = params.get("via");
  if (!isRunId(runId)) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  try {
    const run = await getRun(runId);
    if (!run || !isToolPublic(run.tool)) {
      return NextResponse.json({ error: "Run not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const props = { tool: run.tool, runId: run.id, ...(run.parentId ? { parentId: run.parentId } : {}) };
    if (via === "tool") void track("score_whole_model_handoff", props);
    else if (via === "scorecard") void track("tool_rerun_from_scorecard", props);

    return NextResponse.json({ runId: run.id, tool: run.tool, inputs: run.inputs }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("built-to-scale prefill:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
