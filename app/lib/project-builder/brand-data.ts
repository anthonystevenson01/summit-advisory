/**
 * The Brandfetch Brand API answer, trimmed and mapped. Pure: no network, no
 * Redis, no env, so the mapping is unit tested. brandfetch.ts does the one
 * GET and the cache; house-style-read.ts fetches the chosen logo through the
 * crawler's `fetchAsset` and the same byte checks as a site logo.
 *
 * Shape (docs.brandfetch.com, checked 6 November 2026): `logos[]` with
 * `type` (logo, symbol, icon, other), `theme` (dark, light or null; a dark
 * logo reads on a light background) and `formats[]` (`src`, `format`,
 * `size`, `width`, `height`, `background`); `colors[]` with `hex`, `type`
 * (accent, brand, dark, light) and `brightness`; `fonts[]` with `name`,
 * `type` (title, body) and `origin`. Only hex colours, allow listed font
 * names and checked image bytes ever reach the prototype or the prompt.
 */
import { LOGO_MAX_BYTES, MAX_COLOURS, chooseNav, fontChoice, isBrandish, isNear, normaliseColour, type LogoTheme } from "./house-style.ts";

export { chooseNav };

/** Brandfetch's logo types: logo is the horizontal mark, symbol the abstract mark, icon the social profile image. `other` is never used. */
export type BrandLogoType = "logo" | "symbol" | "icon" | "other";
/** The file formats kept, in the order a logo is preferred. */
export type BrandFormatName = "svg" | "png" | "webp" | "jpeg";

/** One file of a logo. `size` is bytes as Brandfetch reports it; formats over the 200 KB logo cap are skipped before any fetch. */
export interface BrandFormat {
  src: string;
  format: BrandFormatName;
  size: number | null;
  width: number | null;
  height: number | null;
  transparent: boolean;
}

/** One logo with its theme and its files. */
export interface BrandLogo {
  type: BrandLogoType;
  theme: LogoTheme;
  formats: BrandFormat[];
}

/** One colour. `type` decides the order (accent, brand, dark, light); `brightness` is kept but not relied on, since its range is undocumented. */
export interface BrandColour {
  hex: string;
  type: "accent" | "brand" | "dark" | "light";
  brightness: number | null;
}

/** One font. Only a name on the Google Fonts allow list is ever used, whatever its origin. */
export interface BrandFont {
  name: string;
  type: "title" | "body";
  origin: string;
}

/** What is cached per domain: small, and nothing but logos, colours and fonts. */
export interface BrandData {
  logos: BrandLogo[];
  colours: BrandColour[];
  fonts: BrandFont[];
  fetchedAt: string;
}

/** Caps on what is kept from one answer, so the per domain cache value stays small, and on the logo files tried. */
export const BRAND_MAX_LOGOS = 12;
export const BRAND_MAX_FORMATS = 8;
export const BRAND_MAX_COLOURS = 12;
export const BRAND_MAX_FONTS = 6;
export const BRAND_MAX_LOGO_CANDIDATES = 4;
/** A raster logo narrower than this looks blurred in a nav bar. */
export const BRAND_MIN_RASTER_WIDTH = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The trimmed record from a raw answer. Never throws: anything unusable becomes empty lists. */
export function parseBrandfetch(raw: unknown, fetchedAt = new Date().toISOString()): BrandData {
  const data: BrandData = { logos: [], colours: [], fonts: [], fetchedAt };
  if (!isRecord(raw)) return data;
  for (const item of list(raw.logos)) {
    if (data.logos.length >= BRAND_MAX_LOGOS) break;
    if (!isRecord(item)) continue;
    const type = oneOf(item.type, ["logo", "symbol", "icon", "other"] as const);
    if (!type) continue;
    const formats: BrandFormat[] = [];
    for (const f of list(item.formats)) {
      if (formats.length >= BRAND_MAX_FORMATS) break;
      if (!isRecord(f) || typeof f.src !== "string" || !f.src.startsWith("https://")) continue;
      const format = oneOf(f.format, ["svg", "png", "webp", "jpeg"] as const) ?? (f.format === "jpg" ? "jpeg" : null);
      if (!format) continue;
      formats.push({ src: f.src.slice(0, 2_000), format, size: num(f.size), width: num(f.width), height: num(f.height), transparent: f.background === "transparent" });
    }
    if (formats.length > 0) data.logos.push({ type, theme: oneOf(item.theme, ["dark", "light"] as const), formats });
  }
  for (const c of list(raw.colors)) {
    if (data.colours.length >= BRAND_MAX_COLOURS) break;
    if (!isRecord(c) || typeof c.hex !== "string") continue;
    const type = oneOf(c.type, ["accent", "brand", "dark", "light"] as const);
    const hex = normaliseColour(c.hex);
    if (!type || !hex) continue;
    data.colours.push({ hex, type, brightness: num(c.brightness) });
  }
  for (const f of list(raw.fonts)) {
    if (data.fonts.length >= BRAND_MAX_FONTS) break;
    if (!isRecord(f) || typeof f.name !== "string" || !f.name.trim()) continue;
    const type = oneOf(f.type, ["title", "body"] as const);
    if (!type) continue;
    data.fonts.push({ name: f.name.trim().slice(0, 80), type, origin: typeof f.origin === "string" ? f.origin.slice(0, 20) : "" });
  }
  return data;
}

// ── Logo ─────────────────────────────────────────────────────────────────────

/** A logo file to try, in order, with the theme that decides the nav colours if it is used. */
export interface BrandLogoCandidate {
  src: string;
  format: BrandFormatName;
  theme: LogoTheme;
}

const TYPE_RANK: Record<BrandLogoType, number> = { logo: 0, symbol: 1, icon: 2, other: 9 };
const FORMAT_RANK: Record<BrandFormatName, number> = { svg: 0, png: 1, webp: 2, jpeg: 3 };

function themeRank(theme: LogoTheme): number {
  return theme === "dark" ? 0 : theme === null ? 1 : 2;
}

/**
 * Up to four logo addresses in the order to try: logo before symbol before
 * icon (other never), a dark themed logo (reads on the default light nav)
 * before an unthemed one before a light one; within a logo, rasters narrower
 * than 160 px last, then svg, png, webp, jpeg, transparent first; anything
 * over 200 KB skipped. Each carries its logo's theme.
 */
export function chooseBrandLogoFormats(data: BrandData): BrandLogoCandidate[] {
  const logos = data.logos
    .filter((l) => l.type !== "other")
    .map((l, i) => ({ l, i }))
    .sort((a, b) => TYPE_RANK[a.l.type] - TYPE_RANK[b.l.type] || themeRank(a.l.theme) - themeRank(b.l.theme) || a.i - b.i);
  const out: BrandLogoCandidate[] = [];
  for (const { l } of logos) {
    const small = (f: BrandFormat) => (f.format !== "svg" && f.width !== null && f.width < BRAND_MIN_RASTER_WIDTH ? 1 : 0);
    const formats = l.formats
      .filter((f) => f.size === null || f.size <= LOGO_MAX_BYTES)
      .map((f, i) => ({ f, i }))
      .sort((a, b) => small(a.f) - small(b.f) || FORMAT_RANK[a.f.format] - FORMAT_RANK[b.f.format] || Number(b.f.transparent) - Number(a.f.transparent) || a.i - b.i);
    for (const { f } of formats) {
      if (out.some((c) => c.src === f.src)) continue;
      out.push({ src: f.src, format: f.format, theme: l.theme });
      if (out.length >= BRAND_MAX_LOGO_CANDIDATES) return out;
    }
  }
  return out;
}

// ── Colours ──────────────────────────────────────────────────────────────────

const COLOUR_TYPE_RANK: Record<BrandColour["type"], number> = { accent: 0, brand: 1, dark: 2, light: 3 };

/** Accent, then brand, then dark, then light; greys, near white and near black dropped; near twins merged; three at most. */
export function brandColours(data: BrandData): string[] {
  const ordered = data.colours.map((c, i) => ({ c, i })).sort((a, b) => COLOUR_TYPE_RANK[a.c.type] - COLOUR_TYPE_RANK[b.c.type] || a.i - b.i);
  const out: string[] = [];
  for (const { c } of ordered) {
    if (!isBrandish(c.hex) || out.some((k) => isNear(k, c.hex))) continue;
    out.push(c.hex);
    if (out.length >= MAX_COLOURS) break;
  }
  return out;
}

/** 0 to 255 brightness from the hex itself, since the API's own float range is not documented. */
function brightness(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The first `dark` colour that is genuinely dark (brightness under 80), for a dark nav under a light logo. */
export function darkSurface(data: BrandData): string | null {
  return data.colours.find((c) => c.type === "dark" && brightness(c.hex) < 80)?.hex ?? null;
}

// ── Fonts ────────────────────────────────────────────────────────────────────

/** The first title font for headings and the first body font for body text, each only when on the Google Fonts allow list. */
export function brandFonts(data: BrandData): { headingFamily: string | null; bodyFamily: string | null } {
  const title = data.fonts.find((f) => f.type === "title");
  const body = data.fonts.find((f) => f.type === "body");
  return {
    headingFamily: title ? fontChoice(title.name).family : null,
    bodyFamily: body ? fontChoice(body.name).family : null,
  };
}
