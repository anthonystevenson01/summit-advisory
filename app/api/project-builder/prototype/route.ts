import { NextRequest, NextResponse } from "next/server";
import { LlmNotConfiguredError } from "@/app/lib/llm";
import { getBuilderPrototypeLimiter } from "@/app/lib/ratelimit";
import {
  claimPrototypeLock,
  getBriefPrototype,
  getBriefSource,
  getBriefStyle,
  incrementBriefCounter,
  releasePrototypeLock,
  saveBriefState,
} from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { PROTOTYPE_RUNS_PER_BRIEF, parseBriefState } from "@/app/lib/project-builder/brief";
import { PROTOTYPE } from "@/app/lib/project-builder/copy";
import { prototypeHash, prototypeReadiness, readinessLine } from "@/app/lib/project-builder/prototype";
import { prototypeView } from "@/app/lib/project-builder/prototype-html";
import { PrototypeFailedError, runPrototype } from "@/app/lib/project-builder/prototype-run";
import { builderErrorResponse } from "../errors";
import { honeypotResponse, isHoneypotFilled, limit, readJson, resolveBrief, secondsToMidnightUtc } from "../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The run must finish inside maxDuration with room to answer. */
const RUN_BUDGET_MS = 285_000;

/**
 * "Create prototype" and "Update prototype". The body is `{ briefId, token,
 * state, website: "" }` and nothing else is read: no prompt, system text,
 * HTML, style, model or mode. Create or update is decided here from whether
 * a stored prototype exists. A press whose brief has not changed since the
 * last prototype answers "unchanged" without a model call or a run spent.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();

  if (typeof body.briefId !== "string" || !body.briefId.trim()) {
    return NextResponse.json({ error: PROTOTYPE.saveFirst, needSave: true }, { status: 400 });
  }

  let lockedId: string | null = null;
  try {
    const resolved = await resolveBrief(body);
    if ("res" in resolved) return resolved.res;
    const brief = resolved.brief;
    if (!brief) return NextResponse.json({ error: PROTOTYPE.saveFirst, needSave: true }, { status: 400 });
    const state = parseBriefState(body.state);

    const limited = await limit(req, getBuilderPrototypeLimiter(), "prototype", 3600);
    if (limited) return limited;

    const readiness = prototypeReadiness(state);
    if (!readiness.ready) {
      return NextResponse.json({ error: readinessLine(readiness.missing), notReady: true, missing: readiness.missing }, { status: 400 });
    }

    // Storage becomes what the prospect sees; the generation reads from it.
    await saveBriefState(brief.id, state);

    const hash = prototypeHash(state, brief.contact);
    const [existing, storedStyle] = await Promise.all([getBriefPrototype(brief.id), getBriefStyle(brief.id)]);
    const previousView = existing ? prototypeView(existing, storedStyle) : null;
    if (existing && existing.hash === hash) {
      return NextResponse.json({ ok: true, mode: "unchanged", upToDate: true, prototype: previousView, runs: brief.prototypeCount });
    }

    if (brief.prototypeCount >= PROTOTYPE_RUNS_PER_BRIEF) {
      return NextResponse.json({ error: PROTOTYPE.cap, cap: true, prototype: previousView }, { status: 429 });
    }

    if (!(await claimPrototypeLock(brief.id))) {
      return NextResponse.json({ error: PROTOTYPE.busy, busy: true, prototype: previousView }, { status: 429, headers: { "Retry-After": "60" } });
    }
    lockedId = brief.id;

    const runs = await incrementBriefCounter(brief.id, "prototypeCount");
    const failure = (reason: string, mode: "created" | "updated") =>
      void track("builder_prototype_run", { mode, ok: false, reason, ms: Date.now() - startedAt });
    const mode = existing ? "updated" : "created";

    try {
      const result = await runPrototype({
        brief,
        state,
        source: (await getBriefSource(brief.id)) ?? "",
        deadlineAt: startedAt + RUN_BUDGET_MS,
      });
      void track("builder_prototype_run", {
        mode: result.mode,
        path: result.path,
        ok: true,
        corrected: result.corrected,
        style: result.style.status,
        ms: Date.now() - startedAt,
      });
      const view = prototypeView(result.record, result.style);
      const done = result.mode === "created" ? PROTOTYPE.created : PROTOTYPE.updated;
      const message = view.styleNote ? `${done} ${view.styleNote}` : done;
      return NextResponse.json({ ok: true, mode: result.mode, upToDate: true, prototype: view, runs, message });
    } catch (err) {
      if (err instanceof PrototypeFailedError) {
        failure(err.reason, mode);
        console.error(`project-builder prototype: ${err.message}`);
        if (err.reason === "daily") {
          return NextResponse.json(
            { error: PROTOTYPE.daily, prototype: previousView },
            { status: 429, headers: { "Retry-After": String(secondsToMidnightUtc()) } },
          );
        }
        return NextResponse.json({ error: existing ? PROTOTYPE.failed : PROTOTYPE.failedFirst, prototype: previousView, runs }, { status: 502 });
      }
      failure(err instanceof LlmNotConfiguredError ? "not-configured" : "error", mode);
      throw err;
    }
  } catch (err) {
    return builderErrorResponse(err, "project-builder prototype");
  } finally {
    if (lockedId) await releasePrototypeLock(lockedId);
  }
}
