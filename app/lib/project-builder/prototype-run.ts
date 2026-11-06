/**
 * One "Create prototype" or "Update prototype" press, after the route has
 * authenticated, limited and locked: the house style (read once per website
 * host), then a create, or an edit with a rebuild as the fallback, then the
 * safety pass, the validator and at most one corrective round, then the
 * store. The time budget for every model call lives here so the route stays
 * thin. Nothing is stored until a valid document exists, so a failure never
 * replaces the previous prototype.
 *
 * Budget rule: no call starts with less than 45 s before the deadline; each
 * call's timeout is the smaller of its cap (150 s for create, rebuild and
 * fix, 75 s for an edit) and the time left less 20 s; the fix round also
 * needs 75 s left. Every call first reserves one of the day's builder calls.
 */
import { LlmNotConfiguredError, callModel } from "../llm.ts";
import { reserveBuilderDailyCall } from "../ratelimit.ts";
import { track } from "../events.ts";
import { getBriefPrototype, getBriefStyle, saveBriefPrototype, saveBriefStyle, type BriefRecord } from "../briefs.ts";
import type { BriefState } from "./brief.ts";
import { fontStylesheetUrl, type HouseStyle } from "./house-style.ts";
import { readHouseStyle } from "./house-style-read.ts";
import {
  PROTOTYPE_ROUTING_KEY,
  describeChanges,
  isLargeChange,
  prototypeSnapshot,
  resolvePrototypeWebsite,
  snapshotHash,
  type PrototypeCall,
  type PrototypeCallKind,
  type PrototypeMode,
  type PrototypeRecord,
} from "./prototype.ts";
import { EditApplyError, applyEdits, sanitisePrototypeHtml, validatePrototypeHtml } from "./prototype-html.ts";
import { prototypeCreatePrompt, prototypeEditPrompt, prototypeFixPrompt, type Prompt, type PromptContext } from "./prompts.ts";
import { parsePrototype, parsePrototypeEdits, prototypeEditsSchema, prototypeSchema } from "./schemas.ts";
import type { NamedSchema } from "../tools/schema.ts";

/** daily: the builder's daily call cap; time: not enough of the route's budget left; invalid: still broken after the fix round; model: the call failed. */
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
}

/** Which way the document was produced: a first create, edits applied to the current one, or a full rebuild. */
export type PrototypePath = "create" | "edits" | "rebuild";

export interface RunPrototypeResult {
  record: PrototypeRecord;
  style: HouseStyle;
  mode: "created" | "updated";
  path: PrototypePath;
  corrected: boolean;
  calls: PrototypeCall[];
}

const STYLE_BUDGET_MS = 26_000;
const MIN_CALL_MS = 45_000;
const CALL_HEADROOM_MS = 20_000;
const LONG_CALL_CAP_MS = 150_000;
const EDIT_CALL_CAP_MS = 75_000;
const FIX_MIN_MS = 75_000;
const TEMPERATURE = 0.4;

export async function runPrototype(input: RunPrototypeInput): Promise<RunPrototypeResult> {
  const { brief, state, deadlineAt } = input;
  const id = brief.id;
  const calls: PrototypeCall[] = [];
  const ctx: PromptContext = { companyName: brief.contact.company, source: input.source };

  // 1. The house style: reused unless the website it came from has changed.
  let style = await getBriefStyle(id);
  const target = resolvePrototypeWebsite(state, brief.contact);
  const targetHost = target?.host ?? null;
  if (!style || style.host !== targetHost) {
    style = await readHouseStyle(target, { deadlineAt: Math.min(deadlineAt, Date.now() + STYLE_BUDGET_MS) });
    await saveBriefStyle(id, style);
    void track("builder_prototype_style", { status: style.status, reason: style.reason });
  }
  const houseStyle = style;
  const fontHref = fontStylesheetUrl(houseStyle);

  const call = async <T>(kind: PrototypeCallKind, prompt: Prompt, schema: NamedSchema, parse: (raw: unknown) => T, capMs: number) => {
    const remaining = deadlineAt - Date.now();
    if (remaining < MIN_CALL_MS) throw new PrototypeFailedError("time");
    const reservation = await reserveBuilderDailyCall();
    if (!reservation.ok) throw new PrototypeFailedError("daily");
    const started = Date.now();
    try {
      const result = await callModel({
        routingKey: PROTOTYPE_ROUTING_KEY,
        runId: id,
        system: prompt.system,
        user: prompt.user,
        schema,
        parse,
        temperature: TEMPERATURE,
        timeoutMs: Math.min(capMs, remaining - CALL_HEADROOM_MS),
      });
      calls.push({ kind, model: result.model, ms: result.ms, ok: true });
      return result;
    } catch (err) {
      calls.push({ kind, model: "", ms: Date.now() - started, ok: false });
      if (err instanceof LlmNotConfiguredError) throw err;
      throw new PrototypeFailedError("model", err instanceof Error ? err.message.slice(0, 200) : String(err));
    }
  };

  /** Sanitise and validate a whole document, with one corrective round. */
  const finish = async (rawHtml: string, model: string): Promise<{ html: string; model: string; corrected: boolean }> => {
    const html = sanitisePrototypeHtml(rawHtml, fontHref);
    const issues = validatePrototypeHtml(html);
    if (issues.length === 0) return { html, model, corrected: false };
    if (deadlineAt - Date.now() < FIX_MIN_MS) throw new PrototypeFailedError("invalid", issues[0]);
    const fix = await call("fix", prototypeFixPrompt(state, houseStyle, html, issues, ctx), prototypeSchema(), parsePrototype, LONG_CALL_CAP_MS);
    const fixed = sanitisePrototypeHtml(fix.data.html, fontHref);
    const left = validatePrototypeHtml(fixed);
    if (left.length > 0) throw new PrototypeFailedError("invalid", left[0]);
    return { html: fixed, model: fix.model, corrected: true };
  };

  const build = async (kind: "create" | "rebuild") => {
    const created = await call(kind, prototypeCreatePrompt(state, houseStyle, ctx), prototypeSchema(), parsePrototype, LONG_CALL_CAP_MS);
    return finish(created.data.html, created.model);
  };

  const snapshot = prototypeSnapshot(state, brief.contact);
  const hash = snapshotHash(snapshot);
  const existing = await getBriefPrototype(id);

  let produced: { html: string; model: string; corrected: boolean };
  let path: PrototypePath;
  let lastMode: PrototypeMode;
  if (!existing) {
    produced = await build("create");
    path = "create";
    lastMode = "created";
  } else if (isLargeChange(existing.snapshot, snapshot) || existing.styleHost !== houseStyle.host) {
    produced = await build("rebuild");
    path = "rebuild";
    lastMode = "rebuilt";
  } else {
    let edited: { html: string; model: string } | null = null;
    try {
      const changes = describeChanges(existing.snapshot, snapshot);
      const reply = await call("edit", prototypeEditPrompt(state, houseStyle, existing.html, changes, ctx), prototypeEditsSchema(), parsePrototypeEdits, EDIT_CALL_CAP_MS);
      if (!reply.data.rewrite && reply.data.edits.length > 0) {
        const html = sanitisePrototypeHtml(applyEdits(existing.html, reply.data.edits), fontHref);
        if (validatePrototypeHtml(html).length === 0) edited = { html, model: reply.model };
      }
    } catch (err) {
      if (err instanceof PrototypeFailedError && err.reason !== "model") throw err;
      if (!(err instanceof PrototypeFailedError) && !(err instanceof EditApplyError)) throw err;
    }
    if (edited) {
      produced = { ...edited, corrected: false };
      path = "edits";
      lastMode = "edited";
    } else {
      produced = await build("rebuild");
      path = "rebuild";
      lastMode = "rebuilt";
    }
  }

  const now = new Date().toISOString();
  const record: PrototypeRecord = {
    html: produced.html,
    hash,
    snapshot,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: existing ? existing.version + 1 : 1,
    lastMode,
    model: produced.model,
    routingKey: PROTOTYPE_ROUTING_KEY,
    calls,
    styleHost: houseStyle.host,
  };
  await saveBriefPrototype(id, record);
  return { record, style: houseStyle, mode: existing ? "updated" : "created", path, corrected: produced.corrected, calls };
}
