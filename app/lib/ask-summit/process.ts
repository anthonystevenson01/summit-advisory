/**
 * The six stages of an Ask Summit request under the stage clock: crawl the
 * site, read the documents, draft the five parts with one extraction call,
 * score the draft through the 3a orchestration, create the draft report
 * through the Release 4 store, and finish with the event and the alert to
 * Anthony. Each stage writes what it produced onto the record as soon as it
 * finishes, so a later failure leaves the earlier results visible in the
 * queue and the editor. Any stage failure sets `failed` with the stage and
 * a redacted message and alerts Anthony; the function never throws past
 * this boundary. The route and the local script both call it.
 */
import { track } from "../events.ts";
import { SlugTakenError, createReport, persistRunForReport } from "../reports.ts";
import { PLACEHOLDER_TEXT, mergeRows, placeholderSlugFor, todayIso } from "../tools/report-model.ts";
import { scoreModel } from "../tools/built-to-scale.ts";
import { redactAddresses } from "../tools/result-email.ts";
import type { BtsPartKey } from "../tools/built-to-scale-method.ts";
import type { Confidence } from "../tools/schema.ts";
import { DEFAULT_USER_AGENT } from "./crawl-rules.ts";
import { crawlSite } from "./crawler.ts";
import { readDocuments } from "./documents.ts";
import { draftParts } from "./extraction.ts";
import { partsForScoring } from "./extraction-schema.ts";
import { notifyAnthony } from "./notify.ts";
import { confidenceSummary, type AskRequestRecord } from "./request-model.ts";
import { createStageClock, type AskStage, type AskTimings } from "./stage-clock.ts";
import { getAskRequest, saveDocs, saveDraft, savePages, updateAskRequest } from "./store.ts";

export interface ProcessOutcome {
  state: "done" | "failed";
  failedStage: AskStage | null;
  failedMessage: string | null;
  timings: AskTimings;
  runId: string | null;
  reportSlug: string | null;
}

const FAILED_MESSAGE_MAX = 300;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** ASK_SUMMIT_USER_AGENT overrides the default so a token that sites start blocking can be changed without a deploy. */
export function userAgent(): string {
  return process.env.ASK_SUMMIT_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

/**
 * Runs the six stages for one request. The caller (the route or the
 * script) has already claimed the lock and releases it afterwards;
 * `startedAt` is the function's own start so the clock counts the time
 * spent verifying the signature and loading the record.
 */
export async function processRequest(requestId: string, opts: { origin: string; startedAt: number }): Promise<ProcessOutcome> {
  const clock = createStageClock(opts.startedAt);
  const queueUrl = `${opts.origin}/admin/ask-summit`;
  let stage: AskStage = "crawl";
  let runId: string | null = null;
  let reportSlug: string | null = null;

  const record: AskRequestRecord | null = await getAskRequest(requestId);
  if (!record) {
    return { state: "failed", failedStage: "finish", failedMessage: "request not found", timings: clock.timings(), runId, reportSlug };
  }

  const runStage = async <T>(name: AskStage, work: (deadlineAt: number) => Promise<T>): Promise<T> => {
    stage = name;
    const deadlineAt = clock.deadlineFor(name);
    clock.start(name);
    try {
      return await work(deadlineAt);
    } finally {
      clock.finish(name);
    }
  };

  try {
    // (a) crawl
    const crawl = await runStage("crawl", (deadlineAt) => crawlSite(record.url, { deadlineAt, userAgent: userAgent() }));
    await savePages(requestId, crawl, record.deleteAt);
    await updateAskRequest(requestId, { pageCount: crawl.pages.length });

    // (b) documents
    const documents = await runStage("documents", (deadlineAt) => readDocuments(record.files, { deadlineAt }));
    await saveDocs(requestId, { files: documents.docs }, record.deleteAt);
    const docCount = documents.docs.filter((d) => d.status === "text" || d.status === "pdf").length;
    await updateAskRequest(requestId, { docCount, pdfDropped: documents.pdfDropped });

    // (c) extraction
    const extraction = await runStage("extraction", (deadlineAt) =>
      draftParts({ requestId, host: record.host, pages: crawl.pages, docs: documents.docs, pdfs: documents.pdfs, deadlineAt }),
    );
    // The PDF bytes (up to 75 MB plus their base64 copies) have been sent;
    // drop them before scoring so the function's memory falls back.
    documents.pdfs.length = 0;
    const pdfDropped = documents.pdfDropped || extraction.pdfDropped;
    const draft = { ...extraction.draft, pdfDropped };
    await saveDraft(requestId, draft);
    const confidence = {} as Record<BtsPartKey, Confidence>;
    for (const [key, part] of Object.entries(draft.parts) as Array<[BtsPartKey, { confidence: Confidence }]>) confidence[key] = part.confidence;
    await updateAskRequest(requestId, { companyName: draft.companyName, confidence, extractionModel: extraction.model, pdfDropped });

    // (d) scoring
    const parts = partsForScoring(draft.parts);
    const scored = await runStage("scoring", (deadlineAt) => scoreModel({ parts }, { source: "ask-summit", requestId, deadlineAt }));
    runId = scored.run.id;
    await updateAskRequest(requestId, { runId });

    // (e) report
    reportSlug = await runStage("report", async () => {
      const slug = placeholderSlugFor(scored.run.id);
      try {
        await createReport({
          slug,
          company: draft.companyName,
          runId: scored.run.id,
          asOf: todayIso(),
          rows: mergeRows(scored.run.rows.map((r) => ({ key: r.key, grade: r.grade, comment: r.comment }))),
          opening: draft.summary || PLACEHOLDER_TEXT,
          productThoughts: PLACEHOLDER_TEXT,
          moonshot: PLACEHOLDER_TEXT,
          askRequestId: requestId,
        });
      } catch (err) {
        // The slug is derived from the run id, so a taken slug means a
        // retry already created this report; keep it rather than fail.
        if (!(err instanceof SlugTakenError)) throw err;
      }
      try {
        await persistRunForReport(scored.run.id, Object.values(scored.run.children));
      } catch (err) {
        console.error(`ask-summit process: persist failed for ${scored.run.id}`, errorMessage(err));
      }
      void track("report_created", { slug, askRequestId: requestId });
      return slug;
    });
    await updateAskRequest(requestId, { reportSlug });

    // (f) finish
    await runStage("finish", async () => {
      const timings = clock.timings();
      await updateAskRequest(requestId, { state: "done", finishedAt: new Date().toISOString(), timings });
      void track("ask_processed", {
        requestId,
        runId,
        reportSlug,
        pages: crawl.pages.length,
        docs: docCount,
        confidence: confidenceSummary({ confidence }),
        ms: timings.total,
      });
      await notifyAnthony({
        kind: "done",
        requestId,
        host: record.host,
        companyName: draft.companyName,
        pageCount: crawl.pages.length,
        docCount,
        confidence: confidenceSummary({ confidence }),
        totalMs: timings.total,
        queueUrl,
        editorUrl: `${opts.origin}/admin/reports/${reportSlug}`,
      });
    });

    return { state: "done", failedStage: null, failedMessage: null, timings: clock.timings(), runId, reportSlug };
  } catch (err) {
    const failedMessage = redactAddresses(errorMessage(err)).slice(0, FAILED_MESSAGE_MAX);
    const timings = clock.timings();
    console.error(`ask-summit process: ${requestId} failed at ${stage}: ${failedMessage}`);
    try {
      await updateAskRequest(requestId, { state: "failed", failedStage: stage, failedMessage, finishedAt: new Date().toISOString(), timings });
    } catch (writeErr) {
      console.error(`ask-summit process: failure write failed for ${requestId}`, errorMessage(writeErr));
    }
    void track("ask_failed", { requestId, stage, ms: timings.total });
    await notifyAnthony({ kind: "failed", requestId, host: record.host, companyName: record.companyName || record.company, stage, message: failedMessage, queueUrl });
    return { state: "failed", failedStage: stage, failedMessage, timings, runId, reportSlug };
  }
}
