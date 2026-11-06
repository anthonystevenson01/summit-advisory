/**
 * The house style read from a website: logo candidates, stylesheet links,
 * colours, fonts, tagline, logo byte checks, the SVG sanitiser, the font
 * stylesheet URL and the status. Pure module, no network, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  LOGO_MAX_BYTES,
  NEUTRAL_HOUSE_STYLE,
  SERIF_STACK,
  buildHouseStyle,
  checkLogoBytes,
  extractColours,
  extractFonts,
  extractSiteName,
  extractTagline,
  findLogoCandidates,
  findStylesheetLinks,
  fontChoice,
  fontStylesheetUrl,
  logoDataUri,
  sanitiseSvg,
} from "../app/lib/project-builder/house-style.ts";

const PAGE = "https://acme.com/";

describe("findLogoCandidates", () => {
  const html = `<html><head>
    <meta property="og:image" content="https://cdn.acme.com/social.jpg">
    <link rel="apple-touch-icon" href="/apple.png">
    <link rel="icon" sizes="16x16" href="/small.png"><link rel="icon" sizes="192x192" href="/big.png">
  </head><body><img src="/hero.jpg" alt="Hero"><header><img class="site-logo" src="img/mark.png" alt="Acme"></header></body></html>`;

  test("the logo image first and og:image last, relative URLs resolved, at most four", () => {
    const out = findLogoCandidates(html, PAGE);
    assert.deepEqual(out, [
      { kind: "url", url: "https://acme.com/img/mark.png" },
      { kind: "url", url: "https://acme.com/apple.png" },
      { kind: "url", url: "https://acme.com/big.png" },
      { kind: "url", url: "https://cdn.acme.com/social.jpg" },
    ]);
  });

  test("an inline svg marked logo is picked up", () => {
    const out = findLogoCandidates(`<body><svg class="logo" viewBox="0 0 1 1"><path d="M0 0"/></svg></body>`, PAGE);
    assert.equal(out[0].kind, "svg");
  });

  test("never more than four", () => {
    const many = `<img class="logo" src="/a.png"><svg id="logo"></svg><link rel="apple-touch-icon" href="/b.png"><link rel="icon" href="/c.svg"><meta property="og:image" content="/d.png">`;
    assert.equal(findLogoCandidates(many, PAGE).length, 4);
  });
});

describe("findStylesheetLinks", () => {
  test("same host first, at most three", () => {
    const html = `<link rel="stylesheet" href="https://cdn.other.com/a.css"><link rel="stylesheet" href="/b.css"><link rel="stylesheet" href="/c.css"><link rel="stylesheet" href="/d.css"><link rel="icon" href="/x.css">`;
    assert.deepEqual(findStylesheetLinks(html, PAGE), ["https://acme.com/b.css", "https://acme.com/c.css", "https://acme.com/d.css"]);
  });
});

describe("extractColours", () => {
  test("theme-color first, then a brand variable, then frequency", () => {
    const html = `<meta name="theme-color" content="#0a7f5a"><style>:root{--brand-primary:#c0392b}</style><div style="color:#2255cc"></div>`;
    const css = [".a{color:#2255cc}.b{color:#2255cc}.c{color:#8e44ad}"];
    assert.deepEqual(extractColours(html, css), ["#0a7f5a", "#c0392b", "#2255cc"]);
  });

  test("greys, white and black dropped; rgb() and short hex normalised; near twins merged; at most three", () => {
    const css = [".a{color:#fff;background:#000;border-color:#888} .b{color:rgb(230, 126, 34)} .c{color:#e67e23} .d{color:#36c} .e{color:hsl(140, 60%, 40%)} .f{color:#9b59b6}"];
    const out = extractColours("", css);
    assert.equal(out.length, 3);
    assert.equal(out[0], "#e67e22");
    assert.ok(out.includes("#3366cc"));
    for (const c of out) assert.match(c, /^#[0-9a-f]{6}$/);
  });
});

describe("extractFonts", () => {
  test("a Google Fonts link family wins", () => {
    const html = `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:"Lato",sans-serif}</style>`;
    assert.equal(extractFonts(html, []).bodyFont.family, "Poppins");
  });

  test("a body declaration maps to the allow list family", () => {
    const out = extractFonts("", ['body { font-family: "DM Sans", sans-serif }', "h1, h2 { font-family: 'Playfair Display', serif }"]);
    assert.equal(out.bodyFont.family, "DM Sans");
    assert.equal(out.headingFont.family, "Playfair Display");
  });

  test("a proprietary family with a serif fallback maps to the serif stack; unknown names never appear", () => {
    const out = extractFonts("", ['body { font-family: "Acme Grotesk Pro", Georgia, serif }']);
    assert.equal(out.bodyFont.family, null);
    assert.equal(out.bodyFont.stack, SERIF_STACK);
    assert.doesNotMatch(JSON.stringify(out), /Acme Grotesk/);
  });
});

describe("extractTagline and extractSiteName", () => {
  test("og:description, then the meta description, then the h1", () => {
    assert.equal(extractTagline(`<meta property="og:description" content="We fix cars."><meta name="description" content="Other"><h1>Head</h1>`), "We fix cars.");
    assert.equal(extractTagline(`<meta name="description" content="Garage software"><h1>Head</h1>`), "Garage software");
    assert.equal(extractTagline(`<h1>Fast <em>repairs</em></h1>`), "Fast repairs");
  });

  test("160 characters at a word, dashes made plain", () => {
    const long = `${"word ".repeat(50)}end`;
    const out = extractTagline(`<meta name="description" content="${long}">`);
    assert.ok(out.length <= 160);
    assert.ok(out.endsWith("word"));
    assert.equal(extractTagline(`<h1>Repairs — done right</h1>`), "Repairs, done right");
  });

  test("site name from og:site_name or the title", () => {
    assert.equal(extractSiteName(`<meta property="og:site_name" content="Acme Garages">`), "Acme Garages");
    assert.equal(extractSiteName(`<title>Acme | Home</title>`), "Acme");
  });
});

describe("checkLogoBytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  const svg = new TextEncoder().encode(`<?xml version="1.0"?><!-- c --><svg xmlns="http://www.w3.org/2000/svg"></svg>`);

  test("PNG, JPEG, WebP and SVG accepted", () => {
    assert.deepEqual(checkLogoBytes(png, "image/png"), { mime: "image/png" });
    assert.deepEqual(checkLogoBytes(jpeg, "image/jpeg"), { mime: "image/jpeg" });
    assert.deepEqual(checkLogoBytes(webp, ""), { mime: "image/webp" });
    assert.deepEqual(checkLogoBytes(svg, "image/svg+xml; charset=utf-8"), { mime: "image/svg+xml" });
  });

  test("GIF and ICO refused", () => {
    assert.equal(checkLogoBytes(new TextEncoder().encode("GIF89a...."), "image/gif"), null);
    assert.equal(checkLogoBytes(new Uint8Array([0, 0, 1, 0, 1, 0]), "image/x-icon"), null);
  });

  test("over 200 KB refused", () => {
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(png);
    assert.equal(checkLogoBytes(big, "image/png"), null);
  });

  test("an image/png header on JPEG bytes refused", () => {
    assert.equal(checkLogoBytes(jpeg, "image/png"), null);
  });
});

describe("sanitiseSvg", () => {
  test("removes scripts, handlers, foreignObject and external references; keeps fragments", () => {
    const out = sanitiseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>alert(1)</script><foreignObject><div>x</div></foreignObject><use xlink:href="https://evil.example/a.svg#x"/><use href="#mark"/><a href="javascript:alert(1)"><path d="M0 0"/></a></svg>`,
    );
    assert.ok(out);
    assert.doesNotMatch(out, /<script|onload|foreignObject|evil\.example|javascript:/i);
    assert.match(out, /<use href="#mark"\/>/);
  });

  test("a slash before an attribute name does not get past the sanitiser", () => {
    const out = sanitiseSvg(`<svg/onload="x()"><use/xlink:href="https://evil.example/a.svg#x"/><path/onclick="y()" d="M0 0"/></svg>`);
    assert.ok(out);
    assert.doesNotMatch(out, /onload|onclick|evil\.example/i);
  });

  test("refuses a non SVG root and an oversize input", () => {
    assert.equal(sanitiseSvg("<html><svg></svg></html>"), null);
    assert.equal(sanitiseSvg(`<svg>${"x".repeat(LOGO_MAX_BYTES)}</svg>`), null);
  });

  test("an SVG logo becomes a base64 data URI", () => {
    const logo = logoDataUri(new TextEncoder().encode(`<svg><script>x</script><path d="M0 0"/></svg>`), "image/svg+xml");
    assert.ok(logo);
    assert.match(logo.dataUri, /^data:image\/svg\+xml;base64,/);
    assert.doesNotMatch(atob(logo.dataUri.split(",")[1]), /script/);
  });
});

describe("fontStylesheetUrl and buildHouseStyle", () => {
  test("only allow list families; null for system stacks", () => {
    const url = fontStylesheetUrl({ headingFont: fontChoice("Playfair Display"), bodyFont: fontChoice("DM Sans") });
    assert.equal(url, "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;700&display=swap");
    assert.equal(fontStylesheetUrl({ headingFont: fontChoice(null), bodyFont: fontChoice("Comic Sans MS") }), null);
  });

  test("found, partial and none", () => {
    const base = { host: "acme.com", siteName: "Acme", tagline: "", background: "#ffffff", text: "#111111", headingFont: fontChoice(null), bodyFont: fontChoice(null) };
    const logo = { dataUri: "data:image/png;base64,AA==", mime: "image/png", bytes: 1 };
    assert.equal(buildHouseStyle({ ...base, colours: ["#c0392b"], logo }).status, "found");
    assert.equal(buildHouseStyle({ ...base, colours: ["#c0392b"], logo: null }).status, "partial");
    const none = buildHouseStyle({ ...base, colours: [], logo: null });
    assert.equal(none.status, "none");
    assert.equal(none.reason, "nothing-usable");
    assert.deepEqual(none.colours, NEUTRAL_HOUSE_STYLE.colours);
  });
});
