import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/app/lib/auth";
import { track } from "@/app/lib/events";
import { SlugTakenError, deleteReport, getReport, renameReport, saveReport, type ReportPatch } from "@/app/lib/reports";
import { BTS_PARTS, type BtsPartKey } from "@/app/lib/tools/built-to-scale-method";
import { hashAccessCode, isAcceptableAccessCode, newAccessCodeSalt } from "@/app/lib/tools/report-access";
import {
  PLACEHOLDER_TEXT,
  applyStateChange,
  defaultExpiry,
  expiryFromDate,
  isIsoDate,
  isReportState,
  isValidSlug,
  mergeRows,
  recomputeTotal,
  slugify,
  type ReportEdits,
  type ReportState,
} from "@/app/lib/tools/report-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Action = "save" | "publish" | "unpublish" | "delete-confirmed" | { reset: BtsPartKey };

function readAction(value: FormDataEntryValue | null): Action {
  if (value === "publish" || value === "unpublish" || value === "delete-confirmed") return value;
  if (typeof value === "string" && value.startsWith("reset:")) {
    const key = value.slice("reset:".length);
    const part = BTS_PARTS.find((p) => p.key === key);
    if (part) return { reset: part.key };
  }
  return "save";
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Save, publish, unpublish, reset a row, delete: one handler branching on
 * the `action` field, every outcome a 303 to the editor (or the list after
 * a delete) with `?status=` or `?error=`. Order: validate everything and
 * write nothing on an error; rename first when the slug changed; merge the
 * rows against the stored originals; apply the state change; hash a new
 * access code; one save. The access code is hashed before any write and
 * never logged; the only logged values are the slug, the action and error
 * messages.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  // The session is checked before the body is read: an unauthenticated POST
  // is refused without parsing a form that may carry an access code.
  if (!(await validateSession())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);
  const editor = (target: string, query: string) => redirectTo(`/admin/reports/${target}?${query}`);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return editor(slug, "error=failed");
  }
  const action = readAction(form.get("action"));

  let report;
  try {
    report = await getReport(slug);
  } catch (err) {
    console.error(`admin report ${slug}: read failed`, err instanceof Error ? err.message : err);
    return editor(slug, "error=failed");
  }
  if (!report) return redirectTo("/admin/reports?status=not-found");

  if (action === "delete-confirmed") {
    try {
      await deleteReport(slug);
    } catch (err) {
      console.error(`admin report ${slug}: delete failed`, err instanceof Error ? err.message : err);
      return editor(slug, "error=failed");
    }
    return redirectTo("/admin/reports?status=deleted");
  }

  // ── Read and validate the candidate; nothing is written on an error ──────
  const company = text(form, "company");
  let nextSlug = text(form, "slug").toLowerCase();
  if (!nextSlug) nextSlug = company ? slugify(company) : slug;
  if (nextSlug !== slug && !isValidSlug(nextSlug)) return editor(slug, "error=slug-invalid");

  const asOf = text(form, "asOf");
  if (!isIsoDate(asOf)) return editor(slug, "error=asof-invalid");

  const expiresRaw = text(form, "expiresAt");
  let expiresAt: string | null | undefined;
  if (expiresRaw) {
    expiresAt = expiryFromDate(expiresRaw);
    if (!expiresAt) return editor(slug, "error=expiry-invalid");
  }

  const stateRaw = text(form, "state");
  if (!isReportState(stateRaw)) return editor(slug, "error=failed");

  const edits: ReportEdits = {};
  for (const part of BTS_PARTS) {
    const gradeRaw = text(form, `grade:${part.key}`);
    const grade = Number(gradeRaw);
    if (!/^[1-5]$/.test(gradeRaw) || !Number.isInteger(grade)) return editor(slug, "error=grade-invalid");
    edits[part.key] = { grade, comment: text(form, `comment:${part.key}`) };
  }
  if (typeof action === "object") {
    const original = report.rows.find((r) => r.key === action.reset)?.original;
    if (original) edits[action.reset] = { grade: original.grade, comment: original.comment };
  }

  const newCode = text(form, "accessCode");
  if (newCode && !isAcceptableAccessCode(newCode)) return editor(slug, "error=code-invalid");
  const clearCode = form.get("clearAccessCode") !== null;

  const nextState: ReportState = action === "publish" ? "published" : action === "unpublish" ? "unpublished" : stateRaw;

  // ── Write ────────────────────────────────────────────────────────────────
  // The rename comes first, ahead of the company check, so that every
  // redirect after it points at the slug the record now lives under
  // (`current`); a redirect to the old slug would land on a 404. The
  // company rule is checked after because it applies to publishing, not to
  // the rename, and a renamed draft refused for a blank company is still
  // renamed, which the editor then shows.
  let current = slug;
  try {
    if (nextSlug !== slug) {
      try {
        await renameReport(slug, nextSlug);
      } catch (err) {
        if (err instanceof SlugTakenError) return editor(slug, "error=slug-taken");
        throw err;
      }
      current = nextSlug;
    }

    if (nextState === "published" && !company) return editor(current, "error=company-required");

    const rows = mergeRows(report.rows.map((r) => ({ key: r.key, grade: r.original.grade, comment: r.original.comment })), edits);
    const { patch: statePatch, event } = applyStateChange({ ...report, slug: current }, nextState);
    const patch: ReportPatch = {
      ...statePatch,
      company,
      asOf,
      opening: text(form, "opening") || PLACEHOLDER_TEXT,
      productThoughts: text(form, "productThoughts") || PLACEHOLDER_TEXT,
      moonshot: text(form, "moonshot") || PLACEHOLDER_TEXT,
      rows,
      ...recomputeTotal(rows),
    };
    // A typed expiry wins over the state change's default. Blank means
    // "30 days from publish" for a published report and null otherwise.
    if (expiresAt !== undefined) {
      patch.expiresAt = expiresAt;
    } else if (statePatch.expiresAt === undefined) {
      const publishedAtMs = Date.parse(statePatch.publishedAt ?? report.publishedAt ?? "");
      patch.expiresAt = nextState === "published" ? defaultExpiry(Number.isFinite(publishedAtMs) ? publishedAtMs : Date.now()) : null;
    }
    if (clearCode) patch.accessCode = null;
    else if (newCode) {
      const salt = newAccessCodeSalt();
      patch.accessCode = { salt, hash: hashAccessCode(newCode, salt) };
    }

    await saveReport(current, patch);
    if (event) void track(event, { slug: current });

    const status = typeof action === "object" ? "reset" : action === "publish" ? "published" : action === "unpublish" ? "unpublished" : "saved";
    return editor(current, `status=${status}`);
  } catch (err) {
    console.error(`admin report ${slug}: ${typeof action === "object" ? "reset" : action} failed`, err instanceof Error ? err.message : err);
    return editor(current, "error=failed");
  }
}
