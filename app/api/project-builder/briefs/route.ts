import { NextRequest, NextResponse } from "next/server";
import { getBuilderSaveLimiter } from "@/app/lib/ratelimit";
import { createBrief, updateBrief } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { hashEmail } from "@/app/lib/tools/unlock-token";
import { createBriefPage, isNotionBriefsConfigured } from "@/app/lib/project-builder-notion";
import { SOURCE_MAX_CHARS, normaliseSourceTag, parseBriefState, validateContact } from "@/app/lib/project-builder/brief";
import { renderSaveLinkEmail } from "@/app/lib/project-builder/emails";
import { builderErrorResponse } from "../errors";
import { adminUrlFor, briefLinks, emailContactOf, honeypotResponse, isHoneypotFilled, limit, readJson, sendBudgeted } from "../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The first save. Order: parse, honeypot, state, contact, limiter, the
 * record (the one step that may fail the request), the event, Notion (a
 * value, never a throw, before the mail so its worst case cannot starve the
 * mail budget), then the save link email under the 1b budget rule. The
 * response carries the token the page uses for every later call; without
 * `UNLOCK_SECRET` the brief is still recorded and `token` is null.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();

  try {
    const state = parseBriefState(body.state);
    const validated = validateContact(body.contact);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
    const source = typeof body.source === "string" ? body.source.slice(0, SOURCE_MAX_CHARS) : "";
    const sourceTag = normaliseSourceTag(body.src);

    const limited = await limit(req, getBuilderSaveLimiter(), "save", 3600);
    if (limited) return limited;

    const emailHash = hashEmail(validated.contact.email);
    let record;
    try {
      record = await createBrief({ state, source, contact: { ...validated.contact, emailHash }, sourceTag });
    } catch (err) {
      console.error("project-builder save: record write failed", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Could not save just now. Your brief is still on this device." }, { status: 500 });
    }
    void track("builder_saved", { source: sourceTag, path: state.path });

    const origin = req.nextUrl.origin;
    let notion: "ok" | "failed" | "skipped" = "skipped";
    if (isNotionBriefsConfigured()) {
      const result = await createBriefPage(record, source || null, adminUrlFor(origin, record.id));
      notion = result.ok ? "ok" : "failed";
      if (!result.ok) console.error(`project-builder save: Notion write failed for ${record.id}: ${result.error}`);
      try {
        await updateBrief(record.id, { notionPageId: result.ok ? result.pageId : null, notionStatus: result.ok ? "ok" : "failed" });
      } catch (err) {
        console.error("project-builder save: Notion status write failed", err instanceof Error ? err.message : err);
      }
    }

    const links = briefLinks(origin, record.id, emailHash);
    let emailed = false;
    if (links) {
      const email = renderSaveLinkEmail({ state, contact: emailContactOf(record), resumeUrl: links.resumeUrl, deleteUrl: links.deleteUrl });
      emailed = await sendBudgeted({ to: validated.contact.email, email, startedAt, context: "project-builder save", hashPrefix: emailHash.slice(0, 12) });
    } else {
      console.error(`project-builder save: no link for ${emailHash.slice(0, 12)}: UNLOCK_SECRET is not set`);
    }
    try {
      await updateBrief(record.id, { lastEmailStatus: emailed ? "sent" : "failed" });
    } catch (err) {
      console.error("project-builder save: email status write failed", err instanceof Error ? err.message : err);
    }

    return NextResponse.json({ ok: true, id: record.id, token: links?.token ?? null, savedAt: record.savedAt, emailed, notion });
  } catch (err) {
    return builderErrorResponse(err, "project-builder save");
  }
}
