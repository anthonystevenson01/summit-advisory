/**
 * Text out of DOCX and PPTX files with no Office library: the file is a zip,
 * `word/document.xml` holds a Word document's paragraphs and
 * `ppt/slides/slide{n}.xml` each slide's text, and a small scan over the
 * `w:p` / `w:t` and `a:p` / `a:t` elements gives the text a reader would
 * see. Pure apart from fflate (itself pure): no network, no Redis. Images,
 * charts and embedded objects are ignored; a deck that is pictures only
 * comes out nearly empty, which the editor shows through `chars`.
 */
import { strFromU8, unzipSync } from "fflate";

export const OFFICE_TEXT_CAP = 200_000;

export class OfficeTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficeTextError";
  }
}

export interface OfficeText {
  text: string;
  /** 1 for a document, the slide count for a deck. */
  parts: number;
  truncated: boolean;
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return lower in XML_ENTITIES ? XML_ENTITIES[lower] : whole;
  });
}

/**
 * The paragraphs of an XML body: every `<{p}>` block in order, inside each
 * the `<{t}>` runs concatenated with nothing between them (Word splits
 * words across runs), tabs as a space, breaks as a newline, entities
 * decoded, spaces collapsed. Empty paragraphs are dropped; paragraphs are
 * joined with one newline.
 */
function paragraphsOf(xml: string, p: string, t: string, tab: string | null, br: string): string {
  const paragraphs: string[] = [];
  const paragraphRe = new RegExp(`<${p}\\b[^>]*\\/>|<${p}\\b[^>]*>([\\s\\S]*?)<\\/${p}>`, "g");
  const tokenRe = new RegExp(
    [`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`, `<${t}\\b[^>]*\\/>`, tab ? `<${tab}\\b[^>]*\\/>` : null, `<${br}\\b[^>]*\\/>`].filter(Boolean).join("|"),
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = paragraphRe.exec(xml)) !== null) {
    const body = match[1] ?? "";
    let text = "";
    let token: RegExpExecArray | null;
    tokenRe.lastIndex = 0;
    while ((token = tokenRe.exec(body)) !== null) {
      if (token[1] !== undefined) text += decodeXml(token[1]);
      else if (tab && token[0].startsWith(`<${tab}`)) text += " ";
      else if (token[0].startsWith(`<${br}`)) text += "\n";
    }
    const cleaned = text
      .split("\n")
      .map((line) => line.replace(/[ \t\r\f\v ]+/g, " ").trim())
      .filter((line) => line.length > 0)
      .join("\n");
    if (cleaned.length > 0) paragraphs.push(cleaned);
  }
  return paragraphs.join("\n");
}

/** `word/document.xml`: `w:p` paragraphs of `w:t` runs; `w:tab` a space, `w:br` a newline, runs inside `w:del` dropped. */
export function textFromDocumentXml(xml: string): string {
  const withoutDeletions = xml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, "");
  return paragraphsOf(withoutDeletions, "w:p", "w:t", "w:tab", "w:br");
}

/** `ppt/slides/slide{n}.xml`: `a:p` paragraphs of `a:t` runs, `a:br` a newline. */
export function textFromSlideXml(xml: string): string {
  return paragraphsOf(xml, "a:p", "a:t", null, "a:br");
}

const SLIDE_ENTRY = /^ppt\/slides\/slide(\d+)\.xml$/;

/** The slide entries among the names, sorted by slide number; `_rels` and notes are excluded. */
export function orderSlideEntries(names: readonly string[]): string[] {
  return names
    .map((name) => ({ name, match: SLIDE_ENTRY.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => entry.match !== null)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .map((entry) => entry.name);
}

function capText(text: string, cap: number): { text: string; truncated: boolean } {
  if (text.length <= cap) return { text, truncated: false };
  const cut = text.lastIndexOf(" ", cap);
  return { text: (cut > 0 ? text.slice(0, cut) : text.slice(0, cap)).trimEnd(), truncated: true };
}

function unzip(bytes: Uint8Array, keep: (name: string) => boolean): Record<string, Uint8Array> {
  try {
    return unzipSync(bytes, { filter: (file) => keep(file.name) });
  } catch {
    throw new OfficeTextError("not a zip archive");
  }
}

export function extractDocxText(bytes: Uint8Array): OfficeText {
  const entries = unzip(bytes, (name) => name === "word/document.xml");
  const document = entries["word/document.xml"];
  if (!document) throw new OfficeTextError("not a DOCX: word/document.xml missing");
  const { text, truncated } = capText(textFromDocumentXml(strFromU8(document)), OFFICE_TEXT_CAP);
  return { text, parts: 1, truncated };
}

/** Each slide as `Slide {n}` on a line, its text, then a blank line, in slide order. */
export function extractPptxText(bytes: Uint8Array): OfficeText {
  const entries = unzip(bytes, (name) => SLIDE_ENTRY.test(name));
  const names = orderSlideEntries(Object.keys(entries));
  if (names.length === 0) throw new OfficeTextError("not a PPTX: no slides");
  const blocks = names.map((name) => {
    const number = (SLIDE_ENTRY.exec(name) as RegExpExecArray)[1];
    const body = textFromSlideXml(strFromU8(entries[name]));
    return body.length > 0 ? `Slide ${number}\n${body}` : `Slide ${number}`;
  });
  const { text, truncated } = capText(blocks.join("\n\n"), OFFICE_TEXT_CAP);
  return { text, parts: names.length, truncated };
}
