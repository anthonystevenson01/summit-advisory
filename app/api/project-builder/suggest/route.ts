import { NextRequest, NextResponse } from "next/server";
import { callModel } from "@/app/lib/llm";
import { getBuilderSuggestLimiter, reserveBuilderDailyCall } from "@/app/lib/ratelimit";
import { getBriefSource, incrementBriefCounter, saveBriefState } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { SUGGEST_CAP_PER_BRIEF, isSuggestStep, parseBriefState } from "@/app/lib/project-builder/brief";
import { suggestPrompt } from "@/app/lib/project-builder/prompts";
import { parseSuggest, suggestSchema } from "@/app/lib/project-builder/schemas";
import { applySuggest } from "@/app/lib/project-builder/apply";
import { ruleSuggest } from "@/app/lib/project-builder/suggestions";
import { DAILY_LIMIT_LINE, FALLBACK_LINE, SUGGEST_CAP_LINE } from "@/app/lib/project-builder/copy";
import { builderErrorResponse } from "../errors";
import { honeypotResponse, isHoneypotFilled, limit, readJson, resolveBrief } from "../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The one tap helper on the goal, features, connections, guardrails and
 * running it steps. Order: parse, honeypot, state, step, brief, limiter,
 * per brief cap, daily cap, prompt, model, apply (or the rules on any
 * failure), counter and save when saved, event, respond with the whole new
 * state. A rules answer always carries `fallback: true`.
 */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();

  try {
    const state = parseBriefState(body.state);
    if (!isSuggestStep(body.step)) return NextResponse.json({ error: "Unknown step." }, { status: 400 });
    const step = body.step;

    const resolved = await resolveBrief(body);
    if ("res" in resolved) return resolved.res;
    const brief = resolved.brief;

    const limited = await limit(req, getBuilderSuggestLimiter(), "suggest", 3600);
    if (limited) return limited;

    const bodySource = typeof body.source === "string" ? body.source : "";
    const source = bodySource || (brief ? (await getBriefSource(brief.id)) ?? "" : "");
    const companyName = brief?.contact.company;
    const ctx = `project-builder suggest ${step}`;

    const fallback = async (reason: string, line: string, countIt: boolean) => {
      console.error(`${ctx}: rules fallback (${reason})`);
      const r = ruleSuggest(state, step, source);
      if (brief && countIt) await saveBriefState(brief.id, r.state);
      void track("builder_suggest_used", { step, fallback: true });
      return NextResponse.json({ ok: true, state: r.state, message: `${line} ${r.message}`.trim(), fallback: true, added: [] });
    };

    if (brief && brief.suggestCount >= SUGGEST_CAP_PER_BRIEF) return fallback("per brief cap", SUGGEST_CAP_LINE, true);
    const reservation = await reserveBuilderDailyCall();
    if (!reservation.ok) return fallback("daily cap", DAILY_LIMIT_LINE, true);

    const prompt = suggestPrompt(state, step, { companyName, source });
    try {
      const call = await callModel({
        routingKey: "builder-suggest",
        runId: brief?.id ?? null,
        system: prompt.system,
        user: prompt.user,
        schema: suggestSchema(step),
        parse: (raw) => parseSuggest(step, raw),
        temperature: 0,
      });
      const applied = applySuggest(state, call.data);
      if (brief) {
        await incrementBriefCounter(brief.id, "suggestCount");
        await saveBriefState(brief.id, applied.state);
      }
      void track("builder_suggest_used", { step, fallback: false });
      return NextResponse.json({ ok: true, state: applied.state, message: applied.message, fallback: false, added: applied.added });
    } catch (err) {
      return fallback(err instanceof Error ? err.message.slice(0, 200) : String(err), FALLBACK_LINE, true);
    }
  } catch (err) {
    return builderErrorResponse(err, "project-builder suggest");
  }
}
