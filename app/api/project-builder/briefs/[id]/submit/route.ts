import { NextRequest, NextResponse } from "next/server";
import { getBuilderSaveLimiter } from "@/app/lib/ratelimit";
import { getBrief, getBriefSource, saveBriefState, setBriefStatus, updateBrief } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { verifyBriefLinkToken } from "@/app/lib/unlock";
import { createBriefPage, isNotionBriefsConfigured, updateBriefPage } from "@/app/lib/project-builder-notion";
import { notionPageUrl } from "@/app/lib/project-builder/notion-brief";
import { BRIEF_ID_PATTERN, SOURCE_MAX_CHARS, parseBriefState } from "@/app/lib/project-builder/brief";
import { buildRequirements, countByPriority } from "@/app/lib/project-builder/requirements";
import { renderAlertEmail, renderConfirmationEmail } from "@/app/lib/project-builder/emails";
import { builderErrorResponse } from "../../../errors";
import {
  BRIEF_GONE,
  LINK_INVALID,
  adminUrlFor,
  briefLinks,
  emailContactOf,
  honeypotResponse,
  isHoneypotFilled,
  limit,
  notifyAddress,
  readJson,
  sendBudgeted,
} from "../../../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * Submit. Order: parse, honeypot, pattern, token, limiter, record, already
 * submitted (409), the final state saved, the status moved (PERSIST), the
 * event, Notion (update with the body appended, or a second chance at a
 * create), the confirmation to the prospect, the alert to NOTIFY_EMAIL.
 * After the status moves nothing can fail the prospect: every side effect
 * is a value on the record.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const startedAt = Date.now();
  const { id } = await params;
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();
  if (!BRIEF_ID_PATTERN.test(id)) return NextResponse.json({ error: "That brief id is not valid." }, { status: 400 });
  if (!verifyBriefLinkToken(body.token, id)) return NextResponse.json({ error: LINK_INVALID }, { status: 403 });

  const limited = await limit(req, getBuilderSaveLimiter(), "save", 3600);
  if (limited) return limited;

  try {
    const existing = await getBrief(id);
    if (!existing) return NextResponse.json({ error: BRIEF_GONE }, { status: 404 });
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "This brief has already been submitted.", locked: true }, { status: 409 });
    }
    const state = parseBriefState(body.state);
    const source = typeof body.source === "string" ? body.source.slice(0, SOURCE_MAX_CHARS) : undefined;
    await saveBriefState(id, state, source);
    const record = await setBriefStatus(id, "submitted", "prospect");
    if (!record) return NextResponse.json({ error: BRIEF_GONE }, { status: 404 });
    const submittedAt = record.submittedAt ?? new Date().toISOString();

    const mustCount = countByPriority(buildRequirements(state)).Must;
    void track("builder_submitted", { source: record.sourceTag, path: state.path, mustCount });

    const origin = req.nextUrl.origin;
    const adminUrl = adminUrlFor(origin, id);
    const storedSource = source ?? (await getBriefSource(id));
    let notionStatus: "ok" | "failed" | null = record.notionStatus;
    let notionPageId = record.notionPageId;
    if (isNotionBriefsConfigured()) {
      const result = notionPageId
        ? await updateBriefPage(record, storedSource, adminUrl, { appendBody: true })
        : await createBriefPage(record, storedSource, adminUrl);
      notionStatus = result.ok ? "ok" : "failed";
      if (result.ok) notionPageId = result.pageId;
      else console.error(`project-builder submit: Notion write failed for ${id}: ${result.error}`);
      try {
        await updateBrief(id, { notionPageId, notionStatus });
      } catch (err) {
        console.error("project-builder submit: Notion status write failed", err instanceof Error ? err.message : err);
      }
    }

    const hashPrefix = record.contact.emailHash.slice(0, 12);
    const links = briefLinks(origin, id, record.contact.emailHash);
    let emailed = false;
    if (links) {
      const email = renderConfirmationEmail({ state, contact: emailContactOf(record), viewUrl: links.resumeUrl, deleteUrl: links.deleteUrl });
      emailed = await sendBudgeted({ to: record.contact.email, email, startedAt, context: "project-builder submit", hashPrefix });
    } else {
      console.error(`project-builder submit: no link for ${hashPrefix}: UNLOCK_SECRET is not set`);
    }
    try {
      await updateBrief(id, { lastEmailStatus: emailed ? "sent" : "failed" });
    } catch (err) {
      console.error("project-builder submit: email status write failed", err instanceof Error ? err.message : err);
    }

    const notify = notifyAddress();
    if (notify) {
      const alert = renderAlertEmail({
        state,
        contact: emailContactOf(record),
        sourceTag: record.sourceTag,
        adminUrl,
        notionFailed: notionStatus !== "ok",
        notionUrl: notionPageId ? notionPageUrl(notionPageId) : null,
      });
      await sendBudgeted({ to: notify, email: alert, startedAt, context: "project-builder alert", hashPrefix, from: notify });
    } else {
      console.error("project-builder submit: NOTIFY_EMAIL is not set, no alert sent");
    }

    return NextResponse.json({ ok: true, submittedAt, emailed });
  } catch (err) {
    return builderErrorResponse(err, "project-builder submit");
  }
}
