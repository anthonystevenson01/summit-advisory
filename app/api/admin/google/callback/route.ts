import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/app/lib/auth";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  email?: string;
  name?: string;
};

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/admin/login?error=no_code", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const allowedEmail = process.env.ADMIN_ALLOWED_EMAIL;

  if (!clientId || !clientSecret || !allowedEmail) {
    return NextResponse.redirect(new URL("/admin/login?error=not_configured", req.url));
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/admin/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/admin/login?error=token_failed", req.url));
    }

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = (await userRes.json()) as GoogleUserInfo;

    // Verify email matches allowed admin
    if (!user.email || user.email.toLowerCase() !== allowedEmail.toLowerCase()) {
      return NextResponse.redirect(new URL("/admin/login?error=unauthorized", req.url));
    }

    // Create session
    await createSession();
    return NextResponse.redirect(new URL("/admin", req.url));
  } catch {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_failed", req.url));
  }
}
