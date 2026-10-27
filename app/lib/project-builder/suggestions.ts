/**
 * The rule based helpers: what the builder does when the model is absent,
 * over the cap, or failed. These are the prototype's `ruleSuggest`,
 * `ruleIdeas`, `ideasKey`, `devAnswer` and `words` made pure: each returns
 * a new state and a message and never mutates its argument. The one rule
 * every helper obeys: fill a blank, add a missing item, never overwrite or
 * remove anything the prospect wrote.
 *
 * `ruleSuggest` maps the five builder steps onto the prototype's numbered
 * rules: `goal` runs the outcome rule and the users rule and joins the two
 * messages; `features`, `connections` and `guardrails` are one rule each;
 * `running` has no rule in the prototype, so it returns the unchanged state
 * and points at the quick question.
 */
import { FEATURES, IDEA_KINDS, IDEA_SIZES, type FeatureKey, type HandoverKey, type Priority, type RunKey } from "./catalogue.ts";
import { listText } from "./requirements.ts";
import type { BriefState, Idea, SuggestStep } from "./brief.ts";

export { listText };

export interface RuleResult {
  state: BriefState;
  message: string;
}

export const RUNNING_NO_RULE_MESSAGE = "That did not work just now. Try the quick question instead.";

/** The lowercased text the matchers run over; the pasted source is the first 8,000 characters when given. */
export function wordsOf(state: BriefState, source = ""): string {
  return [state.name, state.idea, state.problem, state.audience, state.success, source.slice(0, 8000), state.custom.map((c) => c.text).join(" ")]
    .join(" ")
    .toLowerCase();
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function suggestGoal(state: BriefState): RuleResult {
  const added: string[] = [];
  const next = { ...state };
  if (!next.problem.trim() && next.idea.trim()) {
    next.problem = `Today there's no single place for this. We want ${lowerFirst(next.idea.trim())}.`;
    added.push("the problem");
  }
  if (!next.success.trim()) {
    next.success = "Cut the time spent on this by half within six months of launch";
    added.push("a success measure");
  }
  if (!next.signoff.trim()) {
    next.signoff = "Me";
    added.push("sign-off");
  }
  return { state: next, message: added.length ? `Drafted ${listText(added)} as a starting point. Edit the wording so it's yours.` : "Everything here is filled in already." };
}

const ROLE_MATCHERS: ReadonlyArray<[RegExp, string]> = [
  [/customer|client|consumer|buyer/, "Customers"],
  [/staff|team|employee|ops|office/, "Staff"],
  [/manager|approv|supervis/, "Managers"],
  [/supplier|partner|franchise|dealer|vendor/, "Partners or suppliers"],
  [/field|driver|technician|site|engineer/, "Field teams"],
  [/executive|board|leadership|ceo|director/, "Executives"],
];

function suggestUsers(state: BriefState, words: string): RuleResult {
  const added: string[] = [];
  const roles = state.roles.slice();
  for (const [re, role] of ROLE_MATCHERS) {
    if (re.test(words) && !roles.includes(role)) {
      roles.push(role);
      added.push(role);
    }
  }
  if (!roles.includes("Staff") && added.length === 0) {
    roles.push("Staff");
    added.push("Staff");
  }
  if (!roles.includes("Admins")) {
    roles.push("Admins");
    added.push("Admins");
  }
  return { state: { ...state, roles }, message: added.length ? `Added ${listText(added)}. Take off any that don't fit.` : "Nothing new to add from what you've told us." };
}

function suggestFeatures(state: BriefState, words: string): RuleResult {
  const added: string[] = [];
  const features = { ...state.features };
  const featSrc = { ...state.featSrc };
  for (const f of FEATURES) {
    if (!features[f.key] && f.matcher.test(words)) {
      features[f.key] = added.length < 4 ? "Must" : "Should";
      featSrc[f.key] = "suggested";
      added.push(f.title);
    }
  }
  if (added.length === 0 && Object.keys(features).length === 0) {
    const defaults: Array<[FeatureKey, Priority]> = [["accounts", "Must"], ["dashboard", "Should"], ["notify", "Could"]];
    for (const [key, pri] of defaults) {
      features[key] = pri;
      featSrc[key] = "suggested";
      added.push(FEATURES.find((f) => f.key === key)?.title ?? key);
    }
  }
  return {
    state: { ...state, features, featSrc },
    message: added.length
      ? `Added ${added.length} feature${added.length > 1 ? "s" : ""}: ${listText(added)}. Tap any card to change its priority.`
      : "Nothing new to add. Your picks already cover what we can see.",
  };
}

function suggestConnections(state: BriefState, words: string): RuleResult {
  const added: string[] = [];
  const integrations = state.integrations.slice();
  const intSrc = { ...state.intSrc };
  const add = (label: string) => {
    if (!integrations.includes(label)) {
      integrations.push(label);
      intSrc[label] = "suggested";
      added.push(label);
    }
  };
  const f = state.features;
  if (f.payments) add("Payment provider");
  if (/crm|salesforce|hubspot|lead|pipeline/.test(words)) add("CRM (Salesforce, HubSpot)");
  if (/finance|invoice|erp|accounting|xero|quickbooks|sage/.test(words)) add("Finance or ERP");
  if (f.notify || f.booking || /email|calendar/.test(words)) add("Email and calendar");
  if (f.import || /spreadsheet|excel|csv/.test(words)) add("Spreadsheets");
  if (/shop|ecommerce|e-commerce|shopify|store/.test(words)) add("E-commerce platform");
  if (/slack|teams/.test(words)) add("Slack or Teams");
  if (f.dashboard && /three systems|several systems|data/.test(words)) add("Data warehouse");
  if (state.roles.some((r) => ["Staff", "Managers", "Executives", "Field teams"].includes(r)) && f.accounts) add("Single sign-on provider");
  return {
    state: { ...state, integrations, intSrc },
    message: added.length ? `Added ${listText(added)}. Remove any you don't use.` : "Nothing obvious to add. Name your own below if there's something we've missed.",
  };
}

function suggestGuardrails(state: BriefState): RuleResult {
  const on: string[] = [];
  const next = { ...state, compliance: state.compliance.slice() };
  const f = state.features;
  const set = (key: "sso" | "perms" | "audit" | "personal", label: string) => {
    if (!next[key]) {
      next[key] = true;
      on.push(label);
    }
  };
  const internal = state.roles.some((r) => ["Staff", "Managers", "Executives", "Field teams", "Admins"].includes(r));
  if (state.roles.length > 1) set("perms", "roles and permissions");
  if (internal && f.accounts && state.roles.includes("Staff")) set("sso", "single sign-on");
  if (f.workflow || f.payments) set("audit", "an audit trail");
  if (f.accounts || f.forms || state.roles.includes("Customers")) set("personal", "personal data");
  if (f.payments && !next.compliance.includes("PCI DSS")) {
    next.compliance.push("PCI DSS");
    on.push("PCI DSS");
  }
  const publicFacing = Boolean(f.portal) || state.roles.includes("Customers");
  if (publicFacing && !next.compliance.includes("Accessibility (WCAG 2.2 AA)")) {
    next.compliance.push("Accessibility (WCAG 2.2 AA)");
    on.push("accessibility");
  }
  if (!next.uptime) {
    next.uptime = publicFacing ? "Around the clock" : "Business hours";
    on.push(`uptime: ${next.uptime.toLowerCase()}`);
  }
  return {
    state: next,
    message: on.length
      ? `Switched on ${listText(on)}. Where data lives and how many users you'll have are still yours to answer.`
      : "Nothing to add. You've covered the usual ones.",
  };
}

export function ruleSuggest(state: BriefState, step: SuggestStep, source = ""): RuleResult {
  const words = wordsOf(state, source);
  switch (step) {
    case "goal": {
      const a = suggestGoal(state);
      const b = suggestUsers(a.state, words);
      return { state: b.state, message: `${a.message} ${b.message}` };
    }
    case "features":
      return suggestFeatures(state, words);
    case "connections":
      return suggestConnections(state, words);
    case "guardrails":
      return suggestGuardrails(state);
    case "running":
      return { state, message: RUNNING_NO_RULE_MESSAGE };
  }
}

export type DevAnswer = "yes" | "some" | "no";

const DEV_ANSWERS: Record<DevAnswer, { run: RunKey; handover: HandoverKey[]; note: string }> = {
  yes: { run: "team", handover: ["docs", "train", "repos", "cloud", "support"], note: "Set to your team taking it over, with a full handover. Add your team's skills below if you know them." },
  some: { run: "mix", handover: ["docs", "train", "support"], note: "Set to a mix: your team runs it with Summit on call." },
  no: { run: "summit", handover: ["support"], note: "Set to Summit running it for you. You can change this any time." },
};

/** The quick question on the running step: sets `run` and the handover list for the answer. */
export function devAnswer(state: BriefState, answer: DevAnswer): RuleResult {
  const a = DEV_ANSWERS[answer];
  return { state: { ...state, run: a.run, handover: a.handover.slice() }, message: a.note };
}

export type IdeaDraft = Omit<Idea, "id">;

export function ruleIdeas(state: BriefState): IdeaDraft[] {
  const f = state.features;
  const L: IdeaDraft[] = [];
  const add = (cond: boolean, title: string, what: string, kind: IdeaDraft["kind"], size: IdeaDraft["size"], buildsOn: string, human = false) => {
    if (cond) L.push({ title, what, kind, size, buildsOn, helps: "", human });
  };
  add(Boolean(f.forms || f.files), "Fill forms from documents", "Read uploaded forms and documents and fill in the fields automatically, for a person to check.", "Automate a step", "Moderate", "Forms and files", true);
  add(Boolean(f.dashboard), "A weekly summary in plain English", "Write a short weekly note on what changed in your numbers and what might need attention.", "Summarise or draft", "Quick win", "Dashboards and reporting");
  add(Boolean(f.content || f.search), "Ask your own information", "An assistant that answers questions from your own content and records, and shows where the answer came from.", "Answer questions", "Moderate", "Content and search");
  add(Boolean(f.workflow), "Route requests to the right person", "Sort incoming requests, suggest who should handle them and why, for a person to confirm.", "Sort and route", "Moderate", "Workflows and approvals", true);
  add(Boolean(f.messaging), "Draft replies", "Draft replies to common messages for a person to edit and send.", "Summarise or draft", "Quick win", "Messaging", true);
  add(Boolean(f.payments), "Catch problems before they go out", "Flag orders, payments or invoices that look unusual before they're processed.", "Spot problems", "Moderate", "Payments and billing", true);
  add(Boolean(f.booking), "Predict busy periods", "Forecast busy times from past bookings and suggest changes to slots or staffing.", "Predict", "Bigger build", "Booking and scheduling");
  add(Boolean(f.import), "Tidy imported data", "Clean and match spreadsheet data as it comes in, flagging anything it isn't sure about.", "Automate a step", "Quick win", "Import and export");
  if (L.length < 3) {
    add(true, "Answer common questions", "An assistant that answers the questions your team gets asked most, using your own information.", "Answer questions", "Moderate", "Your users and content");
    add(true, "Spot what needs attention", "Watch for records that are stuck, late or unusual and nudge the right person.", "Spot problems", "Moderate", "Your workflow", true);
    add(true, "Write the first draft", "Draft routine updates, summaries or emails from the data already in the tool, for a person to send.", "Summarise or draft", "Quick win", "Your data", true);
  }
  return L.slice(0, 6).map((i) => ({
    ...i,
    kind: IDEA_KINDS.includes(i.kind) ? i.kind : "Automate a step",
    size: IDEA_SIZES.includes(i.size) ? i.size : "Moderate",
  }));
}

/** Changes when the features, connections, custom row count or the presence of a problem change. */
export function ideasKey(state: BriefState): string {
  return JSON.stringify([Object.keys(state.features).sort(), state.integrations, state.custom.length, state.problem.length > 0]);
}
