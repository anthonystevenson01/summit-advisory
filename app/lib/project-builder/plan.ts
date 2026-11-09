/**
 * The screen plan: the items a plan must cover (every requirement row with
 * its Notion id, every role), the plan shape, the parse and cap of the
 * planner's answer, the coverage check the server runs in code, the plan
 * diff a change request or a brief change produces, and the rule that
 * decides which screens a diff rebuilds. Pure: the engine and the prototype
 * constants only; no model, no env.
 *
 * Ids are the same `REQ-nnn` the Notion page and the admin table show, so
 * a gap line, an unplaced entry and an audit result all name a row the
 * reader can find. Roles get `ROLE-{slug}`.
 */
import { PRIORITIES, type Priority } from "./catalogue.ts";
import type { BriefState } from "./brief.ts";
import { buildRequirements, type RequirementCategory } from "./requirements.ts";
import { PROTOTYPE_SCREENS_MAX, PROTOTYPE_SCREENS_MIN } from "./prototype.ts";
import { SchemaError } from "../tools/schema.ts";

// ── Coverage items ───────────────────────────────────────────────────────────

export interface CoverageItem {
  id: string;
  kind: "requirement" | "role";
  label: string;
  /** Requirement rows only. */
  cat?: RequirementCategory;
  pri?: Priority;
  /** The feature key or integration label, for the prompt; empty otherwise. */
  key?: string;
}

export function roleSlug(role: string): string {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "role";
}

/** One item per requirement row (in Notion order, so the ids match `requirementsForNotion`) plus one per role. */
export function coverageItems(state: BriefState): CoverageItem[] {
  const reqs = buildRequirements(state);
  const ordered = PRIORITIES.flatMap((p) => reqs.filter((r) => r.pri === p));
  const items: CoverageItem[] = ordered.map((r, i) => ({
    id: `REQ-${String(i + 1).padStart(3, "0")}`,
    kind: "requirement",
    label: r.text,
    cat: r.cat,
    pri: r.pri,
    key: r.ref.kind === "feature" ? r.ref.key : r.ref.kind === "integration" ? r.ref.label : "",
  }));
  const seen = new Set<string>();
  for (const role of state.roles) {
    const label = role.trim();
    if (!label) continue;
    let id = `ROLE-${roleSlug(label)}`;
    let n = 2;
    while (seen.has(id)) id = `ROLE-${roleSlug(label)}-${n++}`;
    seen.add(id);
    items.push({ id, kind: "role", label });
  }
  return items;
}

/** The lines the plan, review and screen prompts list the items as: `id | kind | priority | text`. */
export function coverageItemLines(items: readonly CoverageItem[]): string[] {
  return items.map((i) => (i.kind === "role" ? `${i.id} | Role | | ${i.label}` : `${i.id} | ${i.cat} | ${i.pri} | ${i.label}`));
}

// ── Plan shape ───────────────────────────────────────────────────────────────

export const PLAN_COMPONENT_KINDS = ["table", "figures", "chart", "form", "detail", "list"] as const;
export type PlanComponentKind = (typeof PLAN_COMPONENT_KINDS)[number];

export interface PlanComponent {
  kind: PlanComponentKind;
  title: string;
  entity: string;
  note: string;
}

export interface PlanScreen {
  slug: string;
  title: string;
  purpose: string;
  role: string;
  components: PlanComponent[];
  entities: string[];
}

export interface CoverageEntry {
  id: string;
  screen: string;
  component: string;
}

export interface UnplacedEntry {
  id: string;
  reason: string;
}

export interface AcceptedRequest {
  requestId: string;
  text: string;
  at: string;
}

export interface PrototypePlan {
  version: number;
  /** The snapshot hash the plan was built from. */
  builtFrom: string;
  builtAt: string;
  model: string;
  screens: PlanScreen[];
  coverage: CoverageEntry[];
  unplaced: UnplacedEntry[];
  /** Change requests carried forward so a later brief driven update keeps them. */
  accepted: AcceptedRequest[];
  reviewApplied: string[];
  reviewSuggested: string[];
}

export interface OutOfRemit {
  refused: boolean;
  reason: string;
}

/** The planner's diff answer: the whole updated plan plus which screens changed and whether it refused the request. */
export interface PlanDiffAnswer {
  screens: PlanScreen[];
  coverage: CoverageEntry[];
  unplaced: UnplacedEntry[];
  changedScreens: string[];
  outOfRemit: OutOfRemit;
}

export const PLAN_SLUG_MAX = 24;
export const PLAN_TITLE_CHARS = 60;
export const PLAN_PURPOSE_CHARS = 200;
export const PLAN_COMPONENTS_MAX = 8;
export const PLAN_ENTITY_CHARS = 40;
export const PLAN_ENTITIES_MAX = 8;
export const PLAN_NOTE_CHARS = 160;
export const PLAN_REASON_CHARS = 200;

// ── Parsing ──────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, cap: number): string {
  return typeof value === "string" ? value.replace(/\s*[–—]\s*/g, ", ").replace(/\s+/g, " ").trim().slice(0, cap) : "";
}

export function cleanSlug(value: unknown, fallback = ""): string {
  const source = typeof value === "string" && value.trim() ? value : fallback;
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PLAN_SLUG_MAX)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : slug ? `${slug}-screen` : "";
}

function isKind(value: unknown): value is PlanComponentKind {
  return typeof value === "string" && (PLAN_COMPONENT_KINDS as readonly string[]).includes(value);
}

export function parseComponent(raw: unknown): PlanComponent | null {
  if (!isRecord(raw) || !isKind(raw.kind)) return null;
  const title = cleanString(raw.title, PLAN_TITLE_CHARS);
  if (!title) return null;
  return { kind: raw.kind, title, entity: cleanString(raw.entity, PLAN_ENTITY_CHARS), note: cleanString(raw.note, PLAN_NOTE_CHARS) };
}

/** One screen from the answer, or null when it has no usable slug or title. Slugs are made unique by the caller. */
export function parseScreen(raw: unknown): PlanScreen | null {
  if (!isRecord(raw)) return null;
  const title = cleanString(raw.title, PLAN_TITLE_CHARS);
  const slug = cleanSlug(raw.slug, title);
  if (!slug || !title) return null;
  const components: PlanComponent[] = [];
  for (const c of Array.isArray(raw.components) ? raw.components : []) {
    const parsed = parseComponent(c);
    if (parsed) components.push(parsed);
    if (components.length >= PLAN_COMPONENTS_MAX) break;
  }
  const entities: string[] = [];
  for (const e of Array.isArray(raw.entities) ? raw.entities : []) {
    const s = cleanString(e, PLAN_ENTITY_CHARS);
    if (s && !entities.includes(s)) entities.push(s);
    if (entities.length >= PLAN_ENTITIES_MAX) break;
  }
  return { slug, title, purpose: cleanString(raw.purpose, PLAN_PURPOSE_CHARS), role: cleanString(raw.role, PLAN_TITLE_CHARS), components, entities };
}

/** Slugs are section ids, nav targets and id prefixes, so two screens may never share one; the second gets a numeric suffix. */
function uniqueSlugs(screens: PlanScreen[]): PlanScreen[] {
  const seen = new Set<string>();
  return screens.map((s) => {
    let slug = s.slug;
    let n = 2;
    while (seen.has(slug)) slug = `${s.slug.slice(0, PLAN_SLUG_MAX - 2)}-${n++}`;
    seen.add(slug);
    return { ...s, slug };
  });
}

/** A table or figure cards is what makes a screen a dashboard or main list, the Round 2 rule for the screen visible on load. */
function hasMainComponent(screen: PlanScreen): boolean {
  return screen.components.some((c) => c.kind === "table" || c.kind === "figures");
}

/** The first screen must be the dashboard or main list: the first screen with a table or figure cards is moved to the front. */
export function orderScreens(screens: PlanScreen[]): PlanScreen[] {
  if (screens.length === 0 || hasMainComponent(screens[0])) return screens;
  const at = screens.findIndex(hasMainComponent);
  if (at <= 0) return screens;
  const out = screens.slice();
  const [main] = out.splice(at, 1);
  out.unshift(main);
  return out;
}

function parseScreens(raw: Record<string, unknown>): PlanScreen[] {
  if (!Array.isArray(raw.screens)) throw new SchemaError("screens is not an array");
  const screens: PlanScreen[] = [];
  for (const s of raw.screens) {
    const parsed = parseScreen(s);
    if (parsed) screens.push(parsed);
    if (screens.length >= PROTOTYPE_SCREENS_MAX) break;
  }
  if (screens.length < PROTOTYPE_SCREENS_MIN) throw new SchemaError(`the plan has ${screens.length} usable screens; it needs at least ${PROTOTYPE_SCREENS_MIN}`);
  return orderScreens(uniqueSlugs(screens));
}

function parseCoverage(raw: unknown, items: readonly CoverageItem[], screens: readonly PlanScreen[]): CoverageEntry[] {
  const ids = new Set(items.map((i) => i.id));
  const slugs = new Set(screens.map((s) => s.slug));
  const out: CoverageEntry[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.screen !== "string") continue;
    const id = entry.id.trim();
    const screen = cleanSlug(entry.screen);
    if (!ids.has(id) || !slugs.has(screen)) continue;
    if (out.some((e) => e.id === id && e.screen === screen)) continue;
    out.push({ id, screen, component: cleanString(entry.component, PLAN_TITLE_CHARS) });
  }
  return out;
}

function parseUnplaced(raw: unknown, items: readonly CoverageItem[]): UnplacedEntry[] {
  const ids = new Set(items.map((i) => i.id));
  const out: UnplacedEntry[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!isRecord(entry) || typeof entry.id !== "string") continue;
    const id = entry.id.trim();
    if (!ids.has(id) || out.some((e) => e.id === id)) continue;
    out.push({ id, reason: cleanString(entry.reason, PLAN_REASON_CHARS) });
  }
  return out;
}

export interface PlanMeta {
  version: number;
  builtFrom: string;
  model: string;
  builtAt?: string;
}

/** The parser for a full plan answer: screens required (3 to 5 kept), coverage and unplaced filtered to known ids and slugs. */
export function parsePlanAnswer(raw: unknown, items: readonly CoverageItem[], meta: PlanMeta): PrototypePlan {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  const screens = parseScreens(raw);
  return {
    version: meta.version,
    builtFrom: meta.builtFrom,
    builtAt: meta.builtAt ?? new Date().toISOString(),
    model: meta.model,
    screens,
    coverage: parseCoverage(raw.coverage, items, screens),
    unplaced: parseUnplaced(raw.unplaced, items),
    accepted: [],
    reviewApplied: [],
    reviewSuggested: [],
  };
}

/** The parser for a diff answer: the plan fields as above plus `changedScreens` and `outOfRemit`. */
export function parsePlanDiffAnswer(raw: unknown, items: readonly CoverageItem[]): PlanDiffAnswer {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  const remit = isRecord(raw.outOfRemit) ? raw.outOfRemit : {};
  const outOfRemit: OutOfRemit = { refused: remit.refused === true, reason: cleanString(remit.reason, PLAN_REASON_CHARS) };
  if (outOfRemit.refused) {
    // A refusal carries no plan worth checking; the current plan stays.
    return { screens: [], coverage: [], unplaced: [], changedScreens: [], outOfRemit };
  }
  const screens = parseScreens(raw);
  const slugs = new Set(screens.map((s) => s.slug));
  const changed: string[] = [];
  for (const c of Array.isArray(raw.changedScreens) ? raw.changedScreens : []) {
    const slug = cleanSlug(c);
    if (slugs.has(slug) && !changed.includes(slug)) changed.push(slug);
  }
  return { screens, coverage: parseCoverage(raw.coverage, items, screens), unplaced: parseUnplaced(raw.unplaced, items), changedScreens: changed, outOfRemit };
}

// ── Coverage check ───────────────────────────────────────────────────────────

// "Running it" rows (hosting, support, training) describe how the system is
// run, not a screen, so a Must there cannot gate the plan; it still appears in
// the items list and may be noted as unplaced.
const GATED_CATEGORIES: readonly RequirementCategory[] = ["Feature", "AI idea", "Integration", "Guardrail"];

/** The items whose absence from the map sends the plan back once: every role and every Must row that is a screen's business. */
export function gatingItems(items: readonly CoverageItem[]): CoverageItem[] {
  return items.filter((i) => i.kind === "role" || (i.pri === "Must" && !!i.cat && GATED_CATEGORIES.includes(i.cat)));
}

export interface CoverageCheck {
  ok: boolean;
  /** One plain line per missing gating item, for the gap round. */
  gaps: string[];
  /** The plan with every unmapped Should row noted in `unplaced` (they do not gate). */
  plan: PrototypePlan;
}

export function checkPlanCoverage(plan: PrototypePlan, items: readonly CoverageItem[]): CoverageCheck {
  const mapped = new Set(plan.coverage.map((c) => c.id));
  const gaps = gatingItems(items)
    .filter((i) => !mapped.has(i.id))
    .map((i) => (i.kind === "role" ? `${i.id} (role): ${i.label} has no screen` : `${i.id} (${i.pri}): ${i.label} is not placed on any screen`));
  const unplaced = plan.unplaced.slice();
  for (const item of items) {
    if (item.kind !== "requirement" || item.pri !== "Should" || mapped.has(item.id)) continue;
    if (unplaced.some((u) => u.id === item.id)) continue;
    unplaced.push({ id: item.id, reason: "not placed" });
  }
  return { ok: gaps.length === 0, gaps, plan: { ...plan, unplaced } };
}

// ── Diffs ────────────────────────────────────────────────────────────────────

export interface PlanDiffResult {
  plan: PrototypePlan;
  /** Slugs the planner changed, plus any slug added or removed. */
  changed: string[];
  outOfRemit: OutOfRemit;
}

/** The accepted requests of the current plan, plus the new one when given. */
export function carryAccepted(current: PrototypePlan, request?: AcceptedRequest | null): AcceptedRequest[] {
  return request ? [...current.accepted, request] : current.accepted.slice();
}

/**
 * The updated plan from a diff answer: version plus one, the accepted
 * requests carried forward (with the new one), the review lists kept, and
 * the changed set as the planner's list intersected with the planned slugs
 * plus every slug that was added or removed.
 */
export function applyPlanDiff(current: PrototypePlan, answer: PlanDiffAnswer, meta: { builtFrom: string; model: string; builtAt?: string }, request?: AcceptedRequest | null): PlanDiffResult {
  if (answer.outOfRemit.refused) return { plan: current, changed: [], outOfRemit: answer.outOfRemit };
  const before = new Set(current.screens.map((s) => s.slug));
  const after = new Set(answer.screens.map((s) => s.slug));
  const changed = answer.changedScreens.filter((s) => after.has(s));
  for (const slug of after) if (!before.has(slug) && !changed.includes(slug)) changed.push(slug);
  for (const slug of before) if (!after.has(slug) && !changed.includes(slug)) changed.push(slug);
  const plan: PrototypePlan = {
    version: current.version + 1,
    builtFrom: meta.builtFrom,
    builtAt: meta.builtAt ?? new Date().toISOString(),
    model: meta.model,
    screens: answer.screens,
    coverage: answer.coverage,
    unplaced: answer.unplaced,
    accepted: carryAccepted(current, request),
    reviewApplied: current.reviewApplied.slice(),
    reviewSuggested: current.reviewSuggested.slice(),
  };
  return { plan, changed, outOfRemit: answer.outOfRemit };
}

/**
 * What a change request's diff means for the build: declined when the
 * planner refused it, unchanged when it accepted it but no screen changed
 * (nothing to build, so no new version is stored), else changed.
 */
export function diffOutcome(diff: Pick<PlanDiffResult, "changed" | "outOfRemit">): "declined" | "unchanged" | "changed" {
  if (diff.outOfRemit.refused) return "declined";
  return diff.changed.length === 0 ? "unchanged" : "changed";
}

export interface RebuildSet {
  slugs: string[];
  whole: boolean;
}

/**
 * Which screens a diff rebuilds: every screen when the first screen
 * changed, when more than half changed, or when any screen was added or
 * removed against the previous plan; otherwise exactly the changed ones.
 */
export function screensToRebuild(plan: PrototypePlan, changed: readonly string[], previous?: PrototypePlan | null): RebuildSet {
  const slugs = plan.screens.map((s) => s.slug);
  const all = { slugs, whole: true };
  if (slugs.length === 0) return { slugs: [], whole: true };
  if (changed.includes(slugs[0])) return all;
  if (changed.length * 2 > slugs.length) return all;
  if (previous) {
    const before = previous.screens.map((s) => s.slug);
    if (before.length !== slugs.length || before.some((s) => !slugs.includes(s))) return all;
  } else if (changed.some((c) => !slugs.includes(c))) {
    return all;
  }
  return { slugs: slugs.filter((s) => changed.includes(s)), whole: false };
}

/** The items the plan mapped to one screen, as plain lines for that screen's build call. */
export function screenItemLines(plan: PrototypePlan, slug: string, items: readonly CoverageItem[]): string[] {
  const lines: string[] = [];
  for (const entry of plan.coverage) {
    if (entry.screen !== slug) continue;
    const item = items.find((i) => i.id === entry.id);
    if (!item) continue;
    const where = entry.component ? ` (on: ${entry.component})` : "";
    lines.push(item.kind === "role" ? `User type: ${item.label}${where}` : `${item.pri}: ${item.label}${where}`);
  }
  return lines;
}
