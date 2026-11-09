/**
 * The audit stage: which Must and Should requirements are not visibly
 * represented on the assembled screens. Pure: the parse of the model's
 * answer, filtered to the ids the plan was asked to cover, and the item
 * lines the audit prompt lists. The result is stored on the prototype record
 * and shown on the admin page only; it never changes the document or the
 * answer to the prospect.
 */
import { SchemaError } from "../tools/schema.ts";
import type { CoverageItem } from "./plan.ts";
import type { AuditMissing, PrototypeAudit } from "./prototype.ts";

export type { AuditMissing, PrototypeAudit };

/** More misses than a brief has requirements is a model answering at random; the cap keeps the admin list readable. */
export const AUDIT_MISSING_CAP = 40;
export const AUDIT_NOTE_CHARS = 160;

export interface AuditAnswer {
  missing: Array<{ id: string; note: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The parser `callModel` runs: `missing` must be an array; entries without a string id are dropped. */
export function parseAuditAnswer(raw: unknown): AuditAnswer {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  if (!Array.isArray(raw.missing)) throw new SchemaError("missing is not an array");
  const missing: AuditAnswer["missing"] = [];
  for (const item of raw.missing) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    const id = item.id.trim();
    if (!id || missing.some((m) => m.id === id)) continue;
    missing.push({ id, note: typeof item.note === "string" ? item.note.replace(/\s+/g, " ").trim().slice(0, AUDIT_NOTE_CHARS) : "" });
    if (missing.length >= AUDIT_MISSING_CAP) break;
  }
  return { missing };
}

/** The Must and Should requirement items the audit is asked about (roles and Could rows are not). */
export function auditItems(items: readonly CoverageItem[]): CoverageItem[] {
  return items.filter((i) => i.kind === "requirement" && (i.pri === "Must" || i.pri === "Should"));
}

/** The lines the audit prompt lists, one per item: `id | priority | text`. */
export function auditItemLines(items: readonly CoverageItem[]): string[] {
  return auditItems(items).map((i) => `${i.id} | ${i.pri} | ${i.label}`);
}

/** The stored audit: ids kept only when they name an audited item, with that item's label and priority. */
export function auditFromAnswer(answer: AuditAnswer, items: readonly CoverageItem[], meta: { model: string; checkedAt?: string }): PrototypeAudit {
  const audited = auditItems(items);
  const missing: AuditMissing[] = [];
  for (const m of answer.missing) {
    const item = audited.find((i) => i.id === m.id);
    if (!item) continue;
    missing.push({ id: item.id, label: item.label, pri: item.pri ?? "", note: m.note });
  }
  return { missing, checkedAt: meta.checkedAt ?? new Date().toISOString(), model: meta.model };
}
