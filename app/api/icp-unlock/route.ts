import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      email?: string;
      company?: string;
    };

    const id = body.id?.trim();
    const name = body.name?.trim();
    const email = body.email?.trim();
    const company = body.company?.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!name || !email || !company) {
      return NextResponse.json({ error: "Name, email, and company are required." }, { status: 400 });
    }
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const redis = getRedis();
    await redis.rpush(
      "icp-unlocks",
      JSON.stringify({
        id: id || null,
        name,
        email,
        company,
        unlockedAt: new Date().toISOString(),
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ICP unlock error", err);
    return NextResponse.json({ error: "Failed to save unlock data." }, { status: 500 });
  }
}
