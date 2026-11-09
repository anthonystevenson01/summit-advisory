import { NextRequest, NextResponse } from "next/server";
import { LlmNotConfiguredError } from "@/app/lib/llm";
import { getBuilderRequestLimiter } from "@/app/lib/ratelimit";
import {
  claimPrototypeLock,
  getBriefPlan,
  getBriefPrototype,
  getBriefSource,
  getBriefStyle,
  incrementBriefCounter,
  releasePrototypeLock,
} from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { PROTOTYPE } from "@/app/lib/project-builder/copy";
import { prototypeView } from "@/app/lib/project-builder/prototype-html";
import { PrototypeFailedError, runPrototype } from "@/app/lib/project-builder/prototype-run";
import { REQUESTS_PER_BRIEF, cleanRequestText } from "@/app/lib/project-builder/requests";
import { builderErrorResponse } from "../../errors";
import { honeypotResponse, isHoneypotFilled, limit, readJson, resolveBrief, secondsToMidnightUtc } from "../../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The run must finish inside maxDuration with room to answer. */
const RUN_BUDGET_MS = 285_000;

/**
 * "What would you like changed?" under the prototype. The body is
 * `{ briefId, token, request, website: "" }` and nothing else is read: the
 * stored state is used, since a request is not a brief change, and no
 * prompt, HTML, style, model or mode is accepted. The request text is data:
 * cleaned, capped and placed in the planner's user turn under the data
 * guard, never in a system prompt. Order: honeypot, brief auth, the text
 * length, the per IP request limiter (its own scope of 20 an hour), a
 * stored prototype and plan (409 otherwise), the per brief request cap of
 * 20, the lock, the counter, the run. A declined request still counts
 * against the cap, since a model call was spent.
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

    const request = cleanRequestText(body.request);
    if (!request) return NextResponse.json({ error: PROTOTYPE.requestTooShort }, { status: 400 });

    const limited = await limit(req, getBuilderRequestLimiter(), "prototype-request", 3600);
    if (limited) return limited;

    const [existing, storedStyle, plan] = await Promise.all([getBriefPrototype(brief.id), getBriefStyle(brief.id), getBriefPlan(brief.id)]);
    const previousView = existing ? prototypeView(existing, storedStyle) : null;
    if (!existing || !plan || existing.planVersion === 0) {
      return NextResponse.json({ error: PROTOTYPE.requestNeedsPrototype, prototype: previousView }, { status: 409 });
    }

    if (brief.requestCount >= REQUESTS_PER_BRIEF) {
      return NextResponse.json({ error: PROTOTYPE.capRequests, cap: true, prototype: previousView }, { status: 429 });
    }

    if (!(await claimPrototypeLock(brief.id))) {
      return NextResponse.json({ error: PROTOTYPE.busy, busy: true, prototype: previousView }, { status: 429, headers: { "Retry-After": "60" } });
    }
    lockedId = brief.id;

    const requests = await incrementBriefCounter(brief.id, "requestCount");

    try {
      const result = await runPrototype({
        brief,
        state: brief.state,
        source: (await getBriefSource(brief.id)) ?? "",
        deadlineAt: startedAt + RUN_BUDGET_MS,
        mode: "request",
        request,
      });
      if (result.declined) {
        void track("builder_prototype_request", { ok: true, declined: true, kind: result.kind, screens: 0, ms: Date.now() - startedAt });
        const message = result.kind === "none" ? PROTOTYPE.requestNoChange : PROTOTYPE.requestOutOfRemit;
        return NextResponse.json({ ok: true, mode: "declined", upToDate: true, prototype: previousView, requests, message });
      }
      void track("builder_prototype_request", { ok: true, declined: false, screens: result.screensBuilt.length, retries: result.retries, audited: result.audited, ms: Date.now() - startedAt });
      const view = prototypeView(result.record, result.style);
      return NextResponse.json({ ok: true, mode: "requested", upToDate: true, prototype: view, requests, message: PROTOTYPE.requestDone });
    } catch (err) {
      if (err instanceof PrototypeFailedError) {
        void track("builder_prototype_request", { ok: false, declined: false, reason: err.reason, ms: Date.now() - startedAt });
        console.error(`project-builder prototype request: ${err.message}`);
        if (err.reason === "daily") {
          return NextResponse.json({ error: PROTOTYPE.daily, prototype: previousView }, { status: 429, headers: { "Retry-After": String(secondsToMidnightUtc()) } });
        }
        return NextResponse.json({ error: PROTOTYPE.requestFailed, prototype: previousView, requests }, { status: 502 });
      }
      void track("builder_prototype_request", { ok: false, declined: false, reason: err instanceof LlmNotConfiguredError ? "not-configured" : "error", ms: Date.now() - startedAt });
      throw err;
    }
  } catch (err) {
    return builderErrorResponse(err, "project-builder prototype request");
  } finally {
    if (lockedId) await releasePrototypeLock(lockedId);
  }
}
