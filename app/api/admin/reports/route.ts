import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/app/lib/auth";
import { track } from "@/app/lib/events";
import { SlugTakenError, createReport, getReport, persistRunForReport } from "@/app/lib/reports";
import { getCompositeRun, isRunId } from "@/app/lib/runs";
import { PLACEHOLDER_TEXT, mergeRows, placeholderSlugFor, todayIso } from "@/app/lib/tools/report-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * "Create report" on /admin/reports/new: a draft from a composite run,
 * keyed under the placeholder slug until Anthony names it, rows copied
 * with the run's originals, the three sections as placeholders. A second
 * click on the same run reopens the same draft. The run and its children
 * are PERSISTed so the working outlives the run's 30 day TTL.
 */
export async function POST(req: NextRequest) {
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  let runId = "";
  try {
    const form = await req.formData();
    const value = form.get("runId");
    if (typeof value === "string") runId = value.trim();
  } catch {
    runId = "";
  }
  if (!isRunId(runId)) return redirectTo("/admin/reports/new?error=run-not-found");

  try {
    const run = await getCompositeRun(runId);
    if (!run) return redirectTo("/admin/reports/new?error=run-not-found");

    const slug = placeholderSlugFor(runId);
    if (await getReport(slug)) return redirectTo(`/admin/reports/${slug}?status=exists`);

    const rows = mergeRows(run.rows.map((r) => ({ key: r.key, grade: r.grade, comment: r.comment })));
    try {
      await createReport({
        slug,
        company: "",
        runId,
        asOf: todayIso(),
        rows,
        opening: PLACEHOLDER_TEXT,
        productThoughts: PLACEHOLDER_TEXT,
        moonshot: PLACEHOLDER_TEXT,
      });
    } catch (err) {
      if (err instanceof SlugTakenError) return redirectTo(`/admin/reports/${slug}?status=exists`);
      throw err;
    }
    try {
      await persistRunForReport(runId, Object.values(run.children));
    } catch (err) {
      console.error(`admin reports create: persist failed for ${runId}`, err instanceof Error ? err.message : err);
    }
    void track("report_created", { slug });
    return redirectTo(`/admin/reports/${slug}?status=created`);
  } catch (err) {
    console.error("admin reports create", err instanceof Error ? err.message : err);
    return redirectTo("/admin/reports/new?error=failed");
  }
}
