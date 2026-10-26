import { NextRequest, NextResponse } from "next/server";
import { callModel } from "@/app/lib/llm";
import { getBuilderSuggestLimiter, reserveBuilderDailyCall } from "@/app/lib/ratelimit";
import { getBriefSource, incrementBriefCounter, saveBriefState } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { SUGGEST_CAP_PER_BRIEF, parseBriefState } from "@/app/lib/project-builder/brief";
import { lookupPrompt } from "@/app/lib/project-builder/prompts";
import { lookupSchema, parseLookup } from "@/app/lib/project-builder/schemas";
import { applyLookup } from "@/app/lib/project-builder/apply";
import { DAILY_LIMIT_LINE, REPLACE, SUGGEST_CAP_LINE } from "@/app/lib/project-builder/copy";
import { builderErrorResponse } from "../errors";
import { honeypotResponse, isHoneypotFilled, limit, readJson, resolveBrief } from "../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * A system the catalogue lacks: its usual capabilities as cards. The
 * fallback on any failure or cap is the generic capability set, which
 * `systemCapabilities` already offers when `rep.extra` is empty, so the
 * fallback state is the state with `rep.sys` set and no extras.
 */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();

  try {
    const state = parseBriefState(body.state);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (name.length < 2) return NextResponse.json({ error: "Type the name of the system, at least two characters." }, { status: 400 });

    const resolved = await resolveBrief(body);
    if ("res" in resolved) return resolved.res;
    const brief = resolved.brief;

    const limited = await limit(req, getBuilderSuggestLimiter(), "suggest", 3600);
    if (limited) return limited;

    const bodySource = typeof body.source === "string" ? body.source : "";
    const source = bodySource || (brief ? (await getBriefSource(brief.id)) ?? "" : "");
    const ctx = "project-builder lookup";

    const fallback = async (reason: string, line: string) => {
      console.error(`${ctx}: generic fallback (${reason})`);
      const applied = applyLookup(state, name, { caps: [] });
      if (brief) await saveBriefState(brief.id, applied.state);
      void track("builder_suggest_used", { step: "lookup", fallback: true });
      return NextResponse.json({ ok: true, state: applied.state, message: line, fallback: true });
    };

    if (brief && brief.suggestCount >= SUGGEST_CAP_PER_BRIEF) return fallback("per brief cap", SUGGEST_CAP_LINE);
    const reservation = await reserveBuilderDailyCall();
    if (!reservation.ok) return fallback("daily cap", DAILY_LIMIT_LINE);

    const prompt = lookupPrompt(state, name, { companyName: brief?.contact.company, source });
    try {
      const call = await callModel({
        routingKey: "builder-suggest",
        runId: brief?.id ?? null,
        system: prompt.system,
        user: prompt.user,
        schema: lookupSchema(),
        parse: parseLookup,
        temperature: 0,
      });
      const applied = applyLookup(state, name, call.data);
      if (brief) {
        await incrementBriefCounter(brief.id, "suggestCount");
        await saveBriefState(brief.id, applied.state);
      }
      void track("builder_suggest_used", { step: "lookup", fallback: false });
      return NextResponse.json({ ok: true, state: applied.state, message: applied.message, fallback: false });
    } catch (err) {
      return fallback(err instanceof Error ? err.message.slice(0, 200) : String(err), REPLACE.lookupFailed);
    }
  } catch (err) {
    return builderErrorResponse(err, "project-builder lookup");
  }
}
