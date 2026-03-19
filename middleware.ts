import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const config = {
  matcher: ["/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login, reset page and auth API routes through
  if (pathname === "/admin/login" || pathname === "/admin/reset" || pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // Validate session token against Redis
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !redisToken) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    const redis = new Redis({ url, token: redisToken });
    const exists = await redis.get(`admin:session:${token}`);
    if (!exists) {
      const response = NextResponse.redirect(new URL("/admin/login", req.url));
      response.cookies.delete("admin_session");
      return response;
    }
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
}
