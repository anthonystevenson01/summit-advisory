import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";
import { createSessionToken } from "@/app/lib/auth";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD_KEY = "admin:password";

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = (await req.json()) as { token?: string; password?: string };

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const redis = getRedis();
    const valid = await redis.get(`admin:reset:${token}`);
    if (!valid) {
      return NextResponse.json({ error: "Reset link is invalid or has expired" }, { status: 400 });
    }

    // Update password
    const hash = await hashPassword(password);
    await redis.set(ADMIN_PASSWORD_KEY, hash);

    // Delete reset token (one-time use)
    await redis.del(`admin:reset:${token}`);

    // Create session so they're logged in immediately
    const sessionToken = await createSessionToken();
    return NextResponse.json({ ok: true, token: sessionToken });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
