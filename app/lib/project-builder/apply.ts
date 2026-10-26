/**
 * Applying a parsed model result to a brief state. One rule in every
 * function: a field is set only when it is blank, a list item is added only
 * when absent, and nothing the prospect wrote is overwritten or removed.
 * The one exception is the prototype's own: a re-read of the document
 * replaces the rows that came from the previous read (`src: "doc"`), and a
 * fresh ideas run replaces the ideas the prospect has not picked.
 *
 * The routes call these after a successful parse and return the whole new
 * state, so "fills blanks and adds, never overwrites" has one
 * implementation on the server for the model path and the rules path alike.
 * Pure: returns a new state and never mutates the argument.
 */
import { FEATURES, HANDOVER, INTEGRATIONS, RUN_OPTIONS } from "./catalogue.ts";
import { listText, otherIntegrations } from "./requirements.ts";
import { ideasKey } from "./suggestions.ts";
import type { BriefState, CustomRequirement, Idea } from "./brief.ts";
import type { IdeasResult, LookupResult, ReadResult, SuggestResult } from "./schemas.ts";

export interface ApplyResult {
  state: BriefState;
  message: string;
  /** Short labels of what was added, for the response and the event. */
  added: string[];
}

const RUN_LABELS: Record<string, string> = {
  summit: "Summit running it",
  team: "your team taking it over",
  mix: "a mix, with Summit on call",
  unsure: "leaving it open for now",
};

function addRoles(roles: string[], candidates: string[], cap: number): { roles: string[]; added: string[] } {
  const next = roles.slice();
  const added: string[] = [];
  for (const raw of candidates) {
    const role = raw.trim();
    if (!role || next.includes(role)) continue;
    next.push(role);
    added.push(role);
    if (added.length >= cap) break;
  }
  return { roles: next, added };
}

/** The document read: replaces the previous read's rows, fills blanks, adds roles, features, connections and guardrails. */
export function applyRead(state: BriefState, result: ReadResult, built: boolean): ApplyResult {
  const custom: CustomRequirement[] = state.custom.filter((c) => c.src !== "doc");
  for (const r of result.requirements) {
    custom.push({ text: r.text, pri: r.priority, cat: "Feature", src: "doc", built: built && r.alreadyBuilt });
  }
  const next: BriefState = { ...state, custom, features: { ...state.features }, featSrc: { ...state.featSrc }, intSrc: { ...state.intSrc } };
  if (!next.name.trim() && result.name) next.name = result.name;
  if (!next.problem.trim() && result.problem) next.problem = result.problem;
  if (!next.audience.trim() && result.audience) next.audience = result.audience;
  if (!next.success.trim() && result.success) next.success = result.success;
  if (!next.signoff.trim() && result.signoff) next.signoff = result.signoff;
  next.roles = addRoles(state.roles, result.roles, result.roles.length).roles;
  for (const f of result.features) {
    if (!next.features[f.key]) {
      next.features[f.key] = f.priority;
      next.featSrc[f.key] = "doc";
    }
  }
  const integrations = state.integrations.slice();
  for (const label of result.integrations) {
    if (INTEGRATIONS.includes(label) && !integrations.includes(label)) {
      integrations.push(label);
      next.intSrc[label] = "doc";
    }
  }
  next.integrations = integrations;
  next.sso = state.sso || result.guardrails.sso;
  next.perms = state.perms || result.guardrails.perms;
  next.audit = state.audit || result.guardrails.audit;
  next.personal = state.personal || result.guardrails.personal;
  next.compliance = state.compliance.concat(result.guardrails.compliance.filter((c) => !state.compliance.includes(c)));
  next.unplaced = result.unplaced.slice();
  const n = result.requirements.length;
  return {
    state: next,
    message: `Found ${n} requirement${n === 1 ? "" : "s"}. They're under Features, marked as from your document. Check each one.`,
    added: result.requirements.map((r) => r.text),
  };
}

function applyGoal(state: BriefState, r: Extract<SuggestResult, { step: "goal" }>): ApplyResult {
  const next = { ...state };
  const done: string[] = [];
  if (!next.problem.trim() && r.problem) {
    next.problem = r.problem;
    done.push("the problem");
  }
  if (!next.audience.trim() && r.audience) {
    next.audience = r.audience;
    done.push("who has it");
  }
  if (!next.success.trim() && r.success) {
    next.success = r.success;
    done.push("a success measure");
  }
  const roles = addRoles(state.roles, r.roles, 7);
  next.roles = roles.roles;
  const a = done.length ? `Drafted ${listText(done)}. Edit the wording so it's yours.` : "Everything here is filled in already.";
  const b = roles.added.length ? `Added ${listText(roles.added)}. Take off any that don't fit.` : "Nothing new to add from what you've told us.";
  return { state: next, message: `${a} ${b}`, added: done.concat(roles.added) };
}

function applyFeatures(state: BriefState, r: Extract<SuggestResult, { step: "features" }>): ApplyResult {
  const features = { ...state.features };
  const featSrc = { ...state.featSrc };
  const nf: string[] = [];
  for (const f of r.features) {
    if (features[f.key]) continue;
    features[f.key] = f.priority;
    featSrc[f.key] = "suggested";
    nf.push(FEATURES.find((x) => x.key === f.key)?.title ?? f.key);
    if (nf.length >= 7) break;
  }
  const custom = state.custom.slice();
  const nr: string[] = [];
  for (const q of r.requirements) {
    if (custom.some((c) => c.text === q.text)) continue;
    custom.push({ text: q.text, pri: q.priority, cat: "Feature", src: "suggested", built: false });
    nr.push(q.text);
    if (nr.length >= 3) break;
  }
  const message =
    nf.length || nr.length
      ? `Added ${nf.length} feature${nf.length === 1 ? "" : "s"}${nr.length ? ` and ${nr.length} requirement${nr.length > 1 ? "s" : ""} specific to you` : ""}. Tap anything to change it.`
      : "Nothing new to add. Your picks already cover it.";
  return { state: { ...state, features, featSrc, custom }, message, added: nf.concat(nr) };
}

function applyConnections(state: BriefState, r: Extract<SuggestResult, { step: "connections" }>): ApplyResult {
  const integrations = state.integrations.slice();
  const intSrc = { ...state.intSrc };
  const added: string[] = [];
  for (const label of r.integrations) {
    if (!INTEGRATIONS.includes(label) || integrations.includes(label)) continue;
    integrations.push(label);
    intSrc[label] = "suggested";
    added.push(label);
  }
  const others = otherIntegrations(state);
  const fresh = r.other.filter((o) => o.trim() && !others.includes(o.trim())).map((o) => o.trim()).slice(0, 2);
  const intOther = fresh.length ? others.concat(fresh).join(", ") : state.intOther;
  const all = added.concat(fresh);
  return {
    state: { ...state, integrations, intSrc, intOther },
    message: all.length ? `Added ${listText(all)}. Remove any you don't use.` : "Nothing obvious to add.",
    added: all,
  };
}

function applyGuardrails(state: BriefState, r: Extract<SuggestResult, { step: "guardrails" }>): ApplyResult {
  const next = { ...state, compliance: state.compliance.slice() };
  const on: string[] = [];
  const set = (key: "sso" | "perms" | "audit" | "personal", label: string) => {
    if (r[key] && !next[key]) {
      next[key] = true;
      on.push(label);
    }
  };
  set("sso", "single sign-on");
  set("perms", "roles and permissions");
  set("audit", "an audit trail");
  set("personal", "personal data");
  for (const c of r.compliance) {
    if (!next.compliance.includes(c)) {
      next.compliance.push(c);
      on.push(c);
    }
  }
  if (r.residency && (!next.residency || next.residency === "No preference")) {
    next.residency = r.residency;
    on.push(`data stored in ${r.residency}`);
  }
  if (r.scale && !next.scale) {
    next.scale = r.scale;
    on.push(r.scale.toLowerCase());
  }
  if (r.uptime && !next.uptime) {
    next.uptime = r.uptime;
    on.push(`uptime: ${r.uptime.toLowerCase()}`);
  }
  const message = on.length
    ? `Suggested ${listText(on)}.${r.why ? ` ${r.why}` : ""} Check each one.`
    : "Nothing to add. What you have looks right for a project like this.";
  return { state: next, message, added: on };
}

function applyRunning(state: BriefState, r: Extract<SuggestResult, { step: "running" }>): ApplyResult {
  const next = { ...state, handover: state.handover.slice() };
  const done: string[] = [];
  if (r.run && !next.run && RUN_OPTIONS.some((o) => o.key === r.run)) {
    next.run = r.run;
    done.push(RUN_LABELS[r.run]);
  }
  for (const k of r.handover) {
    const h = HANDOVER.find((x) => x.key === k);
    if (h && !next.handover.includes(k)) {
      next.handover.push(k);
      done.push(h.title.toLowerCase());
    }
  }
  if (r.skills && !next.skills.trim() && (next.run === "team" || next.run === "mix")) next.skills = r.skills;
  const message = done.length
    ? `Suggested ${listText(done)}.${r.why ? ` ${r.why}` : ""} Change anything that doesn't fit.`
    : "Nothing to add. Your answers here already cover it.";
  return { state: next, message, added: done };
}

export function applySuggest(state: BriefState, result: SuggestResult): ApplyResult {
  switch (result.step) {
    case "goal":
      return applyGoal(state, result);
    case "features":
      return applyFeatures(state, result);
    case "connections":
      return applyConnections(state, result);
    case "guardrails":
      return applyGuardrails(state, result);
    case "running":
      return applyRunning(state, result);
  }
}

/** Keeps the picked ideas, drops the rest, appends the fresh ones not already kept by title. */
export function applyIdeas(state: BriefState, result: IdeasResult | { note: string; ideas: Array<Omit<Idea, "id">> }): ApplyResult {
  const kept = state.ideas.filter((i) => Boolean(state.ideaPick[i.id]) && state.ideaPick[i.id] !== "no");
  const titles = new Set(kept.map((i) => i.title.toLowerCase()));
  let seq = state.ideaSeq;
  const fresh: Idea[] = [];
  for (const i of result.ideas) {
    if (titles.has(i.title.toLowerCase())) continue;
    titles.add(i.title.toLowerCase());
    seq += 1;
    fresh.push({ id: `i${seq}`, title: i.title, what: i.what, buildsOn: i.buildsOn, kind: i.kind, size: i.size, helps: i.helps, human: i.human });
  }
  const ideas = kept.concat(fresh);
  const ideaPick: BriefState["ideaPick"] = {};
  for (const i of kept) ideaPick[i.id] = state.ideaPick[i.id];
  const next: BriefState = { ...state, ideas, ideaPick, ideaSeq: seq, ideasKey: ideasKey(state) };
  return { state: next, message: result.note ?? "", added: fresh.map((i) => i.title) };
}

/** Sets the looked up capabilities as `rep.extra` (keys `x0` to `x8`) for a system the catalogue lacks. */
export function applyLookup(state: BriefState, name: string, result: LookupResult): ApplyResult {
  const extra: BriefState["rep"]["extra"] = {};
  result.caps.slice(0, 9).forEach((c, i) => {
    extra[`x${i}`] = { title: c.title, requirement: c.requirement };
  });
  const rep = { ...state.rep, sys: name, other: name, cat: "", caps: {}, extra };
  const message = Object.keys(extra).length ? `Here's what teams usually use ${name} for. Pick the parts you rely on.` : "Here's a general set to choose from.";
  return { state: { ...state, rep }, message, added: result.caps.map((c) => c.title) };
}
