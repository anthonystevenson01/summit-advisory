/**
 * The prototype document: the edit applier, the validator, the safety pass
 * (each banned construct, the CSP first in the head, idempotence, the font
 * link), the size cap and the logo substitution. Pure modules, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { PROTOTYPE_HTML_MAX_CHARS } from "../app/lib/project-builder/prototype.ts";
import {
  EditApplyError,
  LOGO_PLACEHOLDER,
  PROTOTYPE_CSP,
  applyEdits,
  renderPrototypeDocument,
  sanitisePrototypeHtml,
  validatePrototypeHtml,
} from "../app/lib/project-builder/prototype-html.ts";

function doc(body: string, head = "<title>T</title>"): string {
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

const SCREENS = `<nav><button data-go="a">A</button></nav><section data-screen="a" id="a">A</section><section data-screen="b" id="b">B</section><section data-screen="c" id="c">C</section><script>document.body.dataset.x = "1";</script>`;

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap";

const CSP_PREFIX = `<!DOCTYPE html><!--pb-safe--><meta http-equiv="Content-Security-Policy" content="${PROTOTYPE_CSP}">`;

describe("applyEdits", () => {
  test("one edit and sequential edits on inserted text", () => {
    assert.equal(applyEdits("<p>a</p>", [{ old_str: "a", new_str: "b" }]), "<p>b</p>");
    assert.equal(
      applyEdits("<p>a</p>", [
        { old_str: "<p>a</p>", new_str: "<p>a</p><p>new</p>" },
        { old_str: "new", new_str: "newer" },
      ]),
      "<p>a</p><p>newer</p>",
    );
  });

  test("not found, more than once and empty all throw and name the edit", () => {
    assert.throws(() => applyEdits("abc", [{ old_str: "z", new_str: "y" }]), (err: unknown) => err instanceof EditApplyError && err.editNumber === 1 && /Edit 1/.test(err.message));
    assert.throws(() => applyEdits("aa", [{ old_str: "a", new_str: "b" }]), /more than once/);
    assert.throws(() => applyEdits("abc", [{ old_str: "", new_str: "b" }]), /empty/);
  });

  test("all or nothing: a failure on edit 3 leaves the input unchanged", () => {
    const input = "one two three";
    assert.throws(
      () =>
        applyEdits(input, [
          { old_str: "one", new_str: "1" },
          { old_str: "two", new_str: "2" },
          { old_str: "four", new_str: "4" },
        ]),
      (err: unknown) => err instanceof EditApplyError && err.editNumber === 3,
    );
    assert.equal(input, "one two three");
  });
});

describe("validatePrototypeHtml", () => {
  test("a valid three screen document passes", () => {
    assert.deepEqual(validatePrototypeHtml(doc(SCREENS)), []);
  });

  test("skeleton problems", () => {
    assert.ok(validatePrototypeHtml(doc(SCREENS).replace("</body>", "</body><body></body>")).some((i) => i.includes("<body>")));
    assert.ok(validatePrototypeHtml(doc(SCREENS).replace("<html>", "")).some((i) => i.includes("<html>")));
    assert.ok(validatePrototypeHtml(doc(SCREENS, "<title>T</title></head><head>")).some((i) => i.includes("<head>")));
  });

  test("unbalanced style and script, duplicate ids, protocol markers", () => {
    assert.ok(validatePrototypeHtml(doc(SCREENS, "<style>a{}")).some((i) => i.includes("<style>")));
    assert.ok(validatePrototypeHtml(doc(`${SCREENS}<script>`)).some((i) => i.includes("<script>")));
    assert.ok(validatePrototypeHtml(doc(`${SCREENS}<div id="a"></div>`)).some((i) => i.includes("ids") && i.includes("a")));
    assert.ok(validatePrototypeHtml(doc(`${SCREENS}<search>x</search>`)).some((i) => i.includes("edit markers")));
  });

  test("two screens and six screens fail", () => {
    const two = `<section data-screen="a">A</section><section data-screen="b">B</section>`;
    assert.ok(validatePrototypeHtml(doc(two)).some((i) => i.includes("2 screens")));
    const six = Array.from({ length: 6 }, (_, i) => `<section data-screen="s${i}">S</section>`).join("");
    assert.ok(validatePrototypeHtml(doc(six)).some((i) => i.includes("6 screens")));
  });

  test("over the size cap fails", () => {
    const big = doc(`${SCREENS}<p>${"x".repeat(PROTOTYPE_HTML_MAX_CHARS)}</p>`);
    assert.ok(validatePrototypeHtml(big).some((i) => i.includes("characters long")));
  });

  test("issues carry no en or em dash", () => {
    const issues = validatePrototypeHtml(`<search>${"x".repeat(PROTOTYPE_HTML_MAX_CHARS)}`);
    for (const issue of issues) assert.doesNotMatch(issue, /[–—]/);
  });
});

describe("sanitisePrototypeHtml", () => {
  const clean = (body: string, head?: string) => sanitisePrototypeHtml(doc(body, head), FONT);

  test("external script src is removed, inline script kept", () => {
    const out = clean(`<script src="https://evil.example/x.js"></script><script>var ok = 1;</script>`);
    assert.doesNotMatch(out, /evil\.example/);
    assert.doesNotMatch(out, /<script[^>]*src/);
    assert.match(out, /var ok = 1;/);
  });

  test("iframe, object, embed and base are removed", () => {
    const out = clean(`<iframe src="x"></iframe><object data="x"></object><embed src="x">`, `<base href="https://evil.example/">`);
    assert.doesNotMatch(out, /<iframe|<object|<embed|<base/i);
  });

  test("meta refresh and a model written CSP are removed; ours is the first thing after the doctype", () => {
    const out = clean("<p>x</p>", `<meta http-equiv="refresh" content="0;url=https://evil.example"><meta http-equiv="Content-Security-Policy" content="default-src *">`);
    assert.doesNotMatch(out, /refresh/);
    assert.doesNotMatch(out, /default-src \*/);
    assert.ok(out.startsWith(CSP_PREFIX), out.slice(0, 200));
    assert.equal(out.match(/Content-Security-Policy/g)?.length, 1);
  });

  test("form action and formaction, target and ping are removed", () => {
    const out = clean(`<form action="https://evil.example/post"><button formaction="https://evil.example/b" type="submit">Go</button></form><a href="#x" target="_blank" ping="https://evil.example/p">x</a>`);
    assert.doesNotMatch(out, /\saction=|formaction|target=|ping=/);
    assert.doesNotMatch(out, /evil\.example/);
  });

  test("link tags are removed: another host's stylesheet and an icon", () => {
    const out = clean("<p>x</p>", `<link rel="stylesheet" href="https://evil.example/a.css"><link rel="icon" href="/favicon.ico">`);
    assert.doesNotMatch(out, /evil\.example|favicon/);
    assert.equal(out.match(/<link\b/g)?.length, 1);
  });

  test("external img src, CSS url() and @import are neutralised", () => {
    const out = clean(`<img src="https://evil.example/a.png" alt="a"><div style="background:url('https://evil.example/b.png')"></div>`, `<style>@import url("https://evil.example/c.css"); .x{background:url(https://evil.example/d.png)}</style>`);
    assert.doesNotMatch(out, /evil\.example/);
    assert.doesNotMatch(out, /@import/);
  });

  test("protocol relative URLs are neutralised", () => {
    const out = clean(`<img src="//evil.example/a.png"><a href="//evil.example/">x</a><div style="background:url(//evil.example/c.png)"></div>`);
    assert.doesNotMatch(out, /evil\.example/);
  });

  test("javascript: and data: hrefs become #", () => {
    const out = clean(`<a href="javascript:alert(1)">a</a><a href="data:text/html;base64,PHNjcmlwdD4=">b</a>`);
    assert.doesNotMatch(out, /javascript:|data:text/);
    assert.equal(out.match(/href="#"/g)?.length, 2);
  });

  test("the CSP never depends on finding the real <head>", () => {
    const shapes = [
      `<!DOCTYPE html><!-- <head> --><html><head><title>T</title></head><body>${SCREENS}</body></html>`,
      `<!DOCTYPE html><html><script>fetch("https://evil.example")</script><head><title>T</title></head><body>${SCREENS}</body></html>`,
      `<!DOCTYPE html><html><head-x></head-x><head><title>T</title></head><body>${SCREENS}</body></html>`,
      `<!DOCTYPE html><html><body>${SCREENS}</body></html>`,
      `<!-- lead --><!doctype html><html><head></head><body>${SCREENS}</body></html>`,
    ];
    for (const input of shapes) {
      const out = sanitisePrototypeHtml(input, null);
      assert.ok(out.startsWith(CSP_PREFIX), out.slice(0, 160));
      assert.equal(out.match(/Content-Security-Policy/g)?.length, 1);
      assert.equal(out.match(/<!doctype/gi)?.length, 1);
      if (validatePrototypeHtml(input).length === 0) assert.deepEqual(validatePrototypeHtml(out), [], input);
      assert.equal(sanitisePrototypeHtml(out), out, "idempotent");
    }
  });

  test("a bare fragment gets the block before a body and no added html or head", () => {
    const bare = sanitisePrototypeHtml(`<p>hi</p>`, null);
    assert.ok(bare.startsWith(CSP_PREFIX));
    assert.match(bare, /<!--\/pb-safe--><body><p>hi<\/p><\/body>$/);
    assert.doesNotMatch(bare, /<html|<head/);
  });

  test("a slash as the attribute separator does not get past the pass", () => {
    const out = clean(
      `<script/src=//x.example/a.js></script><form/action="https://x.example"><input></form><img/srcset="https://x.example/a.png 1x" alt="a"><a/href="javascript:alert(1)">a</a><img/src=//x.example/b.png>`,
    );
    assert.doesNotMatch(out, /x\.example/);
    assert.doesNotMatch(out, /<script[^>]*src/i);
    assert.doesNotMatch(out, /action=|srcset=|javascript:/i);
  });

  test("idempotent: one CSP and one font link after two passes", () => {
    const once = clean(SCREENS);
    const twice = sanitisePrototypeHtml(once);
    assert.equal(twice, once);
    assert.equal(twice.match(/Content-Security-Policy/g)?.length, 1);
    assert.equal(twice.match(/<link\b/g)?.length, 1);
  });

  test("the injected font link survives; a model written link to the same host does not", () => {
    const out = clean("<p>x</p>", `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Evil">`);
    assert.doesNotMatch(out, /family=Evil/);
    assert.match(out, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;700&amp;display=swap">/);
  });

  test("null removes the font link", () => {
    const out = sanitisePrototypeHtml(clean("<p>x</p>"), null);
    assert.doesNotMatch(out, /<link\b/);
  });
});

describe("renderPrototypeDocument", () => {
  const stored = sanitisePrototypeHtml(doc(`<nav><img src="${LOGO_PLACEHOLDER}" alt="Acme"></nav><p>Use ${LOGO_PLACEHOLDER} here</p>${SCREENS}`), FONT);
  const uri = "data:image/png;base64,iVBORw0KGgo=";

  test("the placeholder in an img src becomes the data URI; in text it is untouched", () => {
    const out = renderPrototypeDocument(stored, uri);
    assert.match(out, /<img src="data:image\/png;base64,iVBORw0KGgo=" alt="Acme">/);
    assert.match(out, /Use \{\{LOGO\}\} here/);
    assert.match(out, /Content-Security-Policy/);
    assert.match(out, /fonts\.googleapis\.com\/css2/);
  });

  test("with no logo the image becomes its alt text", () => {
    const out = renderPrototypeDocument(stored, null);
    assert.doesNotMatch(out, /<img/);
    assert.match(out, /<span class="logo-text">Acme<\/span>/);
  });
});
