import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionToken } from "@/app/lib/auth";
import { getLoginLimiter, getClientIp } from "@/app/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    // Brute-force protection — 20 attempts per IP per 15 minutes
    const limiter = getLoginLimiter();
    if (limiter) {
      const ip = getClientIp(req);
      const { success } = await limiter.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Too many login attempts. Please wait 15 minutes." }, { status: 429 });
      }
    }

    const { password } = (await req.json()) as { password?: string };
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const valid = await verifyPassword(password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = await createSessionToken();
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
