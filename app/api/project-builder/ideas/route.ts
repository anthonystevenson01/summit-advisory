import { NextRequest, NextResponse } from "next/server";
import { callModel } from "@/app/lib/llm";
import { getBuilderIdeasLimiter, reserveBuilderDailyCall } from "@/app/lib/ratelimit";
import { getBriefSource, incrementBriefCounter, saveBriefState } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { IDEAS_CAP_PER_BRIEF, parseBriefState } from "@/app/lib/project-builder/brief";
import { ideasPrompt } from "@/app/lib/project-builder/prompts";
import { ideasSchema, parseIdeas } from "@/app/lib/project-builder/schemas";
import { applyIdeas } from "@/app/lib/project-builder/apply";
import { ruleIdeas } from "@/app/lib/project-builder/suggestions";
import { DAILY_LIMIT_LINE, SMART } from "@/app/lib/project-builder/copy";
import { builderErrorResponse } from "../errors";
import { honeypotResponse, isHoneypotFilled, limit, readJson, resolveBrief } from "../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Make it smarter: three to six ideas from the model at temperature 0.7,
 * or the rule ideas on any failure or cap. Over the per brief cap the
 * answer carries no new ideas and the limit line.
 */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();

  try {
    const state = parseBriefState(body.state);
    const resolved = await resolveBrief(body);
    if ("res" in resolved) return resolved.res;
    const brief = resolved.brief;

    const limited = await limit(req, getBuilderIdeasLimiter(), "ideas", 3600);
    if (limited) return limited;

    const runs = brief?.ideasCount ?? 0;
    if (brief && runs >= IDEAS_CAP_PER_BRIEF) {
      void track("builder_ideas_run", { fallback: true });
      return NextResponse.json({ ok: true, state, message: SMART.limit, fallback: true, runs });
    }

    const bodySource = typeof body.source === "string" ? body.source : "";
    const source = bodySource || (brief ? (await getBriefSource(brief.id)) ?? "" : "");
    const ctx = "project-builder ideas";

    const fallback = async (reason: string, line: string) => {
      console.error(`${ctx}: rules fallback (${reason})`);
      const applied = applyIdeas(state, { note: line, ideas: ruleIdeas(state) });
      if (brief) await saveBriefState(brief.id, applied.state);
      void track("builder_ideas_run", { fallback: true });
      return NextResponse.json({ ok: true, state: applied.state, message: line, fallback: true, runs });
    };

    const reservation = await reserveBuilderDailyCall();
    if (!reservation.ok) return fallback("daily cap", DAILY_LIMIT_LINE);

    const prompt = ideasPrompt(state, { companyName: brief?.contact.company, source });
    try {
      const call = await callModel({
        routingKey: "builder-ideas",
        runId: brief?.id ?? null,
        system: prompt.system,
        user: prompt.user,
        schema: ideasSchema(),
        parse: parseIdeas,
        temperature: 0.7,
      });
      if (call.data.ideas.length === 0) throw new Error("model returned no ideas");
      const applied = applyIdeas(state, call.data);
      let count = runs;
      if (brief) {
        count = await incrementBriefCounter(brief.id, "ideasCount");
        await saveBriefState(brief.id, applied.state);
      }
      void track("builder_ideas_run", { fallback: false });
      return NextResponse.json({ ok: true, state: applied.state, message: applied.message, fallback: false, runs: count });
    } catch (err) {
      return fallback(err instanceof Error ? err.message.slice(0, 200) : String(err), SMART.commonStart);
    }
  } catch (err) {
    return builderErrorResponse(err, "project-builder ideas");
  }
}
