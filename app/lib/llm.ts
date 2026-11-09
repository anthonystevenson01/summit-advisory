/**
 * The only file that constructs a model client or names a model id.
 *
 * Every call goes to OpenRouter through the `openai` package, and
 * OPENROUTER_API_KEY is read here and nowhere else. Keep it that way: a model
 * id or a client in any other file would be invisible to the admin routing
 * table, the calibration gate and the ai:calls log.
 *
 * Routing keys are `scoring`, `details`, `synthesis` and `extraction`, each
 * optionally narrowed to `{task}:{tool}`, plus the Project Builder keys
 * `builder-read`, `builder-suggest`, `builder-ideas` and the five staged
 * prototype keys `builder-prototype-research`, `-plan`, `-review`, `-build`
 * and `-audit` (never narrowed). Resolution order is the specific key
 * (`scoring:moat`), then the task key (`scoring`), then DEFAULT_ROUTES
 * below. Overrides live in the Redis hash `admin:model-config`, written from
 * /admin/models and cached in memory for 30 seconds, so a model change needs
 * no deploy. Every call is logged to the Redis list `ai:calls` (capped at
 * 2000 entries). Pure resolution lives in tools/routing.ts so tests never
 * import this file; `__tests__/llm-models.test.ts` does import it, to hold
 * the curated list against the catalogue fixture, and relies on this module
 * constructing nothing at import time.
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
// OpenRouter ids without a dated snapshot. Every id below was confirmed
// against GET https://openrouter.ai/api/v1/models on 8 November 2026
// (scripts/openrouter-models.ts refreshes the fixture the unit test checks
// them against). Gemini 3.8 Pro is not served by OpenRouter at that date
// (only 3.8 Flash and a 3.1 Pro preview), so it is left out rather than
// replaced with a preview. Meta's Muse Spark 1.3 is served under `meta/`.

/** A model the admin dropdown may choose, with what the pipeline needs to know about it. */
export interface CuratedModel {
  id: string;
  provider: "anthropic" | "openai" | "google" | "moonshot" | "deepseek" | "zai" | "meta";
  name: string;
  /** Where the request is processed. For a pinned entry it describes the pin, not the vendor. */
  location: string;
  /**
   * optional: `reasoning: { enabled: false }` is accepted and the admin may
   * turn reasoning on or off. always: the endpoint refuses to disable it (a
   * 400 "Reasoning is mandatory"), so off is sent as low. none: the model has
   * no reasoning and the field is never sent. Probed live per id on 8
   * November 2026 at off and at low; the runbook records the outcome.
   */
  reasoning: "optional" | "always" | "none";
  /** OpenRouter provider slugs to route through (`provider.order`), for the models whose data must stay in the US or EU; null for first party endpoints. */
  pin: string[] | null;
}

/** The provider prefix each entry's id must carry, as the catalogue spells them. */
export const PROVIDER_PREFIXES: Record<CuratedModel["provider"], string> = {
  anthropic: "anthropic/",
  openai: "openai/",
  google: "google/",
  moonshot: "moonshotai/",
  deepseek: "deepseek/",
  zai: "z-ai/",
  meta: "meta/",
};

export const CURATED_MODELS: readonly CuratedModel[] = [
  { id: "anthropic/claude-fable-5.1", provider: "anthropic", name: "Fable 5.1", location: "US", reasoning: "always", pin: null },
  { id: "anthropic/claude-opus-5.5", provider: "anthropic", name: "Opus 5.5", location: "US", reasoning: "always", pin: null },
  { id: "anthropic/claude-sonnet-5.5", provider: "anthropic", name: "Sonnet 5.5", location: "US", reasoning: "always", pin: null },
  { id: "anthropic/claude-haiku-5.5", provider: "anthropic", name: "Haiku 5.5", location: "US", reasoning: "optional", pin: null },
  { id: "anthropic/claude-opus-5", provider: "anthropic", name: "Opus 5", location: "US", reasoning: "optional", pin: null },
  { id: "anthropic/claude-sonnet-5", provider: "anthropic", name: "Sonnet 5", location: "US", reasoning: "optional", pin: null },
  { id: "anthropic/claude-haiku-4.5", provider: "anthropic", name: "Haiku 4.5", location: "US", reasoning: "optional", pin: null },
  { id: "openai/gpt-6-astra", provider: "openai", name: "GPT-6 Astra", location: "US", reasoning: "always", pin: null },
  { id: "openai/gpt-6-luna", provider: "openai", name: "GPT-6 Luna", location: "US", reasoning: "optional", pin: null },
  { id: "google/gemini-3.8-flash", provider: "google", name: "Gemini 3.8 Flash", location: "US, provider's choice", reasoning: "always", pin: null },
  // Pinned: Kimi K3 through Amazon Bedrock (us-east-2), Wafer (US) or Inference.net (US); DeepSeek V4 Flash through Azure (US) or DeepInfra (US);
  // DeepSeek V4 Pro through Azure (US) or Nebius (EU); GLM 5.2 through Mistral (EU), Baseten (US) or Wafer (US). Slugs read from each model's
  // /endpoints listing on 8 November 2026. With allow_fallbacks false a pinned model runs there or not at all.
  { id: "moonshotai/kimi-k3", provider: "moonshot", name: "Kimi K3", location: "US", reasoning: "optional", pin: ["amazon-bedrock/us-east-2", "wafer/us", "inference-net/us"] },
  { id: "deepseek/deepseek-v4-flash", provider: "deepseek", name: "DeepSeek V4 Flash", location: "US", reasoning: "optional", pin: ["azure/us", "deepinfra/fp8"] },
  { id: "deepseek/deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro", location: "US or EU", reasoning: "optional", pin: ["azure/us", "nebius/fp8"] },
  { id: "z-ai/glm-5.2", provider: "zai", name: "GLM 5.2", location: "EU or US", reasoning: "optional", pin: ["mistral/eu", "baseten/fp8/us", "wafer/us"] },
  { id: "meta/muse-spark-1.3", provider: "meta", name: "Muse Spark 1.3", location: "US", reasoning: "always", pin: null },
];

/** The ids alone: the admin route rejects anything outside this list. */
export const CURATED_MODEL_IDS: readonly string[] = CURATED_MODELS.map((m) => m.id);

export function curatedModel(id: string): CuratedModel | undefined {
  return CURATED_MODELS.find((m) => m.id === id);
}

/**
 * USD per million tokens, one row per curated id, from the OpenRouter
 * catalogue on the date below. Used when a call's usage carries no cost and
 * by /admin/stats to estimate a key's spend. Refresh with the script when an
 * id changes.
 */
export const PRICES_CHECKED_AT = "2026-11-08";
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "anthropic/claude-fable-5.1": { input: 10, output: 50 },
  "anthropic/claude-opus-5.5": { input: 4, output: 20 },
  "anthropic/claude-sonnet-5.5": { input: 2, output: 10 },
  "anthropic/claude-haiku-5.5": { input: 0.1, output: 0.5 },
  "anthropic/claude-opus-5": { input: 5, output: 25 },
  "anthropic/claude-sonnet-5": { input: 2, output: 10 },
  "anthropic/claude-haiku-4.5": { input: 1, output: 5 },
  "openai/gpt-6-astra": { input: 10, output: 50 },
  "openai/gpt-6-luna": { input: 0.1, output: 0.5 },
  "google/gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "moonshotai/kimi-k3": { input: 0.192, output: 16 },
  "deepseek/deepseek-v4-flash": { input: 0.091, output: 0.182 },
  "deepseek/deepseek-v4-pro": { input: 0.955, output: 1.911 },
  "z-ai/glm-5.2": { input: 0.006, output: 6.8 },
  "meta/muse-spark-1.3": { input: 1.25, output: 4.25 },
};

/** The estimated cost of a call in USD from the price table, or null when the id is unknown. */
export function estimateCost(model: string, usage: { promptTokens: number; completionTokens: number }): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  return (usage.promptTokens * price.input + usage.completionTokens * price.output) / 1e6;
}

export const DEFAULT_ROUTES: Record<RoutingTask, RouteConfig> = {
  scoring: { model: "anthropic/claude-haiku-5.5", maxTokens: 1200 },
  details: { model: "anthropic/claude-sonnet-5.5", reasoning: "low", maxTokens: 4000 },
  synthesis: { model: "anthropic/claude-opus-5.5", reasoning: "medium", maxTokens: 4000, fallback: "anthropic/claude-sonnet-5.5" },
  extraction: { model: "anthropic/claude-sonnet-5.5", reasoning: "low", maxTokens: 4000 },
  "builder-read": { model: "anthropic/claude-haiku-5.5", maxTokens: 6000, fallback: "anthropic/claude-sonnet-5.5" },
  "builder-suggest": { model: "anthropic/claude-haiku-5.5", maxTokens: 1500 },
  "builder-ideas": { model: "anthropic/claude-sonnet-5.5", reasoning: "low", maxTokens: 3000 },
  // The staged prototype, Anthony's choices of 8 November 2026. Build runs on GPT-6 Astra, which cannot turn reasoning
  // off, so "no reasoning" here is sent as low effort by the forced path below and logged as reasoningForced.
  "builder-prototype-research": { model: "deepseek/deepseek-v4-flash", maxTokens: 2000, fallback: "anthropic/claude-haiku-5.5" },
  "builder-prototype-plan": { model: "anthropic/claude-fable-5.1", reasoning: "low", maxTokens: 4000, fallback: "anthropic/claude-sonnet-5.5" },
  "builder-prototype-review": { model: "anthropic/claude-opus-5.5", reasoning: "medium", maxTokens: 3000, fallback: "anthropic/claude-fable-5.1" },
  "builder-prototype-build": { model: "openai/gpt-6-astra", maxTokens: 12000, fallback: "anthropic/claude-sonnet-5.5" },
  "builder-prototype-audit": { model: "moonshotai/kimi-k3", maxTokens: 1000, fallback: "anthropic/claude-haiku-5.5" },
};

export const TASK_LABELS: Record<RoutingTask, string> = {
  scoring: "Scoring",
  details: "Full view",
  synthesis: "Built to Scale? synthesis",
  extraction: "Ask Summit extraction",
  "builder-read": "Project Builder: read a document",
  "builder-suggest": "Project Builder: suggestions",
  "builder-ideas": "Project Builder: ideas",
  "builder-prototype-research": "Prototype 1: research",
  "builder-prototype-plan": "Prototype 2: plan",
  "builder-prototype-review": "Prototype 3: senior review",
  "builder-prototype-build": "Prototype 4: build a screen",
  "builder-prototype-audit": "Prototype 5: audit",
};

export const TASK_DESCRIPTIONS: Record<RoutingTask, string> = {
  scoring: "One call per tool per run. Scores every dimension 1 to 5 against the rubric and writes the verdict and confidence. Structured JSON at temperature 0. No fallback: a silent model switch here would move grades.",
  details: "The full view after unlock: per-dimension reasoning, recommendations for dimensions scoring 3 or below, and the tool's extras. Structured JSON at temperature 0.",
  synthesis: "One call per Built to Scale? run that writes the five comments, verdict, strongest, weakest and one change. Live since Release 3a. Has one fallback so an outage does not drop the headline.",
  extraction: "Ask Summit: reads the crawled pages and the documents (PDFs as files) and drafts the five parts with evidence and confidence. Live since Release 3b. Temperature 0.",
  "builder-read": "Extracts a requirements baseline from pasted text on the document and partly built routes of the Project Builder. Up to 60,000 characters in, one JSON answer. Has one fallback so a Haiku outage does not stop a read. Not calibration gated.",
  "builder-suggest": "The one tap helpers on the Project Builder steps (goal, features, connections, guardrails, running it) and the lookup of a system not in the catalogue. Short JSON answers that fill blanks and add, never overwrite. Not calibration gated.",
  "builder-ideas": "Make it smarter: three to six AI or automation ideas grounded in the brief. Up to three runs per brief. Not calibration gated.",
  "builder-prototype-research":
    "Prototype so far, stage 1: a company profile from the prospect's web pages and the Brandfetch description, once per brief and website. Reads page text only, never the brief. Up to 30 s. Has one fallback. Not calibration gated.",
  "builder-prototype-plan":
    "Prototype so far, stage 2: plans 3 to 5 screens with a coverage map against every requirement, feature, integration and role; one gap round when a Must is unplaced. Also answers change requests and brief changes as a plan diff. Up to 30 s per call. Has one fallback. Not calibration gated.",
  "builder-prototype-review":
    "Prototype so far, stage 3: a senior business analyst reviews the plan and returns gaps and at most five recommendations; apply items are merged before the build. One review per full plan, none on a diff. Up to 30 s. Has one fallback. Not calibration gated.",
  "builder-prototype-build":
    "Prototype so far, stage 4: one call per screen, in parallel, returning the screen's html, css and js against the plan, the profile and the house style. Up to 90 s per screen with one retry. The server writes the document shell. Has one fallback. Not calibration gated.",
  "builder-prototype-audit":
    "Prototype so far, stage 5: reads the requirements and the assembled document and lists the Must and Should requirements no screen shows. Admin only; never changes the prototype. Can be switched off here. Up to 30 s. Has one fallback. Not calibration gated.",
};

export const MODEL_CONFIG_KEY = "admin:model-config";
export const AI_CALLS_KEY = "ai:calls";
export const CALIBRATION_KEY = "admin:calibration";
const AI_CALLS_MAX = 2000;

/** One PDF sent to the model as a file part on the extraction key: 20 MB each, 30 MB together. */
export const MODEL_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const MODEL_FILES_MAX_BYTES = 30 * 1024 * 1024;

export interface ModelFile {
  name: string;
  mediaType: "application/pdf";
  /** Base64 without a data-URL prefix. */
  data: string;
}

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
    if (cfg && typeof cfg.model === "string" && cfg.model.length > 0) {
      const out: RouteConfig = { model: cfg.model };
      if (cfg.reasoning === "low" || cfg.reasoning === "medium" || cfg.reasoning === "high") out.reasoning = cfg.reasoning;
      if (typeof cfg.maxTokens === "number" && Number.isFinite(cfg.maxTokens)) out.maxTokens = cfg.maxTokens;
      if (typeof cfg.fallback === "string" && cfg.fallback.length > 0) out.fallback = cfg.fallback;
      if (cfg.enabled === false) out.enabled = false;
      return out;
    }
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
// A caller with a longer route (the prototype, maxDuration 300) passes its
// own `timeoutMs`, clamped to the bounds below, and budgets for the sum.
const CALL_TIMEOUT_MS = 40_000;
const RETRY_WINDOW_MS = 15_000;
const MIN_CALL_TIMEOUT_MS = 15_000;
const MAX_CALL_TIMEOUT_MS = 240_000;

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
  /** The Ask Summit request a processing call belongs to; null or absent for every other caller. */
  requestId?: string | null;
  ms: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cost: number | null;
  ok: boolean;
  error: string | null;
  calibrated: boolean;
  /** True when the model refused `reasoning: { enabled: false }` with a 400 and the call was resent with low effort. */
  reasoningFallback?: boolean;
  /** True when the entry says reasoning cannot be turned off, so the route's "off" was sent as low effort from the start. */
  reasoningForced?: boolean;
  /** OpenRouter's top level `provider` on the completion: which provider actually served the call. */
  provider?: string | null;
  /** True when the answering model (any dated suffix stripped) is not the route's primary model. */
  fallbackUsed?: boolean;
  /** Where `cost` came from: OpenRouter's usage, or the price table. */
  costSource?: "reported" | "estimated" | null;
  /** Free text from the caller for the stats page (`retry`, `gap`, `screen:dashboard`, `diff`); never sent to the model. */
  tag?: string;
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
  /** Tags the call log with the Ask Summit request; no behaviour. */
  requestId?: string | null;
  system: string;
  user: string;
  /** PDFs sent as file parts. Accepted on the extraction key only; sized against MODEL_FILE_MAX_BYTES and MODEL_FILES_MAX_BYTES. */
  files?: ModelFile[];
  schema: NamedSchema;
  /** The single validator for the answer; a throw here is a 502 at the route. */
  parse: (raw: unknown) => T;
  maxTokens?: number;
  /** Honoured for synthesis and extraction only; scoring and details are always 0. */
  temperature?: number;
  /** Attach OpenRouter's web plugin. */
  web?: boolean;
  /** Per request timeout in ms, clamped to 15 to 240 s. Absent: the client's 40 s default. */
  timeoutMs?: number;
  /** Logged on the call for the stats page; never sent to the model. */
  tag?: string;
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
  /** The provider OpenRouter served the call from, when it said. */
  provider: string | null;
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

/** `anthropic/claude-sonnet-5.5-20260928` and `anthropic/claude-sonnet-5.5` are the same model for the fallback check. */
function bareModelId(id: string): string {
  return id.replace(/[-:]\d{8}$/, "").replace(/:(?:batch|free|nitro|floor)$/, "");
}

// One warning per model per process when an effort is set on an entry that has no reasoning: the setting is ignored, not an error, so a stale override cannot stop calls.
const warnedNoReasoning = new Set<string>();

/** The OpenRouter provider block for a model: its pin with no provider fallback, or data collection denied alone. */
function providerBlock(entry: CuratedModel | undefined): Record<string, unknown> {
  return entry?.pin ? { order: entry.pin, allow_fallbacks: false, data_collection: "deny" } : { data_collection: "deny" };
}

function readUsage(usage: unknown): CallUsage {
  const u = (usage ?? {}) as LooseUsage;
  return {
    promptTokens: u.prompt_tokens ?? 0,
    completionTokens: u.completion_tokens ?? 0,
    cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
    cost: typeof u.cost === "number" ? u.cost : null,
  };
}

/** The sentences a provider sends with the 400 when `reasoning: { enabled: false }` is refused. */
const REASONING_REFUSAL_RE = /cannot be disabled|reasoning is mandatory|reasoning\.enabled|thinking cannot be|does not support disabling|unsupported value.*reasoning|invalid.*reasoning/i;

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
 * Reasoning (extended thinking) follows the curated entry's policy. An
 * `optional` entry gets `{ enabled: false }` when the route sets no effort
 * and `{ effort }` when it does (Haiku 5.5 runs scoring with it off, which
 * also keeps scoring deterministic alongside temperature 0). An `always`
 * entry refuses `enabled: false` with a 400 "Reasoning is mandatory for
 * this endpoint and cannot be disabled" (Sonnet 5.5, Opus 5.5, Fable 5.1,
 * GPT-6 Astra, Gemini 3.8 Flash and Muse Spark 1.3, probed 8 November
 * 2026), so off is sent as `{ effort: "low" }` from the start and the log
 * says `reasoningForced`. A `none` entry is never sent the field; a route
 * effort on it is ignored with one warning per process. When any model
 * still answers that 400 the client resends once with low effort and the
 * same max_tokens, recording `reasoningFallback: true`, so that flag only
 * ever means "the provider refused". Thinking tokens count against
 * `max_tokens`, so an admin who turns reasoning on or up for a key in
 * /admin/models must keep that key's max tokens large enough for the
 * reasoning plus the answer, or the call fails with "ran out of tokens".
 *
 * Provider routing: a pinned entry (DeepSeek, Moonshot, Z.ai) is sent with
 * `provider.order` and `allow_fallbacks: false`, so it runs on a US or EU
 * provider or not at all; when that provider is down the `models` array
 * moves the call to the route's fallback model instead. Every call sends
 * `data_collection: "deny"` and asks for usage, so the cost and the provider
 * come back on the completion.
 */
export async function callModel<T>(args: CallModelArgs<T>): Promise<CallResult<T>> {
  const route = await resolveRoute(args.routingKey);
  // The key whose config answered: the specific key when a per-tool override
  // resolved, otherwise the task key. Calibration state is kept per resolved key.
  const resolvedKey = route.source === "override:specific" ? route.key : route.task;
  const calibration = await getCalibrationState();
  const calibrated = isCalibrated(calibration[resolvedKey], route.model);
  const openai = getClient();
  const entry = curatedModel(route.model);
  const policy = entry?.reasoning ?? "optional";

  const fixedTemperature = route.task === "scoring" || route.task === "details";
  const temperature = fixedTemperature ? 0 : args.temperature;
  const maxTokens = route.maxTokens ?? args.maxTokens ?? 2000;

  // File parts (PDFs) are the extraction key's alone and are sized before
  // any call so a request can never exceed the provider's body cap. Every
  // other caller passes no files and its user message stays a string.
  const files = args.files ?? [];
  if (files.length > 0 && route.task !== "extraction") throw new Error("files are accepted on the extraction key only");
  let filesBytes = 0;
  for (const file of files) {
    const bytes = Math.floor((file.data.length * 3) / 4);
    filesBytes += bytes;
    if (bytes > MODEL_FILE_MAX_BYTES || filesBytes > MODEL_FILES_MAX_BYTES) throw new Error("file too large for the model");
  }
  const userContent: unknown =
    files.length === 0
      ? args.user
      : [
          { type: "text", text: args.user },
          ...files.map((file) => ({ type: "file", file: { filename: file.name, file_data: `data:${file.mediaType};base64,${file.data}` } })),
        ];

  const body: Record<string, unknown> = {
    model: route.model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
      },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_schema", json_schema: args.schema },
  };
  if (typeof temperature === "number") body.temperature = temperature;
  // Thinking is off unless the route sets an effort, where the entry allows
  // off at all. Thinking tokens count against max_tokens, so a small cap
  // would be spent on reasoning and the content would come back empty.
  let reasoningForced = false;
  if (policy === "none") {
    if (route.reasoning && !warnedNoReasoning.has(route.model)) {
      warnedNoReasoning.add(route.model);
      console.warn(`llm: ${route.model} has no reasoning; the ${args.routingKey} effort setting is ignored`);
    }
  } else if (route.reasoning) {
    body.reasoning = { effort: route.reasoning };
  } else if (policy === "always") {
    body.reasoning = { effort: "low" };
    reasoningForced = true;
  } else {
    body.reasoning = { enabled: false };
  }
  // The provider block applies to the whole request, so a pin would also bind
  // the `models` fallback (an Anthropic model has no permitted provider in a
  // DeepSeek pin and the whole request would fail). A pinned primary therefore
  // sends no `models` array; its fallback is resent in code below with the
  // fallback model's own provider block and reasoning policy.
  const pinnedFallback = entry?.pin && route.fallback ? route.fallback : null;
  if (route.fallback && !pinnedFallback) body.models = [route.model, route.fallback];
  body.usage = { include: true };
  body.provider = providerBlock(entry);
  const plugins: Array<Record<string, unknown>> = [];
  if (args.web) plugins.push({ id: "web" });
  // The native engine lets the model read a deck's pages as images; it is
  // charged as input tokens. `pdf-text` is the free text-only alternative.
  if (files.length > 0) plugins.push({ id: "file-parser", pdf: { engine: "native" } });
  if (plugins.length > 0) body.plugins = plugins;

  const requestOptions =
    typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)
      ? { timeout: Math.min(MAX_CALL_TIMEOUT_MS, Math.max(MIN_CALL_TIMEOUT_MS, Math.round(args.timeoutMs))) }
      : undefined;

  const started = Date.now();
  let answeredBy = route.model;
  let provider: string | null = null;
  let usage: CallUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0, cost: null };
  let costSource: AiCallLog["costSource"] = null;
  let reasoningFallback = false;

  // A 400 from a model that refuses to disable reasoning. Handled once by
  // resending with low effort; never looped. The match covers the wording
  // seen from OpenRouter's Anthropic, OpenAI, Google and Meta endpoints plus
  // the forms the other providers document.
  const refusesDisabledReasoning = (err: unknown): boolean =>
    err instanceof OpenAI.APIError &&
    err.status === 400 &&
    REASONING_REFUSAL_RE.test(err.message) &&
    (body.reasoning as { enabled?: boolean } | undefined)?.enabled === false;

  const attempt = async () => {
    const completion = await openai.chat.completions.create(body as unknown as ChatCompletionCreateParamsNonStreaming, requestOptions);
    answeredBy = completion.model || route.model;
    const served = (completion as { provider?: unknown }).provider;
    provider = typeof served === "string" && served ? served : null;
    usage = readUsage(completion.usage);
    if (usage.cost === null) {
      const estimated = estimateCost(bareModelId(answeredBy), usage);
      if (estimated !== null) {
        usage = { ...usage, cost: estimated };
        costSource = "estimated";
      }
    } else {
      costSource = "reported";
    }
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
      } else if (pinnedFallback && !(err instanceof OpenAI.APIConnectionTimeoutError)) {
        // The pinned provider refused or is down: one resend on the fallback
        // model without the pin, as the `models` array would have done for an
        // unpinned primary. A timed out attempt is not resent, as below.
        const fallbackEntry = curatedModel(pinnedFallback);
        body.model = pinnedFallback;
        body.provider = providerBlock(fallbackEntry);
        if (fallbackEntry?.reasoning === "none") delete body.reasoning;
        else if (route.reasoning) body.reasoning = { effort: route.reasoning };
        else if (fallbackEntry?.reasoning === "always") body.reasoning = { effort: "low" };
        else body.reasoning = { enabled: false };
        answeredBy = pinnedFallback;
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
      requestId: args.requestId ?? null,
      ms,
      ...usage,
      ok: true,
      error: null,
      calibrated,
      reasoningFallback,
      reasoningForced,
      provider,
      fallbackUsed: bareModelId(answeredBy) !== bareModelId(route.model),
      costSource,
      tag: args.tag,
    });
    return { data, model: answeredBy, provider, routingKey: args.routingKey, resolvedKey, source: route.source, ms, usage, calibrated };
  } catch (err) {
    void logCall({
      ts: new Date().toISOString(),
      key: args.routingKey,
      model: answeredBy,
      runId: args.runId,
      requestId: args.requestId ?? null,
      ms: Date.now() - started,
      ...usage,
      ok: false,
      error: errorText(err),
      calibrated,
      reasoningFallback,
      reasoningForced,
      provider,
      fallbackUsed: bareModelId(answeredBy) !== bareModelId(route.model),
      costSource,
      tag: args.tag,
    });
    throw err;
  }
}
