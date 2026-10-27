/**
 * The monthly spend check: the UTC month key, the month's spend from the
 * `ai:calls` entries, the alert-due rule and the threshold parser. Pure:
 * admin.ts reads Redis and hands the entries in. The figure is only as
 * complete as `ai:calls`, which keeps the last 2000 calls; a null cost
 * counts as zero, so the month's spend is a lower bound.
 */

export const SPEND_ALERT_KEY_PREFIX = "admin:spend-alerted:";

export interface SpendEntry {
  ts?: unknown;
  cost?: unknown;
}

/** `YYYY-MM` in UTC. */
export function monthKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 7);
}

/** The sum of the numeric `cost` of every entry whose `ts` falls in the same UTC month as `nowMs`. */
export function monthSpend(entries: readonly unknown[], nowMs: number): number {
  const month = monthKey(nowMs);
  let total = 0;
  for (const item of entries) {
    if (typeof item !== "object" || item === null) continue;
    const entry = item as SpendEntry;
    if (typeof entry.ts !== "string") continue;
    const t = Date.parse(entry.ts);
    if (!Number.isFinite(t) || monthKey(t) !== month) continue;
    if (typeof entry.cost === "number" && Number.isFinite(entry.cost)) total += entry.cost;
  }
  return total;
}

/** True only when the threshold is a finite number above zero, the spend has reached it and no alert went out this month. */
export function spendAlertDue(args: { spend: number; threshold: number | null; alerted: boolean }): boolean {
  const { spend, threshold, alerted } = args;
  if (alerted) return false;
  if (threshold === null || !Number.isFinite(threshold) || threshold <= 0) return false;
  return spend >= threshold;
}

/**
 * A non-negative decimal string or number gives a number; blank (or null)
 * gives null, meaning clear; anything else gives undefined, meaning invalid.
 */
export function parseThreshold(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}
