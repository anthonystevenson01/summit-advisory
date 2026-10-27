/**
 * The DOCX and PPTX text extractor on small fixture XML strings and
 * in-memory zips built with fflate. Pure module plus fflate, no I/O.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";

import {
  OFFICE_TEXT_CAP,
  OfficeTextError,
  extractDocxText,
  extractPptxText,
  orderSlideEntries,
  textFromDocumentXml,
  textFromSlideXml,
} from "../app/lib/ask-summit/office-text.ts";

const DOCUMENT_XML = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>
<w:p><w:r><w:t>Hel</w:t></w:r><w:r><w:t>lo world</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve"> Second </w:t></w:r><w:r><w:t>para &amp; more</w:t></w:r></w:p>
<w:p><w:r><w:t>Tab</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>bed</w:t></w:r></w:p>
<w:p><w:del><w:r><w:t>DELETED</w:t></w:r></w:del><w:r><w:t>kept</w:t></w:r></w:p>
<w:p/>
</w:body></w:document>`;

const SLIDE_XML = `<p:sld xmlns:a="a"><p:txBody><a:p><a:r><a:t>Title</a:t></a:r></a:p><a:p><a:r><a:t>Body</a:t></a:r><a:br/><a:r><a:t>line</a:t></a:r></a:p></p:txBody></p:sld>`;

function slide(text: string): string {
  return `<p:sld xmlns:a="a"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
}

describe("textFromDocumentXml", () => {
  test("joins runs with nothing between them, paragraphs with a newline, tabs as a space, deletions dropped", () => {
    const text = textFromDocumentXml(DOCUMENT_XML);
    assert.equal(text, "Hello world\nSecond para & more\nTab bed\nkept");
  });
});

describe("textFromSlideXml", () => {
  test("two paragraphs give two lines; a break gives a newline", () => {
    assert.equal(textFromSlideXml(SLIDE_XML), "Title\nBody\nline");
  });
});

describe("orderSlideEntries", () => {
  test("sorts by slide number and drops rels", () => {
    assert.deepEqual(
      orderSlideEntries(["ppt/slides/slide10.xml", "ppt/slides/slide2.xml", "ppt/slides/_rels/slide1.xml.rels", "ppt/slides/slide1.xml", "ppt/notesSlides/notesSlide1.xml"]),
      ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/slides/slide10.xml"],
    );
  });
});

describe("extractDocxText", () => {
  test("reads word/document.xml from an in-memory zip", () => {
    const zip = zipSync({ "word/document.xml": strToU8(DOCUMENT_XML), "docProps/app.xml": strToU8("<x/>") });
    const result = extractDocxText(zip);
    assert.equal(result.text, "Hello world\nSecond para & more\nTab bed\nkept");
    assert.equal(result.parts, 1);
    assert.equal(result.truncated, false);
  });

  test("a zip without the entry throws naming DOCX; a non-zip throws OfficeTextError", () => {
    const zip = zipSync({ "ppt/slides/slide1.xml": strToU8(slide("x")) });
    assert.throws(() => extractDocxText(zip), (err: unknown) => err instanceof OfficeTextError && /DOCX/.test(err.message));
    assert.throws(() => extractDocxText(new Uint8Array([1, 2, 3, 4])), OfficeTextError);
  });

  test("output over the cap is cut at the cap with truncated true", () => {
    const paragraphs = Array.from({ length: 30_000 }, (_, i) => `<w:p><w:r><w:t>paragraph ${i}</w:t></w:r></w:p>`).join("");
    const zip = zipSync({ "word/document.xml": strToU8(`<w:document><w:body>${paragraphs}</w:body></w:document>`) });
    const result = extractDocxText(zip);
    assert.ok(result.text.length <= OFFICE_TEXT_CAP);
    assert.equal(result.truncated, true);
  });
});

describe("extractPptxText", () => {
  test("three slides come out in order with Slide n headings", () => {
    const zip = zipSync({
      "ppt/slides/slide3.xml": strToU8(slide("Third")),
      "ppt/slides/slide1.xml": strToU8(slide("First")),
      "ppt/slides/slide2.xml": strToU8(slide("Second")),
      "ppt/slides/_rels/slide1.xml.rels": strToU8("<r/>"),
    });
    const result = extractPptxText(zip);
    assert.equal(result.text, "Slide 1\nFirst\n\nSlide 2\nSecond\n\nSlide 3\nThird");
    assert.equal(result.parts, 3);
  });

  test("a zip with no slide entry throws", () => {
    const zip = zipSync({ "word/document.xml": strToU8(DOCUMENT_XML) });
    assert.throws(() => extractPptxText(zip), (err: unknown) => err instanceof OfficeTextError && /PPTX/.test(err.message));
    assert.throws(() => extractPptxText(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), OfficeTextError);
  });
});
