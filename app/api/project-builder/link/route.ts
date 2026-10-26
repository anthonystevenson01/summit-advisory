import { NextRequest, NextResponse } from "next/server";
import { getBuilderLinkLimiter } from "@/app/lib/ratelimit";
import { getBriefs, listBriefIdsByEmail } from "@/app/lib/briefs";
import { hashEmail } from "@/app/lib/tools/unlock-token";
import { EMAIL_REGEX } from "@/app/lib/tools/validate";
import { renderSaveLinkEmail } from "@/app/lib/project-builder/emails";
import { briefLinks, emailContactOf, honeypotResponse, isHoneypotFilled, limit, readJson, sendBudgeted } from "../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BRIEFS_PER_REQUEST = 5;

/**
 * "Email me my link": always `{ ok: true }` after the limiter, whatever the
 * address, so the response reveals nothing. Sends a fresh link for the
 * newest five briefs under the hash, draft or submitted.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const { body } = parsed;
  if (isHoneypotFilled(body)) return honeypotResponse();

  const limited = await limit(req, getBuilderLinkLimiter(), "link", 3600);
  if (limited) return limited;

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_REGEX.test(email)) return NextResponse.json({ ok: true });
  const emailHash = hashEmail(email);
  const hashPrefix = emailHash.slice(0, 12);

  try {
    const ids = await listBriefIdsByEmail(emailHash);
    const briefs = (await getBriefs(ids)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, MAX_BRIEFS_PER_REQUEST);
    for (const brief of briefs) {
      const links = briefLinks(req.nextUrl.origin, brief.id, emailHash);
      if (!links) {
        console.error(`project-builder link: no link for ${hashPrefix}: UNLOCK_SECRET is not set`);
        break;
      }
      const rendered = renderSaveLinkEmail({
        state: brief.state,
        contact: emailContactOf(brief),
        resumeUrl: links.resumeUrl,
        deleteUrl: links.deleteUrl,
        locked: brief.status !== "draft",
      });
      await sendBudgeted({ to: brief.contact.email || email, email: rendered, startedAt, context: "project-builder link", hashPrefix });
    }
  } catch (err) {
    console.error(`project-builder link: lookup failed for ${hashPrefix}`, err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true });
}
