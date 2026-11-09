/**
 * The strict JSON schemas the builder calls send to OpenRouter and the one
 * parser per call (the staged build's parsers live beside their types). Pure: the catalogue and the schema types only.
 *
 * Every schema is `strict: true` with `additionalProperties: false` and
 * every property required at every level, because OpenRouter's strict mode
 * rejects optional properties; an absent value is an empty string, false or
 * an empty array. Enums are built from the catalogue, so the model cannot
 * name a feature, integration, standard, run option, handover item, kind or
 * size the catalogue lacks. The parsers still check every enum (the
 * fallback model may not honour the schema), trim and cap every string,
 * cap every array, and throw `SchemaError` only for a reply that cannot be
 * the shape at all: not an object, or a required array missing.
 */
import { SchemaError, type JsonSchema, type NamedSchema } from "../tools/schema.ts";
import {
  COMPLIANCE,
  FEATURES,
  HANDOVER,
  IDEA_KINDS,
  IDEA_SIZES,
  INTEGRATIONS,
  PRIORITIES,
  RESIDENCY_OPTIONS,
  RUN_OPTIONS,
  SCALE_OPTIONS,
  UPTIME_OPTIONS,
  type FeatureKey,
  type HandoverKey,
  type IdeaKind,
  type IdeaSize,
  type Priority,
  type RunKey,
} from "./catalogue.ts";
import type { SuggestStep } from "./brief.ts";
import { PLAN_COMPONENT_KINDS } from "./plan.ts";

// ── Caps ─────────────────────────────────────────────────────────────────────

export const READ_REQUIREMENTS_CAP = 25;
export const LOOKUP_CAPS_CAP = 9;
export const SUGGEST_ROLES_CAP = 7;
export const SUGGEST_FEATURES_CAP = 7;
export const SUGGEST_REQUIREMENTS_CAP = 3;
export const SUGGEST_OTHER_CAP = 2;
export const IDEAS_CAP = 6;
export const UNPLACED_CAP = 20;

const TEXT = 500;
const LONG = 2_000;

// ── Schema helpers ───────────────────────────────────────────────────────────

const FEATURE_KEYS = FEATURES.map((f) => f.key);
const RESIDENCY_ENUM = RESIDENCY_OPTIONS.filter((r) => r !== "No preference").concat("");
const SCALE_ENUM = SCALE_OPTIONS.slice();
const UPTIME_ENUM = UPTIME_OPTIONS.slice();
const RUN_ENUM: string[] = RUN_OPTIONS.map((r) => String(r.key)).concat("");
const HANDOVER_KEYS = HANDOVER.map((h) => h.key);

function obj(properties: Record<string, JsonSchema>, description?: string): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    ...(description ? { description } : {}),
  };
}

function text(description: string): JsonSchema {
  return { type: "string", description };
}

function strEnum(values: readonly string[], description: string): JsonSchema {
  return { type: "string", enum: [...values], description };
}

function list(items: JsonSchema, description: string): JsonSchema {
  return { type: "array", items, description };
}

function named(name: string, schema: JsonSchema): NamedSchema {
  return { name, strict: true, schema };
}

const PRIORITY_ENUM = strEnum(PRIORITIES, "Must, Should or Could.");

// ── Read ─────────────────────────────────────────────────────────────────────

export interface ReadFeature {
  key: FeatureKey;
  priority: Priority;
}

export interface ReadRequirement {
  text: string;
  priority: Priority;
  alreadyBuilt: boolean;
}

export interface ReadResult {
  name: string;
  problem: string;
  audience: string;
  success: string;
  signoff: string;
  roles: string[];
  features: ReadFeature[];
  requirements: ReadRequirement[];
  integrations: string[];
  guardrails: { sso: boolean; perms: boolean; audit: boolean; personal: boolean; compliance: string[] };
  unplaced: string[];
}

export function readSchema(): NamedSchema {
  return named(
    "builder_read",
    obj({
      name: text("A working title for the project, or empty."),
      problem: text("The problem being solved, one or two sentences in their voice, or empty."),
      audience: text("Who has the problem, or empty."),
      success: text("One measurable outcome with a number and a timeframe when the material gives one, else empty."),
      signoff: text("Who signs off the scope when the material names them, else empty."),
      roles: list(text("A type of user."), "The types of user named or implied."),
      features: list(obj({ key: strEnum(FEATURE_KEYS, "A feature key from the list."), priority: PRIORITY_ENUM }), "Catalogue features the material calls for, with priorities."),
      requirements: list(
        obj({ text: text("One sentence about an outcome."), priority: PRIORITY_ENUM, alreadyBuilt: { type: "boolean", description: "True when the material says this already exists." } }),
        "Requirements the catalogue features do not cover. At most 25.",
      ),
      integrations: list(strEnum(INTEGRATIONS, "A connection label from the list."), "Systems it must connect to, from the list only."),
      guardrails: obj({
        sso: { type: "boolean", description: "Single sign-on is required." },
        perms: { type: "boolean", description: "Access must be controlled by role." },
        audit: { type: "boolean", description: "An audit trail is required." },
        personal: { type: "boolean", description: "It handles personal data." },
        compliance: list(strEnum(COMPLIANCE, "A standard from the list."), "Standards it must meet, from the list only."),
      }),
      unplaced: list(text("A line from the material, as written."), "Lines that matter but could not be placed anywhere above. At most 20."),
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, cap: number): string {
  return typeof value === "string" ? value.trim().slice(0, cap) : "";
}

function cleanStrings(value: unknown, cap: number, each: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = cleanString(item, each);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

function enumStrings(value: unknown, allowed: readonly string[], cap: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && allowed.includes(item) && !out.includes(item)) out.push(item);
    if (out.length >= cap) break;
  }
  return out;
}

function priorityOf(value: unknown): Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value) ? (value as Priority) : "Should";
}

function featureList(value: unknown, cap: number): ReadFeature[] {
  if (!Array.isArray(value)) return [];
  const out: ReadFeature[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== "string") continue;
    const key = item.key as FeatureKey;
    if (!FEATURE_KEYS.includes(key) || out.some((f) => f.key === key)) continue;
    out.push({ key, priority: priorityOf(item.priority) });
    if (out.length >= cap) break;
  }
  return out;
}

function requireArray(raw: Record<string, unknown>, key: string): unknown[] {
  if (!Array.isArray(raw[key])) throw new SchemaError(`${key} is not an array`);
  return raw[key] as unknown[];
}

export function parseRead(raw: unknown): ReadResult {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  const requirementsRaw = requireArray(raw, "requirements");
  const requirements: ReadRequirement[] = [];
  for (const item of requirementsRaw) {
    if (!isRecord(item)) continue;
    const textValue = cleanString(item.text, TEXT);
    if (!textValue) continue;
    requirements.push({ text: textValue, priority: priorityOf(item.priority), alreadyBuilt: item.alreadyBuilt === true });
    if (requirements.length >= READ_REQUIREMENTS_CAP) break;
  }
  const guard = isRecord(raw.guardrails) ? raw.guardrails : {};
  return {
    name: cleanString(raw.name, 300),
    problem: cleanString(raw.problem, LONG),
    audience: cleanString(raw.audience, 300),
    success: cleanString(raw.success, LONG),
    signoff: cleanString(raw.signoff, 300),
    roles: cleanStrings(raw.roles, SUGGEST_ROLES_CAP, 60),
    features: featureList(raw.features, FEATURE_KEYS.length),
    requirements,
    integrations: enumStrings(raw.integrations, INTEGRATIONS, INTEGRATIONS.length),
    guardrails: {
      sso: guard.sso === true,
      perms: guard.perms === true,
      audit: guard.audit === true,
      personal: guard.personal === true,
      compliance: enumStrings(guard.compliance, COMPLIANCE, COMPLIANCE.length),
    },
    unplaced: cleanStrings(raw.unplaced, UNPLACED_CAP, 300),
  };
}

// ── Lookup ───────────────────────────────────────────────────────────────────

export interface LookupResult {
  caps: Array<{ title: string; requirement: string }>;
}

export function lookupSchema(): NamedSchema {
  return named(
    "builder_lookup",
    obj({
      caps: list(obj({ title: text("A short title for the capability."), requirement: text("One plain sentence describing the outcome as a requirement.") }), "5 to 9 capabilities a business typically relies on in this system."),
    }),
  );
}

export function parseLookup(raw: unknown): LookupResult {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  const capsRaw = requireArray(raw, "caps");
  const caps: LookupResult["caps"] = [];
  for (const item of capsRaw) {
    if (!isRecord(item)) continue;
    const title = cleanString(item.title, 120);
    const requirement = cleanString(item.requirement, TEXT);
    if (!title || !requirement) continue;
    caps.push({ title, requirement });
    if (caps.length >= LOOKUP_CAPS_CAP) break;
  }
  return { caps };
}

// ── Suggest ──────────────────────────────────────────────────────────────────

export interface SuggestGoalResult {
  step: "goal";
  problem: string;
  audience: string;
  success: string;
  roles: string[];
}

export interface SuggestFeaturesResult {
  step: "features";
  features: ReadFeature[];
  requirements: Array<{ text: string; priority: Priority }>;
}

export interface SuggestConnectionsResult {
  step: "connections";
  integrations: string[];
  other: string[];
}

export interface SuggestGuardrailsResult {
  step: "guardrails";
  sso: boolean;
  perms: boolean;
  audit: boolean;
  personal: boolean;
  compliance: string[];
  residency: string;
  scale: string;
  uptime: string;
  why: string;
}

export interface SuggestRunningResult {
  step: "running";
  run: RunKey | "";
  handover: HandoverKey[];
  skills: string;
  why: string;
}

export type SuggestResult = SuggestGoalResult | SuggestFeaturesResult | SuggestConnectionsResult | SuggestGuardrailsResult | SuggestRunningResult;

export function suggestSchema(step: SuggestStep): NamedSchema {
  switch (step) {
    case "goal":
      return named(
        "builder_suggest_goal",
        obj({
          problem: text("The problem, one or two sentences in their voice, or empty when already given."),
          audience: text("Who has the problem, or empty when already given."),
          success: text("One measurable outcome with a number and a timeframe, as a suggestion, or empty when already given."),
          roles: list(text("A type of user."), "The types of user this tool needs. Prefer the catalogue labels; at most two others."),
        }),
      );
    case "features":
      return named(
        "builder_suggest_features",
        obj({
          features: list(obj({ key: strEnum(FEATURE_KEYS, "A feature key from the list."), priority: PRIORITY_ENUM }), "A starting set of features by key, at most 7, with the Must list short."),
          requirements: list(obj({ text: text("One sentence about an outcome."), priority: PRIORITY_ENUM }), "Up to 3 requirements specific to their business that the list does not cover."),
        }),
      );
    case "connections":
      return named(
        "builder_suggest_connections",
        obj({
          integrations: list(strEnum(INTEGRATIONS, "A connection label from the list."), "Systems this tool probably needs to connect to, from the list."),
          other: list(text("A specific system they mentioned."), "Up to two other specific systems, only if they mentioned them."),
        }),
      );
    case "guardrails":
      return named(
        "builder_suggest_guardrails",
        obj({
          sso: { type: "boolean", description: "Single sign-on genuinely applies." },
          perms: { type: "boolean", description: "Roles and permissions genuinely apply." },
          audit: { type: "boolean", description: "An audit trail genuinely applies." },
          personal: { type: "boolean", description: "It handles personal data." },
          compliance: list(strEnum(COMPLIANCE, "A standard from the list."), "Standards it must meet, from the list only."),
          residency: strEnum(RESIDENCY_ENUM, "Where data must be stored, or empty when there is no reason to choose."),
          scale: strEnum(SCALE_ENUM, "How many people will use it, or empty when unknown."),
          uptime: strEnum(UPTIME_ENUM, "When it needs to be up, or empty when unknown."),
          why: text("One short sentence on why."),
        }),
      );
    case "running":
      return named(
        "builder_suggest_running",
        obj({
          run: strEnum(RUN_ENUM, "Who should run it after launch: summit, team, mix, unsure, or empty."),
          handover: list(strEnum(HANDOVER_KEYS, "A handover item key."), "What the handover should include."),
          skills: text("Their team's likely skills if they mentioned any, else empty."),
          why: text("One short sentence on why."),
        }),
      );
  }
}

export function parseSuggest(step: SuggestStep, raw: unknown): SuggestResult {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  switch (step) {
    case "goal":
      return {
        step,
        problem: cleanString(raw.problem, LONG),
        audience: cleanString(raw.audience, 300),
        success: cleanString(raw.success, LONG),
        roles: cleanStrings(raw.roles, SUGGEST_ROLES_CAP, 60),
      };
    case "features": {
      const reqsRaw = Array.isArray(raw.requirements) ? raw.requirements : [];
      const requirements: SuggestFeaturesResult["requirements"] = [];
      for (const item of reqsRaw) {
        if (!isRecord(item)) continue;
        const textValue = cleanString(item.text, TEXT);
        if (!textValue) continue;
        requirements.push({ text: textValue, priority: priorityOf(item.priority) });
        if (requirements.length >= SUGGEST_REQUIREMENTS_CAP) break;
      }
      return { step, features: featureList(raw.features, SUGGEST_FEATURES_CAP), requirements };
    }
    case "connections":
      return {
        step,
        integrations: enumStrings(raw.integrations, INTEGRATIONS, INTEGRATIONS.length),
        other: cleanStrings(raw.other, SUGGEST_OTHER_CAP, 120),
      };
    case "guardrails":
      return {
        step,
        sso: raw.sso === true,
        perms: raw.perms === true,
        audit: raw.audit === true,
        personal: raw.personal === true,
        compliance: enumStrings(raw.compliance, COMPLIANCE, COMPLIANCE.length),
        residency: typeof raw.residency === "string" && RESIDENCY_ENUM.includes(raw.residency) ? raw.residency : "",
        scale: typeof raw.scale === "string" && SCALE_ENUM.includes(raw.scale) ? raw.scale : "",
        uptime: typeof raw.uptime === "string" && UPTIME_ENUM.includes(raw.uptime) ? raw.uptime : "",
        why: cleanString(raw.why, 300),
      };
    case "running":
      return {
        step,
        run: typeof raw.run === "string" && RUN_OPTIONS.some((r) => r.key === raw.run) ? (raw.run as RunKey) : "",
        handover: enumStrings(raw.handover, HANDOVER_KEYS, HANDOVER_KEYS.length) as HandoverKey[],
        skills: cleanString(raw.skills, 300),
        why: cleanString(raw.why, 300),
      };
  }
}

// ── Ideas ────────────────────────────────────────────────────────────────────

export interface IdeaResult {
  title: string;
  what: string;
  buildsOn: string;
  kind: IdeaKind;
  size: IdeaSize;
  helps: string;
  human: boolean;
}

export interface IdeasResult {
  note: string;
  ideas: IdeaResult[];
}

export function ideasSchema(): NamedSchema {
  return named(
    "builder_ideas",
    obj({
      note: text("Empty, or, when AI is a poor fit, one or two sentences saying so and pointing at simple automations instead."),
      ideas: list(
        obj({
          title: text("A short title."),
          what: text("What it does, in one plain sentence."),
          buildsOn: text("Which part of their brief it builds on."),
          kind: strEnum(IDEA_KINDS, "The kind of idea."),
          size: strEnum(IDEA_SIZES, "How big a build it is."),
          helps: text("How it helps their success measure, if they gave one, else empty."),
          human: { type: "boolean", description: "True when a person should stay in charge: anything touching customers, money or personal data." },
        }),
        "3 to 6 ideas grounded in what they told you.",
      ),
    }),
  );
}

export function parseIdeas(raw: unknown): IdeasResult {
  if (!isRecord(raw)) throw new SchemaError("answer is not an object");
  const ideasRaw = requireArray(raw, "ideas");
  const ideas: IdeaResult[] = [];
  for (const item of ideasRaw) {
    if (!isRecord(item)) continue;
    const title = cleanString(item.title, 120);
    const what = cleanString(item.what, TEXT);
    if (!title || !what) continue;
    ideas.push({
      title,
      what,
      buildsOn: cleanString(item.buildsOn, 300),
      kind: typeof item.kind === "string" && (IDEA_KINDS as readonly string[]).includes(item.kind) ? (item.kind as IdeaKind) : "Automate a step",
      size: typeof item.size === "string" && (IDEA_SIZES as readonly string[]).includes(item.size) ? (item.size as IdeaSize) : "Moderate",
      helps: cleanString(item.helps, TEXT),
      human: item.human === true,
    });
    if (ideas.length >= IDEAS_CAP) break;
  }
  return { note: cleanString(raw.note, TEXT), ideas };
}

// ── Prototype: the staged build ──────────────────────────────────────────────
//
// Six schemas, one per model call of the staged build. The parsers live next
// to their types (research.ts, plan.ts, review.ts, screens.ts, audit.ts) so
// the admin pages can import the pure modules without these builders.

/** Characters kept from a reply's html, css or js before the per screen check; the check reports the real cap. */
export const PROTOTYPE_REPLY_CHARS = 200_000;

const COMPONENT_KIND_ENUM = strEnum(PLAN_COMPONENT_KINDS, "The kind of component: table, figures, chart, form, detail or list.");

export function researchSchema(): NamedSchema {
  return named(
    "builder_prototype_research",
    obj({
      summary: text("What the business sells and to whom, in two plain sentences, or empty."),
      products: list(text("A product name as the pages give it."), "Product names, or empty."),
      services: list(text("A service name as the pages give it."), "Service names, or empty."),
      plans: list(text("A plan or tier name as the pages give it."), "Plan or tier names, or empty."),
      vocabulary: list(obj({ term: text("Their word."), meaning: text("What it means in plain words.") }), "The words they use for their customers, records, jobs or sites, or empty."),
      locations: list(text("A place they operate from or serve."), "Locations, or empty."),
      currency: text("The currency the pages price in, or empty."),
      units: text("The units they measure in, or empty."),
      teamSize: text("A team size hint from the pages, or empty."),
    }),
  );
}

function componentSchema(description: string): JsonSchema {
  return obj(
    {
      kind: COMPONENT_KIND_ENUM,
      title: text("The component's heading."),
      entity: text("The sample entity it shows, in the company's own words."),
      note: text("What it must show or do, one short sentence, or empty."),
    },
    description,
  );
}

function screenSchema(description: string): JsonSchema {
  return obj(
    {
      slug: text("A short lowercase slug of letters, digits and hyphens, unique in the plan."),
      title: text("The screen's title as it appears in the navigation."),
      purpose: text("What a user does on this screen, one sentence."),
      role: text("The main user type for this screen."),
      components: list(componentSchema("One component on the screen."), "The components on the screen, in order, at most 8."),
      entities: list(text("A sample entity shown on the screen."), "The sample entities the screen shows, at most 8."),
    },
    description,
  );
}

function planProperties(): Record<string, JsonSchema> {
  return {
    screens: list(screenSchema("One screen of the prototype."), "3 to 5 screens in navigation order; the first is the dashboard or main list."),
    coverage: list(
      obj({ id: text("An item id from the list given."), screen: text("The slug of the screen that represents it."), component: text("The title of the component that represents it.") }),
      "Every item id given, each against the screen and component that represents it.",
    ),
    unplaced: list(obj({ id: text("An item id from the list given."), reason: text("Why it could not be placed on a screen.") }), "Items that could not be placed, with a reason, or empty."),
  };
}

export function planSchema(): NamedSchema {
  return named("builder_prototype_plan", obj(planProperties()));
}

export function planDiffSchema(): NamedSchema {
  return named(
    "builder_prototype_plan_diff",
    obj({
      ...planProperties(),
      changedScreens: list(text("A screen slug."), "The slugs of the screens that changed, including any added; empty when nothing changed."),
      outOfRemit: obj({
        refused: { type: "boolean", description: "True when the request asks for something a sample prototype cannot do." },
        reason: text("One plain sentence saying why, or empty."),
      }),
    }),
  );
}

/** A component or a screen that is not used is an object of empty strings: strict mode has no optionals. */
export function reviewSchema(): NamedSchema {
  return named(
    "builder_prototype_review",
    obj({
      gaps: list(
        obj({
          text: text("What the plan misses or handles badly, one plain sentence."),
          itemId: text("The item id it concerns, or empty."),
          screen: text("The slug of the screen it concerns, or empty."),
        }),
        "Requirements, roles, workflows or end states the plan misses or handles badly. At most 8.",
      ),
      recommendations: list(
        obj({
          title: text("A short title."),
          why: text("Why it matters, one sentence."),
          basedOn: text("The brief line or profile fact it rests on. Required."),
          mode: strEnum(["apply", "suggest"], "apply for an ordinary screen or component for this product; suggest for anything bigger."),
          screen: text("The slug of the planned screen it changes, or empty."),
          component: obj({
            kind: strEnum([...PLAN_COMPONENT_KINDS, ""], "The component kind, or empty when no component is added."),
            title: text("The component's heading, or empty."),
            entity: text("The sample entity, or empty."),
            note: text("What it shows or does, or empty."),
          }),
          newScreen: obj({
            slug: text("A new screen's slug, or empty when no screen is added."),
            title: text("The new screen's title, or empty."),
            purpose: text("What a user does on it, or empty."),
            role: text("Its main user type, or empty."),
            components: list(componentSchema("One component on the new screen."), "The new screen's components, or empty."),
            entities: list(text("A sample entity."), "The new screen's sample entities, or empty."),
          }),
        }),
        "At most five improvements ranked by impact.",
      ),
    }),
  );
}

export function screenBuildSchema(): NamedSchema {
  return named(
    "builder_prototype_screen",
    obj({
      html: text("The inner HTML of the screen's section only."),
      css: text("Styles for this screen only, scoped by class, or empty."),
      js: text("Plain script for this screen only, using root.querySelector, or empty."),
    }),
  );
}

export function auditSchema(): NamedSchema {
  return named(
    "builder_prototype_audit",
    obj({
      missing: list(obj({ id: text("The id of a requirement that is not visibly represented."), note: text("Where it should have been, one short phrase, or empty.") }), "Only the ids that are not represented on any screen; empty when all are."),
    }),
  );
}
