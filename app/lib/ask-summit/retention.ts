/**
 * Retention maths for Ask Summit: the 30 day delete date, the due check,
 * the request id a blob pathname belongs to, and the orphan age the sweep
 * uses for uploads whose form was never submitted. Pure.
 */
import { REQUEST_ID_PATTERN } from "./validation.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const RETENTION_DAYS = 30;
export const ORPHAN_AGE_MS = 48 * HOUR_MS;

/** `createdAt` plus 30 days, as ISO. */
export function deleteAtFor(createdAtIso: string): string {
  const created = Date.parse(createdAtIso);
  const base = Number.isFinite(created) ? created : Date.now();
  return new Date(base + RETENTION_DAYS * DAY_MS).toISOString();
}

/** True once `deleteAt` has arrived. A malformed date is never due. */
export function isDue(deleteAtIso: string, nowMs: number): boolean {
  const t = Date.parse(deleteAtIso);
  return Number.isFinite(t) && t <= nowMs;
}

const PATHNAME_PATTERN = /^ask-summit\/(ask_[0-9a-f]{16})\//;

/** The request id when the pathname is `ask-summit/{ask_16hex}/...`, else null. */
export function requestIdFromPathname(pathname: string): string | null {
  const match = PATHNAME_PATTERN.exec(pathname);
  if (!match) return null;
  return REQUEST_ID_PATTERN.test(match[1]) ? match[1] : null;
}

/** A blob at least 48 hours old whose request never arrived is an orphan the sweep may delete. */
export function isOrphanCandidate(uploadedAtIso: string, nowMs: number): boolean {
  const t = Date.parse(uploadedAtIso);
  return Number.isFinite(t) && nowMs - t >= ORPHAN_AGE_MS;
}
