import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string;
      tool?: string;
      name?: string;
      email?: string;
      company?: string;
    };

    const id = body.id?.trim();
    const tool = body.tool?.trim();
    const name = body.name?.trim();
    const email = body.email?.trim();
    const company = body.company?.trim();

    if (!name || !email || !company) {
      return NextResponse.json({ error: "Name, email, and company are required." }, { status: 400 });
    }

    const redis = getRedis();
    await redis.rpush(
      "gtm-unlocks",
      JSON.stringify({
        id: id || null,
        tool: tool || null,
        name,
        email,
        company,
        unlockedAt: new Date().toISOString(),
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("GTM unlock error", err);
    return NextResponse.json({ error: "Failed to save unlock data." }, { status: 500 });
  }
}
