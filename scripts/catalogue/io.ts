/**
 * What the catalogue scripts share. The first half is pure and tested: the
 * configuration check, the argument reader, the product name rule, the
 * slug, the page text caps and the content type rule. The second half is
 * the thin impure layer: fetch a body with a time and size limit, read a
 * source that is a URL or a local path, and write a file into the git
 * ignored cache folder. Nothing here prints or reads a secret's value.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cutAtWord, stripVisibleText } from "../../app/lib/ask-summit/crawl-rules.ts";
import { ALL_PRODUCTS, hasLongDash, isCellSafe } from "../../app/lib/project-builder/tool-catalogue.ts";

export const CACHE_DIR = ".catalogue-cache";
export const SCRIPT_USER_AGENT = "SummitCatalogueScript/1.0";

/** Exit codes shared by the four scripts. */
export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_CONFIG = 2;

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * The names of the variables a model call needs and the environment lacks.
 * Redis is required, not optional: without it the call is not logged, and
 * these calls are logged with cost like the rest. Names only, never a value.
 */
export function missingCatalogueEnv(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  if (!env.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
  const hasRedis = (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) || (env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
  if (!hasRedis) missing.push("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
  return missing;
}

// ── Arguments ────────────────────────────────────────────────────────────────

export interface ScriptArgSpec {
  /** The named arguments that come first, in order. A pattern, when given, must match. */
  positionals: readonly { name: string; pattern?: RegExp; hint?: string }[];
  /** The list that follows them: documentation URLs, or sources that may be a URL or a local path. */
  rest: { name: string; min: number; max: number; kind: "url" | "source"; optionalWith?: string };
  /** Flags that take no value, without the two hyphens. */
  switches?: readonly string[];
  /** Flags that take the next argument as their value, without the two hyphens. */
  options?: readonly string[];
}

/** The command line read against a spec, or the message for the usage error. `rest` holds the URLs or sources in the order given. */
export type ScriptArgs =
  | { ok: true; positionals: Record<string, string>; rest: string[]; switches: Record<string, boolean>; options: Record<string, string | undefined> }
  | { ok: false; message: string };

/** True for an http or https URL with a host. Documentation pages are fetched, never read from disk, so anything else is a usage error. */
export function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    return new URL(value).hostname.length > 0;
  } catch {
    return false;
  }
}

/** Reads `process.argv.slice(2)` against a script's spec. Never throws; a bad command line gives a message for the usage error. */
export function parseScriptArgs(argv: readonly string[], spec: ScriptArgSpec): ScriptArgs {
  const switches: Record<string, boolean> = {};
  const options: Record<string, string | undefined> = {};
  for (const name of spec.switches ?? []) switches[name] = false;
  for (const name of spec.options ?? []) options[name] = undefined;
  const plain: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      plain.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if ((spec.switches ?? []).includes(name)) {
      switches[name] = true;
    } else if ((spec.options ?? []).includes(name)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return { ok: false, message: `--${name} needs a value.` };
      options[name] = value;
      i += 1;
    } else {
      return { ok: false, message: `Unknown flag ${arg}.` };
    }
  }

  const positionals: Record<string, string> = {};
  for (const [index, positional] of spec.positionals.entries()) {
    const value = plain[index];
    if (value === undefined || value.trim() === "") return { ok: false, message: `Missing ${positional.name}.` };
    if (positional.pattern && !positional.pattern.test(value)) {
      return { ok: false, message: `${positional.name} "${value}" is not valid${positional.hint ? `: ${positional.hint}` : "."}` };
    }
    positionals[positional.name] = value;
  }

  const rest = plain.slice(spec.positionals.length);
  const optional = spec.rest.optionalWith !== undefined && options[spec.rest.optionalWith] !== undefined;
  const min = optional ? 0 : spec.rest.min;
  if (rest.length < min || rest.length > spec.rest.max) {
    const range = spec.rest.min === spec.rest.max ? `${spec.rest.min}` : `${spec.rest.min} to ${spec.rest.max}`;
    return { ok: false, message: `Expected ${range} ${spec.rest.name} and found ${rest.length}.` };
  }
  if (spec.rest.kind === "url") {
    const bad = rest.find((value) => !isHttpUrl(value));
    if (bad !== undefined) return { ok: false, message: `"${bad}" is not an http or https URL.` };
  }
  return { ok: true, positionals, rest, switches, options };
}

// ── Names ────────────────────────────────────────────────────────────────────

/**
 * What is wrong with a product name, or null when it is fit to be written
 * into a category file. The name is the key that joins the coverage, product,
 * comment and evidence tables, so it is checked before anything is fetched
 * or paid for.
 */
export function productNameProblem(name: string): string | null {
  if (typeof name !== "string" || name.trim() === "") return "The product name is empty.";
  if (name !== name.trim()) return `The product name "${name}" must not start or end with a space.`;
  if (!isCellSafe(name)) return `The product name "${name}" must not hold a pipe or a line break.`;
  if (hasLongDash(name)) return `The product name "${name}" must not hold an en or em dash.`;
  if (name === ALL_PRODUCTS) return `"${ALL_PRODUCTS}" is reserved for comments on every product and cannot be a product name.`;
  return null;
}

/** A comma separated flag value as a list of trimmed, non empty items. */
export function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// ── Text ─────────────────────────────────────────────────────────────────────

/** A file name safe form of a product name: lower case letters and digits joined by hyphens. */
export function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned === "" ? "product" : cleaned;
}

/** A page as a reader sees it, cut to `cap` characters on a word boundary. */
export function pageText(html: string, cap: number): string {
  return cutAtWord(stripVisibleText(html).text, cap);
}

export interface FetchedPage {
  url: string;
  text: string;
}

/**
 * Holds the pages together to `total` characters. Short pages keep all of
 * their text and the room they leave is shared between the longer ones, so
 * one long page cannot crowd the others out.
 */
export function capPages(pages: readonly FetchedPage[], total: number): FetchedPage[] {
  const allowance = new Map<number, number>();
  const order = pages.map((page, index) => ({ index, length: page.text.length })).sort((a, b) => a.length - b.length || a.index - b.index);
  let remaining = Math.max(0, total);
  let left = order.length;
  for (const item of order) {
    const share = Math.floor(remaining / left);
    const granted = Math.min(item.length, share);
    allowance.set(item.index, granted);
    remaining -= granted;
    left -= 1;
  }
  return pages.map((page, index) => ({ url: page.url, text: cutAtWord(page.text, allowance.get(index) ?? 0) }));
}

/**
 * True when a response's Content-Type says the body is text the scripts can
 * read: any text type, JSON, XML or YAML, with or without a structured
 * suffix such as +json. A PDF, an image or a download of unknown bytes is
 * not, and is never sent to the model as text. A response with no
 * Content-Type is let through, since some hosts serve plain files that way.
 */
export function isReadableContentType(header: string | null | undefined): boolean {
  if (header === null || header === undefined || header.trim() === "") return true;
  const type = header.split(";")[0].trim().toLowerCase();
  if (type.startsWith("text/")) return true;
  if (/^application\/(json|xml|yaml|x-yaml|vnd\.oai\.openapi)$/.test(type)) return true;
  return /^application\/[a-z0-9.+-]*\+(json|xml|yaml)$/.test(type);
}

// ── The thin impure layer ────────────────────────────────────────────────────

export interface FetchLimits {
  timeoutMs: number;
  maxBytes: number;
  /** Past the size limit: `cut` keeps what fits (a page), `fail` throws (a specification must be whole). */
  overflow: "cut" | "fail";
}

/**
 * Fetches a body as text within the limits. Throws with a plain message on a
 * bad status, a timeout, an oversized body, or a body that is not text, JSON,
 * XML or YAML by its Content-Type; the caller prints the message and skips
 * or stops. A local file is read by `readSource` and is not held to this.
 */
export async function fetchBody(url: string, limits: FetchLimits): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": SCRIPT_USER_AGENT, Accept: "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(limits.timeoutMs),
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const contentType = response.headers.get("content-type");
  if (!isReadableContentType(contentType)) {
    await response.body?.cancel();
    throw new Error(`${url} is ${contentType}, not text, JSON, XML or YAML, so it was not read`);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.length > limits.maxBytes) {
      await reader.cancel();
      if (limits.overflow === "fail") throw new Error(`${url} is larger than ${limits.maxBytes} bytes`);
      chunks.push(value.subarray(0, limits.maxBytes - size));
      size = limits.maxBytes;
      break;
    }
    chunks.push(value);
    size += value.length;
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/** A source that starts with http:// or https:// is fetched; anything else is read as a local path. */
export async function readSource(source: string, limits: FetchLimits): Promise<string> {
  if (/^https?:\/\//i.test(source)) return fetchBody(source, limits);
  return readFileSync(resolve(process.cwd(), source), "utf8");
}

/** Writes a file under the cache folder, creating folders as needed, and returns its path relative to the repository. */
export function writeCacheFile(relativePath: string, text: string): string {
  const path = `${CACHE_DIR}/${relativePath}`;
  const absolute = resolve(process.cwd(), path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, text, "utf8");
  return path;
}
