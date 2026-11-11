/**
 * The draft script's pure half: the JSON schema the model answers in, the
 * prompt that carries the requirement standard, the parser that holds the
 * answer to the same standard, and the step from an accepted answer to a
 * category. No file, network or model access.
 *
 * What a machine can check is checked here: one sentence, no long dash, no
 * product name from the documentation hosts, ids, sizes, keys and the group
 * size. One behaviour per requirement, the level and British spelling cannot
 * be checked by machine; they are in the prompt and in the review.
 */
import { CAPABILITIES, type CapabilityKey } from "../../app/lib/project-builder/catalogue.ts";
import { DATA_GUARD } from "../../app/lib/project-builder/prompts.ts";
import {
  CATALOGUE_SIZES,
  CATEGORY_TYPE_RE,
  NO_KEY,
  REQUIREMENT_ID_RE,
  hasLongDash,
  isCellSafe,
  isOneSentence,
  sizeScaleSentence,
  type CatalogueKey,
  type CatalogueRequirement,
  type CatalogueSize,
  type ToolCategory,
} from "../../app/lib/project-builder/tool-catalogue.ts";
import { SchemaError, type JsonSchema, type NamedSchema } from "../../app/lib/tools/schema.ts";
import { productNameProblem, splitList, type FetchedPage, type ScriptArgSpec } from "./io.ts";

// The standard's bounds. The parser refuses a group outside its size; the group count and the total are warnings only (see draftWarnings).
export const GROUP_SIZE_MIN = 4;
export const GROUP_SIZE_MAX = 8;
export const GROUP_COUNT_MIN = 8;
export const GROUP_COUNT_MAX = 12;
export const REQUIREMENT_COUNT_MIN = 50;
export const REQUIREMENT_COUNT_MAX = 100;
const TOTALS_NAME = "Totals";
const SHALL_OPENING = "the system shall";
const VIOLATIONS_CAP = 2_000;

/** A type, a title, then three or four documentation URLs: the standard wants the list drawn from three or four leading products. */
export const DRAFT_ARG_SPEC: ScriptArgSpec = {
  positionals: [
    { name: "type", pattern: CATEGORY_TYPE_RE, hint: "lower case letters, digits and hyphens, starting with a letter." },
    { name: "title" },
  ],
  rest: { name: "documentation URLs", min: 3, max: 4, kind: "url" },
  switches: ["force"],
  options: ["products", "allow"],
};

export const DRAFT_USAGE =
  'Usage: npm run catalogue:draft -- <type> "<title>" <url> <url> <url> [<url>] [--products "<name>,<name>"] [--allow <word>,<word>] [--force]';

/** The requirement standard from docs/specs/project-builder-catalogue-production.md, one rule per line. The prompt carries every line. */
export const REQUIREMENT_STANDARD: readonly string[] = [
  "A requirement is one sentence a prospect recognises as their own problem and a developer can turn into a screen or a rule.",
  "One sentence in plain English: it ends with a full stop and holds no other full stop, question mark or exclamation mark.",
  "British spelling.",
  "No em or en dashes.",
  "No product or vendor names.",
  "No hype words.",
  'Start with the thing, not with "The system shall".',
  'One behaviour per requirement. Do not use "and" to join two behaviours that could be wanted separately; split them.',
  "Each requirement sits one level below the module.",
  'Too coarse if it names a module: "Reporting." or "Pipeline management."',
  'Right if it names a behaviour with its edges: "Sequences: a timed series of emails and tasks that stops when the person replies."',
  'Too fine if it is testable on its own: "A reply cancels the remaining steps within one minute." That is an acceptance criterion, not a requirement.',
  "Four to eight requirements per group.",
  "Eight to twelve groups.",
  `Between ${REQUIREMENT_COUNT_MIN} and ${REQUIREMENT_COUNT_MAX} requirements in all.`,
];

// ── Schema ───────────────────────────────────────────────────────────────────

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

/** The capability keys a requirement may carry, plus `none`. */
export function draftKeyEnum(): string[] {
  return [...Object.keys(CAPABILITIES), NO_KEY];
}

/** The strict JSON schema of a draft answer. The size and key enums are built from the size list and the capability list, so the model cannot answer outside them. */
export function draftSchema(): NamedSchema {
  return {
    name: "catalogue_draft",
    strict: true,
    schema: obj({
      scope: text('A phrase that completes "requirements for ...", with no full stop.'),
      groups: list(
        obj({
          name: text("The group heading."),
          requirements: list(
            obj({
              id: text("The group's capital letter and a number counting from 1."),
              text: text("The requirement, one sentence."),
              baseline: { type: "boolean", description: "True only when every leading product of this kind covers it fully." },
              size: strEnum(CATALOGUE_SIZES, "Build effort."),
              key: strEnum(draftKeyEnum(), "The capability key, or none."),
            }),
            "The group's requirements, four to eight.",
          ),
        }),
        "The groups, eight to twelve.",
      ),
    }),
  };
}

// ── Prompt ───────────────────────────────────────────────────────────────────

const PAGE_FENCE = "```";

/** A block of outside text under a heading line, fenced. A fence inside the text is neutralised so it cannot close the block early. */
export function fenced(heading: string, body: string): string {
  return [heading, PAGE_FENCE, body.split(PAGE_FENCE).join("'''"), PAGE_FENCE].join("\n");
}

/** One page under its URL. */
export function fencedPage(page: FetchedPage): string {
  return fenced(`Page: ${page.url}`, page.text);
}

export interface DraftPromptInput {
  type: string;
  title: string;
  pages: readonly FetchedPage[];
}

/** The system turn holds the task and the standard; the type, the title and the page text sit in the user turn only. */
export function buildDraftPrompt(input: DraftPromptInput): { system: string; user: string } {
  const capabilityLines = (Object.keys(CAPABILITIES) as CapabilityKey[]).map((key) => `- ${key}: ${CAPABILITIES[key].title}`);
  const system = [
    "You write the requirement list for one category of business software, from the documentation of three or four leading products of that kind. The list is what a company would need if it built its own tool of this kind.",
    "",
    "The standard for every requirement:",
    ...REQUIREMENT_STANDARD.map((line) => `- ${line}`),
    "",
    "Ids: each group has its own capital letter, and a requirement's id is that letter followed by a number counting from 1 within the group (R1, R2, R3). No two groups share a letter.",
    "",
    "Baseline: true only when every leading product of this kind covers the requirement fully. It is a first guess that the product marks replace later.",
    "",
    `Size is build effort for a competent team building it properly once: ${sizeScaleSentence()}.`,
    "",
    `Key: the capability the requirement sits under, one of the keys below. Use ${NO_KEY} for connections to other systems and for admin and platform requirements.`,
    ...capabilityLines,
    `- ${NO_KEY}: connections, admin and platform`,
    "",
    'Scope: a phrase that completes "requirements for ...", such as "tools that manage contacts, deals, quotes and sales activity", with no full stop.',
    "",
    "Reply with only JSON in the given shape.",
    "",
    DATA_GUARD,
  ].join("\n");
  const user = [
    `Category type: ${input.type}`,
    `Category title: ${input.title}`,
    "",
    "Documentation pages:",
    "",
    input.pages.map(fencedPage).join("\n\n"),
  ].join("\n");
  return { system, user };
}

// ── Answer parser ────────────────────────────────────────────────────────────

export interface DraftGroup {
  name: string;
  requirements: CatalogueRequirement[];
}
export interface DraftAnswer {
  scope: string;
  groups: DraftGroup[];
}
export interface DraftParseOptions {
  /** Product and vendor names a requirement must not hold; matched as whole words, whatever the case. */
  forbiddenNames: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every violation in one error, so a rejected answer is read once. */
export function rejection(what: string, violations: readonly string[]): SchemaError {
  const message = `${what} rejected, ${violations.length} ${violations.length === 1 ? "problem" : "problems"}: ${violations.join("; ")}`;
  return new SchemaError(message.length > VIOLATIONS_CAP ? `${message.slice(0, VIOLATIONS_CAP)} (cut)` : message);
}

/**
 * Holds the model's answer to the standard and returns it, or throws one
 * SchemaError listing every violation. Strings are trimmed before they are
 * checked; nothing else is repaired.
 */
export function parseDraftAnswer(raw: unknown, options: DraftParseOptions): DraftAnswer {
  if (!isRecord(raw)) throw rejection("Draft answer", ["the answer is not an object"]);
  const violations: string[] = [];
  const forbidden = options.forbiddenNames
    .filter((name) => name.trim() !== "")
    .map((name) => ({ name, re: new RegExp(`\\b${escapeRegExp(name.trim())}\\b`, "i") }));

  const scope = typeof raw.scope === "string" ? raw.scope.trim() : "";
  if (scope === "") violations.push("scope is missing");
  else {
    if (/[.|\r\n]/.test(scope)) violations.push("scope holds a full stop, a pipe or a line break");
    if (hasLongDash(scope)) violations.push("scope holds an en or em dash");
  }

  const groups: DraftGroup[] = [];
  if (!Array.isArray(raw.groups) || raw.groups.length === 0) {
    violations.push("groups is missing or empty");
    throw rejection("Draft answer", violations);
  }
  const keys = draftKeyEnum();
  const names = new Set<string>();
  const ids = new Set<string>();
  const letterOwner = new Map<string, string>();

  (raw.groups as unknown[]).forEach((rawGroup, g) => {
    if (!isRecord(rawGroup)) {
      violations.push(`group ${g + 1} is not an object`);
      return;
    }
    const name = typeof rawGroup.name === "string" ? rawGroup.name.trim() : "";
    const label = name === "" ? `group ${g + 1}` : `group "${name}"`;
    if (!isCellSafe(name)) violations.push(`${label} has a name that is empty or holds a pipe or a line break`);
    if (hasLongDash(name)) violations.push(`${label} has an en or em dash in its name`);
    if (name === TOTALS_NAME) violations.push(`${label} uses the reserved name ${TOTALS_NAME}`);
    if (names.has(name)) violations.push(`${label} repeats a group name`);
    names.add(name);

    const rawRequirements: unknown[] = Array.isArray(rawGroup.requirements) ? rawGroup.requirements : [];
    if (rawRequirements.length < GROUP_SIZE_MIN || rawRequirements.length > GROUP_SIZE_MAX) {
      violations.push(`${label} has ${rawRequirements.length} requirements; a group holds ${GROUP_SIZE_MIN} to ${GROUP_SIZE_MAX}`);
    }
    const requirements: CatalogueRequirement[] = [];
    const letters = new Set<string>();
    rawRequirements.forEach((rawRequirement, r) => {
      if (!isRecord(rawRequirement)) {
        violations.push(`${label} requirement ${r + 1} is not an object`);
        return;
      }
      const id = typeof rawRequirement.id === "string" ? rawRequirement.id.trim() : "";
      const at = id === "" ? `${label} requirement ${r + 1}` : id;
      if (!REQUIREMENT_ID_RE.test(id)) {
        violations.push(`${at} has an id that is not one capital letter and one digit`);
      } else {
        if (ids.has(id)) violations.push(`${id} is a duplicate id`);
        ids.add(id);
        letters.add(id[0]);
        if (Number(id[1]) !== r + 1) violations.push(`${id} is out of order; the numbers in a group run from 1`);
      }

      const requirementText = typeof rawRequirement.text === "string" ? rawRequirement.text.trim() : "";
      if (!isCellSafe(requirementText)) violations.push(`${at} has a text that is empty or holds a pipe or a line break`);
      if (!isOneSentence(requirementText)) violations.push(`${at} is not one sentence ending in a full stop`);
      if (hasLongDash(requirementText)) violations.push(`${at} holds an en or em dash`);
      if (requirementText.toLowerCase().startsWith(SHALL_OPENING)) violations.push(`${at} starts with "The system shall"`);
      for (const { name: productName, re } of forbidden) {
        if (re.test(requirementText)) violations.push(`${at} names a product or vendor (${productName})`);
      }

      const size = rawRequirement.size;
      if (typeof size !== "string" || !(CATALOGUE_SIZES as readonly string[]).includes(size)) {
        violations.push(`${at} has a size outside ${CATALOGUE_SIZES.join(", ")}`);
      }
      const key = rawRequirement.key;
      if (typeof key !== "string" || !keys.includes(key)) violations.push(`${at} has a key that is neither a capability key nor ${NO_KEY}`);
      if (typeof rawRequirement.baseline !== "boolean") violations.push(`${at} has a baseline that is not true or false`);

      requirements.push({
        id,
        text: requirementText,
        baseline: rawRequirement.baseline === true,
        size: size as CatalogueSize,
        key: key as CatalogueKey,
      });
    });
    if (letters.size > 1) violations.push(`${label} uses more than one id letter (${[...letters].join(", ")})`);
    for (const letter of letters) {
      const owner = letterOwner.get(letter);
      if (owner !== undefined && owner !== label) violations.push(`${label} uses the letter ${letter}, which ${owner} already uses`);
      else letterOwner.set(letter, label);
    }
    groups.push({ name, requirements });
  });

  if (violations.length > 0) throw rejection("Draft answer", violations);
  return { scope, groups };
}

// ── From an answer to a category ─────────────────────────────────────────────

/**
 * An unpublished category with no product marked: header keys are the keys
 * used, without `none`, in order of first use. `products` are the names the
 * category will be marked against; they become the still to mark list, which
 * is what stops the first product marked from setting the baseline alone.
 */
export function draftToCategory(header: { type: string; title: string; products?: readonly string[] }, answer: DraftAnswer): ToolCategory {
  const keys: CapabilityKey[] = [];
  for (const group of answer.groups) {
    for (const requirement of group.requirements) {
      if (requirement.key !== NO_KEY && !keys.includes(requirement.key)) keys.push(requirement.key);
    }
  }
  return {
    type: header.type,
    title: header.title,
    keys,
    published: false,
    scope: answer.scope,
    groups: answer.groups.map((group) => ({ name: group.name, requirements: group.requirements.map((requirement) => ({ ...requirement })) })),
    patterns: [],
    products: [],
    pendingProducts: [...(header.products ?? [])],
    coverage: null,
    comments: [],
    evidence: [],
    notes: [],
    sources: null,
  };
}

/** What the standard asks of the whole list and the parser does not refuse: a reminder for the review, not an error. */
export function draftWarnings(answer: DraftAnswer): string[] {
  const warnings: string[] = [];
  const total = answer.groups.reduce((n, group) => n + group.requirements.length, 0);
  if (answer.groups.length < GROUP_COUNT_MIN || answer.groups.length > GROUP_COUNT_MAX) {
    warnings.push(`${answer.groups.length} groups; the standard asks for ${GROUP_COUNT_MIN} to ${GROUP_COUNT_MAX}.`);
  }
  if (total < REQUIREMENT_COUNT_MIN || total > REQUIREMENT_COUNT_MAX) {
    warnings.push(`${total} requirements; the standard asks for ${REQUIREMENT_COUNT_MIN} to ${REQUIREMENT_COUNT_MAX}.`);
  }
  return warnings;
}

/**
 * The `--products` value as the names for the still to mark list: comma
 * separated, each held to the product name rule, none given twice. A name
 * that itself holds a comma cannot be given this way; add it to the file by
 * hand. No value gives an empty list.
 */
export function parseProductList(value: string | undefined): { ok: true; names: string[] } | { ok: false; message: string } {
  const names = splitList(value);
  for (const name of names) {
    const problem = productNameProblem(name);
    if (problem !== null) return { ok: false, message: problem };
  }
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated !== undefined) return { ok: false, message: `The product name "${repeated}" is given more than once.` };
  return { ok: true, names };
}

/** What the draft script says about the still to mark list before it spends a call. */
export function pendingProductsNotice(names: readonly string[]): string {
  if (names.length > 0) return `Still to mark, written into the file: ${names.join(", ")}.`;
  return 'No --products given, so the file will have no still to mark list and the first product marked would set every baseline flag alone. Pass --products "<name>,<name>" or add the list by hand before marking.';
}

const SECOND_LEVEL_LABELS: readonly string[] = ["co", "com", "org", "net", "ac", "gov", "edu"];

/**
 * The names a draft must not use, taken from the documentation hosts: the
 * registrable label of each (developers.example.com gives "example"), four
 * letters or more, each once. A host label can be an ordinary word (a host
 * named after the word "close" would forbid "Close a deal as won or lost."),
 * so `allow` takes words off the list, whatever their case.
 */
export function forbiddenNamesFromUrls(urls: readonly string[], allow: readonly string[] = []): string[] {
  const allowed = new Set(allow.map((word) => word.trim().toLowerCase()));
  const names: string[] = [];
  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }
    const labels = host.split(".").filter((label) => label !== "");
    if (labels.length < 2) continue;
    const last = labels[labels.length - 1];
    const twoPartSuffix = labels.length >= 3 && last.length === 2 && SECOND_LEVEL_LABELS.includes(labels[labels.length - 2]);
    const label = labels[labels.length - (twoPartSuffix ? 3 : 2)];
    if (label.length >= 4 && !allowed.has(label) && !names.includes(label)) names.push(label);
  }
  return names;
}

/** What the draft script prints before the call, so a host label that is an ordinary word is seen while it is still free to fix. */
export function forbiddenNamesNotice(names: readonly string[]): string {
  if (names.length === 0) return "No word is forbidden in a requirement: the documentation hosts gave no name to hold back.";
  return (
    `Words a requirement may not hold, taken from the documentation hosts: ${names.join(", ")}. ` +
    "An answer that uses one is rejected after the call. If one is an ordinary word, stop now and pass --allow <word>[,<word>]."
  );
}
