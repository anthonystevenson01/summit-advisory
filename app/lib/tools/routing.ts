/**
 * Routing key resolution. Pure: DEFAULT_ROUTES is passed in, not imported,
 * so tests run with no Redis and no env.
 *
 * Keys are `scoring`, `details`, `synthesis`, `extraction`, each optionally
 * narrowed to `{task}:{tool}` where tool is a registry slug. Resolution is
 * specific first, then task, then the code default.
 */
import { ROUTING_TASKS, isToolSlug, type ToolSlug } from "./registry.ts";

export { ROUTING_TASKS };

export type RoutingTask = (typeof ROUTING_TASKS)[number];

export type ReasoningEffort = "low" | "medium" | "high";

export interface RouteConfig {
  model: string;
  reasoning?: ReasoningEffort;
  maxTokens?: number;
  fallback?: string;
}

export type RouteSource = "override:specific" | "override:task" | "default";

export interface ResolvedRoute extends RouteConfig {
  key: string;
  task: RoutingTask;
  tool?: ToolSlug;
  source: RouteSource;
}

export interface ParsedRoutingKey {
  task: RoutingTask;
  tool?: ToolSlug;
}

export function isRoutingTask(value: string): value is RoutingTask {
  return (ROUTING_TASKS as readonly string[]).includes(value);
}

/** `scoring` or `scoring:moat`; null for anything else. */
export function parseRoutingKey(key: string): ParsedRoutingKey | null {
  if (typeof key !== "string") return null;
  const parts = key.split(":");
  if (parts.length === 1) {
    return isRoutingTask(parts[0]) ? { task: parts[0] } : null;
  }
  if (parts.length === 2) {
    const [task, tool] = parts;
    if (!isRoutingTask(task) || !isToolSlug(tool)) return null;
    return { task, tool };
  }
  return null;
}

function usable(cfg: RouteConfig | undefined): cfg is RouteConfig {
  return !!cfg && typeof cfg.model === "string" && cfg.model.length > 0;
}

export function resolveRoute(
  key: string,
  overrides: Record<string, RouteConfig | undefined>,
  defaults: Record<RoutingTask, RouteConfig>,
): ResolvedRoute {
  const parsed = parseRoutingKey(key);
  if (!parsed) throw new Error(`Unknown routing key: ${key}`);
  const { task, tool } = parsed;
  if (tool) {
    const specific = overrides[key];
    if (usable(specific)) return { ...specific, key, task, tool, source: "override:specific" };
  }
  const taskOverride = overrides[task];
  if (usable(taskOverride)) return { ...taskOverride, key, task, tool, source: "override:task" };
  return { ...defaults[task], key, task, tool, source: "default" };
}

/**
 * True for `scoring`, `scoring:{tool}` and `synthesis`. These are the keys
 * whose model choice moves a number a visitor sees: the grade (scoring) or
 * the Built to Scale? headline (synthesis). Changing their model in /admin
 * marks the key uncalibrated until `npm run calibrate` passes with that
 * model. `details` and `extraction` produce prose, not grades, so they are
 * not gated.
 */
export function isCalibrationGated(key: string): boolean {
  const parsed = parseRoutingKey(key);
  if (!parsed) return false;
  return parsed.task === "scoring" || parsed.task === "synthesis";
}
