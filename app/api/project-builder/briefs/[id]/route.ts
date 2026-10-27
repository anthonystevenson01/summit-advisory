import { NextRequest, NextResponse } from "next/server";
import { getBuilderSaveLimiter } from "@/app/lib/ratelimit";
import { getBrief, getBriefSource, saveBriefState, type BriefContact } from "@/app/lib/briefs";
import { track } from "@/app/lib/events";
import { hashEmail } from "@/app/lib/tools/unlock-token";
import { verifyBriefLinkToken } from "@/app/lib/unlock";
import { BRIEF_ID_PATTERN, SOURCE_MAX_CHARS, isFreeMailAddress, isLocked, parseBriefState, validateContact } from "@/app/lib/project-builder/brief";
import { BRIEF_LOCKED_MESSAGE, builderErrorResponse } from "../../errors";
import { BRIEF_GONE, LINK_INVALID, honeypotResponse, isHoneypotFilled, limit, readJson } from "../../brief-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Resume: `?t=` must verify for the id; the load shape carries the state, the source and the contact. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!BRIEF_ID_PATTERN.test(id)) return NextResponse.json({ error: "That brief id is not valid." }, { status: 400 });
  const token = req.nextUrl.searchParams.get("t");
  if (!verifyBriefLinkToken(token, id)) return NextResponse.json({ error: LINK_INVALID }, { status: 403 });
  try {
    const brief = await getBrief(id);
    if (!brief) return NextResponse.json({ error: BRIEF_GONE }, { status: 404 });
    const source = await getBriefSource(id);
    void track("builder_resumed", { status: brief.status });
    const { name, email, company, website, marketing } = brief.contact;
    return NextResponse.json(
      {
        ok: true,
        id: brief.id,
        state: brief.state,
        source: source ?? "",
        contact: { name, email, company, website, marketing },
        status: brief.status,
        savedAt: brief.savedAt,
        submittedAt: brief.submittedAt,
        updatedAt: brief.updatedAt,
        suggestCount: brief.suggestCount,
        ideasCount: brief.ideasCount,
        readCount: brief.readCount,
        freeMail: isFreeMailAddress(email),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return builderErrorResponse(err, "project-builder load");
  }
}

/** Autosave: the token, the limiter, the record, the lock, then the state, the optional source and contact. Last write wins. */
export async function PUT(req: NextRequest, { params }: Params) {
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
    if (isLocked(brief.status)) return NextResponse.json({ error: BRIEF_LOCKED_MESSAGE, locked: true }, { status: 409 });
    const state = parseBriefState(body.state);
    const source = typeof body.source === "string" ? body.source.slice(0, SOURCE_MAX_CHARS) : undefined;
    let contact: BriefContact | undefined;
    if (body.contact !== undefined) {
      const validated = validateContact(body.contact);
      if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
      contact = { ...validated.contact, emailHash: hashEmail(validated.contact.email) };
    }
    const savedAt = await saveBriefState(id, state, source, contact);
    return NextResponse.json({ ok: true, savedAt });
  } catch (err) {
    return builderErrorResponse(err, "project-builder autosave");
  }
}
