/**
 * The data behind the 1200 by 630 score card image. Pure and edge safe: no
 * `node:` imports, no Redis, no registry. `readCompositeSummary` reads the
 * raw `run:{id}` hash the edge function fetched (tolerant of both Upstash
 * read shapes: JSON strings and already parsed values); `scorecardImageData`
 * turns the summary into the names, dots and lines the image draws.
 */
import { BTS_PARTS, BUILT_TO_SCALE_TOOL, type BtsPartKey } from "./built-to-scale-method.ts";

export interface CompositeSummary {
  total: number;
  band: string;
  rows: Array<{ key: BtsPartKey; grade: number }>;
}

export interface ScorecardImageRow {
  name: string;
  grade: number;
  dots: boolean[];
}

export interface ScorecardImageData {
  total: number;
  band: string;
  rows: ScorecardImageRow[];
  line: string;
}

export const IMAGE_LINE = "scored against Summit's rubrics";

function parseMaybeJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Null when the hash is not a composite run or a field is missing or malformed. */
export function readCompositeSummary(hash: Record<string, unknown> | null | undefined): CompositeSummary | null {
  if (!hash || typeof hash !== "object") return null;
  if (hash.tool !== BUILT_TO_SCALE_TOOL) return null;
  // An Ask Summit composite is admin only; the image draws the empty frame for it.
  if (hash.source === "ask-summit") return null;
  const total = Number(parseMaybeJson(hash.total));
  if (!Number.isFinite(total)) return null;
  const band = typeof hash.band === "string" ? hash.band : "";
  if (!band) return null;
  const rawRows = parseMaybeJson(hash.rows);
  if (!Array.isArray(rawRows)) return null;
  const rows: CompositeSummary["rows"] = [];
  for (const part of BTS_PARTS) {
    const found = rawRows.find((r) => typeof r === "object" && r !== null && (r as { key?: unknown }).key === part.key) as
      | { grade?: unknown }
      | undefined;
    const grade = Number(found?.grade);
    if (!found || !Number.isFinite(grade)) return null;
    rows.push({ key: part.key, grade: Math.min(5, Math.max(1, Math.round(grade))) });
  }
  return { total, band, rows };
}

/** Five rows in the method's order, each with five dots filled up to the grade. */
export function scorecardImageData(summary: CompositeSummary): ScorecardImageData {
  const rows = BTS_PARTS.map((part) => {
    const grade = summary.rows.find((r) => r.key === part.key)?.grade ?? 0;
    return { name: part.name, grade, dots: Array.from({ length: 5 }, (_, i) => i < grade) };
  });
  return { total: summary.total, band: summary.band, rows, line: IMAGE_LINE };
}
