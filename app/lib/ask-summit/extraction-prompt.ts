/**
 * The extraction prompt: the house-rules system prompt and the user content
 * assembler that fits the crawled pages and the document texts inside one
 * character budget. Pure. The prompt is a code constant because the owner
 * has not written a Notion row for it; the runbook names the move as a
 * follow-up.
 */
import { BTS_PARTS } from "../tools/built-to-scale-method.ts";

export const EXTRACTION_TEXT_BUDGET = 160_000;
/** Documents keep up to this share of the budget; the pages take the rest. */
const DOCS_SHARE = 0.4;
const CUT_MARK = " [cut]";
const NO_MATERIAL_LINE = "No material could be read; return empty parts with low confidence.";

const PART_LINES = BTS_PARTS.map((p) => `${p.key}: ${p.name}. ${p.prompt}`).join("\n");

export const EXTRACTION_SYSTEM_PROMPT = [
  "You prepare the inputs for Summit Strategy Advisory's Built to Scale? assessment from a company's website pages and documents.",
  `The five parts, in order:\n${PART_LINES}`,
  [
    "House rules:",
    "Write each part as the founder would describe their own business, in the first person plural.",
    "Use only what the material says. Do not invent, do not infer beyond it, and do not fill gaps with industry norms.",
    "Quote evidence verbatim from the material, one or two short snippets per part.",
    "When the material is thin for a part, return low confidence and say what is missing in the reason.",
    "When the material says nothing usable for a part, return an empty text with low confidence.",
    "Give numbers only when the material gives them.",
    "British spelling throughout.",
    "No em or en dashes, and no hyphen used as a dash.",
    "No hype words.",
    "The company name as the material gives it; empty when unknown.",
  ].join("\n"),
  "Return the JSON object only.",
].join("\n\n");

export interface ExtractionPage {
  url: string;
  title: string;
  text: string;
}

export interface ExtractionDoc {
  name: string;
  kind: "text" | "pdf" | "rejected";
  text?: string;
  reason?: string;
}

export interface ExtractionMaterial {
  host: string;
  pages: ExtractionPage[];
  docs: ExtractionDoc[];
}

/**
 * Shares `allowance` characters across items by filling the shortest first
 * (water filling), so the longest items are the ones trimmed. Returns the
 * characters each item may keep, in the input order.
 */
function fitLengths(lengths: number[], allowance: number): number[] {
  const order = lengths.map((_, i) => i).sort((a, b) => lengths[a] - lengths[b]);
  const out = new Array<number>(lengths.length).fill(0);
  let remaining = Math.max(0, allowance);
  order.forEach((index, position) => {
    const share = Math.floor(remaining / (order.length - position));
    const take = Math.min(lengths[index], share);
    out[index] = take;
    remaining -= take;
  });
  return out;
}

function cutTo(text: string, allowed: number): string {
  if (text.length <= allowed) return text;
  const limit = Math.max(0, allowed - CUT_MARK.length);
  const cut = text.lastIndexOf(" ", limit);
  return `${(cut > 0 ? text.slice(0, cut) : text.slice(0, limit)).trimEnd()}${CUT_MARK}`;
}

function docLabel(doc: ExtractionDoc): string {
  if (doc.kind === "pdf") return `[Attached PDF: ${doc.name}, sent as a file]`;
  if (doc.kind === "rejected") return `[Document: ${doc.name}, not readable: ${doc.reason ?? "unknown reason"}]`;
  return `[Document: ${doc.name}]`;
}

/**
 * "Company website: {host}", the pages as `[Page n: url] title` plus text,
 * then the documents as `[Document: name]` plus text, `[Attached PDF: name,
 * sent as a file]` or `[Document: name, not readable: reason]`. The whole
 * output is held under EXTRACTION_TEXT_BUDGET: documents keep up to 40
 * percent, no page exceeds budget / max(pages, 4), and the longest texts
 * are trimmed first with a " [cut]" marker.
 */
export function buildExtractionUser(material: ExtractionMaterial, budget: number = EXTRACTION_TEXT_BUDGET): string {
  const header = `Company website: ${material.host}`;
  if (material.pages.length === 0 && material.docs.length === 0) return `${header}\n\n${NO_MATERIAL_LINE}`;

  const pageLabels = material.pages.map((page, i) => `[Page ${i + 1}: ${page.url}] ${page.title}`.trimEnd());
  const docLabels = material.docs.map(docLabel);
  const fixed =
    header.length +
    "## Website pages".length +
    "## Documents".length +
    pageLabels.reduce((n, l) => n + l.length, 0) +
    docLabels.reduce((n, l) => n + l.length, 0) +
    (material.pages.length + material.docs.length + 4) * 4;
  const usable = Math.max(0, budget - fixed);

  const docTexts = material.docs.map((doc) => (doc.kind === "text" ? (doc.text ?? "") : ""));
  const docsAllowance = Math.min(docTexts.reduce((n, t) => n + t.length, 0), Math.floor(usable * DOCS_SHARE));
  const docAllowed = fitLengths(docTexts.map((t) => t.length), docsAllowance);
  const docsUsed = docAllowed.reduce((n, a) => n + a, 0);

  const pagesAllowance = Math.max(0, usable - docsUsed);
  const perPageCap = Math.floor(budget / Math.max(material.pages.length, 4));
  const pageLengths = material.pages.map((page) => Math.min(page.text.length, perPageCap));
  const pageAllowed = fitLengths(pageLengths, pagesAllowance);

  const lines: string[] = [header, ""];
  lines.push("## Website pages");
  if (material.pages.length === 0) lines.push("No pages could be read.");
  material.pages.forEach((page, i) => {
    lines.push(pageLabels[i], cutTo(page.text, pageAllowed[i]), "");
  });
  lines.push("## Documents");
  if (material.docs.length === 0) lines.push("No documents were given.");
  material.docs.forEach((doc, i) => {
    lines.push(docLabels[i]);
    if (doc.kind === "text") lines.push(cutTo(docTexts[i], docAllowed[i]));
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}
