/**
 * Validation for the Ask Summit form and its routes: the website URL, the
 * same-host rule the crawler shares, the company email rule with the
 * free-mail list, the three file types by extension and magic bytes, the
 * limits, and the request id and upload prefix shapes. Pure: no Node built-in
 * module, no Redis, so the browser form, the routes, the crawler and the
 * tests read one definition. The email hash is computed by the caller
 * through `hashEmail` (unlock-token.ts needs the Node crypto module).
 */
import {
  EMAIL_MESSAGE,
  FILE_COUNT_MESSAGE,
  FILE_NAME_MESSAGE,
  FILE_SIZE_MESSAGE,
  FILE_TYPE_MESSAGE,
  FREE_MAIL_MESSAGE,
  URL_MESSAGE,
} from "./copy.ts";

// ── Website URL ──────────────────────────────────────────────────────────────

export const URL_MAX_LENGTH = 2048;

export type UrlValidation = { ok: true; url: string; host: string } | { ok: false; error: string };

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"];

/**
 * The crawler fetches whatever host the form names, so a bare name, a
 * loopback, an IP literal or a private suffix is refused before any
 * request is stored; the crawler must never be pointed inside the network.
 */
function isBlockedHost(hostname: string): boolean {
  if (!hostname.includes(".")) return true;
  if (hostname === "localhost" || hostname.startsWith("[") || IPV4_PATTERN.test(hostname)) return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Trims, prefixes `https://` when no scheme is given, requires http or
 * https with no credentials and a public-looking hostname, lowercases the
 * host (the URL parser does), drops the fragment and keeps the query on the
 * start URL only. The error is the one message the form shows.
 */
export function validateWebsiteUrl(value: unknown): UrlValidation {
  if (typeof value !== "string") return { ok: false, error: URL_MESSAGE };
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > URL_MAX_LENGTH) return { ok: false, error: URL_MESSAGE };
  const withScheme = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: URL_MESSAGE };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, error: URL_MESSAGE };
  if (parsed.username || parsed.password) return { ok: false, error: URL_MESSAGE };
  if (isBlockedHost(parsed.hostname)) return { ok: false, error: URL_MESSAGE };
  parsed.hash = "";
  return { ok: true, url: parsed.toString(), host: parsed.hostname };
}

/** The lowercase hostname of a URL or a bare hostname, with one leading `www.` stripped; null when unparsable. */
export function hostOf(urlOrHost: string): string | null {
  let host = urlOrHost.trim().toLowerCase();
  if (host.length === 0) return null;
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  }
  if (host.startsWith("www.")) host = host.slice(4);
  return host.length > 0 ? host : null;
}

/** `example.com` and `www.example.com` are one site; `blog.example.com` is another. */
export function isSameHost(a: string, b: string): boolean {
  const ha = hostOf(a);
  const hb = hostOf(b);
  return ha !== null && hb !== null && ha === hb;
}

// ── Company email ────────────────────────────────────────────────────────────

export const EMAIL_MAX_LENGTH = 254;

/** One `@`, a dot in the domain, no spaces, under 254 characters (the 1b gate's rule). */
export function isEmailShaped(value: string): boolean {
  if (value.length === 0 || value.length >= EMAIL_MAX_LENGTH || /\s/.test(value)) return false;
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;
  const domain = value.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

export const FREE_MAIL_DOMAINS: readonly string[] = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "aol.com",
  "gmx.com",
  "gmx.de",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "fastmail.com",
  "hey.com",
];

export type EmailValidation = { ok: true; email: string; domain: string } | { ok: false; error: string };

/** Shaped, and the domain (exact match, lowercase) not on the free-mail list. The domain is lowercased in the result. */
export function validateCompanyEmail(value: unknown): EmailValidation {
  if (typeof value !== "string") return { ok: false, error: EMAIL_MESSAGE };
  const trimmed = value.trim();
  if (!isEmailShaped(trimmed)) return { ok: false, error: EMAIL_MESSAGE };
  const at = trimmed.indexOf("@");
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (FREE_MAIL_DOMAINS.includes(domain)) return { ok: false, error: FREE_MAIL_MESSAGE };
  return { ok: true, email: `${trimmed.slice(0, at)}@${domain}`, domain };
}

// ── Files ────────────────────────────────────────────────────────────────────

export type AskFileType = "pdf" | "pptx" | "docx";

export interface AllowedFileType {
  type: AskFileType;
  extension: string;
  contentType: string;
  /** The bytes a file of this type starts with. */
  magic: readonly number[];
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04

export const ALLOWED_FILE_TYPES: readonly AllowedFileType[] = [
  { type: "pdf", extension: ".pdf", contentType: "application/pdf", magic: PDF_MAGIC },
  { type: "pptx", extension: ".pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", magic: ZIP_MAGIC },
  { type: "docx", extension: ".docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: ZIP_MAGIC },
];

/** Some browsers send this for Office files; the magic bytes decide later. */
export const OCTET_STREAM = "application/octet-stream";

export const ACCEPTED_CONTENT_TYPES: readonly string[] = [...ALLOWED_FILE_TYPES.map((t) => t.contentType), OCTET_STREAM];

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const FILE_NAME_MAX = 200;

/** The last extension only, case insensitive: `deck.pdf.exe` is not a PDF. */
export function fileTypeFromName(name: string): AskFileType | null {
  const lower = name.trim().toLowerCase();
  const found = ALLOWED_FILE_TYPES.find((t) => lower.endsWith(t.extension) && lower.length > t.extension.length);
  return found ? found.type : null;
}

export function contentTypeFor(type: AskFileType): string {
  return (ALLOWED_FILE_TYPES.find((t) => t.type === type) as AllowedFileType).contentType;
}

function startsWithBytes(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i += 1) if (bytes[i] !== magic[i]) return false;
  return true;
}

/**
 * The magic bytes check: `%PDF-` with a `.pdf` name is a PDF; the zip
 * signature with a `.docx` or `.pptx` name is that type (the office
 * extractor confirms the entry names later); anything else is null.
 */
export function sniffFileType(bytes: Uint8Array, name: string): AskFileType | null {
  const expected = fileTypeFromName(name);
  if (!expected) return null;
  const entry = ALLOWED_FILE_TYPES.find((t) => t.type === expected) as AllowedFileType;
  return startsWithBytes(bytes, entry.magic) ? expected : null;
}

export interface FileMeta {
  name: string;
  size: number;
  contentType?: string;
}

export type FileMetaValidation<T extends FileMeta> = { ok: true; files: Array<T & { type: AskFileType }> } | { ok: false; error: string };

/**
 * At most three files, each named 1 to 200 characters with a known
 * extension, sized 1 byte to 25 MB, with an accepted content type (or none
 * given), names unique. The result carries the type each name implies.
 */
export function validateFileMeta<T extends FileMeta>(files: readonly T[]): FileMetaValidation<T> {
  if (files.length > MAX_FILES) return { ok: false, error: FILE_COUNT_MESSAGE };
  const seen = new Set<string>();
  const out: Array<T & { type: AskFileType }> = [];
  for (const file of files) {
    const name = typeof file.name === "string" ? file.name.trim() : "";
    if (name.length === 0 || name.length > FILE_NAME_MAX || seen.has(name)) return { ok: false, error: FILE_NAME_MESSAGE };
    seen.add(name);
    const type = fileTypeFromName(name);
    if (!type) return { ok: false, error: FILE_TYPE_MESSAGE };
    if (!Number.isFinite(file.size) || file.size < 1 || file.size > MAX_FILE_BYTES) return { ok: false, error: FILE_SIZE_MESSAGE };
    if (file.contentType && !ACCEPTED_CONTENT_TYPES.includes(file.contentType)) return { ok: false, error: FILE_TYPE_MESSAGE };
    out.push({ ...file, name, type });
  }
  return { ok: true, files: out };
}

/** A pathname-safe file name: letters, digits, dot, hyphen and underscore, cut to 120 characters with the extension kept. */
export function safeFileName(name: string): string {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf(".");
  const extension = dot > 0 ? trimmed.slice(dot).toLowerCase() : "";
  const stem = (dot > 0 ? trimmed.slice(0, dot) : trimmed)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "");
  const base = stem.length > 0 ? stem.slice(0, 120 - extension.length) : "file";
  return `${base}${extension}`;
}

// ── Request ids and the upload prefix ────────────────────────────────────────

export const REQUEST_ID_PATTERN = /^ask_[0-9a-f]{16}$/;

export function isAskRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

/** `ask-summit/{requestId}/`: the folder every upload for one request lives under. */
export function uploadPrefixFor(requestId: string): string {
  return `ask-summit/${requestId}/`;
}

/** The prefix plus exactly one more segment, no `..`, no empty name. */
export function isUnderPrefix(pathname: string, requestId: string): boolean {
  if (!isAskRequestId(requestId)) return false;
  const prefix = uploadPrefixFor(requestId);
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  return rest.length > 0 && !rest.includes("/") && !rest.includes("..") && rest.length <= FILE_NAME_MAX + 40;
}
