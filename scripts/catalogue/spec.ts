/**
 * The spec check's pure half: recognise a public API specification, pull
 * out its resources and operations, and write them as a plain text listing.
 * Three shapes are read: an OpenAPI document in JSON, an OpenAPI document in
 * block style YAML (by a line scanner, not a YAML parser), and the HubSpot
 * public API index. Nothing here fetches or reads a file.
 *
 * The YAML scanner reads paths, methods, summaries, operation ids and tags
 * and nothing else. It does not read tab indentation, flow style mappings,
 * anchors, `$ref` path items or more than one document in a file; such a
 * file gives no operations and the script says so. It never guesses.
 */
import type { ScriptArgSpec } from "./io.ts";

export type SpecFormat = "openapi-json" | "openapi-yaml" | "hubspot-index";

/** One operation of an OpenAPI document. `resource` is its first tag, or failing that the first plain segment of the path. */
export interface SpecOperation {
  resource: string;
  method: string;
  path: string;
  summary: string;
}
/** One API of the HubSpot index. `tier` is the tier the chosen hub needs for it, or null when the index does not state one. */
export interface SpecIndexEntry {
  name: string;
  group: string;
  stableVersion: string | null;
  newestVersion: string;
  newestStage: string;
  tier: string | null;
}
/** What one source gave: a listing has one section per source, since a product may publish more than one file. */
export type SpecSection =
  | { source: string; format: "openapi-json" | "openapi-yaml"; operations: SpecOperation[] }
  | { source: string; format: "hubspot-index"; hub: string; entries: SpecIndexEntry[] };

export const SPEC_FORMAT_NAMES: Record<SpecFormat, string> = {
  "openapi-json": "OpenAPI JSON",
  "openapi-yaml": "OpenAPI YAML",
  "hubspot-index": "HubSpot API index",
};

export const DEFAULT_HUB = "sales";

/** A product name, then one to ten sources, each a URL or a local path. */
export const SPEC_CHECK_ARG_SPEC: ScriptArgSpec = {
  positionals: [{ name: "product name" }],
  rest: { name: "sources", min: 1, max: 10, kind: "source" },
  options: ["hub"],
};

export const SPEC_CHECK_USAGE = 'Usage: npm run catalogue:spec-check -- "<product name>" <url or path> [<url or path> ...] [--hub sales]';
const SUMMARY_CAP = 160;
const METHODS: readonly string[] = ["get", "put", "post", "delete", "patch", "head", "options", "trace"];
const ROOT_RESOURCE = "(root)";
const NO_GROUP = "(no group)";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tidySummary(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > SUMMARY_CAP ? collapsed.slice(0, SUMMARY_CAP).trimEnd() : collapsed;
}

/** The first path segment that is not a parameter, not `api` and not a version such as v2. */
function resourceFromPath(path: string): string {
  for (const segment of path.split("/")) {
    if (segment === "" || segment === "api") continue;
    if (/^\{.*\}$/.test(segment) || /^v\d+$/.test(segment)) continue;
    return segment;
  }
  return ROOT_RESOURCE;
}

const PATHS_LINE_RE = /^paths:\s*(#.*)?$/;
const BYTE_ORDER_MARK = 0xfeff;

/** Some servers and editors put a byte order mark before the first character; JSON.parse and the column 0 rules both trip on it. */
export function stripByteOrderMark(text: string): string {
  return text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
}

/** By content, never by file extension or content type. Null when the text is none of the three shapes. */
export function detectSpecFormat(source: string): SpecFormat | null {
  if (typeof source !== "string") return null;
  const text = stripByteOrderMark(source);
  if (text.trimStart().startsWith("{")) {
    let document: unknown;
    try {
      document = JSON.parse(text);
    } catch {
      return null;
    }
    if (!isRecord(document)) return null;
    if (isRecord(document.paths)) return "openapi-json";
    if (Array.isArray(document.results)) {
      const first: unknown = document.results[0];
      if (isRecord(first) && typeof first.name === "string" && Array.isArray(first.versions)) return "hubspot-index";
    }
    return null;
  }
  const lines = text.split(/\r?\n/);
  const hasPaths = lines.some((line) => PATHS_LINE_RE.test(line));
  const hasVersion = lines.some((line) => /^(openapi|swagger):/.test(line));
  return hasPaths && hasVersion ? "openapi-yaml" : null;
}

// ── OpenAPI in JSON ──────────────────────────────────────────────────────────

/** Paths and methods in document order. Path level keys that are not methods are ignored. */
export function extractOpenApiJson(document: unknown): SpecOperation[] {
  if (!isRecord(document) || !isRecord(document.paths)) return [];
  const operations: SpecOperation[] = [];
  for (const [path, item] of Object.entries(document.paths)) {
    if (!isRecord(item)) continue;
    for (const [key, operation] of Object.entries(item)) {
      if (!METHODS.includes(key) || !isRecord(operation)) continue;
      let summary = "";
      if (typeof operation.summary === "string" && operation.summary.trim() !== "") summary = operation.summary;
      else if (typeof operation.operationId === "string" && operation.operationId.trim() !== "") summary = operation.operationId;
      else if (typeof operation.description === "string") summary = operation.description.trim().split(/\r?\n/)[0] ?? "";
      const tag: unknown = Array.isArray(operation.tags) ? operation.tags[0] : undefined;
      const resource = typeof tag === "string" && tag.trim() !== "" ? tag.trim() : resourceFromPath(path);
      operations.push({ resource, method: key.toUpperCase(), path, summary: tidySummary(summary) });
    }
  }
  return operations;
}

// ── OpenAPI in block style YAML: the line scanner ────────────────────────────

function indentOf(line: string): number {
  let n = 0;
  while (n < line.length && line[n] === " ") n += 1;
  return n;
}

function isSkippable(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

/** A plain, single quoted or double quoted scalar on one line; a trailing comment is dropped from a plain one. */
function readScalar(value: string): string {
  const text = value.trim();
  if (text.startsWith("'")) {
    const match = /^'((?:[^']|'')*)'/.exec(text);
    return match ? match[1].replace(/''/g, "'") : text.slice(1);
  }
  if (text.startsWith('"')) {
    const match = /^"((?:[^"\\]|\\.)*)"/.exec(text);
    if (!match) return text.slice(1);
    try {
      const parsed: unknown = JSON.parse(`"${match[1]}"`);
      return typeof parsed === "string" ? parsed : match[1];
    } catch {
      return match[1];
    }
  }
  return text.replace(/\s+#.*$/, "").trim();
}

/** The key of a path line: bare or quoted, ending in a colon with nothing after it but a comment. Null for anything else. */
function readPathKey(content: string): string | null {
  const single = /^'((?:[^']|'')*)':\s*(#.*)?$/.exec(content);
  if (single) return single[1].replace(/''/g, "'");
  const double = /^"((?:[^"\\]|\\.)*)":\s*(#.*)?$/.exec(content);
  if (double) return double[1];
  const bare = content.replace(/\s+#.*$/, "").trimEnd();
  if (!bare.endsWith(":")) return null;
  const key = bare.slice(0, -1);
  return key === "" || /\s/.test(key) ? null : key;
}

interface YamlOperation {
  method: string;
  path: string;
  summary: string;
  operationId: string;
  tag: string;
}

/**
 * Reads the `paths:` block of a block style OpenAPI YAML file. The three
 * indent levels (path, method, operation) are learned from the file. Inside
 * an operation only `summary`, `operationId` and `tags` are read, and only
 * at the operation level, so a `summary:` inside a response or the text
 * "get:" inside a description is never mistaken for one.
 */
export function extractOpenApiYaml(text: string): SpecOperation[] {
  if (typeof text !== "string") return [];
  const all = stripByteOrderMark(text).split(/\r?\n/);
  const start = all.findIndex((line) => PATHS_LINE_RE.test(line));
  if (start < 0) return [];
  const block: string[] = [];
  for (let i = start + 1; i < all.length; i += 1) {
    const line = all[i];
    if (!isSkippable(line) && indentOf(line) === 0) break;
    block.push(line);
  }

  const first = block.find((line) => !isSkippable(line));
  if (first === undefined) return [];
  const pathIndent = indentOf(first);
  let methodIndent: number | null = null;
  let operationIndent: number | null = null;
  let currentPath: string | null = null;
  let current: YamlOperation | null = null;
  const found: YamlOperation[] = [];
  const close = () => {
    if (current) found.push(current);
    current = null;
  };

  let i = 0;
  while (i < block.length) {
    const line = block[i];
    i += 1;
    if (isSkippable(line)) continue;
    const indent = indentOf(line);
    const content = line.slice(indent);

    if (indent <= pathIndent) {
      close();
      const key = indent === pathIndent ? readPathKey(content) : null;
      currentPath = key !== null && key.startsWith("/") ? key : null;
      continue;
    }
    if (currentPath === null) continue;
    if (methodIndent === null) methodIndent = indent;
    if (indent === methodIndent) {
      close();
      const method = /^([a-z]+):\s*(#.*)?$/.exec(content);
      if (method && METHODS.includes(method[1])) {
        current = { method: method[1].toUpperCase(), path: currentPath, summary: "", operationId: "", tag: "" };
      }
      continue;
    }
    if (current === null || indent < methodIndent) continue;
    if (operationIndent === null) operationIndent = indent;
    if (indent !== operationIndent) continue;

    const pair = /^(summary|operationId|tags):(.*)$/.exec(content);
    if (!pair) continue;
    const value = pair[2].trim();
    if (pair[1] === "tags") {
      if (value.startsWith("[")) {
        const inner = value.replace(/^\[/, "").replace(/\].*$/, "");
        const items = inner.split(",").map((item) => readScalar(item)).filter((item) => item !== "");
        current.tag = items[0] ?? "";
      } else if (value === "" || value.startsWith("#")) {
        const items: string[] = [];
        while (i < block.length) {
          const next = block[i];
          if (isSkippable(next)) {
            i += 1;
            continue;
          }
          const nextContent = next.slice(indentOf(next));
          if (indentOf(next) < operationIndent || !/^-(\s|$)/.test(nextContent)) break;
          items.push(readScalar(nextContent.slice(1)));
          i += 1;
        }
        current.tag = items.find((item) => item !== "") ?? "";
      }
    } else if (/^[|>][+-]?\d*[+-]?\s*(#.*)?$/.test(value)) {
      const parts: string[] = [];
      while (i < block.length) {
        const next = block[i];
        if (next.trim() !== "" && indentOf(next) <= operationIndent) break;
        if (next.trim() !== "") parts.push(next.trim());
        i += 1;
      }
      if (pair[1] === "summary") current.summary = parts.join(" ");
      else current.operationId = parts.join(" ");
    } else if (pair[1] === "summary") {
      current.summary = readScalar(value);
    } else {
      current.operationId = readScalar(value);
    }
  }
  close();

  return found.map((operation) => ({
    resource: operation.tag !== "" ? operation.tag : resourceFromPath(operation.path),
    method: operation.method,
    path: operation.path,
    summary: tidySummary(operation.summary !== "" ? operation.summary : operation.operationId),
  }));
}

// ── The HubSpot public API index ─────────────────────────────────────────────

interface IndexVersion {
  version: string;
  stage: string;
  requirements: Record<string, unknown>;
}

/** Dated versions (YYYY-MM) rank above numbered ones (digits only), which rank above anything else. */
function versionClass(version: string): number {
  if (/^\d{4}-\d{2}$/.test(version)) return 2;
  if (/^\d+$/.test(version)) return 1;
  return 0;
}

/** Negative when `a` ranks above `b`. */
function compareVersions(a: string, b: string): number {
  const classA = versionClass(a);
  const classB = versionClass(b);
  if (classA !== classB) return classB - classA;
  if (classA === 1) return Number(b) - Number(a);
  return a < b ? 1 : a > b ? -1 : 0;
}

function tierName(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const lower = value.trim().toLowerCase();
  return lower[0].toUpperCase() + lower.slice(1);
}

/**
 * One entry per API in the index. The stable version is the highest ranked
 * version whose stage is STABLE. The tier is the one the stable version
 * needs for `hub`; when that is not stated, the first stated tier walking
 * the versions from the highest rank down. Entries with no name or no
 * versions list are skipped.
 */
export function extractHubSpotIndex(document: unknown, hub: string = DEFAULT_HUB): SpecIndexEntry[] {
  if (!isRecord(document) || !Array.isArray(document.results)) return [];
  const entries: SpecIndexEntry[] = [];
  for (const item of document.results as unknown[]) {
    if (!isRecord(item) || typeof item.name !== "string" || item.name.trim() === "" || !Array.isArray(item.versions)) continue;
    const versions: IndexVersion[] = [];
    for (const candidate of item.versions as unknown[]) {
      if (!isRecord(candidate) || typeof candidate.version !== "string" || candidate.version.trim() === "") continue;
      versions.push({
        version: candidate.version.trim(),
        stage: typeof candidate.stage === "string" ? candidate.stage : "",
        requirements: isRecord(candidate.requirements) ? candidate.requirements : {},
      });
    }
    if (versions.length === 0) continue;
    versions.sort((a, b) => compareVersions(a.version, b.version));
    const stable = versions.find((version) => version.stage === "STABLE") ?? null;
    let tier = stable ? tierName(stable.requirements[hub]) : null;
    if (tier === null) {
      for (const version of versions) {
        tier = tierName(version.requirements[hub]);
        if (tier !== null) break;
      }
    }
    entries.push({
      name: item.name.trim(),
      group: typeof item.group === "string" && item.group.trim() !== "" ? item.group.trim() : NO_GROUP,
      stableVersion: stable ? stable.version : null,
      newestVersion: versions[0].version,
      newestStage: versions[0].stage,
      tier,
    });
  }
  return entries;
}

// ── The listing ──────────────────────────────────────────────────────────────

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function stageWords(stage: string): string {
  const words = stage.replace(/_/g, " ").trim().toLowerCase();
  return words === "" ? "stage not stated" : words;
}

/**
 * The plain text listing: no date, the same bytes for the same input.
 * Resources come in order of first appearance and operations in document
 * order; index groups come in alphabetical order with their entries by name.
 */
export function formatSpecListing(productName: string, sections: readonly SpecSection[]): string {
  const lines: string[] = [`Specification listing: ${productName}`];
  for (const section of sections) {
    lines.push("", `Source: ${section.source}`, `Format: ${SPEC_FORMAT_NAMES[section.format]}`);
    if (section.format === "hubspot-index") {
      const groups = [...new Set(section.entries.map((entry) => entry.group))].sort(byText);
      lines.push(`APIs: ${section.entries.length} in ${groups.length} groups. Tier shown for: ${section.hub}.`);
      for (const group of groups) {
        lines.push("", group);
        const entries = section.entries.filter((entry) => entry.group === group).sort((a, b) => byText(a.name, b.name));
        for (const entry of entries) {
          const version =
            entry.stableVersion !== null ? `stable ${entry.stableVersion}` : `no stable version (${entry.newestVersion}, ${stageWords(entry.newestStage)})`;
          lines.push(`  ${entry.name}  ${version}  tier ${entry.tier ?? "not stated"}`);
        }
      }
    } else {
      const resources = [...new Set(section.operations.map((operation) => operation.resource))];
      lines.push(`Resources: ${resources.length}. Operations: ${section.operations.length}.`);
      for (const resource of resources) {
        lines.push("", resource);
        for (const operation of section.operations) {
          if (operation.resource !== resource) continue;
          lines.push(`  ${operation.method} ${operation.path}${operation.summary === "" ? "" : `  ${operation.summary}`}`);
        }
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

/** How many operations or entries a section holds, for the script's summary line and its empty check. */
export function sectionSize(section: SpecSection): number {
  return section.format === "hubspot-index" ? section.entries.length : section.operations.length;
}

/** Detects the format of one source and runs the matching extractor. Null when the text is none of the three shapes. */
export function readSpecSection(source: string, text: string, hub: string = DEFAULT_HUB): SpecSection | null {
  const format = detectSpecFormat(text);
  if (format === null) return null;
  if (format === "openapi-yaml") return { source, format, operations: extractOpenApiYaml(text) };
  const document: unknown = JSON.parse(stripByteOrderMark(text));
  if (format === "openapi-json") return { source, format, operations: extractOpenApiJson(document) };
  return { source, format, hub, entries: extractHubSpotIndex(document, hub) };
}
