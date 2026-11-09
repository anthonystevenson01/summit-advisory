/**
 * One "Create prototype" or "Update prototype" press, or one change request,
 * after the route has authenticated, limited and locked: the hidden staged
 * pipeline. The house style (read once per website host), the company
 * profile (built once per host, reused by every later press), a plan with a
 * coverage map checked in code (one gap round), a senior review merged into
 * the plan (full plans only), one build call per screen in parallel with a
 * per screen check and one retry, the server written shell, assembly through
 * the Round 1 safety pass and validator unchanged, the store, then the
 * audit. The time budget for every call lives here so the routes stay thin.
 * Nothing is stored until a valid document exists, so a failure never
 * replaces the previous prototype, and the plan is saved only after the
 * prototype so the stored plan always describes the stored document.
 *
 * Budget inside the route's 285 s: style 30 s, research 30 s, plan 30 s
 * (needs 100 s left), gap round 30 s (needs 130 s), review 60 s (needs 160
 * s), build 90 s per screen in parallel (needs 60 s), one retry 90 s (needs
 * 60 s), audit 30 s (needs 35 s). Each call's timeout is the smaller of its
 * cap and the time left less the headroom. One daily builder call is
 * reserved per press, not per stage call.
 */
import { LlmNotConfiguredError, callModel, resolveRoute } from "../llm.ts";
import { reserveBuilderDailyCall } from "../ratelimit.ts";
import { track } from "../events.ts";
import {
  appendBriefRequest,
  claimResearchLock,
  getBriefPlan,
  getBriefPrototype,
  getBriefResearch,
  getBriefStyle,
  isResearchLocked,
  releaseResearchLock,
  saveBriefCritique,
  saveBriefPlan,
  saveBriefPrototype,
  saveBriefResearch,
  saveBriefStyle,
  type BriefRecord,
  type StoredPlan,
} from "../briefs.ts";
import type { BriefState } from "./brief.ts";
import { fontStylesheetUrl, type HouseStyle } from "./house-style.ts";
import { readHouseStyleWithParts } from "./house-style-read.ts";
import { buildCompanyProfile } from "./research-read.ts";
import { EMPTY_PROFILE, type CompanyProfile } from "./research.ts";
import {
  PROTOTYPE_ROUTING_KEYS,
  describeChanges,
  isLargeChange,
  prototypeSnapshot,
  resolvePrototypeWebsite,
  snapshotHash,
  type PrototypeMode,
  type PrototypeRecord,
  type PrototypeScreenBuild,
  type PrototypeStage,
  type PrototypeStageName,
  type ScreenBuild,
} from "./prototype.ts";
import {
  applyPlanDiff,
  checkPlanCoverage,
  coverageItems,
  diffOutcome,
  parsePlanAnswer,
  parsePlanDiffAnswer,
  screensToRebuild,
  type CoverageItem,
  type PrototypePlan,
} from "./plan.ts";
import { mergeReviewIntoPlan, parseReviewAnswer } from "./review.ts";
import { auditFromAnswer, parseAuditAnswer } from "./audit.ts";
import { SHELL_IDS, renderShell, shellScreenBudget } from "./shell.ts";
import { assembleDocument, checkScreen, collectIds, isDesignIssue, parseScreenBuild } from "./screens.ts";
import type { ChangeRequest } from "./requests.ts";
import { auditPrompt, planDiffPrompt, planPrompt, reviewPrompt, screenFixPrompt, screenPrompt, type Prompt, type PromptContext, type ScreenPromptArgs } from "./prompts.ts";
import { auditSchema, planDiffSchema, planSchema, reviewSchema, screenBuildSchema } from "./schemas.ts";
import type { NamedSchema } from "../tools/schema.ts";

/** daily: the builder's daily call cap; time: not enough of the route's budget left; invalid: a screen or the document still broken after the retry; model: a call failed. */
export type PrototypeFailReason = "daily" | "time" | "invalid" | "model";

/** A press that produced nothing to store. The route answers with the previous prototype, which is kept. */
export class PrototypeFailedError extends Error {
  readonly reason: PrototypeFailReason;
  constructor(reason: PrototypeFailReason, detail = "") {
    super(`prototype failed: ${reason}${detail ? ` (${detail})` : ""}`);
    this.name = "PrototypeFailedError";
    this.reason = reason;
  }
}

export interface RunPrototypeInput {
  brief: BriefRecord;
  state: BriefState;
  source: string;
  /** Epoch ms the whole run must finish by. */
  deadlineAt: number;
  /** A Create or Update press, or a change request from the box under the prototype. */
  mode: "press" | "request";
  /** The cleaned request text on the request path. */
  request?: string;
}

/** How the plan was produced this time: a full plan with a review, or a diff of the current plan. */
export type PrototypePath = "full" | "diff";

export interface RunPrototypeBuilt {
  declined: false;
  record: PrototypeRecord;
  style: HouseStyle;
  mode: "created" | "updated" | "requested";
  path: PrototypePath;
  /** The screens built this time (the rest were kept from the previous record). */
  screensBuilt: string[];
  retries: number;
  planned: boolean;
  reviewed: boolean;
  audited: boolean;
  gapRound: boolean;
  requests: ChangeRequest[];
}

export interface RunPrototypeDeclined {
  declined: true;
  /** remit: the planner refused the request; none: it accepted it but no screen changed. */
  kind: "remit" | "none";
  reason: string;
  style: HouseStyle;
  requests: ChangeRequest[];
}

export type RunPrototypeResult = RunPrototypeBuilt | RunPrototypeDeclined;

const STYLE_BUDGET_MS = 30_000;
const RESEARCH_BUDGET_MS = 30_000;
// When the save route's background research holds the lock, a press waits
// this long for it rather than crawling the same site twice; past it the
// press goes on with an empty profile and the stored one is used next time.
const RESEARCH_WAIT_MS = 10_000;
const RESEARCH_POLL_MS = 1_000;
// The per call caps from AC 20. The screen headroom is larger because the
// per screen check, the retry and the assembly all follow the build calls.
const SHORT_CALL_CAP_MS = 30_000;
const SHORT_CALL_HEADROOM_MS = 5_000;
// The review runs a larger model with reasoning on; Opus 5.5 at medium
// timed out at 30 s on the 9 November 2026 smoke test, so it gets 60 s.
const REVIEW_CALL_CAP_MS = 60_000;
const SCREEN_CALL_CAP_MS = 90_000;
const SCREEN_CALL_HEADROOM_MS = 20_000;
// The least time each stage needs left on the route budget to start: a
// stage that cannot also leave room for the build after it is skipped (gap,
// review, audit) or fails the press with reason `time` (plan, build).
const PLAN_MIN_MS = 100_000;
const GAP_MIN_MS = 130_000;
const REVIEW_MIN_MS = 160_000;
const BUILD_MIN_MS = 60_000;
const RETRY_MIN_MS = 60_000;
const AUDIT_MIN_MS = 35_000;
// Screens get a little warmth so sample data varies; the audit is a
// checklist and runs cold.
const PLAN_TEMPERATURE = 0.3;
const REVIEW_TEMPERATURE = 0.3;
const SCREEN_TEMPERATURE = 0.4;
const AUDIT_TEMPERATURE = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorLine(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
}

function turnedDownIdeas(state: BriefState): string[] {
  return state.ideas.filter((i) => state.ideaPick[i.id] === "no").map((i) => i.title.trim()).filter(Boolean);
}

export async function runPrototype(input: RunPrototypeInput): Promise<RunPrototypeResult> {
  const { brief, state, deadlineAt } = input;
  const id = brief.id;
  const stages: PrototypeStage[] = [];
  const ctx: PromptContext = { companyName: brief.contact.company, source: input.source };
  const remaining = () => deadlineAt - Date.now();

  // One daily builder call per press, whatever the stage count.
  const reservation = await reserveBuilderDailyCall();
  if (!reservation.ok) throw new PrototypeFailedError("daily");

  /** One model call on a stage key, with the stage recorded whatever happens. Throws PrototypeFailedError("model") on failure. */
  const call = async <T>(stage: PrototypeStageName, routingKey: string, prompt: Prompt, schema: NamedSchema, parse: (raw: unknown) => T, opts: { capMs: number; headroomMs: number; temperature: number; tag: string }) => {
    const started = Date.now();
    try {
      const result = await callModel({
        routingKey,
        runId: id,
        system: prompt.system,
        user: prompt.user,
        schema,
        parse,
        temperature: opts.temperature,
        timeoutMs: Math.min(opts.capMs, remaining() - opts.headroomMs),
        tag: opts.tag,
      });
      stages.push({ stage, model: result.model, ms: result.ms, ok: true });
      void track("builder_prototype_stage", { stage, ok: true, ms: result.ms, model: result.model, tag: opts.tag });
      return result;
    } catch (err) {
      stages.push({ stage, model: "", ms: Date.now() - started, ok: false });
      void track("builder_prototype_stage", { stage, ok: false, ms: Date.now() - started, tag: opts.tag });
      if (err instanceof LlmNotConfiguredError) throw err;
      throw new PrototypeFailedError("model", errorLine(err));
    }
  };

  // 1. The house style: reused unless the website it came from has changed. The pages and brand record it saw feed the research.
  let style = await getBriefStyle(id);
  const target = resolvePrototypeWebsite(state, brief.contact);
  const targetHost = target?.host ?? null;
  let pageTexts: Parameters<typeof buildCompanyProfile>[1]["pageTexts"];
  let brandSeen: Parameters<typeof buildCompanyProfile>[1]["brand"];
  if (!style || style.host !== targetHost) {
    const read = await readHouseStyleWithParts(target, { deadlineAt: Math.min(deadlineAt, Date.now() + STYLE_BUDGET_MS) });
    style = read.style;
    pageTexts = read.pageTexts.length > 0 ? read.pageTexts : undefined;
    brandSeen = read.brand ?? undefined;
    await saveBriefStyle(id, style);
    void track("builder_prototype_style", { status: style.status, reason: style.reason, source: style.source, brand: style.brandLookup });
  }
  const houseStyle = style;
  const fontHref = fontStylesheetUrl(houseStyle);
  const companyName = brief.contact.company.trim() || houseStyle.siteName.trim();

  // 2. The company profile: built once per host; a background build from the save route holds the research lock.
  let profile: CompanyProfile | null = await getBriefResearch(id);
  if (!profile || profile.host !== targetHost) {
    profile = null;
    if (await claimResearchLock(id)) {
      const started = Date.now();
      try {
        profile = await buildCompanyProfile(target, { deadlineAt: Math.min(deadlineAt, Date.now() + RESEARCH_BUDGET_MS), pageTexts, brand: brandSeen, briefId: id });
        await saveBriefResearch(id, profile);
        stages.push({ stage: "research", model: profile.model, ms: Date.now() - started, ok: true });
      } finally {
        await releaseResearchLock(id);
      }
    } else {
      const waitUntil = Date.now() + RESEARCH_WAIT_MS;
      while (Date.now() < waitUntil && (await isResearchLocked(id))) await sleep(RESEARCH_POLL_MS);
      const stored = await getBriefResearch(id);
      profile = stored && stored.host === targetHost ? stored : null;
    }
  }
  const profileForPrompts = profile ?? { ...EMPTY_PROFILE, host: targetHost };

  // 3. The items the plan must cover and the ideas the prospect turned down.
  const items: CoverageItem[] = coverageItems(state);
  const turnedDown = turnedDownIdeas(state);

  // 4. What exists.
  const existing = await getBriefPrototype(id);
  const storedPlan = await getBriefPlan(id);
  const currentPlan: StoredPlan | null = existing && existing.planVersion > 0 && storedPlan ? storedPlan : null;
  const snapshot = prototypeSnapshot(state, brief.contact);
  const hash = snapshotHash(snapshot);
  const nextVersion = existing ? existing.version + 1 : 1;

  let plan: PrototypePlan;
  let path: PrototypePath;
  let changed: string[] = [];
  let lastMode: PrototypeMode;
  let reviewed = false;
  let gapRound = false;
  let acceptedRequest: { requestId: string; text: string; at: string } | null = null;
  // The request id is the second it arrived: the lock allows one request per brief at a time, so it is unique per brief.
  const requestAt = new Date().toISOString();
  const requestId = `req_${requestAt.replace(/\D/g, "").slice(0, 14)}`;

  const planMeta = (model: string) => ({ version: currentPlan ? currentPlan.version + 1 : 1, builtFrom: hash, model });

  const fullPlan = async (): Promise<PrototypePlan> => {
    if (remaining() < PLAN_MIN_MS) throw new PrototypeFailedError("time");
    const result = await call("plan", PROTOTYPE_ROUTING_KEYS.plan, planPrompt({ state, items, profile: profileForPrompts, style: houseStyle, ctx }), planSchema(), (raw) => parsePlanAnswer(raw, items, planMeta("")), {
      capMs: SHORT_CALL_CAP_MS,
      headroomMs: SHORT_CALL_HEADROOM_MS,
      temperature: PLAN_TEMPERATURE,
      tag: "plan",
    });
    return { ...result.data, model: result.model };
  };

  /** The code check and one gap round; the second answer is accepted whatever it says. Unplaced items are logged, never shown. */
  const checkAndFill = async (draft: PrototypePlan): Promise<PrototypePlan> => {
    let check = checkPlanCoverage(draft, items);
    if (!check.ok && remaining() >= GAP_MIN_MS) {
      gapRound = true;
      try {
        const result = await call("gap", PROTOTYPE_ROUTING_KEYS.plan, planPrompt({ state, items, profile: profileForPrompts, style: houseStyle, ctx, previous: check.plan, gaps: check.gaps }), planSchema(), (raw) => parsePlanAnswer(raw, items, planMeta("")), {
          capMs: SHORT_CALL_CAP_MS,
          headroomMs: SHORT_CALL_HEADROOM_MS,
          temperature: PLAN_TEMPERATURE,
          tag: "gap",
        });
        const second: PrototypePlan = { ...result.data, model: result.model, accepted: check.plan.accepted, reviewApplied: check.plan.reviewApplied, reviewSuggested: check.plan.reviewSuggested };
        check = checkPlanCoverage(second, items);
      } catch (err) {
        if (err instanceof LlmNotConfiguredError) throw err;
        console.error(`project-builder prototype ${id}: gap round failed, plan used with gaps: ${errorLine(err)}`);
      }
    }
    if (check.gaps.length > 0) console.info(`project-builder prototype ${id}: unplaced after the plan: ${check.gaps.join("; ")}`);
    return check.plan;
  };

  if (input.mode === "request") {
    const text = (input.request ?? "").trim();
    if (!existing || !currentPlan || !text) throw new PrototypeFailedError("invalid", "a change request needs a stored prototype and plan");
    if (remaining() < PLAN_MIN_MS) throw new PrototypeFailedError("time");
    const result = await call("plan", PROTOTYPE_ROUTING_KEYS.plan, planDiffPrompt({ plan: currentPlan, state, items, profile: profileForPrompts, ctx, requestText: text }), planDiffSchema(), (raw) => parsePlanDiffAnswer(raw, items), {
      capMs: SHORT_CALL_CAP_MS,
      headroomMs: SHORT_CALL_HEADROOM_MS,
      temperature: PLAN_TEMPERATURE,
      tag: "request",
    });
    acceptedRequest = { requestId, text, at: requestAt };
    const diff = applyPlanDiff(currentPlan, result.data, { builtFrom: hash, model: result.model }, acceptedRequest);
    const outcome = diffOutcome(diff);
    if (outcome !== "changed") {
      // Refused, or accepted with no screen changed: nothing to build, no new version; the request is still recorded and counted.
      const requests = await appendBriefRequest(id, { id: requestId, text, at: requestAt, screens: [], model: result.model, outcome: "declined" });
      return { declined: true, kind: outcome === "declined" ? "remit" : "none", reason: diff.outOfRemit.reason, style: houseStyle, requests };
    }
    plan = await checkAndFill(diff.plan);
    changed = diff.changed;
    path = "diff";
    lastMode = "requested";
  } else if (!currentPlan || !existing || isLargeChange(existing.snapshot, snapshot) || existing.styleHost !== houseStyle.host) {
    plan = await checkAndFill(await fullPlan());
    path = "full";
    lastMode = existing ? "rebuilt" : "created";
    // The senior review, once per full plan; it improves the plan and never blocks.
    if (remaining() >= REVIEW_MIN_MS) {
      try {
        const result = await call("review", PROTOTYPE_ROUTING_KEYS.review, reviewPrompt({ plan, state, items, profile: profileForPrompts, turnedDown, ctx }), reviewSchema(), (raw) => parseReviewAnswer(raw, plan, items, { model: "" }), {
          capMs: REVIEW_CALL_CAP_MS,
          headroomMs: SHORT_CALL_HEADROOM_MS,
          temperature: REVIEW_TEMPERATURE,
          tag: "review",
        });
        const merged = mergeReviewIntoPlan(plan, { ...result.data, model: result.model }, turnedDown);
        plan = merged.plan;
        await saveBriefCritique(id, merged.review);
        reviewed = true;
      } catch (err) {
        if (err instanceof LlmNotConfiguredError) throw err;
        console.error(`project-builder prototype ${id}: review failed, plan used as it stands: ${errorLine(err)}`);
      }
    }
  } else {
    const lines = describeChanges(existing.snapshot, snapshot);
    if (remaining() < PLAN_MIN_MS) throw new PrototypeFailedError("time");
    const result = await call("plan", PROTOTYPE_ROUTING_KEYS.plan, planDiffPrompt({ plan: currentPlan, state, items, profile: profileForPrompts, ctx, changeLines: lines }), planDiffSchema(), (raw) => parsePlanDiffAnswer(raw, items), {
      capMs: SHORT_CALL_CAP_MS,
      headroomMs: SHORT_CALL_HEADROOM_MS,
      temperature: PLAN_TEMPERATURE,
      tag: "diff",
    });
    // A brief change is always in remit; a refusal here is treated as "nothing changed" and every screen is rebuilt.
    const answer = result.data.outOfRemit.refused ? { ...result.data, outOfRemit: { refused: false, reason: "" }, screens: currentPlan.screens, coverage: currentPlan.coverage, unplaced: currentPlan.unplaced, changedScreens: currentPlan.screens.map((s) => s.slug) } : result.data;
    const diff = applyPlanDiff(currentPlan, answer, { builtFrom: hash, model: result.model });
    plan = await checkAndFill(diff.plan);
    changed = diff.changed;
    path = "diff";
    lastMode = "rebuilt";
  }

  // 5. The screens to build: all after a full plan; after a diff, by the rebuild rule.
  const rebuild = path === "full" ? { slugs: plan.screens.map((s) => s.slug), whole: true } : screensToRebuild(plan, changed, currentPlan);
  const previousBuilds: Record<string, ScreenBuild> = existing?.screenBuilds ?? {};
  const builds: Record<string, ScreenBuild> = {};
  const screenRecords: PrototypeScreenBuild[] = [];
  const keptSlugs = plan.screens.map((s) => s.slug).filter((slug) => !rebuild.slugs.includes(slug));
  for (const slug of keptSlugs) {
    const previous = previousBuilds[slug];
    if (!previous) {
      rebuild.slugs.push(slug);
      continue;
    }
    builds[slug] = previous;
    const was = existing?.screens.find((s) => s.slug === slug);
    screenRecords.push({ slug, model: was?.model ?? existing?.model ?? "", ms: 0, retried: false, kept: true });
  }

  // 6. Build in parallel, each with a per screen check and one retry. Ids are prefixed per slug, so the only shared ids are the shell's and the kept screens'.
  if (remaining() < BUILD_MIN_MS) throw new PrototypeFailedError("time");
  const shellChars = renderShell(plan, houseStyle, companyName, state.name).length;
  const budget = shellScreenBudget(shellChars, plan.screens.length);
  const takenIds = new Set<string>(SHELL_IDS);
  const plannedSlugs = plan.screens.map((s) => s.slug);
  for (const slug of keptSlugs) for (const sid of collectIds(builds[slug]?.html ?? "")) takenIds.add(sid);
  let retries = 0;

  const buildScreen = async (slug: string): Promise<void> => {
    const screen = plan.screens.find((s) => s.slug === slug);
    if (!screen) return;
    const args: ScreenPromptArgs = { screen, plan, items, profile: profileForPrompts, style: houseStyle, budget, companyName };
    const started = Date.now();
    let build: ScreenBuild | null = null;
    let model = "";
    let issues: string[] = [];
    try {
      const result = await call("build", PROTOTYPE_ROUTING_KEYS.build, screenPrompt(args), screenBuildSchema(), parseScreenBuild, { capMs: SCREEN_CALL_CAP_MS, headroomMs: SCREEN_CALL_HEADROOM_MS, temperature: SCREEN_TEMPERATURE, tag: `screen:${slug}` });
      build = result.data;
      model = result.model;
      issues = checkScreen(build, slug, budget, takenIds, plannedSlugs);
    } catch (err) {
      if (err instanceof LlmNotConfiguredError) throw err;
      issues = [errorLine(err)];
    }
    let retried = false;
    if (issues.length > 0 && remaining() >= RETRY_MIN_MS) {
      retried = true;
      retries += 1;
      try {
        const prompt = build ? screenFixPrompt(args, issues, build) : screenPrompt(args);
        const result = await call("build", PROTOTYPE_ROUTING_KEYS.build, prompt, screenBuildSchema(), parseScreenBuild, { capMs: SCREEN_CALL_CAP_MS, headroomMs: SCREEN_CALL_HEADROOM_MS, temperature: SCREEN_TEMPERATURE, tag: "retry" });
        build = result.data;
        model = result.model;
        issues = checkScreen(build, slug, budget, takenIds, plannedSlugs);
      } catch (err) {
        if (err instanceof LlmNotConfiguredError) throw err;
        issues = [errorLine(err)];
      }
    }
    // The design checks are advisory once the retry is behind us: when every remaining line is a design line, the screen is
    // accepted, the lines are stored as `notes` on its record and logged. The same applies when there was no time for a retry,
    // since kept previous and `invalid` are the two outcomes a design line must never cause. Any blocking line (a check line or
    // an errorLine) leaves the path below exactly as Round 3 built it.
    let notes: string[] = [];
    if (build && issues.length > 0 && issues.every(isDesignIssue)) {
      console.info(`project-builder prototype ${id}: screen ${slug} accepted with design notes: ${issues.join(" | ")}`);
      notes = issues;
      issues = [];
    }
    if (issues.length === 0 && build) {
      builds[slug] = build;
      screenRecords.push({ slug, model, ms: Date.now() - started, retried, kept: false, ...(notes.length > 0 ? { notes } : {}) });
      return;
    }
    const previous = previousBuilds[slug];
    if (previous) {
      console.error(`project-builder prototype ${id}: screen ${slug} kept from the previous build: ${issues[0]}`);
      builds[slug] = previous;
      const was = existing?.screens.find((s) => s.slug === slug);
      screenRecords.push({ slug, model: was?.model ?? existing?.model ?? "", ms: Date.now() - started, retried, kept: true });
      return;
    }
    throw new PrototypeFailedError("invalid", `${slug}: ${issues[0]}`);
  };

  await Promise.all(rebuild.slugs.map((slug) => buildScreen(slug)));

  // 7. Assemble: the shell, the placement, then the Round 1 safety pass and validator. Issues here are a failure, never a stored document.
  const assembled = assembleDocument(plan, houseStyle, fontHref, builds, companyName, state.name);
  if (assembled.issues.length > 0) throw new PrototypeFailedError("invalid", assembled.issues[0]);

  // 8. Store the prototype, then the plan it describes.
  const now = new Date().toISOString();
  const buildModels = screenRecords.filter((s) => !s.kept && s.model).map((s) => s.model);
  const record: PrototypeRecord = {
    html: assembled.html,
    hash,
    snapshot,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: nextVersion,
    lastMode,
    model: buildModels[0] ?? existing?.model ?? "",
    routingKey: PROTOTYPE_ROUTING_KEYS.build,
    styleHost: houseStyle.host,
    planVersion: plan.version,
    screens: plan.screens.map((s) => screenRecords.find((r) => r.slug === s.slug)).filter((r): r is PrototypeScreenBuild => !!r),
    screenBuilds: builds,
    stages,
    audit: null,
  };
  await saveBriefPrototype(id, record);
  await saveBriefPlan(id, { ...plan, producedVersion: record.version });
  let requests: ChangeRequest[] = [];
  if (acceptedRequest) {
    requests = await appendBriefRequest(id, { id: requestId, text: acceptedRequest.text, at: requestAt, screens: rebuild.slugs.slice(), model: plan.model, outcome: "built" });
  }

  // 9. The audit, admin only: writes onto the stored record and never changes the document or the answer.
  let audited = false;
  try {
    const route = await resolveRoute(PROTOTYPE_ROUTING_KEYS.audit);
    if (route.enabled !== false && remaining() >= AUDIT_MIN_MS) {
      const result = await call("audit", PROTOTYPE_ROUTING_KEYS.audit, auditPrompt(items, assembled.html), auditSchema(), parseAuditAnswer, { capMs: SHORT_CALL_CAP_MS, headroomMs: SHORT_CALL_HEADROOM_MS, temperature: AUDIT_TEMPERATURE, tag: "audit" });
      record.audit = auditFromAnswer(result.data, items, { model: result.model });
      record.stages = stages;
      await saveBriefPrototype(id, record);
      audited = true;
    }
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) throw err;
    console.error(`project-builder prototype ${id}: audit failed: ${errorLine(err)}`);
  }

  return {
    declined: false,
    record,
    style: houseStyle,
    mode: input.mode === "request" ? "requested" : existing ? "updated" : "created",
    path,
    screensBuilt: rebuild.slugs.slice(),
    retries,
    planned: true,
    reviewed,
    audited,
    gapRound,
    requests,
  };
}
