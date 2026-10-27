import { NextRequest, NextResponse } from "next/server";
import { callModel } from "@/app/lib/llm";
import { getBuilderReadLimiter, reserveBuilderDailyCall } from "@/app/lib/ratelimit";
import { incrementBriefCounter, saveBriefState } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { SOURCE_MAX_CHARS, parseBriefState } from "@/app/lib/project-builder/brief";
import { readPrompt } from "@/app/lib/project-builder/prompts";
import { parseRead, readSchema } from "@/app/lib/project-builder/schemas";
import { applyRead } from "@/app/lib/project-builder/apply";
import { DAILY_LIMIT_LINE, START } from "@/app/lib/project-builder/copy";
import { builderErrorResponse } from "../errors";
import { honeypotResponse, isHoneypotFilled, limit, readJson, resolveBrief, secondsToMidnightUtc } from "../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The document and partly built routes: the pasted text in, the extracted
 * baseline applied to the state out. There is no rule based reader, so a
 * failure is an error (502, 503 or 500) and the daily cap is a 429. Before
 * a save the text is processed and discarded; after one it is stored on
 * the brief with its 90 day TTL.
 */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();

  try {
    const state = parseBriefState(body.state);
    const path = body.path === "built" ? "built" : body.path === "doc" ? "doc" : null;
    if (!path) return NextResponse.json({ error: "Choose the document or the partly built starting point first." }, { status: 400 });
    const source = typeof body.source === "string" ? body.source : "";
    if (!source.trim()) return NextResponse.json({ error: START.readEmpty }, { status: 400 });
    if (source.length > SOURCE_MAX_CHARS) {
      return NextResponse.json({ error: "That is over 60,000 characters; trim it and try again." }, { status: 400 });
    }

    const resolved = await resolveBrief(body);
    if ("res" in resolved) return resolved.res;
    const brief = resolved.brief;

    const limited = await limit(req, getBuilderReadLimiter(), "read", 86_400);
    if (limited) return limited;

    const reservation = await reserveBuilderDailyCall();
    if (!reservation.ok) {
      return NextResponse.json({ error: DAILY_LIMIT_LINE }, { status: 429, headers: { "Retry-After": String(secondsToMidnightUtc()) } });
    }

    const prompt = readPrompt({ ...state, path }, source, { companyName: brief?.contact.company });
    const call = await callModel({
      routingKey: "builder-read",
      runId: brief?.id ?? null,
      system: prompt.system,
      user: prompt.user,
      schema: readSchema(),
      parse: parseRead,
      temperature: 0,
    });
    const applied = applyRead({ ...state, path }, call.data, path === "built");
    if (brief) {
      await incrementBriefCounter(brief.id, "readCount");
      await saveBriefState(brief.id, applied.state, source);
    }
    const found = call.data.requirements.length;
    void track("builder_doc_read", { path, found, fallback: false });
    return NextResponse.json({ ok: true, state: applied.state, message: applied.message, found, unplaced: call.data.unplaced });
  } catch (err) {
    return builderErrorResponse(err, "project-builder read");
  }
}
