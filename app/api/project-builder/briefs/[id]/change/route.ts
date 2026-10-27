import { NextRequest, NextResponse } from "next/server";
import { getBuilderSaveLimiter } from "@/app/lib/ratelimit";
import { getBrief, updateBrief } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { verifyBriefLinkToken } from "@/app/lib/unlock";
import { BRIEF_ID_PATTERN } from "@/app/lib/project-builder/brief";
import { renderChangeRequestEmail } from "@/app/lib/project-builder/emails";
import { builderErrorResponse } from "../../../errors";
import { BRIEF_GONE, LINK_INVALID, adminUrlFor, emailContactOf, honeypotResponse, isHoneypotFilled, limit, notifyAddress, readJson, sendBudgeted } from "../../../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** "Ask to change something" on the read only view: records the message on the brief and emails Anthony. A draft has nothing to change (409). */
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
    const brief = await getBrief(id);
    if (!brief) return NextResponse.json({ error: BRIEF_GONE }, { status: 404 });
    if (brief.status === "draft") return NextResponse.json({ error: "This brief is still open: make the change in the builder." }, { status: 409 });
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (message.length < 10 || message.length > 1000) {
      return NextResponse.json({ error: "Tell us what to change in 10 to 1,000 characters." }, { status: 400 });
    }
    const now = new Date().toISOString();
    await updateBrief(id, { changeRequest: message, changeRequestedAt: now });

    const notify = notifyAddress();
    if (notify) {
      const email = renderChangeRequestEmail({ state: brief.state, contact: emailContactOf(brief), message, adminUrl: adminUrlFor(req.nextUrl.origin, id) });
      await sendBudgeted({ to: notify, email, startedAt, context: "project-builder change", hashPrefix: brief.contact.emailHash.slice(0, 12), from: notify });
    } else {
      console.error("project-builder change: NOTIFY_EMAIL is not set, request recorded only");
    }
    void track("builder_change_requested");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return builderErrorResponse(err, "project-builder change");
  }
}
