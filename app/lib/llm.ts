/**
 * The only file that constructs a model client or names a model id.
 *
 * Every call goes to OpenRouter through the `openai` package, and
 * OPENROUTER_API_KEY is read here and nowhere else. Keep it that way: a model
 * id or a client in any other file would be invisible to the admin routing
 * table, the calibration gate and the ai:calls log.
 *
 * Routing keys are `scoring`, `details`, `synthesis` and `extraction`, each
 * optionally narrowed to `{task}:{tool}`. Resolution order is the specific
 * key (`scoring:moat`), then the task key (`scoring`), then DEFAULT_ROUTES
 * below. Overrides live in the Redis hash `admin:model-config`, written from
 * /admin/models and cached in memory for 30 seconds, so a model change needs
 * no deploy. Every call is logged to the Redis list `ai:calls` (capped at
 * 2000 entries). Pure resolution lives in tools/routing.ts so tests never
 * import this file.
 */
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getRedis } from "./redis.ts";
import {
  ROUTING_TASKS,
  isCalibrationGated,
  parseRoutingKey,
  resolveRoute as resolveRoutePure,
  type ResolvedRoute,
  type RouteConfig,
  type RoutingTask,
} from "./tools/routing.ts";
import type { NamedSchema } from "./tools/schema.ts";

export { ROUTING_TASKS, isCalibrationGated, parseRoutingKey };
export type { ResolvedRoute, RouteConfig, RoutingTask };

// ── Model ids: the only place they appear ────────────────────────────────────
// OpenRouter ids without a dated snapshot. Confirmed against
// GET https://openrouter.ai/api/v1/models on 23 October 2026.

export const DEFAULT_ROUTES: Record<RoutingTask, RouteConfig> = {
  scoring: { model: "anthropic/claude-haiku-5.5", maxTokens: 1200 },
  details: { model: "anthropic/claude-sonnet-5.5", reasoning: "low", maxTokens: 4000 },
  synthesis: { model: "anthropic/claude-opus-5.5", reasoning: "medium", maxTokens: 4000, fallback: "anthropic/claude-sonnet-5.5" },
  extraction: { model: "anthropic/claude-sonnet-5.5", reasoning: "low", maxTokens: 4000 },
};

/** The admin dropdown is limited to this list; the admin route rejects anything else. */
export const CURATED_MODELS: readonly string[] = [
  "anthropic/claude-haiku-5.5",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-5.5",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5.5",
  "anthropic/claude-opus-5",
];

export const TASK_LABELS: Record<RoutingTask, string> = {
  scoring: "Scoring",
  details: "Full view",
  synthesis: "Built to Scale? synthesis",
  extraction: "Ask Summit extraction",
};

export const TASK_DESCRIPTIONS: Record<RoutingTask, string> = {
  scoring: "One call per tool per run. Scores every dimension 1 to 5 against the rubric and writes the verdict and confidence. Structured JSON at temperature 0. No fallback: a silent model switch here would move grades.",
  details: "The full view after unlock: per-dimension reasoning, recommendations for dimensions scoring 3 or below, and the tool's extras. Structured JSON at temperature 0.",
  synthesis: "One call per Built to Scale? run that writes the five comments, verdict, strongest, weakest and one change. Live since Release 3a. Has one fallback so an outage does not drop the headline.",
  extraction: "Ask Summit: reads crawled pages and documents and drafts the five inputs. Release 3b; nothing calls it yet.",
};

export const MODEL_CONFIG_KEY = "admin:model-config";
export const AI_CALLS_KEY = "ai:calls";
export const CALIBRATION_KEY = "admin:calibration";
const AI_CALLS_MAX = 2000;

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("model provider not configured");
    this.name = "LlmNotConfiguredError";
  }
}

// ── Route config (overrides from Redis, 30 s in-memory cache) ────────────────

let configCache: { value: Record<string, RouteConfig>; at: number } | null = null;
const CONFIG_TTL_MS = 30_000;

function parseOverride(raw: unknown): RouteConfig | null {
  try {
    const cfg = typeof raw === "string" ? (JSON.parse(raw) as RouteConfig) : (raw as RouteConfig);
    if (cfg && typeof cfg.model === "string" && cfg.model.length > 0) return cfg;
  } catch {
    // malformed override: ignore it
  }
  return null;
}

/** The overrides hash as a map keyed by routing key. Defaults are not merged in. */
export async function getRouteConfig(): Promise<Record<string, RouteConfig>> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;
  const overrides: Record<string, RouteConfig> = {};
  try {
    const stored = await getRedis().hgetall<Record<string, unknown>>(MODEL_CONFIG_KEY);
    if (stored) {
      for (const [key, raw] of Object.entries(stored)) {
        if (!parseRoutingKey(key)) continue;
        const cfg = parseOverride(raw);
        if (cfg) overrides[key] = cfg;
      }
    }
  } catch {
    // Redis unavailable: defaults still apply
  }
  configCache = { value: overrides, at: Date.now() };
  return overrides;
}

export function invalidateRouteCache(): void {
  configCache = null;
}

/** Resolves a routing key against the live overrides and the code defaults. */
export async function resolveRoute(key: string): Promise<ResolvedRoute> {
  return resolveRoutePure(key, await getRouteConfig(), DEFAULT_ROUTES);
}

// ── Calibration state ────────────────────────────────────────────────────────

export interface CalibrationEntry {
  model: string;
  passedAt?: string;
  rubricHashes?: Record<string, string>;
  uncalibratedSince?: string;
}

export async function getCalibrationState(): Promise<Record<string, CalibrationEntry>> {
  const state: Record<string, CalibrationEntry> = {};
  try {
    const stored = await getRedis().hgetall<Record<string, unknown>>(CALIBRATION_KEY);
    if (stored) {
      for (const [key, raw] of Object.entries(stored)) {
        try {
          const entry = typeof raw === "string" ? (JSON.parse(raw) as CalibrationEntry) : (raw as CalibrationEntry);
          if (entry && typeof entry.model === "string") state[key] = entry;
        } catch {
          // malformed entry: ignore it
        }
      }
    }
  } catch {
    // Redis unavailable: nothing is calibrated
  }
  return state;
}

/** A key is calibrated for a call when a pass is recorded for the model that resolved. */
export function isCalibrated(entry: CalibrationEntry | undefined, model: string): boolean {
  return !!entry && !!entry.passedAt && entry.model === model;
}

export async function recordCalibrationPass(
  key: string,
  pass: { model: string; rubricHashes: Record<string, string> },
): Promise<void> {
  const entry: CalibrationEntry = { model: pass.model, passedAt: new Date().toISOString(), rubricHashes: pass.rubricHashes };
  await getRedis().hset(CALIBRATION_KEY, { [key]: JSON.stringify(entry) });
}

export async function markUncalibrated(key: string, model: string): Promise<void> {
  const entry: CalibrationEntry = { model, uncalibratedSince: new Date().toISOString() };
  await getRedis().hset(CALIBRATION_KEY, { [key]: JSON.stringify(entry) });
}

// ── Client ───────────────────────────────────────────────────────────────────

let client: OpenAI | null = null;
// Time budget. One attempt is capped at 40 s (a details call with reasoning
// on took 23 s in a replay, so 25 s was too tight). The single connection
// retry is allowed only inside the first 15 s and never after a timeout (see
// isRetryable), so the worst case (an error just under 15 s, then one full
// 40 s attempt) stays at about 55 s and inside the score and details routes'
// maxDuration of 60. Raising either constant means re-checking that sum.
const CALL_TIMEOUT_MS = 40_000;
const RETRY_WINDOW_MS = 15_000;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new LlmNotConfiguredError();
  client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    maxRetries: 0,
    timeout: CALL_TIMEOUT_MS,
    defaultHeaders: {
      "HTTP-Referer": "https://summitstrategyadvisory.com",
      "X-Title": "Summit Strategy Advisory",
    },
  });
  return client;
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export interface OpenRouterModel {
  id: string;
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
}

/**
 * The OpenRouter /models listing as a map by id. Lives here so the API key
 * is read in one file. Returns an empty map when OpenRouter is unreachable.
 */
export async function fetchOpenRouterCatalog(): Promise<Map<string, OpenRouterModel>> {
  const byId = new Map<string, OpenRouterModel>();
  try {
    const headers: Record<string, string> = {};
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch("https://openrouter.ai/api/v1/models", { headers });
    if (res.ok) {
      const data = (await res.json()) as { data?: OpenRouterModel[] };
      for (const m of data.data ?? []) byId.set(m.id, m);
    }
  } catch {
    // OpenRouter unreachable: caller falls back to the curated list without prices
  }
  return byId;
}

// ── Call log ─────────────────────────────────────────────────────────────────

export interface AiCallLog {
  ts: string;
  key: string;
  model: string;
  runId: string | null;
  ms: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cost: number | null;
  ok: boolean;
  error: string | null;
  calibrated: boolean;
  /** True when the model refused `reasoning: { enabled: false }` and the call was resent with low effort. */
  reasoningFallback?: boolean;
}

export async function logCall(entry: AiCallLog): Promise<void> {
  try {
    const redis = getRedis();
    await redis.rpush(AI_CALLS_KEY, JSON.stringify(entry));
    await redis.ltrim(AI_CALLS_KEY, -AI_CALLS_MAX, -1);
  } catch {
    // logging must never break the request
  }
}

// ── callModel ────────────────────────────────────────────────────────────────

export interface CallModelArgs<T> {
  routingKey: string;
  runId: string | null;
  system: string;
  user: string;
  schema: NamedSchema;
  /** The single validator for the answer; a throw here is a 502 at the route. */
  parse: (raw: unknown) => T;
  maxTokens?: number;
  /** Honoured for synthesis and extraction only; scoring and details are always 0. */
  temperature?: number;
  /** Attach OpenRouter's web plugin. */
  web?: boolean;
}

export interface CallUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cost: number | null;
}

export interface CallResult<T> {
  data: T;
  model: string;
  routingKey: string;
  /** The key whose config answered: `scoring:moat` for a per-tool override, else the task. */
  resolvedKey: string;
  source: ResolvedRoute["source"];
  ms: number;
  usage: CallUsage;
  calibrated: boolean;
}

type LooseUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  prompt_tokens_details?: { cached_tokens?: number };
};

function readUsage(usage: unknown): CallUsage {
  const u = (usage ?? {}) as LooseUsage;
  return {
    promptTokens: u.prompt_tokens ?? 0,
    completionTokens: u.completion_tokens ?? 0,
    cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
    cost: typeof u.cost === "number" ? u.cost : null,
  };
}

function isRetryable(err: unknown): boolean {
  // A timed-out attempt is never retried: it has already spent the whole
  // 25 s window, so a second attempt could not finish inside the function
  // limit. Only connection errors and 5xx answers, which fail fast, qualify.
  if (err instanceof OpenAI.APIConnectionTimeoutError) return false;
  if (err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIError) return typeof err.status === "number" && err.status >= 500;
  return false;
}

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 200);
}

/**
 * One model call: resolve the route, send system plus user with a strict JSON
 * schema, parse with the caller's validator, log to ai:calls, return the data
 * with the model that answered.
 *
 * Scoring and details always run at temperature 0 whatever the caller asks.
 * They are the two calls whose numbers reach visitors and the calibration
 * gate; any sampling would let the same input earn different grades on
 * different days. Synthesis and extraction may pass their own temperature.
 *
 * The system prompt carries a cache_control marker so OpenRouter can cache
 * the rubric across calls; the user turn changes every time and is not marked.
 */
/**
 * One chat completion through OpenRouter with a strict JSON schema.
 *
 * Reasoning (extended thinking) is sent as `{ enabled: false }` when the
 * resolved route sets no effort, and as `{ effort }` when it does. The
 * Anthropic 5.x models think by default and their thinking tokens count
 * against `max_tokens`, so with thinking on a small cap is spent on
 * reasoning and the answer comes back empty. Off is only possible where the
 * model allows it: Haiku 5.5 accepts `enabled: false` (scoring runs with it
 * off, which also keeps scoring deterministic alongside temperature 0), but
 * Sonnet-class models through OpenRouter refuse to disable reasoning with a
 * 400 "Reasoning is mandatory for this endpoint and cannot be disabled". The
 * details default is therefore `low`, and when any model answers that 400
 * the client resends once with `{ effort: "low" }` and the same max_tokens,
 * recording `reasoningFallback: true` on the call log. An admin who turns
 * reasoning on or up for a key in /admin/models must keep that key's max
 * tokens large enough for the reasoning plus the answer (the scoring answer
 * alone is about 150 tokens; thinking adds hundreds to thousands), or the
 * call fails with "ran out of tokens".
 */
export async function callModel<T>(args: CallModelArgs<T>): Promise<CallResult<T>> {
  const route = await resolveRoute(args.routingKey);
  // The key whose config answered: the specific key when a per-tool override
  // resolved, otherwise the task key. Calibration state is kept per resolved key.
  const resolvedKey = route.source === "override:specific" ? route.key : route.task;
  const calibration = await getCalibrationState();
  const calibrated = isCalibrated(calibration[resolvedKey], route.model);
  const openai = getClient();

  const fixedTemperature = route.task === "scoring" || route.task === "details";
  const temperature = fixedTemperature ? 0 : args.temperature;
  const maxTokens = route.maxTokens ?? args.maxTokens ?? 2000;

  const body: Record<string, unknown> = {
    model: route.model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
      },
      { role: "user", content: args.user },
    ],
    response_format: { type: "json_schema", json_schema: args.schema },
  };
  if (typeof temperature === "number") body.temperature = temperature;
  // Thinking is off unless the route sets an effort. The 5.x models think by
  // default and thinking tokens count against max_tokens, so a small cap
  // would be spent on reasoning and the content would come back empty.
  body.reasoning = route.reasoning ? { effort: route.reasoning } : { enabled: false };
  if (route.fallback) body.models = [route.model, route.fallback];
  if (args.web) body.plugins = [{ id: "web" }];

  const started = Date.now();
  let answeredBy = route.model;
  let usage: CallUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: null };
  let reasoningFallback = false;

  // A 400 from a model that refuses to disable reasoning (Sonnet-class through
  // OpenRouter). Handled once by resending with low effort; never looped.
  const refusesDisabledReasoning = (err: unknown): boolean =>
    err instanceof OpenAI.APIError &&
    err.status === 400 &&
    /cannot be disabled|Reasoning is mandatory/i.test(err.message) &&
    (body.reasoning as { enabled?: boolean } | undefined)?.enabled === false;

  const attempt = async () => {
    const completion = await openai.chat.completions.create(body as unknown as ChatCompletionCreateParamsNonStreaming);
    answeredBy = completion.model || route.model;
    usage = readUsage(completion.usage);
    const choice = completion.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      const nativeFinish = (choice as { native_finish_reason?: string } | undefined)?.native_finish_reason;
      if (choice?.finish_reason === "length" || nativeFinish === "max_tokens") {
        throw new Error("model ran out of tokens before answering (max_tokens too low for this model's reasoning)");
      }
      throw new Error("model returned an empty answer");
    }
    return content;
  };

  try {
    let content: string;
    try {
      content = await attempt();
    } catch (err) {
      if (refusesDisabledReasoning(err)) {
        // Fails fast (under a second), so it is outside the retry window and
        // separate from the connection-error retry below.
        reasoningFallback = true;
        body.reasoning = { effort: "low" };
        content = await attempt();
      } else {
        if (!isRetryable(err) || Date.now() - started >= RETRY_WINDOW_MS) throw err;
        content = await attempt();
      }
    }
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error("model returned an unusable answer");
    }
    const data = args.parse(raw);
    const ms = Date.now() - started;
    void logCall({
      ts: new Date().toISOString(),
      key: args.routingKey,
      model: answeredBy,
      runId: args.runId,
      ms,
      ...usage,
      ok: true,
      error: null,
      calibrated,
      reasoningFallback,
    });
    return { data, model: answeredBy, routingKey: args.routingKey, resolvedKey, source: route.source, ms, usage, calibrated };
  } catch (err) {
    void logCall({
      ts: new Date().toISOString(),
      key: args.routingKey,
      model: answeredBy,
      runId: args.runId,
      ms: Date.now() - started,
      ...usage,
      ok: false,
      error: errorText(err),
      calibrated,
      reasoningFallback,
    });
    throw err;
  }
}
