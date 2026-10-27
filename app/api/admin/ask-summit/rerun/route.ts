import { NextRequest, NextResponse } from "next/server";
import { partsForScoring } from "@/app/lib/ask-summit/extraction-schema";
import { claimProcessing, getAskRequest, getDraft, releaseProcessing, saveDraft, updateAskRequest } from "@/app/lib/ask-summit/store";
import { isAskRequestId } from "@/app/lib/ask-summit/validation";
import { validateSession } from "@/app/lib/auth";
import { track } from "@/app/lib/events";
import { getReport, persistRunForReport, saveReport } from "@/app/lib/reports";
import { scoreModel } from "@/app/lib/tools/built-to-scale";
import { BTS_PARTS, validateParts, type BtsPartKey } from "@/app/lib/tools/built-to-scale-method";
import { isValidSlug, mergeRows, recomputeTotal } from "@/app/lib/tools/report-model";
import { redactAddresses } from "@/app/lib/tools/result-email";
import type { AskRequestState } from "@/app/lib/ask-summit/request-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_DEADLINE_MS = 57_000;

/**
 * "Re-run with these inputs" from the editor's drafted inputs section: the
 * five edited parts through the placeholder rule, one scoreModel run as
 * ask-summit, the report pointed at the new run with its rows reset (prior
 * grade and comment edits are not kept, by design; the three written
 * sections are untouched), the previous run id recorded on the request and
 * the edits recorded on the draft. The processing lock guards against a
 * double click or a concurrent reprocess; the claim writes `processing`,
 * so the record's state is restored in `finally` on every path (a done
 * request must never read as processing, then stale, and be reprocessed).
 * A rerun does not count as an attempt.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return redirectTo("/admin/reports?status=not-found");
  }
  const slugValue = form.get("slug");
  const slug = typeof slugValue === "string" ? slugValue.trim() : "";
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  const editor = (query: string) => redirectTo(`/admin/reports/${slug}?${query}`);
  const askValue = form.get("askRequestId");
  const askRequestId = typeof askValue === "string" ? askValue.trim() : "";
  if (!isAskRequestId(askRequestId)) return editor("error=rerun-mismatch");

  let claimed = false;
  let previousState: AskRequestState | null = null;
  try {
    const report = await getReport(slug);
    if (!report) return redirectTo("/admin/reports?status=not-found");
    if (report.askRequestId !== askRequestId) return editor("error=rerun-mismatch");
    const [request, draft] = await Promise.all([getAskRequest(askRequestId), getDraft(askRequestId)]);
    if (!request || !draft) return editor("error=rerun-mismatch");
    previousState = request.state;

    claimed = await claimProcessing(askRequestId, { countAttempt: false });
    if (!claimed) return editor("error=rerun-busy");

    const edits: Partial<Record<BtsPartKey, string>> = {};
    for (const part of BTS_PARTS) {
      const value = form.get(`part:${part.key}`);
      if (typeof value === "string") edits[part.key] = value;
    }
    const parts = partsForScoring(draft.parts, edits);
    if (!validateParts({ parts }).ok) return editor("error=rerun-invalid");

    let run;
    try {
      ({ run } = await scoreModel({ parts }, { source: "ask-summit", requestId: askRequestId, deadlineAt: startedAt + ROUTE_DEADLINE_MS }));
    } catch (err) {
      console.error(`admin ask-summit rerun ${askRequestId}: scoring failed`, err instanceof Error ? err.message : err);
      return editor("error=failed");
    }

    const rows = mergeRows(run.rows.map((r) => ({ key: r.key, grade: r.grade, comment: r.comment })));
    const updatedAt = new Date().toISOString();
    await saveReport(slug, { runId: run.id, rows, ...recomputeTotal(rows), updatedAt });
    try {
      await persistRunForReport(run.id, Object.values(run.children));
    } catch (err) {
      console.error(`admin ask-summit rerun: persist failed for ${run.id}`, err instanceof Error ? err.message : err);
    }
    const previousRunId = request.runId;
    const previousRunIds = previousRunId ? [...request.previousRunIds, previousRunId] : request.previousRunIds;
    // The record keeps its state; the lock claim set `processing`, so it is
    // put back here and again in `finally` (idempotent) for every other path.
    await updateAskRequest(askRequestId, { state: request.state, runId: run.id, previousRunIds });
    const nextParts = { ...draft.parts };
    for (const part of BTS_PARTS) {
      const posted = edits[part.key]?.trim();
      const current = draft.parts[part.key];
      if (posted !== undefined && posted !== current.text) nextParts[part.key] = { ...current, editedText: posted, editedAt: updatedAt };
      else if (posted !== undefined && posted === current.text && current.editedText !== undefined) {
        const { editedText: _editedText, editedAt: _editedAt, ...rest } = current;
        nextParts[part.key] = rest;
      }
    }
    await saveDraft(askRequestId, { ...draft, parts: nextParts });
    void track("ask_rerun", { requestId: askRequestId, runId: run.id, previousRunId, slug });
    return editor("status=rerun");
  } catch (err) {
    console.error(`admin ask-summit rerun ${askRequestId}`, err instanceof Error ? err.message : err);
    return editor("error=failed");
  } finally {
    if (claimed) {
      if (previousState) {
        try {
          await updateAskRequest(askRequestId, { state: previousState });
        } catch (err) {
          console.error(`admin ask-summit rerun: state restore failed for ${askRequestId}`, redactAddresses(err instanceof Error ? err.message : String(err)));
        }
      }
      try {
        await releaseProcessing(askRequestId);
      } catch (err) {
        console.error("admin ask-summit rerun: lock release failed", err instanceof Error ? err.message : err);
      }
    }
  }
}
