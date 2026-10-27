/**
 * The brief state, its validator, the contact, the statuses and the small
 * normalisers the builder shares between the page and the server. Pure:
 * imports the catalogue and the email regex only, reads no env, touches no
 * Redis or network, so both the client component and the routes use one
 * definition of "a valid brief".
 *
 * `parseBriefState` is the one way a state enters the server from a request
 * body or the browser from localStorage: it returns a complete state with
 * every field coerced to its type and capped at its size, drops unknown
 * keys and throws `BriefStateError` only when the value cannot be a state
 * at all (not an object). A missing field takes its default, so an entry
 * written by an earlier deploy still loads.
 */
import {
  BUDGET_OPTIONS,
  COMPLIANCE,
  FEATURES,
  HANDOVER,
  IDEA_KINDS,
  IDEA_SIZES,
  INTEGRATIONS,
  PATHS,
  PRIORITIES,
  REPLACEMENT_REASONS,
  RESIDENCY_OPTIONS,
  RUN_OPTIONS,
  SCALE_OPTIONS,
  SOURCE_KEYS,
  TIMING_OPTIONS,
  UPTIME_OPTIONS,
  type FeatureKey,
  type HandoverKey,
  type IdeaKind,
  type IdeaSize,
  type PathKey,
  type Priority,
  type RunKey,
  type SourceKey,
} from "./catalogue.ts";
import { EMAIL_REGEX } from "../tools/validate.ts";

// ── Constants ────────────────────────────────────────────────────────────────

export const BRIEF_ID_PATTERN = /^brief_[0-9a-f]{16}$/;
export const BRIEF_LINK_PURPOSE = "brief-link";
export const BRIEF_DELETE_PURPOSE = "brief-delete";
export const BRIEF_LINK_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const BRIEF_DRAFT_TTL_SECONDS = 183 * 24 * 60 * 60;
export const BRIEF_SOURCE_TTL_SECONDS = 90 * 24 * 60 * 60;
export const SOURCE_MAX_CHARS = 60_000;
export const SUGGEST_CAP_PER_BRIEF = 30;
export const IDEAS_CAP_PER_BRIEF = 3;
export const READS_PER_IP_PER_DAY = 5;
export const BUILDER_DAILY_CAP = 200;

export const SUGGEST_STEPS = ["goal", "features", "connections", "guardrails", "running"] as const;
export type SuggestStep = (typeof SUGGEST_STEPS)[number];

export function isSuggestStep(value: unknown): value is SuggestStep {
  return typeof value === "string" && (SUGGEST_STEPS as readonly string[]).includes(value);
}

export function isBriefId(value: unknown): value is string {
  return typeof value === "string" && BRIEF_ID_PATTERN.test(value);
}

// ── State ────────────────────────────────────────────────────────────────────

export type CustomCategory = "Feature" | "Running it";

export interface CustomRequirement {
  text: string;
  pri: Priority;
  cat: CustomCategory;
  src: SourceKey;
  built: boolean;
}

export interface Idea {
  id: string;
  title: string;
  what: string;
  buildsOn: string;
  kind: IdeaKind;
  size: IdeaSize;
  helps: string;
  human: boolean;
}

export interface ExtraCapability {
  title: string;
  requirement: string;
}

export interface ReplaceState {
  cat: string;
  sys: string;
  other: string;
  caps: Record<string, Priority>;
  extra: Record<string, ExtraCapability>;
  reasons: string[];
  migrate: boolean;
  parallel: boolean;
}

export interface BusinessState {
  website: string;
  notes: string;
}

export interface BriefState {
  step: number;
  path: PathKey | "";
  idea: string;
  name: string;
  problem: string;
  audience: string;
  success: string;
  signoff: string;
  timing: string;
  budget: string;
  residency: string;
  scale: string;
  uptime: string;
  roles: string[];
  features: Partial<Record<FeatureKey, Priority>>;
  featSrc: Partial<Record<FeatureKey, SourceKey>>;
  custom: CustomRequirement[];
  integrations: string[];
  intSrc: Record<string, SourceKey>;
  intOther: string;
  sso: boolean;
  perms: boolean;
  audit: boolean;
  personal: boolean;
  compliance: string[];
  run: RunKey | "";
  skills: string;
  handover: HandoverKey[];
  ideas: Idea[];
  ideaPick: Record<string, Priority | "no">;
  ideasKey: string;
  ideaSeq: number;
  unplaced: string[];
  rep: ReplaceState;
  biz: BusinessState;
}

export class BriefStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefStateError";
  }
}

export function blank(): BriefState {
  return {
    step: 0,
    path: "",
    idea: "",
    name: "",
    problem: "",
    audience: "",
    success: "",
    signoff: "",
    timing: "No fixed date",
    budget: "Not set yet",
    residency: "No preference",
    scale: "",
    uptime: "",
    roles: [],
    features: {},
    featSrc: {},
    custom: [],
    integrations: [],
    intSrc: {},
    intOther: "",
    sso: false,
    perms: false,
    audit: false,
    personal: false,
    compliance: [],
    run: "",
    skills: "",
    handover: [],
    ideas: [],
    ideaPick: {},
    ideasKey: "",
    ideaSeq: 0,
    unplaced: [],
    rep: { cat: "", sys: "", other: "", caps: {}, extra: {}, reasons: [], migrate: true, parallel: false },
    biz: { website: "", notes: "" },
  };
}

// ── Caps ─────────────────────────────────────────────────────────────────────

const LONG = 4_000;
const SHORT = 300;
const CUSTOM_TEXT = 500;
const ROLE_LENGTH = 60;
const MAX_ROLES = 20;
const MAX_CUSTOM = 60;
const MAX_IDEAS = 18;
const MAX_UNPLACED = 20;
const MAX_INTEGRATION_LABELS = 20;
const MAX_CAPS = 60;
const MAX_IDEA_SEQ = 10_000;

const FEATURE_KEYS = new Set<string>(FEATURES.map((f) => f.key));
const PATH_KEYS = new Set<string>(PATHS.map((p) => p.key));
const RUN_KEYS = new Set<string>(RUN_OPTIONS.map((r) => r.key));
const HANDOVER_KEYS = new Set<string>(HANDOVER.map((h) => h.key));
const REASON_KEYS = new Set<string>(Object.keys(REPLACEMENT_REASONS));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, cap: number): string {
  return typeof value === "string" ? value.slice(0, cap) : "";
}

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

function oneOf(value: unknown, options: readonly string[], fallback: string): string {
  return typeof value === "string" && options.includes(value) ? value : fallback;
}

function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

function isSourceKey(value: unknown): value is SourceKey {
  return typeof value === "string" && (SOURCE_KEYS as readonly string[]).includes(value);
}

/** The prototype's `user` becomes `you` and `replace` becomes `system`. */
function sourceOf(value: unknown): SourceKey {
  if (value === "user") return "you";
  if (value === "replace") return "system";
  return isSourceKey(value) ? value : "you";
}

function stringList(value: unknown, max: number, each: number, allowed?: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim().slice(0, each);
    if (!text || out.includes(text)) continue;
    if (allowed && !allowed.includes(text)) continue;
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function parseFeatures(value: unknown): Partial<Record<FeatureKey, Priority>> {
  const out: Partial<Record<FeatureKey, Priority>> = {};
  if (!isRecord(value)) return out;
  for (const [key, pri] of Object.entries(value)) {
    if (FEATURE_KEYS.has(key) && isPriority(pri)) out[key as FeatureKey] = pri;
  }
  return out;
}

function parseFeatSrc(value: unknown, features: Partial<Record<FeatureKey, Priority>>): Partial<Record<FeatureKey, SourceKey>> {
  const out: Partial<Record<FeatureKey, SourceKey>> = {};
  if (!isRecord(value)) return out;
  for (const [key, src] of Object.entries(value)) {
    if (FEATURE_KEYS.has(key) && key in features && isSourceKey(src)) out[key as FeatureKey] = src;
  }
  return out;
}

function parseCustom(value: unknown): CustomRequirement[] {
  if (!Array.isArray(value)) return [];
  const out: CustomRequirement[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.text !== "string") continue;
    const text = item.text.trim().slice(0, CUSTOM_TEXT);
    if (!text) continue;
    out.push({
      text,
      pri: isPriority(item.pri) ? item.pri : "Should",
      cat: item.cat === "Running it" ? "Running it" : "Feature",
      src: sourceOf(item.src),
      built: bool(item.built),
    });
    if (out.length >= MAX_CUSTOM) break;
  }
  return out;
}

function parseIntSrc(value: unknown, integrations: string[]): Record<string, SourceKey> {
  const out: Record<string, SourceKey> = {};
  if (!isRecord(value)) return out;
  for (const [label, src] of Object.entries(value)) {
    if (integrations.includes(label) && isSourceKey(src)) out[label] = src;
  }
  return out;
}

function parseIdeas(value: unknown): Idea[] {
  if (!Array.isArray(value)) return [];
  const out: Idea[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || !/^i\d{1,6}$/.test(item.id)) continue;
    if (seen.has(item.id)) continue;
    const title = str(item.title, SHORT).trim();
    const what = str(item.what, LONG).trim();
    if (!title || !what) continue;
    seen.add(item.id);
    out.push({
      id: item.id,
      title,
      what,
      buildsOn: str(item.buildsOn, SHORT).trim(),
      kind: oneOf(item.kind, IDEA_KINDS, "Automate a step") as IdeaKind,
      size: oneOf(item.size, IDEA_SIZES, "Moderate") as IdeaSize,
      helps: str(item.helps, LONG).trim(),
      human: bool(item.human),
    });
    if (out.length >= MAX_IDEAS) break;
  }
  return out;
}

function parseIdeaPick(value: unknown, ideas: Idea[]): Record<string, Priority | "no"> {
  const out: Record<string, Priority | "no"> = {};
  if (!isRecord(value)) return out;
  const ids = new Set(ideas.map((i) => i.id));
  for (const [id, pick] of Object.entries(value)) {
    if (!ids.has(id)) continue;
    if (isPriority(pick) || pick === "no") out[id] = pick;
  }
  return out;
}

function parseRep(value: unknown): ReplaceState {
  const base = blank().rep;
  if (!isRecord(value)) return base;
  const caps: Record<string, Priority> = {};
  if (isRecord(value.caps)) {
    for (const [key, pri] of Object.entries(value.caps)) {
      if (/^[a-z0-9]{1,30}$/.test(key) && isPriority(pri)) caps[key] = pri;
      if (Object.keys(caps).length >= MAX_CAPS) break;
    }
  }
  const extra: Record<string, ExtraCapability> = {};
  if (isRecord(value.extra)) {
    for (const [key, cap] of Object.entries(value.extra)) {
      if (!/^x[0-8]$/.test(key)) continue;
      // Accept the prototype's two element array as well as the object.
      const title = Array.isArray(cap) ? str(cap[0], SHORT) : isRecord(cap) ? str(cap.title, SHORT) : "";
      const requirement = Array.isArray(cap) ? str(cap[1], CUSTOM_TEXT) : isRecord(cap) ? str(cap.requirement, CUSTOM_TEXT) : "";
      if (title.trim() && requirement.trim()) extra[key] = { title: title.trim(), requirement: requirement.trim() };
    }
  }
  return {
    cat: str(value.cat, SHORT),
    sys: str(value.sys, SHORT),
    other: str(value.other, SHORT),
    caps,
    extra,
    reasons: stringList(value.reasons, REASON_KEYS.size, SHORT, [...REASON_KEYS]),
    migrate: value.migrate === undefined ? base.migrate : bool(value.migrate),
    parallel: bool(value.parallel),
  };
}

/**
 * A complete, capped state from anything shaped like one. Throws
 * `BriefStateError` for a non object; everything else is coerced.
 */
export function parseBriefState(raw: unknown): BriefState {
  if (!isRecord(raw)) throw new BriefStateError("brief state is not an object");
  const base = blank();
  const stepRaw = typeof raw.step === "number" ? raw.step : Number(raw.step);
  const step = Number.isInteger(stepRaw) && stepRaw >= 0 && stepRaw <= 5 ? stepRaw : 0;
  const features = parseFeatures(raw.features);
  const integrations = stringList(raw.integrations, MAX_INTEGRATION_LABELS, SHORT, INTEGRATIONS);
  const ideas = parseIdeas(raw.ideas);
  const biz = isRecord(raw.biz) ? raw.biz : {};
  const ideaSeqRaw = typeof raw.ideaSeq === "number" ? raw.ideaSeq : Number(raw.ideaSeq);
  return {
    step,
    path: PATH_KEYS.has(String(raw.path)) ? (raw.path as PathKey) : "",
    idea: str(raw.idea, SHORT),
    name: str(raw.name, SHORT),
    problem: str(raw.problem, LONG),
    audience: str(raw.audience, SHORT),
    success: str(raw.success, LONG),
    signoff: str(raw.signoff, SHORT),
    timing: oneOf(raw.timing, TIMING_OPTIONS, base.timing),
    budget: oneOf(raw.budget, BUDGET_OPTIONS, base.budget),
    residency: oneOf(raw.residency, RESIDENCY_OPTIONS, base.residency),
    scale: oneOf(raw.scale, SCALE_OPTIONS, ""),
    uptime: oneOf(raw.uptime, UPTIME_OPTIONS, ""),
    roles: stringList(raw.roles, MAX_ROLES, ROLE_LENGTH),
    features,
    featSrc: parseFeatSrc(raw.featSrc, features),
    custom: parseCustom(raw.custom),
    integrations,
    intSrc: parseIntSrc(raw.intSrc, integrations),
    intOther: str(raw.intOther, SHORT),
    sso: bool(raw.sso),
    perms: bool(raw.perms),
    audit: bool(raw.audit),
    personal: bool(raw.personal),
    compliance: stringList(raw.compliance, COMPLIANCE.length, SHORT, COMPLIANCE),
    run: RUN_KEYS.has(String(raw.run)) ? (raw.run as RunKey) : "",
    skills: str(raw.skills, SHORT),
    handover: stringList(raw.handover, HANDOVER.length, SHORT, [...HANDOVER_KEYS]) as HandoverKey[],
    ideas,
    ideaPick: parseIdeaPick(raw.ideaPick, ideas),
    ideasKey: str(raw.ideasKey, LONG),
    ideaSeq: Number.isInteger(ideaSeqRaw) && ideaSeqRaw >= 0 && ideaSeqRaw <= MAX_IDEA_SEQ ? ideaSeqRaw : 0,
    unplaced: stringList(raw.unplaced, MAX_UNPLACED, SHORT),
    rep: parseRep(raw.rep),
    biz: { website: str(biz.website, 200), notes: str(biz.notes, LONG) },
  };
}

// ── Statuses ─────────────────────────────────────────────────────────────────

export const BRIEF_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "with-summit", label: "With Summit" },
  { key: "shared", label: "Shared" },
  { key: "approved", label: "Approved" },
  { key: "changes-requested", label: "Changes requested" },
  { key: "quoted", label: "Quoted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

export type BriefStatus = (typeof BRIEF_STATUSES)[number]["key"];

export function isBriefStatus(value: unknown): value is BriefStatus {
  return typeof value === "string" && BRIEF_STATUSES.some((s) => s.key === value);
}

export function statusLabel(status: BriefStatus): string {
  return BRIEF_STATUSES.find((s) => s.key === status)?.label ?? status;
}

/** Everything but a draft is locked: saves and helpers answer 409. */
export function isLocked(status: string): boolean {
  return status !== "draft";
}

/** A prospect may only submit a draft; an admin may move between any two known statuses. */
export function canTransition(from: unknown, to: unknown, actor: "prospect" | "admin"): boolean {
  if (!isBriefStatus(from) || !isBriefStatus(to)) return false;
  if (actor === "prospect") return from === "draft" && to === "submitted";
  return true;
}

// ── Contact ──────────────────────────────────────────────────────────────────

export interface Contact {
  name: string;
  email: string;
  company: string;
  /** The bare lowercase domain. */
  website: string;
  marketing: boolean;
}

export type ContactValidation = { ok: true; contact: Contact } | { ok: false; error: string };

const DOMAIN_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}$/;

/** `acme.com` from `https://www.Acme.com/path?x`; null when nothing domain shaped remains. */
export function normaliseDomain(input: string): string | null {
  const bare = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return DOMAIN_PATTERN.test(bare) ? bare : null;
}

export const FREE_MAIL_DOMAINS: readonly string[] = ["gmail", "googlemail", "hotmail", "outlook", "yahoo", "icloud", "live", "aol", "proton"];

export function isFreeMailAddress(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return FREE_MAIL_DOMAINS.some((d) => domain.startsWith(`${d}.`));
}

export const CONTACT_ERRORS = {
  missing: "Please fill in all four details.",
  email: "That email address doesn't look right.",
  website: "That website doesn't look right. Try something like acme.com.",
} as const;

export function validateContact(raw: unknown): ContactValidation {
  const source = isRecord(raw) ? raw : {};
  const name = str(source.name, 120).trim();
  const email = str(source.email, 254).trim();
  const company = str(source.company, 120).trim();
  const websiteRaw = str(source.website, 300).trim();
  if (!name || !email || !company || !websiteRaw) return { ok: false, error: CONTACT_ERRORS.missing };
  if (!EMAIL_REGEX.test(email)) return { ok: false, error: CONTACT_ERRORS.email };
  const website = normaliseDomain(websiteRaw);
  if (!website) return { ok: false, error: CONTACT_ERRORS.website };
  return { ok: true, contact: { name, email, company, website, marketing: bool(source.marketing) } };
}

// ── Source tag ───────────────────────────────────────────────────────────────

/** Lowercase `[a-z0-9_-]`, at most 40 characters; anything else is "". */
export function normaliseSourceTag(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const tag = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(tag) ? tag : "";
}
