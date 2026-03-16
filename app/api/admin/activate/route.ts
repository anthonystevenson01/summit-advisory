import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/app/lib/redis";
import { sessionCookieOptions } from "@/app/lib/auth";

// GET /api/admin/activate?token=xxx
// Sets the session cookie and redirects to /admin
// This is the reliable way to set cookies — via a browser navigation (GET redirect)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login?error=Missing+token", req.url));
  }

  // Verify the token exists in Redis
  const redis = getRedis();
  const exists = await redis.get(`admin:session:${token}`);
  if (exists !== "1") {
    return NextResponse.redirect(new URL("/admin/login?error=Invalid+session", req.url));
  }

  const opts = sessionCookieOptions();
  const response = NextResponse.redirect(new URL("/admin", req.url));
  response.cookies.set(opts.name, token, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
  });
  return response;
}
