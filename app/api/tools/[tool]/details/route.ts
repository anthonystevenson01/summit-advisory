import { NextRequest, NextResponse } from "next/server";
import { getDetailsLimiter, getClientIp } from "@/app/lib/ratelimit";
import { isToolPublic } from "@/app/lib/tools/registry";
import { getRun } from "@/app/lib/runs";
import { detailRun, toFullView } from "@/app/lib/tools/pipeline";
import { errorResponse } from "../errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;

  let body: { runId?: unknown };
  try {
    body = (await req.json()) as { runId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isToolPublic(tool)) {
    return NextResponse.json({ error: "This tool is not available." }, { status: 404 });
  }
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  if (!runId) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  try {
    const run = await getRun(runId);
    if (!run || run.tool !== tool) {
      return NextResponse.json({ error: "Run not found. It may have expired." }, { status: 404 });
    }
    // Re-opening a run that already has details is free: served before the limiter.
    if (run.detailsAt && run.unlock) {
      return NextResponse.json(toFullView(run));
    }
    if (!run.unlock) {
      return NextResponse.json({ error: "Unlock this run to see the full view." }, { status: 403 });
    }

    const ip = getClientIp(req);
    const limiter = getDetailsLimiter();
    if (limiter) {
      const { success } = await limiter.limit(`${ip}:${tool}`);
      if (!success) {
        return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
      }
    }

    const full = await detailRun(runId, { source: "web", ip });
    return NextResponse.json(full);
  } catch (err) {
    return errorResponse(err, `${tool} details`);
  }
}
