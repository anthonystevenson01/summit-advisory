import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/app/lib/auth";
import { deleteBrief, getBrief, getBriefSource, setBriefStatus, updateBrief } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { isMailConfigured, resultFromAddress, sendMail } from "@/app/lib/mail";
import { getUnlockSecret, issueBriefDeleteToken, issueBriefLinkToken } from "@/app/lib/unlock";
import { archiveBriefPage, isNotionBriefsConfigured, updateBriefPage } from "@/app/lib/project-builder-notion";
import { BRIEF_ID_PATTERN, canTransition, isBriefStatus } from "@/app/lib/project-builder/brief";
import { renderUnlockEmail } from "@/app/lib/project-builder/emails";
import { redactAddresses } from "@/app/lib/tools/result-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const SEND_TIMEOUT_MS = 10_000;

/**
 * The three admin actions as one form POST behind the session: `status`
 * (with `status`), `unlock`, and `delete` (with `confirm=yes`). Each
 * redirects 303 back to the brief, or to the list after a delete. Notion is
 * updated with the properties only and never blocks; the unlock email goes
 * out with a fresh link token.
 */
export async function POST(req: NextRequest, { params }: Params) {
  if (!(await validateSession())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  if (!BRIEF_ID_PATTERN.test(id)) return NextResponse.json({ error: "That brief id is not valid." }, { status: 400 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form." }, { status: 400 });
  }
  const action = form.get("action");
  const origin = req.nextUrl.origin;
  const briefUrl = (query: string) => `${origin}/admin/briefs/${encodeURIComponent(id)}${query}`;
  const adminUrl = briefUrl("");

  try {
    const brief = await getBrief(id);
    if (!brief) return NextResponse.json({ error: "Brief not found." }, { status: 404 });

    if (action === "status") {
      const status = form.get("status");
      if (!isBriefStatus(status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
      if (!canTransition(brief.status, status, "admin")) return NextResponse.json({ error: "That change is not allowed." }, { status: 400 });
      const updated = await setBriefStatus(id, status, "admin");
      if (updated && isNotionBriefsConfigured() && updated.notionPageId) {
        const r = await updateBriefPage(updated, await getBriefSource(id), adminUrl, { appendBody: false });
        await updateBrief(id, { notionStatus: r.ok ? "ok" : "failed" });
        if (!r.ok) console.error(`admin briefs: Notion status update failed for ${id}: ${r.error}`);
      }
      return NextResponse.redirect(briefUrl("?saved=1"), 303);
    }

    if (action === "unlock") {
      if (brief.status === "draft") return NextResponse.json({ error: "The brief is already a draft." }, { status: 400 });
      const updated = await setBriefStatus(id, "draft", "admin");
      if (!updated) return NextResponse.json({ error: "Brief not found." }, { status: 404 });
      if (isNotionBriefsConfigured() && updated.notionPageId) {
        const r = await updateBriefPage(updated, await getBriefSource(id), adminUrl, { appendBody: false });
        await updateBrief(id, { notionStatus: r.ok ? "ok" : "failed" });
      }
      let emailed = false;
      const token = issueBriefLinkToken(id);
      const deleteToken = issueBriefDeleteToken(brief.contact.emailHash);
      if (getUnlockSecret() && isMailConfigured() && token && deleteToken && brief.contact.email) {
        const email = renderUnlockEmail({
          state: updated.state,
          contact: { name: brief.contact.name, company: brief.contact.company, website: brief.contact.website },
          resumeUrl: `${origin}/tools/project-builder?b=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`,
          deleteUrl: `${origin}/api/project-builder/delete?e=${encodeURIComponent(brief.contact.emailHash)}&t=${encodeURIComponent(deleteToken)}`,
        });
        try {
          await sendMail({ from: resultFromAddress(), to: brief.contact.email, subject: email.subject, text: email.text, html: email.html, timeoutMs: SEND_TIMEOUT_MS });
          emailed = true;
        } catch (err) {
          console.error(`admin briefs: unlock email failed for ${brief.contact.emailHash.slice(0, 12)}: ${redactAddresses(err instanceof Error ? err.message : String(err))}`);
        }
      } else {
        console.error(`admin briefs: unlock email skipped for ${brief.contact.emailHash.slice(0, 12)}: secret, SMTP or address missing`);
      }
      await updateBrief(id, { lastEmailStatus: emailed ? "sent" : "failed" });
      return NextResponse.redirect(briefUrl(`?unlocked=${emailed ? "1" : "0"}`), 303);
    }

    if (action === "delete") {
      if (form.get("confirm") !== "yes") return NextResponse.json({ error: "Tick the confirmation box to delete." }, { status: 400 });
      const deleted = await deleteBrief(id);
      if (deleted?.notionPageId) await archiveBriefPage(deleted.notionPageId);
      void track("brief_deleted", { count: deleted ? 1 : 0 });
      return NextResponse.redirect(`${origin}/admin/briefs?deleted=1`, 303);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("admin briefs POST", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not apply the change." }, { status: 500 });
  }
}
