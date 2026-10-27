/**
 * The document stage: download each upload from Blob, confirm its magic
 * bytes against its extension (the server's first look at the bytes), pull
 * the text out of DOCX and PPTX files, and keep PDF bytes in memory for the
 * extraction call. A bad file never fails the stage: it is marked rejected
 * or skipped with a reason the editor shows. PDF bytes are never stored.
 */
import { MODEL_FILES_MAX_BYTES, MODEL_FILE_MAX_BYTES } from "../llm.ts";
import { readBlob } from "./blobs.ts";
import { OfficeTextError, extractDocxText, extractPptxText } from "./office-text.ts";
import type { AskDocEntry, AskFile } from "./request-model.ts";
import { sniffFileType } from "./validation.ts";

/** A 25 MB blob from the same region takes a few seconds; 20 s leaves room for three inside the 40 s stage cap. */
const DOWNLOAD_TIMEOUT_MS = 20_000;
/** With less than this left on the stage a download cannot finish, so the file is marked rejected instead of started. */
const MIN_DOWNLOAD_MS = 1_000;

export interface DocumentsResult {
  docs: AskDocEntry[];
  pdfs: Array<{ name: string; data: Uint8Array }>;
  /** True when a PDF was skipped for size; the draft and the editor say so. */
  pdfDropped: boolean;
}

/**
 * Downloads and reads the files in order, each against what is left of
 * the stage. PDFs are size checked against the model's file limits here,
 * before the extraction call, so an oversized deck is reported as skipped
 * rather than failing the call for every file.
 */
export async function readDocuments(files: readonly AskFile[], opts: { deadlineAt: number }): Promise<DocumentsResult> {
  const docs: AskDocEntry[] = [];
  const pdfs: DocumentsResult["pdfs"] = [];
  let pdfDropped = false;
  let pdfBytes = 0;

  for (const file of files) {
    const base = { name: file.name, pathname: file.pathname, size: file.size, type: file.type };
    const remaining = opts.deadlineAt - Date.now();
    if (remaining < MIN_DOWNLOAD_MS) {
      docs.push({ ...base, status: "rejected", chars: 0, reason: "no time left to read it" });
      continue;
    }
    let bytes: Uint8Array;
    try {
      bytes = await readBlob(file.url, { signal: AbortSignal.timeout(Math.min(DOWNLOAD_TIMEOUT_MS, remaining)) });
    } catch (err) {
      console.error(`ask-summit documents: download failed for ${file.pathname}`, err instanceof Error ? err.message.slice(0, 200) : err);
      docs.push({ ...base, status: "rejected", chars: 0, reason: "could not be downloaded" });
      continue;
    }
    const sniffed = sniffFileType(bytes, file.name);
    if (!sniffed) {
      docs.push({ ...base, status: "rejected", chars: 0, reason: `not a ${file.type.toUpperCase()}` });
      continue;
    }
    if (sniffed === "pdf") {
      if (bytes.length > MODEL_FILE_MAX_BYTES || pdfBytes + bytes.length > MODEL_FILES_MAX_BYTES) {
        pdfDropped = true;
        docs.push({ ...base, status: "skipped", chars: 0, reason: "too large for the model" });
        continue;
      }
      pdfBytes += bytes.length;
      pdfs.push({ name: file.name, data: bytes });
      docs.push({ ...base, status: "pdf", chars: 0 });
      continue;
    }
    try {
      const extracted = sniffed === "docx" ? extractDocxText(bytes) : extractPptxText(bytes);
      docs.push({ ...base, status: "text", chars: extracted.text.length, text: extracted.text, parts: extracted.parts, truncated: extracted.truncated });
    } catch (err) {
      const reason = err instanceof OfficeTextError ? err.message : "could not be read";
      docs.push({ ...base, status: "rejected", chars: 0, reason });
    }
  }

  return { docs, pdfs, pdfDropped };
}
