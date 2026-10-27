/**
 * The extraction stage: one `callModel` call on the `extraction` routing
 * key with the crawled pages and the document texts as the user content and
 * the PDFs as file parts, raced against the stage allowance as the 3a
 * synthesis is. When the call fails with files attached and the allowance
 * still permits one more attempt, it is retried once with no files and the
 * PDFs marked as not sent, so a deck the provider cannot parse does not
 * sink the request. The draft is returned; the caller stores it.
 */
import { callModel, type ModelFile } from "../llm.ts";
import type { BtsPartKey } from "../tools/built-to-scale-method.ts";
import type { CrawledPage } from "./crawl-rules.ts";
import { extractionSchema, parseExtraction, type ExtractionResult } from "./extraction-schema.ts";
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUser, type ExtractionDoc, type ExtractionMaterial } from "./extraction-prompt.ts";
import type { AskDocEntry, AskDraft, AskDraftPart } from "./request-model.ts";
import { STAGE_PLAN, StageTimedOutError } from "./stage-clock.ts";

/** The call is abandoned this long before the stage deadline so the failure is recorded inside the allowance. */
const RACE_MARGIN_MS = 1_000;

export interface DraftPartsArgs {
  requestId: string;
  host: string;
  pages: readonly CrawledPage[];
  docs: readonly AskDocEntry[];
  pdfs: ReadonlyArray<{ name: string; data: Uint8Array }>;
  deadlineAt: number;
}

export interface DraftPartsResult {
  draft: AskDraft;
  model: string;
  ms: number;
  pdfDropped: boolean;
}

function toExtractionDoc(doc: AskDocEntry, pdfsSent: boolean): ExtractionDoc {
  if (doc.status === "text") return { name: doc.name, kind: "text", text: doc.text ?? "" };
  if (doc.status === "pdf") return pdfsSent ? { name: doc.name, kind: "pdf" } : { name: doc.name, kind: "rejected", reason: "not sent to the model" };
  return { name: doc.name, kind: "rejected", reason: doc.reason ?? "not readable" };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The call raced against the deadline: a late model answer is left to settle and logged by llm.ts. */
async function callOnce(args: { requestId: string; user: string; files: ModelFile[]; deadlineAt: number }) {
  const modelCall = callModel({
    routingKey: "extraction",
    runId: null,
    requestId: args.requestId,
    system: EXTRACTION_SYSTEM_PROMPT,
    user: args.user,
    files: args.files,
    schema: extractionSchema(),
    parse: parseExtraction,
    temperature: 0,
  });
  modelCall.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = Math.max(0, args.deadlineAt - RACE_MARGIN_MS - Date.now());
  const abandoned = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StageTimedOutError("extraction", "the extraction overran its allowance")), budget);
  });
  try {
    return await Promise.race([modelCall, abandoned]);
  } finally {
    clearTimeout(timer);
  }
}

export async function draftParts(args: DraftPartsArgs): Promise<DraftPartsResult> {
  const started = Date.now();
  const pages = args.pages.filter((p) => p.text.length > 0).map((p) => ({ url: p.url, title: p.title, text: p.text }));
  const buildMaterial = (pdfsSent: boolean): ExtractionMaterial => ({
    host: args.host,
    pages,
    docs: args.docs.map((doc) => toExtractionDoc(doc, pdfsSent)),
  });

  let files: ModelFile[] = args.pdfs.map((pdf) => ({ name: pdf.name, mediaType: "application/pdf", data: Buffer.from(pdf.data).toString("base64") }));
  let user = buildExtractionUser(buildMaterial(files.length > 0));
  let pdfDropped = false;

  let call: Awaited<ReturnType<typeof callOnce>>;
  try {
    call = await callOnce({ requestId: args.requestId, user, files, deadlineAt: args.deadlineAt });
  } catch (err) {
    const remaining = args.deadlineAt - Date.now();
    if (err instanceof StageTimedOutError || files.length === 0 || remaining < STAGE_PLAN.extraction.minMs) throw err;
    console.error(`ask-summit extraction: retrying without files for ${args.requestId}: ${errorMessage(err).slice(0, 200)}`);
    pdfDropped = true;
    files = [];
    user = buildExtractionUser(buildMaterial(false));
    call = await callOnce({ requestId: args.requestId, user, files, deadlineAt: args.deadlineAt });
  }

  const result: ExtractionResult = call.data;
  const parts = {} as Record<BtsPartKey, AskDraftPart>;
  for (const [key, part] of Object.entries(result.parts) as Array<[BtsPartKey, AskDraftPart]>) parts[key] = { ...part };
  const draft: AskDraft = {
    requestId: args.requestId,
    createdAt: new Date().toISOString(),
    model: call.model,
    companyName: result.companyName || args.host,
    summary: result.summary,
    parts,
    pdfDropped,
    sources: { pages: pages.length, docs: args.docs.filter((d) => d.status === "text").length, pdfs: files.length },
    materialChars: user.length,
  };
  return { draft, model: call.model, ms: Date.now() - started, pdfDropped };
}
