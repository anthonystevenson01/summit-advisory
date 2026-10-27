/**
 * The requirements engine: the prototype's `buildReqs`, `counts`,
 * `essentials`, `completeness`, `sysCaps`, `repBuild` and `projectName` as
 * pure functions of a `BriefState`. The page, the routes, the emails, the
 * Notion builder and the cron all read these, so the Must count on the
 * dock, in the alert and in Notion is one number.
 *
 * Row order and priorities are the prototype's: catalogue features, custom
 * rows, picked AI ideas, catalogue integrations, other integrations,
 * guardrails, then handover items. Nothing here mutates its argument.
 */
import {
  CAPABILITIES,
  FEATURES,
  GENERIC_CAPABILITIES,
  HANDOVER_REQUIREMENTS,
  PRIORITIES,
  REPLACEMENT_REASONS,
  SHOULD_REASONS,
  SOURCE_LABELS,
  SYSTEM_CATEGORIES,
  type CapabilityKey,
  type FeatureKey,
  type Priority,
  type SourceKey,
} from "./catalogue.ts";
import type { BriefState, CustomRequirement } from "./brief.ts";

export type RequirementCategory = "Feature" | "AI idea" | "Integration" | "Guardrail" | "Running it";

export type RequirementRef =
  | { kind: "feature"; key: FeatureKey }
  | { kind: "custom"; index: number }
  | { kind: "idea"; id: string }
  | { kind: "integration"; label: string }
  | { kind: "step"; step: number };

export interface Requirement {
  text: string;
  cat: RequirementCategory;
  pri: Priority;
  src: SourceKey;
  built: boolean;
  ref: RequirementRef;
}

/** Steps in the six step model: integrations live on step 2, guardrails and running it on step 3. */
const STEP_WHAT = 2;
const STEP_RULES = 3;

/** The prototype's `otherInts`: the comma separated free text as labels. */
export function otherIntegrations(state: BriefState): string[] {
  return state.intOther.split(",").map((s) => s.trim()).filter(Boolean);
}

export function buildRequirements(state: BriefState): Requirement[] {
  const out: Requirement[] = [];
  for (const f of FEATURES) {
    const pri = state.features[f.key];
    if (pri) out.push({ text: f.requirement, cat: "Feature", pri, src: state.featSrc[f.key] ?? "you", built: false, ref: { kind: "feature", key: f.key } });
  }
  state.custom.forEach((c, index) => {
    out.push({ text: c.text, cat: c.cat, pri: c.pri, src: c.src, built: c.built, ref: { kind: "custom", index } });
  });
  for (const idea of state.ideas) {
    const pick = state.ideaPick[idea.id];
    if (pick && pick !== "no") out.push({ text: idea.what, cat: "AI idea", pri: pick, src: "ai", built: false, ref: { kind: "idea", id: idea.id } });
  }
  for (const label of state.integrations) {
    out.push({ text: `Connects to ${label}.`, cat: "Integration", pri: "Must", src: state.intSrc[label] ?? "you", built: false, ref: { kind: "integration", label } });
  }
  for (const label of otherIntegrations(state)) {
    out.push({ text: `Connects to ${label}.`, cat: "Integration", pri: "Must", src: "you", built: false, ref: { kind: "step", step: STEP_WHAT } });
  }
  const guard = (text: string, pri: Priority) =>
    out.push({ text, cat: "Guardrail", pri, src: "you", built: false, ref: { kind: "step", step: STEP_RULES } });
  if (state.sso) guard("People sign in with single sign-on.", "Must");
  if (state.perms) guard("Access is controlled by role.", "Must");
  if (state.audit) guard("Important changes are logged with who and when.", "Should");
  if (state.personal) guard("Personal data is protected and can be deleted on request.", "Must");
  for (const c of state.compliance) guard(`Meets ${c}.`, "Must");
  for (const h of state.handover) {
    out.push({ text: HANDOVER_REQUIREMENTS[h], cat: "Running it", pri: "Should", src: "you", built: false, ref: { kind: "step", step: STEP_RULES } });
  }
  return out;
}

export interface PriorityCounts {
  Must: number;
  Should: number;
  Could: number;
}

export function countByPriority(reqs: readonly Requirement[]): PriorityCounts {
  return {
    Must: reqs.filter((r) => r.pri === "Must").length,
    Should: reqs.filter((r) => r.pri === "Should").length,
    Could: reqs.filter((r) => r.pri === "Could").length,
  };
}

export interface Essential {
  label: string;
  met: boolean;
  /** The step (0 to 5) where the gap is filled. */
  step: number;
}

export function essentials(state: BriefState): Essential[] {
  const c = countByPriority(buildRequirements(state));
  return [
    { label: "What problem you're solving", met: state.problem.trim().length > 0, step: 1 },
    { label: "How you'll know it worked", met: state.success.trim().length > 0, step: 1 },
    { label: "Who signs off the scope", met: state.signoff.trim().length > 0, step: 1 },
    { label: "At least one type of user", met: state.roles.length > 0, step: 1 },
    { label: "At least one must have", met: c.Must > 0, step: 2 },
    { label: "Who runs it after launch", met: state.run.length > 0, step: 3 },
  ];
}

/** Six essentials plus four extras (path, audience, scale, an idea picked), as a whole percentage. */
export function completeness(state: BriefState): number {
  const met = essentials(state).map((e) => e.met);
  const extra = [
    state.path.length > 0,
    state.audience.trim().length > 0,
    state.scale.length > 0,
    state.ideas.some((i) => Boolean(state.ideaPick[i.id]) && state.ideaPick[i.id] !== "no"),
  ];
  const all = met.concat(extra);
  return Math.round((all.filter(Boolean).length / all.length) * 100);
}

export function projectName(state: BriefState): string {
  const name = state.name.trim();
  if (name) return name;
  const idea = state.idea.trim();
  return idea ? idea.slice(0, 60) : "Untitled project";
}

export interface SystemCapability {
  key: string;
  title: string;
  requirement: string;
}

/** The capabilities on offer for the chosen system: the catalogue's, else the looked up extras, else the generic set. */
export function systemCapabilities(state: BriefState): SystemCapability[] {
  const R = state.rep;
  if (!R.sys) return [];
  const cat = SYSTEM_CATEGORIES.find((x) => R.sys in x.systems);
  if (cat) return cat.systems[R.sys].map((k) => ({ key: k, title: CAPABILITIES[k].title, requirement: CAPABILITIES[k].requirement }));
  const extras = Object.entries(R.extra).map(([key, v]) => ({ key, title: v.title, requirement: v.requirement }));
  if (extras.length) return extras;
  return GENERIC_CAPABILITIES.map((k: CapabilityKey) => ({ key: k, title: CAPABILITIES[k].title, requirement: CAPABILITIES[k].requirement }));
}

/** The reason's sentence with every `SYS` replaced by the system name; an unknown reason gives "". */
export function reasonSentence(reason: string, systemName: string): string {
  const sentence = REPLACEMENT_REASONS[reason];
  return sentence ? sentence.replace(/SYS/g, systemName) : "";
}

export function listText(items: readonly string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export interface ReplacementBuild {
  state: BriefState;
  note: string;
}

export const PICK_A_PART_NOTE = (sys: string) => `Pick at least one part of ${sys} you use, or tap "Select what most teams use".`;

/**
 * The prototype's `repBuild`: turns the chosen system, its picked parts, the
 * reasons and the switch over flags into custom rows with `src: "system"`,
 * drafts the name, idea and problem when blank, and adds the category's
 * roles plus Admins. Returns the unchanged state with a prompt when nothing
 * is picked.
 */
export function buildReplacementRequirements(state: BriefState): ReplacementBuild {
  const R = state.rep;
  const sys = R.sys;
  if (!sys) return { state, note: "" };
  const caps = systemCapabilities(state);
  const picked = caps.filter((c) => R.caps[c.key]);
  if (picked.length === 0) return { state, note: PICK_A_PART_NOTE(sys) };

  const custom: CustomRequirement[] = state.custom.filter((c) => c.src !== "system");
  for (const c of picked) custom.push({ text: c.requirement, pri: R.caps[c.key], cat: "Feature", src: "system", built: false });
  for (const r of R.reasons) {
    const text = reasonSentence(r, sys);
    if (!text) continue;
    custom.push({ text, pri: SHOULD_REASONS.includes(r) ? "Should" : "Must", cat: "Feature", src: "system", built: false });
  }
  if (R.migrate) {
    custom.push({ text: `Existing data from ${sys}, including history and attachments, is moved across and checked before the switch-over.`, pri: "Must", cat: "Running it", src: "system", built: false });
  }
  if (R.parallel) {
    custom.push({ text: `${sys} and the new tool can run side by side during the switch-over, with data kept in step.`, pri: "Should", cat: "Running it", src: "system", built: false });
  }

  let problem = state.problem;
  if (!problem.trim()) {
    const uses = listText(picked.slice(0, 4).map((c) => c.title.toLowerCase()));
    const why = R.reasons.length ? ` We want to move because: ${listText(R.reasons.map((r) => r.charAt(0).toLowerCase() + r.slice(1)))}.` : "";
    problem = `We use ${sys} today for ${uses}.${why}`;
  }

  const cat = SYSTEM_CATEGORIES.find((x) => sys in x.systems);
  const roles = state.roles.slice();
  for (const r of (cat ? cat.roles : ["Staff"]).concat("Admins")) if (!roles.includes(r)) roles.push(r);

  const next: BriefState = {
    ...state,
    custom,
    roles,
    problem,
    name: state.name.trim() ? state.name : `${sys} replacement`,
    idea: state.idea.trim() ? state.idea : `Replace ${sys} with something built around how we work`,
  };
  const n = custom.filter((c) => c.src === "system").length;
  return {
    state: next,
    note: `Built ${n} requirements from your ${sys} setup. They're under Features, and the problem and users are drafted for you. Next, check the outcome.`,
  };
}

/** The dock's selection key: category and text. */
export function requirementKey(req: Pick<Requirement, "cat" | "text">): string {
  return `${req.cat}|${req.text}`;
}

export interface NotionRequirementRow {
  id: string;
  text: string;
  cat: RequirementCategory;
  pri: Priority;
  source: string;
  built: boolean;
}

/** Rows in Must, Should, Could order with `REQ-001` style ids, for the Notion body and the admin table. */
export function requirementsForNotion(state: BriefState): NotionRequirementRow[] {
  const reqs = buildRequirements(state);
  const ordered = PRIORITIES.flatMap((p) => reqs.filter((r) => r.pri === p));
  return ordered.map((r, i) => ({
    id: `REQ-${String(i + 1).padStart(3, "0")}`,
    text: r.text,
    cat: r.cat,
    pri: r.pri,
    source: SOURCE_LABELS[r.src],
    built: r.built,
  }));
}
