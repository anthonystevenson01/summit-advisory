/**
 * The "Prototype so far" model: the prototype relevant snapshot of a brief,
 * its hash, the readiness check, the change lines between two snapshots, the
 * large change rule, the website the house style is read from, the shared
 * constants and the stored and served record shapes. Pure and client safe:
 * the page, the route, the admin pages and the tests read one definition, so
 * "up to date" means the same thing in the browser and on the server.
 */
import { CAPABILITIES, FEATURES, type FeatureKey } from "./catalogue.ts";
import { isFreeMailAddress, normaliseDomain, type BriefState } from "./brief.ts";
import { PROTOTYPE } from "./copy.ts";
import { validateWebsiteUrl } from "../ask-summit/validation.ts";
import type { HouseStyle, StyleSource } from "./house-style.ts";

export type { StyleSource };

// ── Constants ────────────────────────────────────────────────────────────────

/** The one sandbox value every prototype frame uses: scripts run, nothing else. */
export const PROTOTYPE_SANDBOX = "allow-scripts";
/** `?b=..&t=..&view=prototype` opens the builder with the prototype tab open. */
export const PROTOTYPE_VIEW_PARAM = "view";
export const PROTOTYPE_VIEW_VALUE = "prototype";
/** The stored document, without the logo, after the safety pass. */
export const PROTOTYPE_HTML_MAX_CHARS = 90_000;
/** The screen count the planner is asked for and the validator checks. */
export const PROTOTYPE_SCREENS_MIN = 3;
export const PROTOTYPE_SCREENS_MAX = 5;
/** This many change lines or more and an update replans from scratch rather than diffing the plan. */
export const LARGE_CHANGE_LINES = 12;
/**
 * The five routing keys of the staged build, one per stage; llm.ts resolves
 * each to a model. Round 1 and 2 records carry the legacy key, kept only so
 * the admin page can say how an old record was made.
 */
export const PROTOTYPE_ROUTING_KEYS = {
  research: "builder-prototype-research",
  plan: "builder-prototype-plan",
  review: "builder-prototype-review",
  build: "builder-prototype-build",
  audit: "builder-prototype-audit",
} as const;
export const LEGACY_PROTOTYPE_ROUTING_KEY = "builder-prototype";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * The prototype relevant parts of a brief, normalised. Stored with each
 * prototype so the next update can describe what changed, and hashed to
 * decide whether the prototype is up to date.
 */
export interface PrototypeSnapshot {
  name: string;
  idea: string;
  path: string;
  problem: string;
  audience: string;
  success: string;
  roles: string[];
  features: string[];
  custom: Array<{ text: string; pri: string; cat: string }>;
  integrations: string[];
  intOther: string;
  sso: boolean;
  perms: boolean;
  audit: boolean;
  personal: boolean;
  compliance: string[];
  scale: string;
  uptime: string;
  run: string;
  handover: string[];
  ideas: Array<{ title: string; what: string; pri: string }>;
  rep: { sys: string; caps: string[]; extra: string[]; reasons: string[] };
  notes: string;
  website: string;
}

/**
 * How the stored prototype was last produced. `edited` only appears on
 * Round 1 and 2 records; `requested` is a change request from the prospect.
 */
export type PrototypeMode = "created" | "edited" | "rebuilt" | "requested";

/** The stages of a press, in the order they run. */
export type PrototypeStageName = "research" | "plan" | "gap" | "review" | "build" | "audit";

/** One stage of a press, kept on the stored record. `model` is empty when the call failed. */
export interface PrototypeStage {
  stage: PrototypeStageName;
  model: string;
  ms: number;
  ok: boolean;
}

/** One screen's build in a press: the model, the time, whether the check made it retry and whether a previous build was kept. */
export interface PrototypeScreenBuild {
  slug: string;
  model: string;
  ms: number;
  retried: boolean;
  kept: boolean;
  /** Design check lines still present after the retry; the screen was accepted with them. Absent on records built before the design rules round and on clean screens. */
  notes?: string[];
}

/** The three parts a screen call returns, kept per screen so a later press can rebuild only the screens that changed. */
export interface ScreenBuild {
  html: string;
  css: string;
  js: string;
}

/** One requirement the audit found no screen for. */
export interface AuditMissing {
  id: string;
  label: string;
  pri: string;
  note: string;
}

/** The audit's answer, stored on the record and shown on the admin page only. */
export interface PrototypeAudit {
  missing: AuditMissing[];
  checkedAt: string;
  model: string;
}

/**
 * What `brief-prototype:{id}` holds. `html` carries the `{{LOGO}}`
 * placeholder, never the logo bytes. Records from Rounds 1 and 2 lack the
 * fields after `styleHost`; `getBriefPrototype` fills them with defaults and
 * `planVersion: 0` tells the run there is no plan to diff against.
 */
export interface PrototypeRecord {
  html: string;
  hash: string;
  snapshot: PrototypeSnapshot;
  createdAt: string;
  updatedAt: string;
  version: number;
  lastMode: PrototypeMode;
  model: string;
  routingKey: string;
  styleHost: string | null;
  planVersion: number;
  screens: PrototypeScreenBuild[];
  screenBuilds: Record<string, ScreenBuild>;
  stages: PrototypeStage[];
  audit: PrototypeAudit | null;
}

/** found: a logo and a colour or font; partial: some of the look; none: the neutral style. */
export type StyleStatus = "found" | "partial" | "none";

/**
 * What the browser gets: the served document with the logo in place.
 * `planVersion` is 0 for a record made before the staged build, so the page
 * knows a change request needs an Update first; it is one number, not
 * anything from the hidden pipeline.
 */
export interface PrototypeView {
  html: string;
  hash: string;
  updatedAt: string;
  version: number;
  planVersion: number;
  styleStatus: StyleStatus;
  styleNote: string;
}

// ── Snapshot and hash ────────────────────────────────────────────────────────

function clean(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

/** The contact fields that can decide which website the house style is read from. */
export type PrototypeContact = { email?: string; website?: string } | null | undefined;

/**
 * The fields that change what the screens show, normalised and in a fixed
 * key order. `website` is the resolved house style host (Step 1, else the
 * contact website, else a company email domain), so a new website from any
 * of those marks the prototype out of date and the style is read again.
 */
export function prototypeSnapshot(state: BriefState, contact?: PrototypeContact): PrototypeSnapshot {
  const features = Object.entries(state.features)
    .filter(([, pri]) => Boolean(pri))
    .map(([key, pri]) => `${key}:${pri}`)
    .sort();
  const ideas = state.ideas
    .filter((idea) => {
      const pick = state.ideaPick[idea.id];
      return Boolean(pick) && pick !== "no";
    })
    .map((idea) => ({ title: clean(idea.title), what: clean(idea.what), pri: String(state.ideaPick[idea.id]) }));
  return {
    name: clean(state.name),
    idea: clean(state.idea),
    path: state.path,
    problem: clean(state.problem),
    audience: clean(state.audience),
    success: clean(state.success),
    roles: sorted(state.roles.map(clean)),
    features,
    custom: state.custom.map((c) => ({ text: clean(c.text), pri: c.pri, cat: c.cat })),
    integrations: sorted(state.integrations),
    intOther: clean(state.intOther),
    sso: state.sso,
    perms: state.perms,
    audit: state.audit,
    personal: state.personal,
    compliance: sorted(state.compliance),
    scale: state.scale,
    uptime: state.uptime,
    run: state.run,
    handover: sorted(state.handover),
    ideas,
    rep: {
      sys: clean(state.rep.sys),
      caps: Object.entries(state.rep.caps).map(([key, pri]) => `${key}:${pri}`).sort(),
      extra: Object.keys(state.rep.extra).sort().map((key) => clean(state.rep.extra[key].title)),
      reasons: sorted(state.rep.reasons),
    },
    notes: clean(state.biz.notes),
    website: resolvePrototypeWebsite(state, contact)?.host ?? "",
  };
}

/** cyrb53: a small 53 bit string hash, pure JS so the browser computes it synchronously. */
function cyrb53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** `p1-` and 14 hex characters over the canonical JSON of the snapshot. */
export function prototypeHash(state: BriefState, contact?: PrototypeContact): string {
  return snapshotHash(prototypeSnapshot(state, contact));
}

/** The hash of a stored snapshot, used by the run so the record and the up to date check agree. */
export function snapshotHash(snapshot: PrototypeSnapshot): string {
  return `p1-${cyrb53(JSON.stringify(snapshot)).toString(16).padStart(14, "0")}`;
}

// ── Readiness ────────────────────────────────────────────────────────────────

/** What a brief still needs before a prototype can be drawn. */
export type ReadinessGap = "description" | "goalOrFeature";

export interface PrototypeReadiness {
  ready: boolean;
  missing: ReadinessGap[];
}

/** A description (the idea, business notes or the system being replaced) and a goal or a feature. */
export function prototypeReadiness(state: BriefState): PrototypeReadiness {
  const missing: ReadinessGap[] = [];
  const hasDescription = Boolean(state.idea.trim() || state.biz.notes.trim() || (state.path === "replace" && state.rep.sys.trim()));
  const hasGoalOrFeature = Boolean(
    state.problem.trim() ||
      state.success.trim() ||
      Object.values(state.features).some(Boolean) ||
      state.custom.some((c) => c.cat === "Feature") ||
      state.ideas.some((idea) => {
        const pick = state.ideaPick[idea.id];
        return Boolean(pick) && pick !== "no";
      }) ||
      Object.keys(state.rep.caps).length > 0,
  );
  if (!hasDescription) missing.push("description");
  if (!hasGoalOrFeature) missing.push("goalOrFeature");
  return { ready: missing.length === 0, missing };
}

/** The one plain sentence that says what is still needed; empty when ready. */
export function readinessLine(missing: readonly ReadinessGap[]): string {
  if (missing.length === 0) return "";
  if (missing.length > 1) return PROTOTYPE.needs.both;
  return PROTOTYPE.needs[missing[0]];
}

// ── Changes ──────────────────────────────────────────────────────────────────

const FEATURE_TITLES = new Map<string, string>(FEATURES.map((f) => [f.key, f.title]));

function featureTitle(key: string): string {
  return FEATURE_TITLES.get(key as FeatureKey) ?? key;
}

function capTitle(key: string): string {
  return (CAPABILITIES as Record<string, { title: string }>)[key]?.title ?? key;
}

function pairs(list: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const item of list) {
    const at = item.lastIndexOf(":");
    out.set(item.slice(0, at), item.slice(at + 1));
  }
  return out;
}

function diffPairs(before: readonly string[], after: readonly string[], noun: string, title: (key: string) => string, lines: string[]): void {
  const a = pairs(before);
  const b = pairs(after);
  for (const [key, pri] of b) {
    if (!a.has(key)) lines.push(`Added ${noun}: ${title(key)} (${pri})`);
    else if (a.get(key) !== pri) lines.push(`Changed priority: ${title(key)} from ${a.get(key)} to ${pri}`);
  }
  for (const key of a.keys()) if (!b.has(key)) lines.push(`Removed ${noun}: ${title(key)}`);
}

function diffList(before: readonly string[], after: readonly string[], noun: string, lines: string[]): void {
  for (const item of after) if (!before.includes(item)) lines.push(`Added ${noun}: ${item}`);
  for (const item of before) if (!after.includes(item)) lines.push(`Removed ${noun}: ${item}`);
}

function diffText(before: string, after: string, label: string, lines: string[], quote = false): void {
  if (before === after) return;
  if (!after) lines.push(`${label} removed`);
  else if (quote) lines.push(`${label} is now ${after}`);
  else lines.push(`${label} changed`);
}

function diffFlag(before: boolean, after: boolean, label: string, lines: string[]): void {
  if (before === after) return;
  lines.push(after ? `Added guardrail: ${label}` : `Removed guardrail: ${label}`);
}

/** Plain lines describing what changed between two snapshots; empty when equal. Used in the edit prompt. */
export function describeChanges(before: PrototypeSnapshot, after: PrototypeSnapshot): string[] {
  const lines: string[] = [];
  diffText(before.path, after.path, "Starting point", lines, true);
  diffText(before.name, after.name, "Project name", lines, true);
  diffText(before.idea, after.idea, "Project description", lines);
  diffText(before.problem, after.problem, "Problem", lines);
  diffText(before.audience, after.audience, "Who has the problem", lines, true);
  diffText(before.success, after.success, "Success measure", lines);
  diffList(before.roles, after.roles, "user type", lines);
  diffPairs(before.features, after.features, "feature", featureTitle, lines);
  const customKey = (c: { text: string; cat: string }) => `${c.cat}|${c.text}`;
  const beforeCustom = new Map(before.custom.map((c) => [customKey(c), c.pri]));
  const afterCustom = new Map(after.custom.map((c) => [customKey(c), c.pri]));
  for (const c of after.custom) {
    const was = beforeCustom.get(customKey(c));
    if (was === undefined) lines.push(`Added requirement: ${c.text} (${c.pri})`);
    else if (was !== c.pri) lines.push(`Changed priority: ${c.text} from ${was} to ${c.pri}`);
  }
  for (const c of before.custom) if (!afterCustom.has(customKey(c))) lines.push(`Removed requirement: ${c.text}`);
  diffList(before.integrations, after.integrations, "connection", lines);
  diffText(before.intOther, after.intOther, "Other connections", lines, true);
  diffFlag(before.sso, after.sso, "Single sign-on", lines);
  diffFlag(before.perms, after.perms, "Roles and permissions", lines);
  diffFlag(before.audit, after.audit, "Audit trail", lines);
  diffFlag(before.personal, after.personal, "Handles personal data", lines);
  diffList(before.compliance, after.compliance, "standard", lines);
  diffText(before.scale, after.scale, "Number of users", lines, true);
  diffText(before.uptime, after.uptime, "Hours it needs to be up", lines, true);
  diffText(before.run, after.run, "Who runs it", lines, true);
  diffList(before.handover, after.handover, "handover item", lines);
  const ideaKey = (i: { title: string }) => i.title;
  const beforeIdeas = new Map(before.ideas.map((i) => [ideaKey(i), i.pri]));
  const afterIdeas = new Map(after.ideas.map((i) => [ideaKey(i), i.pri]));
  for (const i of after.ideas) {
    const was = beforeIdeas.get(ideaKey(i));
    if (was === undefined) lines.push(`Added AI idea: ${i.title} (${i.pri})`);
    else if (was !== i.pri) lines.push(`Changed priority: ${i.title} from ${was} to ${i.pri}`);
  }
  for (const i of before.ideas) if (!afterIdeas.has(ideaKey(i))) lines.push(`Removed AI idea: ${i.title}`);
  diffText(before.rep.sys, after.rep.sys, "System being replaced", lines, true);
  diffPairs(before.rep.caps, after.rep.caps, "capability", capTitle, lines);
  diffList(before.rep.extra, after.rep.extra, "capability", lines);
  diffList(before.rep.reasons, after.rep.reasons, "reason to switch", lines);
  diffText(before.notes, after.notes, "Business notes", lines);
  diffText(before.website, after.website, "Website", lines, true);
  return lines;
}

/** A rebuild beats an edit when there is no snapshot, the path, idea or website moved, or the list of changes is long. */
export function isLargeChange(before: PrototypeSnapshot | null | undefined, after: PrototypeSnapshot): boolean {
  if (!before) return true;
  if (before.path !== after.path || before.idea !== after.idea || before.website !== after.website) return true;
  return describeChanges(before, after).length >= LARGE_CHANGE_LINES;
}

// ── Website ──────────────────────────────────────────────────────────────────

/** The website the house style is read from: a normalised https URL and its host. */
export interface PrototypeWebsite {
  url: string;
  host: string;
}

/** Step 1's website, then the contact's, then a company email domain; each must pass the crawler's host rule. */
export function resolvePrototypeWebsite(state: BriefState, contact: PrototypeContact): PrototypeWebsite | null {
  const candidates: Array<string | null> = [normaliseDomain(state.biz.website), normaliseDomain(contact?.website ?? "")];
  const email = contact?.email?.trim() ?? "";
  const at = email.lastIndexOf("@");
  if (at > 0 && !isFreeMailAddress(email)) candidates.push(normaliseDomain(email.slice(at + 1)));
  for (const domain of candidates) {
    if (!domain) continue;
    const checked = validateWebsiteUrl(`https://${domain}/`);
    if (checked.ok) return { url: `https://${domain}/`, host: domain };
  }
  return null;
}

/** The one line the dock shows about where the prototype's look came from: the website, Brandfetch, both, or a plain style and why. */
export function styleNoteFor(style: Pick<HouseStyle, "status" | "reason" | "source" | "brandLookup"> | null): string {
  if (!style) return PROTOTYPE.unreadable;
  const suffix = style.status === "partial" ? PROTOTYPE.stillMissing : "";
  switch (style.source) {
    case "site":
      return style.status === "found" ? PROTOTYPE.fromSite : PROTOTYPE.partial;
    case "site+brand":
      return PROTOTYPE.siteAndBrand + suffix;
    case "brand":
      return PROTOTYPE.fromBrand + suffix;
    default:
      if (style.reason === "no-website") return PROTOTYPE.noSite;
      if (style.reason === "nothing-usable") return PROTOTYPE.nothingUsable;
      if (style.brandLookup === "miss" || style.brandLookup === "cached-miss" || style.brandLookup === "error") return PROTOTYPE.noSiteNoBrand;
      return PROTOTYPE.unreadable;
  }
}

// ── The button ───────────────────────────────────────────────────────────────

/** "6 November, 14:05" in the viewer's time zone. */
export function formatPrototypeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export interface PrototypeButtonInput {
  state: BriefState;
  contact: PrototypeContact;
  prototype: Pick<PrototypeView, "hash" | "updatedAt"> | null;
  saved: boolean;
  locked: boolean;
  busy: boolean;
  runsLeft: number;
}

export interface PrototypeButtonState {
  /** False on a submitted brief: there is no button. */
  show: boolean;
  /** "Create prototype" until one exists, then "Update prototype". */
  label: string;
  enabled: boolean;
  /** Why it is disabled, or what pressing it will do; shown in the tab and as the button's description. */
  line: string;
  /** The stored prototype was drawn from the brief as it is now. */
  current: boolean;
}

/** The one Create or Update button, first match wins: locked, busy, not ready, up to date, out of runs, unsaved, ready. */
export function prototypeButtonState(input: PrototypeButtonInput): PrototypeButtonState {
  const { prototype } = input;
  const current = prototype !== null && prototype.hash === prototypeHash(input.state, input.contact);
  const label = prototype ? PROTOTYPE.update : PROTOTYPE.create;
  const last = prototype ? PROTOTYPE.lastUpdated(formatPrototypeTime(prototype.updatedAt)) : "";
  const base = { label, current };
  if (input.locked) return { ...base, show: false, enabled: false, line: "" };
  if (input.busy) return { ...base, show: true, enabled: false, line: "" };
  const readiness = prototypeReadiness(input.state);
  if (!readiness.ready) return { ...base, show: true, enabled: false, line: readinessLine(readiness.missing) };
  if (current) return { ...base, show: true, enabled: false, line: `${PROTOTYPE.upToDate}. ${last}.` };
  if (input.runsLeft <= 0) return { ...base, show: true, enabled: false, line: PROTOTYPE.cap };
  if (!input.saved) return { ...base, show: true, enabled: true, line: PROTOTYPE.saveFirst };
  return { ...base, show: true, enabled: true, line: last ? `${last}.` : "" };
}

/** The tab's line when there is no prototype: what is still needed, or where the button is. */
export function prototypeEmptyLine(state: BriefState): string {
  return prototypeReadiness(state).ready ? PROTOTYPE.emptyReady : PROTOTYPE.empty;
}
