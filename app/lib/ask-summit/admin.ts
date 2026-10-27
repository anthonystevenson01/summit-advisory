/**
 * The admin switches for Ask Summit: the pause flag the form, the token
 * route, the submit route and the processing route all honour, the monthly
 * spend threshold, this month's spend from `ai:calls`, and the once-a-month
 * alert flag. Reads Redis; the maths is in spend.ts.
 */
import { AI_CALLS_KEY } from "../llm.ts";
import { getRedis } from "../redis.ts";
import { SPEND_ALERT_KEY_PREFIX, monthKey, monthSpend, parseThreshold } from "./spend.ts";

export const PAUSE_KEY = "admin:ask-summit:paused";
export const SPEND_THRESHOLD_KEY = "admin:spend-threshold";

/** False on a Redis error (logged): the submit route is the authority and refuses on its own read. */
export async function isPaused(): Promise<boolean> {
  try {
    const value = await getRedis().get(PAUSE_KEY);
    return value === "1" || value === 1;
  } catch (err) {
    console.error("ask-summit: pause flag read failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Resume deletes the key rather than writing "0", so an absent key always reads as taking requests. */
export async function setPaused(flag: boolean): Promise<void> {
  const redis = getRedis();
  if (flag) await redis.set(PAUSE_KEY, "1");
  else await redis.del(PAUSE_KEY);
}

export async function getSpendThreshold(): Promise<number | null> {
  const value = await getRedis().get(SPEND_THRESHOLD_KEY);
  const parsed = parseThreshold(value === null || value === undefined ? "" : String(value));
  return parsed === undefined ? null : parsed;
}

export async function setSpendThreshold(value: number | null): Promise<void> {
  const redis = getRedis();
  if (value === null) await redis.del(SPEND_THRESHOLD_KEY);
  else await redis.set(SPEND_THRESHOLD_KEY, String(value));
}

/** This UTC month's spend from the last 2000 logged calls; a null cost counts as zero. */
export async function getMonthSpend(nowMs: number = Date.now()): Promise<number> {
  const raw = await getRedis().lrange<unknown>(AI_CALLS_KEY, 0, -1);
  const entries: unknown[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      try {
        entries.push(JSON.parse(item));
      } catch {
        // malformed entry: ignore it
      }
    } else {
      entries.push(item);
    }
  }
  return monthSpend(entries, nowMs);
}

export function spendAlertKey(month: string): string {
  return `${SPEND_ALERT_KEY_PREFIX}${month}`;
}

/** The ISO time the month's alert was sent, or null. */
export async function spendAlertedAt(month: string): Promise<string | null> {
  const value = await getRedis().get(spendAlertKey(month));
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function wasSpendAlerted(month: string): Promise<boolean> {
  return (await spendAlertedAt(month)) !== null;
}

export async function markSpendAlerted(month: string): Promise<void> {
  await getRedis().set(spendAlertKey(month), new Date().toISOString());
}

export { monthKey };
