/**
 * The Brandfetch mapping (logo, colour and font choice, the nav colours),
 * the brand lookup rule, the site first merge, the round 1 normaliser and
 * the style notes. Pure modules, no network, no Redis, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { brandColours, brandFonts, chooseBrandLogoFormats, chooseNav, darkSurface, parseBrandfetch, type BrandData } from "../app/lib/project-builder/brand-data.ts";
import {
  NEUTRAL_HOUSE_STYLE,
  buildHouseStyle,
  fontChoice,
  mergeHouseStyle,
  needsBrandLookup,
  normaliseHouseStyle,
  type BrandParts,
  type HouseStyle,
  type HouseStyleParts,
} from "../app/lib/project-builder/house-style.ts";
import { styleNoteFor } from "../app/lib/project-builder/prototype.ts";
import { PROTOTYPE } from "../app/lib/project-builder/copy.ts";

const fmt = (src: string, format: string, extra: Record<string, unknown> = {}) => ({ src, format, size: 1000, width: 400, height: 100, background: "transparent", ...extra });

/** Shaped like the documented Brand API answer. */
const RAW = {
  name: "Acme",
  domain: "acme.com",
  logos: [
    { type: "icon", theme: "dark", formats: [fmt("https://cdn.brandfetch.io/icon.png", "png")] },
    { type: "logo", theme: "light", formats: [fmt("https://cdn.brandfetch.io/logo-light.svg", "svg")] },
    { type: "symbol", theme: null, formats: [fmt("https://cdn.brandfetch.io/symbol.png", "png")] },
    {
      type: "logo",
      theme: "dark",
      formats: [
        fmt("https://cdn.brandfetch.io/logo-dark.jpeg", "jpeg"),
        fmt("https://cdn.brandfetch.io/logo-dark-small.png", "png", { width: 80 }),
        fmt("https://cdn.brandfetch.io/logo-dark.webp", "webp"),
        fmt("https://cdn.brandfetch.io/logo-dark-huge.png", "png", { size: 300_000 }),
        fmt("https://cdn.brandfetch.io/logo-dark.png", "png"),
        fmt("http://cdn.brandfetch.io/insecure.svg", "svg"),
        fmt("https://cdn.brandfetch.io/logo-dark.svg", "svg"),
      ],
    },
    { type: "other", theme: "dark", formats: [fmt("https://cdn.brandfetch.io/other.svg", "svg")] },
  ],
  colors: [
    { hex: "#F4F4F4", type: "light", brightness: 244 },
    { hex: "#0A1F44", type: "dark", brightness: 30 },
    { hex: "#E4002B", type: "brand", brightness: 60 },
    { hex: "not-a-colour", type: "brand", brightness: 0 },
    { hex: "#E5022D", type: "brand", brightness: 60 },
    { hex: "#0067B1", type: "accent", brightness: 90 },
    { hex: "#808080", type: "brand", brightness: 128 },
  ],
  fonts: [
    { name: "Playfair Display", type: "title", origin: "google", originId: "Playfair+Display", weights: [] },
    { name: "Acme Sans", type: "body", origin: "custom", originId: null, weights: [] },
  ],
};

function data(): BrandData {
  return parseBrandfetch(RAW, "2026-11-06T00:00:00.000Z");
}

describe("parseBrandfetch", () => {
  test("maps the documented shape and drops what is unusable", () => {
    const d = data();
    assert.equal(d.logos.length, 5);
    const darkLogo = d.logos.find((l) => l.type === "logo" && l.theme === "dark");
    assert.ok(darkLogo);
    assert.ok(!darkLogo.formats.some((f) => f.src.startsWith("http:")), "non https src dropped");
    assert.equal(d.colours.length, 6, "the invalid hex is dropped");
    assert.equal(d.colours[0].hex, "#f4f4f4");
    assert.deepEqual(d.fonts.map((f) => [f.name, f.type, f.origin]), [["Playfair Display", "title", "google"], ["Acme Sans", "body", "custom"]]);
    assert.equal(d.fetchedAt, "2026-11-06T00:00:00.000Z");
  });

  test("missing arrays are empty, a non object gives empty data, caps hold", () => {
    assert.deepEqual(parseBrandfetch({ name: "x" }, "t"), { logos: [], colours: [], fonts: [], fetchedAt: "t" });
    assert.deepEqual(parseBrandfetch("nope", "t"), { logos: [], colours: [], fonts: [], fetchedAt: "t" });
    assert.deepEqual(parseBrandfetch(null, "t").logos, []);
    const many = parseBrandfetch({
      logos: Array.from({ length: 20 }, (_, i) => ({ type: "logo", theme: null, formats: Array.from({ length: 12 }, (_, j) => fmt(`https://a.example/${i}-${j}.png`, "png")) })),
      colors: Array.from({ length: 20 }, () => ({ hex: "#123456", type: "brand" })),
      fonts: Array.from({ length: 10 }, () => ({ name: "Inter", type: "body", origin: "google" })),
    });
    assert.equal(many.logos.length, 12);
    assert.equal(many.logos[0].formats.length, 8);
    assert.equal(many.colours.length, 12);
    assert.equal(many.fonts.length, 6);
  });
});

describe("chooseBrandLogoFormats", () => {
  test("logo before symbol before icon, dark theme first, svg before png before webp before jpeg, small rasters last", () => {
    const c = chooseBrandLogoFormats(data());
    assert.equal(c.length, 4);
    assert.deepEqual(c.map((x) => x.src), [
      "https://cdn.brandfetch.io/logo-dark.svg",
      "https://cdn.brandfetch.io/logo-dark.png",
      "https://cdn.brandfetch.io/logo-dark.webp",
      "https://cdn.brandfetch.io/logo-dark.jpeg",
    ]);
    assert.ok(c.every((x) => x.theme === "dark"));
    assert.ok(!c.some((x) => x.src.includes("huge")), "over 200 KB skipped");
  });

  test("the small raster comes after a wider one; then the next logo, carrying its own theme; other is never used", () => {
    const d = data();
    d.logos = d.logos.filter((l) => !(l.type === "logo" && l.theme === "dark")).concat({
      type: "logo",
      theme: "dark",
      formats: [
        { src: "https://a.example/small.png", format: "png", size: 10, width: 80, height: 20, transparent: true },
        { src: "https://a.example/wide.jpeg", format: "jpeg", size: 10, width: 400, height: 100, transparent: false },
      ],
    });
    const c = chooseBrandLogoFormats(d);
    assert.deepEqual(c.slice(0, 3).map((x) => [x.src, x.theme]), [
      ["https://a.example/wide.jpeg", "dark"],
      ["https://a.example/small.png", "dark"],
      ["https://cdn.brandfetch.io/logo-light.svg", "light"],
    ]);
    assert.equal(c[3].src, "https://cdn.brandfetch.io/symbol.png");
    assert.ok(!c.some((x) => x.src.includes("other")));
  });
});

describe("brandColours, darkSurface and brandFonts", () => {
  test("accent, then brand, then dark; greys and near white dropped; near twins merged; three at most", () => {
    assert.deepEqual(brandColours(data()), ["#0067b1", "#e4002b", "#0a1f44"]);
    assert.equal(darkSurface(data()), "#0a1f44");
    const light = data();
    light.colours = [{ hex: "#ffffff", type: "light", brightness: 255 }, { hex: "#000000", type: "dark", brightness: 0 }];
    assert.deepEqual(brandColours(light), []);
  });

  test("a google title font on the allow list is the heading; a custom font off the list gives no family", () => {
    assert.deepEqual(brandFonts(data()), { headingFamily: "Playfair Display", bodyFamily: null });
    const d = data();
    d.fonts = [{ name: "Lato", type: "body", origin: "google" }];
    assert.deepEqual(brandFonts(d), { headingFamily: null, bodyFamily: "Lato" });
  });
});

describe("chooseNav", () => {
  test("a light logo gets a dark nav with white text", () => {
    assert.deepEqual(chooseNav(["#e4002b"], "#ffffff", "#111111", true, "light", "#0a1f44"), { navBackground: "#0a1f44", navText: "#FFFFFF" });
    assert.deepEqual(chooseNav(["#0a1f44"], "#ffffff", "#111111", true, "light", null), { navBackground: "#0a1f44", navText: "#FFFFFF" });
    assert.deepEqual(chooseNav(["#ffd400"], "#ffffff", "#111111", true, "light", null), { navBackground: "#1F2A37", navText: "#FFFFFF" });
  });

  test("a dark or site logo sits on the page background with the page text", () => {
    assert.deepEqual(chooseNav(["#e4002b"], "#fafafa", "#222222", true, "dark", null), { navBackground: "#fafafa", navText: "#222222" });
    assert.deepEqual(chooseNav(["#e4002b"], "#fafafa", "#222222", true, null, null), { navBackground: "#fafafa", navText: "#222222" });
  });

  test("no logo: the first colour with the higher contrast text", () => {
    assert.deepEqual(chooseNav(["#0a1f44"], "#ffffff", "#111111", false, null, null), { navBackground: "#0a1f44", navText: "#FFFFFF" });
    assert.deepEqual(chooseNav(["#ffd400"], "#ffffff", "#111111", false, null, null), { navBackground: "#ffd400", navText: "#1F2A37" });
  });
});

const LOGO = { dataUri: "data:image/png;base64,AA==", mime: "image/png", bytes: 1 };
const BRAND_LOGO = { dataUri: "data:image/svg+xml;base64,BB==", mime: "image/svg+xml", bytes: 1 };

function siteParts(overrides: Partial<HouseStyleParts> = {}): HouseStyleParts {
  return {
    host: "acme.com",
    siteName: "Acme",
    tagline: "We fix cars.",
    colours: [],
    background: "#fafafa",
    text: "#222222",
    headingFont: fontChoice(null),
    bodyFont: fontChoice(null),
    logo: null,
    ...overrides,
  };
}

function brandParts(overrides: Partial<BrandParts> = {}): BrandParts {
  return { logo: BRAND_LOGO, logoTheme: "dark", colours: ["#0067b1", "#e4002b", "#0a1f44"], headingFamily: "Lora", bodyFamily: "Lato", darkSurface: "#0a1f44", ...overrides };
}

describe("needsBrandLookup and mergeHouseStyle", () => {
  test("a lookup when there are no parts, no logo or no colours; not for missing fonts alone", () => {
    assert.equal(needsBrandLookup(null), true);
    assert.equal(needsBrandLookup(siteParts({ colours: ["#c0392b"] })), true);
    assert.equal(needsBrandLookup(siteParts({ logo: LOGO })), true);
    assert.equal(needsBrandLookup(siteParts({ logo: LOGO, colours: ["#c0392b"] })), false);
  });

  test("a partial site is topped up, not replaced", () => {
    const merged = mergeHouseStyle(siteParts({ colours: ["#c0392b", "#27ae60"], bodyFont: fontChoice("Inter") }), brandParts(), { host: "acme.com", reason: "nothing-usable", brandLookup: "hit" });
    assert.deepEqual(merged.colours, ["#c0392b", "#27ae60", "#0067b1"]);
    assert.equal(merged.logo, BRAND_LOGO);
    assert.equal(merged.logoTheme, "dark");
    assert.equal(merged.background, "#fafafa");
    assert.equal(merged.text, "#222222");
    assert.equal(merged.bodyFont.family, "Inter", "the site font wins its role");
    assert.equal(merged.headingFont.family, "Lora", "the brand font fills an empty role");
    assert.equal(merged.source, "site+brand");
    assert.equal(merged.brandLookup, "hit");
    assert.equal(merged.status, buildHouseStyle({ ...siteParts(), colours: merged.colours, logo: BRAND_LOGO, headingFont: merged.headingFont, bodyFont: merged.bodyFont }).status);
    assert.equal(merged.siteName, "Acme");
  });

  test("nothing from the site plus brand data is source brand; a light brand logo gets a dark nav", () => {
    const merged = mergeHouseStyle(null, brandParts({ logoTheme: "light" }), { host: "acme.com", reason: "unreadable", brandLookup: "cached-hit" });
    assert.equal(merged.source, "brand");
    assert.equal(merged.status, "found");
    assert.equal(merged.background, NEUTRAL_HOUSE_STYLE.background);
    assert.deepEqual([merged.navBackground, merged.navText], ["#0a1f44", "#FFFFFF"]);
    assert.equal(merged.siteName, "");
  });

  test("no brand data keeps the site result as source site; nothing at all is neutral with the site reason", () => {
    const site = mergeHouseStyle(siteParts({ logo: LOGO, colours: ["#c0392b"] }), null, { host: "acme.com", reason: "nothing-usable", brandLookup: "not-needed" });
    assert.equal(site.source, "site");
    assert.equal(site.status, "found");
    assert.equal(site.logoTheme, null);
    const none = mergeHouseStyle(null, null, { host: "acme.com", reason: "unreadable", brandLookup: "miss" });
    assert.equal(none.source, "neutral");
    assert.equal(none.status, "none");
    assert.equal(none.reason, "unreadable");
    assert.equal(none.brandLookup, "miss");
    const empty = mergeHouseStyle(siteParts(), brandParts({ logo: null, colours: [], headingFamily: null, bodyFamily: null }), { host: "acme.com", reason: "nothing-usable", brandLookup: "hit" });
    assert.equal(empty.source, "neutral");
    assert.equal(empty.reason, "nothing-usable");
  });
});

describe("normaliseHouseStyle", () => {
  test("a round 1 stored style gains the new fields", () => {
    const old = { ...NEUTRAL_HOUSE_STYLE, status: "found", reason: "", background: "#fafafa", text: "#222222" } as Record<string, unknown>;
    for (const k of ["source", "brandLookup", "navBackground", "navText", "logoTheme"]) delete old[k];
    const n = normaliseHouseStyle(old);
    assert.ok(n);
    assert.deepEqual([n.source, n.brandLookup, n.navBackground, n.navText, n.logoTheme], ["site", "not-needed", "#fafafa", "#222222", null]);
    const oldNone = { ...old, status: "none" };
    assert.equal(normaliseHouseStyle(oldNone)?.source, "neutral");
    assert.equal(normaliseHouseStyle("nope"), null);
    assert.equal(normaliseHouseStyle(null), null);
  });
});

describe("styleNoteFor", () => {
  const style = (o: Partial<HouseStyle>) => ({ status: "found", reason: "", source: "site", brandLookup: "not-needed", ...o }) as HouseStyle;

  test("one line per source and outcome, with no dashes", () => {
    const cases: Array<[Partial<HouseStyle>, string]> = [
      [{ source: "site", status: "found" }, PROTOTYPE.fromSite],
      [{ source: "site", status: "partial" }, PROTOTYPE.partial],
      [{ source: "site+brand", status: "found" }, PROTOTYPE.siteAndBrand],
      [{ source: "site+brand", status: "partial" }, PROTOTYPE.siteAndBrand + PROTOTYPE.stillMissing],
      [{ source: "brand", status: "found" }, PROTOTYPE.fromBrand],
      [{ source: "brand", status: "partial" }, PROTOTYPE.fromBrand + PROTOTYPE.stillMissing],
      [{ source: "neutral", status: "none", reason: "no-website", brandLookup: "no-website" }, PROTOTYPE.noSite],
      [{ source: "neutral", status: "none", reason: "unreadable", brandLookup: "miss" }, PROTOTYPE.noSiteNoBrand],
      [{ source: "neutral", status: "none", reason: "unreadable", brandLookup: "cached-miss" }, PROTOTYPE.noSiteNoBrand],
      [{ source: "neutral", status: "none", reason: "unreadable", brandLookup: "error" }, PROTOTYPE.noSiteNoBrand],
      [{ source: "neutral", status: "none", reason: "unreadable", brandLookup: "no-key" }, PROTOTYPE.unreadable],
      [{ source: "neutral", status: "none", reason: "unreadable", brandLookup: "cap" }, PROTOTYPE.unreadable],
      [{ source: "neutral", status: "none", reason: "nothing-usable", brandLookup: "miss" }, PROTOTYPE.nothingUsable],
    ];
    for (const [o, line] of cases) {
      const note = styleNoteFor(style(o));
      assert.equal(note, line, JSON.stringify(o));
      assert.doesNotMatch(note, /[–—]/);
    }
    assert.equal(styleNoteFor(null), PROTOTYPE.unreadable);
  });
});
