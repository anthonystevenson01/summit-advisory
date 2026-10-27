import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";
import { validateSession } from "@/app/lib/auth";
import { getMonthSpend, getSpendThreshold, monthKey, spendAlertedAt } from "@/app/lib/ask-summit/admin";
import {
  AI_CALLS_KEY,
  CALIBRATION_KEY,
  CURATED_MODELS,
  DEFAULT_ROUTES,
  MODEL_CONFIG_KEY,
  TASK_DESCRIPTIONS,
  TASK_LABELS,
  fetchOpenRouterCatalog,
  getCalibrationState,
  getRouteConfig,
  invalidateRouteCache,
  isCalibrationGated,
  markUncalibrated,
  parseRoutingKey,
  type AiCallLog,
  type RouteConfig,
} from "@/app/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATALOG_KEY = "admin:model-catalog";
const CATALOG_TTL = 600;
const USAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type CatalogModel = {
  id: string;
  promptPrice: number;
  completionPrice: number;
  context: number;
  /** False when OpenRouter no longer lists the model. */
  available: boolean;
};

/** The curated list enriched from OpenRouter, cached in Redis for 10 minutes. */
async function getCatalog(): Promise<CatalogModel[]> {
  const redis = getRedis();
  try {
    const cached = await redis.get<CatalogModel[] | string>(CATALOG_KEY);
    const parsed = typeof cached === "string" ? (JSON.parse(cached) as CatalogModel[]) : cached;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to a live fetch
  }

  const byId = await fetchOpenRouterCatalog();

  const catalog: CatalogModel[] = CURATED_MODELS.map((id) => {
    const m = byId.get(id);
    return {
      id,
      promptPrice: Number(m?.pricing?.prompt ?? 0) * 1e6,
      completionPrice: Number(m?.pricing?.completion ?? 0) * 1e6,
      context: m?.context_length ?? 0,
      available: byId.size === 0 ? true : !!m,
    };
  });

  if (byId.size > 0) {
    try {
      await redis.set(CATALOG_KEY, JSON.stringify(catalog), { ex: CATALOG_TTL });
    } catch {
      // caching is best effort
    }
  }
  return catalog;
}

/** Calls and spend in the last 30 days, keyed by the routing key each call requested. */
async function getUsage(): Promise<Record<string, { calls: number; cost: number }>> {
  const usage: Record<string, { calls: number; cost: number }> = {};
  try {
    const raw = await getRedis().lrange<AiCallLog | string>(AI_CALLS_KEY, 0, -1);
    const cutoff = Date.now() - USAGE_WINDOW_MS;
    for (const item of raw) {
      let entry: AiCallLog;
      try {
        entry = typeof item === "string" ? (JSON.parse(item) as AiCallLog) : item;
      } catch {
        continue;
      }
      const ts = Date.parse(entry.ts);
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const bucket = (usage[entry.key] ??= { calls: 0, cost: 0 });
      bucket.calls += 1;
      bucket.cost += typeof entry.cost === "number" ? entry.cost : 0;
    }
  } catch {
    // Redis unavailable: no usage
  }
  return usage;
}

/** This month's spend, the alert threshold and when the month's alert went out, for the panel on /admin/models. */
async function getSpend(): Promise<{ month: string; cost: number; threshold: number | null; alertedAt: string | null }> {
  const now = Date.now();
  const month = monthKey(now);
  try {
    const [cost, threshold, alertedAt] = await Promise.all([getMonthSpend(now), getSpendThreshold(), spendAlertedAt(month)]);
    return { month, cost, threshold, alertedAt };
  } catch {
    return { month, cost: 0, threshold: null, alertedAt: null };
  }
}

async function snapshot() {
  invalidateRouteCache();
  const [config, catalog, calibration, usage, spend] = await Promise.all([
    getRouteConfig(),
    getCatalog(),
    getCalibrationState(),
    getUsage(),
    getSpend(),
  ]);
  return {
    config,
    defaults: DEFAULT_ROUTES,
    labels: TASK_LABELS,
    descriptions: TASK_DESCRIPTIONS,
    catalog,
    calibration,
    usage,
    spend,
  };
}

export async function GET() {
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    return NextResponse.json(await snapshot());
  } catch (err) {
    console.error("admin models GET", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load the routing table." }, { status: 500 });
  }
}

type PatchBody = {
  key?: unknown;
  model?: unknown;
  reasoning?: unknown;
  maxTokens?: unknown;
  fallback?: unknown;
  reset?: unknown;
};

export async function PATCH(req: NextRequest) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : "";
  const parsed = parseRoutingKey(key);
  if (!parsed) {
    return NextResponse.json({ error: "Unknown routing key." }, { status: 400 });
  }

  const redis = getRedis();

  try {
    if (body.reset === true) {
      await redis.hdel(MODEL_CONFIG_KEY, key);
      await redis.hdel(CALIBRATION_KEY, key);
      invalidateRouteCache();
      const { config, calibration } = await snapshot();
      return NextResponse.json({ config, calibration });
    }

    if (typeof body.model !== "string" || !CURATED_MODELS.includes(body.model)) {
      return NextResponse.json({ error: "Model is not in the curated list." }, { status: 400 });
    }
    const override: RouteConfig = { model: body.model };

    if (body.reasoning !== undefined && body.reasoning !== null && body.reasoning !== "") {
      if (body.reasoning !== "low" && body.reasoning !== "medium" && body.reasoning !== "high") {
        return NextResponse.json({ error: "Reasoning must be low, medium or high." }, { status: 400 });
      }
      override.reasoning = body.reasoning;
    }

    if (body.maxTokens !== undefined && body.maxTokens !== null && body.maxTokens !== "") {
      const n = Number(body.maxTokens);
      if (!Number.isInteger(n) || n < 100 || n > 16000) {
        return NextResponse.json({ error: "Max tokens must be an integer from 100 to 16000." }, { status: 400 });
      }
      override.maxTokens = n;
    }

    if (body.fallback !== undefined && body.fallback !== null && body.fallback !== "") {
      if (parsed.task !== "synthesis" && parsed.task !== "builder-read") {
        return NextResponse.json({ error: "Only synthesis and builder-read may have a fallback." }, { status: 400 });
      }
      if (typeof body.fallback !== "string" || !CURATED_MODELS.includes(body.fallback)) {
        return NextResponse.json({ error: "Fallback is not in the curated list." }, { status: 400 });
      }
      override.fallback = body.fallback;
    }

    await redis.hset(MODEL_CONFIG_KEY, { [key]: JSON.stringify(override) });
    if (isCalibrationGated(key)) {
      await markUncalibrated(key, override.model);
    }
    invalidateRouteCache();
    const { config, calibration } = await snapshot();
    return NextResponse.json({ config, calibration });
  } catch (err) {
    console.error("admin models PATCH", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save the change." }, { status: 500 });
  }
}
